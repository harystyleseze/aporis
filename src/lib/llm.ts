// LLM integration — OpenAI-compatible, configured for Groq (free tier)
// Used for: risk narrative generation, yield recommendation explanations
// Falls back to template strings if API key missing or call fails

import type { Vault, RiskAnalysis, NetYieldResult } from '@/types';
import { formatUsd, formatApy, parseTvl } from './utils';

function getConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
    apiKey: typeof window !== 'undefined' ? undefined : process.env.LLM_API_KEY,
  };
}

// ── Server-side LLM call ───────────────────────────────

async function complete(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const { baseUrl, model, apiKey } = getConfig();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// ── Risk Narrative ─────────────────────────────────────

function buildRiskContext(vault: Vault, risk: RiskAnalysis): string {
  const tvl = parseTvl(vault.analytics.tvl.usd);
  const apy = vault.analytics.apy;
  const factors = risk.factors
    .map(f => `- [${f.level.toUpperCase()}] ${f.label}: ${f.detail}`)
    .join('\n');

  return [
    `Vault: ${vault.name}`,
    `Protocol: ${vault.protocol.name}`,
    `Chain: ${vault.network}`,
    `Asset: ${vault.underlyingTokens.map(t => t.symbol).join('/')}`,
    `APY: ${apy.total.toFixed(2)}% (base: ${apy.base.toFixed(2)}%, reward: ${apy.reward ?? 0}%)`,
    `APY 7d: ${vault.analytics.apy7d !== null ? vault.analytics.apy7d.toFixed(2) + '%' : 'N/A'}`,
    `APY 30d: ${vault.analytics.apy30d !== null ? vault.analytics.apy30d.toFixed(2) + '%' : 'N/A'}`,
    `TVL: $${(tvl / 1e6).toFixed(1)}M`,
    `Tags: ${vault.tags.join(', ')}`,
    `Deposit: ${vault.depositPacks.some(d => d.stepsType === 'instant') ? 'instant' : 'multi-step'}`,
    `Redeemable: ${vault.isRedeemable ? 'yes' : 'no'}`,
    `Overall risk: ${risk.overall}`,
    `Risk factors:\n${factors}`,
  ].join('\n');
}

const RISK_SYSTEM_PROMPT = `You are a DeFi risk analyst. Given vault data and risk factors, write a 2-3 sentence risk summary for a yield depositor. Be specific — reference actual numbers (TVL, APY, protocol name). Don't use marketing language. If risk is high, say so directly. If it's safe, explain why concisely. Never use bullet points or headers — plain sentences only.`;

export async function generateRiskNarrative(
  vault: Vault,
  risk: RiskAnalysis,
): Promise<string> {
  const context = buildRiskContext(vault, risk);
  const result = await complete(RISK_SYSTEM_PROMPT, context);
  return result || risk.summary; // fallback to template
}

// ── Yield Recommendation ───────────────────────────────

function buildRecommendationContext(
  vault: Vault,
  risk: RiskAnalysis,
  netYield: NetYieldResult,
  depositAmount: number,
  riskTolerance: string,
): string {
  return [
    `User wants to deposit $${depositAmount.toLocaleString()} into DeFi yield.`,
    `Risk tolerance: ${riskTolerance}`,
    ``,
    `Recommended vault: ${vault.name}`,
    `Protocol: ${vault.protocol.name} on ${vault.network}`,
    `Asset: ${vault.underlyingTokens.map(t => t.symbol).join('/')}`,
    `Nominal APY: ${netYield.nominalApy.toFixed(2)}%`,
    `Net APY (after fees): ${netYield.netApy.toFixed(2)}%`,
    `Deposit cost: ${formatUsd(netYield.totalCostUsd)}`,
    `Estimated annual earnings: ${formatUsd(netYield.annualEarnings)}`,
    `Break-even: ${netYield.breakEvenDays < 1 ? 'less than 1 day' : Math.ceil(netYield.breakEvenDays) + ' days'}`,
    `Risk level: ${risk.overall}`,
    `TVL: ${formatUsd(parseTvl(vault.analytics.tvl.usd))}`,
    `Tags: ${vault.tags.join(', ')}`,
  ].join('\n');
}

const RECOMMENDATION_SYSTEM_PROMPT = `You are a DeFi yield advisor. Given a user's deposit amount, risk tolerance, and a recommended vault with its analysis, write a 2-3 sentence recommendation explaining why this vault is a good fit. Reference specific numbers. Be direct. If there are caveats, mention them briefly. No bullet points, no headers — plain sentences.`;

export async function generateRecommendation(
  vault: Vault,
  risk: RiskAnalysis,
  netYield: NetYieldResult,
  depositAmount: number,
  riskTolerance: string,
): Promise<string> {
  const context = buildRecommendationContext(vault, risk, netYield, depositAmount, riskTolerance);
  const result = await complete(RECOMMENDATION_SYSTEM_PROMPT, context);

  if (result) return result;

  // Fallback template
  return `${vault.name} on ${vault.network} offers ${formatApy(netYield.netApy)} net APY after fees. ` +
    `On a ${formatUsd(depositAmount)} deposit, estimated annual earnings are ${formatUsd(netYield.annualEarnings)} ` +
    `with a break-even of ${netYield.breakEvenDays < 1 ? '<1 day' : Math.ceil(netYield.breakEvenDays) + ' days'}.`;
}
