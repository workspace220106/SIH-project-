import { Color } from 'three'

/** Scene palette — kept in lockstep with the Tailwind tokens by hand. */
export const C = {
  bg: new Color('#FBFBFF'),
  wallet: new Color('#2B59C3'),
  transaction: new Color('#4A6D88'),
  ip: new Color('#01BAEF'),
  accent: new Color('#2B59C3'),
  accentDim: new Color('#01BAEF'),
  edge: new Color('#C4D5E2'),
  edgeNetwork: new Color('#D8E5EF'),
  edgeSuspicious: new Color('#C85A32'),
  edgeTraced: new Color('#2B59C3'),
  riskLow: new Color('#6E8896'),
  riskMod: new Color('#B3873F'),
  riskHigh: new Color('#C85A32'),
  riskCrit: new Color('#D8402A'),
}

/** Warm tint only starts here — most of the field must stay neutral. */
export const RISK_FLOOR = 68

const tmp = new Color()

export function riskColor(risk: number): Color {
  if (risk < RISK_FLOOR) return C.wallet
  if (risk < 78) return tmp.copy(C.wallet).lerp(C.riskMod, (risk - RISK_FLOOR) / 10)
  if (risk < 90) return tmp.copy(C.riskMod).lerp(C.riskHigh, (risk - 78) / 12)
  return tmp.copy(C.riskHigh).lerp(C.riskCrit, Math.min(1, (risk - 90) / 10))
}

/** Fading is done by mixing toward the background, so instancing stays cheap. */
export function fade(target: Color, source: Color, alpha: number): Color {
  return target.copy(C.bg).lerp(source, Math.max(0, Math.min(1, alpha)))
}

export const NODE_SCALE = {
  wallet: (importance: number) => 1.5 + importance * 2.2,
  transaction: (importance: number) => 0.75 + importance * 0.85,
  ip: () => 1.35,
}

export const ALPHA = {
  hidden: 0,
  dim: 0.35,
  ambient: 0.75,
  near: 0.9,
  focus: 1,
  primary: 1,
}
