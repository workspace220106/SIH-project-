# NEXUS — Bitcoin Transaction Intelligence

An offline analyst workstation for Bitcoin transaction traffic monitoring and analysis.
Built for NTRO, problem statement **PS 26146**.

NEXUS takes a capture of seven fields per record — `txid`, `wallet`, `amount`, `fee`, `ip`,
`port`, `timestamp` — correlates it into a temporal entity graph, runs five behavioural
detectors over it, scores every wallet, and produces an investigative lead that is anchored to
the exact nodes and edges that produced it.

Everything runs in the browser. There is no outbound network path.

> All data shipped with this build is **synthetic**. It is generated locally for demonstration
> and is not a record of observed activity.

**Scope:** this is a hackathon build. Three endpoints, no database, rule-based
detectors with published thresholds, and a weighted-sum risk score. What the
backend must do — and what it deliberately does not — is written down in
[docs/BACKEND.md](docs/BACKEND.md).

---

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build
```

Other scripts: `npm run preview` (serve the production build), `npm run typecheck`.

---

## The pipeline

```
INGEST → CLEAN → NORMALISE → CORRELATE (IP ↔ TXID ↔ TIME) → TEMPORAL ENTITY GRAPH
       → FEATURE EXTRACTION → DETECTORS → RISK SCORE → EXPLAINABLE ALERT → LEAD
```

### Detectors

| Detector | Shape | Rule |
| --- | --- | --- |
| Fan-out | one → many | `out-degree(w, Δt) ≥ 12 ∧ σ(amount)/μ(amount) < 0.45` |
| Fan-in | many → one | `in-degree(w, Δt) ≥ 12 ∧ distinct_sources ≥ 10` |
| Rapid movement | short dwell | `median(t_out − t_in) < 120s across ≥ 3 consecutive wallets` |
| Burst activity | high frequency | `rate(Δt=600s) > 8 × baseline_rate(cluster)` |
| Peeling / multi-hop | A → B → C → D | `chain_len ≥ 4 ∧ 0.10 < peel_ratio < 0.40 per hop` |

### Risk

A composite of four independently computed signals:

| Signal | Weight | Derived from |
| --- | --- | --- |
| Transaction | 0.30 | volume and count against the capture's own 94th percentile |
| Graph | 0.28 | degree, and how many behavioural clusters the wallet bridges |
| Temporal | 0.22 | median inter-transaction gap |
| Behaviour | 0.20 | which detectors matched, and whether the wallet is their anchor |

Confidence rises with the number of corroborating detections and with the *agreement* between
signals — one loud signal is treated as weaker than three that concur.

---

## Modules

| Module | Key | What it is for |
| --- | --- | --- |
| Command | `1` | Overview: three counts, the top subject, recent leads |
| Investigation | `2` | The 3D field. Panels open when you select something |
| Alerts | `3` | The work queue: priority, entity, risk, pattern, time, confidence |
| Patterns | `4` | The five detectors, each isolating its real matches in the field |
| Intake | `5` | Drop a CSV / JSON / XML capture and run the pipeline over it |

Nothing in the workspace is open by default except the graph. Selecting a node
opens the panel; the timeline, the filters, the connection list and the full
field list are each one click away and closed until then.

### Intelligence dock

`OVERVIEW` five key fields and the risk breakdown — every signal is clickable and lights its own
evidence in the graph. `WHY` the ranked explanation; each reason isolates the nodes and edges it
was derived from, and generates the lead. `TRACE` money-flow tracing, forward or backward, 3/5/10
hops. `REPLAY` chronological reconstruction with transport controls.

### Keyboard

`1`–`5` modules · `W` why · `T` trace · `R` replay · `I` overview · `E` expand one hop ·
`F` refocus camera · `Space` play/pause replay · `Esc` clear highlight, then selection, then
return to Command.

Motion follows the operating system's reduced-motion setting; the status bar toggles the
override.

---

## Importing a capture

Intake accepts CSV, TSV, JSON and XML. Column names are matched against a set of aliases
(`txid | tx_id | hash | transaction_id`, `wallet | address | addr`, and so on), timestamps are
accepted as ISO 8601 or epoch seconds/milliseconds. A host is an address and a port — there is
no GeoIP or ASN enrichment, because that is a separate data source.

**Rows sharing a txid are one transaction**: the earliest row is the input side, the rest are
outputs. Where every txid appears exactly once the direction of value cannot be recovered — the
detectors that depend on direction are skipped and the intake panel says so, rather than the
system guessing.

Sample captures are in `public/samples/` and linked from the intake screen.

---

## Architecture

```
src/
  types/          domain model — Transaction, Wallet, Entity, Edge, RiskScore, Evidence, Lead …
  data/synthetic  seeded capture generator with five planted ground-truth patterns
  lib/
    graph.ts      the engine: scoring, indexing, layout, evidence, alerts, leads, traversal
    ingest.ts     parsers and the detectors that run over imported captures
    layout.ts     deterministic 3D force solver
    patterns.ts   detector definitions
    api.ts        service boundary — three methods, the only thing the UI talks to
  scene/          three.js / R3F rendering: instanced nodes, edges, particles, camera rig
  state/store.ts  application state
  components/     views, panels and UI primitives
```

### Connecting a backend

`src/lib/api.ts` defines `NexusClient`. Today `LocalEngineClient` runs the engine in-process,
which is what an air-gapped workstation does. Setting `VITE_NEXUS_API` selects `HttpClient`
instead; fill in its `analysis()` against the FastAPI graph service and no component changes.
The UI never imports the generator directly.

### Rendering

One canvas, mounted once, shared by every view — a module change moves the camera rather than
rebuilding the scene. Nodes are spheres drawn as three instanced meshes (one per entity kind),
each with an additively-blended halo whose size and brightness carry risk and emphasis. All
relationships are a single `LineSegments` with vertex colours. Fading mixes toward the
background rather than using opacity, so there is no transparency sort, and the halo is squared
in alpha so a node the interface has pushed into the background stops glowing entirely.

Captures above 700 nodes automatically drop their low-value transaction nodes and keep the
wallet skeleton. There is no control for it because there is nothing to decide.

---

## Design

Near-black ground, charcoal surfaces, hairline rules, one restrained accent. Warm colour and
strong glow are reserved for two things: the current selection, and risk above the floor at 68.
Below that the field stays cool and quiet, so emphasis means something when it appears.

Type: Archivo for the wordmark and numeric readouts, IBM Plex Sans for prose, IBM Plex Mono for
every identifier, timestamp and measurement.

---

## Developer utilities

```bash
npx esbuild scripts/inspect-model.ts --bundle --platform=node --format=cjs --alias:@=./src --outfile=.tmp/inspect.cjs && node .tmp/inspect.cjs
```

Prints the scoring distribution headlessly — used to check the risk model after changes.
`scripts/emit-sample.ts` regenerates the sample captures in `public/samples/`.
