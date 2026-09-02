import { mulberry32, type Rand } from '@/lib/rng'

/**
 * Isolation Forest — Liu, Ting & Zhou (2008).
 *
 * An unsupervised anomaly detector, chosen because this problem has no labels:
 * a capture arrives with no ground truth about which wallets are illicit, so a
 * classifier has nothing to train against. Isolation Forest needs none. It
 * exploits the fact that anomalies are *few and different*, and therefore get
 * separated from the rest of the data by fewer random splits than normal
 * points do. The score is the average number of splits needed to isolate a
 * point, normalised against what you would expect by chance.
 *
 * It trains in-process on whatever capture is loaded, in well under a second
 * for the sizes this workstation handles, and never touches the network.
 */

interface ExternalNode {
  kind: 'leaf'
  size: number
}

interface InternalNode {
  kind: 'split'
  feature: number
  threshold: number
  left: TreeNode
  right: TreeNode
}

type TreeNode = ExternalNode | InternalNode

export interface IsolationForestOptions {
  /** Number of isolation trees. More trees, less variance in the score. */
  trees?: number
  /** Rows drawn per tree. The paper's default of 256 is deliberate: a small
   *  sample makes anomalies easier to isolate, not harder. */
  sampleSize?: number
  seed?: number
}

/** Euler–Mascheroni constant, for the harmonic-number approximation. */
const EULER = 0.5772156649015329

/**
 * Average path length of an unsuccessful search in a binary search tree —
 * the normalising term that makes scores comparable across sample sizes.
 */
function averagePathLength(n: number): number {
  if (n <= 1) return 0
  if (n === 2) return 1
  const harmonic = Math.log(n - 1) + EULER
  return 2 * harmonic - (2 * (n - 1)) / n
}

function buildTree(rows: number[][], depth: number, maxDepth: number, rand: Rand): TreeNode {
  if (depth >= maxDepth || rows.length <= 1) {
    return { kind: 'leaf', size: rows.length }
  }

  const featureCount = rows[0].length
  // Pick a feature that actually varies; a constant column cannot split.
  const candidates: number[] = []
  for (let f = 0; f < featureCount; f++) {
    let min = Infinity
    let max = -Infinity
    for (const row of rows) {
      if (row[f] < min) min = row[f]
      if (row[f] > max) max = row[f]
    }
    if (max > min) candidates.push(f)
  }
  if (!candidates.length) return { kind: 'leaf', size: rows.length }

  const feature = candidates[Math.floor(rand() * candidates.length)]
  let min = Infinity
  let max = -Infinity
  for (const row of rows) {
    if (row[feature] < min) min = row[feature]
    if (row[feature] > max) max = row[feature]
  }
  const threshold = min + rand() * (max - min)

  const left: number[][] = []
  const right: number[][] = []
  for (const row of rows) {
    if (row[feature] < threshold) left.push(row)
    else right.push(row)
  }
  // Degenerate split: everything landed on one side.
  if (!left.length || !right.length) return { kind: 'leaf', size: rows.length }

  return {
    kind: 'split',
    feature,
    threshold,
    left: buildTree(left, depth + 1, maxDepth, rand),
    right: buildTree(right, depth + 1, maxDepth, rand),
  }
}

/** Splits needed to isolate `x`, plus a correction for unsplit leaves. */
function pathLength(node: TreeNode, x: number[], depth: number): number {
  if (node.kind === 'leaf') return depth + averagePathLength(node.size)
  return x[node.feature] < node.threshold
    ? pathLength(node.left, x, depth + 1)
    : pathLength(node.right, x, depth + 1)
}

export class IsolationForest {
  private trees: TreeNode[] = []
  private normaliser = 1
  readonly treeCount: number
  readonly sampleSize: number
  private seed: number

  constructor(options: IsolationForestOptions = {}) {
    this.treeCount = options.trees ?? 120
    this.sampleSize = options.sampleSize ?? 256
    this.seed = options.seed ?? 26146
  }

  /** Deterministic: the same capture always produces the same model. */
  fit(data: number[][]): this {
    if (!data.length) return this
    const rand = mulberry32(this.seed)
    const n = Math.min(this.sampleSize, data.length)
    const maxDepth = Math.ceil(Math.log2(Math.max(2, n)))
    this.normaliser = averagePathLength(n)
    this.trees = []

    for (let t = 0; t < this.treeCount; t++) {
      // Sample without replacement, so a tree never sees a row twice.
      const pool = data.slice()
      const sample: number[][] = []
      for (let i = 0; i < n; i++) {
        const j = Math.floor(rand() * pool.length)
        sample.push(pool[j])
        pool[j] = pool[pool.length - 1]
        pool.pop()
      }
      this.trees.push(buildTree(sample, 0, maxDepth, rand))
    }
    return this
  }

  /**
   * Anomaly score in [0, 1]. Above 0.5 means the point was isolated faster
   * than a typical point — the further above, the more anomalous.
   */
  score(x: number[]): number {
    if (!this.trees.length || this.normaliser === 0) return 0
    let total = 0
    for (const tree of this.trees) total += pathLength(tree, x, 0)
    const expected = total / this.trees.length
    return Math.pow(2, -expected / this.normaliser)
  }

  scoreAll(data: number[][]): number[] {
    return data.map((row) => this.score(row))
  }
}
