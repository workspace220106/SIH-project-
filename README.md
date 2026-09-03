# TRADELINE — Bitcoin Transaction Intelligence

An offline analyst workstation for Bitcoin transaction traffic monitoring and analysis.

TRADELINE takes a capture of fourteen fields per record — `timestamp`, `txid`, source and
destination host and port, the input and output address and amount arrays, `fee`, `script_type`,
`geo_country` and `asn` — correlates it into a temporal entity graph, runs six behavioural
detectors and an unsupervised model over it, scores every wallet, and produces an investigative
lead that is anchored to the exact nodes and edges that produced it.

Everything runs in the browser. There is no outbound network path.

> All data shipped with this build is **synthetic**. It is generated locally for demonstration
> and is not a record of observed activity.

**Technical write-up:** approach, model choice and explainability method are in
[docs/TECHNICAL-WRITEUP.md](docs/TECHNICAL-WRITEUP.md).

**Scope:** this is a deliberately small build. Three endpoints, no database, rule-based
detectors with published thresholds, and a weighted-sum risk score. What the
backend must do — and what it deliberately does not — is written down in
[docs/BACKEND.md](docs/BACKEND.md).

---

## Running it on Linux, offline

Verified on Ubuntu 24.04, x86-64, Node.js 22 — see [Verified on Linux](#verified-on-linux) below
for exactly what was run. The only prerequisite is Node.js 20 or newer.

```bash
sudo apt install nodejs npm
```

Install and build once, on a machine with network access:

```bash
npm ci && npm run build
```

`dist/` is then a self-contained static bundle — application code, fonts and sample captures.
Copy it to the air-gapped host and serve it locally:

```bash
npx --yes serve dist -l 5173
```

Any static file server works (`python3 -m http.server 5173 --directory dist` needs nothing
installed at all). Then open `http://localhost:5173`.

**Nothing reaches the network at runtime.** Fonts are bundled rather than fetched from a CDN, the
detection model is fitted in-process on the loaded capture, the GeoIP lookup reads a local file,
and dropped captures are read in the browser and never transmitted. You can confirm this on the
host with the network cable out, or watch it directly:

```bash
sudo ss -tnp | grep -v 127.0.0.1
```

To install the optional GeoIP database, extract a MaxMind GeoLite2 Country CSV export and run
`npm run geoip ./geolite2` before building.

### Verified on Linux

Ubuntu 24.04.4 LTS, kernel 6.6.87 x86-64, Node 22.22.1, on an **ext4** filesystem — case-sensitive,
which is the difference from Windows that actually breaks builds. Run under `TZ=Asia/Kolkata` to
catch date handling that only works in UTC.

| Check | Result |
| --- | --- |
| `npm install` | clean |
| `npm run typecheck` | pass |
| `npm run build` | pass — 1032 modules, 8.4s, `dist` 2.5 MB |
| `npm run verify` | all checks passed |
| `npm run inspect` · `inspect:clean` · `inspect:imported` | pass |
| Serve `dist` and load the app | boot, landing, workstation and 3D graph render, zero console errors |
| Requests made at runtime | all same-origin; no CDN, no font host, nothing external |

Results are identical to a Windows run — same 253 entities / 402 edges, same top subject at risk 92
with 0.963 confidence, same anomaly maximum of 0.7930. The seeded model reproduces across
platforms, which is what makes the figures in the deck quotable.

`npm run verify` covers ingestion, parsing and the model across CSV, JSON, the messy capture that
needs preparation first, and an adversarial capture built to break the parser. Each format of the
same capture produces identical model output.

**Two limits worth stating.** The XML reader uses the browser's `DOMParser`, so `npm run verify`
cannot exercise that path headlessly and says so rather than skipping quietly; XML import was
verified separately in the browser (120 records, 79 wallets, model fitted on the capture, matching
the JSON run exactly). And WebGL performance depends on the host's graphics drivers — a Linux box
with no GPU driver falls back to software rendering, which would make the 3D graph slow. The build,
the server and the detection engine are unaffected.

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
| CoinJoin / mixing | many ⇄ many | `inputs ≥ 3 ∧ outputs ≥ 3 ∧ σ(out)/μ(out) < 0.10` |

### The model

Detection is **not** rules alone. An **Isolation Forest** (`src/lib/ml/`) is fitted on every
capture that loads — 120 trees, 256-row subsamples — over eight per-wallet features: outgoing and
incoming degree, transaction count, value moved, velocity, amount uniformity, burst fan-out, and
mean outputs per transaction.

It is **unsupervised by necessity**: a capture arrives with no labels, so there is nothing for a
classifier to train against. Isolation Forest needs none — it exploits the fact that anomalies are
few and different, and so are separated by fewer random splits than ordinary points.

**Explainability is per-instance ablation.** Each feature is reset to the population median in
turn and the wallet re-scored; the drop in score is that feature's contribution. The result reads
as *"Burst fan-out 25%, Transaction count 23%, Outgoing degree 20%"* and appears as a ranked
evidence row that lights its own nodes and edges in the graph.

The model runs in-process, in the browser, in well under a second. Nothing is pre-trained and
nothing is fetched.

### Entity resolution

**Common-input-ownership**: addresses spent together in one transaction must share a private key
holder, so they are one entity. Transactions that look like CoinJoins are excluded from the merge —
CoinJoin exists specifically to poison this heuristic, and treating its inputs as one owner is the
error it is designed to produce.

### Risk

A composite of five independently computed signals:

| Signal | Weight | Derived from |
| --- | --- | --- |
| Model anomaly | 0.22 | the Isolation Forest score, stretched against the capture's own spread |
| Transaction | 0.20 | volume and count against the capture's 94th percentile |
| Graph | 0.18 | degree, and how many behavioural clusters the wallet bridges |
| Behaviour | 0.16 | which detectors matched, and whether the wallet is their anchor |
| Seed proximity | 0.12 | taint propagated from wallets a detector already named |
| Temporal | 0.12 | median inter-transaction gap |

### Risk propagation

Taint starts at 1.0 on each seed, is split across a transaction's outputs **in proportion to the
value each received**, and decays 0.6 per hop over at most five hops. A wallet's taint is the
strongest single chain that reached it. Proportional splitting is what stops a small payment into
a busy wallet from painting everything downstream.

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

## Preparing a raw capture

Intake has two stages, side by side.

**Prepare** takes a capture as it actually arrives — headers named by whoever wrote the exporter,
mixed date conventions, amounts in satoshis or carrying a currency mark, ports welded onto
addresses, array columns encoded three different ways — and produces a canonical CSV you can
download. It reports what it did: which columns were renamed, how many values were repaired and
of what kind, and every row it dropped with the line number and the reason.

Repairs are only ever deterministic. Anything that would require a guess is rejected instead:
an address and amount array of differing lengths means value cannot be attributed to an address,
so the row goes, and the report says so.

`public/samples/capture-raw-messy.csv` is a deliberately dirty file for exercising this — 95 rows
across four date formats, three array encodings, satoshi and symbol amounts, with five planted
defects. It cleans to 90 rows.

**Drop dataset** then takes the canonical file and runs detection. A capture that is already clean
can go straight in.

## Importing a capture

Intake accepts CSV, TSV, JSON and XML in the problem statement's field format:

| Field | Notes |
| --- | --- |
| `timestamp` | ISO 8601 or epoch seconds/milliseconds |
| `txid` | |
| `src_ip`, `dst_ip` | the broadcasting host and the peer it relayed to |
| `src_port`, `dst_port` | |
| `input_addresses[]`, `output_addresses[]` | JSON array, or a pipe-separated list in one cell |
| `input_amounts[]`, `output_amounts[]` | must match their address array in length |
| `fee` | |
| `script_type` | optional |
| `geo_country`, `asn` | optional — resolved from the GeoIP database when absent |

Column names are matched against a set of aliases (`txid | tx_id | hash`, `src_ip | source_ip | ip`,
and so on). **One row is one transaction** — the arrays carry both sides, so fan-in, fan-out and
peeling are read off the record rather than inferred from row ordering. A row whose address and
amount arrays differ in length is rejected rather than guessed at, because value could not be
attributed to an address.

### GeoIP

`geo_country` and `asn` are used directly when the capture carries them. When it does not, addresses
are resolved against a local database — build `public/geoip/ipv4-country.json` from a MaxMind
GeoLite2 Country CSV export with `scripts/build-geoip.ts`. The lookup is a binary search over
sorted ranges and never touches the network; the intake screen states whether a database is
installed. Unresolved addresses show as `ZZ` rather than being guessed.

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

Fonts are bundled through `@fontsource`, not fetched from a CDN. The workstation claims to be
offline on every screen, so it has to render correctly on a host with no route out.

---

## Developer utilities

```bash
npx esbuild scripts/inspect-model.ts --bundle --platform=node --format=cjs --alias:@=./src --outfile=.tmp/inspect.cjs && node .tmp/inspect.cjs
```

Prints the scoring distribution headlessly — used to check the risk model after changes.
`npm run inspect:imported` runs the whole imported chain — clean, parse, assemble — and asserts
the model refits on it rather than reusing the synthetic fit.

```bash
npm run verify
```

The gate. Runs ingestion, parsing and the model over every input path — CSV, JSON, the messy
capture that needs preparation first, and an adversarial capture built to break the parser — and
asserts roughly fifteen properties per capture: arrays aligned, timestamps normalised, dataset
chronological, model fitted on *that* capture, every wallet scored, scores discriminating and in
range, explanations produced, detectors fired, and the model reaching the evidence. It exits
non-zero on failure, so it is usable in CI rather than only readable by a human.

`npm run samples` regenerates the sample captures in `public/samples/`.
