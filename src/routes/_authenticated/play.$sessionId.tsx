import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { submitAnswer } from "@/lib/quiz.functions";
import { permutationFor } from "@/lib/scoring";
import { track } from "@/lib/track";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/play/$sessionId")({
  head: () => ({ meta: [{ title: "Play — QuizPulse" }] }),
  component: PlayScreen,
});

type Session = { id: string; status: string; current_question_id: string | null; question_started_at: string | null; time_limit_override_s: number | null; join_code: string };
type Question = { id: string; prompt: string; options: string[]; correct_index: number; time_limit_s: number };

function PlayScreen() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitAnswer);

  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ points: number; isCorrect: boolean } | null>(null);
  const blurredRef = useRef(false);

  useEffect(() => { (async () => { const { data } = await supabase.auth.getUser(); setUserId(data.user?.id ?? null); })(); }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      setSession(s as any);
    })();
    const ch = supabase.channel(`play-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (p) => setSession(p.new as any))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  useEffect(() => {
    if (!session?.current_question_id) { setQuestion(null); return; }
    (async () => {
      const { data } = await supabase.from("questions").select("*").eq("id", session.current_question_id!).single();
      if (data) setQuestion({ ...(data as any), options: (data as any).options as string[] });
      setSelected(null); setResult(null); blurredRef.current = false;
    })();
  }, [session?.current_question_id]);

  useEffect(() => { if (session?.status === "ended") navigate({ to: "/results/$sessionId", params: { sessionId } }); }, [session?.status, sessionId, navigate]);

  // Anti-cheat: auto-submit (null) on blur if active and unanswered.
  useEffect(() => {
    const onBlur = async () => {
      if (blurredRef.current) return;
      if (!question || !session || session.status !== "active") return;
      if (submittedFor === question.id) return;
      blurredRef.current = true;
      try {
        await submitFn({ data: { session_id: sessionId, question_id: question.id, selected_index: null, flagged: true } });
        setSubmittedFor(question.id);
        toast.error("Tab switch detected — answer locked");
      } catch {}
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", () => { if (document.hidden) onBlur(); });
    return () => { window.removeEventListener("blur", onBlur); };
  }, [question, session, submittedFor, sessionId, submitFn]);

  // Per-player shuffle
  const permutation = useMemo(() => {
    if (!question || !userId) return [0, 1, 2, 3];
    return permutationFor(`${userId}:${question.id}`, 4);
  }, [question, userId]);

  const limit = session?.time_limit_override_s ?? question?.time_limit_s ?? 20;
  const elapsed = session?.question_started_at ? Math.max(0, (now - new Date(session.question_started_at).getTime()) / 1000) : 0;
  const remaining = Math.max(0, limit - elapsed);
  const progress = Math.min(100, (elapsed / limit) * 100);

  // Auto-submit when time is up
  useEffect(() => {
    if (!question || !session || session.status !== "active") return;
    if (submittedFor === question.id) return;
    if (remaining <= 0) {
      (async () => {
        try {
          await submitFn({ data: { session_id: sessionId, question_id: question.id, selected_index: selected } });
          setSubmittedFor(question.id);
        } catch {}
      })();
    }
  }, [remaining, question, session, submittedFor, selected, sessionId, submitFn]);

  const onPick = async (originalIdx: number) => {
    if (!question || submittedFor === question.id || !session || session.status !== "active") return;
    setSelected(originalIdx);
    try {
      const r: any = await submitFn({ data: { session_id: sessionId, question_id: question.id, selected_index: originalIdx } });
      setSubmittedFor(question.id);
      setResult({ points: r.points, isCorrect: r.isCorrect });
    } catch (e: any) { toast.error(e.message); }
  };

  if (!session) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  if (!question) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="glass-panel rounded-2xl p-10 text-center max-w-sm">
          <div className="text-xs text-muted-foreground tracking-widest">JOINED · {session.join_code}</div>
          <h1 className="font-display text-3xl font-bold mt-3">You're in.</h1>
          <p className="text-muted-foreground mt-2">Waiting for the host to start the round. Stay on this tab — leaving will flag your answer.</p>
          <div className="live-dot mx-auto mt-6" />
        </div>
      </div>
    );
  }

  const isReveal = session.status === "reveal";
  const locked = submittedFor === question.id || isReveal;

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 max-w-2xl mx-auto w-full">
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${100 - progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
        <span>{session.join_code}</span>
        <span className="font-mono-tab text-foreground text-lg">{remaining.toFixed(1)}s</span>
      </div>

      <h1 className="font-display text-2xl sm:text-3xl font-bold mt-8">{question.prompt}</h1>

      <div className="grid gap-3 mt-6">
        {permutation.map((origIdx, displayIdx) => {
          const isPicked = selected === origIdx;
          const isCorrect = isReveal && origIdx === question.correct_index;
          const isWrongPick = isReveal && isPicked && origIdx !== question.correct_index;
          return (
            <button key={origIdx} disabled={locked} onClick={() => onPick(origIdx)}
              className={`text-left rounded-xl border p-4 transition ${
                isCorrect ? "border-correct/60 bg-correct/15" :
                isWrongPick ? "border-incorrect/60 bg-incorrect/15" :
                isPicked ? "border-primary bg-primary/10" :
                "border-border bg-surface hover:bg-surface-2"
              } ${locked && !isPicked && !isCorrect ? "opacity-60" : ""}`}>
              <span className="text-xs text-muted-foreground mr-2 font-mono-tab">{String.fromCharCode(65 + displayIdx)}</span>
              {question.options[origIdx]}
            </button>
          );
        })}
      </div>

      {result && (
        <div className={`mt-6 rounded-xl p-4 text-center ${result.isCorrect ? "bg-correct/15 text-correct" : "bg-incorrect/15 text-incorrect"}`}>
          {result.isCorrect ? `Correct! +${result.points}` : "Not this time."}
        </div>
      )}

      {locked && !result && <p className="text-center text-sm text-muted-foreground mt-6">Locked in. Waiting for the next question…</p>}

      <Link to="/app" className="mt-auto pt-6 text-xs text-muted-foreground text-center hover:text-foreground">Leave session</Link>
    </div>
  );
}
