/**
 * NEXUS domain model.
 * These types mirror the contract the FastAPI ingestion + inference services
 * are expected to expose. Nothing in the UI layer may widen them.
 */

export type EntityKind = 'wallet' | 'transaction' | 'ip'

export type PatternId =
  | 'FAN_IN'
  | 'FAN_OUT'
  | 'RAPID_MOVEMENT'
  | 'BURST_ACTIVITY'
  | 'PEELING'
  | 'COINJOIN'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Confidence = 'LOW' | 'MODERATE' | 'HIGH'

/**
 * One row of a capture, matching the problem statement's minimum field set.
 *
 * A row is a whole transaction: the address and amount arrays carry every
 * input and output side, so fan-in, fan-out and peeling are read directly off
 * the record instead of being reconstructed from repeated rows.
 */
export interface RawRecord {
  timestamp: string
  txid: string
  srcIp: string
  dstIp: string
  srcPort: number
  dstPort: number
  inputAddresses: string[]
  outputAddresses: string[]
  inputAmounts: number[]
  outputAmounts: number[]
  fee: number
  /** Output script type, e.g. P2WPKH. Optional — not every capture carries it. */
  scriptType?: string
  /** ISO 3166-1 alpha-2, from the capture or resolved from the GeoIP database. */
  geoCountry?: string
  asn?: string
}

/** One side of a transaction: an address and the value it contributed or received. */
export interface TxParty {
  wallet: string
  amount: number
}

export interface Transaction {
  id: string
  txid: string
  timestamp: number
  inputs: TxParty[]
  outputs: TxParty[]
  /** Total value moved — the sum of the outputs. */
  amount: number
  fee: number
  srcIp: string
  dstIp: string
  srcPort: number
  dstPort: number
  scriptType: string
  /** Hop index within a traced peeling chain, when applicable. */
  hop?: number
}

export interface Wallet {
  id: string
  address: string
  label?: string
  firstSeen: number
  lastSeen: number
  txCount: number
  totalIn: number
  totalOut: number
  degreeIn: number
  degreeOut: number
  cluster: number
  risk: RiskScore
}

export interface IPObservation {
  id: string
  address: string
  port: number
  /** ISO 3166-1 alpha-2, or 'ZZ' when the GeoIP database has no entry. */
  country: string
  asn: string
  firstSeen: number
  lastSeen: number
  observationCount: number
  linkedWallets: string[]
}

/** A node in the temporal entity graph. */
export interface Entity {
  id: string
  kind: EntityKind
  label: string
  /** 0–100. Transactions and IPs inherit a propagated score. */
  risk: number
  cluster: number
  /** Layout position, produced by the force solver — never authored by hand. */
  x: number
  y: number
  z: number
  /** Normalised graph importance, drives node scale. */
  importance: number
  timestamp: number
  amount?: number
  meta: Record<string, string | number>
}

export type EdgeKind = 'flow' | 'network'

export interface Edge {
  id: string
  source: string
  target: string
  kind: EdgeKind
  weight: number
  amount?: number
  timestamp: number
  suspicious: boolean
  patterns: PatternId[]
}

export interface RiskSignal {
  key: 'transaction' | 'graph' | 'temporal' | 'behaviour' | 'anomaly'
  label: string
  /** Raw signal strength 0–100. */
  value: number
  /** Fraction of the composite score this signal contributes, 0–1. */
  weight: number
  detail: string
}

export interface RiskScore {
  score: number
  confidence: number
  priority: Priority
  signals: RiskSignal[]
}

export interface SuspiciousPattern {
  id: PatternId
  name: string
  shortName: string
  formula: string
  description: string
  /** Entities implicated by this detection. */
  entities: string[]
  edges: string[]
  strength: number
  detectedAt: number
}

export interface Evidence {
  index: number
  type: PatternId | 'GRAPH_CONNECTIVITY' | 'ML_ANOMALY' | 'TAINT'
  title: string
  description: string
  metric: string
  relatedEntities: string[]
  relatedEdges: string[]
  /** Contribution to the composite risk score, 0–1. */
  strength: number
}

export interface Lead {
  id: string
  number: number
  createdAt: number
  who: string
  whoKind: EntityKind
  what: string
  why: string[]
  evidence: Evidence[]
  priority: Priority
  confidence: number
  risk: number
  nextTarget: string
  status: 'OPEN' | 'ASSIGNED' | 'CLOSED'
}

export interface Alert {
  id: string
  entityId: string
  entityLabel: string
  priority: Priority
  risk: number
  pattern: PatternId
  /** Country of the host that broadcast most of this wallet's traffic. */
  country: string
  timestamp: number
  confidence: number
  acknowledged: boolean
}

export interface TimelineEvent {
  id: string
  timestamp: number
  kind: 'transaction' | 'link' | 'detection' | 'escalation' | 'lead'
  title: string
  detail: string
  entityId?: string
  edgeId?: string
  risk?: number
}

export interface TraceHop {
  index: number
  fromEntity: string
  toEntity: string
  txid: string
  amount: number
  timestamp: number
  edgeId: string
}

export interface TracePath {
  rootEntity: string
  direction: 'forward' | 'backward'
  hops: TraceHop[]
  totalValue: number
  depth: number
}

export interface DatasetStats {
  name: string
  source: 'SYNTHETIC' | 'IMPORTED'
  format: 'CSV' | 'JSON' | 'XML' | 'GENERATED'
  records: number
  fields: number
  duplicates: number
  invalidRows: number
  rangeStart: number
  rangeEnd: number
  wallets: number
  transactions: number
  ips: number
}

export interface GraphSnapshot {
  entities: Entity[]
  edges: Edge[]
  clusters: ClusterSummary[]
}

export interface ClusterSummary {
  id: number
  label: string
  size: number
  risk: number
  dominantPattern: PatternId | null
  centroid: [number, number, number]
}

/** Filter state the renderer honours. Deliberately small: three controls that
 *  each map to one line of a backend query. */
export interface GraphFilters {
  riskMin: number
  kinds: Record<EntityKind, boolean>
  patterns: Record<PatternId, boolean>
}

/** A detector match. Synthetic captures plant them; imported captures earn them. */
export interface Detection {
  id: PatternId
  cluster: number
  walletIds: string[]
  txIds: string[]
  anchorWallet: string
  strength: number
  detectedAt: number
  metric: string
}

/** Everything the detection engine needs, however the capture was obtained. */
export interface Dataset {
  wallets: Wallet[]
  transactions: Transaction[]
  ips: IPObservation[]
  planted: Detection[]
  stats: DatasetStats
  /** Present when the capture came from a file rather than the generator. */
  notes?: string[]
}

/** What the detector is, reported to the analyst rather than assumed. */
export interface ModelInfo {
  name: string
  family: 'unsupervised'
  trees: number
  sampleSize: number
  features: string[]
  /** Wallets the model was fitted on — the loaded capture, nothing else. */
  trainedOn: number
  /** Score above which a wallet is treated as anomalous. */
  threshold: number
  flagged: number
}

/** One feature's share of a single wallet's anomaly score. */
export interface AnomalyContribution {
  key: string
  label: string
  share: number
  value: number
  reads: string
}

/** Per-wallet output of the anomaly detector. */
export interface AnomalyResult {
  score: number
  contributions: AnomalyContribution[]
}
