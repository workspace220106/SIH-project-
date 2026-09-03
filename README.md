# TRADELINE — Bitcoin Transaction Intelligence

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.11.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.6.3-blue.svg?style=flat-square)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-18.3.1-61dafb.svg?style=flat-square)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/three.js-0.169.0-black.svg?style=flat-square)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/vite-5.4.11-646cff.svg?style=flat-square)](https://vitejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3.4.15-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![Air-Gapped Status](https://img.shields.io/badge/network-100%25%20offline%20%2F%20air--gapped-success.svg?style=flat-square)](#offline--air-gapped-guarantee)
[![Verified on Linux](https://img.shields.io/badge/verified%20on-Ubuntu%2024.04%20LTS-orange.svg?style=flat-square)](#verified-on-linux)
[![License](https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square)](LICENSE)

> **An air-gapped, offline forensic analyst workstation for Bitcoin transaction traffic monitoring, graph correlation, unsupervised anomaly detection, and explainable investigative lead generation.**

TRADELINE ingests fourteen network and blockchain fields per record — `timestamp`, `txid`, source/destination IP and port, input/output address and amount arrays, `fee`, `script_type`, `geo_country`, and `asn`. It repairs dirty exports deterministically, resolves entities through multi-input co-spend heuristics (with CoinJoin poisoning protection), builds a temporal 3D entity graph, executes six behavioral pattern detectors alongside an in-process **Isolation Forest** machine learning model, diffuses value-weighted risk taint across transaction outputs, and generates actionable investigative leads anchored to verifiable graph evidence.

**Everything runs entirely in the browser client or headlessly on local runtimes. There is zero outbound network path.**

---

## Table of Contents

- [Executive Summary & Core Principles](#executive-summary--core-principles)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Start Local Development Server](#3-start-local-development-server)
  - [4. Build Static Production Bundle](#4-build-static-production-bundle)
  - [5. Run Air-Gapped Local Server](#5-run-air-gapped-local-server)
- [Offline & Air-Gapped Guarantee](#offline--air-gapped-guarantee)
  - [Verified on Linux (Ubuntu 24.04 LTS)](#verified-on-linux-ubuntu-2404-lts)
  - [Network Isolation Verification](#network-isolation-verification)
- [System Architecture & Pipeline](#system-architecture--pipeline)
  - [End-to-End Pipeline Dataflow](#end-to-end-pipeline-dataflow)
  - [Directory Structure](#directory-structure)
  - [State & Service Layer](#state--service-layer)
- [Forensic & Detection Engine](#forensic--detection-engine)
  - [1. Entity Resolution (Common-Input-Ownership)](#1-entity-resolution-common-input-ownership)
  - [2. The 6 Behavioural Pattern Detectors](#2-the-6-behavioural-pattern-detectors)
  - [3. Unsupervised Machine Learning (Isolation Forest)](#3-unsupervised-machine-learning-isolation-forest)
  - [4. Explainable AI (Per-Instance Feature Ablation)](#4-explainable-ai-per-instance-feature-ablation)
  - [5. Value-Weighted Taint Diffusion](#5-value-weighted-taint-diffusion)
  - [6. Composite Risk Scoring & Confidence](#6-composite-risk-scoring--confidence)
- [Intake & Data Preparation Engine](#intake--data-preparation-engine)
  - [The 14 Canonical Fields](#the-14-canonical-fields)
  - [Supported Capture Formats](#supported-capture-formats)
  - [Deterministic Repair Rules vs. Loud Rejections](#deterministic-repair-rules-vs-loud-rejections)
  - [Offline GeoIP & ASN Resolution](#offline-geoip--asn-resolution)
- [Analyst Workstation UI & Modules](#analyst-workstation-ui--modules)
  - [The 5 Operational Modules](#the-5-operational-modules)
  - [Intelligence Dock](#intelligence-dock)
  - [Keyboard Navigation Reference](#keyboard-navigation-reference)
  - [3D Visualization & Graphics Optimization](#3d-visualization--graphics-optimization)
- [Developer Utilities & CLI Tooling](#developer-utilities--cli-tooling)
  - [Headless Verification Gate (`npm run verify`)](#headless-verification-gate-npm-run-verify)
  - [Model Inspection & Telemetry (`npm run inspect`)](#model-inspection--telemetry-npm-run-inspect)
  - [Data Cleaning Diagnostics (`npm run inspect:clean`)](#data-cleaning-diagnostics-npm-run-inspectclean)
  - [Import Pipeline Assertion (`npm run inspect:imported`)](#import-pipeline-assertion-npm-run-inspectimported)
  - [Sample Capture Generation (`npm run samples`)](#sample-capture-generation-npm-run-samples)
- [Production & Containerized Deployment](#production--containerized-deployment)
  - [Docker Container Deployment](#docker-container-deployment)
  - [Connecting an External Backend (FastAPI Bridge)](#connecting-an-external-backend-fastapi-bridge)
- [Environment Variables](#environment-variables)
- [Available NPM Scripts](#available-npm-scripts)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Honest Limits & Future Work](#honest-limits--future-work)
- [Contributing](#contributing)
- [License](#license)

---

## Executive Summary & Core Principles

1. **Air-Gapped by Architecture**: Traditional security analysis software frequently requires cloud backends, remote API endpoints, or CDN asset streaming. TRADELINE is built from the ground up to operate on air-gapped forensic laptops inside secure enclaves (SCIFs) without network access.
2. **Deterministic & Auditable**: Black-box scoring creates distrust during legal and regulatory proceedings. TRADELINE enforces complete explainability: every risk score deconstructs into exact mathematical weights, feature ablation drops, and highlighted graph subgraphs.
3. **No Phantom Ground Truth**: Bitcoin transaction captures collected in the wild arrive unlabelled. Training a supervised classifier requires fabricating labels, which causes the model to memorize human bias. TRADELINE deploys an unsupervised Isolation Forest that identifies anomalies purely by structural isolation path length.
4. **Failing Loudly Over Guessing Quietly**: If an input record contains mismatched address and amount arrays, guessing attribution corrupts the chain of custody. The data preparation engine repairs deterministically what is unambiguous and loudly rejects what cannot be proven.

---

## Key Features

- **Zero-Network Runtime**: Self-hosted fonts, bundled dependencies, local GeoIP binary search, and local in-memory machine learning.
- **Dynamic Entity Graph**: Unifies network-layer observations (`src_ip`, `dst_ip`, ports) with ledger-layer records (`txid`, inputs, outputs, amounts, fees) into a 3D force-directed layout.
- **Common-Input-Ownership Clustering**: Automatically collapses multi-input spends into single entity clusters while detecting and neutralizing CoinJoin transaction structures designed to poison the heuristic.
- **Hybrid Detection Engine**: Integrates 6 rule-based heuristic detectors (Fan-Out, Fan-In, Rapid Movement, Burst Activity, Peeling Chains, CoinJoin Mixing) with an unsupervised Isolation Forest (120 trees, 256 subsamples).
- **Per-Instance Feature Ablation XAI**: Decomposes wallet anomaly scores into percentage feature contributions against population medians, producing plain-English evidentiary statements.
- **Value-Weighted Taint Diffusion**: Propagates taint from identified seed wallets proportionally to output transaction values, with configurable per-hop decay and depth pruning.
- **Robust Capture Ingestion**: Drag-and-drop support for CSV, TSV, JSON, and XML with header aliasing, satoshi-to-BTC normalization, timestamp harmonization, and port decoupling.
- **Interactive 3D WebGL Workstation**: Instanced rendering for thousands of entities, additive halo glow shaders indicating risk levels, forward/backward money-flow tracing, and chronological transaction playback.

---

## Tech Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Runtime & Language** | **Node.js** (>= 20.11.0), **TypeScript** (5.6.3) | Strict typing, headless CLI runners, cross-platform execution |
| **Frontend Framework** | **React** (18.3.1), **Vite** (5.4.11) | Reactive UI rendering, ultra-fast HMR, modular architecture |
| **3D Visualization** | **Three.js** (0.169.0), **React Three Fiber** (8.17.10), **Drei** (9.114.3) | WebGL 3D entity space, instanced mesh rendering, custom shaders |
| **Force Layout** | **d3-force-3d** (3.0.5) | Deterministic 3D spatial positioning for wallet/transaction graphs |
| **State Management** | **Zustand** (4.5.5) | Centralized, reactive application and filtering state |
| **Styling & Motion** | **Tailwind CSS** (3.4.15), **Framer Motion** (11.11.17) | Minimalist terminal-grade dark theme, reduced-motion accessibility |
| **Typography (Offline)** | **@fontsource** (Public Sans, Caudex, IBM Plex Mono, Instrument Serif) | Bundled WOFF2 fonts eliminating Google Fonts CDN calls |
| **ML & Algorithms** | Custom in-process **Isolation Forest**, **Mulberry32 PRNG** | Deterministic, unlabelled anomaly scoring in pure TypeScript |
| **Build & Tooling** | **esbuild**, **PostCSS**, **Autoprefixer** | Headless CLI bundling, compilation, and linting |

---

## Prerequisites

Before starting local setup, ensure your environment meets the following specifications:

- **Node.js**: Version `20.11.0` or higher (LTS versions 20.x or 22.x strongly recommended).
- **Package Manager**: `npm` (v10+), `pnpm`, or `yarn`.
- **Operating System**: Linux (Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch), macOS (12+), or Windows 10/11 (PowerShell or WSL2).
- **Browser**: Any modern browser supporting WebGL 2.0 (Google Chrome 110+, Mozilla Firefox 110+, Apple Safari 16+, Microsoft Edge).
- **(Optional) Python 3**: For serving the production bundle with `http.server` on air-gapped hosts.

---

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/your-org/tradeline-btc-intelligence.git
cd tradeline-btc-intelligence
```

### 2. Install Dependencies

Install required dependencies using the locked versions:

```bash
npm ci
```

*(Alternatively, use `npm install` if you are modifying dependency trees).*

### 3. Start Local Development Server

Launch the Vite local development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The application will initialize with the pre-seeded synthetic dataset containing 253 entities, 402 edges, and 6 planted behavioral forensic patterns.

### 4. Build Static Production Bundle

To build the optimized, self-contained static distribution:

```bash
npm run build
```

This performs a full TypeScript typecheck (`tsc -b`) and bundles client assets via Vite into the `dist/` directory. The entire build is typically ~2.5 MB, including all code, assets, sample captures, and local WOFF2 font files.

### 5. Run Air-Gapped Local Server

Serve the compiled `dist/` folder locally without any internet connection:

**Using Node.js serve:**
```bash
npx --yes serve dist -l 5173
```

**Using native Python 3 (requires zero external tools):**
```bash
python3 -m http.server 5173 --directory dist
```

Navigate to `http://localhost:5173` to access the full workstation.

---

## Offline & Air-Gapped Guarantee

TRADELINE is engineered specifically for secure environments where machines are disconnected from public networks.

### Verified on Linux (Ubuntu 24.04 LTS)

The entire pipeline has been thoroughly verified on Ubuntu 24.04.4 LTS (kernel 6.6.87 x86-64, Node.js 22.22.1) on a case-sensitive **ext4** filesystem under the `Asia/Kolkata` timezone to ensure locale-resilient timestamp parsing.

| Automated Verification Check | Target Standard | Observed Result |
| :--- | :--- | :--- |
| `npm install` | Clean resolution without security warnings | Pass |
| `npm run typecheck` | Zero TypeScript compiler diagnostic errors | Pass (`tsc -b` clean) |
| `npm run build` | 1032 modules bundled cleanly into `dist/` | Pass (~8.4s, 2.5 MB total) |
| `npm run verify` | 5 capture paths (CSV, JSON, XML, messy, adversarial) | Pass (100% assertions passed) |
| `npm run inspect` | Model fitting, risk distribution, lead creation | Pass (Matches seeded invariants) |
| Network requests at runtime | Zero external HTTP/HTTPS/WebSocket requests | Pass (100% same-origin) |

```
Platform verification:
Entities: 253 | Graph edges: 402
Top Subject: w014 (bc1q2r...x58s) | Risk: 92 (CRITICAL) | Confidence: 0.963
Anomaly Max Score: 0.7930 (Burst fan-out: 25%, Tx count: 23%, Out degree: 20%)
```

### Network Isolation Verification

You can independently audit the built application to verify that no external endpoints, CDN URLs, or remote telemetry systems are present:

```bash
# 1. Search built bundle for common external CDN domains (Expected: 0 matches)
grep -rl "fonts.googleapis\|cdn.jsdelivr\|unpkg.com\|cdnjs" dist/

# 2. Count locally bundled WOFF2 font files (Expected: 14+ font files)
find dist -name "*.woff2" | wc -l

# 3. Monitor active socket connections while running the app
sudo ss -tnp | grep -v "127.0.0.1"
```

---

## System Architecture & Pipeline

### End-to-End Pipeline Dataflow

```
+---------------------------------------------------------------------------------------------------+
|                                       RAW CAPTURE INGESTION                                       |
|  Formats: CSV / TSV / JSON / XML   *   Dirty Data: Mixed Dates, Satoshi Units, Host:Port, Arrays  |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                STAGE 1: PREPARATION & AUTO-REPAIR                                 |
|  * Column Alias Mapping        * Satoshi -> BTC Conversion       * Decouple Host / Port           |
|  * Timestamp ISO Normalization * Delimited Array Extraction      * Loud Rejection of Bad Rows     |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                STAGE 2: ENTITY GRAPH CORRELATION                                  |
|  * Multi-input Co-Spend Heuristic (Common-Input-Ownership Entity Resolution)                      |
|  * CoinJoin Exclusion Filter (Prevents Heuristic Poisoning)                                       |
|  * Graph Nodes: Wallet Entities, Transaction Points, Host Broadcast Relays                        |
|  * Spatial Layout: 3D Force-Directed Layout Solver (d3-force-3d)                                  |
+---------------------------------------------------------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+-------------------------------------------------+  +----------------------------------------------+
|       STAGE 3A: RULE-BASED DETECTORS            |  |     STAGE 3B: ISOLATION FOREST ANOMALY       |
|  * Fan-Out (Dispersal & uniformity)             |  |  * 120 Isolation Trees / 256 Subsample Size  |
|  * Fan-In (Consolidation & distinct sources)    |  |  * 8 Per-Wallet Behavioral Features          |
|  * Rapid Movement (Median dwell time < 120s)    |  |  * Pure Unsupervised Anomaly Isolation       |
|  * Burst Activity (Tx frequency > 8x baseline)  |  |  * Per-Instance Feature Ablation XAI         |
|  * Peeling / Multi-Hop (Chain length >= 4)      |  +----------------------------------------------+
|  * CoinJoin / Mixing (Input/Output symmetry)    |                        |
+-------------------------------------------------+                        |
                         |                                                 |
                         +------------------------+------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 STAGE 4: VALUE-WEIGHTED TAINT                                     |
|  * Seed Origin Anchors         * Proportional Value Splitting    * Hop Decay Factor: 0.60         |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                              STAGE 5: COMPOSITE RISK & LEAD SYNTHESIS                             |
|  * Weighted 6-Signal Aggregation: Anomaly (0.22), Tx (0.20), Graph (0.18), Behaviour (0.16),      |
|    Seed Taint (0.12), Temporal (0.12)                                                             |
|  * Signal Agreement Confidence Calculation (Spread Standard Deviation)                            |
|  * Ranked Evidence Formulation & Subgraph Highlighting                                            |
+---------------------------------------------------------------------------------------------------+
```

### Directory Structure

```
tradeline-btc-intelligence/
├── docs/                           # Architectural, backend and presentation docs
│   ├── BACKEND.md                  # Scope and contract for backend integration
│   ├── DECK-COPY.md                # Presentation script & verified deck metrics
│   └── TECHNICAL-WRITEUP.md        # Mathematical derivations and ML methodology
├── public/                         # Static runtime assets
│   ├── favicon.svg                 # Application vector icon
│   ├── geoip/                      # Offline compiled MaxMind GeoIP dataset
│   │   └── ipv4-country.json       # Binary-searchable IPv4 CIDR range table
│   └── samples/                    # Test and demonstration datasets
│       ├── adversarial-worst-capture.csv  # Edge cases & corrupt records
│       ├── capture-raw-messy.csv   # Dirty export for auto-clean testing
│       ├── capture-sample.csv      # Standard canonical CSV sample
│       ├── capture-sample.json     # Standard canonical JSON sample
│       └── capture-sample.xml      # Standard canonical XML sample
├── scripts/                        # Headless developer tools & verification gates
│   ├── build-geoip.ts              # GeoLite2 CSV -> sorted JSON compiler
│   ├── emit-sample.ts              # Synthetic ground-truth generator
│   ├── inspect-clean.ts            # Headless data-cleaner diagnostic
│   ├── inspect-imported.ts         # Ingestion-to-model refit assertion
│   ├── inspect-model.ts            # Headless scoring & telemetry viewer
│   ├── linux-demo.sh               # Automated terminal presentation script
│   ├── test-worst-data.ts          # Adversarial parser fuzz testing
│   └── verify-pipeline.ts          # CI regression gate (asserts all 5 formats)
├── src/                            # Application source code
│   ├── components/                 # React UI components
│   │   ├── Boot.tsx                # Initial splash and subsystem loading gate
│   │   ├── FilterPanel.tsx         # Entity, risk threshold and cluster filters
│   │   ├── PatternGlyph.tsx        # SVG indicators for forensic patterns
│   │   ├── PrepareBox.tsx          # Data preparation and repair report modal
│   │   ├── StatusBar.tsx           # Subsystem health, memory & motion status
│   │   ├── TopRail.tsx             # Module navigation and view switcher
│   │   ├── ui.tsx                  # Buttons, badges, metric cards, dialogs
│   │   ├── panels/                 # Analytical investigation drawers
│   │   │   ├── IntelPanel.tsx      # Comprehensive entity metadata viewer
│   │   │   ├── LeadPanel.tsx       # Forensic investigative lead dossier
│   │   │   ├── ReplayPanel.tsx     # Chronological transaction playback engine
│   │   │   ├── Timeline.tsx        # Temporal event sequence visualization
│   │   │   ├── TracePanel.tsx      # Multi-hop BFS money-flow explorer
│   │   │   └── WhyPanel.tsx        # Feature ablation XAI explanation view
│   │   └── views/                  # Primary workspace screens
│   │       ├── AlertCentre.tsx     # Prioritized forensic triage table
│   │       ├── Command.tsx         # High-level mission overview dashboard
│   │       ├── GraphWorkspace.tsx  # 3D WebGL scene controller
│   │       ├── Intake.tsx          # Dual-stage preparation & drop workspace
│   │       └── PatternLab.tsx      # Forensic pattern laboratory
│   ├── data/                       # Pre-seeded synthetic scenario generator
│   ├── hooks/                      # Custom React UI and lifecycle hooks
│   ├── lib/                        # Core algorithms and business logic
│   │   ├── api.ts                  # NexusClient abstraction (Local vs HTTP)
│   │   ├── clean.ts                # Deterministic data repair engine
│   │   ├── entities.ts             # Entity resolution & co-spend grouping
│   │   ├── geoip.ts                # Binary search IP-to-country resolver
│   │   ├── graph.ts                # Central graph assembly, scoring & layout
│   │   ├── ingest.ts               # Multi-format parsers (CSV/TSV/JSON/XML)
│   │   ├── layout.ts               # 3D force simulation solver
│   │   ├── patterns.ts             # Heuristic pattern definitions & math
│   │   ├── rng.ts                  # Mulberry32 seeded pseudorandom generator
│   │   ├── taint.ts                # Proportional value-weighted taint diffusion
│   │   └── ml/                     # Machine learning algorithms
│   │       ├── features.ts         # Feature extraction & ablation XAI
│   │       └── isolationForest.ts  # In-process Isolation Forest implementation
│   ├── scene/                      # Three.js / WebGL visualization layer
│   │   ├── CameraRig.tsx           # Smooth orbital camera controls
│   │   ├── Dust.tsx                # Ambient spatial depth particles
│   │   ├── Edges.tsx               # Batched LineSegments value-flow links
│   │   ├── GraphCanvas.tsx         # Three.js canvas container
│   │   ├── GraphScene.tsx          # Root 3D scene composition
│   │   ├── Halo.tsx                # Additive glow shader mesh for risk
│   │   ├── Nodes.tsx               # InstancedMesh rendering for graph entities
│   │   ├── Particles.tsx           # Animated transaction velocity pulses
│   │   ├── RangeRings.tsx          # Concentric coordinate plane markers
│   │   ├── constants.ts            # Visual themes, node colors, dimensions
│   │   └── useVisuals.ts           # Visual state calculation and interpolation
│   ├── state/                      # Global store
│   │   └── store.ts                # Zustand store (graph, selection, modules)
│   ├── styles/                     # Tailwind CSS and font stylesheets
│   ├── types/                      # Domain interfaces and type definitions
│   ├── App.tsx                     # Main application layout wrapper
│   └── main.tsx                    # React application entry point
├── package.json                    # Project configuration and script manifests
├── tailwind.config.js              # Theme design tokens & custom colors
├── tsconfig.json                   # TypeScript compiler options
└── vite.config.ts                  # Vite build and asset pipeline configuration
```

### State & Service Layer

The application operates through the `NexusClient` abstraction defined in [src/lib/api.ts](src/lib/api.ts).
- By default, it runs `LocalEngineClient`, executing the entire ingestion, resolution, layout, ML fitting, and scoring pipeline in-memory within Web Workers or browser threads.
- When `VITE_NEXUS_API` is set, the workstation switches dynamically to `HttpClient`, querying remote REST endpoints while preserving identical UI rendering and state behaviors.

---

## Forensic & Detection Engine

### 1. Entity Resolution (Common-Input-Ownership)

In Bitcoin, when a single transaction spends inputs from multiple distinct addresses, the spending party must hold the private keys for all those input addresses. Therefore, those addresses can be resolved to a single controlling entity.

$$\text{Inputs}(tx) = \{a_1, a_2, \dots, a_k\} \implies \text{Owner}(a_1) = \text{Owner}(a_2) = \dots = \text{Owner}(a_k)$$

#### Defense Against CoinJoin Poisoning
CoinJoin transactions deliberately combine inputs from multiple independent participants to obfuscate the money trail and poison co-spend clustering heuristics. If a naive algorithm clusters CoinJoin inputs, it merges unrelated entities into a gigantic, false multi-address group.

TRADELINE explicitly identifies and **excludes CoinJoin transactions from entity merging**:
$$\text{IsCoinJoin}(tx) \iff |\text{Inputs}(tx)| \ge 3 \land |\text{Outputs}(tx)| \ge 3 \land \frac{\sigma(\text{Output Amounts})}{\mu(\text{Output Amounts})} < 0.10$$

When this condition is met, inputs are preserved as independent entities, neutralizing the adversarial obfuscation attempt.

---

### 2. The 6 Behavioural Pattern Detectors

TRADELINE continuously evaluates six rule-based pattern detectors over the temporal graph. Each detector addresses a distinct money-laundering or capital-flight topology:

| Detector | Shape | Exact Mathematical Rule | Analytical Meaning | Recommended Analyst Action |
| :--- | :--- | :--- | :--- | :--- |
| **Fan-Out** | $1 \to N$ | $\text{out-degree}(w, \Delta t) \ge 12 \land \frac{\sigma(amount)}{\mu(amount)} < 0.45$ | Single wallet disperses near-uniform amounts to many destinations within a short window. | Treat source wallet as primary subject; destinations represent the dispersal perimeter. |
| **Fan-In** | $N \to 1$ | $\text{in-degree}(w, \Delta t) \ge 12 \land \text{distinct\_sources} \ge 10$ | Funds consolidate from many independent wallets into a single collection address. | Identify collector; inspect next hop for liquidity pools or fiat off-ramps. |
| **Rapid Movement** | Short Dwell | $\text{median}(t_{out} - t_{in}) < 120\text{s} \text{ across } \ge 3 \text{ consecutive wallets}$ | Automated hopping before a human could manually sign; attempts to break temporal correlation. | Follow relay end-to-end; the ultimate resting terminus is the primary target. |
| **Burst Activity** | High Frequency | $\text{rate}(\Delta t = 600\text{s}) > 8 \times \text{baseline\_rate}(\text{cluster})$ | Transaction frequency inside a cluster spikes dramatically above its moving baseline. | Bound the active time window; enumerate all participating addresses. |
| **Peeling Chain** | $A \to B \to C \to D$ | $\text{chain\_len} \ge 4 \land 0.10 < \text{peel\_ratio} < 0.40 \text{ per hop}$ | High balance sheds small fractions at each hop (candidate cash-outs) while remainder moves on. | Trace forward to terminus and backward to original deposit point. |
| **CoinJoin / Mixing** | $N \rightleftarrows N$ | $\text{inputs} \ge 3 \land \text{outputs} \ge 3 \land \frac{\sigma(\text{out})}{\mu(\text{out})} < 0.10$ | Multi-party collaborative transaction with identical output denominations. | Avoid tracing value directly through mixing node; record participants and pick up trails on either side. |

---

### 3. Unsupervised Machine Learning (Isolation Forest)

Real-world Bitcoin captures arrive unlabelled. Supervised models (e.g. Random Forests, XGBoost) require labelled classes ("licit" vs. "illicit"), which do not exist in raw traffic.

TRADELINE implements an in-process, pure TypeScript **Isolation Forest** (Liu, Ting & Zhou, 2008) in [src/lib/ml/isolationForest.ts](src/lib/ml/isolationForest.ts). It exploits the fact that anomalous wallets have structural feature properties that make them **few and different**, isolating them in significantly fewer random tree partitions than normal wallets.

#### Mathematical Foundation
For a dataset of $n$ instances, the average path length of an unsuccessful search in a Binary Search Tree is:
$$c(n) = 2 \left( \ln(n - 1) + \gamma \right) - \frac{2(n - 1)}{n}$$
*(where $\gamma \approx 0.5772156649$ is the Euler–Mascheroni constant).*

Given an ensemble of $t$ isolation trees, the anomaly score $s(x, n)$ for an instance $x$ is:
$$s(x, n) = 2^{-\frac{\mathbb{E}(h(x))}{c(n)}}$$
- If $\mathbb{E}(h(x)) \to 0$, $s \to 1$ (highly anomalous).
- If $\mathbb{E}(h(x)) \to c(n)$, $s \to 0.5$ (structurally average).
- If $\mathbb{E}(h(x)) \to n - 1$, $s \to 0$ (highly normal/clustered).

#### Hyperparameters
- **Tree Count**: 120 trees.
- **Subsample Size**: 256 rows drawn without replacement per tree (eliminates swamping and masking effects).
- **Max Depth**: $\lceil \log_2(\text{subsample}) \rceil = 8$.
- **Seed**: `26146` via Mulberry32 PRNG (ensures 100% deterministic reproducibility across platforms).

#### The 8 Per-Wallet Features
Every feature is derived exclusively from the capture window:

1. **Outgoing Degree**: Count of distinct counterparties sent to.
2. **Incoming Degree**: Count of distinct counterparties received from.
3. **Transaction Count**: Total transaction events involving the wallet.
4. **Value Moved**: Log-scaled total volume transacted ($\ln(1 + \text{volume})$).
5. **Velocity**: Inverse median inter-transaction gap time ($\text{velocity} = 8 - \ln(\text{gap})$).
6. **Amount Uniformity**: Inverse coefficient of variation of output amounts ($\frac{1}{1 + \sigma/\mu}$).
7. **Burst Fan-Out**: Maximum counterparties transacted with inside any rolling 15-minute window.
8. **Outputs per Transaction**: Average number of outputs per spend transaction.

---

### 4. Explainable AI (Per-Instance Feature Ablation)

Rather than treating the Isolation Forest as a black box, TRADELINE computes **per-instance feature ablation** ([src/lib/ml/features.ts](src/lib/ml/features.ts)):

1. Given a scored wallet vector $x = [f_1, f_2, \dots, f_8]$ with base anomaly score $S = \text{score}(x)$.
2. For each feature $i \in [1..8]$, the feature value $f_i$ is replaced with the capture population median $\tilde{f}_i$:
   $$x^{(i)} = [f_1, \dots, \tilde{f}_i, \dots, f_8]$$
3. The model re-scores the ablated vector: $S^{(i)} = \text{score}(x^{(i)})$.
4. The score drop $\Delta_i = \max(0, S - S^{(i)})$ represents feature $i$'s marginal responsibility for the anomaly.
5. Relative importance shares are normalized:
   $$\text{Share}_i = \frac{\Delta_i}{\sum_{k=1}^8 \Delta_k}$$

The analyst is presented with clear, human-auditable evidence:
> *"Burst fan-out: 25%, Transaction count: 23%, Outgoing degree: 20% — 17 counterparties inside one 15-minute window."*

---

### 5. Value-Weighted Taint Diffusion

Wallets can be suspicious not only due to their own behavior, but also because of the origin of the funds they receive. TRADELINE implements value-weighted taint diffusion ([src/lib/taint.ts](src/lib/taint.ts)):

- Seed illicit wallets (anchors identified by detectors or watchlists) start with an initial taint of $T_0 = 1.0$.
- Taint diffuses forward chronologically along spending edges.
- When transaction $tx$ spends tainted inputs, taint is allocated across output addresses **in exact proportion to the satoshi value each output receives**:
  $$T_{out} = T_{in} \times \left( \frac{\text{Amount}_{out}}{\sum \text{Amount}_{outputs}} \right) \times \gamma$$
- **Decay Factor ($\gamma$)**: $0.60$ per hop.
- **Maximum Depth**: 5 hops.
- **Noise Floor**: Taint values below $0.02$ are pruned to prevent graph pollution.
- A wallet's final taint is defined as the maximum taint along the single strongest chain that reached it, ensuring legal defensibility without additive coincidence errors.

---

### 6. Composite Risk Scoring & Confidence

Every entity is assigned a composite risk score from $0$ to $100$, compiled from six independently calculated signals:

$$\text{Risk} = \sum_{k=1}^6 w_k \cdot S_k$$

| Signal ($S_k$) | Weight ($w_k$) | Description & Derivation |
| :--- | :---: | :--- |
| **Model Anomaly** | **0.22** | Isolation Forest score stretched against capture min/max percentiles. |
| **Transaction** | **0.20** | Total volume and transaction velocity vs. 94th percentile thresholds. |
| **Graph Topology** | **0.18** | Degree centrality and behavioral cluster bridging count. |
| **Behaviour** | **0.16** | Fired rule detectors and whether the wallet is an anchor. |
| **Seed Proximity** | **0.12** | Proportional taint received from known suspicious seed nodes. |
| **Temporal** | **0.12** | Inter-transaction latency and burst timing dynamics. |

#### Confidence Metric
Confidence ($C \in [0, 1]$) does not measure certainty in guilt; it measures the **agreement and corroboration among independent signals**. One loud signal with five silent ones produces low confidence; three concordant signals produce high confidence:

$$C = \min\left(0.985, 0.46 + 0.075 \times \min(4, \text{evidenceCount}) + 0.20 \times \text{Agreement} + 0.09 \times \frac{\text{Risk}}{100}\right)$$

where $\text{Agreement} = 1 - \min\left(1, \frac{\sigma(\text{signals})}{46}\right)$.

---

## Intake & Data Preparation Engine

Raw forensic data exports are notoriously messy. Headers vary between tools, dates use local machine timezones, amounts mix satoshis and BTC symbols, and IP addresses weld ports directly to host strings.

### The 14 Canonical Fields

| Canonical Column | Data Type | Permitted Aliases & Variations | Description |
| :--- | :--- | :--- | :--- |
| `timestamp` | String / Int | `time`, `ts`, `datetime`, `date`, `observed_at`, `block_time` | ISO 8601 string or epoch milliseconds |
| `txid` | String | `tx_id`, `tx`, `transaction_id`, `hash`, `txhash` | Unique 64-char transaction hash |
| `src_ip` | String | `source_ip`, `srcip`, `ip`, `from_ip`, `host` | IPv4 or IPv6 of broadcasting node |
| `dst_ip` | String | `dest_ip`, `destination_ip`, `dstip`, `peer_ip` | IPv4 or IPv6 of relay peer |
| `src_port` | Integer | `source_port`, `srcport`, `port`, `from_port` | Source TCP port (Default: 8333) |
| `dst_port` | Integer | `dest_port`, `dstport`, `to_port`, `peer_port` | Destination TCP port (Default: 8333) |
| `input_addresses` | Array[Str] | `inputs`, `input_addrs`, `in_addresses`, `from_addresses` | JSON array or pipe-separated (`\|`) list |
| `output_addresses`| Array[Str] | `outputs`, `output_addrs`, `out_addresses`, `to_addresses`| JSON array or pipe-separated (`\|`) list |
| `input_amounts` | Array[Num] | `inputs_amounts`, `input_values`, `in_amounts` | BTC or satoshi values per input address |
| `output_amounts`| Array[Num] | `outputs_amounts`, `output_values`, `out_amounts` | BTC or satoshi values per output address |
| `fee` | Number | `txfee`, `fee_btc`, `miner_fee`, `fees` | Transaction fee in BTC |
| `script_type` | String | `scripttype`, `script`, `output_script_type` | `p2pkh`, `p2sh`, `p2wpkh`, `p2tr` |
| `geo_country` | String (2) | `country`, `country_code`, `geoip_country`, `cc` | ISO-3166-1 alpha-2 code (e.g. `US`, `DE`) |
| `asn` | String / Int | `as_number`, `autonomous_system`, `src_asn` | Autonomous System Number (e.g. `AS15169`) |

### Supported Capture Formats

- **CSV / TSV**: Comma or tab delimited, quotes supported, array fields formatted as JSON strings or pipe-delimited values (`addr1|addr2`).
- **JSON**: Array of objects matching canonical fields or aliased variants.
- **XML**: Hierarchical transaction records parsed via browser `DOMParser`.

### Deterministic Repair Rules vs. Loud Rejections

The intake engine adheres to a strict principle: **repair deterministically what is unambiguous, reject loudly what requires guesswork.**

#### Deterministic Repairs
- **Header Normalization**: Strips UTF-8 BOMs, whitespace, punctuation, and brackets; resolves column aliases automatically.
- **Satoshi Normalization**: Integer values $\ge 100,000$ or values marked with `sats` are divided by $10^8$ to convert to BTC.
- **Currency Mark Stripping**: Strips `₿`, `฿`, `$`, `€`, `£`, and comma thousand-separators.
- **Host / Port Decoupling**: Extracts `:port` from `192.168.1.1:8333` and bracketed IPv6 notation `[2001:db8::1]:8333`.
- **Timestamp Standardization**: Converts epoch seconds, epoch milliseconds, and date strings (`YYYY-MM-DD`, `DD/MM/YYYY`) to UTC ISO 8601.

#### Loud Rejections
- **Array Length Mismatches**: If `input_addresses` has 2 entries but `input_amounts` has 3 entries, attribution is impossible. The row is dropped and reported with its row number and reason.
- **Missing TXID**: Records lacking a transaction hash cannot be anchored to the ledger and are rejected.
- **Corrupted Timestamps**: Unparseable date strings are rejected.

### Offline GeoIP & ASN Resolution

When a capture omits `geo_country` or `asn`, TRADELINE resolves IP addresses against an offline database compiled from MaxMind GeoLite2 Country CSVs:
- Built file: `public/geoip/ipv4-country.json`.
- Lookup algorithm: Binary search over sorted integer IPv4 ranges.
- Lookup latency: $< 0.05\text{ ms}$ per IP.
- Network calls: **Zero**. If an IP is outside covered ranges, it is assigned `ZZ` rather than guessed.

---

## Analyst Workstation UI & Modules

### The 5 Operational Modules

```
[1] COMMAND     -> High-level operational overview, key counts, primary suspect, recent leads
[2] INVESTIGATE -> 3D WebGL entity graph, camera controls, node selection, inspection panels
[3] ALERTS      -> Prioritized work queue, severity triage, confidence metrics, pattern badges
[4] PATTERNS    -> Laboratory isolating each of the 6 behavioral detectors in the field
[5] INTAKE      -> Dual-stage file cleaner and capture drop zone
```

#### Module 1: Command
The executive dashboard displaying active capture statistics, entity counts, the primary suspect card (top risk entity), cluster risk breakdowns, and recently synthesized leads.

#### Module 2: Investigation (3D Field)
The central 3D WebGL workspace displaying the temporal entity graph. Nodes are categorized into three kinds:
- **Wallet Entities**: Spheres colored by risk severity with dynamic glow halos.
- **Transaction Nodes**: Intermediate routing points linking inputs to outputs.
- **Host Nodes**: IP relay broadcast observations.

#### Module 3: Alert Centre
A prioritized alert triage table sorted by risk and confidence. Supports instant filtering by priority (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), detector pattern, or minimum confidence threshold.

#### Module 4: Pattern Lab
A forensic laboratory isolating each of the six behavioral detectors. Selecting a pattern highlights its exact matching nodes and edges in the 3D space while muting extraneous background activity.

#### Module 5: Intake Hub
A dual-stage ingestion screen. The **Prepare** stage allows analysts to drag in messy exports, inspect the real-time auto-repair and rejection log, and download canonical CSVs. The **Drop** stage ingests canonical captures directly into the active graph.

---

### Intelligence Dock

Selecting any entity in the 3D field opens the lateral Intelligence Dock, featuring four contextual analytical modes:

- **OVERVIEW (`I`)**: Key wallet metadata, balances, transaction counts, counterparty degrees, and the 6-signal risk breakdown bar.
- **WHY (`W`)**: Explainable AI view showing the top feature ablation contributors and evidentiary graph anchors.
- **TRACE (`T`)**: Multi-hop forward and backward value-flow traversal (3, 5, or 10 hops) isolating taint chains.
- **REPLAY (`R`)**: Chronological transport controls with play/pause, scrub slider, and speed multipliers to reconstruct movement over time.

---

### Keyboard Navigation Reference

| Key | Action | Description |
| :---: | :--- | :--- |
| `1` | Open Command | Switch to the high-level mission overview dashboard. |
| `2` | Open Investigation | Switch to the 3D WebGL entity field. |
| `3` | Open Alerts | Switch to the alert triage queue. |
| `4` | Open Pattern Lab | Switch to forensic pattern inspection. |
| `5` | Open Intake | Switch to data preparation and capture import. |
| `I` | Dock: Overview | Open the entity overview drawer. |
| `W` | Dock: Why (XAI) | Open feature ablation explanation breakdown. |
| `T` | Dock: Trace | Open the forward/backward money flow tracer. |
| `R` | Dock: Replay | Open the temporal playback controls. |
| `E` | Expand Neighbors | Expand selection to include immediate graph counterparties. |
| `F` | Refocus Camera | Center 3D viewport camera on currently selected entity. |
| `Space` | Play / Pause | Toggle chronological transaction playback during replay. |
| `Esc` | Clear / Back | Clear active highlights $\to$ deselect entity $\to$ return to Command. |

---

### 3D Visualization & Graphics Optimization

- **Instanced Mesh Rendering**: Entities are rendered as instanced Three.js spheres grouped by entity kind, reducing draw calls from thousands to three.
- **Additive Halo Shader**: Custom WebGL shader material rendering soft, glowing halos whose radius and opacity scale with composite risk.
- **Single-Draw LineSegments**: Graph edges are rendered via a single batched `LineSegments` geometry using per-vertex colors, eliminating draw-call overhead.
- **Background Color Fading**: Unfocused nodes blend toward the deep background palette rather than using alpha transparency, eliminating expensive WebGL depth-sorting artifacts.
- **Adaptive Pruning**: On massive captures ($> 700$ nodes), the renderer automatically prunes low-value intermediate transaction nodes while retaining the primary wallet backbone.
- **Reduced Motion Support**: Detects operating system `prefers-reduced-motion` settings and provides a manual override in the status bar to disable camera pans and particle velocities.

---

## Developer Utilities & CLI Tooling

TRADELINE includes a suite of headless CLI utilities in `scripts/` that can be run in CI or on air-gapped hosts without launching a browser.

### Headless Verification Gate (`npm run verify`)

The primary regression and assertion gate. It runs ingestion, auto-cleaning, parsing, graph assembly, Isolation Forest fitting, taint propagation, and lead generation over five distinct capture inputs:

```bash
npm run verify
```

```
platform: win32 x64 | node v22.22.1
tz      : Asia/Calcutta

=== CSV   capture-sample ===
   ok    format detected                    CSV
   ok    records parsed                     157 records, 0 rejected
   ok    both sides populated               157/157 have input+output arrays
   ok    address/amount arrays aligned      157/157 aligned
   ok    timestamps normalised              every record has a parseable ISO timestamp
   ok    dataset is chronological           sorted regardless of source order
   ok    dataset built                      79 wallets, 157 tx
   ok    model fitted on THIS capture       trainedOn 79 === wallets 79
   ok    every wallet scored                79 scored
   ok    scores discriminate                78 distinct values, 0.3847–0.7739
   ok    scores in range                    all within [0,1]
   ok    explanations produced              54 wallets have ranked feature contributions
   ok    model reaches the evidence         MODEL ANOMALY row present in a lead
   ok    detectors fired                    FAN-OUT, FAN-IN, RAPID, BURST, PEELING, COINJOIN
   ok    alerts generated                   34 alerts, 6 leads

=== CSV   raw-messy ===
   ok    preparation accepted rows          95 in → 90 clean, 4 rejected
   ok    preparation rejects the unusable   refuses bad rows rather than guessing
   ok    scores discriminate                64 distinct values, 0.3732–0.7939

ALL CHECKS PASSED
```

---

### Model Inspection & Telemetry (`npm run inspect`)

Prints the internal scoring distribution, top risk subjects, Isolation Forest hyperparameters, and explainability contributions:

```bash
npm run inspect
```

```
entities 253 edges 402
model: Isolation Forest | 120 trees | sample 79 | trained on 79 wallets

top wallets by risk
  w014 bc1q2r…x58s risk 92 conf 0.963 CRITICAL | tran:100 grap:100 temp:50 beha:89 anom:100 tain:100
  w034 bc1qgz…rpwy risk 81 conf 0.735 HIGH     | tran:64  grap:76  temp:56 beha:84 anom:100 tain:100
  w058 bc1qnw…uk5g risk 79 conf 0.944 HIGH     | tran:97  grap:85  temp:45 beha:85 anom:59  tain:100

primary subject w014 (Risk 92, Conf 0.963)
  anomaly contributions:
    25% Burst fan-out — 17 counterparties inside one 15-minute window
    23% Transaction count — 23 transactions in the window
    20% Outgoing degree — spends to 22 counterparties
    12% Value moved — 13.87 BTC total in and out
    11% Amount uniformity — output spread σ/μ = 1.94
     7% Velocity — median gap 28s
```

---

### Data Cleaning Diagnostics (`npm run inspect:clean`)

Runs the preparation engine over `public/samples/capture-raw-messy.csv` and outputs the exact mapping, repair tallies, and rejected row explanations:

```bash
npm run inspect:clean
```

---

### Import Pipeline Assertion (`npm run inspect:imported`)

Validates that when a new capture is imported, the Isolation Forest **refits on the imported dataset** rather than retaining cached weights from synthetic data:

```bash
npm run inspect:imported
```

---

### Sample Capture Generation (`npm run samples`)

Regenerates the standard synthetic datasets in `public/samples/` using deterministic seeds:

```bash
npm run samples
```

---

## Production & Containerized Deployment

### Docker Container Deployment

You can deploy TRADELINE in an isolated, containerized environment using Docker.

#### 1. Create Dockerfile
```dockerfile
# Multi-stage build for minimal container size
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Static file serving stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. Build and Run Image
```bash
docker build -t tradeline-workstation:1.0 .
docker run -d -p 5173:80 --name tradeline tradeline-workstation:1.0
```

Access the application at `http://localhost:5173`.

---

### Connecting an External Backend (FastAPI Bridge)

While TRADELINE executes all processing in-browser by default, it can integrate with an external graph and analytics backend. Set the environment variable:

```bash
VITE_NEXUS_API=http://127.0.0.1:8000
```

The application will automatically switch from `LocalEngineClient` to `HttpClient`, querying three standard endpoints documented in [docs/BACKEND.md](docs/BACKEND.md):

#### 1. `GET /health`
Returns service availability, model readiness, and local latency:
```json
{
  "network": "OFFLINE",
  "model": "READY",
  "dataset": "READY",
  "engine": "tradeline-engine/1.0",
  "buildId": "TRADELINE.1.0",
  "latencyMs": 0
}
```

#### 2. `POST /ingest`
Accepts `multipart/form-data` with a raw capture file (`CSV`, `JSON`, or `XML`), parses and scores the dataset, and returns the full analysis payload.

#### 3. `GET /analysis`
Returns the complete graph entities, layout coordinates, risk scores, detectors, alerts, and investigative leads in a unified JSON payload (~200 KB).

---

## Environment Variables

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `VITE_NEXUS_API` | String | `""` (empty) | Base URL for remote backend API. When empty, runs 100% in-process locally. |

---

## Available NPM Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Starts local development server at `http://localhost:5173`. |
| `npm run build` | `tsc -b && vite build` | Type-checks code and compiles production static bundle to `dist/`. |
| `npm run preview` | `vite preview` | Previews the compiled `dist/` production bundle locally. |
| `npm run typecheck` | `tsc --noEmit` | Runs strict TypeScript compiler check without emitting output. |
| `npm run verify` | `esbuild & node verify` | Headless CI verification gate testing all 5 capture formats. |
| `npm run inspect` | `esbuild & node inspect` | Headless model telemetry, scoring distributions, and top leads. |
| `npm run inspect:clean` | `esbuild & node clean` | Diagnostic breakdown of raw capture preparation and repairs. |
| `npm run inspect:imported`| `esbuild & node imported`| Validates dynamic model refitting on imported files. |
| `npm run samples` | `esbuild & node emit` | Regenerates seeded synthetic sample captures in `public/samples/`. |
| `npm run geoip` | `esbuild & node geoip` | Compiles MaxMind GeoLite2 CSV export into sorted offline JSON. |

---

## Troubleshooting & FAQ

### 1. WebGL Performance is Slow on Headless Linux
**Cause:** When running on Linux systems without proprietary GPU display drivers (e.g. standard virtual machines or bare servers), the browser falls back to software rendering (LLVMpipe).
**Solution:** Enable hardware acceleration in your browser flags, or install the appropriate proprietary graphics drivers (`nvidia-driver` / `mesa-va-drivers`). The build and detection engine remain fully functional regardless of GPU capability.

### 2. XML Ingestion Fails Headlessly
**Cause:** The XML parser utilizes the browser's native `DOMParser` API, which is unavailable in standard Node.js headless runtimes.
**Solution:** Headless testing via `npm run verify` notes this nuance automatically. Test XML imports in the browser UI, or verify CSV and JSON formats headlessly.

### 3. Port 5173 is Already in Use
**Cause:** Another local development server or service is occupying port 5173.
**Solution:** Specify a custom port when starting Vite or the static server:
```bash
npx vite --port 8080
# or
npx serve dist -l 8080
```

### 4. GeoIP Lookup Displays `ZZ` for Countries
**Cause:** The capture does not specify `geo_country`, and the optional MaxMind database has not been compiled into `public/geoip/ipv4-country.json`.
**Solution:** Extract a MaxMind GeoLite2 Country CSV export and run:
```bash
npm run geoip ./path-to-geolite2-folder
```
Rebuild with `npm run build`.

---

## Honest Limits & Future Work

- **Synthetic vs. Real Captures**: Sample captures contain planted forensic patterns to verify detector mechanics against ground truth. Detection rates on synthetic data do not constitute field generalization benchmarks.
- **Lack of Ground-Truth Labels**: Because public blockchain captures arrive unlabelled, quoting traditional precision/recall statistics would be fabricated. Anomaly thresholds are tuned to empirical distribution spreads.
- **IP Attribution as Correlation**: Network host observations link a transaction broadcast to a relaying IP address. They do not prove legal wallet ownership or physical identity.
- **Subsampling Behavior on Small Captures**: The Isolation Forest samples 256 instances per tree. When a capture contains fewer than 256 wallets, trees are fit on all available rows, meaning randomness is derived exclusively from split-point selection.
- **Future Roadmap**: Integration of Graph Neural Networks (GNNs) with supervised benchmarks (e.g. Elliptic dataset) when operating in non-air-gapped training environments.

---

## Contributing

Contributions from forensic analysts, cryptographers, and engineers are welcome. Please adhere to these guidelines:

1. **Fork the Repository** and create a descriptive feature branch (`git checkout -b feature/new-detector`).
2. **Preserve Offline Integrity**: Ensure no external network requests, CDNs, or telemetry hooks are introduced.
3. **Validate Gates**: All PRs must pass `npm run typecheck`, `npm run build`, and `npm run verify`.
4. **Submit a Pull Request** with detailed documentation of changes and forensic rationale.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete details.
