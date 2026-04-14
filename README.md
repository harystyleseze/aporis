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

1. **Discovers** 590+ vaults across Aave, Morpho, Euler, Pendle, and 7 other protocols in real time
2. **Analyzes risk** through a transparent 5-factor scoring engine (TVL depth, APY stability, protocol trust, liquidity access, yield sustainability)
3. **Calculates net yield** — the actual return after gas and protocol fees, not just nominal APY
4. **Optimizes allocation** — input your amount, asset, and risk tolerance, and the engine finds the best vault ranked by net APY
5. **Executes deposits** in one click via LI.FI Composer (swap + bridge + deposit in a single transaction)
6. **Tracks positions** and detects idle assets sitting in your wallet not earning yield

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
│                        YIELDPILOT                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    PRESENTATION LAYER                      │  │
│  │                                                            │  │
│  │  Header ─── SmartSearch ─── ApiCounter ─── WalletConnect  │  │
│  │  HeroStats (4 live metric cards)                           │  │
│  │                                                            │  │
│  │  ┌─── Left Column ────────┐  ┌─── Right Column ────────┐  │  │
│  │  │ YieldOptimizer         │  │ RiskRadar (SVG)          │  │  │
│  │  │ VaultTable (sortable)  │  │ NetYieldBar (SVG)        │  │  │
│  │  │ DepositModal           │  │ MarketIntel              │  │  │
│  │  └────────────────────────┘  │ PortfolioPanel           │  │  │
│  │                              └──────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   INTELLIGENCE LAYER                       │  │
│  │                                                            │  │
│  │  search-parser.ts ── Natural language → structured filters │  │
│  │  optimizer.ts ─────── Net yield calc + vault ranking       │  │
│  │  risk-engine.ts ───── 5-axis risk scoring + radar scores   │  │
│  │  market-intel.ts ──── Insight generation from aggregates   │  │
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
    │  LI.FI Earn  │  │ LI.FI        │  │   User's     │
    │  Data API    │  │ Composer     │  │   Wallet     │
    │              │  │              │  │              │
    │ earn.li.fi   │  │ li.quest     │  │  wagmi +     │
    │ No auth      │  │ API key opt  │  │  RainbowKit  │
    │              │  │              │  │              │
    │ • Vaults     │  │ • Quote      │  │ • Sign tx    │
    │ • Chains     │  │ • Execute    │  │ • Switch     │
    │ • Protocols  │  │ • Status     │  │   chain      │
    │ • Portfolio  │  │              │  │ • Balances   │
    └──────────────┘  └──────────────┘  └──────────────┘
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
Type `"safe USDC vaults on Base above 5%"` and watch it parse into structured filters: `[USDC] [Base] [Low Risk] [>5% APY]`. Deterministic NLP — no LLM API call needed, instant results.

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

Each factor explained in plain English — no black-box scores.

### 4. Market Intelligence — Auto-Generated Insights
Computed from real vault data: stablecoin yield trends, best low-risk opportunities, protocol dominance, yield direction vs 30-day averages.

### 5. Idle Asset Detection
When wallet connected, portfolio panel checks for assets earning 0% and proactively suggests vaults to deploy idle capital.

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
| 6 | Composer | `/v1/quote` | GET | Deposit transaction quote | On deposit click |
| 7 | Composer | `/v1/status` | GET | Transaction tracking | On deposit confirm |

**Total: 7 unique endpoints across 2 services, ~12 API calls per page load.**

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
| Creative problem solving | Smart Search parses natural language without an LLM |
| Novel visualization | Custom SVG radar chart for 5-axis risk analysis |
| Not "just a dashboard" | Intelligence engine: risk scoring, optimization, market insights |
| AI integration | 5 AI features embedded in product UX (not a chatbot) |

### Product Completeness — 20%

