import type {
  Alert,
  ClusterSummary,
  DatasetStats,
  Edge,
  Entity,
  Lead,
  SuspiciousPattern,
  TimelineEvent,
} from '@/types'
import { analyse, type Analysis } from '@/lib/graph'

/**
 * Service boundary.
 *
 * The UI talks to `NexusClient` and nothing else. Today the only
 * implementation runs the detection engine in-process, which is what an
 * air-gapped workstation does. When the FastAPI ingestion, graph-processing
 * and inference services are available, `HttpClient` below is filled in and
 * selected by `VITE_NEXUS_API` — no component changes.
 */

export interface ServiceStatus {
  network: 'OFFLINE'
  model: 'READY' | 'LOADING' | 'ABSENT'
  dataset: 'READY' | 'EMPTY'
  engine: string
  buildId: string
  latencyMs: number
}

export interface GraphPayload {
  entities: Entity[]
  edges: Edge[]
  clusters: ClusterSummary[]
  patterns: SuspiciousPattern[]
  alerts: Alert[]
  leads: Lead[]
  timeline: TimelineEvent[]
  stats: DatasetStats
  primarySubject: string
}

export interface IngestStage {
  key: 'UPLOAD' | 'VALIDATE' | 'CLEAN' | 'NORMALIZE' | 'CORRELATE' | 'READY'
  label: string
  detail: string
}

export const INGEST_STAGES: IngestStage[] = [
  { key: 'UPLOAD', label: 'UPLOAD', detail: 'Read into local buffer. Nothing leaves this host.' },
  { key: 'VALIDATE', label: 'VALIDATE', detail: 'Schema check across txid, wallet, amount, fee, ip, port, timestamp.' },
  { key: 'CLEAN', label: 'CLEAN', detail: 'Drop malformed rows, resolve duplicate txids, coerce numerics.' },
  { key: 'NORMALIZE', label: 'NORMALIZE', detail: 'Unify timestamps to UTC, amounts to BTC, addresses to canonical form.' },
  { key: 'CORRELATE', label: 'CORRELATE', detail: 'Join IP ↔ TXID ↔ time into the temporal entity graph.' },
  { key: 'READY', label: 'READY', detail: 'Feature extraction complete. Detectors armed.' },
]

export interface NexusClient {
  status(): Promise<ServiceStatus>
  analysis(seed?: number): Promise<Analysis>
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

class LocalEngineClient implements NexusClient {
  private cache = new Map<number, Analysis>()

  async status(): Promise<ServiceStatus> {
    return {
      network: 'OFFLINE',
      model: 'READY',
      dataset: 'READY',
      engine: 'nexus-engine/local',
      buildId: 'PS26146.1.0',
      latencyMs: 0,
    }
  }

  async analysis(seed = 26146): Promise<Analysis> {
    const hit = this.cache.get(seed)
    if (hit) return hit
    // Yield once so the shell can paint its loading sequence before the
    // solver takes the main thread.
    await wait(16)
    const result = analyse(seed)
    this.cache.set(seed, result)
    return result
  }
}

class HttpClient implements NexusClient {
  constructor(private base: string) {}

  async status(): Promise<ServiceStatus> {
    const res = await fetch(this.base + '/health')
    if (!res.ok) throw new Error('status ' + res.status)
    return (await res.json()) as ServiceStatus
  }

  async analysis(): Promise<Analysis> {
    throw new Error(
      'Remote analysis is not wired yet. Point VITE_NEXUS_API at a service exposing GET /graph.',
    )
  }
}

const remote = import.meta.env?.VITE_NEXUS_API as string | undefined

export const nexus: NexusClient = remote ? new HttpClient(remote) : new LocalEngineClient()
