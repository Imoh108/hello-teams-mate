import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { saveQuestion, deleteQuestion, createSession } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Play, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quizzes/$id")({
  head: () => ({ meta: [{ title: "Edit quiz — QuizPulse" }] }),
  component: QuizEditor,
});

type Question = {
  id?: string; quiz_id: string; position: number; prompt: string;
  options: string[]; correct_index: number; time_limit_s: number; round: number;
};

function QuizEditor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const saveFn = useServerFn(saveQuestion);
  const delFn = useServerFn(deleteQuestion);
  const sessionFn = useServerFn(createSession);

  const [quiz, setQuiz] = useState<{ title: string; description: string | null } | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [draft, setDraft] = useState<Question | null>(null);

  const load = async () => {
    const { data: q } = await supabase.from("quizzes").select("title,description").eq("id", id).single();
    setQuiz(q ?? null);
    const { data: rows } = await supabase.from("questions").select("*").eq("quiz_id", id).order("position");
    setQs((rows ?? []).map((r) => ({ ...r, options: r.options as string[] })) as Question[]);
  };
  useEffect(() => { load(); }, [id]);

  const newDraft = () => setDraft({
    quiz_id: id, position: qs.length + 1, prompt: "", options: ["", "", "", ""], correct_index: 0, time_limit_s: 20,
  });

  const onSave = async () => {
    if (!draft) return;
    if (!draft.prompt.trim()) return toast.error("Prompt required");
    if (draft.options.some((o) => !o.trim())) return toast.error("All 4 options required");
    try {
      await saveFn({ data: { ...draft, prompt: draft.prompt.trim(), options: draft.options.map((o) => o.trim()) } });
      setDraft(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const onDelete = async (qid: string) => {
    if (!confirm("Delete this question?")) return;
    try { await delFn({ data: { id: qid } }); load(); } catch (e: any) { toast.error(e.message); }
  };

  const onLaunch = async () => {
    try {
      const row = await sessionFn({ data: { quiz_id: id } });
      navigate({ to: "/host/$sessionId", params: { sessionId: (row as any).id } });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <Button onClick={onLaunch} disabled={qs.length === 0}><Play className="size-4 mr-1" /> Launch session</Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-3xl">
        {quiz && (
          <div className="mb-6">
            <h1 className="font-display text-3xl font-bold tracking-tight">{quiz.title}</h1>
            {quiz.description && <p className="text-muted-foreground mt-1">{quiz.description}</p>}
          </div>
        )}

        <div className="space-y-3">
          {qs.map((q, i) => (
            <div key={q.id} className="glass-panel rounded-xl p-5">
              <div className="flex items-start gap-4">
                <div className="font-mono-tab text-2xl text-primary">{i + 1}</div>
                <div className="flex-1">
                  <div className="font-display font-semibold">{q.prompt}</div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {q.options.map((o, oi) => (
                      <div key={oi} className={`text-sm rounded-md border px-3 py-2 ${oi === q.correct_index ? "border-correct/40 bg-correct/10" : "border-border"}`}>
                        {oi === q.correct_index && <Check className="inline size-3 mr-1 text-correct" />}{o}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{q.time_limit_s}s</div>
                </div>
                <Button onClick={() => onDelete(q.id!)} variant="ghost" size="icon"><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>

        {draft ? (
          <div className="glass-panel rounded-xl p-5 mt-4 space-y-3">
            <div><Label>Prompt</Label><Textarea value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} maxLength={500} /></div>
            <div className="grid grid-cols-2 gap-2">
              {draft.options.map((o, i) => (
                <div key={i}>
                  <Label className="text-xs">Option {i + 1} {draft.correct_index === i && <span className="text-correct">· correct</span>}</Label>
                  <div className="flex gap-2">
                    <Input value={o} onChange={(e) => { const n = [...draft.options]; n[i] = e.target.value; setDraft({ ...draft, options: n }); }} maxLength={200} />
                    <Button type="button" size="icon" variant={draft.correct_index === i ? "default" : "outline"} onClick={() => setDraft({ ...draft, correct_index: i })}><Check className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label>Time limit: {draft.time_limit_s}s</Label>
              <input type="range" min={5} max={60} value={draft.time_limit_s} onChange={(e) => setDraft({ ...draft, time_limit_s: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button onClick={onSave}>Save question</Button>
            </div>
          </div>
        ) : (
          <Button onClick={newDraft} variant="outline" className="mt-4 w-full"><Plus className="size-4 mr-1" /> Add question</Button>
        )}
      </main>
    </div>
  );
}
