import { useEffect, useState } from "react";

export function CountdownGo({ onDone }: { onDone?: () => void }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n <= 0) { const t = setTimeout(() => onDone?.(), 400); return () => clearTimeout(t); }
    const t = setTimeout(() => setN((x) => x - 1), 700);
    return () => clearTimeout(t);
  }, [n, onDone]);
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-background/80 backdrop-blur-sm">
      <div key={n} className="font-display font-black text-[20vw] sm:text-[12rem] text-primary animate-kahoot-pop tabular-nums">
        {n > 0 ? n : "GO!"}
      </div>
    </div>
  );
}
