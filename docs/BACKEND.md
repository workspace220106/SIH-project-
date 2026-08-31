# Backend scope — what has to exist, and nothing else

The frontend talks to **three endpoints**. That is the whole contract. Everything
else it shows — the graph, the risk breakdown, the evidence list, the lead — is
derived from the payload those endpoints return.

Estimated build: **~24 hours**, leaving buffer inside a 30-hour window.

---

## 1. Endpoints

### `GET /health`

```json
{
  "network": "OFFLINE",
  "model": "READY",
  "dataset": "READY",
  "engine": "tradeline-engine/0.1",
  "buildId": "PS26146.1.0",
  "latencyMs": 0
}
```

### `POST /ingest`

`multipart/form-data` with one `file` (CSV, JSON or XML). Runs the pipeline and
returns the same payload as `/analysis`.

### `GET /analysis`

The whole analysis in one response. For a capture of this size the payload is
~200 KB, so there is no reason to paginate or to split it across endpoints.

```jsonc
{
  "stats":    { "name": "...", "source": "IMPORTED", "format": "CSV",
                "records": 164, "fields": 7, "duplicates": 0, "invalidRows": 3,
                "rangeStart": 1787994952428, "rangeEnd": 1788011993930,
                "wallets": 79, "transactions": 164, "ips": 18 },
  "notes":    ["..."],                      // reconstruction caveats, shown verbatim
  "entities": [ /* see below */ ],
  "edges":    [ /* see below */ ],
  "clusters": [ { "id": 0, "label": "SET 0", "size": 41, "risk": 31,
                  "dominantPattern": "FAN_OUT", "centroid": [x, y, z] } ],
  "patterns": [ { "id": "FAN_OUT", "entities": ["w014", "t0007"], "edges": ["e-t0007-o"],
                  "strength": 0.94, "detectedAt": 1788000492000,
                  "metric": "1 → 17 destinations within 7m 04s" } ],
  "alerts":   [ { "id": "AL-4210", "entityId": "w014", "entityLabel": "bc1q…",
                  "priority": "HIGH", "risk": 87, "pattern": "FAN_OUT",
                  "timestamp": 1788000492000, "confidence": 0.96 } ],
  "leads":    [ { "id": "LEAD-47", "number": 47, "who": "bc1q…", "what": "...",
                  "why": ["FAN-OUT", "PEELING"], "priority": "HIGH",
                  "risk": 87, "confidence": 0.96, "nextTarget": "bc1q…",
                  "evidence": [ { "index": 1, "type": "FAN_OUT", "title": "FAN-OUT",
                                  "metric": "1 → 17 destinations within 7m 04s",
                                  "strength": 0.94,
                                  "relatedEntities": ["w014"], "relatedEdges": ["e-t0007-o"] } ] } ],
  "timeline": [ { "id": "tl-0", "timestamp": 1788000000000, "kind": "detection",
                  "title": "FAN-OUT detected", "detail": "...", "entityId": "w014" } ],
  "primarySubject": "w014"
}
```

**Entity**

```jsonc
{ "id": "w014", "kind": "wallet",           // wallet | transaction | ip
  "label": "bc1q…", "risk": 87, "cluster": 1,
  "x": -12.4, "y": 30.1, "z": 8.8,          // from the layout step
  "importance": 0.82,                        // 0–1, drives node size
  "timestamp": 1787994952428,
  "meta": { "transactions": 20, "received": 0, "sent": 12.83,
            "degreeIn": 0, "degreeOut": 20, "cluster": "SET 1" } }
```

**Edge**

```jsonc
{ "id": "e-t0007-o", "source": "t0007", "target": "w031",
  "kind": "flow",                            // flow | network
  "weight": 0.21, "amount": 0.21, "timestamp": 1788000492000,
  "suspicious": true, "patterns": ["FAN_OUT"] }
```

Note the graph shape: **wallet → transaction → wallet**. A transaction is a node,
not an edge. That is what lets the UI highlight "these three transactions" as
evidence.

---

## 2. Reference implementation

