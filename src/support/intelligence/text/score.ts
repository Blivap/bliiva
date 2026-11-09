export function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

/** Explainable combination: each matching signal reduces the remaining doubt. */
export function noisyOr(parts: number[]): number {
  let miss = 1;
  for (const part of parts) {
    const bounded = Math.min(0.95, Math.max(0, part));
    miss *= 1 - bounded;
  }
  return roundScore(1 - miss);
}
