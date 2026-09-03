# Deck replacement copy

Paste-ready text for the idea-submission deck, matched to what the repository actually
contains as of the current build. Every claim below is checkable in the code or in the running
system — which matters, because the demo video shows the same system a judge will be reading these
slides against.

---

## Slide 1 — title

One correction and one gap:

| Field | Change to |
| --- | --- |
| Theme | **Cryptocurrency** — the official brief says this, not "Blockchain & Cybersecurity" |
| Video rows | Restore `PPT EXPLANATION:` and `DEMO EXPLANATION & LINK:` with real URLs |

The `PPT EXPLANATION` / `DEMO EXPLANATION` rows were deleted rather than filled. Removing the field
does not remove the requirement.

---

## Slide 2 — proposed solution

Replace item 4 and add two. Everything else stands.

> **1. Bitcoin + Network Data** — Ingest timestamp, src/dst IP and port, TXID, input/output address
> and amount arrays, fee and script type from CSV / JSON / XML.
>
> **2. Capture Preparation** — Repair messy exports deterministically (mixed date formats,
> satoshis, `ip:port`, three array encodings) and reject what cannot be repaired, with the line and
> the reason. Outputs a canonical file the investigator keeps.
>
> **3. Data Correlation** — Correlate IP ↔ TXID ↔ Time to join network observations to blockchain
> activity, with country and ASN per host.
>
> **4. Entity Graph** — Wallets, transactions and hosts as one graph. Addresses that co-spend are
> resolved to a single entity by common-input-ownership.
>
> **5. AI Detection** — Isolation Forest, unsupervised, fitted on each capture over eight
> behavioural features. Six rule-based detectors run alongside it.
>
> **6. Risk Scoring** — 0–100 from six weighted signals, with confidence driven by agreement
> between them, plus taint propagated from seed wallets.
>
> **7. Explainable Evidence** — Every score decomposes into ranked evidence bound to the exact
> nodes and edges it came from.
>
> **8. Dashboard** — Ranked alerts, 3D entity graph, timeline, money-flow tracing, replay and
> report in one offline interface.

**USP** — add one line, because it is the requirement most teams will miss:

> Fully offline · Linux · no external dependency at runtime

---

## Slide 3 — technical approach

### Replace the tech stack table

The current table lists Rust, Go, Polars, Apache Arrow, TigerGraph, GraphBLAS, PyTorch, XGBoost,
Prefect and Weights & Biases. **None are in the repository**, and the demo video shows a TypeScript
application. Replace with:

| Language | Frontend | Backend | Graph & ML | Data & Platform |
| --- | --- | --- | --- | --- |
| TypeScript | React | FastAPI | NetworkX | GeoLite2 |
| Python | Three.js | pandas | scikit-learn | Linux |

Header: **TECH STACK — OFFLINE BY DESIGN**

### Rename two boxes in the pipeline diagram

| Currently | Change to |
| --- | --- |
| `ML ANOMALY DETECTOR` | `ISOLATION FOREST · unsupervised` |
| `EXPLAIN AI` | `FEATURE ABLATION · per-instance` |

Those two words are what the brief asks for by name — *model choice* and *explainability method*.

### Add to the pattern list

The diagram shows five patterns. There are now six: add **COINJOIN / MIXING**.

---

## Slide 4 — feasibility and viability

The offline framing is already correct. Two additions to the challenge table:

| Challenge | Solution |
| --- | --- |
| No labelled data | Unsupervised detection — Isolation Forest needs no ground truth |
| Heuristics defeated deliberately | CoinJoin excluded from co-spend clustering, because it exists to poison it |

The second is worth including: it shows awareness that an adversary is actively working against
the method, which is the difference between applying a heuristic and understanding one.

---

## Slide 5 — impact and benefits

Stands as written. One addition under Benefits:

> **Auditable** — every alert names the evidence, the feature contributions and the line of the
> capture it came from.

---

## Numbers to keep consistent

The deck, the video narration and the live system must agree. Current values:

| Figure | Value |
| --- | --- |
| Top subject risk | **92** (CRITICAL) — was 87 before the model and taint were added |
| Confidence | 96% |
| Entities / links in the synthetic capture | 253 / 402 |
| Transactions | 157 |
| Wallets the model was fitted on | 79 |
| Detectors | 6 |
| Model features | 8 |
| Risk signals | 6 |

Re-check these against `npm run inspect` before recording — they move when the generator changes.

---

## What not to claim

- Do not present the weighted composite as "the AI". The model is the Isolation Forest; the
  composite is a weighted sum that includes it.
- Do not claim precision or recall. There is no labelled corpus, so any figure would be invented.
- Do not claim IP attribution establishes ownership. It is correlation, and slide 4 already says so
  correctly.
- Do not claim graph embeddings. Entity clustering uses the co-spend heuristic only.
