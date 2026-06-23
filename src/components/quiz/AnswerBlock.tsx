import { Triangle, Diamond, Circle, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export const KAHOOT_COLORS = [
  { bg: "bg-kahoot-red", text: "text-kahoot-red-foreground", ring: "ring-kahoot-red", icon: Triangle, label: "Triangle" },
  { bg: "bg-kahoot-blue", text: "text-kahoot-blue-foreground", ring: "ring-kahoot-blue", icon: Diamond, label: "Diamond" },
  { bg: "bg-kahoot-yellow", text: "text-kahoot-yellow-foreground", ring: "ring-kahoot-yellow", icon: Circle, label: "Circle" },
  { bg: "bg-kahoot-green", text: "text-kahoot-green-foreground", ring: "ring-kahoot-green", icon: Square, label: "Square" },
] as const;

type Props = {
  displayIndex: 0 | 1 | 2 | 3;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  state?: "idle" | "picked" | "correct" | "wrong";
  showLabel?: boolean;
  className?: string;
};

export function AnswerBlock({ displayIndex, label, onClick, disabled, state = "idle", showLabel = true, className }: Props) {
  const c = KAHOOT_COLORS[displayIndex];
  const Icon = c.icon;
  const isCorrect = state === "correct";
  const isWrong = state === "wrong";
  const dimmed = disabled && state === "idle";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={c.label}
      className={cn(
        "group relative w-full h-full min-h-[88px] sm:min-h-[140px] kahoot-radius kahoot-shadow",
        "flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 text-left font-display font-bold",
        "border-4 border-black/10 transition-transform duration-150",
        "active:translate-y-1 active:[box-shadow:0_2px_0_0_oklch(0_0_0/0.35)]",
        !disabled && "hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer",
        c.bg, c.text,
        state === "picked" && "ring-4 ring-offset-2 ring-offset-background ring-white",
        isCorrect && "ring-4 ring-offset-2 ring-offset-background ring-white animate-kahoot-pop",
        isWrong && "animate-kahoot-shake",
        dimmed && "opacity-40 saturate-50",
        className,
      )}
    >
      <Icon className="size-8 sm:size-10 shrink-0 fill-current" strokeWidth={2.5} />
      {showLabel && label && (
        <span className="text-lg sm:text-2xl leading-tight break-words">{label}</span>
      )}
    </button>
  );
}
