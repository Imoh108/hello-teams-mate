import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getPlatformOverview,
  getActivityTimeline,
  getTopEvents,
  getOrgTierBreakdown,
} from "@/lib/platform.functions";
import { listImportRuns } from "@/lib/trivia-import.functions";
import {
  Users,
  Building2,
  Activity,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/")({
  component: PlatformOverview,
});

type Overview = Awaited<ReturnType<typeof getPlatformOverview>>;
type Timeline = Awaited<ReturnType<typeof getActivityTimeline>>;
type TopEvents = Awaited<ReturnType<typeof getTopEvents>>;
type Tiers = Awaited<ReturnType<typeof getOrgTierBreakdown>>;

type ImportRun = {
  id: string;
  source: string;
  fetched: number;
  inserted: number;
  deduplicated: number;
  error_count: number;
  started_at: string;
  finished_at: string | null;
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlatformOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<Timeline>([]);
  const [events, setEvents] = useState<TopEvents>([]);
  const [tiers, setTiers] = useState<Tiers | null>(null);
  const [importRuns, setImportRuns] = useState<ImportRun[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const listRunsFn = useServerFn(listImportRuns);

  useEffect(() => {
    (async () => {
      try {
        const [o, t, e, b, r] = await Promise.all([
          getPlatformOverview(),
          getActivityTimeline(),
          getTopEvents(),
          getOrgTierBreakdown(),
          listRunsFn().catch(() => ({ runs: [] as ImportRun[] })),
        ]);
        setOverview(o);
        setTimeline(t);
        setEvents(e);
        setTiers(b);
        setImportRuns(((r as any)?.runs ?? []).slice(0, 5));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <div className="text-destructive">{err}</div>;
  if (!overview) return <div className="text-muted-foreground">Loading…</div>;

  const maxUsers = Math.max(1, ...timeline.map((d) => d.users));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate activity across every organization on QuizPulse.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Total users" value={overview.totalUsers} />
        <Stat icon={Building2} label="Organizations" value={overview.totalOrgs} sub={`${overview.corporateOrgs} on paid tiers`} />
        <Stat icon={Activity} label="Sessions (30d)" value={overview.sessionsRun30d} />
        <Stat icon={Calendar} label="DAU / WAU / MAU" value={`${overview.dau} / ${overview.wau} / ${overview.mau}`} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4" /> Daily active users (last 30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.every((d) => d.users === 0) ? (
            <p className="text-sm text-muted-foreground">
              No tracked events yet. Once <code>track()</code> calls fire from the
              app, this chart will populate.
            </p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {timeline.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.users} users`}
                  className="flex-1 bg-primary/70 rounded-sm min-h-[2px]"
                  style={{ height: `${(d.users / maxUsers) * 100}%` }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top events (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {events.map((e) => (
                  <li key={e.event} className="flex justify-between border-b border-border py-1">
                    <span className="font-mono-tab">{e.event}</span>
                    <span className="text-muted-foreground">{e.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Organizations by tier</CardTitle>
          </CardHeader>
          <CardContent>
            {tiers ? (
              <ul className="space-y-1 text-sm">
                {Object.entries(tiers).map(([tier, count]) => (
                  <li key={tier} className="flex justify-between border-b border-border py-1">
                    <span className="capitalize">{tier}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="size-4" /> Recent imports
          </CardTitle>
          <Link
            to="/platform/imports"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {importRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No imports yet. Trigger one from Content sources.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {importRuns.map((r) => {
                const hasErrors = r.error_count > 0;
                const lowYield =
                  r.fetched >= 20 && r.inserted < r.fetched * 0.5;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 py-2 text-sm"
                  >
                    <span className="font-medium min-w-[140px]">{r.source}</span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(r.started_at)}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      fetched <b className="text-foreground">{r.fetched}</b> ·
                      dedup <b className="text-foreground">{r.deduplicated}</b> ·
                      inserted{" "}
                      <b className={lowYield ? "text-amber-600" : "text-primary"}>
                        {r.inserted}
                      </b>
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      {hasErrors && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="size-3" />
                          {r.error_count} error{r.error_count > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {lowYield && (
                        <Badge className="gap-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">
                          <AlertTriangle className="size-3" /> low yield
                        </Badge>
                      )}
                      {!hasErrors && !lowYield && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="size-3" /> clean
                        </Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, sub,
}: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </div>
        <div className="mt-1 text-2xl font-display font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
