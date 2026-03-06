/**
 * Stateless mulberry32 PRNG.
 * Returns a float in [0, 1) and the next seed value.
 * Pass nextSeed back in for the next call to get a reproducible sequence.
 *
 * Debug: pass ?seed=<number> in the URL to replay a run deterministically.
 */
export function mulberry32(seed: number): { value: number; nextSeed: number } {
  let s = (seed + 0x6D2B79F5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, nextSeed: s }
}

/**
 * Read seed from ?seed= URL param, or generate a fresh one from Date.now().
 * Call once at startup to initialise GameState.rngSeed.
 */
export function createSeed(): number {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('seed')
    if (param) {
      const parsed = parseInt(param, 10)
      if (!isNaN(parsed)) return parsed >>> 0
    }
  }
  return Date.now() >>> 0
}
