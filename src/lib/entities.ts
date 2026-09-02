import type { Transaction, Wallet } from '@/types'

/**
 * Common-input-ownership clustering.
 *
 * The oldest and most reliable heuristic in Bitcoin analysis: to spend from
 * several addresses in one transaction you must hold the private key for all
 * of them, so addresses appearing together as *inputs* are almost certainly
 * controlled by one entity.
 *
 * The word "inputs" is doing the work. Unioning inputs with outputs as well
 * would just trace who-paid-whom and collapse the whole capture into a single
 * component — a different and far weaker claim, since paying someone is no
 * evidence of controlling their wallet.
 */

export interface EntityGroup {
  id: string
  walletIds: string[]
  /** Transactions whose input set produced the merge, as the supporting evidence. */
  evidenceTxIds: string[]
}

/**
 * Does this transaction look like a CoinJoin?
 *
 * It matters here because CoinJoin is the standard counter to the co-spend
 * heuristic: its inputs come from *different* parties who have deliberately
 * combined a spend. Treating those inputs as one owner is exactly the wrong
 * conclusion, so these transactions are excluded from the merge.
 */
export function looksLikeCoinJoin(tx: Transaction): boolean {
  if (tx.inputs.length < 3 || tx.outputs.length < 3) return false
  const amounts = tx.outputs.map((o) => o.amount)
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length
  if (mean <= 0) return false
  const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length)
  return sd / mean < 0.1
}

export interface OwnershipClustering {
  /** walletId → entity id */
  entityOf: Map<string, string>
  groups: Map<string, EntityGroup>
  /** Groups holding more than one address — the ones that say something. */
  merged: EntityGroup[]
  /** Transactions skipped because they looked like a CoinJoin. */
  excludedTxIds: string[]
}

export function commonInputOwnership(
  wallets: Wallet[],
  transactions: Transaction[],
): OwnershipClustering {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = parent.get(x) ?? x
    if (root !== x) {
      root = find(root)
      parent.set(x, root)
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  wallets.forEach((w) => parent.set(w.id, w.id))

  // Only co-spending merges addresses, and only outside a CoinJoin.
  const evidence = new Map<string, string[]>()
  const excludedTxIds: string[] = []
  for (const tx of transactions) {
    if (looksLikeCoinJoin(tx)) {
      excludedTxIds.push(tx.id)
      continue
    }
    const inputs = tx.inputs.map((s) => s.wallet)
    if (inputs.length < 2) continue
    for (let i = 1; i < inputs.length; i++) union(inputs[0], inputs[i])
    for (const id of inputs) {
      const list = evidence.get(id) ?? []
      list.push(tx.id)
      evidence.set(id, list)
    }
  }

  const byRoot = new Map<string, string[]>()
  for (const w of wallets) {
    const root = find(w.id)
    const list = byRoot.get(root) ?? []
    list.push(w.id)
    byRoot.set(root, list)
  }

  const entityOf = new Map<string, string>()
  const groups = new Map<string, EntityGroup>()
  let index = 0
  // Largest first, so entity numbering is stable and meaningful.
  for (const [, walletIds] of [...byRoot.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const id = 'E' + (index++).toString().padStart(3, '0')
    const evidenceTxIds = [...new Set(walletIds.flatMap((w) => evidence.get(w) ?? []))]
    groups.set(id, { id, walletIds, evidenceTxIds })
    walletIds.forEach((w) => entityOf.set(w, id))
  }

  return {
    entityOf,
    groups,
    excludedTxIds,
    merged: [...groups.values()]
      .filter((g) => g.walletIds.length > 1)
      .sort((a, b) => b.walletIds.length - a.walletIds.length),
  }
}
