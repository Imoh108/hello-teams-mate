import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEnsureCurrentOrg } from "@/hooks/use-ensure-current-org";
import { tierForRank, weekStart } from "@/lib/leagues";
import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leagues")({
  head: () => ({
    meta: [
      { title: "Weekly League — QuizPulse" },
      { name: "description", content: "See this week's league standings for your workspace." },
      { property: "og:title", content: "Weekly League — QuizPulse" },
      { property: "og:description", content: "Gold, Silver and Bronze weekly quiz standings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Leagues,
});

type Row = { user_id: string; display_name: string; points: number; answers: number };
const TIER_CLS = {
  Gold: "bg-kahoot-yellow text-kahoot-yellow-foreground",
  Silver: "bg-secondary text-secondary-foreground",
  Bronze: "bg-kahoot-red text-kahoot-red-foreground",
} as const;

function Leagues() {
  const orgId = useEnsureCurrentOrg();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const since = weekStart();
  const reset = new Date(since.getTime() + 7 * 864e5);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    if (!orgId) { setRows([]); return; }
    supabase.rpc("weekly_league", { _org: orgId, _since: since.toISOString() }).then(({ data }) =>
      setRows(((data ?? []) as any[]).map((r) => ({ ...r, points: Number(r.points), answers: Number(r.answers) }))));
  }, [orgId]);

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 text-foreground">
      <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>
      <h1 className="font-display text-3xl font-black mt-3 flex items-center gap-2"><Medal className="size-7" /> Weekly League</h1>
      <p className="text-muted-foreground mt-1">Points from every answer this week. Resets {reset.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}. Top 20% Gold, next 30% Silver.</p>
      {rows === null ? <p className="mt-8 text-muted-foreground">Loading…</p> :
        rows.length === 0 ? <p className="mt-8 text-muted-foreground">No workspace selected or no members yet.</p> : (
        <ol className="mt-6 space-y-2">
          {rows.map((r, i) => {
            const tier = tierForRank(i, rows.length, r.points);
            return (
              <li key={r.user_id} className={cn("flex items-center gap-3 kahoot-radius bg-card border-2 border-border p-3", r.user_id === me && "ring-2 ring-primary")}>
                <span className="w-8 text-center font-display font-black tabular-nums">#{i + 1}</span>
                <span className="flex-1 font-bold truncate">{r.display_name}{r.user_id === me && " (you)"}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-display font-black", TIER_CLS[tier])}>{tier}</span>
                <span className="w-20 text-right font-display font-black tabular-nums">{r.points}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
