import { cn } from "@/lib/utils";

type Props = {
  remaining: number;
  limit: number;
  size?: number;
  className?: string;
};

export function CircularTimer({ remaining, limit, size = 88, className }: Props) {
  const pct = Math.max(0, Math.min(1, remaining / Math.max(1, limit)));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const seconds = Math.max(0, remaining);
  const tone =
    seconds <= 2 ? "stroke-kahoot-red text-kahoot-red"
    : seconds <= 5 ? "stroke-kahoot-yellow text-kahoot-yellow"
    : "stroke-kahoot-green text-kahoot-green";

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-white/10" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={stroke} strokeLinecap="round" fill="none"
          className={cn("transition-[stroke-dashoffset,stroke] duration-200 ease-linear", tone)}
          strokeDasharray={c}
          strokeDashoffset={c - dash}
        />
      </svg>
      <span className={cn("absolute font-display font-black tabular-nums", tone)} style={{ fontSize: size * 0.36 }}>
        {Math.ceil(seconds)}
      </span>
    </div>
  );
}
