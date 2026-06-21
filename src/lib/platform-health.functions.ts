import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const since1h = new Date(Date.now() - 3600_000).toISOString();

    const [errors24h, errors1h, perfRows, jobsByStatus] = await Promise.all([
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "_error")
        .gte("created_at", since24h),
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "_error")
        .gte("created_at", since1h),
      supabaseAdmin
        .from("analytics_events")
        .select("properties")
        .eq("event_type", "_perf")
        .gte("created_at", since24h)
        .limit(2000),
      supabaseAdmin
        .from("ai_generation_jobs")
        .select("status"),
    ]);

    // p50 / p95 latency from perf events
    const ms: number[] = (perfRows.data ?? [])
      .map((r: any) => Number(r.properties?.ms))
      .filter((n: number) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const pct = (p: number) =>
      ms.length === 0 ? 0 : Math.round(ms[Math.min(ms.length - 1, Math.floor((ms.length - 1) * p))]);

    const queue: Record<string, number> = {
      pending: 0, generating: 0, review: 0, approved: 0, rejected: 0, failed: 0,
    };
    for (const r of jobsByStatus.data ?? []) {
      const s = (r.status as string) ?? "pending";
      queue[s] = (queue[s] ?? 0) + 1;
    }

    return {
      errors1h: errors1h.count ?? 0,
      errors24h: errors24h.count ?? 0,
      latencyP50: pct(0.5),
      latencyP95: pct(0.95),
      latencySamples: ms.length,
      aiQueue: queue,
    };
  });

export const getRecentErrors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select("created_at, properties")
      .eq("event_type", "_error")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      createdAt: r.created_at as string,
      op: (r.properties?.op as string) ?? "unknown",
      message: (r.properties?.message as string) ?? "",
    }));
  });
