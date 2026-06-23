import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { submitAnswer } from "@/lib/quiz.functions";
import { permutationFor } from "@/lib/scoring";
import { track } from "@/lib/track";
import { toast } from "sonner";
import { AnswerBlock } from "@/components/quiz/AnswerBlock";
import { CircularTimer } from "@/components/quiz/CircularTimer";
import { FeedbackOverlay } from "@/components/quiz/FeedbackOverlay";
import { CountdownGo } from "@/components/quiz/CountdownGo";
import { PodiumLeaderboard, type LbRow } from "@/components/quiz/PodiumLeaderboard";
import { Flame } from "lucide-react";

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
  const [displayName, setDisplayName] = useState<string>("");
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ points: number; isCorrect: boolean } | null>(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [streak, setStreak] = useState(0);
  const [lbRows, setLbRows] = useState<LbRow[]>([]);
  const blurredRef = useRef(false);
  const lastQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      if (data.user?.id) {
        const { data: p } = await supabase.from("session_players")
          .select("display_name").eq("session_id", sessionId).eq("user_id", data.user.id).maybeSingle();
        if (p) setDisplayName((p as any).display_name ?? "");
      }
    })();
  }, [sessionId]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 150); return () => clearInterval(t); }, []);

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
    const qid = session?.current_question_id ?? null;
    if (!qid) { setQuestion(null); return; }
    (async () => {
      const { data } = await supabase.from("questions").select("*").eq("id", qid).single();
      if (data) setQuestion({ ...(data as any), options: (data as any).options as string[] });
      setSelected(null); setResult(null); blurredRef.current = false;
      if (lastQuestionRef.current !== qid) {
        lastQuestionRef.current = qid;
        setShowCountdown(true);
      }
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
    const vis = () => { if (document.hidden) onBlur(); };
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", vis); };
  }, [question, session, submittedFor, sessionId, submitFn]);

  // Per-player shuffle
  const permutation = useMemo(() => {
    if (!question || !userId) return [0, 1, 2, 3];
    return permutationFor(`${userId}:${question.id}`, 4);
  }, [question, userId]);

  const limit = session?.time_limit_override_s ?? question?.time_limit_s ?? 20;
  const elapsed = session?.question_started_at ? Math.max(0, (now - new Date(session.question_started_at).getTime()) / 1000) : 0;
  const remaining = Math.max(0, limit - elapsed);

  // Auto-submit when time is up
  useEffect(() => {
    if (!question || !session || session.status !== "active") return;
    if (submittedFor === question.id) return;
    if (remaining <= 0) {
      (async () => {
        try {
          const r: any = await submitFn({ data: { session_id: sessionId, question_id: question.id, selected_index: selected } });
          setSubmittedFor(question.id);
          setResult({ points: r.points, isCorrect: r.isCorrect });
          setStreak((s) => r.isCorrect ? s + 1 : 0);
        } catch {}
      })();
    }
  }, [remaining, question, session, submittedFor, selected, sessionId, submitFn]);

  // Load leaderboard during reveal
  useEffect(() => {
    if (session?.status !== "reveal") return;
    let cancelled = false;
    const load = async () => {
      const [{ data: players }, { data: ans }] = await Promise.all([
        supabase.from("session_players").select("user_id,display_name").eq("session_id", sessionId),
        supabase.from("answers").select("user_id,points,is_correct,created_at").eq("session_id", sessionId).order("created_at"),
      ]);
      const scores: Record<string, number> = {};
      const streaks: Record<string, number> = {};
      const cur: Record<string, number> = {};
      (ans ?? []).forEach((a: any) => {
        scores[a.user_id] = (scores[a.user_id] ?? 0) + (a.points ?? 0);
        if (a.is_correct) { cur[a.user_id] = (cur[a.user_id] ?? 0) + 1; streaks[a.user_id] = Math.max(streaks[a.user_id] ?? 0, cur[a.user_id]); }
        else { cur[a.user_id] = 0; }
      });
      const rows: LbRow[] = (players ?? []).map((p: any) => ({
        user_id: p.user_id, display_name: p.display_name, score: scores[p.user_id] ?? 0, streak: cur[p.user_id] ?? 0,
      }));
      if (!cancelled) setLbRows(rows);
    };
    load();
    const ch = supabase.channel(`lb-play-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [session?.status, sessionId]);

  const onPick = async (originalIdx: number) => {
    if (!question || submittedFor === question.id || !session || session.status !== "active") return;
    setSelected(originalIdx);
    try {
      const r: any = await submitFn({ data: { session_id: sessionId, question_id: question.id, selected_index: originalIdx } });
      setSubmittedFor(question.id);
      setResult({ points: r.points, isCorrect: r.isCorrect });
      setStreak((s) => r.isCorrect ? s + 1 : 0);
      track("question_answered", { is_correct: !!r.isCorrect, points: r.points });
    } catch (e: any) { toast.error(e.message); }
  };

  if (!session) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  // Lobby
  if (!question && session.status !== "reveal" && session.status !== "ended") {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="kahoot-radius kahoot-shadow bg-gradient-to-br from-kahoot-purple to-kahoot-blue text-white p-10 text-center max-w-sm border-4 border-black/10">
          <div className="text-xs font-display font-black tracking-widest opacity-80">JOINED · {session.join_code}</div>
          <h1 className="font-display text-4xl font-black mt-3">You're in!</h1>
          {displayName && <div className="mt-2 inline-block px-4 py-1 rounded-full bg-white/20 font-display font-bold">{displayName}</div>}
          <p className="mt-4 text-white/90">Waiting for the host to start. Stay on this tab — leaving flags your answer.</p>
          <div className="live-dot mx-auto mt-6" />
        </div>
      </div>
    );
  }

  // Leaderboard between questions
  if (session.status === "reveal" || !question) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto w-full">
        <h1 className="font-display text-3xl font-black text-center mb-4">Leaderboard</h1>
        <PodiumLeaderboard rows={lbRows} highlightUserId={userId} />
        <p className="text-center text-sm text-muted-foreground mt-6">Get ready for the next question…</p>
      </div>
    );
  }

  const isReveal = false;
  const locked = submittedFor === question.id;

  return (
    <div className="min-h-screen flex flex-col px-4 py-4 max-w-3xl mx-auto w-full">
      {showCountdown && <CountdownGo onDone={() => setShowCountdown(false)} />}
      {result && <FeedbackOverlay isCorrect={result.isCorrect} points={result.points} streak={streak} />}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono-tab">{session.join_code}</span>
          {streak >= 2 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-kahoot-yellow text-kahoot-yellow-foreground font-display font-bold">
              <Flame className="size-3 fill-current" /> {streak}
            </span>
          )}
        </div>
        <CircularTimer remaining={remaining} limit={limit} size={72} />
      </div>

      <div className="kahoot-radius bg-card border-4 border-black/10 kahoot-shadow-sm p-6 mt-4">
        <h1 className="font-display text-xl sm:text-3xl font-black leading-tight text-center">{question.prompt}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {permutation.map((origIdx, displayIdx) => {
          const isPicked = selected === origIdx;
          const state = isReveal
            ? (origIdx === question.correct_index ? "correct" : (isPicked ? "wrong" : "idle"))
            : (isPicked ? "picked" : "idle");
          return (
            <AnswerBlock
              key={origIdx}
              displayIndex={displayIdx as 0 | 1 | 2 | 3}
              label={question.options[origIdx]}
              disabled={locked}
              state={state as any}
              onClick={() => onPick(origIdx)}
            />
          );
        })}
      </div>

      {locked && !result && <p className="text-center text-sm text-muted-foreground mt-6 animate-pulse">Locked in. Waiting for others…</p>}

      <Link to="/app" className="mt-auto pt-6 text-xs text-muted-foreground text-center hover:text-foreground">Leave session</Link>
    </div>
  );
}
