import type {
  Alert,
  Dataset,
  ClusterSummary,
  Confidence,
  Edge,
  Entity,
  Evidence,
  Lead,
  Priority,
  RiskScore,
  RiskSignal,
  SuspiciousPattern,
  TimelineEvent,
  TracePath,
  Transaction,
  Wallet,
} from '@/types'
import { clusterLabel, generateDataset, type PlantedPattern } from '@/data/synthetic'
import { runLayout, type LayoutLink, type LayoutNode } from '@/lib/layout'
import { PATTERN_DEFS, PATTERN_ORDER } from '@/lib/patterns'

/* ------------------------------------------------------------------ *
 * Small numeric helpers
 * ------------------------------------------------------------------ */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const i = Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))
  return s[i]
}

/** Normalise to 0–100 against a reference ceiling, with a soft knee at the top. */
const norm = (v: number, ceiling: number) => {
  if (ceiling <= 0) return 0
  const t = v / ceiling
  return clamp(t <= 1 ? t * 88 : 88 + Math.min(12, (t - 1) * 14), 0, 100)
}

export const priorityFor = (score: number): Priority =>
  score >= 90 ? 'CRITICAL' : score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW'

export const confidenceBand = (c: number): Confidence =>
  c >= 0.85 ? 'HIGH' : c >= 0.65 ? 'MODERATE' : 'LOW'

/* ------------------------------------------------------------------ *
 * Analysis result
 * ------------------------------------------------------------------ */

export interface GraphIndex {
  entityById: Map<string, Entity>
  edgeById: Map<string, Edge>
  /** entityId → edge ids touching it */
  incident: Map<string, string[]>
  /** entityId → neighbour entity ids */
  neighbours: Map<string, string[]>
  outgoing: Map<string, string[]>
  incoming: Map<string, string[]>
  /** transaction id → every edge on either of its sides */
  edgesByTx: Map<string, string[]>
  txById: Map<string, Transaction>
  walletById: Map<string, Wallet>
}

export interface Analysis {
  dataset: Dataset
  entities: Entity[]
  edges: Edge[]
  clusters: ClusterSummary[]
  patterns: SuspiciousPattern[]
  alerts: Alert[]
  leads: Lead[]
  timeline: TimelineEvent[]
  index: GraphIndex
  /** The wallet the pipeline surfaces first — the demonstration subject. */
  primarySubject: string
}

/* ------------------------------------------------------------------ *
 * Risk model
 * ------------------------------------------------------------------ */

const SIGNAL_WEIGHTS = { transaction: 0.3, graph: 0.28, temporal: 0.22, behaviour: 0.2 } as const

function buildRisk(
  values: { transaction: number; graph: number; temporal: number; behaviour: number },
  detail: Record<keyof typeof values, string>,
  evidenceCount: number,
): RiskScore {
  const signals: RiskSignal[] = (
    [
      ['transaction', 'Transaction', values.transaction],
      ['graph', 'Graph', values.graph],
      ['temporal', 'Temporal', values.temporal],
      ['behaviour', 'Behaviour', values.behaviour],
    ] as const
  ).map(([key, label, value]) => ({
    key,
    label,
    value: Math.round(value),
    weight: SIGNAL_WEIGHTS[key],
    detail: detail[key],
  }))

  const score = Math.round(
    signals.reduce((acc, s) => acc + s.value * s.weight, 0),
  )

  // Confidence rises with corroborating evidence and with how far the
  // dominant signal sits above the others — a single loud signal is weaker
  // than three that agree.
  const vals = signals.map((s) => s.value)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const spread = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
  const agreement = 1 - Math.min(1, spread / 46)
  const confidence = Math.min(
    0.985,
    0.46 + Math.min(4, evidenceCount) * 0.075 + agreement * 0.2 + (score / 100) * 0.09,
  )

  return { score: clamp(score), confidence, priority: priorityFor(score), signals }
}

