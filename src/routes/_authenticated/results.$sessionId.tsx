import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, RotateCcw } from "lucide-react";
import { PodiumLeaderboard, type LbRow } from "@/components/quiz/PodiumLeaderboard";

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

function ResultsScreen() {
  const { sessionId } = Route.useParams();
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [joinCode, setJoinCode] = useState<string>("");
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? null);
      const { data: s } = await supabase.from("sessions").select("join_code").eq("id", sessionId).single();
      setJoinCode((s as any)?.join_code ?? "");
      const { data: players } = await supabase.from("session_players").select("user_id,display_name").eq("session_id", sessionId);
      const { data: ans } = await supabase.from("answers").select("user_id,points,is_correct,created_at").eq("session_id", sessionId).order("created_at");
      const scores: Record<string, number> = {};
      const cur: Record<string, number> = {};
      const best: Record<string, number> = {};
      (ans ?? []).forEach((a: any) => {
        scores[a.user_id] = (scores[a.user_id] ?? 0) + (a.points ?? 0);
        if (a.is_correct) { cur[a.user_id] = (cur[a.user_id] ?? 0) + 1; best[a.user_id] = Math.max(best[a.user_id] ?? 0, cur[a.user_id]); }
        else { cur[a.user_id] = 0; }
      });
      const out: LbRow[] = (players ?? []).map((p: any) => ({
        user_id: p.user_id, display_name: p.display_name, score: scores[p.user_id] ?? 0, streak: best[p.user_id] ?? 0,
      })).sort((a, b) => b.score - a.score);
      setRows(out);
    })();
  }, [sessionId]);

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

        <div className="text-center mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className="kahoot-shadow-sm border-4 border-black/10 kahoot-radius font-display font-black">
            <Link to="/play" search={{ code: joinCode }}><RotateCcw className="size-4 mr-1" /> Play again</Link>
          </Button>
          <Button asChild className="kahoot-shadow-sm border-4 border-black/10 kahoot-radius font-display font-black">
            <Link to="/app"><Home className="size-4 mr-1" /> Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
