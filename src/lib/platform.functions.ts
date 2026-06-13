import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertPlatformAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "platform_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: platform admin only");
}

/** Open to any signed-in user; inserts a row tied to their user_id. */
export const trackEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        eventType: z.string().min(1).max(80),
        orgId: z.string().uuid().nullable().optional(),
        properties: z.record(z.string(), z.any()).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("analytics_events").insert({
      user_id: context.userId,
      org_id: data.orgId ?? null,
      event_type: data.eventType,
      properties: data.properties ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const isPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "platform_admin",
    });
    return { isAdmin: !!data };
  });

export const getPlatformOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { instrument } = await import("@/lib/instrument.server");
    return instrument("platform.overview", async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const since1d = new Date(now - 24 * 3600_000).toISOString();
    const since7d = new Date(now - 7 * 24 * 3600_000).toISOString();
    const since30d = new Date(now - 30 * 24 * 3600_000).toISOString();

    const [users, orgs, sessions30d, events1d, events7d, events30d, corpOrgs] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("organizations").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since30d),
        supabaseAdmin
          .from("analytics_events")
          .select("user_id")
          .gte("created_at", since1d),
        supabaseAdmin
          .from("analytics_events")
          .select("user_id")
          .gte("created_at", since7d),
        supabaseAdmin
          .from("analytics_events")
          .select("user_id")
          .gte("created_at", since30d),
        supabaseAdmin
          .from("organizations")
          .select("id", { count: "exact", head: true })
          .in("subscription_tier", ["premium", "enterprise"]),
      ]);

    const uniq = (rows: any[] | null) =>
      new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)).size;

    return {
      totalUsers: users.count ?? 0,
      totalOrgs: orgs.count ?? 0,
      corporateOrgs: corpOrgs.count ?? 0,
      sessionsRun30d: sessions30d.count ?? 0,
      dau: uniq(events1d.data),
      wau: uniq(events7d.data),
      mau: uniq(events30d.data),
    };
  });

export const getActivityTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const { data: rows, error } = await supabaseAdmin
      .from("analytics_events")
      .select("user_id, created_at")
      .gte("created_at", since.toISOString());
    if (error) throw new Error(error.message);

    const byDay = new Map<string, Set<string>>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getTime() + i * 24 * 3600_000);
      byDay.set(d.toISOString().slice(0, 10), new Set());
    }
    for (const r of rows ?? []) {
      const day = (r.created_at as string).slice(0, 10);
      const set = byDay.get(day);
      if (set && r.user_id) set.add(r.user_id as string);
    }
    return Array.from(byDay.entries()).map(([day, set]) => ({
      day,
      users: set.size,
    }));
  });

export const getTopEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select("event_type")
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    for (const r of data ?? [])
      counts.set(r.event_type as string, (counts.get(r.event_type as string) ?? 0) + 1);
    return Array.from(counts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  });

export const getOrgTierBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("subscription_tier");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = { basic: 0, premium: 0, enterprise: 0 };
    for (const r of data ?? []) {
      const t = (r.subscription_tier as string) ?? "basic";
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  });
