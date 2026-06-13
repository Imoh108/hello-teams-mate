import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSystemHealth, getRecentErrors } from "@/lib/platform-health.functions";
import { Activity, AlertTriangle, Clock, Workflow } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/health")({
  component: HealthPage,
});

type Health = Awaited<ReturnType<typeof getSystemHealth>>;
type Errors = Awaited<ReturnType<typeof getRecentErrors>>;

function HealthPage() {
  const [h, setH] = useState<Health | null>(null);
  const [errs, setErrs] = useState<Errors>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [a, b] = await Promise.all([getSystemHealth(), getRecentErrors()]);
        setH(a); setErrs(b);
      } catch (e: any) { setErr(e?.message ?? "Failed to load"); }
    })();
  }, []);

  if (err) return <div className="text-destructive">{err}</div>;
  if (!h) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">System health</h1>
        <p className="text-sm text-muted-foreground">
          Live latency, error rates, and AI generation queue.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Clock} label="p50 latency" value={`${h.latencyP50} ms`} sub={`${h.latencySamples} samples / 24h`} />
        <Stat icon={Activity} label="p95 latency" value={`${h.latencyP95} ms`} />
        <Stat
          icon={AlertTriangle}
          label="Errors (1h / 24h)"
          value={`${h.errors1h} / ${h.errors24h}`}
          tone={h.errors1h > 0 ? "destructive" : "default"}
        />
        <Stat icon={Workflow} label="AI jobs in queue" value={(h.aiQueue.pending ?? 0) + (h.aiQueue.generating ?? 0) + (h.aiQueue.review ?? 0)} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">AI generation pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(h.aiQueue).map(([status, count]) => (
              <Badge key={status} variant={status === "failed" ? "destructive" : "secondary"}>
                {status}: {count}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            The pipeline itself ships in phase 4. This shows the queue state of the
            <code className="mx-1">ai_generation_jobs</code> table.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent errors</CardTitle>
        </CardHeader>
        <CardContent>
          {errs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No errors captured yet. Wrap server functions with{" "}
              <code>instrument()</code> from <code>@/lib/instrument.server</code>{" "}
              to start recording failures.
            </p>
          ) : (
            <ul className="space-y-1 text-sm divide-y divide-border">
              {errs.map((e, i) => (
                <li key={i} className="py-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-mono-tab text-xs">{e.op}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{e.message}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, sub, tone,
}: { icon: any; label: string; value: number | string; sub?: string; tone?: "default" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </div>
        <div className={`mt-1 text-2xl font-display font-semibold ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
