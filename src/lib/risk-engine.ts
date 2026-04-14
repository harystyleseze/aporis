import type { Vault, RiskAnalysis, RiskFactor, RadarScores } from '@/types';
import { parseTvl } from './utils';

const TRUSTED_PROTOCOLS = ['aave-v3', 'morpho-v1', 'euler-v2', 'pendle', 'maple'];

export function computeRadarScores(vault: Vault): RadarScores {
  const tvl = parseTvl(vault.analytics.tvl.usd);
  const apy = vault.analytics.apy;
  const apy7d = vault.analytics.apy7d;
  const apy30d = vault.analytics.apy30d;

  // TVL Depth: higher TVL = higher score
  let tvlDepth = 0;
  if (tvl >= 100_000_000) tvlDepth = 95;
  else if (tvl >= 50_000_000) tvlDepth = 85;
  else if (tvl >= 10_000_000) tvlDepth = 70;
  else if (tvl >= 5_000_000) tvlDepth = 55;
  else if (tvl >= 1_000_000) tvlDepth = 40;
  else tvlDepth = 20;

  // APY Stability: lower variance = higher score
  let apyStability = 70; // default moderate
  if (apy7d !== null && apy.total > 0) {
    const drift = Math.abs(apy.total - apy7d) / apy.total;
    if (drift < 0.1) apyStability = 90;
    else if (drift < 0.25) apyStability = 70;
    else if (drift < 0.5) apyStability = 45;
    else apyStability = 20;
  }

  // Protocol Trust
  const protocolTrust = TRUSTED_PROTOCOLS.includes(vault.protocol.name) ? 90 : 50;

  // Liquidity Access: instant redeem = high
  let liquidityAccess = 50;
  if (vault.isRedeemable && vault.redeemPacks.some(r => r.stepsType === 'instant')) {
    liquidityAccess = 90;
  } else if (vault.isRedeemable) {
    liquidityAccess = 65;
  }

  // Yield Sustainability: compare current vs 30d. If current >> 30d, unsustainable
  let yieldSustain = 70;
  if (apy30d !== null && apy.total > 0) {
    const ratio = apy.total / apy30d;
    if (ratio >= 0.8 && ratio <= 1.3) yieldSustain = 85;
    else if (ratio >= 0.5 && ratio <= 2) yieldSustain = 60;
    else yieldSustain = 30;
  }
  // Extremely high APY is inherently unsustainable
  if (apy.total > 50) yieldSustain = Math.min(yieldSustain, 25);
  if (apy.total > 20) yieldSustain = Math.min(yieldSustain, 50);

  return { tvlDepth, apyStability, protocolTrust, liquidityAccess, yieldSustain };
}

export function analyzeRisk(vault: Vault): RiskAnalysis {
  const scores = computeRadarScores(vault);
  const tvl = parseTvl(vault.analytics.tvl.usd);
  const apy = vault.analytics.apy;
  const factors: RiskFactor[] = [];

  // TVL
  if (scores.tvlDepth >= 70) {
    factors.push({ level: 'low', label: 'High TVL', detail: `$${(tvl / 1e6).toFixed(1)}M locked — deep liquidity`, score: scores.tvlDepth });
  } else if (scores.tvlDepth >= 40) {
    factors.push({ level: 'medium', label: 'Moderate TVL', detail: `$${(tvl / 1e6).toFixed(1)}M — decent but watch liquidity`, score: scores.tvlDepth });
  } else {
    factors.push({ level: 'high', label: 'Low TVL', detail: `$${(tvl / 1e3).toFixed(0)}K — potential liquidity risk`, score: scores.tvlDepth });
  }

  // Protocol
  if (scores.protocolTrust >= 80) {
    factors.push({ level: 'low', label: 'Trusted protocol', detail: `${vault.protocol.name} is battle-tested`, score: scores.protocolTrust });
  } else {
    factors.push({ level: 'medium', label: 'Newer protocol', detail: `${vault.protocol.name} — verify audit status`, score: scores.protocolTrust });
  }

  // APY stability
  if (scores.apyStability >= 75) {
    factors.push({ level: 'low', label: 'Stable yield', detail: 'APY consistent over 7 days', score: scores.apyStability });
  } else if (scores.apyStability >= 45) {
    factors.push({ level: 'medium', label: 'APY fluctuation', detail: 'Yield varies — monitor regularly', score: scores.apyStability });
  } else {
    factors.push({ level: 'high', label: 'Volatile APY', detail: 'High variance in recent yield', score: scores.apyStability });
  }

  // Stablecoin / IL
  if (vault.tags.includes('stablecoin')) {
    factors.push({ level: 'low', label: 'Stablecoin', detail: 'No impermanent loss exposure', score: 90 });
  }
  if (vault.tags.includes('il-risk')) {
    factors.push({ level: 'high', label: 'IL exposure', detail: 'Subject to impermanent loss', score: 20 });
  }

  // Extreme APY warning
  if (apy.total > 50) {
    factors.push({ level: 'high', label: 'Extreme APY', detail: `${apy.total.toFixed(1)}% — likely unsustainable`, score: 15 });
  } else if (apy.total > 15) {
    factors.push({ level: 'medium', label: 'High APY', detail: `${apy.total.toFixed(1)}% — verify reward sustainability`, score: 40 });
  }

  // Liquidity
  if (scores.liquidityAccess >= 80) {
    factors.push({ level: 'low', label: 'Instant withdrawal', detail: 'No lockup period', score: scores.liquidityAccess });
  } else {
    factors.push({ level: 'medium', label: 'Withdrawal delay', detail: 'Multi-step or timelocked redemption', score: scores.liquidityAccess });
  }

  const highCount = factors.filter(f => f.level === 'high').length;
  const medCount = factors.filter(f => f.level === 'medium').length;
  const overall = highCount > 0 ? 'high' : medCount > 1 ? 'medium' : 'low';

  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 5;

  let summary: string;
  if (overall === 'low') {
    summary = `${vault.name} on ${vault.network} is a relatively safe choice. ${vault.protocol.name} protocol, $${(tvl / 1e6).toFixed(1)}M TVL, ${apy.total.toFixed(2)}% APY.`;
  } else if (overall === 'medium') {
    summary = `${vault.name} has moderate risk factors. ${vault.protocol.name} on ${vault.network}, $${(tvl / 1e6).toFixed(1)}M TVL. Review details before depositing.`;
  } else {
    summary = `${vault.name} carries elevated risk. High-yield vaults often have tradeoffs — proceed with caution.`;
  }

  return { overall, factors, summary, radarScores: scores };
}
