import { mulberry32 } from '@/lib/rng'

/**
 * Deterministic 3D force layout.
 *
 * Kept in-repo rather than pulled from a layout library so the solver can be
 * seeded, cluster-aware and budgeted. The graph must settle before first
 * paint without blocking long enough to be felt.
 */

export interface LayoutNode {
  id: string
  cluster: number
  /** Heavier nodes move less and sit closer to their cluster core. */
  mass: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}

export interface LayoutLink {
  source: number
  target: number
  distance: number
  strength: number
}

export interface LayoutOptions {
  iterations?: number
  repulsion?: number
  clusterRadius?: number
  seed?: number
}

/** Cluster centroids on a golden-angle spiral — even coverage, no visible ring. */
export function clusterCentroids(count: number, radius: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    out.push([Math.cos(theta) * r * radius, y * radius * 0.62, Math.sin(theta) * r * radius])
  }
  return out
}

export function runLayout(
  nodes: LayoutNode[],
  links: LayoutLink[],
  options: LayoutOptions = {},
): void {
  const iterations = options.iterations ?? 240
  const repulsion = options.repulsion ?? 140
  const clusterRadius = options.clusterRadius ?? 78
  const rand = mulberry32(options.seed ?? 7)

  const clusterCount = nodes.reduce((m, n) => Math.max(m, n.cluster), 0) + 1
  const centroids = clusterCentroids(clusterCount, clusterRadius)

  // Seed positions inside the owning cluster so the solver starts near-sane.
  nodes.forEach((n) => {
    const c = centroids[n.cluster] ?? [0, 0, 0]
    const spread = 16 + rand() * 12
    n.x = c[0] + (rand() - 0.5) * spread
    n.y = c[1] + (rand() - 0.5) * spread
    n.z = c[2] + (rand() - 0.5) * spread
    n.vx = n.vy = n.vz = 0
  })

  const n = nodes.length
  let alpha = 1

  for (let iter = 0; iter < iterations; iter++) {
    alpha = 1 - iter / iterations
    const a = alpha * alpha * 0.9 + 0.02

    // --- repulsion (all pairs; the graph is bounded by design) ----------
    for (let i = 0; i < n; i++) {
      const a1 = nodes[i]
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j]
        let dx = b.x - a1.x
        let dy = b.y - a1.y
        let dz = b.z - a1.z
        let d2 = dx * dx + dy * dy + dz * dz
        if (d2 < 0.0001) {
          dx = (rand() - 0.5) * 0.1
          dy = (rand() - 0.5) * 0.1
          dz = (rand() - 0.5) * 0.1
          d2 = 0.03
        }
        if (d2 > 22000) continue // far field contributes nothing visible
        const inv = repulsion / (d2 * Math.sqrt(d2))
        const fx = dx * inv
        const fy = dy * inv
        const fz = dz * inv
        a1.vx -= (fx * a) / a1.mass
        a1.vy -= (fy * a) / a1.mass
        a1.vz -= (fz * a) / a1.mass
        b.vx += (fx * a) / b.mass
        b.vy += (fy * a) / b.mass
        b.vz += (fz * a) / b.mass
      }
    }

    // --- springs --------------------------------------------------------
    for (const l of links) {
      const s = nodes[l.source]
      const t = nodes[l.target]
      const dx = t.x - s.x
      const dy = t.y - s.y
      const dz = t.z - s.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001
      const f = ((dist - l.distance) / dist) * l.strength * a
      const sx = dx * f
      const sy = dy * f
      const sz = dz * f
      s.vx += sx / s.mass
      s.vy += sy / s.mass
      s.vz += sz / s.mass
      t.vx -= sx / t.mass
      t.vy -= sy / t.mass
      t.vz -= sz / t.mass
    }

    // --- cluster cohesion + global centering ----------------------------
    for (const node of nodes) {
      const c = centroids[node.cluster] ?? [0, 0, 0]
      node.vx += (c[0] - node.x) * 0.026 * a
      node.vy += (c[1] - node.y) * 0.026 * a
      node.vz += (c[2] - node.z) * 0.026 * a
      node.vx += -node.x * 0.0035 * a
      node.vy += -node.y * 0.0055 * a
      node.vz += -node.z * 0.0035 * a
    }

    // --- integrate with velocity decay ----------------------------------
    for (const node of nodes) {
      node.vx *= 0.62
      node.vy *= 0.62
      node.vz *= 0.62
      node.x += node.vx
      node.y += node.vy
      node.z += node.vz
    }
  }
}
