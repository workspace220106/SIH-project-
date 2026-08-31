import { create } from 'zustand'
import type {
  Entity,
  EntityKind,
  Evidence,
  GraphFilters,
  Lead,
  PatternId,
  TracePath,
  Transaction,
} from '@/types'
import { assemble, neighbourhood, tracePath, type Analysis } from '@/lib/graph'
import { datasetFromRecords, parseCapture, type ParseResult } from '@/lib/ingest'
import { nexus, type ServiceStatus } from '@/lib/api'
import { PATTERN_ORDER } from '@/lib/patterns'

export type View = 'landing' | 'command' | 'graph' | 'alerts' | 'patterns' | 'intake'
export type PanelMode = 'intel' | 'why' | 'trace' | 'replay' | 'lead'

export interface Highlight {
  /** Why these elements are lit. Shown in the graph gutter. */
  label: string
  entities: Set<string>
  edges: Set<string>
  source: 'evidence' | 'pattern' | 'trace' | 'timeline' | 'cluster'
}

export interface FlyCommand {
  position: [number, number, number]
  /** Rising counter — the rig re-runs whenever this changes. */
  nonce: number
  distance: number
}

export interface ReplayState {
  active: boolean
  playing: boolean
  /** Index into the replay track. */
  cursor: number
  speed: number
}

interface Focus {
  entities: Set<string>
  edges: Set<string>
  depth: Map<string, number>
}

const EMPTY_FOCUS: Focus = { entities: new Set(), edges: new Set(), depth: new Map() }

export type MotionPreference = 'system' | 'full' | 'reduced'

export interface IngestState {
  busy: boolean
  stage: number
  filename: string | null
  parse: ParseResult | null
  error: string | null
}

export interface NexusState {
  /* lifecycle */
  ready: boolean
  loadingStage: number
  status: ServiceStatus | null
  analysis: Analysis | null
  load: () => Promise<void>

  /* navigation */
  view: View
  previousView: View | null
  transitionNote: string
  setView: (view: View, note?: string) => void

  /* selection */
  selectedId: string | null
  hoverId: string | null
  focus: Focus
  hops: number
  select: (id: string | null, opts?: { fly?: boolean; note?: string }) => void
  hover: (id: string | null) => void
  setHops: (hops: number) => void
  expandSelection: () => void

  /* right panel */
  panel: PanelMode
  setPanel: (mode: PanelMode) => void
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void

  /* evidence + highlight */
  highlight: Highlight | null
  setHighlight: (h: Highlight | null) => void
  revealedEvidence: number
  revealEvidence: (n: number) => void
  activeEvidence: number | null
  setActiveEvidence: (index: number | null, evidence?: Evidence) => void

  /* trace */
  trace: TracePath | null
  traceDirection: 'forward' | 'backward'
  traceDepth: number
  runTrace: (direction?: 'forward' | 'backward', depth?: number) => void
  clearTrace: () => void

  /* replay */
  replay: ReplayState
  replayTrack: Transaction[]
  startReplay: () => void
  setReplay: (patch: Partial<ReplayState>) => void
  stepReplay: (delta: number) => void

  /* pattern lab */
  morphPattern: PatternId | null
  setMorphPattern: (p: PatternId | null) => void

  /* discovery exercise */
  probe: { armed: boolean; found: boolean; inspected: Set<number> }
  armProbe: () => void
  inspectCluster: (cluster: number) => void
  resetProbe: () => void

  /* filters */
  filters: GraphFilters
  setFilters: (patch: Partial<GraphFilters>) => void
  resetFilters: () => void

  /* camera bus */
  fly: FlyCommand | null
  flyTo: (position: [number, number, number], distance?: number) => void

  /* leads */
  activeLead: Lead | null
  openLead: (lead: Lead) => void

  /* graph density */
  density: 'FULL' | 'CLUSTERED'
  setDensity: (d: 'FULL' | 'CLUSTERED') => void

  /* motion preference: follows the OS unless overridden */
  motion: MotionPreference
  setMotion: (m: MotionPreference) => void

  /* ingestion */
  ingest: IngestState
  ingestFile: (file: File) => Promise<void>
  restoreSynthetic: () => Promise<void>
  clearIngestError: () => void
}

const defaultFilters = (): GraphFilters => ({
  riskMin: 0,
  kinds: { wallet: true, transaction: true, ip: true },
  patterns: PATTERN_ORDER.reduce(
    (acc, p) => ({ ...acc, [p]: true }),
    {} as Record<PatternId, boolean>,
  ),
})

let flyNonce = 0

