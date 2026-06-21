import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertPlatformAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: platform admin only");
}

// Simple price assumptions for MRR estimate (USD / org / month)
const TIER_PRICE: Record<string, number> = { basic: 0, premium: 49, enterprise: 299 };

export const getBillingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [orgs, members] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, subscription_tier"),
      supabaseAdmin.from("organization_members").select("org_id"),
    ]);

    const tierCounts: Record<string, number> = { basic: 0, premium: 0, enterprise: 0 };
    let mrr = 0;
    for (const o of orgs.data ?? []) {
      const t = (o.subscription_tier as string) ?? "basic";
      tierCounts[t] = (tierCounts[t] ?? 0) + 1;
      mrr += TIER_PRICE[t] ?? 0;
    }
    const totalSeats = members.data?.length ?? 0;

    return {
      mrr,
      arr: mrr * 12,
      totalSeats,
      tierCounts,
      orgCount: orgs.data?.length ?? 0,
    };
  });

export const listOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, subscription_tier, created_at, data_backend")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const { data: members } = await supabaseAdmin
      .from("organization_members")
      .select("org_id");
    const seatsByOrg = new Map<string, number>();
    for (const m of members ?? []) {
      seatsByOrg.set(m.org_id as string, (seatsByOrg.get(m.org_id as string) ?? 0) + 1);
    }

    return (orgs ?? []).map((o) => ({
      ...o,
      seats: seatsByOrg.get(o.id) ?? 0,
      monthly: TIER_PRICE[(o.subscription_tier as string) ?? "basic"] ?? 0,
    }));
  });

export const updateOrgTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        tier: z.enum(["basic", "premium", "enterprise"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ subscription_tier: data.tier })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