/* ------------------------------------------------------------------ *
 * Engine
 * ------------------------------------------------------------------ */

export function analyse(seed = 26146): Analysis {
  return assemble(generateDataset(seed), seed)
}

/**
 * Scores, links, lays out and narrates a capture. Identical work whether the
 * capture came from the generator or from a file the analyst dropped in.
 */
export function assemble(dataset: Dataset, seed = 26146): Analysis {
  const { wallets, transactions, ips, planted } = dataset

  const walletById = new Map(wallets.map((w) => [w.id, w]))
  const txById = new Map(transactions.map((t) => [t.id, t]))

  // ---- pattern membership lookups -------------------------------------
  const walletPatterns = new Map<string, PlantedPattern[]>()
  const txPatterns = new Map<string, PlantedPattern[]>()
  for (const p of planted) {
    for (const w of p.walletIds) {
      const list = walletPatterns.get(w) ?? []
      list.push(p)
      walletPatterns.set(w, list)
    }
    for (const t of p.txIds) {
      const list = txPatterns.get(t) ?? []
      list.push(p)
      txPatterns.set(t, list)
    }
  }

  // ---- temporal features ----------------------------------------------
  const walletTimes = new Map<string, number[]>()
  for (const tx of transactions) {
    for (const side of [...tx.inputs, ...tx.outputs]) {
      const arr = walletTimes.get(side.wallet) ?? []
      arr.push(tx.timestamp)
      walletTimes.set(side.wallet, arr)
    }
  }
  const medianGap = new Map<string, number>()
  walletTimes.forEach((times, id) => {
    const sorted = [...times].sort((a, b) => a - b)
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1])
    medianGap.set(id, gaps.length ? percentile(gaps, 0.5) : 9e6)
  })

  // ---- reference ceilings ---------------------------------------------
  const volumes = wallets.map((w) => w.totalIn + w.totalOut)
  const counts = wallets.map((w) => w.txCount)
  const degrees = wallets.map((w) => Math.max(w.degreeIn, w.degreeOut))
  const volCeil = percentile(volumes, 0.94)
  const cntCeil = percentile(counts, 0.94)
  const degCeil = percentile(degrees, 0.94)

  // Cluster prior: how much of a cluster is implicated by any pattern.
  const clusterPattern = new Map<number, PlantedPattern>()
  planted.forEach((p) => {
    const existing = clusterPattern.get(p.cluster)
    if (!existing || p.strength > existing.strength) clusterPattern.set(p.cluster, p)
  })

  // ---- wallet scoring ---------------------------------------------------
  for (const w of wallets) {
    const pats = walletPatterns.get(w.id) ?? []
    const isAnchor = pats.some((p) => p.anchorWallet === w.id)
    const maxStrength = pats.reduce((a, p) => Math.max(a, p.strength), 0)

    const volume = w.totalIn + w.totalOut
    const degree = Math.max(w.degreeIn, w.degreeOut)
    const gap = medianGap.get(w.id) ?? 9e6

    const transaction = clamp(
      norm(volume, volCeil) * 0.5 + norm(w.txCount, cntCeil) * 0.5 + (isAnchor ? 9 : 0),
    )

    const bridge = new Set(
      transactions
        .filter((t) => [...t.inputs, ...t.outputs].some((side) => side.wallet === w.id))
        .flatMap((t) =>
          [...t.inputs, ...t.outputs]
            .filter((side) => side.wallet !== w.id)
            .map((side) => walletById.get(side.wallet)?.cluster ?? -1),
        ),
    ).size
    const graph = clamp(
      norm(degree, degCeil) * 0.62 + Math.min(26, (bridge - 1) * 13) + (isAnchor ? 14 : 0),
    )

    // Sub-2-minute median gaps are the interesting end of the scale.
    const temporal = clamp(
      gap < 9e6 ? 100 - Math.min(96, (Math.log10(Math.max(1000, gap) / 1000) / 2.9) * 100) : 4,
    )

    const behaviour = clamp(
      pats.length === 0 ? 6 + Math.min(16, w.txCount * 0.9) : maxStrength * 86 + (isAnchor ? 8 : 0),
    )

    w.risk = buildRisk(
      { transaction, graph, temporal, behaviour },
      {
        transaction:
          volume.toFixed(2) + ' BTC across ' + w.txCount + ' transactions',
        graph:
          'degree ' + w.degreeIn + ' in / ' + w.degreeOut + ' out, ' + bridge + ' cluster links',
        temporal: 'median inter-transaction gap ' + formatGap(gap),
        behaviour: pats.length
          ? pats.map((p) => PATTERN_DEFS[p.id].shortName).join(' + ')
          : 'no matched pattern',
      },
      pats.length + (bridge > 1 ? 1 : 0),
    )
  }

  /* ---- entities ------------------------------------------------------ */

  const entities: Entity[] = []
  const edges: Edge[] = []

  const degCeilAll = Math.max(1, percentile(degrees, 0.97))

  for (const w of wallets) {
    entities.push({
      id: w.id,
      kind: 'wallet',
      label: w.address,
      risk: w.risk.score,
      cluster: w.cluster,
      x: 0,
      y: 0,
      z: 0,
      importance: clamp(norm(Math.max(w.degreeIn, w.degreeOut), degCeilAll) / 100, 0, 1),
      timestamp: w.firstSeen,
      meta: {
        address: w.address,
        transactions: w.txCount,
        received: Number(w.totalIn.toFixed(4)),
        sent: Number(w.totalOut.toFixed(4)),
        degreeIn: w.degreeIn,
        degreeOut: w.degreeOut,
        cluster: clusterLabel(w.cluster),
      },
    })
  }

  const amountCeil = percentile(transactions.map((t) => t.amount), 0.95)
  const ipByAddress = new Map(ips.map((i) => [i.address, i]))

  const edgesByTx = new Map<string, string[]>()

  for (const tx of transactions) {
    const parties = [...tx.inputs, ...tx.outputs]
      .map((side) => walletById.get(side.wallet))
      .filter((w): w is Wallet => !!w)
    if (!parties.length) continue
    const primary = walletById.get(tx.inputs[0]?.wallet ?? '') ?? parties[0]
    const pats = txPatterns.get(tx.id) ?? []
    const patIds = pats.map((p) => p.id)
    const risk = clamp(
      Math.max(...parties.map((w) => w.risk.score)) * 0.72 +
        (pats.length ? 22 * pats.reduce((a, p) => Math.max(a, p.strength), 0) : 0),
    )
    const host = ipByAddress.get(tx.srcIp)

    entities.push({
      id: tx.id,
      kind: 'transaction',
      label: shortTxid(tx.txid),
      risk,
      cluster: primary.cluster,
      x: 0,
      y: 0,
      z: 0,
      importance: clamp(norm(tx.amount, amountCeil) / 100, 0, 1),
      timestamp: tx.timestamp,
      amount: tx.amount,
      meta: {
        txid: tx.txid,
        amount: tx.amount,
        fee: tx.fee,
        inputs: tx.inputs.length,
        outputs: tx.outputs.length,
        scriptType: tx.scriptType,
        srcIp: tx.srcIp + ':' + tx.srcPort,
        dstIp: tx.dstIp + ':' + tx.dstPort,
        country: host?.country ?? 'ZZ',
        asn: host?.asn ?? 'AS0',
      },
    })

    // One edge per side, so a fan-out transaction is visibly a fan.
    const txEdges: string[] = []
    tx.inputs.forEach((side, i) => {
      const id = 'e-' + tx.id + '-i' + i
      txEdges.push(id)
      edges.push({
        id,
        source: side.wallet,
        target: tx.id,
        kind: 'flow',
        weight: side.amount,
        amount: side.amount,
        timestamp: tx.timestamp,
        suspicious: pats.length > 0,
        patterns: patIds,
      })
    })
    tx.outputs.forEach((side, i) => {
      const id = 'e-' + tx.id + '-o' + i
      txEdges.push(id)
      edges.push({
        id,
        source: tx.id,
        target: side.wallet,
        kind: 'flow',
        weight: side.amount,
        amount: side.amount,
        timestamp: tx.timestamp,
        suspicious: pats.length > 0,
        patterns: patIds,
      })
    })
    edgesByTx.set(tx.id, txEdges)
  }

  for (const ip of ips) {
    const linked = ip.linkedWallets.map((id) => walletById.get(id)).filter(Boolean) as Wallet[]
    if (!linked.length) continue
    const risk = clamp(Math.max(...linked.map((w) => w.risk.score)) * 0.78)
    const clusterCounts = new Map<number, number>()
    linked.forEach((w) => clusterCounts.set(w.cluster, (clusterCounts.get(w.cluster) ?? 0) + 1))
    const cluster = [...clusterCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    entities.push({
      id: ip.id,
      kind: 'ip',
      label: ip.address + ':' + ip.port,
      risk,
      cluster,
      x: 0,
      y: 0,
      z: 0,
      importance: clamp(linked.length / 8, 0, 1),
      timestamp: ip.firstSeen,
      meta: {
        address: ip.address,
        port: ip.port,
        country: ip.country,
        asn: ip.asn,
        observations: ip.observationCount,
        wallets: linked.length,
      },
    })

    for (const w of linked) {
      edges.push({
        id: 'n-' + ip.id + '-' + w.id,
        source: ip.id,
        target: w.id,
        kind: 'network',
        weight: 1,
        timestamp: ip.firstSeen,
        suspicious: w.risk.score >= 75,
        patterns: (walletPatterns.get(w.id) ?? []).map((p) => p.id),
      })
    }
  }

  /* ---- layout --------------------------------------------------------- */

  const indexOf = new Map<string, number>()
  entities.forEach((e, i) => indexOf.set(e.id, i))

  const layoutNodes: LayoutNode[] = entities.map((e) => ({
    id: e.id,
    cluster: e.cluster,
    mass: e.kind === 'wallet' ? 1.7 + e.importance : e.kind === 'ip' ? 1.35 : 0.72,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
  }))

  const layoutLinks: LayoutLink[] = []
  for (const e of edges) {
    const s = indexOf.get(e.source)
    const t = indexOf.get(e.target)
    if (s === undefined || t === undefined) continue
    layoutLinks.push(
      e.kind === 'network'
        ? { source: s, target: t, distance: 21, strength: 0.14 }
        : { source: s, target: t, distance: 8.5, strength: 0.5 },
    )
  }

  runLayout(layoutNodes, layoutLinks, { iterations: 230, seed: seed })
  layoutNodes.forEach((n, i) => {
    entities[i].x = Number(n.x.toFixed(3))
    entities[i].y = Number(n.y.toFixed(3))
    entities[i].z = Number(n.z.toFixed(3))
  })

  /* ---- index ---------------------------------------------------------- */

  const entityById = new Map(entities.map((e) => [e.id, e]))
  const edgeById = new Map(edges.map((e) => [e.id, e]))
  const incident = new Map<string, string[]>()
  const neighbours = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()
  const incoming = new Map<string, string[]>()
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const a = m.get(k)
    if (a) a.push(v)
    else m.set(k, [v])
  }
  for (const e of edges) {
    push(incident, e.source, e.id)
    push(incident, e.target, e.id)
    push(neighbours, e.source, e.target)
    push(neighbours, e.target, e.source)
    push(outgoing, e.source, e.id)
    push(incoming, e.target, e.id)
  }

  const index: GraphIndex = {
    entityById,
    edgeById,
    incident,
    neighbours,
    outgoing,
    incoming,
    edgesByTx,
    txById,
    walletById,
  }

  /* ---- clusters -------------------------------------------------------- */

  const clusterIds = [...new Set(entities.map((e) => e.cluster))].sort((a, b) => a - b)
  const clusters: ClusterSummary[] = clusterIds.map((id) => {
    const members = entities.filter((e) => e.cluster === id)
    const wl = members.filter((m) => m.kind === 'wallet')
    const centroid: [number, number, number] = [
      members.reduce((a, m) => a + m.x, 0) / members.length,
      members.reduce((a, m) => a + m.y, 0) / members.length,
      members.reduce((a, m) => a + m.z, 0) / members.length,
    ]
    return {
      id,
      label: clusterLabel(id),
      size: members.length,
      risk: Math.round(
        wl.length ? wl.reduce((a, m) => a + m.risk, 0) / wl.length : 0,
      ),
      dominantPattern: clusterPattern.get(id)?.id ?? null,
      centroid,
    }
  })

  /* ---- patterns -------------------------------------------------------- */

  const patterns: SuspiciousPattern[] = planted.map((p) => {
    const def = PATTERN_DEFS[p.id]
    const patternEdges = edges
      .filter((e) => e.patterns.includes(p.id) && e.kind === 'flow')
      .map((e) => e.id)
    return {
      id: p.id,
      name: def.name,
      shortName: def.shortName,
      formula: def.formula,
      description: def.description,
      entities: [...p.walletIds, ...p.txIds],
      edges: patternEdges,
      strength: p.strength,
      detectedAt: p.detectedAt,
    }
  })
  patterns.sort((a, b) => PATTERN_ORDER.indexOf(a.id) - PATTERN_ORDER.indexOf(b.id))

  /* ---- primary subject + evidence --------------------------------------- */

  const primarySubject = [...wallets].sort((a, b) => b.risk.score - a.risk.score)[0].id

  /* ---- alerts ----------------------------------------------------------- */

  // An alert is raised for every wallet a detector actually matched, plus any
  // wallet whose composite crosses the queue threshold on structure alone.
  const alertWallets = wallets
    .filter((w) => (walletPatterns.get(w.id) ?? []).length > 0 || w.risk.score >= 55)
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 34)

  // Which country a wallet's traffic came from is a network-layer fact, so it
  // is resolved from the hosts that carried it rather than from the wallet.
  const countryByWallet = new Map<string, string>()
  for (const ip of ips) {
    for (const w of ip.linkedWallets) {
      if (!countryByWallet.has(w) && ip.country !== 'ZZ') countryByWallet.set(w, ip.country)
    }
  }

  const alerts: Alert[] = alertWallets.map((w, i) => {
    const pats = walletPatterns.get(w.id) ?? []
    const top = pats.sort((a, b) => b.strength - a.strength)[0]
    return {
      id: 'AL-' + (4210 + i * 7).toString(),
      entityId: w.id,
      entityLabel: w.address,
      priority: w.risk.priority,
      risk: w.risk.score,
      pattern: top?.id ?? 'BURST_ACTIVITY',
      country: countryByWallet.get(w.id) ?? 'ZZ',
      timestamp: top?.detectedAt ?? w.lastSeen,
      confidence: w.risk.confidence,
      acknowledged: false,
    }
  })
  alerts.sort((a, b) => b.risk - a.risk)

  /* ---- leads ------------------------------------------------------------ */

  const leadWallets = alertWallets
    .filter((w) => w.risk.score >= 50 && (walletPatterns.get(w.id) ?? []).length > 0)
    .slice(0, 6)

  const leads: Lead[] = leadWallets.map((w, i) => {
    const ev = buildEvidence(w, walletPatterns.get(w.id) ?? [], index)
    const pats = walletPatterns.get(w.id) ?? []
    return {
      id: 'LEAD-' + (47 - i),
      number: 47 - i,
      createdAt: pats[0]?.detectedAt ?? w.lastSeen,
      who: w.address,
      whoKind: 'wallet',
      what: describeWhat(pats),
      why: pats.map((p) => PATTERN_DEFS[p.id].shortName),
      evidence: ev,
      priority: w.risk.priority,
      confidence: w.risk.confidence,
      risk: w.risk.score,
      nextTarget: nextTargetFor(w, index),
      status: i === 0 ? 'OPEN' : i < 3 ? 'ASSIGNED' : 'OPEN',
    }
  })

  /* ---- timeline --------------------------------------------------------- */

  const subject = walletById.get(primarySubject)!
  const timeline = buildTimeline(subject, walletPatterns.get(subject.id) ?? [], index, leads[0])

  return {
    dataset,
    entities,
    edges,
    clusters,
    patterns,
    alerts,
    leads,
    timeline,
    index,
    primarySubject,
  }
}

