// Zero-asset sound effects via Web Audio + haptics.
let ctx: AudioContext | null = null;
const KEY = "qp-muted";

export const isMuted = () => typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
export const setMuted = (m: boolean) => localStorage.setItem(KEY, m ? "1" : "0");

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", delay = 0, vol = 0.15) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + delay;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

export function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export const sfx = {
  tick: () => { if (!isMuted()) tone(880, 0.05, "square", 0, 0.05); },
  tap: () => { vibrate(20); if (!isMuted()) tone(520, 0.06, "triangle"); },
  correct: () => { vibrate([30, 40, 30]); if (!isMuted()) { tone(660, 0.12); tone(990, 0.25, "sine", 0.1); } },
  wrong: () => { vibrate(200); if (!isMuted()) tone(140, 0.35, "sawtooth", 0, 0.12); },
  start: () => { if (!isMuted()) [523, 659, 784].forEach((f, i) => tone(f, 0.15, "triangle", i * 0.1)); },
  fanfare: () => {
    if (isMuted()) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", i * 0.14, 0.12));
  },
};
