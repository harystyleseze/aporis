import type { Vault, MarketInsight } from '@/types';
import { parseTvl, formatUsd } from './utils';
import { analyzeRisk } from './risk-engine';

export function generateInsights(vaults: Vault[]): MarketInsight[] {
  if (!vaults.length) return [];

  const insights: MarketInsight[] = [];
  let id = 0;

  // Total TVL
  const totalTvl = vaults.reduce((s, v) => s + parseTvl(v.analytics.tvl.usd), 0);
  insights.push({
    id: String(id++),
    type: 'stat',
    text: `Total TVL across ${vaults.length} vaults`,
    value: formatUsd(totalTvl),
    direction: 'neutral',
  });

  // Median APY for stablecoins
  const stableVaults = vaults.filter(v => v.tags.includes('stablecoin') && v.analytics.apy.total > 0);
  if (stableVaults.length > 0) {
    const apys = stableVaults.map(v => v.analytics.apy.total).sort((a, b) => a - b);
    const median = apys[Math.floor(apys.length / 2)];
    insights.push({
      id: String(id++),
      type: 'stat',
      text: 'Stablecoin median APY',
      value: `${median.toFixed(2)}%`,
      direction: 'neutral',
    });
  }

  // Best low-risk opportunity
  const depositable = vaults.filter(v => v.isTransactional && v.analytics.apy.total > 0);
  const lowRiskHigh = depositable
    .filter(v => {
      const risk = analyzeRisk(v);
      return risk.overall === 'low';
    })
    .sort((a, b) => b.analytics.apy.total - a.analytics.apy.total);

  if (lowRiskHigh.length > 0) {
    const best = lowRiskHigh[0];
    insights.push({
      id: String(id++),
      type: 'opportunity',
      text: `Best low-risk: ${best.name} on ${best.network}`,
      value: `${best.analytics.apy.total.toFixed(2)}% APY`,
      direction: 'up',
    });
  }

  // Count of opportunities above 5% with low risk
  const goodOpps = lowRiskHigh.filter(v => v.analytics.apy.total >= 5);
  if (goodOpps.length > 0) {
    insights.push({
      id: String(id++),
      type: 'opportunity',
      text: `${goodOpps.length} low-risk vault${goodOpps.length > 1 ? 's' : ''} above 5% APY`,
      direction: 'up',
    });
  }

  // Protocol dominance by vault count
  const protoCounts: Record<string, number> = {};
  vaults.forEach(v => {
    protoCounts[v.protocol.name] = (protoCounts[v.protocol.name] || 0) + 1;
  });
  const topProto = Object.entries(protoCounts).sort((a, b) => b[1] - a[1])[0];
  if (topProto) {
    const pct = ((topProto[1] / vaults.length) * 100).toFixed(0);
    insights.push({
      id: String(id++),
      type: 'stat',
      text: `${topProto[0]} leads with ${pct}% of vaults`,
      value: `${topProto[1]} vaults`,
      direction: 'neutral',
    });
  }

  // APY trend: compare current vs 30d for stable vaults
  const withHistory = stableVaults.filter(v => v.analytics.apy30d !== null);
  if (withHistory.length >= 5) {
    const avgCurrent = withHistory.reduce((s, v) => s + v.analytics.apy.total, 0) / withHistory.length;
    const avg30d = withHistory.reduce((s, v) => s + (v.analytics.apy30d ?? 0), 0) / withHistory.length;
    const diff = avgCurrent - avg30d;
    insights.push({
      id: String(id++),
      type: 'trend',
      text: `Stablecoin yields ${diff >= 0 ? 'up' : 'down'} ${Math.abs(diff).toFixed(2)}% vs 30d avg`,
      direction: diff >= 0 ? 'up' : 'down',
    });
  }

  // Chains with most vaults
  const chainCounts: Record<string, number> = {};
  vaults.forEach(v => {
    chainCounts[v.network] = (chainCounts[v.network] || 0) + 1;
  });
  const topChain = Object.entries(chainCounts).sort((a, b) => b[1] - a[1])[0];
  if (topChain) {
    insights.push({
      id: String(id++),
      type: 'stat',
      text: `${topChain[0]} has most vaults`,
      value: `${topChain[1]} vaults`,
      direction: 'neutral',
    });
  }

  return insights;
}
