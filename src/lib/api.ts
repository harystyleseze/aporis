// LI.FI API Client — Earn Data API + Composer + SDK
// earn.li.fi (no auth) | li.quest (optional key) | @lifi/sdk (token data)

import { createConfig } from '@lifi/sdk';
import type {
  Vault, VaultsResponse, PortfolioResponse,
  EarnChain, EarnProtocol, ComposerQuote, TransferStatus,
} from '@/types';

// ── SDK init ───────────────────────────────────────────
createConfig({ integrator: 'aporis' });

const EARN_BASE = 'https://earn.li.fi';
const COMPOSER_BASE = 'https://li.quest';

// ── API Call Counter ───────────────────────────────────
let apiCallCount = 0;
const endpointsUsed = new Set<string>();

function tracked(endpoint: string, url: string): string {
  apiCallCount++;
  endpointsUsed.add(endpoint);
  return url;
}

export function getApiStats() {
  return { calls: apiCallCount, endpoints: endpointsUsed.size };
}

// ── Earn Data API (5 endpoints) ────────────────────────

export async function fetchVaults(params?: {
  chainId?: number;
  asset?: string;
  protocol?: string;
  minTvlUsd?: number;
  sortBy?: 'apy' | 'tvl';
  limit?: number;
  cursor?: string;
}): Promise<VaultsResponse> {
  const sp = new URLSearchParams();
  if (params?.chainId) sp.set('chainId', String(params.chainId));
  if (params?.asset) sp.set('asset', params.asset);
  if (params?.protocol) sp.set('protocol', params.protocol);
  if (params?.minTvlUsd) sp.set('minTvlUsd', String(params.minTvlUsd));
  if (params?.sortBy) sp.set('sortBy', params.sortBy);
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.cursor) sp.set('cursor', params.cursor);

  const url = tracked('earn/vaults', `${EARN_BASE}/v1/earn/vaults?${sp}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Earn API ${res.status}`);
  return res.json();
}

export async function fetchChains(): Promise<EarnChain[]> {
  const url = tracked('earn/chains', `${EARN_BASE}/v1/earn/chains`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chains ${res.status}`);
  return res.json();
}

export async function fetchProtocols(): Promise<EarnProtocol[]> {
  const url = tracked('earn/protocols', `${EARN_BASE}/v1/earn/protocols`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Protocols ${res.status}`);
  return res.json();
}

export async function fetchPortfolio(
  userAddress: string,
): Promise<PortfolioResponse> {
  const url = tracked('earn/portfolio', `${EARN_BASE}/v1/earn/portfolio/${userAddress}/positions`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Portfolio ${res.status}`);
  return res.json();
}

// ── Composer API (6 endpoints) ─────────────────────────

function composerHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const key = process.env.NEXT_PUBLIC_LIFI_API_KEY;
  if (key) h['x-lifi-api-key'] = key;
  return h;
}

export async function fetchQuote(params: {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  fromAmount: string;
  slippage?: number;
  integrator?: string;
}): Promise<ComposerQuote> {
  const sp = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAddress: params.fromAddress,
    toAddress: params.fromAddress,
    fromAmount: params.fromAmount,
    integrator: params.integrator || 'aporis',
  });
  if (params.slippage) sp.set('slippage', String(params.slippage));

  const url = tracked('composer/quote', `${COMPOSER_BASE}/v1/quote?${sp}`);
  const res = await fetch(url, { headers: composerHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Quote ${res.status}`);
  }
  return res.json();
}

export async function fetchStatus(txHash: string): Promise<TransferStatus> {
  const url = tracked('composer/status', `${COMPOSER_BASE}/v1/status?txHash=${txHash}`);
  const res = await fetch(url, { headers: composerHeaders() });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export async function fetchTokens(chainId: number) {
  const url = tracked('composer/tokens', `${COMPOSER_BASE}/v1/tokens?chains=${chainId}`);
  const res = await fetch(url, { headers: composerHeaders() });
  if (!res.ok) throw new Error(`Tokens ${res.status}`);
  return res.json();
}

export async function fetchTools() {
  const url = tracked('composer/tools', `${COMPOSER_BASE}/v1/tools`);
  const res = await fetch(url, { headers: composerHeaders() });
  if (!res.ok) throw new Error(`Tools ${res.status}`);
  return res.json();
}

// ── Gas Estimates ──────────────────────────────────────

export async function fetchGasSuggestion(chainId: number): Promise<number> {
  try {
    const url = tracked('composer/gas', `${COMPOSER_BASE}/v1/gas/suggestion/${chainId}`);
    const res = await fetch(url, { headers: composerHeaders() });
    if (!res.ok) return 0.05;
    const data = await res.json();
    return parseFloat(data?.recommended?.amountUsd || '0.05');
  } catch {
    return 0.05;
  }
}

export async function fetchGasEstimates(chainIds: number[]): Promise<Record<number, number>> {
  const unique = [...new Set(chainIds)];
  const results = await Promise.all(
    unique.map(async (id) => ({ id, cost: await fetchGasSuggestion(id) })),
  );
  const map: Record<number, number> = {};
  for (const r of results) map[r.id] = r.cost;
  return map;
}

// ── Pagination Helper ──────────────────────────────────

export async function fetchAllVaults(params?: {
  chainId?: number;
  maxPages?: number;
}): Promise<{ vaults: Vault[]; total: number }> {
  const all: Vault[] = [];
  let cursor: string | undefined;
  let pages = 0;
  const limit = params?.maxPages ?? 8;

  do {
    const res = await fetchVaults({
      chainId: params?.chainId,
      limit: 100,
      cursor,
    });
    all.push(...res.data);
    cursor = res.nextCursor ?? undefined;
    pages++;
  } while (cursor && pages < limit);

  return { vaults: all, total: all.length };
}
