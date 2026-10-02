import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, RotateCcw, Share2, Zap, Target, Flame } from "lucide-react";
import { PodiumLeaderboard, type LbRow } from "@/components/quiz/PodiumLeaderboard";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";

function HighlightCard({ icon, label, name, value }: { icon: React.ReactNode; label: string; name: string; value: string }) {
  return (
    <div className="kahoot-radius bg-card border-4 border-black/10 kahoot-shadow-sm p-4 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs font-display font-black uppercase">{icon} {label}</div>
      <div className="mt-2 font-display font-black text-lg truncate">{name}</div>
      <div className="font-mono-tab text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/results/$sessionId")({
  head: () => ({ meta: [{ title: "Results — QuizPulse" }] }),
  component: ResultsScreen,
});

function Confetti() {
  const pieces = Array.from({ length: 40 });
  const colors = ["bg-kahoot-red", "bg-kahoot-blue", "bg-kahoot-yellow", "bg-kahoot-green", "bg-kahoot-purple"];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {pieces.map((_, i) => (
        <span
          key={i}
          className={`absolute top-0 size-2 ${colors[i % colors.length]} animate-confetti`}
          style={{ left: `${(i * 97) % 100}%`, animationDelay: `${(i % 10) * 0.15}s`, animationDuration: `${3 + (i % 5)}s` }}
        />
      ))}
    </div>
  );
}

type Highlights = { fastest?: { name: string; ms: number }; accurate?: { name: string; pct: number }; streak?: { name: string; n: number } };

function ResultsScreen() {
  const { sessionId } = Route.useParams();
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [joinCode, setJoinCode] = useState<string>("");
  const [me, setMe] = useState<string | null>(null);
  const [hl, setHl] = useState<Highlights>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? null);
      const { data: s } = await supabase.from("sessions").select("join_code").eq("id", sessionId).single();
      setJoinCode((s as any)?.join_code ?? "");
      const { data: players } = await supabase.from("session_players").select("user_id,display_name").eq("session_id", sessionId);
      const { data: ans } = await supabase.from("answers").select("user_id,points,is_correct,time_taken_ms,answered_at").eq("session_id", sessionId).order("answered_at");
      const names: Record<string, string> = {};
      (players ?? []).forEach((p: any) => { names[p.user_id] = p.display_name; });
      const scores: Record<string, number> = {};
      const cur: Record<string, number> = {};
      const best: Record<string, number> = {};
      const total: Record<string, number> = {};
      const correct: Record<string, number> = {};
      let fastest: { id: string; ms: number } | null = null;
      (ans ?? []).forEach((a: any) => {
        scores[a.user_id] = (scores[a.user_id] ?? 0) + (a.points ?? 0);
        total[a.user_id] = (total[a.user_id] ?? 0) + 1;
        if (a.is_correct) {
          correct[a.user_id] = (correct[a.user_id] ?? 0) + 1;
          cur[a.user_id] = (cur[a.user_id] ?? 0) + 1; best[a.user_id] = Math.max(best[a.user_id] ?? 0, cur[a.user_id]);
          if (!fastest || a.time_taken_ms < fastest.ms) fastest = { id: a.user_id, ms: a.time_taken_ms };
        } else { cur[a.user_id] = 0; }
      });
      const out: LbRow[] = (players ?? []).map((p: any) => ({
        user_id: p.user_id, display_name: p.display_name, score: scores[p.user_id] ?? 0, streak: best[p.user_id] ?? 0,
      })).sort((a, b) => b.score - a.score);
      setRows(out);
      const h: Highlights = {};
      const f = fastest as { id: string; ms: number } | null;
      if (f) h.fastest = { name: names[f.id] ?? "Player", ms: f.ms };
      const acc = Object.keys(total).map((id) => ({ id, pct: Math.round(((correct[id] ?? 0) / total[id]) * 100) })).sort((a, b) => b.pct - a.pct)[0];
      if (acc) h.accurate = { name: names[acc.id] ?? "Player", pct: acc.pct };
      const st = Object.entries(best).sort((a, b) => b[1] - a[1])[0];
      if (st && st[1] >= 2) h.streak = { name: names[st[0]] ?? "Player", n: st[1] };
      setHl(h);
      if (out.length) sfx.fanfare();
    })();
  }, [sessionId]);

  const shareText = () => {
    const medals = ["🥇", "🥈", "🥉"];
    const lines = [`🏆 QuizPulse results — ${joinCode}`];
    (rows ?? []).slice(0, 3).forEach((r, i) => lines.push(`${medals[i]} ${r.display_name} — ${r.score} pts`));
    if (hl.fastest) lines.push(`⚡ Fastest answer: ${hl.fastest.name} (${(hl.fastest.ms / 1000).toFixed(1)}s)`);
    if (hl.accurate) lines.push(`🎯 Most accurate: ${hl.accurate.name} (${hl.accurate.pct}%)`);
    if (hl.streak) lines.push(`🔥 Longest streak: ${hl.streak.name} (${hl.streak.n} in a row)`);
    return lines.join("\n");
  };
  const onShare = async () => {
    const text = shareText();
    try {
      if (navigator.share) { await navigator.share({ title: "QuizPulse results", text }); return; }
    } catch { /* cancelled */ }
    await navigator.clipboard.writeText(text);
    toast.success("Results copied — paste into Teams, Slack or WhatsApp");
  };

  return (
    <div className="min-h-screen container mx-auto px-6 py-10 max-w-2xl relative">
      <Confetti />
      <div className="relative">
        <div className="text-center">
          <h1 className="font-display text-5xl font-black tracking-tight">Final scores</h1>
          <p className="text-muted-foreground mt-1 font-display font-bold">Session {joinCode}</p>
        </div>

        <div className="mt-8">
          {!rows ? <p className="text-center text-muted-foreground">Loading…</p> :
            rows.length === 0 ? <p className="text-center text-muted-foreground">No players.</p> :
            <PodiumLeaderboard rows={rows} highlightUserId={me} max={10} />
          }
        </div>

        {(hl.fastest || hl.accurate || hl.streak) && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {hl.fastest && <HighlightCard icon={<Zap className="size-5" />} label="Fastest answer" name={hl.fastest.name} value={`${(hl.fastest.ms / 1000).toFixed(1)}s`} />}
            {hl.accurate && <HighlightCard icon={<Target className="size-5" />} label="Most accurate" name={hl.accurate.name} value={`${hl.accurate.pct}%`} />}
            {hl.streak && <HighlightCard icon={<Flame className="size-5" />} label="Longest streak" name={hl.streak.name} value={`${hl.streak.n} in a row`} />}
          </div>
        )}

        <div className="text-center mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onShare} className="kahoot-shadow-sm border-4 border-black/10 kahoot-radius font-display font-black">
            <Share2 className="size-4 mr-1" /> Share results
          </Button>
          <Button asChild variant="outline" className="kahoot-shadow-sm border-4 border-black/10 kahoot-radius font-display font-black">
            <Link to="/play" search={{ code: joinCode }}><RotateCcw className="size-4 mr-1" /> Play again</Link>
          </Button>
          <Button asChild variant="outline" className="kahoot-shadow-sm border-4 border-black/10 kahoot-radius font-display font-black">
            <Link to="/app"><Home className="size-4 mr-1" /> Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
