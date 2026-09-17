# VerdictArc — Onchain Justice

Real onchain SLA escrow for agentic commerce, built as a GenLayer Intelligent Contract. An escrow case is decided **only** by evidence the contract itself fetches from the web under validator consensus — no mock data, no local fallback, no trusted submitter.

```
provider delivers  →  publishes evidence doc (HTTPS)  →  submit_evidence(url) onchain
                                                              │
                              validators fetch the URL + extract the SLA result
                              (gl.nondet.web.render + LLM + gl.eq_principle.strict_eq)
                                                              │
                              Satisfied → release     breach → bounded dispute → refund
```

## How it works

1. **`create_case`** — the case terms are written onchain: provider, consumer, service window, required task count / availability threshold (permille), and the evidence mode (`task_completion_v1` or `availability_v1`).
2. **`lock_escrow`** — the consumer locks value into the case (sent as transaction value).
3. **`start_execution`** — the provider starts work.
4. **`submit_evidence(url, submission_time)`** — the provider publishes a structured evidence document at a public HTTPS URL and submits the URL onchain.
5. **`evaluate_evidence`** — the contract renders the URL (`gl.nondet.web.render`), extracts the structured SLA result with an LLM, and reaches validator consensus on the extraction (`gl.eq_principle.strict_eq`). The decision is derived deterministically from the extracted values:
   - task mode: completed count ≥ required, all completion timestamps inside the window, all tasks successful
   - availability mode: observation window inside the case window and `successful/total ≥ threshold`
   - `Satisfied` → `DecisionPending` → **release**. Breach or malformed evidence → **bounded dispute path**; funds stay locked.
6. **`submit_dispute(reason, counter_evidence_url)` + `evaluate_dispute`** — the same predicate is re-run on counter-evidence fetched the same way. Counter-evidence satisfied → release; otherwise refund. The dispute is bounded, not an open-ended appeal.

## Project layout

```
contracts/verdict_arc.py    The real GenLayer intelligent contract (authoritative rules)
frontend/                   Browser dashboard (Vite) with MetaMask/Rabby wallet connect
src/real/adapter.ts         genlayer-js adapter: account mode (CLI) + wallet mode (browser)
src/real/evidence.ts        Canonical evidence-doc builders + HTTPS publisher
src/contract.ts             TS mirror of the onchain rules (offline rule tests only)
smoke*.test.ts              Offline rule/evidence checks (npm test)
scripts/deploy.ts           Deploy contracts/verdict_arc.py to a GenLayer endpoint
```

## Frontend — VerdictArc web app

The frontend is a full multi-page SPA (Vite, no framework runtime):

- **Landing** — hero, five-step case flow, trust pillars, stats, CTA.
- **How It Works** — the case lifecycle as a timeline with real entrypoints, the
  consensus explainer, and the bounded dispute branch.
- **Features** — nine capability cards and a positioning table vs. plain escrow
  contracts and manual arbitration.
- **Launch App** — the wallet-connected dashboard.

The dashboard is a real-chain client: reads go straight to the deployed contract,
and every write is signed inside the user's own wallet (MetaMask, Rabby, or any
EIP-1193 injected wallet). No private keys are handled by the app.

```bash
npm run dev        # serves the app on http://127.0.0.1:5173
```

Then:
1. Install MetaMask or Rabby and open the app (Launch App route).
2. The dashboard reads its network from the build-time env
   (`VITE_GENLAYER_ENDPOINT` / `VITE_GENLAYER_CONTRACT`). For local
   development against a simulator, copy `frontend/.env.example` to
   `frontend/.env` and fill it in — or use the dashboard's **Advanced**
   override. Production deployments never touch localhost.
3. Click **Connect Wallet**, fill the case form (or keep the defaults), and
   **Create Case**.
4. Walk the lifecycle: Lock Escrow (consumer) → Start Execution (provider) →
   submit evidence (CLI demo or your own publishing flow) → Evaluate Evidence
   (validators fetch the URL and reach consensus) → Release / Penalize / Dispute.

To deploy your own contract first, see Quickstart below. Without a configured
network the app still renders and navigates but cannot load or create cases —
the Network panel says "not configured" and there is no simulated data; every
failure lands in the activity log.

### Deploy the frontend to Vercel

The repo ships with `vercel.json` (SPA rewrites, `frontend/dist` output).

1. Push the repo to GitHub and import it in Vercel (framework preset: Vite —
   detected automatically).
2. Before the first deploy, run the contract deployment once:

   ```bash
   GENLAYER_ENDPOINT=<testnet rpc> GENLAYER_PRIVATE_KEY=0x… npm run deploy
   ```

3. In Vercel → Settings → Environment Variables, add:

   | Variable | Value |
   | --- | --- |
   | `VITE_GENLAYER_ENDPOINT` | public GenLayer testnet RPC URL |
   | `VITE_GENLAYER_CONTRACT` | address printed by the deploy step |

4. Redeploy. The built app has the network baked in — visitors land on a
   fully configured dashboard: connect wallet and go. No localhost anywhere.

## Quickstart

```bash
npm install
npm test                      # offline rule + evidence checks + typecheck

# Deploy to the local simulator (or set GENLAYER_ENDPOINT to a testnet RPC):
GENLAYER_ENDPOINT=http://localhost:8323 \
GENLAYER_PRIVATE_KEY=0x... \
npm run deploy                # prints the address → set GENLAYER_CONTRACT

cp .env.example .env          # fill in endpoint, key, contract, evidence publishing

npm run demo                  # task_completion_v1 lifecycle, end to end onchain
npm run demo:real             # availability_v1 lifecycle, end to end onchain
```

### Required environment (no fallback)

| Variable | Purpose |
| --- | --- |
| `GENLAYER_ENDPOINT` | GenLayer RPC endpoint (localnet simulator or testnet) |
| `GENLAYER_PRIVATE_KEY` | Signing account key |
| `GENLAYER_CONTRACT` | Deployed `VerdictArc` address |
| `GENLAYER_EVIDENCE_PUBLISH_URL` | HTTPS endpoint where evidence docs are uploaded |
| `GENLAYER_EVIDENCE_TOKEN` | Bearer token for the publish endpoint |

Demos fail fast if any of these are missing. Evidence documents must be reachable by the validators at the submitted URL — that is the point: the contract verifies reality, not claims.

## Why this fits the hackathon theme

- **Onchain Justice** — disputes, appeals and rule enforcement decided from evidence. Here the evidence is fetched by the contract itself under consensus, so no party can submit a hand-built payload and claim it as truth.
- **Same rules for everyone** — the SLA predicate lives in the contract and runs identically on original and counter-evidence.
- **Auditable** — the evidence URL, extracted result, and decision are all onchain.

## Honest boundaries

- `src/contract.ts` and the smoke tests are an offline mirror for fast rule checks; the onchain contract is authoritative.
- Validators must be able to reach the evidence URL; a private endpoint cannot serve as evidence.
- The escrow primitives model hold/release semantics; full token-transfer wiring depends on the chain's native value model.
- The dispute re-evaluates the same predicate on counter-evidence; deeper appeal chains would be additional bounded evaluation steps, not free-form debate.