```python
# main.py — FastAPI + pandas + networkx. This is the whole backend.
from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd, networkx as nx, numpy as np

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STATE = {"analysis": None}

ALIASES = {
    "txid": ["txid", "tx_id", "hash", "transaction_id"],
    "wallet": ["wallet", "address", "addr"],
    "amount": ["amount", "value", "btc"],
    "fee": ["fee", "txfee"],
    "ip": ["ip", "ip_address", "src_ip"],
    "port": ["port", "src_port"],
    "timestamp": ["timestamp", "time", "ts", "datetime"],
}

def normalise(df: pd.DataFrame) -> pd.DataFrame:
    rename = {}
    for canon, names in ALIASES.items():
        for c in df.columns:
            if c.strip().lower().replace(" ", "_") in names:
                rename[c] = canon
    df = df.rename(columns=rename)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    invalid = df["timestamp"].isna() | df["amount"].isna() | df["txid"].isna()
    return df[~invalid].drop_duplicates(subset=["txid", "wallet", "timestamp"])

def build_transactions(df: pd.DataFrame) -> list[dict]:
    """Rows sharing a txid are one transaction: earliest row is the input side."""
    out = []
    for txid, rows in df.sort_values("timestamp").groupby("txid", sort=False):
        rows = rows.reset_index(drop=True)
        src = rows.loc[0]
        for _, dst in rows.iloc[1:].iterrows():
            out.append({"txid": txid, "source": src.wallet, "destination": dst.wallet,
                        "amount": float(dst.amount), "fee": float(src.fee or 0),
                        "ip": src.ip, "port": int(src.port or 8333),
                        "timestamp": int(src.timestamp.timestamp() * 1000)})
    return out

def detect(G: nx.DiGraph, tx: list[dict]) -> list[dict]:
    hits, WINDOW = [], 15 * 60 * 1000
    by_src, by_dst = {}, {}
    for t in tx:
        by_src.setdefault(t["source"], []).append(t)
        by_dst.setdefault(t["destination"], []).append(t)

    for wallet, outs in by_src.items():                      # FAN-OUT
        outs = sorted(outs, key=lambda t: t["timestamp"])
        for i, a in enumerate(outs):
            window = [b for b in outs[i:] if b["timestamp"] - a["timestamp"] <= WINDOW]
            targets = {b["destination"] for b in window}
            if len(targets) >= 8:
                hits.append({"id": "FAN_OUT", "anchor": wallet,
                             "strength": min(0.97, 0.48 + len(targets) / 34),
                             "metric": f"1 → {len(targets)} destinations"})
                break
    # FAN_IN is the same loop over by_dst.
    # RAPID_MOVEMENT: median(t_out − t_in) < 120s across ≥ 3 connected wallets.
    # BURST_ACTIVITY: 10-minute bucket count > 8 × the cluster's median bucket.
    # PEELING: walk the largest outgoing edge; chain ≥ 4 with 0.10 < peel < 0.40.
    return hits

def score(G: nx.DiGraph, wallet: str, hits: list[dict]) -> dict:
    """Four features, fixed weights. Confidence rises when the signals agree."""
    signals = {
        "transaction": feature_volume(G, wallet),   # volume + count vs the 94th percentile
        "graph":       feature_degree(G, wallet),   # degree + clusters bridged
        "temporal":    feature_gap(G, wallet),      # inverse median inter-transaction gap
        "behaviour":   feature_patterns(wallet, hits),
    }
    weights = {"transaction": .30, "graph": .28, "temporal": .22, "behaviour": .20}
    total = sum(signals[k] * weights[k] for k in weights)
    spread = float(np.std(list(signals.values())))
    confidence = min(0.985, 0.46 + min(4, len(hits)) * .075
                            + (1 - min(1, spread / 46)) * .2 + total / 100 * .09)
    priority = "CRITICAL" if total >= 90 else "HIGH" if total >= 75 \
               else "MEDIUM" if total >= 50 else "LOW"
    return {"score": round(total), "confidence": confidence,
            "priority": priority, "signals": signals}

def layout(G: nx.Graph) -> dict:
    """3D positions. networkx is fine at this size; seed it so it is stable."""
    return nx.spring_layout(G, dim=3, seed=26146, iterations=200, scale=90)

@app.get("/health")
def health():
    return {"network": "OFFLINE", "model": "READY",
            "dataset": "READY" if STATE["analysis"] else "EMPTY",
            "engine": "nexus-engine/0.1", "buildId": "PS26146.1.0", "latencyMs": 0}

@app.post("/ingest")
async def ingest(file: UploadFile):
    raw = await file.read()
    df = read_any(raw, file.filename)      # pandas read_csv / read_json / read_xml
    STATE["analysis"] = assemble(normalise(df), file.filename)
    return STATE["analysis"]

@app.get("/analysis")
def analysis():
    return STATE["analysis"] or assemble_synthetic()
```

`assemble()` is the glue: build the graph, run `detect`, run `score` per wallet,
run `layout`, then emit the JSON above. Roughly 150 lines.

---

## 3. Where the hours go

| Task | Hours |
| --- | --- |
| FastAPI skeleton, CORS, upload, CSV/JSON/XML reading | 3 |
| Normalisation, txid grouping, entity + edge construction | 4 |
| Five detectors | 5 |
| Risk scoring and confidence | 3 |
| 3D layout and connected-component clusters | 2 |
| Evidence, alerts, leads, timeline assembly | 2 |
| JSON serialisation and wiring to the frontend | 2 |
| Testing against real-shaped CSVs | 3 |
| **Total** | **24** |

---

## 4. Explicitly out of scope

Not in v1, and the interface does not pretend otherwise:

- **No database.** The analysis lives in process memory. A restart clears it.
- **No authentication or multi-user state.** One analyst, one workstation.
- **No GeoIP or ASN enrichment.** A host is an address and a port. That is a
  separate data source and it is not worth a hackathon hour.
- **No trained model.** The detectors are rules with stated thresholds and the
  risk score is a weighted sum. Both are printed in the interface, which is
  more defensible to an investigator than an unexplainable model would be.
- **No time-window filtering in the graph.** Replay covers the temporal
  dimension. Add `?from=&to=` later if it is actually asked for.
- **No live blockchain connection.** The system reads captures. That is the
  problem statement.
- **No persistence of leads or case notes.** Report export is a text download
  generated in the browser.

---

## 5. Switching the frontend over

`src/lib/api.ts` already defines the boundary:

```ts
export interface NexusClient {
  status(): Promise<ServiceStatus>
  analysis(seed?: number): Promise<Analysis>
}
```

Today `LocalEngineClient` runs the same pipeline in TypeScript in the browser,
which is a working reference for the Python you are about to write — same
thresholds, same weights, same output shape. Set `VITE_NEXUS_API=http://localhost:8000`
and fill in `HttpClient.analysis()` with a `fetch`. No component changes.
