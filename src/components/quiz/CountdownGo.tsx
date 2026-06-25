import { useEffect, useState } from "react";

export function CountdownGo({ onDone }: { onDone?: () => void }) {
  const [n, setN] = useState(2);
  useEffect(() => {
    if (n <= 0) {
      const t = setTimeout(() => onDone?.(), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((x) => x - 1), 400);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-30 grid place-items-center">
      <div
        key={n}
        className="font-display font-black text-6xl sm:text-7xl text-primary animate-kahoot-pop tabular-nums drop-shadow-lg"
      >
        {n > 0 ? n : "GO!"}
      </div>
    </div>
  );
}
