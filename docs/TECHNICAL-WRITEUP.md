# Technical write-up

**AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic**
NTRO · Problem Statement 26146 · Team Ben 10 · *Tradeline*

This is the deliverable the problem statement asks for: approach, model choice, and
explainability method. It is deliberately short. The running system is the argument; this
document exists so a reader can check what it claims before trusting it.

---

## 1. Approach

The system runs entirely on one machine, offline, in five stages.

```
PREPARE → INGEST → CORRELATE → DETECT → EXPLAIN
```

**Prepare.** Captures arrive dirty. Headers are named by whoever wrote the exporter, dates follow
whatever convention the local machine used, amounts appear in satoshis or carry a currency mark,
ports are welded onto addresses, and array columns are encoded three different ways. The
preparation stage repairs what can be repaired deterministically and rejects what cannot, then
emits a canonical CSV the analyst can inspect and keep.

The rule throughout is that **guessing quietly is worse than failing loudly**. An address array of
length 2 alongside an amount array of length 3 means value cannot be attributed to an address, so
the row is dropped and the report names the line and the reason.

**Ingest.** One row is one transaction. `input_addresses[]` / `output_addresses[]` and their
amount arrays give both sides directly, so fan-in, fan-out and peeling are read off the record
rather than inferred from row ordering.

**Correlate.** Network-layer observations (`src_ip`, `dst_ip`, ports, timing) are joined to
blockchain-layer facts (txid, addresses, amounts) into one temporal entity graph with three node
kinds — wallet, transaction, host — and two edge kinds — value flow and host link. A transaction
is a node rather than an edge, so a fan-out is visibly a fan and every side carries its own value.

**Detect.** Six rule-based detectors and one machine-learning model run over the same graph,
independently. Agreement between them is what produces confidence; disagreement is visible rather
than averaged away.

**Explain.** Every score decomposes into ranked evidence, and every piece of evidence is bound to
the nodes and edges it came from. Selecting a reason isolates that evidence in the graph. Nothing
in the interface asserts a conclusion the analyst cannot check.

---

## 2. Model choice

### The model: Isolation Forest

120 trees over 256-row subsamples, fitted on whatever capture is loaded, over eight per-wallet
features. Implemented in `src/lib/ml/isolationForest.ts`.

**Why unsupervised, and why this one.** A capture arrives with no labels. Nobody has marked which
wallets are illicit, and the problem statement supplies no ground truth — so a classifier has
nothing to train against. Any supervised approach here would require inventing labels, which would
mean the model learns the labelling rule rather than the data.

Isolation Forest needs no labels. It exploits a structural property of anomalies — that they are
**few and different** — and therefore isolated by fewer random splits than ordinary points. The
score is the average path length to isolation, normalised against what an ordinary point would
need.

It is also cheap, deterministic under a seed, and small enough to run in-process in well under a
second, which is what lets the whole system stay offline with no inference service.

**Alternatives considered.** A gradient-boosted classifier (XGBoost and similar) is the obvious
choice when labels exist; here they do not. Graph neural networks are the strongest published
results in this space, and are the right direction with a labelled corpus such as Elliptic, but
they need training data and a training pipeline that a fully offline deployment cannot assume.
Both are recorded as future work rather than claimed.

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

Every feature is derived from the capture alone and is phrasable in plain words, which is what
makes the explanation meaningful rather than decorative.

### The rest of the detection layer

Rules are kept alongside the model, not replaced by it. They encode domain knowledge the model
cannot infer from eight features, and they are the reason a score can be justified in a sentence.

| Detector | Rule |
| --- | --- |
| Fan-out | `out-degree(w, Δt) ≥ 12 ∧ σ(amount)/μ(amount) < 0.45` |
| Fan-in | `in-degree(w, Δt) ≥ 12 ∧ distinct_sources ≥ 10` |
| Rapid movement | `median(t_out − t_in) < 120s across ≥ 3 consecutive wallets` |
| Burst activity | `rate(Δt=600s) > 8 × baseline_rate(cluster)` |
| Peeling / multi-hop | `chain_len ≥ 4 ∧ 0.10 < peel_ratio < 0.40 per hop` |
| CoinJoin / mixing | `inputs ≥ 3 ∧ outputs ≥ 3 ∧ σ(out)/μ(out) < 0.10` |

### Entity resolution

**Common-input-ownership.** Addresses spent together in one transaction must share a private key
holder, so they are one entity.

CoinJoin-like transactions are **excluded** from the merge. CoinJoin exists specifically to poison
this heuristic — its inputs come from different parties who deliberately combined a spend — and
treating them as one owner is exactly the error it is designed to produce. During development the
heuristic did produce that false entity group before the exclusion was added.

### Risk propagation

A wallet can be interesting because of what reached it, not only because of how it behaves. Taint
starts at 1.0 on each seed (a wallet a detector named as an anchor; in deployment, a watchlist
entry), is split across a transaction's outputs **in proportion to the value each received**, and
decays 0.6 per hop over at most five hops. A wallet's taint is the strongest single chain that
reached it.

Proportional splitting is what stops a 0.001 BTC payment into a busy wallet from painting
everything downstream.

### Composite score

Six signals, weighted:

| Signal | Weight |
| --- | --- |
| Model anomaly | 0.22 |
| Transaction | 0.20 |
| Graph | 0.18 |
| Behaviour | 0.16 |
| Seed proximity | 0.12 |
| Temporal | 0.12 |

Confidence rises with the number of corroborating detections **and with agreement between the
signals** — one loud signal is treated as weaker evidence than three that concur, which is the
behaviour an investigator expects.

---

## 3. Explainability method

**Per-instance feature ablation.**

For a given wallet, each feature is reset to the population median in turn and the wallet is
re-scored. The drop in anomaly score is that feature's contribution: if making a wallet ordinary
in one dimension makes it look far less anomalous, that dimension is what the model reacted to.
Contributions are normalised to shares and reported with the underlying value.

This is the same idea as permutation importance, applied to a single prediction rather than to the
model as a whole. It was chosen over SHAP because it is exact for this model, needs no additional
dependency, and produces a number an investigator can restate without understanding the algorithm:

> Burst fan-out 25%, Transaction count 23%, Outgoing degree 20% — 17 counterparties inside one
> 15-minute window.

**Explanation is not confined to the model.** Every contributor to a score produces a ranked
evidence row — the model, each matched detector, seed proximity, and graph connectivity — and each
row names the entities and edges it was derived from. Selecting one isolates exactly that evidence
in the 3D graph. The analyst checks the system's working rather than accepting its conclusion.

---

## 4. Honest limits

- **The synthetic capture carries planted patterns.** Detector output can be checked against known
  ground truth, which is the point; it also means detection rates measured on it are not
  generalisation estimates.
- **No labelled corpus, so no precision or recall figures.** Quoting accuracy without labels would
  be inventing it.
- **IP attribution is correlation, not ownership.** A host observation links a broadcast to an
  address. It does not establish who controlled the wallet, and the interface does not say it does.
- **GeoLite2 is not redistributed with the repo.** Country and ASN are read from the capture, which
  the field specification requires it to carry; the database is the fallback for captures that omit
  them, installed with `npm run geoip`.
- **Graph embeddings are not implemented.** Entity clustering uses the co-spend heuristic only.

---

## 5. Reproducing the results

```bash
npm install
npm run dev          # workstation at http://localhost:5173
npm run inspect      # detection engine headlessly, with the model output
npm run inspect:clean # the preparation stage over the messy sample
```

The generator is seeded, so every figure in this document reproduces exactly.
