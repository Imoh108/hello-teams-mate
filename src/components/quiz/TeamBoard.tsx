import { cn } from "@/lib/utils";

export const TEAMS = [
  { name: "Red Team", cls: "bg-kahoot-red text-kahoot-red-foreground" },
  { name: "Blue Team", cls: "bg-kahoot-blue text-kahoot-blue-foreground" },
  { name: "Yellow Team", cls: "bg-kahoot-yellow text-kahoot-yellow-foreground" },
  { name: "Green Team", cls: "bg-kahoot-green text-kahoot-green-foreground" },
] as const;

export type TeamMember = { user_id: string; team_index: number | null; score: number };

export function TeamBadge({ index, className }: { index: number | null | undefined; className?: string }) {
  if (index == null || !TEAMS[index]) return null;
  return (
    <span className={cn("inline-block px-3 py-1 rounded-full font-display font-black text-xs border-2 border-black/10", TEAMS[index].cls, className)}>
      {TEAMS[index].name}
    </span>
  );
}

/** Team score = average points per member, so uneven team sizes stay fair. */
export function TeamBoard({ teamCount, members, highlightTeam }: { teamCount: number; members: TeamMember[]; highlightTeam?: number | null }) {
  const teams = Array.from({ length: teamCount }, (_, i) => {
    const m = members.filter((x) => x.team_index === i);
    const total = m.reduce((a, b) => a + b.score, 0);
    return { i, size: m.length, total, avg: m.length ? Math.round(total / m.length) : 0 };
  }).sort((a, b) => b.avg - a.avg);
  const top = Math.max(1, ...teams.map((t) => t.avg));
  return (
    <div className="space-y-2 w-full">
      {teams.map((t, rank) => (
        <div key={t.i} className={cn("kahoot-radius border-4 border-black/10 p-3", TEAMS[t.i].cls, highlightTeam === t.i && "ring-4 ring-foreground ring-offset-2 ring-offset-background")}>
          <div className="flex items-center justify-between font-display font-black">
            <span>#{rank + 1} {TEAMS[t.i].name}</span>
            <span className="tabular-nums">{t.avg}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-black/20 overflow-hidden">
            <div className="h-full bg-current transition-[width] duration-500" style={{ width: `${(t.avg / top) * 100}%` }} />
          </div>
          <div className="mt-1 text-xs font-bold">{t.size} player{t.size === 1 ? "" : "s"} · {t.total} total</div>
        </div>
      ))}
    </div>
  );
}
