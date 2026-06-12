import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, Home } from "lucide-react";

export const Route = createFileRoute("/_authenticated/results/$sessionId")({
  head: () => ({ meta: [{ title: "Results — QuizPulse" }] }),
  component: ResultsScreen,
});

type Row = { user_id: string; display_name: string; score: number; correct: number; total: number };

function ResultsScreen() {
  const { sessionId } = Route.useParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [joinCode, setJoinCode] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("sessions").select("join_code").eq("id", sessionId).single();
      setJoinCode((s as any)?.join_code ?? "");
      const { data: players } = await supabase.from("session_players").select("user_id,display_name").eq("session_id", sessionId);
      const { data: ans } = await supabase.from("answers").select("user_id,points,is_correct").eq("session_id", sessionId);
      const map: Record<string, Row> = {};
      (players ?? []).forEach((p: any) => { map[p.user_id] = { user_id: p.user_id, display_name: p.display_name, score: 0, correct: 0, total: 0 }; });
      (ans ?? []).forEach((a: any) => {
        const r = map[a.user_id]; if (!r) return;
        r.score += a.points ?? 0; r.total += 1; if (a.is_correct) r.correct += 1;
      });
      setRows(Object.values(map).sort((a, b) => b.score - a.score));
    })();
  }, [sessionId]);

  return (
    <div className="min-h-screen container mx-auto px-6 py-10 max-w-2xl">
      <div className="text-center">
        <Trophy className="size-10 text-primary mx-auto" />
        <h1 className="font-display text-4xl font-bold tracking-tight mt-3">Final scores</h1>
        <p className="text-muted-foreground mt-1">Session {joinCode}</p>
      </div>

      <div className="glass-panel rounded-2xl p-6 mt-8">
        {!rows ? <p className="text-center text-muted-foreground">Loading…</p> :
          rows.length === 0 ? <p className="text-center text-muted-foreground">No players.</p> :
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.user_id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${i === 0 ? "bg-primary/15 border border-primary/30" : "bg-surface"}`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono-tab text-2xl text-muted-foreground w-8">{i + 1}</span>
                  <div>
                    <div className="font-display font-semibold">{r.display_name}</div>
                    <div className="text-xs text-muted-foreground">{r.correct} / {r.total} correct</div>
                  </div>
                </div>
                <span className="font-mono-tab text-xl">{r.score}</span>
              </li>
            ))}
          </ol>
        }
      </div>

      <div className="text-center mt-8">
        <Button asChild variant="outline"><Link to="/app"><Home className="size-4 mr-1" /> Back to dashboard</Link></Button>
      </div>
    </div>
  );
}
