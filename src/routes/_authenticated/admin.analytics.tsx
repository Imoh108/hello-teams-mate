import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import {
  getOrgOverview,
  getPointsTimeline,
  getTopPerformers,
  getDepartmentBreakdown,
} from "@/lib/analytics.functions";
import { BarChart3, Users, Library, FileText, Flame, Trophy, Activity } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";

import { TierGate } from "@/components/tier-gate";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: () => <TierGate min="premium"><AnalyticsPage /></TierGate>,
});

type Overview = Awaited<ReturnType<typeof getOrgOverview>>;
type Timeline = Awaited<ReturnType<typeof getPointsTimeline>>;
type Top = Awaited<ReturnType<typeof getTopPerformers>>;
type Depts = Awaited<ReturnType<typeof getDepartmentBreakdown>>;

function AnalyticsPage() {
  const [orgId] = useCurrentOrgId();
  const overviewFn = useServerFn(getOrgOverview);
  const timelineFn = useServerFn(getPointsTimeline);
  const topFn = useServerFn(getTopPerformers);
  const deptFn = useServerFn(getDepartmentBreakdown);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<Timeline>([]);
  const [top, setTop] = useState<Top>([]);
  const [depts, setDepts] = useState<Depts>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([
      overviewFn({ data: { orgId } }),
      timelineFn({ data: { orgId } }),
      topFn({ data: { orgId } }),
      deptFn({ data: { orgId } }),
    ])
      .then(([o, t, p, d]) => { setOverview(o); setTimeline(t); setTop(p); setDepts(d); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (loading || !overview) return <div className="text-muted-foreground">Loading analytics…</div>;

  const stats = [
    { label: "Members", value: overview.memberCount, icon: Users },
    { label: "Question banks", value: overview.bankCount, icon: Library },
    { label: "Documents", value: overview.documentCount, icon: FileText },
    { label: "Active challenges", value: overview.activeChallengeCount, icon: Flame },
    { label: "Points (30d)", value: overview.totalPoints30d.toLocaleString(), icon: Trophy },
    { label: "Sessions (30d)", value: overview.sessionsRun30d, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="size-6" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Engagement and learning metrics across your organization.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <div className="size-10 rounded-md bg-surface-2 grid place-items-center">
              <s.icon className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="font-display text-xl font-bold">{s.value}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="glass-panel rounded-xl p-4">
        <h2 className="font-semibold mb-3">Points awarded — last 30 days</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="pts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="points" stroke="hsl(var(--primary))" fill="url(#pts)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="glass-panel rounded-xl p-4">
          <h2 className="font-semibold mb-3">Top performers</h2>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No points awarded yet.</p>
          ) : (
            <ol className="space-y-2">
              {top.map((p, i) => (
                <li key={p.userId} className="flex items-center gap-3 text-sm">
                  <span className="font-mono-tab w-5 text-muted-foreground">{i + 1}</span>
                  <div className="size-7 rounded-full bg-surface-2 grid place-items-center text-xs">
                    {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="size-7 rounded-full" /> : p.displayName[0]?.toUpperCase()}
                  </div>
                  <span className="flex-1 truncate">{p.displayName}</span>
                  <span className="font-mono-tab font-semibold">{p.points.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="glass-panel rounded-xl p-4">
          <h2 className="font-semibold mb-3">Points by department</h2>
          {depts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No departments yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={depts}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
