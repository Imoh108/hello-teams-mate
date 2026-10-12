import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDuel, acceptDuel } from "@/lib/duels.functions";
import { startQuestion, submitAnswer, endSession } from "@/lib/quiz.functions";
import { AnswerBlock } from "@/components/quiz/CircularTimer";
import { CircularTimer } from "@/components/quiz/CircularTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords, Trophy, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/duel/$id")({
  component: DuelPage,
  head: () => ({
    meta: [
      { title: "1v1 Duel — QuizPulse" },
      { name: "description", content: "Play a 1v1 async quiz duel and compare scores." },
    ],
  }),
});

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  time_limit_s: number;
};

function DuelPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [me, setMe] = useState<string | null>(null);
  const [phase, setPhase] = useState<"lobby" | "playing" | "done">("lobby");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: duel, refetch } = useQuery({
    queryKey: ["duel", id],
    queryFn: () => getDuel({ data: { challenge_id: id } }),
    refetchInterval: phase === "lobby" ? 5000 : false,
  });

  if (!duel || !me) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading duel…</div>;
  }

  const isChallenger = duel.challenger_id === me;
  const isOpponent = duel.opponent_id === me;
  const mySessionId = isChallenger ? duel.challenger_session_id : isOpponent ? duel.opponent_session_id : null;
  const myDone = isChallenger ? duel.challenger_done : isOpponent ? duel.opponent_done : false;

  const onAccept = async () => {
    try {
      await acceptDuel({ data: { challenge_id: id } });
      await refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Could not accept duel");
    }
  };

  const inviteUrl = `${window.location.origin}/duel/${id}`;
  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (phase === "playing" && mySessionId) {
    return (
      <SoloPlay
        sessionId={mySessionId}
        quizId={duel.quiz_id}
        onDone={async () => {
          await endSession({ data: { session_id: mySessionId } });
          setPhase("done");
          queryClient.invalidateQueries({ queryKey: ["duel", id] });
          refetch();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 grid place-items-center size-14 rounded-full bg-primary/15">
            <Swords className="size-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">{duel.quiz_title}</CardTitle>
          <p className="text-muted-foreground text-sm">{duel.question_count} questions · highest score wins</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold truncate">{duel.challenger_name}</p>
              <p className="text-xs text-muted-foreground">Challenger</p>
              <p className="mt-1 font-display text-xl">
                {duel.challenger_done ? duel.challenger_score : duel.challenger_id === me ? "—" : "?"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-semibold truncate">{duel.opponent_name ?? "Waiting…"}</p>
              <p className="text-xs text-muted-foreground">Opponent</p>
              <p className="mt-1 font-display text-xl">
                {duel.opponent_done ? duel.opponent_score : duel.opponent_id === me ? "—" : "?"}
              </p>
            </div>
          </div>

          {duel.winner_id && (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-kahoot-yellow/15 p-3 font-display font-bold">
              <Trophy className="size-5 text-kahoot-yellow" />
              {duel.winner_id === me ? "You win!" : `${duel.winner_id === duel.challenger_id ? duel.challenger_name : duel.opponent_name} wins!`}
            </div>
          )}

          {!isChallenger && !isOpponent && !duel.opponent_id && (
            <Button className="w-full" size="lg" onClick={onAccept}>Accept duel</Button>
          )}

          {(isChallenger || isOpponent) && !myDone && (
            <Button className="w-full" size="lg" onClick={() => setPhase("playing")}>
              {isChallenger && !duel.opponent_id ? "Play your round" : "Play now"}
            </Button>
          )}

          {isChallenger && !duel.opponent_id && (
            <Button variant="outline" className="w-full" onClick={copyInvite}>
              {copied ? <Check className="size-4 mr-2" /> : <Copy className="size-4 mr-2" />}
              {copied ? "Link copied!" : "Copy invite link"}
            </Button>
          )}

          <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/duels" })}>
            Back to duels
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SoloPlay({ sessionId, quizId, onDone }: { sessionId: string; quizId: string; onDone: () => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from("questions")
      .select("id,prompt,options,correct_index,time_limit_s")
      .eq("quiz_id", quizId)
      .order("position")
      .then(({ data }) => setQuestions((data ?? []) as Question[]));
  }, [quizId]);

  const q = questions?.[idx];

  // Start each question server-side, then run the countdown
  useEffect(() => {
    if (!q) return;
    setPicked(null);
    startQuestion({ data: { session_id: sessionId, question_id: q.id } }).then(() => {
      setRemaining(q.time_limit_s);
    });
  }, [q?.id]);

  useEffect(() => {
    if (remaining <= 0) return;
    timerRef.current = setInterval(() => setRemaining((r) => Math.max(0, r - 0.1)), 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [remaining > 0]);

  // Time up → submit null and advance
  useEffect(() => {
    if (remaining === 0 && q && picked === null) {
      void advance(null);
    }
  }, [remaining, q, picked]);

  const advance = async (selected: number | null) => {
    if (!q) return;
    try {
      const res = await submitAnswer({
        data: { session_id: sessionId, question_id: q.id, selected_index: selected },
      });
      setScore((s) => s + (res.points ?? 0));
    } catch {
      // ignore (e.g. already answered)
    }
    if (questions && idx + 1 >= questions.length) onDone();
    else setIdx((i) => i + 1);
  };

  if (!questions) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading questions…</div>;
  }
  if (!q) return null;

  const options = Array.isArray(q.options) ? q.options : [];

  return (
    <div className="min-h-screen flex flex-col bg-background p-4 sm:p-6 gap-4">
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-muted-foreground">
          {idx + 1} / {questions.length}
        </span>
        <CircularTimer remaining={remaining} limit={q.time_limit_s} size={72} />
        <span className="font-display font-bold">{score} pts</span>
      </div>
      <div className="rounded-xl bg-card border border-border p-6 text-center font-display text-xl sm:text-2xl font-bold">
        {q.prompt}
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 content-stretch">
        {options.slice(0, 4).map((opt, i) => (
          <AnswerBlock
            key={i}
            displayIndex={i as 0 | 1 | 2 | 3}
            label={opt}
            disabled={picked !== null}
            state={picked === i ? "picked" : "idle"}
            onClick={() => {
              if (picked !== null) return;
              setPicked(i);
              void advance(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}