| What Judges Look For | What Aporis Does |
|---|---|
| Working end-to-end | Discover → Analyze → Optimize → Deposit → Track |
| Handles edge cases | Null APY, zero TVL, empty portfolio, no matching vaults |
| Functional, not mockup | Deployed app with real API data and real deposit execution |
| Professional finish | Dark terminal aesthetic, smooth animations, responsive layout |
| Wallet integration | RainbowKit with 12 chain support, auto chain switching |

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
| Wallet | wagmi + viem + RainbowKit | v3 / v2 / v2 |
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
│   │   └── providers.tsx         # Wagmi + RainbowKit + React Query providers
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
│   │   ├── PortfolioPanel.tsx    # Wallet positions + idle asset detection
│   │   └── DepositModal.tsx      # Composer quote → fee preview → execute → track
│   │
│   ├── lib/                      # Business logic + API client (7 modules)
│   │   ├── api.ts                # LI.FI API client (both services) + call counter
│   │   ├── risk-engine.ts        # 5-factor risk scoring + radar chart scores
│   │   ├── optimizer.ts          # Net yield calculator + findBestVaults algorithm
│   │   ├── search-parser.ts      # Natural language → SearchFilters parsing
│   │   ├── market-intel.ts       # Insight generation from vault data aggregates
│   │   ├── wagmi.ts              # Wallet configuration (12 EVM chains)
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

**24 source files. Zero external chart libraries. Zero mock data. Zero LLM API dependencies.**

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

---

## What I'd Build Next

If development continued beyond the hackathon:

1. **Cross-chain deposit comparison** — Show fee estimates from multiple source chains so users pick the cheapest route to any vault
2. **APY alerts** — Notify users when vault APY drops below a threshold or when a better opportunity appears
3. **Historical APY charts** — Time-series visualization using the apy1d/apy7d/apy30d data to show yield trends
4. **Auto-rebalancing agent** — Monitor positions and suggest or execute moves when net yield favors a different vault
5. **Reward harvesting** — Aggregate unclaimed rewards across protocols and enable batch claiming
6. **Tax export** — Generate CSV reports categorizing yield income vs capital gains from portfolio events
7. **Mobile-responsive optimization** — Stack panels vertically and optimize touch targets for mobile users

---

## API Feedback

### What worked well
- **Two-service split** (discovery vs execution) is clean and intuitive — separation of concerns makes integration logical
- **No auth on Earn Data API** makes prototyping fast — could start building immediately without portal registration
- **Cursor-based pagination** handles 590+ vaults gracefully — predictable, no offset drift
- **`isTransactional` flag** clearly indicates which vaults support Composer deposits — prevents dead-end UX
- **Vault `tags`** (stablecoin, il-risk) enable meaningful risk analysis with minimal effort
- **Composer `toToken = vault address`** pattern is elegant — one parameter unlocks vault deposits

### Suggestions for improvement
- **`apy.reward`** is often `0` instead of `null` — documenting the semantic difference would help (is 0% reward intentional, or just no data?)
- **`apy1d` and `apy7d`** are frequently `null` even for established vaults — limits trend analysis; a fallback or interpolated value would help
- **Vault risk score** from LI.FI's side (even basic: audit status, age, TVL tier) would complement third-party analysis
- **Webhook/SSE support** for deposit completion would eliminate status polling
- **Endpoint for vault historical APY** time-series — would enable sparkline charts and trend detection without storing snapshots client-side

---

## Submission Info

| Field | Value |
|-------|-------|
| **Project** | Aporis |
| **Track** | AI x Earn |
| **Team size** | Solo |
| **Built with** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, wagmi, RainbowKit |
| **APIs used** | LI.FI Earn Data API (earn.li.fi) + LI.FI Composer (li.quest) |
| **Hackathon** | [DeFi Mullet #1](https://li.fi/) |
| **Registration** | [forms.gle/RFLGG8RiEKC3AqnQA](https://forms.gle/RFLGG8RiEKC3AqnQA) |
| **Submission form** | [forms.gle/1PCvD9BymH1EyRmV8](https://forms.gle/1PCvD9BymH1EyRmV8) |

### Submission Checklist

- [ ] Working demo (deployed app or screen-recorded video)
- [ ] Public tweet posted during submission window (April 14, 09:00–12:00 ET or APAC)
  - Includes: project name + description + demo video + repo link + track
  - Tags: @lifiprotocol @kenny_io
  - Text: "I just built Aporis with LI.FI Earn…"
- [ ] Google Form submitted with all required fields

---

## License

MIT
