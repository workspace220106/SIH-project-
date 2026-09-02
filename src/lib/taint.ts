import type { Transaction } from '@/types'

/**
 * Risk propagation from seed wallets.
 *
 * The problem statement asks for scores that "propagate from seed illicit
 * wallets", which is a different claim from scoring each wallet on its own
 * features: it says a wallet is interesting *because of what reached it*, not
 * only because of how it behaves.
 *
 * This is value-weighted taint diffusion along the flow graph. A seed starts
 * at 1.0. At each transaction the taint on an input is divided across the
 * outputs in proportion to the value each received, and multiplied by a
 * per-hop decay. A wallet's taint is the largest amount that reached it by any
 * path, which keeps the number interpretable — it is the strongest single
 * chain of custody, not a sum over coincidences.
 *
 * Proportional splitting matters. Without it, a seed sending 0.001 BTC to an
 * exchange with millions of unrelated outputs would paint the whole exchange.
 */

export interface TaintOptions {
  /** Multiplier applied at every hop. Below 1, so distance always weakens. */
  decay?: number
  /** Stop after this many hops; taint below the floor stops anyway. */
  maxHops?: number
  /** Taint below this is treated as noise and not propagated. */
  floor?: number
}

export interface TaintResult {
  /** 0–1, the strongest chain reaching this wallet. */
  value: number
  /** Hops from the nearest contributing seed. */
  hops: number
  /** The seed the strongest path came from. */
  seed: string
}

export function propagateTaint(
  transactions: Transaction[],
  seeds: string[],
  options: TaintOptions = {},
): Map<string, TaintResult> {
  const decay = options.decay ?? 0.6
  const maxHops = options.maxHops ?? 5
  const floor = options.floor ?? 0.02

  const result = new Map<string, TaintResult>()
  if (!seeds.length) return result

  // Transactions a wallet spends from, in time order, so taint only ever moves
  // forward: value cannot be tainted by something that happened after it.
  const spends = new Map<string, Transaction[]>()
  for (const t of transactions) {
    for (const side of t.inputs) {
      const list = spends.get(side.wallet)
      if (list) list.push(t)
      else spends.set(side.wallet, [t])
    }
  }

  for (const seed of seeds) {
    // Breadth-first, one hop at a time, keeping the best value per wallet.
    let frontier = new Map<string, { value: number; since: number }>([
      [seed, { value: 1, since: -Infinity }],
    ])
    const bestForSeed = new Map<string, { value: number; hops: number }>([
      [seed, { value: 1, hops: 0 }],
    ])

    for (let hop = 1; hop <= maxHops && frontier.size; hop++) {
      const next = new Map<string, { value: number; since: number }>()

      for (const [wallet, carried] of frontier) {
        for (const tx of spends.get(wallet) ?? []) {
          if (tx.timestamp < carried.since) continue
          const total = tx.outputs.reduce((a, o) => a + o.amount, 0)
          if (total <= 0) continue

          for (const out of tx.outputs) {
            if (out.wallet === wallet) continue // change back to self
            const share = out.amount / total
            const value = carried.value * share * decay
            if (value < floor) continue

            const seen = bestForSeed.get(out.wallet)
            if (seen && seen.value >= value) continue
            bestForSeed.set(out.wallet, { value, hops: hop })
            const queued = next.get(out.wallet)
            if (!queued || queued.value < value) {
              next.set(out.wallet, { value, since: tx.timestamp })
            }
          }
        }
      }
      frontier = next
    }

    // Keep the strongest chain across all seeds.
    for (const [wallet, hit] of bestForSeed) {
      if (wallet === seed) continue
      const existing = result.get(wallet)
      if (!existing || existing.value < hit.value) {
        result.set(wallet, { value: hit.value, hops: hit.hops, seed })
      }
    }
  }

  // A seed is definitionally tainted, and says so rather than inheriting.
  for (const seed of seeds) {
    result.set(seed, { value: 1, hops: 0, seed })
  }

  return result
}
