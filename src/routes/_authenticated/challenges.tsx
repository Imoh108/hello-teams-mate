import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listChallenges, joinChallenge } from "@/lib/gamification.functions";
import { useCurrentOrgId } from "@/hooks/use-current-org";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Flame, Trophy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({ meta: [{ title: "Challenges — QuizPulse" }] }),
  component: ChallengesPage,
});

function ChallengesPage() {
  const [orgId] = useCurrentOrgId();
  const listFn = useServerFn(listChallenges);
  const joinFn = useServerFn(joinChallenge);
  const [items, setItems] = useState<any[]>([]);
  const refresh = async () => {
    if (!orgId) return setItems([]);
    setItems(await listFn({ data: { orgId } }) as any);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [orgId]);

  const onJoin = async (id: string) => {
    try { await joinFn({ data: { challengeId: id } }); toast.success("Joined"); refresh(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Button asChild variant="ghost" size="sm"><Link to="/profile"><ArrowLeft className="size-4 mr-1" /> Profile</Link></Button>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10 max-w-3xl">
        <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-2"><Flame className="size-7" /> Challenges</h1>
        {!orgId ? <p className="text-muted-foreground">Select an organization to see challenges.</p> :
          items.length === 0 ? <p className="text-muted-foreground">No active challenges.</p> :
          <div className="space-y-3">
            {items.map((c) => {
              const ends = new Date(c.end_at);
              const expired = ends < new Date();
              const progress = c.participant?.current_progress ?? 0;
              const pct = Math.min(100, Math.round((progress / c.target_points) * 100));
              const done = !!c.participant?.completed_at;
              return (
                <div key={c.id} className="glass-panel rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display font-semibold flex items-center gap-2">
                        {c.name} {done && <Check className="size-4 text-primary" />}
                      </h3>
                      {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                      <div className="text-xs text-muted-foreground mt-1">Ends {ends.toLocaleDateString()}</div>
                    </div>
                    {!c.participant && !expired && <Button size="sm" onClick={() => onJoin(c.id)}>Join</Button>}
                  </div>
                  {c.participant && (
                    <div className="mt-3">
                      <Progress value={pct} />
                      <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                        <span>{progress} / {c.target_points} pts</span>
                        {c.reward_badge_id && <span className="flex items-center gap-1"><Trophy className="size-3" /> Badge reward</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        }
      </main>
    </div>
  );
}
