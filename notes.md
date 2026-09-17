# Handoff notes — VerdictArc

## What this repo is
A real-chain GenLayer project: **VerdictArc**, an onchain court for agentic commerce.
An intelligent contract (contracts/verdict_arc.py) holds escrow, fetches evidence from
the web itself (gl.nondet.web.render), extracts the SLA result under validator consensus
(gl.eq_principle.strict_eq), and decides — release, penalty, or a bounded dispute with
counter-evidence. No mock data path, no local fallback for the onchain flow.

## Architecture
- `contracts/verdict_arc.py` — authoritative onchain rules (VerdictArc intelligent contract)
- `frontend/` — Vite multi-page app: landing / how-it-works / features / wallet dashboard
  (MetaMask + Rabby via EIP-1193), no mock data
- `src/real/adapter.ts` — genlayer-js adapter; `createWalletAdapter` (browser,
  EIP-1193 provider) and `createRealAdapter` (CLI, env private key)
- `src/real/evidence.ts` — canonical evidence-doc builders (task_completion_v1 /
  availability_v1) + HTTPS publisher
- `src/contract.ts` — offline TS mirror of the rules, used by smoke tests only;
  the deployed contract is the sole authority
- `scripts/deploy.ts` — deploy script for contracts/verdict_arc.py

## Entry points
- `npm run dev` — wallet-connected web app (127.0.0.1:5173)
- `npm run demo` — real-chain task-completion lifecycle (requires env config)
- `npm run demo:real` — real-chain availability lifecycle (requires env config)
- `npm run deploy` — deploy the VerdictArc contract
- `npm test` — offline rule/evidence checks + typecheck

## Required env (see .env.example)
GENLAYER_ENDPOINT, GENLAYER_PRIVATE_KEY, GENLAYER_CONTRACT,
GENLAYER_EVIDENCE_PUBLISH_URL, GENLAYER_EVIDENCE_TOKEN

## Implementation discipline
- State transitions are guarded by explicit preconditions, not just caller identity.
- Funds stay locked while a case is disputed.
- SLA predicates are deterministic and declared at case creation.
- Evidence is fetched by the contract from a provider-published URL; the submitter
  never hands the chain a payload it must trust.
- Dispute is bounded: one counter-evidence URL, same predicate re-run, decided outcomes only.

## Community demo path
1. Run a GenLayer node/simulator, `npm run deploy`, set env.
2. Provider publishes an evidence document at a public HTTPS URL
   (builders in `src/real/evidence.ts` produce the exact shape).
3. Walk the lifecycle in the dashboard: create case → lock escrow → start execution →
   submit evidence URL → evaluate → settle or dispute.