/* ------------------------------------------------------------------ *
 * Evidence + narrative construction
 * ------------------------------------------------------------------ */

function describeWhat(pats: PlantedPattern[]): string {
  if (pats.some((p) => p.id === 'PEELING')) return 'Multi-hop fund movement with per-hop peeling'
  if (pats.some((p) => p.id === 'FAN_OUT')) return 'Structured dispersion to a destination set'
  if (pats.some((p) => p.id === 'FAN_IN')) return 'Consolidation ahead of a suspected off-ramp'
  if (pats.some((p) => p.id === 'RAPID_MOVEMENT')) return 'Automated relay with sub-minute dwell'
  return 'Anomalous transaction frequency inside a bounded window'
}

export function buildEvidence(
  wallet: Wallet,
  pats: PlantedPattern[],
  index: GraphIndex,
): Evidence[] {
  const ranked = [...pats].sort((a, b) => b.strength - a.strength)
  const items: Evidence[] = ranked.map((p, i) => {
    const def = PATTERN_DEFS[p.id]
    const relatedEdges = p.txIds.flatMap((t) => index.edgesByTx.get(t) ?? [])
    return {
      index: i + 1,
      type: p.id,
      title: def.shortName,
      description: def.description,
      metric: p.metric,
      relatedEntities: [...p.walletIds, ...p.txIds],
      relatedEdges,
      strength: p.strength,
    }
  })

  // Connectivity is always the closing item: it is what ties the rest together.
  const neighbourIds = index.neighbours.get(wallet.id) ?? []
  // Wallet-to-wallet reach is two graph steps, because a transaction sits
  // between every pair. Counting clusters at one step would always return one.
  const walletReach = new Set(
    neighbourIds
      .flatMap((id) => index.neighbours.get(id) ?? [])
      .map((id) => index.entityById.get(id))
      .filter((e): e is Entity => !!e && e.kind === 'wallet' && e.id !== wallet.id)
      .map((e) => e.id),
  )
  const linkedClusters = new Set(
    [...walletReach].map((id) => index.entityById.get(id)!.cluster),
  )
  const highRiskNeighbours = [...walletReach].filter(
    (id) => (index.entityById.get(id)?.risk ?? 0) >= 70,
  ).length

  items.push({
    index: items.length + 1,
    type: 'GRAPH_CONNECTIVITY',
    title: 'GRAPH CONNECTIVITY',
    description:
      'The subject sits on a path between separately-detected clusters. Removing it disconnects the flow, which is what makes it a lead rather than a bystander.',
    metric:
      walletReach.size +
      ' wallets at one hop · ' +
      highRiskNeighbours +
      ' already high-risk · spans ' +
      linkedClusters.size +
      (linkedClusters.size === 1 ? ' cluster' : ' clusters'),
    relatedEntities: [wallet.id, ...neighbourIds.slice(0, 24)],
    relatedEdges: (index.incident.get(wallet.id) ?? []).slice(0, 40),
    strength: Math.min(0.93, 0.34 + linkedClusters.size * 0.11 + highRiskNeighbours * 0.02),
  })

  // The numbering is a ranking, not a list order: strongest contributor first.
  return items
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5)
    .map((e, i) => ({ ...e, index: i + 1 }))
}

