import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listDuels, listMyQuizzesForDuel, createDuel } from "@/lib/duels.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Swords, Trophy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/duels")({
  component: DuelsPage,
  head: () => ({
    meta: [
      { title: "1v1 Duels — QuizPulse" },
      { name: "description", content: "Challenge a friend to an async 1v1 quiz duel." },
    ],
  }),
});

function DuelsPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const { data: duels, refetch } = useQuery({ queryKey: ["duels"], queryFn: () => listDuels({}) });
  const { data: quizzes } = useQuery({ queryKey: ["duel-quizzes"], queryFn: () => listMyQuizzesForDuel({}) });

  const onCreate = async (quizId: string) => {
    setCreating(true);
    try {
      const res = await createDuel({ data: { quiz_id: quizId } });
      await refetch();
      navigate({ to: "/duel/$id", params: { id: res.challenge_id } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create duel");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/app"><ArrowLeft className="size-4" /></Link></Button>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Swords className="size-6 text-primary" /> 1v1 Duels
          </h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Start a duel</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(quizzes ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Create a quiz first, then challenge a friend to it.</p>
            )}
            {(quizzes ?? []).map((q: any) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="font-medium truncate">{q.title}</span>
                <Button size="sm" disabled={creating} onClick={() => onCreate(q.id)}>Challenge</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Your duels</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(duels ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No duels yet — challenge someone above.</p>
            )}
            {(duels ?? []).map((d: any) => (
              <Link key={d.id} to="/duel/$id" params={{ id: d.id }}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium truncate">{d.quiz_title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {d.challenger_name} vs {d.opponent_name ?? "waiting for opponent"}
                  </p>
                </div>
                <span className="text-xs font-semibold flex items-center gap-1 shrink-0">
                  {d.status === "completed" && <Trophy className="size-3.5 text-kahoot-yellow" />}
                  {d.status === "open" ? "Open" : d.status === "completed" ? "Finished" : "In progress"}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
