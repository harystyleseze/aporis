// Types derived from REAL earn.li.fi API responses (verified April 13, 2026)

// ── Earn Data API Types ────────────────────────────────

export interface UnderlyingToken {
  symbol: string;
  address: string;
  decimals: number;
  weight?: number; // for multi-asset vaults
}

export interface LpToken {
  address: string;
  symbol: string;
  decimals: number;
  priceUsd?: string;
}

export interface RewardToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface VaultCaps {
  totalCap?: string;
  maxCap?: string;
}

export interface VaultProtocol {
  name: string;
  url: string;
  logoUri?: string;
}

export interface VaultApy {
  base: number;
  total: number;
  reward: number | null;
}

export interface VaultAnalytics {
  apy: VaultApy;
  tvl: { usd: string };
  apy1d: number | null;
  apy7d: number | null;
  apy30d: number | null;
  updatedAt: string;
}

export interface DepositPack {
  name: string;
  stepsType: string;
}

export interface Vault {
  name: string;
  slug: string;
  tags: string[];
  address: string;
  chainId: number;
  network: string;
  description?: string;
  lpTokens: LpToken[];
  rewardTokens?: RewardToken[];
  protocol: VaultProtocol;
  provider: string;
  syncedAt: string;
  analytics: VaultAnalytics;
  caps?: VaultCaps;
  timeLock?: number; // seconds, 0 = instant
  kyc?: boolean;
  redeemPacks: DepositPack[];
  depositPacks: DepositPack[];
  isRedeemable: boolean;
  isTransactional: boolean;
  underlyingTokens: UnderlyingToken[];
}

export interface VaultsResponse {
  data: Vault[];
  nextCursor: string | null;
  total: number;
}

export interface EarnChain {
  chainId: number;
  name: string;
  networkCaip: string;
}

export interface EarnProtocol {
  name: string;
  url: string;
}

export interface PortfolioPosition {
  chainId: number;
  protocolName: string;
  asset: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  balanceUsd: string;
  balanceNative: string;
}

export interface PortfolioResponse {
  positions: PortfolioPosition[];
}

// ── Composer API Types ─────────────────────────────────

export interface ComposerToken {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  name: string;
  priceUSD?: string;
  logoURI?: string;
}

export interface GasCost {
  type: string;
  amount: string;
  amountUSD: string;
  token: ComposerToken;
}

export interface FeeCost {
  name: string;
  amount: string;
  amountUSD: string;
  token: ComposerToken;
}

export interface ComposerQuote {
  id: string;
  type: string;
  tool: string;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: ComposerToken;
    toToken: ComposerToken;
    fromAmount: string;
    slippage: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    toAmount: string;
    toAmountMin: string;
    feeCosts: FeeCost[];
    gasCosts: GasCost[];
    executionDuration: number;
  };
  transactionRequest: {
    to: string;
    from: string;
    data: string;
    value: string;
    chainId: number;
  };
  includedSteps?: Array<{
    type: string;
    tool: string;
  }>;
}

export interface TransferStatus {
  status: 'NOT_FOUND' | 'INVALID' | 'PENDING' | 'DONE' | 'FAILED';
  substatus?: string;
  substatusMessage?: string;
  lifiExplorerLink?: string;
}

// ── UI / Intelligence Types ────────────────────────────

export interface NetYieldResult {
  nominalApy: number;
  netApy: number;
  totalCostUsd: number;
  gasCostUsd: number;
  feeCostUsd: number;
  annualEarnings: number;
  monthlyEarnings: number;
  breakEvenDays: number;
}

export interface RiskFactor {
  level: 'low' | 'medium' | 'high';
  label: string;
  detail: string;
  score: number; // 0-100
}

export interface RiskAnalysis {
  overall: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  summary: string;
  radarScores: RadarScores;
}

export interface RadarScores {
  tvlDepth: number;       // 0-100
  apyStability: number;   // 0-100
  protocolTrust: number;  // 0-100
  liquidityAccess: number; // 0-100
  yieldSustain: number;   // 0-100
}

export interface MarketInsight {
  id: string;
  type: 'trend' | 'opportunity' | 'alert' | 'stat';
  text: string;
  value?: string;
  direction?: 'up' | 'down' | 'neutral';
}

export interface OptimizerResult {
  vault: Vault;
  netYield: NetYieldResult;
  risk: RiskAnalysis;
  rank: number;
}

export interface SearchFilters {
  chainId?: number;
  asset?: string;
  protocol?: string;
  minApy?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
}
