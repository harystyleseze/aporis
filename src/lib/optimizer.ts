import type { Vault, OptimizerResult, NetYieldResult } from '@/types';
import { analyzeRisk } from './risk-engine';

const LIFI_FEE = 0.003; // LI.FI fixed fee (~$0.003)
const CROSS_CHAIN_EXTRA = 2.50; // bridge overhead
const DEFAULT_GAS_USD = 0.05; // fallback if no estimate

function getChainCost(
  chainId: number,
  isCrossChain: boolean,
  gasEstimates?: Record<number, number>,
) {
  // Use real-time estimate from /v1/gas/suggestion if available
  const gasCost = (gasEstimates?.[chainId] ?? DEFAULT_GAS_USD) + (isCrossChain ? CROSS_CHAIN_EXTRA : 0);
  return { gasCostUsd: gasCost, feeCostUsd: LIFI_FEE, totalCostUsd: gasCost + LIFI_FEE };
}

export function calculateNetYield(
  vault: Vault,
  depositUsd: number,
  isCrossChain = false,
  gasEstimates?: Record<number, number>,
): NetYieldResult {
  const nominalApy = vault.analytics.apy.total;
  const costs = getChainCost(vault.chainId, isCrossChain, gasEstimates);

  const costAsApy = depositUsd > 0 ? (costs.totalCostUsd / depositUsd) * 100 : 0;
  const netApy = nominalApy - costAsApy;
  const annualEarnings = (depositUsd * netApy) / 100;
  const monthlyEarnings = annualEarnings / 12;
  const breakEvenDays =
    nominalApy > 0 && costs.totalCostUsd > 0
      ? (costs.totalCostUsd / ((depositUsd * nominalApy) / 100 / 365))
      : 0;

  return {
    nominalApy,
    netApy,
    totalCostUsd: costs.totalCostUsd,
    gasCostUsd: costs.gasCostUsd,
    feeCostUsd: costs.feeCostUsd,
    annualEarnings,
    monthlyEarnings,
    breakEvenDays,
  };
}

export function findBestVaults(
  vaults: Vault[],
  params: {
    amount: number;
    asset: string;
    riskTolerance: 'low' | 'medium' | 'high';
    sourceChainId?: number;
    gasEstimates?: Record<number, number>;
  },
  topN = 3,
): OptimizerResult[] {
  const candidates = vaults.filter(v =>
    v.isTransactional &&
    v.underlyingTokens.some(
      t => t.symbol.toUpperCase() === params.asset.toUpperCase(),
    ),
  );

  const scored = candidates.map(vault => {
    const isCross = params.sourceChainId
      ? params.sourceChainId !== vault.chainId
      : false;
    const netYield = calculateNetYield(vault, params.amount, isCross, params.gasEstimates);
    const risk = analyzeRisk(vault);
    return { vault, netYield, risk, rank: 0 };
  });

  const filtered = scored.filter(s => {
    if (params.riskTolerance === 'low') return s.risk.overall === 'low';
    if (params.riskTolerance === 'medium') return s.risk.overall === 'low' || s.risk.overall === 'medium';
    return true;
  });

  filtered.sort((a, b) => b.netYield.netApy - a.netYield.netApy);
  const results = filtered.length > 0 ? filtered : scored;
  results.sort((a, b) => b.netYield.netApy - a.netYield.netApy);

  return results.slice(0, topN).map((r, i) => ({ ...r, rank: i + 1 }));
}
