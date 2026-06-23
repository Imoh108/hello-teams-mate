import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { startQuestion, revealAnswers, endSession } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Eye, Square, Copy, Link2, Share2 } from "lucide-react";
import { AnswerBlock, KAHOOT_COLORS } from "@/components/quiz/AnswerBlock";
import { CircularTimer } from "@/components/quiz/CircularTimer";
import { PodiumLeaderboard, type LbRow } from "@/components/quiz/PodiumLeaderboard";

export const Route = createFileRoute("/_authenticated/host/$sessionId")({
  head: () => ({ meta: [{ title: "Host — QuizPulse" }] }),
  component: HostScreen,
});

type Session = { id: string; quiz_id: string; join_code: string; status: string; current_question_id: string | null; question_started_at: string | null; time_limit_override_s: number | null };
type Question = { id: string; position: number; prompt: string; options: string[]; correct_index: number; time_limit_s: number };
type Player = { user_id: string; display_name: string; flagged_count: number };

function HostScreen() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const startFn = useServerFn(startQuestion);
  const revealFn = useServerFn(revealAnswers);
  const endFn = useServerFn(endSession);

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [teamsMsg, setTeamsMsg] = useState("");

  // Initialize default Teams share message once we have a session code
  useEffect(() => {
    if (session && !teamsMsg) {
      setTeamsMsg(`Join my QuizPulse round — code ${session.join_code}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.join_code]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const currentQuestionId = session?.current_question_id ?? null;

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      setSession(s as any);
      if (s) {
        const { data: qs } = await supabase.from("questions").select("*").eq("quiz_id", (s as any).quiz_id).order("position");
        setQuestions(((qs ?? []) as any).map((q: any) => ({ ...q, options: q.options as string[] })));
      }
      const { data: ps } = await supabase.from("session_players").select("user_id,display_name,flagged_count").eq("session_id", sessionId);
      setPlayers((ps ?? []) as any);
    })();

    const ch = supabase.channel(`host-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (p) => setSession(p.new as any))
      .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase.from("session_players").select("user_id,display_name,flagged_count").eq("session_id", sessionId);
          setPlayers((data ?? []) as any);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // Per-option distribution for current question
  const [distribution, setDistribution] = useState<number[]>([0, 0, 0, 0]);
  useEffect(() => {
    if (!currentQuestionId) { setAnsweredCount(0); setDistribution([0, 0, 0, 0]); return; }
    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase.from("answers")
        .select("selected_index")
        .eq("session_id", sessionId).eq("question_id", currentQuestionId);
      const dist = [0, 0, 0, 0];
      (data ?? []).forEach((r: any) => { if (typeof r.selected_index === "number" && r.selected_index >= 0 && r.selected_index < 4) dist[r.selected_index]++; });
      if (!cancelled) { setDistribution(dist); setAnsweredCount((data ?? []).length); }
    };
    refresh();
    const ch = supabase.channel(`host-answers-${sessionId}-${currentQuestionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionId, currentQuestionId]);

  const currentIdx = useMemo(() => {
    if (!session?.current_question_id) return -1;
    return questions.findIndex((q) => q.id === session.current_question_id);
  }, [session?.current_question_id, questions]);

  const current = currentIdx >= 0 ? questions[currentIdx] : null;
  const limit = (session?.time_limit_override_s ?? current?.time_limit_s ?? 20);
  const elapsed = session?.question_started_at ? Math.max(0, (now - new Date(session.question_started_at).getTime()) / 1000) : 0;
  const remaining = Math.max(0, limit - elapsed);

  const onNext = async () => {
    const nextIdx = currentIdx + 1;
    const q = questions[nextIdx];
    if (!q) return;
    setAnsweredCount(0);
    try { await startFn({ data: { session_id: sessionId, question_id: q.id } }); } catch (e: any) { toast.error(e.message); }
  };

  const onReveal = async () => { try { await revealFn({ data: { session_id: sessionId } }); } catch (e: any) { toast.error(e.message); } };
  const onEnd = async () => {
    if (!confirm("End the session?")) return;
    try { await endFn({ data: { session_id: sessionId } }); navigate({ to: "/results/$sessionId", params: { sessionId } }); } catch (e: any) { toast.error(e.message); }
  };

  const copyCode = () => { if (session) { navigator.clipboard.writeText(session.join_code); toast.success("Code copied"); } };
  const joinUrl = () =>
    session ? `${window.location.origin}/play?code=${encodeURIComponent(session.join_code)}` : "";
  const copyLink = () => {
    if (!session) return;
    navigator.clipboard.writeText(joinUrl());
    toast.success("Join link copied");
  };
  const teamsShareUrl = () => {
    if (!session) return "";
    const msg = teamsMsg.trim() || `Join my QuizPulse round — code ${session.join_code}`;
    return `https://teams.microsoft.com/share?href=${encodeURIComponent(joinUrl())}&msgText=${encodeURIComponent(msg)}&preview=true`;
  };
  const shareToTeams = () => {
    if (!session) return;
    window.open(teamsShareUrl(), "_blank", "noopener,noreferrer");
  };
  const copyTeamsLink = () => {
    if (!session) return;
    navigator.clipboard.writeText(teamsShareUrl());
    toast.success("Teams share link copied");
  };
  const previewAsPlayer = () => {
    if (!session) return;
    const url = `/play?code=${encodeURIComponent(session.join_code)}&preview=1&name=${encodeURIComponent("Host preview")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!session) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
          <div className="flex items-center gap-2">
            <button onClick={copyCode} className="flex items-center gap-2 font-mono-tab text-lg tracking-widest" title="Copy code">
              {session.join_code} <Copy className="size-4 text-muted-foreground" />
            </button>
            <button onClick={copyLink} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border px-2 py-1" title="Copy join link">
              <Link2 className="size-3" /> Link
            </button>
            <button onClick={shareToTeams} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground rounded-md border border-border px-2 py-1" title="Share to Microsoft Teams">
              <Share2 className="size-3" /> Teams
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="live-dot" /> {session.status.toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6">
          {!current ? (
            <div className="glass-panel rounded-2xl p-12 text-center">
              <h2 className="font-display text-2xl font-bold">Lobby</h2>
              <p className="text-muted-foreground mt-2">Share code <span className="font-mono-tab text-foreground">{session.join_code}</span> with your team, or send them a join link.</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={copyCode} variant="outline" size="sm"><Copy className="size-4 mr-1" /> Copy code</Button>
                <Button onClick={copyLink} variant="outline" size="sm"><Link2 className="size-4 mr-1" /> Copy join link</Button>
                <Button onClick={previewAsPlayer} variant="outline" size="sm" title="Open the player view in a new tab as a guest"><Eye className="size-4 mr-1" /> Preview as player</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Anyone with the link can join as a guest — no account needed.</p>

              <div className="mt-6 max-w-md mx-auto text-left">
                <Label htmlFor="teams-msg" className="text-xs text-muted-foreground">Teams share message</Label>
                <Textarea
                  id="teams-msg"
                  value={teamsMsg}
                  onChange={(e) => setTeamsMsg(e.target.value)}
                  rows={2}
                  maxLength={240}
                  placeholder={`Join my QuizPulse round — code ${session.join_code}`}
                  className="mt-1 text-sm"
                />
                <p className="mt-1 text-[11px] text-muted-foreground text-right">{teamsMsg.length}/240</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={shareToTeams} variant="outline" size="sm"><Share2 className="size-4 mr-1" /> Share to Teams</Button>
                  <Button onClick={copyTeamsLink} variant="outline" size="sm"><Copy className="size-4 mr-1" /> Copy Teams share link</Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{players.length} player{players.length === 1 ? "" : "s"} joined</p>
              <Button onClick={onNext} size="lg" className="mt-6"><ArrowRight className="size-4 mr-1" /> Start first question</Button>
            </div>
          ) : (
            <div className="kahoot-radius bg-card border-4 border-black/10 kahoot-shadow-sm p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="font-display font-black text-sm text-muted-foreground">Q{currentIdx + 1} / {questions.length}</span>
                <CircularTimer remaining={remaining} limit={limit} size={80} />
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-black mt-4 leading-tight">{current.prompt}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {current.options.map((o, i) => {
                  const isReveal = session.status === "reveal";
                  const isCorrect = isReveal && i === current.correct_index;
                  const total = Math.max(1, distribution.reduce((a, b) => a + b, 0));
                  const pct = Math.round((distribution[i] / total) * 100);
                  return (
                    <div key={i} className="space-y-1">
                      <AnswerBlock
                        displayIndex={i as 0 | 1 | 2 | 3}
                        label={o}
                        disabled={!isReveal}
                        state={isReveal ? (isCorrect ? "correct" : "wrong") : "idle"}
                      />
                      <div className="px-1 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                          <div className={`h-full ${KAHOOT_COLORS[i].bg} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono-tab text-xs text-muted-foreground w-12 text-right">{distribution[i]} ({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground font-display font-bold">{answeredCount} / {players.length} answered</div>
                <div className="flex gap-2">
                  {session.status === "active" && <Button onClick={onReveal} variant="outline"><Eye className="size-4 mr-1" /> Reveal</Button>}
                  {currentIdx + 1 < questions.length ? (
                    <Button onClick={onNext}><ArrowRight className="size-4 mr-1" /> Next question</Button>
                  ) : (
                    <Button onClick={onEnd} variant="destructive"><Square className="size-4 mr-1" /> End session</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="kahoot-radius bg-card border-4 border-black/10 kahoot-shadow-sm p-5">
          <h3 className="font-display font-black text-lg mb-3">Leaderboard</h3>
          <Leaderboard sessionId={sessionId} players={players} />
        </aside>
      </main>
    </div>
  );
}

function Leaderboard({ sessionId, players }: { sessionId: string; players: Player[] }) {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("answers").select("user_id,points").eq("session_id", sessionId);
      const s: Record<string, number> = {};
      (data ?? []).forEach((r: any) => { s[r.user_id] = (s[r.user_id] ?? 0) + (r.points ?? 0); });
      setScores(s);
    };
    load();
    const ch = supabase.channel(`lb-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `session_id=eq.${sessionId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  const sorted = [...players].sort((a, b) => (scores[b.user_id] ?? 0) - (scores[a.user_id] ?? 0));
  if (players.length === 0) return <p className="text-sm text-muted-foreground">Waiting for players…</p>;
  return (
    <ol className="space-y-1.5">
      {sorted.map((p, i) => (
        <li key={p.user_id} className="flex items-center justify-between rounded-md bg-surface px-3 py-2 text-sm">
          <span className="flex items-center gap-2"><span className="text-muted-foreground font-mono-tab w-5">{i + 1}</span>{p.display_name}{p.flagged_count > 0 && <span title="Flagged" className="text-incorrect text-xs">⚠</span>}</span>
          <span className="font-mono-tab">{scores[p.user_id] ?? 0}</span>
        </li>
      ))}
    </ol>
  );
}
