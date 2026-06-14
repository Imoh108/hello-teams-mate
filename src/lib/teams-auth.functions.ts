import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Exchange a Microsoft Teams SSO id_token for a Lovable Cloud (Supabase)
 * session. Flow:
 *   1. Client calls microsoftTeams.authentication.getAuthToken() and posts
 *      the resulting id_token here.
 *   2. We verify the JWT against Entra ID's JWKS for our app's audience.
 *   3. We find-or-create a Supabase auth user keyed on the verified email.
 *   4. We mint a single-use magiclink hash and return its `token_hash`.
 *   5. Client redeems with supabase.auth.verifyOtp({ type:'magiclink', ...}).
 *
 * The id_token never leaves the server unverified; only the redeemable
 * token_hash is returned to the browser.
 */
export const exchangeTeamsToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        idToken: z.string().min(20).max(8192),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const clientId = process.env.ENTRA_CLIENT_ID;
    const tenantId = process.env.ENTRA_TENANT_ID;
    if (!clientId || !tenantId) {
      throw new Error("Entra ID is not configured on the server");
    }

    const { jwtVerify, createRemoteJWKSet } = await import("jose");

    // Teams SSO tokens are issued by the user's home tenant, so accept
    // both the configured tenant and the multi-tenant "common" issuer.
    const jwks = createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      ),
    );

    let payload: Record<string, unknown>;
    try {
      const verified = await jwtVerify(data.idToken, jwks, {
        audience: [clientId, `api://${clientId}`],
      });
      payload = verified.payload as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Invalid Teams SSO token: ${err instanceof Error ? err.message : "verify failed"}`,
      );
    }

    const email =
      (payload.email as string | undefined) ??
      (payload.preferred_username as string | undefined) ??
      (payload.upn as string | undefined);
    if (!email || !email.includes("@")) {
      throw new Error("Teams SSO token did not include an email claim");
    }

    const displayName =
      (payload.name as string | undefined) ?? email.split("@")[0];
    const tenantClaim = (payload.tid as string | undefined) ?? tenantId;
    const oid = payload.oid as string | undefined;

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Find-or-create the auth user. Admin list-by-email isn't directly
    // available, so we attempt createUser and fall back to lookup on
    // duplicate-email errors.
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          full_name: displayName,
          teams_oid: oid,
          teams_tid: tenantClaim,
          provider: "microsoft_teams",
        },
      });

    if (createErr && !/already|exist|registered/i.test(createErr.message)) {
      throw new Error(`Provisioning failed: ${createErr.message}`);
    }
    void created;

    // Mint a single-use magiclink and return its hashed token to the
    // client. The action_link is discarded; the client redeems via
    // verifyOtp with the email + token_hash.
    const { data: link, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error(
        `Could not issue session: ${linkErr?.message ?? "no token returned"}`,
      );
    }

    return {
      email,
      tokenHash: link.properties.hashed_token,
    };
  });