export const useNexus = create<NexusState>((set, get) => ({
  ready: false,
  loadingStage: 0,
  status: null,
  analysis: null,

  async load() {
    if (get().analysis) return
    const status = await nexus.status()
    set({ status, loadingStage: 1 })
    const analysis = await nexus.analysis()
    set({
      analysis,
      ready: true,
      loadingStage: 6,
      filters: defaultFilters(),
      replayTrack: buildReplayTrack(analysis),
      // Large captures drop their low-value transaction nodes automatically;
      // there is no control for this because there is nothing to decide.
      density: analysis.entities.length > 700 ? 'CLUSTERED' : 'FULL',
    })
  },

  view: 'landing',
  previousView: null,
  transitionNote: '',
  setView(view, note = '') {
    const prev = get().view
    if (prev === view) return
    set({ view, previousView: prev, transitionNote: note })
    if (view === 'graph' && !get().selectedId) {
      const a = get().analysis
      if (a) get().select(a.primarySubject, { fly: true, note: 'Primary subject' })
    }
  },

  selectedId: null,
  hoverId: null,
  focus: EMPTY_FOCUS,
  hops: 2,

  select(id, opts) {
    const a = get().analysis
    if (!id || !a) {
      set({ selectedId: null, focus: EMPTY_FOCUS, highlight: null, trace: null, activeEvidence: null })
      return
    }
    const f = neighbourhood(a.index, id, get().hops)
    set({
      selectedId: id,
      focus: { entities: f.entities, edges: f.edges, depth: f.depth },
      highlight: null,
      activeEvidence: null,
      revealedEvidence: 0,
      trace: null,
      panelOpen: true,
    })
    if (opts?.fly !== false) {
      const e = a.index.entityById.get(id)
      if (e) {
        // Frame the neighbourhood, not the node. A wallet with twenty
        // counterparties needs the camera much further back than a leaf.
        const degree = (a.index.neighbours.get(id) ?? []).length
        const distance =
          e.kind === 'wallet' ? Math.min(200, 58 + degree * 4.5) : Math.min(90, 44 + degree * 6)
        get().flyTo([e.x, e.y, e.z], distance)
      }
    }
  },

  hover(id) {
    if (get().hoverId !== id) set({ hoverId: id })
  },

  setHops(hops) {
    set({ hops })
    const { selectedId, analysis } = get()
    if (selectedId && analysis) {
      const f = neighbourhood(analysis.index, selectedId, hops)
      set({ focus: { entities: f.entities, edges: f.edges, depth: f.depth } })
    }
  },

  expandSelection() {
    get().setHops(Math.min(10, get().hops + 1))
  },

  panel: 'intel',
  setPanel(mode) {
    const previous = get().panel
    set({ panel: mode, panelOpen: true })
    if (mode === 'why') set({ revealedEvidence: 0 })
    if (mode === 'trace' && !get().trace) get().runTrace()
    if (mode === 'replay') {
      // Replay owns the field while it runs, so any standing highlight is
      // cleared rather than fought with.
      set({ highlight: null })
      if (!get().replay.active) get().startReplay()
    }
    // Leaving replay releases the field; otherwise the graph would stay frozen
    // at whatever the cursor last revealed.
    if (previous === 'replay' && mode !== 'replay') {
      set({ replay: { ...get().replay, active: false, playing: false } })
    }
  },
  panelOpen: false,
  setPanelOpen(open) {
    set({ panelOpen: open })
  },

  highlight: null,
  setHighlight(h) {
    set({ highlight: h })
  },

  revealedEvidence: 0,
  revealEvidence(n) {
    set({ revealedEvidence: n })
  },

  activeEvidence: null,
  setActiveEvidence(index, evidence) {
    if (index === null || !evidence) {
      set({ activeEvidence: null, highlight: null })
      return
    }
    set({
      activeEvidence: index,
      highlight: {
        label: evidence.title + ' — ' + evidence.metric,
        entities: new Set(evidence.relatedEntities),
        edges: new Set(evidence.relatedEdges),
        source: 'evidence',
      },
    })
    const a = get().analysis
    const first = evidence.relatedEntities
      .map((id) => a?.index.entityById.get(id))
      .find((e): e is Entity => !!e)
    if (first) get().flyTo([first.x, first.y, first.z], 52)
  },

  trace: null,
  traceDirection: 'forward',
  traceDepth: 5,
  runTrace(direction, depth) {
    const { analysis, selectedId, traceDirection, traceDepth } = get()
    if (!analysis || !selectedId) return
    const root =
      analysis.index.entityById.get(selectedId)?.kind === 'wallet'
        ? selectedId
        : (analysis.index.neighbours.get(selectedId) ?? []).find(
            (n) => analysis.index.entityById.get(n)?.kind === 'wallet',
          )
    if (!root) return
    const dir = direction ?? traceDirection
    const d = depth ?? traceDepth
    const path = tracePath(analysis.index, root, dir, d)
    set({
      trace: path,
      traceDirection: dir,
      traceDepth: d,
      highlight: {
        label:
          'TRACE ' + dir.toUpperCase() + ' · ' + path.hops.length + ' hops · ' +
          path.totalValue.toFixed(2) + ' BTC',
        entities: new Set([path.rootEntity, ...path.hops.flatMap((h) => [h.fromEntity, h.toEntity])]),
        edges: new Set(path.hops.map((h) => h.edgeId)),
        source: 'trace',
      },
    })
  },
  clearTrace() {
    set({ trace: null, highlight: null })
  },

  replay: { active: false, playing: false, cursor: 0, speed: 1 },
  replayTrack: [],
  startReplay() {
    set({ replay: { active: true, playing: true, cursor: 0, speed: 1 } })
  },
  setReplay(patch) {
    set({ replay: { ...get().replay, ...patch } })
  },
  stepReplay(delta) {
    const { replay, replayTrack } = get()
    const cursor = Math.max(0, Math.min(replayTrack.length, replay.cursor + delta))
    set({ replay: { ...replay, cursor, playing: false } })
  },

  morphPattern: null,
  setMorphPattern(p) {
    set({ morphPattern: p })
  },

  probe: { armed: false, found: false, inspected: new Set<number>() },
  armProbe() {
    set({ probe: { armed: true, found: false, inspected: new Set<number>() }, highlight: null })
  },
  inspectCluster(cluster) {
    const { probe, analysis } = get()
    if (!probe.armed || probe.found || !analysis) return
    const inspected = new Set(probe.inspected)
    inspected.add(cluster)
    const target = analysis.index.entityById.get(analysis.primarySubject)?.cluster
    const found = cluster === target
    set({ probe: { ...probe, inspected, found } })
    if (found) get().select(analysis.primarySubject, { fly: true })
  },
  resetProbe() {
    set({ probe: { armed: false, found: false, inspected: new Set<number>() } })
  },

  filters: defaultFilters(),
  setFilters(patch) {
    set({ filters: { ...get().filters, ...patch } })
  },
  resetFilters() {
    set({ filters: defaultFilters() })
  },

  fly: null,
  flyTo(position, distance = 40) {
    set({ fly: { position, distance, nonce: ++flyNonce } })
  },

  activeLead: null,
  openLead(lead) {
    set({ activeLead: lead, panel: 'lead', panelOpen: true })
    const a = get().analysis
    const wallet = a?.dataset.wallets.find((w) => w.address === lead.who)
    if (wallet) get().select(wallet.id, { fly: true })
  },

  density: 'FULL',
  setDensity(d) {
    set({ density: d })
  },

  motion: 'system',
  setMotion(m) {
    set({ motion: m })
  },

  ingest: { busy: false, stage: 0, filename: null, parse: null, error: null },

  async ingestFile(file) {
    const patch = (p: Partial<IngestState>) => set({ ingest: { ...get().ingest, ...p } })
    patch({ busy: true, stage: 1, filename: file.name, error: null, parse: null })
    try {
      const text = await file.text()
      await pause(180)
      patch({ stage: 2 })
      const parse = parseCapture(text, file.name)
      if (!parse.records.length) {
        throw new Error(
          'No usable rows. Expected columns for txid, wallet, amount, fee, ip, port and timestamp.',
        )
      }
      patch({ stage: 3, parse })
      await pause(200)
      patch({ stage: 4 })
      const dataset = datasetFromRecords(parse.records, file.name, parse.format)
      dataset.stats.duplicates = parse.duplicates
      dataset.stats.invalidRows = parse.totalRows - parse.records.length - parse.duplicates
      dataset.stats.fields = parse.fields.length
      await pause(220)
      patch({ stage: 5 })
      const analysis = assemble(dataset)
      await pause(160)
      patch({ stage: 6, busy: false })
      set({
        analysis,
        selectedId: null,
        focus: EMPTY_FOCUS,
        highlight: null,
        trace: null,
        activeLead: null,
        replay: { active: false, playing: false, cursor: 0, speed: 1 },
        replayTrack: buildReplayTrack(analysis),
        filters: defaultFilters(),
      })
    } catch (err) {
      patch({
        busy: false,
        stage: 0,
        error: err instanceof Error ? err.message : 'Could not read this file.',
      })
    }
  },

  async restoreSynthetic() {
    const analysis = await nexus.analysis()
    set({
      analysis,
      selectedId: null,
      focus: EMPTY_FOCUS,
      highlight: null,
      trace: null,
      activeLead: null,
      replay: { active: false, playing: false, cursor: 0, speed: 1 },
      replayTrack: buildReplayTrack(analysis),
      filters: defaultFilters(),
      ingest: { busy: false, stage: 0, filename: null, parse: null, error: null },
    })
  },

  clearIngestError() {
    set({ ingest: { ...get().ingest, error: null } })
  },
}))

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** The replay track is the subject's own story, in the order it happened. */
function buildReplayTrack(a: Analysis): Transaction[] {
  const subject = a.primarySubject
  const involved = new Set<string>([subject])
  for (const p of a.dataset.planted) {
    if (p.walletIds.includes(subject)) p.walletIds.forEach((w) => involved.add(w))
  }
  return a.dataset.transactions
    .filter((t) => involved.has(t.sourceWallet) || involved.has(t.destinationWallet))
    .sort((x, y) => x.timestamp - y.timestamp)
}

/* ---- selectors ----------------------------------------------------- */

export const selectEntity = (s: NexusState): Entity | null =>
  s.selectedId ? (s.analysis?.index.entityById.get(s.selectedId) ?? null) : null

export const entityKindLabel: Record<EntityKind, string> = {
  wallet: 'WALLET',
  transaction: 'TRANSACTION',
  ip: 'HOST',
}
