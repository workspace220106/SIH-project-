import type { PatternId } from '@/types'

export interface PatternDefinition {
  id: PatternId
  name: string
  shortName: string
  shape: string
  formula: string
  description: string
  /** What an analyst should do about it, in one line. */
  disposition: string
}

export const PATTERN_DEFS: Record<PatternId, PatternDefinition> = {
  FAN_IN: {
    id: 'FAN_IN',
    name: 'Fan-In',
    shortName: 'FAN-IN',
    shape: 'MANY → ONE',
    formula: 'in-degree(w, Δt) ≥ 12  ∧  distinct_sources ≥ 10',
    description:
      'Value from many independent wallets consolidates into a single address inside a short window. Typical of collection points ahead of an off-ramp.',
    disposition: 'Identify the collector, then look one hop further for the exit.',
  },
  FAN_OUT: {
    id: 'FAN_OUT',
    name: 'Fan-Out',
    shortName: 'FAN-OUT',
    shape: 'ONE → MANY',
    formula: 'out-degree(w, Δt) ≥ 12  ∧  σ(amount) / μ(amount) < 0.45',
    description:
      'A single wallet disperses to many destinations with near-uniform amounts. Uniformity is the tell — human spending is not uniform.',
    disposition: 'Treat the source as the subject; the destinations are the map.',
  },
  RAPID_MOVEMENT: {
    id: 'RAPID_MOVEMENT',
    name: 'Rapid Movement',
    shortName: 'RAPID',
    shape: 'SHORT DWELL',
    formula: 'median(t_out − t_in) < 120s across ≥ 3 consecutive wallets',
    description:
      'Funds arrive and leave again before a human could reasonably act. Indicates automation and an intent to break time-based correlation.',
    disposition: 'Follow the relay end-to-end; the terminus is what matters.',
  },
  BURST_ACTIVITY: {
    id: 'BURST_ACTIVITY',
    name: 'Burst Activity',
    shortName: 'BURST',
    shape: 'HIGH FREQUENCY',
    formula: 'rate(Δt=600s) > 8 × baseline_rate(cluster)',
    description:
      'Transaction frequency inside a cluster spikes far above its own baseline. Read the burst window, not the raw count.',
    disposition: 'Bound the window, then enumerate every wallet active inside it.',
  },
  PEELING: {
    id: 'PEELING',
    name: 'Peeling / Multi-Hop',
    shortName: 'PEELING',
    shape: 'A → B → C → D',
    formula: 'chain_len ≥ 4  ∧  0.10 < peel_ratio < 0.40 per hop',
    description:
      'A large balance walks a chain, shedding a small fraction at each hop while the remainder moves on. Each peel is a candidate cash-out.',
    disposition: 'Trace forward to the terminus and backward to the origin deposit.',
  },
}

export const PATTERN_ORDER: PatternId[] = [
  'FAN_OUT',
  'FAN_IN',
  'RAPID_MOVEMENT',
  'BURST_ACTIVITY',
  'PEELING',
]