function nextTargetFor(wallet: Wallet, index: GraphIndex): string {
  const neighbourIds = index.neighbours.get(wallet.id) ?? []
  const second = neighbourIds
    .flatMap((id) => index.neighbours.get(id) ?? [])
    .map((id) => index.entityById.get(id))
    .filter((e): e is Entity => !!e && e.kind === 'wallet' && e.id !== wallet.id)
    .sort((a, b) => b.risk - a.risk)[0]
  return second ? second.label : 'no onward candidate'
}

function buildTimeline(
  wallet: Wallet,
  pats: PlantedPattern[],
  index: GraphIndex,
  lead: Lead | undefined,
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const ordered = [...pats].sort((a, b) => a.detectedAt - b.detectedAt)

  const firstTxEdge = (index.outgoing.get(wallet.id) ?? [])[0]
  const firstTxId = firstTxEdge ? index.edgeById.get(firstTxEdge)?.target : undefined

  events.push({
    id: 'tl-0',
    timestamp: wallet.firstSeen,
    kind: 'transaction',
    title: 'First observed transaction',
    detail: 'Subject enters the capture window on ' + (index.txById.get(firstTxId ?? '')?.srcIp ?? 'an unresolved host'),
    entityId: firstTxId ?? wallet.id,
  })

  const linkedIp = [...index.entityById.values()].find(
    (e) => e.kind === 'ip' && (index.neighbours.get(e.id) ?? []).includes(wallet.id),
  )
  if (linkedIp) {
    events.push({
      id: 'tl-1',
      timestamp: wallet.firstSeen + 180_000,
      kind: 'link',
      title: 'Host correlation established',
      detail: linkedIp.label + ' links ' + (index.neighbours.get(linkedIp.id) ?? []).length + ' wallets in this set',
      entityId: linkedIp.id,
    })
  }

  ordered.forEach((p, i) => {
    events.push({
      id: 'tl-p' + i,
      timestamp: p.detectedAt,
      kind: 'detection',
      title: PATTERN_DEFS[p.id].shortName + ' detected',
      detail: p.metric,
      entityId: p.anchorWallet,
      risk: Math.round(p.strength * 100),
    })
  })

  events.push({
    id: 'tl-esc',
    timestamp: (ordered[ordered.length - 1]?.detectedAt ?? wallet.lastSeen) + 120_000,
    kind: 'escalation',
    title: 'Risk escalated to ' + wallet.risk.score,
    detail: 'Composite crosses the ' + wallet.risk.priority + ' threshold with ' + Math.round(wallet.risk.confidence * 100) + '% confidence',
    entityId: wallet.id,
    risk: wallet.risk.score,
  })

  if (lead) {
    events.push({
      id: 'tl-lead',
      timestamp: (ordered[ordered.length - 1]?.detectedAt ?? wallet.lastSeen) + 240_000,
      kind: 'lead',
      title: 'Investigative lead ' + lead.id + ' generated',
      detail: lead.what,
      entityId: wallet.id,
      risk: lead.risk,
    })
  }

  return events.sort((a, b) => a.timestamp - b.timestamp)
}

