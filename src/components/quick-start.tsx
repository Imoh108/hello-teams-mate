import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, Sparkles, Zap, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUICK_TEMPLATES, launchQuickTemplate, generateQuizFromTopic, getDailyChallenge, answerDaily } from "@/lib/engage.functions";
import { createSession } from "@/lib/quiz.functions";

export function QuickStart() {
  const navigate = useNavigate();
  const launchFn = useServerFn(launchQuickTemplate);
  const sessionFn = useServerFn(createSession);
  const topicFn = useServerFn(generateQuizFromTopic);
  const [busy, setBusy] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [diff, setDiff] = useState<"easy" | "medium" | "hard">("medium");

  const runTemplate = async (key: string) => {
    setBusy(key);
    try {
      const { quiz_id } = await launchFn({ data: { key } });
      const s: any = await sessionFn({ data: { quiz_id } });
      navigate({ to: "/host/$sessionId", params: { sessionId: s.id } });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  const runTopic = async () => {
    if (topic.trim().length < 2) return toast.error("Type a topic first");
    setBusy("topic");
    try {
      const r = await topicFn({ data: { topic: topic.trim(), count: Number(count), difficulty: diff } });
      toast.success(`Created ${r.count} questions`);
      navigate({ to: "/quizzes/$id", params: { id: r.quiz_id } });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="glass-panel rounded-xl p-5 lg:col-span-2">
        <div className="flex items-center gap-2"><Zap className="size-5 text-primary" /><h2 className="font-display text-xl font-semibold">Quick play</h2></div>
        <p className="text-sm text-muted-foreground">One click — builds a quiz and opens the lobby.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {QUICK_TEMPLATES.map((t) => (
            <button key={t.key} disabled={!!busy} onClick={() => runTemplate(t.key)}
              className="rounded-lg border border-border bg-surface-2 p-4 text-left transition hover:border-primary">
              <div className="font-semibold text-foreground">{t.title}</div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
              <div className="mt-2 text-xs text-primary">{busy === t.key ? "Launching…" : `${t.rounds * t.qpr} questions · ${t.difficulty}`}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center gap-2"><Wand2 className="size-4 text-primary" /><h3 className="font-semibold">Type any topic</h3></div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 90s sitcoms, cloud computing…" className="min-w-0 flex-1" maxLength={120} />
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{["5", "10", "15", "20"].map((n) => <SelectItem key={n} value={n}>{n} Qs</SelectItem>)}</SelectContent>
            </Select>
            <Select value={diff} onValueChange={(v) => setDiff(v as any)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{["easy", "medium", "hard"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={runTopic} disabled={!!busy}><Sparkles className="size-4 mr-1" />{busy === "topic" ? "Generating…" : "Generate"}</Button>
          </div>
        </div>
      </div>
      <DailyCard />
    </section>
  );
}

function DailyCard() {
  const getFn = useServerFn(getDailyChallenge);
  const answerFn = useServerFn(answerDaily);
  const [d, setD] = useState<any>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { getFn().then(setD).catch(() => {}); }, []);

  const pick = async (i: number) => {
    setPicked(i);
    try {
      const r = await answerFn({ data: { index: i } });
      setResult(r);
      toast[r.correct ? "success" : "error"](r.correct ? "Correct!" : "Not quite");
    } catch (e: any) { toast.error(e.message); }
  };

  const streak = result ? result.current : d?.streak.current ?? 0;
  const best = result ? result.best : d?.streak.best ?? 0;
  const correctIdx = result?.correct_index ?? d?.question?.correct_index;
  const done = !!result || d?.streak.playedToday;

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Flame className="size-5 text-primary" /><h2 className="font-display text-xl font-semibold">Daily question</h2></div>
        <div className="text-right text-sm"><div className="font-bold text-primary">{streak} day streak</div><div className="text-xs text-muted-foreground">Best {best}</div></div>
      </div>
      {!d ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : !d.question ? <p className="mt-4 text-sm text-muted-foreground">No question today.</p> : (
        <>
          <p className="mt-4 font-medium text-foreground">{d.question.prompt}</p>
          <div className="mt-3 grid gap-2">
            {d.question.choices.map((c: string, i: number) => {
              const state = done && correctIdx === i ? "border-correct bg-correct/15" : done && picked === i ? "border-incorrect bg-incorrect/15" : "border-border bg-surface-2";
              return (
                <button key={i} disabled={done} onClick={() => pick(i)}
                  className={`rounded-md border px-3 py-2 text-left text-sm text-foreground transition hover:border-primary ${state}`}>{c}</button>
              );
            })}
          </div>
          {done && <p className="mt-3 text-xs text-muted-foreground">Come back tomorrow to keep your streak going.</p>}
        </>
      )}
    </div>
  );
}
