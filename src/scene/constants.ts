import { Color } from 'three'

/** Scene palette — kept in lockstep with the Tailwind tokens by hand. */
export const C = {
  bg: new Color('#08090A'),
  wallet: new Color('#98A2AA'),
  transaction: new Color('#4C555C'),
  ip: new Color('#6C7E8C'),
  accent: new Color('#E3BE5C'),
  accentDim: new Color('#8A7233'),
  edge: new Color('#232A2F'),
  edgeNetwork: new Color('#1C242A'),
  edgeSuspicious: new Color('#5E4A24'),
  edgeTraced: new Color('#E3BE5C'),
  riskLow: new Color('#52636F'),
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
  wallet: (importance: number) => 0.9 + importance * 1.75,
  transaction: (importance: number) => 0.4 + importance * 0.55,
  ip: () => 0.86,
}

export const ALPHA = {
  hidden: 0,
  dim: 0.1,
  ambient: 0.46,
  near: 0.72,
  focus: 0.95,
  primary: 1,
}
