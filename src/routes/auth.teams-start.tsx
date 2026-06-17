import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { exchangeTeamsToken } from "@/lib/teams-auth.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/teams-start")({
  head: () => ({ meta: [{ title: "Signing in… — QuizPulse" }] }),
  component: TeamsAuthStart,
});

/**
 * Popup launched by `microsoftTeams.authentication.authenticate()`. Runs the
 * full Teams SSO → Lovable Cloud session exchange:
 *   1. Ask the Teams host for an SSO id_token (silent for the user).
 *   2. Server-side: verify the token, find/create the Supabase user, mint
 *      a one-time magiclink hash.
 *   3. Redeem with supabase.auth.verifyOtp to establish a real session.
 *   4. Notify the parent tab so it can resume.
 */
function TeamsAuthStart() {
  const [msg, setMsg] = useState("Signing you in with Microsoft Teams…");

  useEffect(() => {
    (async () => {
      let teams: typeof import("@microsoft/teams-js");
      try {
        teams = await import("@microsoft/teams-js");
        await teams.app.initialize();
      } catch {
        setMsg("This page must be opened from inside Microsoft Teams.");
        return;
      }

      try {
        const idToken = await teams.authentication.getAuthToken();
        const { email, tokenHash, orgId } = await exchangeTeamsToken({
          data: { idToken },
        });
        const { error } = await supabase.auth.verifyOtp({
          type: "magiclink",
          email,
          token_hash: tokenHash,
        });
        if (error) throw error;
        if (orgId) {
          try {
            window.localStorage.setItem("qp.currentOrgId", orgId);
          } catch {
            /* storage may be blocked in the popup; non-fatal */
          }
        }
        teams.authentication.notifySuccess(email);
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : "teams_sso_failed";
        setMsg(`Sign-in failed: ${reason}`);
        try {
          teams.authentication.notifyFailure(reason);
        } catch {
          /* parent isn't listening */
        }
      }
    })();
  }, []);

  return (
    <div className="min-h-screen grid place-items-center px-6 bg-background text-foreground">
      <div className="glass-panel rounded-2xl p-8 max-w-md text-center">
        <div className="mx-auto size-10 rounded-md bg-primary grid place-items-center text-primary-foreground font-display font-bold">
          Q
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold">
          Microsoft sign-in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
      </div>
    </div>
  );
}
