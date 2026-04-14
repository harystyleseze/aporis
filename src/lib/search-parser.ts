import type { SearchFilters } from '@/types';

// Natural language → structured filters
// Parses queries like "safe USDC vaults on Base above 5%"

const CHAIN_MAP: Record<string, number> = {
  ethereum: 1, eth: 1, mainnet: 1,
  optimism: 10, op: 10,
  bsc: 56, bnb: 56,
  gnosis: 100,
  polygon: 137, matic: 137,
  mantle: 5000,
  base: 8453,
  arbitrum: 42161, arb: 42161,
  celo: 42220,
  avalanche: 43114, avax: 43114,
  linea: 59144,
  berachain: 80094, bera: 80094,
};

const ASSET_PATTERNS = [
  'usdc', 'usdt', 'eth', 'weth', 'wsteth', 'weeth', 'dai',
  'wbtc', 'cbbtc', 'skaito', 'wmon',
];

const PROTOCOL_MAP: Record<string, string> = {
  morpho: 'morpho-v1', aave: 'aave-v3', euler: 'euler-v2',
  pendle: 'pendle', maple: 'maple', ethena: 'ethena-usde',
  etherfi: 'ether.fi-stake', yo: 'yo-protocol',
  neverland: 'neverland', upshift: 'upshift',
};

export function parseSearchQuery(query: string): SearchFilters {
  const lower = query.toLowerCase().trim();
  const filters: SearchFilters = {};

  // Chain detection
  for (const [keyword, chainId] of Object.entries(CHAIN_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`).test(lower)) {
      filters.chainId = chainId;
      break;
    }
  }

  // Asset detection
  for (const asset of ASSET_PATTERNS) {
    if (new RegExp(`\\b${asset}\\b`).test(lower)) {
      filters.asset = asset.toUpperCase();
      break;
    }
  }

  // Protocol detection
  for (const [keyword, protocol] of Object.entries(PROTOCOL_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`).test(lower)) {
      filters.protocol = protocol;
      break;
    }
  }

  // APY detection: "above 5%", ">5%", "5%+"
  const apyMatch = lower.match(/(?:above|over|>|min(?:imum)?)\s*(\d+(?:\.\d+)?)\s*%/);
  if (apyMatch) {
    filters.minApy = parseFloat(apyMatch[1]);
  }

  // Risk tolerance
  if (/\b(safe|low risk|conservative|safest|secure)\b/.test(lower)) {
    filters.riskTolerance = 'low';
  } else if (/\b(risky|aggressive|high yield|highest|max)\b/.test(lower)) {
    filters.riskTolerance = 'high';
  } else if (/\b(moderate|balanced|medium)\b/.test(lower)) {
    filters.riskTolerance = 'medium';
  }

  return filters;
}

export function filtersToDescription(filters: SearchFilters): string {
  const parts: string[] = [];
  if (filters.asset) parts.push(filters.asset);
  if (filters.protocol) parts.push(filters.protocol);
  if (filters.chainId) {
    const name = Object.entries(CHAIN_MAP).find(([, v]) => v === filters.chainId)?.[0];
    if (name) parts.push(name.charAt(0).toUpperCase() + name.slice(1));
  }
  if (filters.minApy) parts.push(`>${filters.minApy}% APY`);
  if (filters.riskTolerance) parts.push(`${filters.riskTolerance} risk`);
  return parts.join(' · ') || 'All vaults';
}
