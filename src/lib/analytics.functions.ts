import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgInput = z.object({ orgId: z.string().uuid() });

export const getOrgOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

    const [members, banks, docs, challenges, points, recentSessions] = await Promise.all([
      supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("org_id", data.orgId),
      supabase.from("question_banks").select("id", { count: "exact", head: true }).eq("org_id", data.orgId),
      supabase.from("training_documents").select("id", { count: "exact", head: true }).eq("org_id", data.orgId),
      supabase.from("challenges").select("id", { count: "exact", head: true }).eq("org_id", data.orgId).gte("end_at", new Date().toISOString()),
      supabase.from("point_events").select("delta").eq("org_id", data.orgId).gte("created_at", since),
      supabase.from("sessions").select("id", { count: "exact", head: true }).eq("org_id", data.orgId).gte("created_at", since),
    ]);

    const totalPoints30d = (points.data ?? []).reduce((s: number, r: any) => s + (r.delta ?? 0), 0);

    return {
      memberCount: members.count ?? 0,
      bankCount: banks.count ?? 0,
      documentCount: docs.count ?? 0,
      activeChallengeCount: challenges.count ?? 0,
      totalPoints30d,
      sessionsRun30d: recentSessions.count ?? 0,
    };
  });

export const getPointsTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const { data: rows, error } = await context.supabase
      .from("point_events")
      .select("delta, created_at")
      .eq("org_id", data.orgId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const byDay = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getTime() + i * 24 * 3600_000);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows ?? []) {
      const day = (r.created_at as string).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + (r.delta as number));
    }
    return Array.from(byDay.entries()).map(([day, points]) => ({ day, points }));
  });

export const getTopPerformers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Aggregate point_events per user for this org
    const { data: rows, error } = await supabase
      .from("point_events")
      .select("user_id, delta")
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);

    const totals = new Map<string, number>();
    for (const r of rows ?? []) {
      totals.set(r.user_id as string, (totals.get(r.user_id as string) ?? 0) + (r.delta as number));
    }
    const top = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (top.length === 0) return [];

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", top.map(([uid]) => uid));
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));

    return top.map(([userId, points]) => ({
      userId,
      points,
      displayName: byId.get(userId)?.display_name ?? "Unknown",
      avatarUrl: byId.get(userId)?.avatar_url ?? null,
    }));
  });

export const getDepartmentBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: depts }, { data: members }, { data: events }] = await Promise.all([
      supabase.from("departments").select("id, name").eq("org_id", data.orgId),
      supabase.from("organization_members").select("user_id, department_id").eq("org_id", data.orgId),
      supabase.from("point_events").select("user_id, delta").eq("org_id", data.orgId),
    ]);

    const userDept = new Map<string, string | null>();
    for (const m of members ?? []) userDept.set(m.user_id as string, (m as any).department_id ?? null);

    const totals = new Map<string, number>();
    for (const e of events ?? []) {
      const dept = userDept.get(e.user_id as string) ?? "unassigned";
      totals.set(dept, (totals.get(dept) ?? 0) + (e.delta as number));
    }

    const result = (depts ?? []).map((d: any) => ({
      departmentId: d.id,
      name: d.name,
      points: totals.get(d.id) ?? 0,
    }));
    if (totals.has("unassigned")) {
      result.push({ departmentId: null as any, name: "Unassigned", points: totals.get("unassigned")! });
    }
    return result.sort((a, b) => b.points - a.points);
  });
