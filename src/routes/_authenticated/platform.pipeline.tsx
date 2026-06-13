import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Sparkles, RefreshCw } from "lucide-react";
import {
  generatePlatformQuestions,
  listPendingItems,
  listRecentJobs,
  reviewItem,
} from "@/lib/ai-pipeline.functions";

export const Route = createFileRoute("/_authenticated/platform/pipeline")({
  component: PipelinePage,
});

type Item = Awaited<ReturnType<typeof listPendingItems>>[number];
type Job = Awaited<ReturnType<typeof listRecentJobs>>[number];

function PipelinePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("manual");
  const [count, setCount] = useState(5);
  const [ctx, setCtx] = useState("");

  async function refresh() {
    try {
      const [i, j] = await Promise.all([listPendingItems(), listRecentJobs()]);
      setItems(i as Item[]);
      setJobs(j as Job[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    }
  }
  useEffect(() => { refresh(); }, []);

  async function onGenerate() {
    if (!topic.trim()) return toast.error("Add a topic");
    setLoading(true);
    try {
      const r = await generatePlatformQuestions({
        data: { topic, source, count, difficulty: 2, context: ctx || undefined },
      });
      toast.success(`Generated ${r.generated} questions`);
      setCtx("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, decision: "approved" | "rejected") {
    try {
      await reviewItem({ data: { itemId: id, decision } });
      setItems((s) => s.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e?.message ?? "Review failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">AI question pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Generate platform-curated questions and review them before they go live.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" /> New generation job
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. GDPR basics" />
            </div>
            <div>
              <Label>Source label</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="manual / wikipedia / …" />
            </div>
            <div>
              <Label>Count</Label>
              <Input type="number" min={1} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Reference material (optional)</Label>
            <Textarea rows={4} value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Paste reference text the AI should ground questions in." />
          </div>
          <Button onClick={onGenerate} disabled={loading}>
            {loading ? "Generating…" : "Generate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Review queue ({items.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="size-4" /></Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Queue is empty.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => {
                const choices = (it.choices as any) as string[];
                return (
                  <li key={it.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-1 flex gap-2">
                          <Badge variant="secondary">{it.topic}</Badge>
                          <Badge variant="outline">{it.source}</Badge>
                          <span>difficulty {it.difficulty}</span>
                        </div>
                        <div className="font-medium">{it.prompt}</div>
                        <ol className="mt-2 text-sm space-y-1 list-decimal list-inside">
                          {choices.map((c, i) => (
                            <li key={i} className={i === it.correct_index ? "text-primary font-medium" : ""}>{c}</li>
                          ))}
                        </ol>
                        {it.explanation && (
                          <p className="text-xs text-muted-foreground mt-2">{it.explanation}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => decide(it.id, "approved")}>
                          <Check className="size-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decide(it.id, "rejected")}>
                          <X className="size-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent jobs</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <ul className="space-y-1 text-sm divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id} className="py-2 flex justify-between gap-3">
                  <div>
                    <div className="font-medium">{j.topic ?? "(no topic)"}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.source} · gen {j.generated_count} · ok {j.approved_count} · rej {j.rejected_count}
                    </div>
                    {j.error_message && <div className="text-xs text-destructive mt-1">{j.error_message}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={j.status === "failed" ? "destructive" : "secondary"}>{j.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
