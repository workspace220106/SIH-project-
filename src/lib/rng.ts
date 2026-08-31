/** Deterministic PRNG — the demo dataset must be identical on every machine. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number

export const pick = <T,>(r: Rand, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)]
export const between = (r: Rand, lo: number, hi: number) => lo + r() * (hi - lo)
export const intBetween = (r: Rand, lo: number, hi: number) => Math.floor(between(r, lo, hi + 1))
/** Gaussian-ish, clamped. Keeps synthetic amounts from looking uniformly random. */
export const gauss = (r: Rand, mean: number, sd: number) => {
  const u = Math.max(1e-9, r())
  const v = r()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const HEX = '0123456789abcdef'
export const hex = (r: Rand, n: number) => {
  let s = ''
  for (let i = 0; i < n; i++) s += HEX[Math.floor(r() * 16)]
  return s
}

const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
export const bech32Tail = (r: Rand, n: number) => {
  let s = ''
  for (let i = 0; i < n; i++) s += B32[Math.floor(r() * 32)]
  return s
}