/* ------------------------------------------------------------------ *
 * Traversal
 * ------------------------------------------------------------------ */

/** Entity ids within `hops` graph steps. Wallet→tx→wallet counts as one hop. */
export function neighbourhood(
  index: GraphIndex,
  rootId: string,
  hops: number,
): { entities: Set<string>; edges: Set<string>; depth: Map<string, number> } {
  const entities = new Set<string>([rootId])
  const edgeSet = new Set<string>()
  const depth = new Map<string, number>([[rootId, 0]])
  let frontier = [rootId]
  const steps = hops * 2 // transactions are intermediary nodes

  for (let d = 0; d < steps; d++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const eid of index.incident.get(id) ?? []) {
        const e = index.edgeById.get(eid)!
        edgeSet.add(eid)
        const other = e.source === id ? e.target : e.source
        if (!entities.has(other)) {
          entities.add(other)
          depth.set(other, Math.ceil((d + 1) / 2))
          next.push(other)
        }
      }
    }
    frontier = next
    if (!frontier.length) break
  }
  return { entities, edges: edgeSet, depth }
}

/** Follow value forward or backward from a wallet, greediest branch first. */
export function tracePath(
  index: GraphIndex,
  rootWallet: string,
  direction: 'forward' | 'backward',
  maxHops: number,
): TracePath {
  const hops: TracePath['hops'] = []
  const seen = new Set<string>([rootWallet])
  let current = rootWallet

  for (let i = 0; i < maxHops; i++) {
    const edgeIds =
      direction === 'forward'
        ? (index.outgoing.get(current) ?? [])
        : (index.incoming.get(current) ?? [])

    const reachable = edgeIds
      .map((id) => index.edgeById.get(id)!)
      .filter((e) => e.kind === 'flow')
      .map((e) => index.txById.get(direction === 'forward' ? e.target : e.source))
      .filter((t): t is Transaction => !!t)

    // Follow the largest side that has not been visited: with real input and
    // output arrays the branch to follow is a property of the side, not of the
    // transaction as a whole.
    let best: { tx: Transaction; wallet: string; amount: number; edgeId: string } | null = null
    for (const candidate of reachable) {
      const sides = direction === 'forward' ? candidate.outputs : candidate.inputs
      sides.forEach((side, idx) => {
        if (seen.has(side.wallet)) return
        if (!best || side.amount > best.amount) {
          best = {
            tx: candidate,
            wallet: side.wallet,
            amount: side.amount,
            edgeId: 'e-' + candidate.id + (direction === 'forward' ? '-o' : '-i') + idx,
          }
        }
      })
    }
    if (!best) break

    const chosen: { tx: Transaction; wallet: string; amount: number; edgeId: string } = best
    const tx = chosen.tx
    const nextWallet = chosen.wallet
    hops.push({
      index: i + 1,
      fromEntity: direction === 'forward' ? current : nextWallet,
      toEntity: direction === 'forward' ? nextWallet : current,
      txid: tx.txid,
      amount: chosen.amount,
      timestamp: tx.timestamp,
      edgeId: chosen.edgeId,
    })
    seen.add(nextWallet)
    current = nextWallet
  }

  return {
    rootEntity: rootWallet,
    direction,
    hops,
    totalValue: hops.reduce((a, h) => a + h.amount, 0),
    depth: hops.length,
  }
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export const shortTxid = (txid: string) => txid.slice(0, 4) + '…' + txid.slice(-4)
export const shortAddr = (addr: string) =>
  addr.length > 14 ? addr.slice(0, 6) + '…' + addr.slice(-4) : addr

export function formatGap(ms: number): string {
  if (ms >= 8.9e6) return 'n/a'
  if (ms < 1000) return Math.round(ms) + 'ms'
  if (ms < 60_000) return (ms / 1000).toFixed(0) + 's'
  if (ms < 3_600_000) return (ms / 60_000).toFixed(1) + 'm'
  return (ms / 3_600_000).toFixed(1) + 'h'
}

export const fmtTime = (ts: number) =>
  new Date(ts).toISOString().slice(11, 19) + 'Z'
export const fmtDateTime = (ts: number) =>
  new Date(ts).toISOString().slice(0, 19).replace('T', ' ') + 'Z'
export const fmtBtc = (v: number, dp = 4) => v.toFixed(dp)
