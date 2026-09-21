# VerdictArc

**Onchain court for agentic commerce** — a GenLayer Intelligent Contract that settles SLA disputes using evidence fetched and judged entirely on-chain.

```
provider delivers  →  publishes evidence (HTTPS)  →  submit_evidence(url)
                                                             │
                          validators fetch the URL + extract SLA result
                          (gl.nondet.web.render + LLM consensus)
                                                             │
                          Satisfied → release    breach → dispute → refund
```

---

## How It Works

| Step | Method | Actor | Description |
|------|--------|-------|-------------|
| 1 | `create_case` | Consumer | Terms written onchain: provider, consumer, service window, task count, evidence mode |
| 2 | `lock_escrow` | Consumer | Locks GEN value into the case |
| 3 | `start_execution` | Provider | Signals work has begun |
| 4 | `submit_evidence` | Provider | Publishes structured evidence at a public HTTPS URL |
| 5 | `evaluate_evidence` | Validators | Contract fetches evidence, LLM extracts SLA result, consensus decides |
| 6 | `release` / `penalize` | Contract | Funds released or penalized based on verdict |
| 7 | `submit_dispute` | Provider | Counter-evidence via same predicate (bounded, one round) |

### Evidence Modes

- **`task_completion_v1`** — completed tasks ≥ required, timestamps in window, all successful
- **`availability_v1`** — observation window in case window, `ok/total ≥ threshold permille`

---

## Deployed Contract

| | |
|---|---|
| **Network** | [Studionet](https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration) (chain 61999) |
| **Address** | `0x19EE7bd967CF365a8214Ac01f729C0d037eb1852` |
| **RPC** | `https://studio.genlayer.com/api` |
| **Deployer** | `0x689759bb926E032EAfb1eE986eD7A98C1496ec1c` |

---

## Project Layout

```
contracts/verdict_arc.py      GenLayer intelligent contract (authoritative)
frontend/                     Browser dashboard (Vite + wallet connect)
src/real/adapter.ts           genlayer-js adapter (account + wallet modes)
src/real/evidence.ts          Evidence doc builder + HTTPS publisher
src/contract.ts               TS rule mirror (offline tests)
smoke*.test.ts                Rule + evidence checks (npm test)
scripts/deploy.ts             Deploy to GenLayer
scripts/test-all-methods.ts   E2E lifecycle test on studionet
```

---

## Quickstart

```bash
npm install

# Run offline tests
npm test

# Deploy to studionet
GENLAYER_PRIVATE_KEY=0x... npm run deploy

# Full lifecycle test
npx tsx scripts/test-all-methods.ts
```

### Environment

| Variable | Purpose |
|----------|---------|
| `GENLAYER_ENDPOINT` | RPC endpoint (default: studionet) |
| `GENLAYER_PRIVATE_KEY` | Signing account private key |
| `GENLAYER_CONTRACT` | Deployed VerdictArc address |

---

## Frontend

Multi-page SPA (Vite, no framework runtime):

- **Landing** — hero, case flow, trust pillars
- **How It Works** — timeline, consensus explainer
- **Features** — capability cards, comparison table
- **Launch App** — wallet-connected dashboard

```bash
npm run dev        # http://127.0.0.1:5173
```

### Deploy to Vercel

1. Push to GitHub, import in Vercel (Vite preset auto-detected)
2. Set environment variables:

| Variable | Value |
|----------|-------|
| `VITE_GENLAYER_ENDPOINT` | `https://studio.genlayer.com/api` |
| `VITE_GENLAYER_CONTRACT` | `0x19EE7bd967CF365a8214Ac01f729C0d037eb1852` |

3. Redeploy — visitors get a fully configured dashboard.

---

## Why This Fits

- **Onchain Justice** — disputes settled by evidence the contract itself fetches under consensus
- **Same Rules for Everyone** — identical predicate on original and counter-evidence
- **Auditable** — evidence URL, extracted result, and decision all onchain

---

## Limits

- Validators must reach the evidence URL (no private endpoints)
- `evaluate_evidence` requires LLM consensus (slow, ~30-60s)
- Studionet has **temporary** persistence — use testnetAsimov/testnetBradbury for production
- Dispute is bounded: one counter-evidence round, same predicate
