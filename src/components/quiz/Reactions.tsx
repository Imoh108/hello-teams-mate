import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, VolumeX } from "lucide-react";
import { isMuted, setMuted } from "@/lib/sfx";

export const REACTIONS = ["🔥", "❤️", "😱", "🤯", "👏", "😂"] as const;

type Floater = { id: number; emoji: string; left: number };

/** Shared realtime channel for live emoji reactions in a session. */
export function useReactionChannel(sessionId: string, onReaction?: (emoji: string) => void) {
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cb = useRef(onReaction);
  cb.current = onReaction;
  useEffect(() => {
    const ch = supabase.channel(`reactions-${sessionId}`, { config: { broadcast: { self: true } } });
    ch.on("broadcast", { event: "react" }, (p) => cb.current?.((p.payload as any)?.emoji)).subscribe();
    chRef.current = ch;
    return () => { supabase.removeChannel(ch); chRef.current = null; };
  }, [sessionId]);
  return (emoji: string) => {
    if (!REACTIONS.includes(emoji as any)) return;
    void chRef.current?.send({ type: "broadcast", event: "react", payload: { emoji } });
  };
}

/** Floating emoji layer — renders reactions drifting up the screen. */
export function ReactionLayer({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<Floater[]>([]);
  const idRef = useRef(0);
  useReactionChannel(sessionId, (emoji) => {
    if (!emoji) return;
    const id = ++idRef.current;
    setItems((s) => [...s.slice(-40), { id, emoji, left: 5 + Math.random() * 90 }]);
    setTimeout(() => setItems((s) => s.filter((f) => f.id !== id)), 3000);
  });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-40">
      {items.map((f) => (
        <span key={f.id} className="absolute bottom-0 text-4xl animate-float-up" style={{ left: `${f.left}%` }}>{f.emoji}</span>
      ))}
    </div>
  );
}

/** Bar of reaction buttons for players. */
export function ReactionBar({ sessionId }: { sessionId: string }) {
  const send = useReactionChannel(sessionId);
  const last = useRef(0);
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`React ${e}`}
          onClick={() => { const n = Date.now(); if (n - last.current < 300) return; last.current = n; send(e); }}
          className="text-2xl rounded-full bg-card border-2 border-border size-11 grid place-items-center active:scale-90 transition-transform"
        >{e}</button>
      ))}
    </div>
  );
}

export function MuteToggle() {
  const [m, setM] = useState(false);
  useEffect(() => setM(isMuted()), []);
  return (
    <button
      type="button"
      onClick={() => { setMuted(!m); setM(!m); }}
      aria-label={m ? "Unmute sounds" : "Mute sounds"}
      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
    >{m ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>
  );
}
