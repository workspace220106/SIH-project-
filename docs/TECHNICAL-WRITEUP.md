# Technical write-up

**AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic**
*Tradeline*

Approach, model choice and explainability method.

---

## 1. Approach

Five stages, run in order:

```
PREPARE → INGEST → CORRELATE → DETECT → EXPLAIN
```

**Prepare.** Captures arrive dirty: header names vary by exporter, dates follow whatever the
local machine used, amounts come in satoshis or with a currency mark, ports are attached to
addresses, array columns use three different encodings. This stage repairs what it can repair
deterministically and rejects the rest, naming the line and the reason.

An address array of length 2 with an amount array of length 3 cannot have value attributed to
an address, so the row is dropped rather than guessed at.

**Ingest.** One row is one transaction. `input_addresses[]` / `output_addresses[]` and their
amount arrays give both sides, so fan-in, fan-out and peeling are read off the record instead of
being inferred from row order.

**Correlate.** Network fields (`src_ip`, `dst_ip`, ports, timing) are joined to blockchain fields
(txid, addresses, amounts) into one temporal graph with three node types (wallet, transaction,
host) and two edge types (value flow, host link). A transaction is a node rather than an edge, so
a fan-out is visibly a fan and each side carries its own value.

**Detect.** Six rule detectors and one model run over the same graph, independently. Agreement
between them drives confidence.

**Explain.** Every score breaks down into ranked evidence, and each piece of evidence points at
the nodes and edges it came from. Selecting a reason isolates that evidence in the graph.

---

## 2. Model choice

### Isolation Forest

120 trees over 256-row subsamples, fitted on whatever capture is loaded, across eight per-wallet
features. `src/lib/ml/isolationForest.ts`.

**Why unsupervised.** A capture has no labels. Nobody has marked which wallets are illicit and
there is no ground truth supplied, so a classifier has nothing to train against. Inventing labels
would mean the model learns the labelling rule instead of the data.

**Why this one.** Isolation Forest needs no labels. Anomalies are few and different, so fewer
random splits isolate them. The score is average path length to isolation, normalised against
what an ordinary point needs. It is cheap, deterministic under a seed, and runs in-process in
well under a second, which is what keeps the system offline with no inference service.

**Alternatives.** Gradient-boosted classifiers are the obvious choice when labels exist; they do
not here. Graph neural networks are the strongest published results in this area and are the right
direction given a labelled corpus such as Elliptic, but they need a training pipeline an offline
deployment cannot assume. Both are future work, not claims.

### Features

| Feature | Reads as |
| --- | --- |
| Outgoing degree | how many counterparties it spends to |
| Incoming degree | how many it receives from |
| Transaction count | activity in the window |
| Value moved | total in and out, log-scaled |
| Velocity | inverse of the median inter-transaction gap |
| Amount uniformity | inverse coefficient of variation of amounts sent |
| Burst fan-out | most counterparties inside any 15-minute window |
| Outputs per transaction | mean output count of the transactions it spends from |

All eight come from the capture alone and are expressible in plain words, which is what makes the
explanation useful.

### Rule detectors

Rules sit alongside the model. They carry domain knowledge eight features cannot, and they are why
a score can be justified in a sentence.

| Detector | Rule |
| --- | --- |
| Fan-out | `out-degree(w, Δt) ≥ 12 ∧ σ(amount)/μ(amount) < 0.45` |
| Fan-in | `in-degree(w, Δt) ≥ 12 ∧ distinct_sources ≥ 10` |
| Rapid movement | `median(t_out − t_in) < 120s across ≥ 3 consecutive wallets` |
| Burst activity | `rate(Δt=600s) > 8 × baseline_rate(cluster)` |
| Peeling / multi-hop | `chain_len ≥ 4 ∧ 0.10 < peel_ratio < 0.40 per hop` |
| CoinJoin / mixing | `inputs ≥ 3 ∧ outputs ≥ 3 ∧ σ(out)/μ(out) < 0.10` |

### Entity resolution

Addresses spent together as inputs need the same private keys, so they are one entity.

CoinJoin-like transactions are excluded from the merge. CoinJoin exists to defeat this heuristic —
its inputs come from different parties who combined a spend deliberately — so merging them gives
the wrong owner. The heuristic did produce that false group during development, before the
exclusion was added.

### Risk propagation

Taint starts at 1.0 on each seed (a wallet a detector named as an anchor; a watchlist entry in
deployment), splits across a transaction's outputs in proportion to the value each received, and
decays 0.6 per hop over at most five hops. A wallet's taint is the strongest single chain that
reached it.

Splitting by value is what stops a 0.001 BTC payment into a busy wallet from tainting everything
downstream.

### Composite score

| Signal | Weight |
| --- | --- |
| Model anomaly | 0.22 |
| Transaction | 0.20 |
| Graph | 0.18 |
| Behaviour | 0.16 |
| Seed proximity | 0.12 |
| Temporal | 0.12 |

Confidence rises with the number of corroborating detections and with agreement between signals.
One loud signal counts for less than three that concur.

---

## 3. Explainability

Per-instance feature ablation.

Each feature is reset to the population median in turn and the wallet re-scored. The drop in score
is that feature's contribution. Contributions are normalised to shares and reported with the
underlying value.

Chosen over SHAP because it is exact for this model, needs no extra dependency, and gives a number
an investigator can repeat without knowing the algorithm:

> Burst fan-out 25%, Transaction count 23%, Outgoing degree 20% — 17 counterparties inside one
> 15-minute window.

Explanation is not limited to the model. Every contributor to a score produces an evidence row —
the model, each matched detector, seed proximity, graph connectivity — and each names the entities
and edges behind it. Selecting one isolates that evidence in the 3D graph.

---

## 4. Limits

- **The synthetic capture has planted patterns.** Detector output can be checked against known
  ground truth, which is the point, but detection rates measured on it are not generalisation
  estimates.
- **No labelled corpus, so no precision or recall.** Any figure would be invented.
- **IP attribution is correlation.** A host observation links a broadcast to an address. It does
  not establish who controlled the wallet, and the interface does not claim otherwise.
- **GeoLite2 is not shipped.** Country and ASN come from the capture, which the field spec requires
  it to carry. The database is a fallback for captures that omit them, installed with
  `npm run geoip`.
- **Sub-sampling does nothing on small captures.** The forest draws 256 rows per tree, so a capture
  with fewer wallets trains every tree on the whole set and the only randomness left is the split
  points. That removes the protection against swamping and masking. Scores still discriminate — 64
  distinct values across 66 wallets on the imported sample — but the trees are more correlated than
  the method assumes.
- **No graph embeddings.** Entity clustering uses the co-spend heuristic only.

---

## 5. Reproducing

```bash
npm install
npm run dev              # workstation at http://localhost:5173
npm run verify           # asserts the pipeline across every input path
npm run inspect          # detection engine with model output
npm run inspect:clean    # preparation stage over the messy sample
npm run inspect:imported # clean → parse → assemble
```

`inspect:imported` answers one question: does the model refit on an imported capture, or is it only
ever fitted on the synthetic one? It asserts the fitted wallet count matches the imported dataset,
differs from the synthetic fit, and that scores vary rather than collapsing to a constant.

The generator and the model are seeded, so every figure here reproduces exactly.
