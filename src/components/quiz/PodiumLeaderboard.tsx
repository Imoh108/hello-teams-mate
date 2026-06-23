import { motion, AnimatePresence } from "framer-motion";
import { Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LbRow = {
  user_id: string;
  display_name: string;
  score: number;
  streak?: number;
};

type Props = {
  rows: LbRow[];
  highlightUserId?: string | null;
  max?: number;
};

const PODIUM_BG = ["bg-kahoot-yellow text-kahoot-yellow-foreground", "bg-kahoot-blue text-kahoot-blue-foreground", "bg-kahoot-red text-kahoot-red-foreground"];

export function PodiumLeaderboard({ rows, highlightUserId, max = 10 }: Props) {
  const sorted = [...rows].sort((a, b) => b.score - a.score).slice(0, max);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="space-y-4 w-full min-w-0">
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 items-end">
          {[1, 0, 2].map((i) => {
            const p = top3[i];
            if (!p) return <div key={i} />;
            const heights = ["h-14 sm:h-20", "h-20 sm:h-28", "h-10 sm:h-16"];
            return (
              <motion.div
                key={p.user_id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("kahoot-radius kahoot-shadow-sm border-4 border-black/10 p-2 sm:p-3 text-center min-w-0", PODIUM_BG[i])}
              >
                {i === 0 && <Crown className="size-4 sm:size-5 mx-auto fill-current" />}
                <div className="font-display font-black text-xs sm:text-sm truncate">{p.display_name}</div>
                <div className="font-display font-black text-base sm:text-xl tabular-nums">{p.score}</div>
                <div className={cn("mt-2 mx-auto rounded-md bg-black/15", heights[i])} />
                <div className="font-display font-black text-[10px] sm:text-xs mt-1">#{i + 1}</div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {rest.map((p, idx) => {
            const rank = idx + 4;
            const me = p.user_id === highlightUserId;
            return (
              <motion.li
                key={p.user_id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className={cn(
                  "flex items-center justify-between rounded-2xl border-2 px-3 py-2 text-sm font-display font-bold",
                  me ? "border-primary bg-primary/15" : "border-border bg-surface"
                )}
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono-tab text-muted-foreground w-6 shrink-0">{rank}</span>
                  <span className="truncate min-w-0">{p.display_name}</span>
                  {(p.streak ?? 0) >= 2 && <Flame className="size-4 text-kahoot-yellow fill-current shrink-0" />}
                </span>
                <span className="font-mono-tab shrink-0 ml-2">{p.score}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
