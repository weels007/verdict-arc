<div align="center">

# ⚖️ VerdictArc

**Onchain court for agentic commerce**

*Evidence fetched by the contract itself. Judged under validator consensus.*

[![GenLayer](https://img.shields.io/badge/Built%20on-GenLayer-6C47FF?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMS42IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMiAyMnM4LTQgOC0xMFY1bC04LTMtOCAzdjdjMCA2IDggMTAgOCAxMHoiLz48L3N2Zz4=)](https://genlayer.com)
[![Studionet](https://img.shields.io/badge/Network-Studionet%2061999-00D4AA?style=flat-square)](https://docs.genlayer.com)
[![Python](https://img.shields.io/badge/Contract-Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://docs.genlayer.com)
[![TypeScript](https://img.shields.io/badge/Frontend-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

</div>

## 🎯 What is VerdictArc?

VerdictArc is an **Intelligent Contract** on [GenLayer](https://genlayer.com) that settles SLA disputes automatically. It holds payment in escrow, fetches evidence from the provider's published URL, extracts the SLA result using an LLM under validator consensus, and decides — **release, refund, or dispute**.

> *"The contract itself fetches the evidence. No mock data path exists."*

```
┌─────────────────────────────────────────────────────────────────┐
│                      VERDICTARC FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Consumer ──── create_case ──── lock_escrow ────┐               │
│                                                 │               │
│                                    ┌────────────┘               │
│                                    ▼                            │
│                         ┌──────────────────┐                    │
│                         │   ESCROW LOCKED  │                    │
│                         └──────────────────┘                    │
│                                    │                            │
│  Provider ──── start_execution ────┤                            │
│                                    │                            │
│  Provider ──── submit_evidence ────┘                            │
│                         │                                       │
│                         ▼                                       │
│              ┌──────────────────────┐                           │
│              │  VALIDATOR CONSENSUS │                           │
│              │  • Fetch evidence    │                           │
│              │  • LLM extraction    │                           │
│              │  • Independent rerun │                           │
│              └──────────────────────┘                           │
│                    │           │                                │
│                    ▼           ▼                                │
│             ┌──────────┐  ┌──────────┐                          │
│             │ RELEASE  │  │ DISPUTE  │                          │
│             └──────────┘  └──────────┘                          │
│                                    │                            │
│                         ┌──────────┴──────────┐                 │
│                         ▼                     ▼                 │
│                  ┌──────────┐          ┌──────────┐             │
│                  │  REFUND  │          │COUNTER-EV│             │
│                  └──────────┘          └──────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🏛️ **Onchain Justice** | Disputes settled by evidence the contract itself fetches under consensus |
| 🔍 **Evidence-First** | Decision comes from evidence content, never from submitter claims |
| 🎲 **LLM Consensus** | Validators independently verify evidence using LLM extraction |
| 🤝 **Same Rules for Everyone** | Identical predicate on original and counter-evidence |
| 📊 **Fully Auditable** | Evidence URL, extracted result, and decision all recorded onchain |
| ⚖️ **Bounded Disputes** | One counter-evidence round, preventing endless litigation |
| 🔐 **Wallet-Signed** | All writes require wallet signature, no backdoors |

---

## 🏗️ Architecture

### Smart Contract (Python)

```python
# contracts/verdict_arc.py
from genlayer import *

class VerdictArc(gl.Contract):
    """
    Onchain court for agentic commerce.
    Evidence fetched by the contract itself, judged under validator consensus.
    """
    
    def create_case(self, case_id, provider, consumer, ...):
        """Consumer opens a case and defines SLA terms."""
        
    def lock_escrow(self, case_id):
        """Lock payment as transaction value. Funds held by contract."""
        
    def submit_evidence(self, case_id, evidence_url):
        """Provider publishes evidence at public URL."""
        
    def evaluate_evidence(self, case_id):
        """Contract fetches URL, LLM extracts result, consensus decides."""
```

### Frontend (TypeScript + Vite)

```
frontend/
├── src/
│   ├── pages/
│   │   ├── landing.ts      # Hero, flow, trust pillars
│   │   ├── how.ts          # Timeline, consensus explainer
│   │   ├── features.ts     # Capability cards, comparison
│   │   └── app.ts          # Wallet-connected dashboard
│   ├── config.ts           # Build-time config (endpoint, contract)
│   └── main.ts             # Router, wallet, adapter
├── dist/                   # Production build
└── index.html
```

---

## 🚀 Quickstart

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [GenLayer CLI](https://docs.genlayer.com) installed
- A wallet with GEN tokens on studionet

### Installation

```bash
# Clone the repository
git clone https://github.com/weels007/verdict-arc.git
cd verdict-arc

# Install dependencies
npm install
```

### Development

```bash
# Start dev server
npm run dev
# → http://127.0.0.1:5173

# Run offline tests
npm test
```

### Deploy Contract

```bash
# Set your private key
export GENLAYER_PRIVATE_KEY=0x...

# Deploy to studionet
npm run deploy

# Full lifecycle test
npx tsx scripts/test-all-methods.ts
```

---

## 🌐 Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com) (Vite preset auto-detected)
3. Set environment variables:

```bash
VITE_GENLAYER_ENDPOINT=https://studio.genlayer.com/api
VITE_GENLAYER_CONTRACT=0x95Ff2075f20b638647Fc3417989F1FdC3254b000
```

4. Deploy — visitors get a fully configured dashboard

### Contract (GenLayer)

```bash
# Deploy to testnet (persistent)
GENLAYER_ENDPOINT=https://testnet.genlayer.com/api \
GENLAYER_PRIVATE_KEY=0x... \
npm run deploy
```

---

## 📖 How It Works

### The Flow

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

### Validator Consensus

When `evaluate_evidence` is called:

1. **Each validator** independently fetches the evidence URL
2. **LLM extracts** the SLA result from the evidence content
3. **Independent re-run** ensures consistency
4. **Decision-field comparison** determines consensus
5. **Same rules** apply to both original and counter-evidence

---

## 🔧 Configuration

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GENLAYER_ENDPOINT` | RPC endpoint | `https://studio.genlayer.com/api` |
| `GENLAYER_PRIVATE_KEY` | Signing account | — |
| `GENLAYER_CONTRACT` | VerdictArc address | — |

### Build-time Config

The frontend reads from `VITE_GENLAYER_*` env vars at build time:

```typescript
// frontend/src/config.ts
export function loadConfig(): AppConfig {
  return {
    endpoint: "https://studio.genlayer.com/api",
    contractAddress: "0x95Ff2075f20b638647Fc3417989F1FdC3254b000",
  };
}
```

---

## 📁 Project Structure

```
verdict-arc/
├── contracts/
│   └── verdict_arc.py          # GenLayer intelligent contract (authoritative)
├── frontend/
│   ├── src/
│   │   ├── pages/              # Route components
│   │   ├── config.ts           # Build-time configuration
│   │   ├── main.ts             # App entry, router, wallet
│   │   └── styles.css          # Global styles
│   ├── index.html              # SPA shell
│   └── vite.config.ts          # Vite configuration
├── src/
│   ├── real/
│   │   ├── adapter.ts          # genlayer-js adapter
│   │   └── evidence.ts         # Evidence builder + publisher
│   └── contract.ts             # TS rule mirror (offline tests)
├── scripts/
│   ├── deploy.ts               # Deploy to GenLayer
│   └── test-all-methods.ts     # E2E lifecycle test
├── smoke*.test.ts              # Rule + evidence checks
└── package.json
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Individual test suites
npm run smoke              # Rule tests
npm run smoke:availability # Availability mode tests
npm run smoke:real         # Real chain tests
npm run check              # Summary check
npm run typecheck          # TypeScript validation
```

---

## ⚠️ Limitations

| Limitation | Impact |
|------------|--------|
| Validators must reach evidence URL | No private endpoints or firewalled servers |
| `evaluate_evidence` requires LLM consensus | ~30-60s per evaluation |
| Studionet has temporary persistence | Use testnet for production data |
| Bounded disputes | One counter-evidence round only |

---

## 🗺️ Roadmap

- [ ] Multi-round disputes
- [ ] Cross-chain evidence verification
- [ ] Reputation system for providers
- [ ] Automated penalty distribution
- [ ] Integration with real-world oracles

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ⚖️ on [GenLayer](https://genlayer.com)**

*Evidence fetched by the contract itself. Judged under validator consensus.*

</div>
