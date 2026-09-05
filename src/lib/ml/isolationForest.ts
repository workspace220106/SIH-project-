import { mulberry32, type Rand } from '@/lib/rng'

/**
 * Isolation Forest (Liu, Ting & Zhou, 2008).
 *
 * Unsupervised, because a capture has no labels for a classifier to train on.
 * Anomalies are few and different, so random splits isolate them in fewer
 * steps than normal points. The score is average path length to isolation,
 * normalised by sample size.
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
  /** Number of trees. More trees, less variance. */
  trees?: number
  /** Rows drawn per tree. 256 is the paper's default. */
  sampleSize?: number
  seed?: number
}

/** Euler-Mascheroni constant, for the harmonic approximation. */
const EULER = 0.5772156649015329

/** Average path length of an unsuccessful BST search. Normalises the score. */
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

  /** Fixed seed, so the same capture gives the same model. */
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

  /** Score in [0,1]. Above 0.5 means isolated faster than typical. */
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
