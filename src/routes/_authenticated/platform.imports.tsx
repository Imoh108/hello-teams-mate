import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  listImportRuns,
  importFromOpenTriviaDb,
  importFromTheTriviaApi,
  retryFailedFromRun,
  createExportLink,
} from "@/lib/trivia-import.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CalendarIcon,
  Download,
  RotateCw,
  ChevronDown,
  ChevronRight,
  X,
  Link2,
} from "lucide-react";

const KNOWN_BANKS = ["Open Trivia DB", "The Trivia API"] as const;
type Status = "all" | "clean" | "errors" | "partial";

const searchSchema = z.object({
  bank: fallback(z.array(z.string()), []).default([]),
  from: fallback(z.string().optional(), undefined),
  to: fallback(z.string().optional(), undefined),
  status: fallback(z.enum(["all", "clean", "errors", "partial"]), "all").default("all"),
});

export const Route = createFileRoute("/_authenticated/platform/imports")({
  head: () => ({ meta: [{ title: "Import history — QuizPulse Platform" }] }),
  validateSearch: zodValidator(searchSchema),
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

function runStatus(r: Run): Exclude<Status, "all"> {
  if (r.error_count === 0 && r.inserted + r.deduplicated >= r.fetched) return "clean";
  if (r.error_count > 0 && r.inserted < r.fetched) return "partial";
  return "errors";
}

function groupErrors(errors: string[]) {
  const groups = new Map<string, string[]>();
  for (const e of errors ?? []) {
    const m = e.match(/^([^:]+):\s*(.*)$/);
    const key = m ? m[1].trim() : "Other";
    const msg = m ? m[2].trim() : e;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(msg);
  }
  return [...groups.entries()].map(([key, msgs]) => ({ key, msgs }));
}

function ImportsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const listFn = useServerFn(listImportRuns);
  const otdbFn = useServerFn(importFromOpenTriviaDb);
  const ttaFn = useServerFn(importFromTheTriviaApi);
  const retryScopedFn = useServerFn(retryFailedFromRun);
  const shareFn = useServerFn(createExportLink);

  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [retrying, setRetrying] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);

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

  const fromDate = search.from ? new Date(search.from) : undefined;
  const toDate = search.to ? new Date(search.to) : undefined;

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (search.bank.length > 0 && !search.bank.includes(r.source)) return false;
      const started = new Date(r.started_at).getTime();
      if (fromDate && started < fromDate.getTime()) return false;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (started > end.getTime()) return false;
      }
      if (search.status !== "all" && runStatus(r) !== search.status) return false;
      return true;
    });
  }, [runs, search.bank, search.from, search.to, search.status, fromDate, toDate]);

  const latestBySource = new Map<string, Run>();
  for (const r of filtered) if (!latestBySource.has(r.source)) latestBySource.set(r.source, r);
  const lastOverall = filtered[0];

  const setSearch = (patch: Record<string, unknown>) =>
    navigate({ search: ((prev: Record<string, unknown>) => ({ ...prev, ...patch })) as any });

  const toggleBank = (b: string) => {
    const next = search.bank.includes(b)
      ? search.bank.filter((x: string) => x !== b)
      : [...search.bank, b];
    setSearch({ bank: next });
  };

  const clearFilters = () =>
    navigate({ search: () => ({ bank: [], status: "all" as const }) as any });

  const hasFilters =
    search.bank.length > 0 || !!search.from || !!search.to || search.status !== "all";

  const historyFilename = () => `import-history-${new Date().toISOString().slice(0, 10)}.csv`;
  const lastRunFilename = () =>
    lastOverall
      ? `import-last-run-${new Date(lastOverall.started_at).toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`
      : "import-last-run.csv";

  const exportHistory = () => downloadCsv(historyFilename(), buildHistoryCsv());
  const exportLastRun = () => {
    if (!lastOverall) return toast.error("No runs to export");
    downloadCsv(lastRunFilename(), buildLastRunCsv());
  };

  const retry = async (r: Run) => {
    setRetrying(r.id);
    try {
      const scoped: any = await retryScopedFn({ data: { runId: r.id, maxPerCategory: 200 } });
      if (scoped?.scoped) {
        const cats =
          (scoped.categories?.otdb?.length ?? 0) + (scoped.categories?.tta?.length ?? 0);
        toast.success(
          `Retried ${cats} failed categor${cats === 1 ? "y" : "ies"}: ${scoped.imported} new, ${scoped.skipped} deduped${
            scoped.errors?.length ? `, ${scoped.errors.length} errors` : ""
          }`,
        );
      } else {
        const fn =
          r.source === "Open Trivia DB"
            ? otdbFn
            : r.source === "The Trivia API"
              ? ttaFn
              : null;
        if (!fn) {
          toast.error(`No retry handler for ${r.source}`);
          return;
        }
        toast.info("No scoped failures found — retrying full bank");
        const full: any = await fn({ data: { maxPerCategory: 200 } });
        toast.success(
          `Retried ${r.source}: ${full.imported} new, ${full.skipped} deduped${full.errors?.length ? `, ${full.errors.length} errors` : ""}`,
        );
      }
      await load();
    } catch (e: any) {
      toast.error(`Retry failed: ${e?.message ?? "unknown"}`);
    } finally {
      setRetrying(null);
    }
  };

  const share = async (key: string, filename: string, csv: string) => {
    setSharing(key);
    try {
      const res: any = await shareFn({ data: { filename, csv } });
      await navigator.clipboard.writeText(res.url);
      toast.success(`Link copied (valid ${res.expiresInDays} days)`);
    } catch (e: any) {
      toast.error(`Share failed: ${e?.message ?? "unknown"}`);
    } finally {
      setSharing(null);
    }
  };

  const buildHistoryCsv = () => {
    const rows = filtered.map((r) => ({
      started_at: r.started_at,
      finished_at: r.finished_at ?? "",
      duration_ms: r.finished_at
        ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
        : "",
      source: r.source,
      fetched: r.fetched,
      deduplicated: r.deduplicated,
      inserted: r.inserted,
      error_count: r.error_count,
      status: runStatus(r),
    }));
    return toCsv(rows, [
      "started_at",
      "finished_at",
      "duration_ms",
      "source",
      "fetched",
      "deduplicated",
      "inserted",
      "error_count",
      "status",
    ]);
  };

  const buildLastRunCsv = () => {
    if (!lastOverall) return "";
    const summary = [
      {
        kind: "summary",
        source: lastOverall.source,
        started_at: lastOverall.started_at,
        finished_at: lastOverall.finished_at ?? "",
        fetched: lastOverall.fetched,
        deduplicated: lastOverall.deduplicated,
        inserted: lastOverall.inserted,
        error_count: lastOverall.error_count,
        error_group: "",
        error_message: "",
      },
    ];
    const errs = (lastOverall.errors ?? []).map((e) => {
      const m = e.match(/^([^:]+):\s*(.*)$/);
      return {
        kind: "error",
        source: lastOverall.source,
        started_at: lastOverall.started_at,
        finished_at: "",
        fetched: "",
        deduplicated: "",
        inserted: "",
        error_count: "",
        error_group: m ? m[1] : "Other",
        error_message: m ? m[2] : e,
      };
    });
    return toCsv([...summary, ...errs] as any, [
      "kind",
      "source",
      "started_at",
      "finished_at",
      "fetched",
      "deduplicated",
      "inserted",
      "error_count",
      "error_group",
      "error_message",
    ]);
  };

  const canRetry = (r: Run) => runStatus(r) !== "clean";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Import history</h1>
          <p className="text-sm text-muted-foreground">
            Per-bank fetch, dedupe, and insert counts for global question imports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportLastRun} disabled={!lastOverall}>
            <Download className="size-4 mr-1" /> Export last run
          </Button>
          <Button variant="outline" size="sm" onClick={exportHistory} disabled={filtered.length === 0}>
            <Download className="size-4 mr-1" /> Export history
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section className="glass-panel rounded-xl p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Bank:</span>
          {KNOWN_BANKS.map((b) => (
            <Button
              key={b}
              size="sm"
              variant={search.bank.includes(b) ? "default" : "outline"}
              onClick={() => toggleBank(b)}
            >
              {b}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">From:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(!fromDate && "text-muted-foreground")}>
                <CalendarIcon className="size-4 mr-1" />
                {fromDate ? format(fromDate, "PP") : "Any"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(d) => setSearch({ from: d ? d.toISOString().slice(0, 10) : undefined })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground ml-2 mr-1">To:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(!toDate && "text-muted-foreground")}>
                <CalendarIcon className="size-4 mr-1" />
                {toDate ? format(toDate, "PP") : "Any"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(d) => setSearch({ to: d ? d.toISOString().slice(0, 10) : undefined })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Status:</span>
          <Select value={search.status} onValueChange={(v) => setSearch({ status: v as Status })}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="errors">Errors</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="size-4 mr-1" /> Clear
          </Button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {runs.length} runs
        </div>
      </section>

      {loading && runs.length === 0 ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
          {runs.length === 0
            ? "No imports have run yet. Trigger one from Content sources."
            : "No runs match your filters."}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Last run per source</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[...latestBySource.values()].map((r) => {
                const status = runStatus(r);
                const grouped = groupErrors(r.errors ?? []);
                return (
                  <div key={r.id} className="glass-panel rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{r.source}</div>
                      <div className="flex items-center gap-2">
                        {status === "clean" ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="size-3" /> clean
                          </Badge>
                        ) : status === "partial" ? (
                          <Badge className="gap-1 bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">
                            <AlertTriangle className="size-3" /> partial
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="size-3" /> {r.error_count} error
                            {r.error_count > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {canRetry(r) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retry(r.source)}
                            disabled={retrying === r.source}
                          >
                            <RotateCw
                              className={`size-3 mr-1 ${retrying === r.source ? "animate-spin" : ""}`}
                            />
                            Retry
                          </Button>
                        )}
                      </div>
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
                    {grouped.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View errors by category ({grouped.length})
                        </summary>
                        <div className="mt-2 space-y-2">
                          {grouped.map((g) => (
                            <div key={g.key} className="rounded-md bg-surface p-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{g.key}</span>
                                <Badge variant="outline">{g.msgs.length}</Badge>
                              </div>
                              <ul className="mt-1 space-y-0.5 list-disc pl-4 text-muted-foreground">
                                {g.msgs.slice(0, 5).map((m, i) => (
                                  <li key={i} className="break-words">{m}</li>
                                ))}
                                {g.msgs.length > 5 && (
                                  <li className="italic">…{g.msgs.length - 5} more</li>
                                )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {lastOverall && (
              <p className="text-xs text-muted-foreground">
                Most recent import finished{" "}
                {new Date(lastOverall.finished_at ?? lastOverall.started_at).toLocaleString()}.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-lg font-semibold">All runs ({filtered.length})</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="w-6"></th>
                    <th className="text-left px-3 py-2">When</th>
                    <th className="text-left px-3 py-2">Source</th>
                    <th className="text-right px-3 py-2">Fetched</th>
                    <th className="text-right px-3 py-2">Deduped</th>
                    <th className="text-right px-3 py-2">Inserted</th>
                    <th className="text-right px-3 py-2">Errors</th>
                    <th className="text-right px-3 py-2">Duration</th>
                    <th className="text-right px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const status = runStatus(r);
                    const isOpen = !!expanded[r.id];
                    const grouped = groupErrors(r.errors ?? []);
                    return (
                      <>
                        <tr key={r.id}>
                          <td className="px-2">
                            {grouped.length > 0 && (
                              <button
                                onClick={() =>
                                  setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))
                                }
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={isOpen ? "Collapse errors" : "Expand errors"}
                              >
                                {isOpen ? (
                                  <ChevronDown className="size-4" />
                                ) : (
                                  <ChevronRight className="size-4" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(r.started_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">{r.source}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.fetched}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {r.deduplicated}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-primary">
                            {r.inserted}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums ${r.error_count > 0 ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {r.error_count}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {fmtDuration(r.started_at, r.finished_at)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {status === "clean" ? (
                              <Badge variant="secondary">clean</Badge>
                            ) : status === "partial" ? (
                              <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">
                                partial
                              </Badge>
                            ) : (
                              <Badge variant="destructive">errors</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {canRetry(r) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => retry(r.source)}
                                disabled={retrying === r.source}
                              >
                                <RotateCw
                                  className={`size-3 mr-1 ${retrying === r.source ? "animate-spin" : ""}`}
                                />
                                Retry
                              </Button>
                            )}
                          </td>
                        </tr>
                        {isOpen && grouped.length > 0 && (
                          <tr key={r.id + "-err"} className="bg-surface/40">
                            <td></td>
                            <td colSpan={9} className="px-3 py-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                {grouped.map((g) => (
                                  <div key={g.key} className="rounded-md bg-background p-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">{g.key}</span>
                                      <Badge variant="outline">{g.msgs.length}</Badge>
                                    </div>
                                    <ul className="mt-1 space-y-0.5 list-disc pl-4 text-muted-foreground">
                                      {g.msgs.slice(0, 5).map((m, i) => (
                                        <li key={i} className="break-words">{m}</li>
                                      ))}
                                      {g.msgs.length > 5 && (
                                        <li className="italic">…{g.msgs.length - 5} more</li>
                                      )}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
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
  const color =
    tone === "primary"
      ? "text-primary"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="rounded-md bg-surface px-2 py-2">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
