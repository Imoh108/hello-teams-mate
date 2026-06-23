import { Check, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isCorrect: boolean;
  points: number;
  streak?: number;
};

export function FeedbackOverlay({ isCorrect, points, streak = 0 }: Props) {
  return (
    <div className={cn(
      "fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 px-6 animate-kahoot-pop",
      isCorrect ? "bg-kahoot-green text-kahoot-green-foreground" : "bg-kahoot-red text-kahoot-red-foreground",
    )}>
      <div className="kahoot-radius bg-white/15 p-6 kahoot-shadow border-4 border-white/30">
        {isCorrect ? <Check className="size-20" strokeWidth={4} /> : <X className="size-20" strokeWidth={4} />}
      </div>
      <h2 className="font-display text-5xl sm:text-6xl font-black tracking-tight text-center">
        {isCorrect ? "Correct!" : "Incorrect"}
      </h2>
      {isCorrect && (
        <div className="font-display text-3xl sm:text-4xl font-black tabular-nums">+{points}</div>
      )}
      {isCorrect && streak >= 2 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border-2 border-white/30 font-display font-bold">
          <Flame className="size-5 fill-current" /> {streak} in a row
        </div>
      )}
    </div>
  );
}
