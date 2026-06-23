// Deterministic shuffle for option order per player+question.
// Returns permutation: permuted[i] = original index that goes to position i.
export function permutationFor(seed: string, n: number): number[] {
  // simple xorshift32 seeded by a hash of the string
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 0xffffffff;
  };
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Kahoot-style scoring: correct answers earn 1000 at t=0,
// ticking linearly down to 500 at the buzzer. Wrong = 0.
export function computePoints(isCorrect: boolean, elapsedMs: number, limitS: number): number {
  if (!isCorrect) return 0;
  const limitMs = Math.max(1, limitS * 1000);
  const t = Math.min(1, Math.max(0, elapsedMs / limitMs));
  return Math.round(1000 - 500 * t);
}

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
