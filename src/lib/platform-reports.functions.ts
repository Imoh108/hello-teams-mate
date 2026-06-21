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

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const generateUsageReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid().nullable().optional(),
      days: z.number().int().min(1).max(365).default(30),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 24 * 3600_000).toISOString();

    let evQ = supabaseAdmin
      .from("analytics_events")
      .select("event_type, user_id, org_id, created_at")
      .gte("created_at", since);
    if (data.orgId) evQ = evQ.eq("org_id", data.orgId);
    const { data: events, error } = await evQ;
    if (error) throw new Error(error.message);

    // Aggregate by day
    const byDay = new Map<string, { events: number; users: Set<string> }>();
    const byType = new Map<string, number>();
    for (const e of events ?? []) {
      const day = (e.created_at as string).slice(0, 10);
      const bucket = byDay.get(day) ?? { events: 0, users: new Set<string>() };
      bucket.events++;
      if (e.user_id) bucket.users.add(e.user_id as string);
      byDay.set(day, bucket);
      byType.set(e.event_type as string, (byType.get(e.event_type as string) ?? 0) + 1);
    }

    const dailyRows = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({ day, events: v.events, unique_users: v.users.size }));
    const typeRows = Array.from(byType.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([event_type, count]) => ({ event_type, count }));

    const total = events?.length ?? 0;
    const uniqueUsers = new Set((events ?? []).map((e) => e.user_id).filter(Boolean)).size;

    const orgLabel = data.orgId ? data.orgId : "platform-wide";
    const header = [
      `# QuizPulse usage report`,
      `# Scope: ${orgLabel}`,
      `# Window: last ${data.days} days (since ${since})`,
      `# Total events: ${total}`,
      `# Unique users: ${uniqueUsers}`,
      ``,
    ].join("\n");
    const csv =
      header +
      "## Daily activity\n" + toCsv(dailyRows) +
      "\n\n## Events by type\n" + toCsv(typeRows) + "\n";

    return { csv, filename: `usage-${orgLabel}-${data.days}d-${new Date().toISOString().slice(0,10)}.csv`, total, uniqueUsers };
  });

export const listOrgsForReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
