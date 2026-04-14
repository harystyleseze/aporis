# Aporis

**AI-powered yield intelligence terminal for DeFi.** Discover, analyze, and execute optimal yield opportunities across 10+ protocols and 16 chains through a single interface — powered by [LI.FI Earn](https://docs.li.fi/earn/overview).


> *"Business in the front, party in the back."*
> Users see a clean intelligence dashboard with one-click deposits. Behind it, LI.FI Earn orchestrates 10 protocols, 16 chains, swap routing, bridge selection, and atomic transaction execution — all invisible to the user.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Why It Exists](#why-it-exists)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [User Flow](#user-flow)
- [AI Features](#ai-features)
- [How It Uses LI.FI Earn](#how-it-uses-lifi-earn)
- [Judging Criteria Mapping](#judging-criteria-mapping)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [What I'd Build Next](#what-id-build-next)
- [API Feedback](#api-feedback)
- [Submission Info](#submission-info)

---

## What It Does

Aporis replaces protocol-hopping and manual yield farming with an intelligent terminal that:

1. **Discovers** 590+ vaults across Aave, Morpho, Euler, Pendle, and 7 other protocols — with an interactive bubble chart and sortable table
2. **Analyzes risk** through a transparent 5-factor scoring engine with SVG radar chart, plus LLM-generated risk narratives via Groq
3. **Calculates net yield** — the actual return after real-time gas estimates (from `/v1/gas/suggestion`) and protocol fees, not just nominal APY
4. **Warns about bad trades** — flags when transaction costs exceed deposit amount or when net yield is negative
5. **Optimizes allocation** — input your amount, asset, and risk tolerance, and the engine finds the best vault ranked by net APY with AI-generated recommendations
6. **Executes deposits** with automatic token approval and one-click execution via LI.FI Composer — supports same-chain and cross-chain (bridge + deposit atomically)
7. **Tracks positions** and detects idle assets, with on-chain verification of vault balances
8. **Withdraws** directly from the portfolio panel — reads actual on-chain LP token balance, handles approval, and executes via Composer

---

## Why It Exists

Every yield aggregator shows nominal APY. None answer the question that actually matters:

> "How much do I **really** earn after gas, bridge fees, and protocol costs?"

A $100 deposit into a 5% APY vault with $2.70 in cross-chain fees has a **negative** net yield for the first 200 days. Users don't know this. Aporis reveals it.

The intelligence isn't behind a chatbot — it's embedded in every pixel of the dashboard. Risk badges, net APY columns, radar charts, and the Yield Optimizer all run on real-time data from the LI.FI Earn API.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          APORIS                                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    PRESENTATION LAYER                      │  │
│  │                                                            │  │
│  │  Header ─── SmartSearch ─── ApiCounter ─── Reown AppKit    │  │
│  │  HeroStats (4 live metric cards)                           │  │
│  │                                                            │  │
│  │  ┌─── Left Column ────────┐  ┌─── Right Column ────────┐  │  │
│  │  │ YieldOptimizer         │  │ RiskRadar (SVG)          │  │  │
│  │  │ VaultBubbles (chart)   │  │ NetYieldBar (SVG)        │  │  │
│  │  │ VaultTable (sortable)  │  │ MarketIntel              │  │  │
│  │  │ DepositModal           │  │ PortfolioPanel           │  │  │
│  │  │ WithdrawModal          │  │                          │  │  │
│  │  └────────────────────────┘  └──────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   INTELLIGENCE LAYER                       │  │
│  │                                                            │  │
│  │  search-parser.ts ── Natural language → structured filters │  │
│  │  optimizer.ts ─────── Net yield calc + vault ranking       │  │
│  │  risk-engine.ts ───── 5-axis risk scoring + radar scores   │  │
│  │  market-intel.ts ──── Insight generation from aggregates   │  │
│  │  llm.ts ──────────── AI narratives via Groq (configurable) │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      DATA LAYER                            │  │
│  │                                                            │  │
│  │  api.ts ── Typed client for both LI.FI services            │  │
│  │  useVaults.ts ── React Query hooks (caching, pagination)   │  │
│  │  wagmi.ts ── Wallet config (12 EVM chains)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                  │
              ▼                ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  LI.FI Earn  │  │ LI.FI        │  │   User's     │  │  LLM         │
    │  Data API    │  │ Composer     │  │   Wallet     │  │  (Groq)      │
    │              │  │              │  │              │  │              │
    │ earn.li.fi   │  │ li.quest     │  │  wagmi +     │  │ Configurable │
    │ No auth      │  │ API key opt  │  │  Reown       │  │ via env vars │
    │              │  │              │  │  AppKit      │  │              │
    │ • Vaults     │  │ • Quote      │  │ • Sign tx    │  │ • Risk       │
    │ • Chains     │  │ • Execute    │  │ • Approve    │  │   narratives │
    │ • Protocols  │  │ • Status     │  │ • Switch     │  │ • Yield      │
    │ • Portfolio  │  │ • Gas est.   │  │   chain      │  │   recommend. │
    └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Data Flow

### Vault Discovery → Analysis → Recommendation

```
User opens Aporis
        │
        ▼
┌─── Earn Data API ───────────────────────────────┐
│                                                  │
│  GET /v1/earn/vaults?limit=100                   │
│  GET /v1/earn/vaults?limit=100&cursor=...        │  ← paginated (6-8 calls)
│  GET /v1/earn/vaults?limit=100&cursor=...        │
│  GET /v1/earn/chains                             │  ← 1 call
│  GET /v1/earn/protocols                          │  ← 1 call
│                                                  │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              590+ vaults loaded
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
    ┌────────────┐ ┌──────────┐ ┌──────────────┐
    │ Risk       │ │ Net Yield│ │ Market       │
    │ Engine     │ │ Calc     │ │ Intelligence │
    │            │ │          │ │              │
    │ 5-factor   │ │ APY -    │ │ Aggregated   │
    │ scoring    │ │ gas -    │ │ trends +     │
    │ per vault  │ │ fees =   │ │ insights     │
    │            │ │ net APY  │ │              │
    └─────┬──────┘ └────┬─────┘ └──────┬───────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
              Dashboard renders all data
              (table, radar, bars, feed)
```

### Deposit Execution Flow

```
User clicks "Deposit" on vault
        │
        ▼
┌─── DepositModal ────────────────────────────────┐
│                                                  │
│  1. User enters amount (e.g. 1000 USDC)         │
│  2. Risk summary displayed                       │
│  3. Click "Get Quote"                            │
│        │                                         │
│        ▼                                         │
│  ┌─── Composer API ───────────────────────┐     │
│  │                                         │     │
│  │  GET /v1/quote                          │     │
│  │    fromChain = 8453 (Base)              │     │
│  │    toChain   = 8453                     │     │
│  │    fromToken = 0x833...  (USDC)         │     │
│  │    toToken   = 0xee8...  (vault addr)   │     │
│  │    fromAmount = 1000000000              │     │
│  │                                         │     │
│  │  Returns: transactionRequest            │     │
│  │    • to: 0x1231... (Diamond contract)   │     │
│  │    • data: encoded calldata             │     │
│  │    • gas estimate + fee breakdown       │     │
│  └─────────────────────────────────────────┘     │
│        │                                         │
│        ▼                                         │
│  4. Quote preview shown:                         │
│     • Gas: $0.017                                │
│     • Fees: $0.003                               │
│     • Net APY: 6.98%                             │
│     • Est. earnings: $349/year                   │
│                                                  │
│  5. User clicks "Confirm Deposit"                │
│        │                                         │
│        ▼                                         │
│  6. Wallet signs transaction                     │
│  7. TX submitted to blockchain                   │
│  8. Success → LI.FI Explorer link                │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Smart Search Flow

```
User types: "safe USDC on Base above 5%"
        │
        ▼
┌─── search-parser.ts ────────────────────────────┐
│                                                  │
│  Input: "safe USDC on Base above 5%"             │
│                                                  │
│  Regex chain match:  "base" → chainId: 8453     │
│  Regex asset match:  "usdc" → asset: "USDC"     │
│  Regex risk match:   "safe" → risk: "low"       │
│  Regex APY match:    "above 5%" → minApy: 5     │
│                                                  │
│  Output: {                                       │
│    chainId: 8453,                                │
│    asset: "USDC",                                │
│    riskTolerance: "low",                         │
│    minApy: 5                                     │
│  }                                               │
│                                                  │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
           Filter pills appear in UI:
           [USDC] [Base] [Low Risk] [>5% APY]
                       │
                       ▼
           Vault table filters to matching results
```

---

## User Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│          │     │          │     │          │     │          │     │          │
│ DISCOVER │────▶│ ANALYZE  │────▶│ OPTIMIZE │────▶│ EXECUTE  │────▶│  TRACK   │
│          │     │          │     │          │     │          │     │          │
│ Browse   │     │ Select   │     │ Enter    │     │ Review   │     │ See new  │
│ 590+     │     │ vault →  │     │ amount + │     │ quote +  │     │ position │
│ vaults   │     │ see risk │     │ risk →   │     │ confirm  │     │ in port- │
│ with     │     │ radar +  │     │ get best │     │ deposit  │     │ folio    │
│ filters  │     │ net yield│     │ match    │     │ via      │     │ panel    │
│          │     │ breakdown│     │          │     │ Composer │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │                │
     │    Earn API    │   risk-engine  │   optimizer    │  Composer API  │  Earn API
     │   /v1/earn/    │   + net yield  │  findBestVault │  /v1/quote     │  /portfolio
     │    vaults      │    calculator  │                │  + wallet sign │
```

---

## AI Features

Aporis is on the **AI x Earn** track. The AI is embedded in the product, not wrapped in a conversation interface. Each feature maps directly to the track description:

| Track Description | Aporis Feature | Implementation |
|---|---|---|
| *"agents that auto-allocate across vaults"* | **Yield Optimizer** | Scans all vaults, applies risk filter, ranks by net APY, recommends top 3 |
| *"LLM-driven risk scoring"* | **Risk Intelligence Engine** | 5-factor scoring with SVG radar chart and plain-English explanations |
| *"natural language vault interaction"* | **Smart Search** | Parses "safe USDC on Base above 5%" → structured filters in real-time |
| *"monitors positions and auto-rebalances"* | **Portfolio Panel + Idle Detection** | Shows positions, flags idle assets, suggests deployment |

### 1. Smart Search — Natural Language to Filters
Type `"safe USDC vaults on Base above 5%"` and watch it parse into structured filters: `[USDC] [Base] [Low Risk] [>5% APY]`. Deterministic NLP for instant results — no latency, no API cost.

### 2. Yield Optimizer — Agent That Auto-Allocates
Enter your deposit amount, select an asset, choose your risk tolerance. The optimizer scans all matching vaults, scores them by **net APY** (not nominal), and recommends the top 3 with one-click deposit.

### 3. Risk Intelligence — 5-Axis Radar
Every vault gets a risk analysis displayed as a custom SVG radar chart with 5 dimensions:

```
            TVL Depth
               ╱╲
              ╱  ╲
   Yield    ╱  ◆  ╲   APY
   Sustain ╱   75   ╲  Stability
            ╲      ╱
             ╲    ╱
              ╲  ╱
          Liquidity
           Access
            │
       Protocol
         Trust
```

Each factor explained in plain English. Click **"AI analysis →"** on any vault for a contextual risk narrative generated by Llama 3.3 70B via Groq.

### 4. AI-Generated Recommendations
When the Yield Optimizer finds the best vault, an LLM generates a recommendation explaining why this vault fits the user's deposit amount and risk tolerance. Runs server-side via `/api/analyze` to protect the API key.

### 5. Market Intelligence — Auto-Generated Insights
Computed from real vault data: stablecoin yield trends, best low-risk opportunities, protocol dominance, yield direction vs 30-day averages.

### 6. Idle Asset Detection + Withdraw
When wallet connected, portfolio panel shows active positions with a **Withdraw** button. Detects idle assets and suggests vaults. Withdrawal uses on-chain balance verification to find the correct vault LP token, handles approval, and executes via Composer.

---

## How It Uses LI.FI Earn

### Two-Service Integration

```
┌────────────────────────────────────────────────────────┐
│                    LI.FI EARN                           │
│                                                         │
│   ┌─────────────────────┐   ┌────────────────────────┐ │
│   │  Earn Data API      │   │  Composer              │ │
│   │  earn.li.fi         │   │  li.quest              │ │
│   │                     │   │                        │ │
│   │  • Vault discovery  │   │  • Transaction quotes  │ │
│   │  • Portfolio data   │   │  • Swap + bridge +     │ │
│   │  • Chain metadata   │   │    deposit in 1 tx     │ │
│   │  • Protocol list    │   │  • Status tracking     │ │
│   │  • APY/TVL analytics│   │                        │ │
│   │                     │   │  toToken = vault addr  │ │
│   │  No auth required   │   │  API key optional      │ │
│   └─────────────────────┘   └────────────────────────┘ │
│                                                         │
│   "Business in the front, party in the back"            │
└────────────────────────────────────────────────────────┘
```

### API Endpoints Used

| # | Service | Endpoint | Method | Purpose | Calls per session |
|---|---------|----------|--------|---------|-------------------|
| 1 | Earn | `/v1/earn/vaults` | GET | Paginated vault discovery | 6-8 (pagination) |
| 2 | Earn | `/v1/earn/vaults/:chainId/:address` | GET | Individual vault detail | On demand |
| 3 | Earn | `/v1/earn/chains` | GET | Chain filter dropdown | 1 |
| 4 | Earn | `/v1/earn/protocols` | GET | Protocol filter dropdown | 1 |
| 5 | Earn | `/v1/earn/portfolio/:addr/positions` | GET | User's yield positions | 1 (on wallet connect) |
| 6 | Composer | `/v1/quote` | GET | Deposit/withdraw transaction quote | On deposit or withdraw |
| 7 | Composer | `/v1/status` | GET | Transaction tracking | After tx confirmed |
| 8 | Composer | `/v1/gas/suggestion/{chainId}` | GET | Real-time gas cost per chain | On page load (per chain) |
| 9 | Internal | `/api/analyze` | POST | LLM risk narrative + recommendations | On AI analysis click |

**Total: 8 LI.FI endpoints across 2 services + 1 internal LLM route, ~20+ API calls per session.**

### Net Yield Calculation

```
Net APY = Nominal APY − (deposit_cost ÷ deposit_amount) × 100

Where deposit_cost (verified from real Composer quotes, April 13 2026):
  Same-chain:   ~$0.02   (gas $0.017 + LI.FI fee $0.003)
  Cross-chain:  ~$2.70   (bridge fee + gas + LI.FI fee)

Break-even = deposit_cost ÷ (deposit_amount × nominal_apy ÷ 365)

Example ($1,000 USDC → Morpho vault on Base, same-chain):
  Nominal APY:       7.04%
  Deposit cost:      $0.02
  Cost as APY:       0.002%
  Net APY:           7.038%
  Annual earnings:   $70.38
  Break-even:        < 1 day
```

---

## Judging Criteria Mapping

The hackathon scores across 4 dimensions. Here's how Aporis maps to each:

### API Integration — 35%

| What Judges Look For | What Aporis Does |
|---|---|
| Deep use of Earn Data API | 5 Earn endpoints used: vaults (paginated), vault detail, chains, protocols, portfolio |
| Composer integration | Quote generation + transaction execution for one-click deposits |
| Proper error handling | Null-safe APY fields, pagination cursor handling, API error states |
| Both services used | Earn Data API for discovery + Composer for execution |
| Real data, no mocks | All 590+ vaults loaded live from earn.li.fi on every page load |
| Live API counter | Header badge shows total API calls and endpoint count in real-time |

### Innovation — 25%

| What Judges Look For | What Aporis Does |
|---|---|
| Unique approach | Net APY calculation — nobody else subtracts real fees from yield |
| Creative problem solving | Smart Search (NLP), LLM risk narratives, interactive bubble chart |
| Novel visualization | Custom SVG radar chart for 5-axis risk analysis |
| Not "just a dashboard" | Intelligence engine: risk scoring, optimization, market insights |
| AI integration | 6 AI features embedded in product UX + LLM narratives (not a chatbot) |

### Product Completeness — 20%

| What Judges Look For | What Aporis Does |
|---|---|
| Working end-to-end | Discover → Analyze → Optimize → Deposit → Track |
| Handles edge cases | Null APY, zero TVL, empty portfolio, no matching vaults |
| Functional, not mockup | Deployed app with real API data and real deposit execution |
| Professional finish | Dark terminal aesthetic, smooth animations, responsive layout |
| Wallet integration | Reown AppKit with EIP-6963 multi-wallet discovery, 12 chains |

### Presentation — 20%

| What Judges Look For | What Aporis Does |
|---|---|
| Clear demo | 60-second flow: search → optimize → deposit |
| Visual quality | Nansen-inspired trading terminal with custom SVG charts |
| Good documentation | This README with architecture diagrams, data flows, API mapping |
| Compelling narrative | "What do you *really* earn?" — answers a question nobody else does |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2 |
| UI Library | React | 19.2 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 4 |
| Wallet | wagmi + viem + Reown AppKit | v3 / v2 / v1 |
| State | TanStack React Query | 5 |
| Visualizations | Custom SVG (no chart library) | — |
| Typography | Geist Mono | — |
| Icons | Lucide React | — |

---

## Project Structure

```
aporis/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Single-page terminal dashboard
│   │   ├── layout.tsx            # Dark theme + Geist Mono font
│   │   ├── globals.css           # Trading terminal palette, grid background, animations
│   │   └── providers.tsx         # Wagmi + Reown AppKit + React Query providers
│   │
│   ├── components/               # UI components (10 total)
│   │   ├── Header.tsx            # Logo + live API call counter + wallet connect
│   │   ├── HeroStats.tsx         # 4 metric cards with glow effects
│   │   ├── SmartSearch.tsx       # Natural language search → filter pills
│   │   ├── YieldOptimizer.tsx    # Amount/asset/risk → best vault recommendation
│   │   ├── VaultTable.tsx        # Dense sortable table with Net APY column
│   │   ├── RiskRadar.tsx         # SVG 5-axis pentagon radar chart
│   │   ├── NetYieldBar.tsx       # SVG waterfall bars (nominal → costs → net)
│   │   ├── MarketIntel.tsx       # Auto-generated market insight feed
│   │   ├── VaultBubbles.tsx      # Interactive bubble chart with chain/asset filters
│   │   ├── PortfolioPanel.tsx    # Positions + idle assets + withdraw button
│   │   ├── DepositModal.tsx      # Approval → quote → cross-chain → execute → track
│   │   └── WithdrawModal.tsx     # On-chain balance → approval → withdraw via Composer
│   │
│   ├── lib/                      # Business logic + API client (7 modules)
│   │   ├── api.ts                # LI.FI API client (both services) + call counter
│   │   ├── risk-engine.ts        # 5-factor risk scoring + radar chart scores
│   │   ├── optimizer.ts          # Chain-aware net yield calculator + vault ranking
│   │   ├── search-parser.ts      # Natural language → SearchFilters parsing
│   │   ├── market-intel.ts       # Insight generation from vault data aggregates
│   │   ├── llm.ts                # LLM integration (Groq, configurable via env)
│   │   ├── wagmi.ts              # Wallet config via Reown AppKit (12 EVM chains)
│   │   └── utils.ts              # cn, formatUsd, formatApy, parseTvl, shortenAddress
│   │
│   ├── hooks/
│   │   └── useVaults.ts          # React Query hooks for vaults, chains, protocols, portfolio
│   │
│   └── types/
│       └── index.ts              # TypeScript interfaces from verified API responses
│
├── .env.local                    # API keys (optional, not committed)
├── package.json
├── next.config.ts
├── tsconfig.json
└── README.md
```

**27 source files. Zero external chart libraries. Zero mock data. LLM via configurable OpenAI-compatible endpoint (default: Groq free tier).**

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Install

```bash
cd aporis
npm install --legacy-peer-deps
```

### Configure (optional)

```bash
cp .env.example .env.local
# Then fill in your keys
```

See `.env.example` for all available environment variables. The app works without any keys — the Earn Data API requires no authentication.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build & Deploy

```bash
npm run build     # Production build
npx vercel        # Deploy to Vercel
```