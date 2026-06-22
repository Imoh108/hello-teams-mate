import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listImportRuns } from "@/lib/trivia-import.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/imports")({
  head: () => ({ meta: [{ title: "Import history — QuizPulse Platform" }] }),
  component: ImportsPage,
});

type Run = {
  id: string;
  source: string;
  fetched: number;
  inserted: number;
  deduplicated: number;
  error_count: number;
  errors: string[];
  started_at: string;
  finished_at: string | null;
};

function fmtDuration(start: string, end: string | null) {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function ImportsPage() {
  const listFn = useServerFn(listImportRuns);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = (await listFn()) as { runs: Run[] };
      setRuns(r.runs);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Latest run per source
  const latestBySource = new Map<string, Run>();
  for (const r of runs) {
    if (!latestBySource.has(r.source)) latestBySource.set(r.source, r);
  }
  const last = runs[0];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Import history</h1>
          <p className="text-sm text-muted-foreground">
            Per-bank fetch, dedupe, and insert counts for global question imports.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      {loading && runs.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          No imports have run yet. Trigger one from <span className="font-medium">Content sources</span>.
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Last run per source</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[...latestBySource.values()].map((r) => (
                <div key={r.id} className="glass-panel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{r.source}</div>
                    {r.error_count > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" /> {r.error_count} error{r.error_count > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" /> clean
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Stat label="Fetched" value={r.fetched} />
                    <Stat label="Deduped" value={r.deduplicated} tone="muted" />
                    <Stat label="Inserted" value={r.inserted} tone="primary" />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between">
                    <span>{new Date(r.started_at).toLocaleString()}</span>
                    <span>{fmtDuration(r.started_at, r.finished_at)}</span>
                  </div>
                  {r.errors?.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">View errors</summary>
                      <ul className="mt-2 space-y-1 list-disc pl-4">
                        {r.errors.slice(0, 10).map((e, i) => (
                          <li key={i} className="break-words">{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
            {last && (
              <p className="text-xs text-muted-foreground">
                Most recent import finished {new Date(last.finished_at ?? last.started_at).toLocaleString()}.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-semibold">All runs ({runs.length})</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">When</th>
                    <th className="text-left px-3 py-2">Source</th>
                    <th className="text-right px-3 py-2">Fetched</th>
                    <th className="text-right px-3 py-2">Deduped</th>
                    <th className="text-right px-3 py-2">Inserted</th>
                    <th className="text-right px-3 py-2">Errors</th>
                    <th className="text-right px-3 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(r.started_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{r.source}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.fetched}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.deduplicated}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-primary">{r.inserted}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${r.error_count > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {r.error_count}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmtDuration(r.started_at, r.finished_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "primary" | "muted" }) {
  const color = tone === "primary" ? "text-primary" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="rounded-md bg-surface px-2 py-2">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
