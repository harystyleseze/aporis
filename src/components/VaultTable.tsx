'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Vault } from '@/types';
import { formatUsd, formatApy, cn, parseTvl } from '@/lib/utils';
import { analyzeRisk } from '@/lib/risk-engine';
import { calculateNetYield } from '@/lib/optimizer';
import { ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, Sparkles } from 'lucide-react';

interface Props {
  vaults: Vault[];
  depositAmount: number;
  onSelectVault: (vault: Vault) => void;
  onDeposit: (vault: Vault) => void;
  selectedVault?: Vault | null;
  gasEstimates?: Record<number, number>;
}

type SortKey = 'apy' | 'netApy' | 'tvl' | 'risk';

function RiskBadge({ level }: { level: string }) {
  const styles = {
    low: 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20',
    medium: 'bg-[#ff9f1c]/10 text-[#ff9f1c] border-[#ff9f1c]/20',
    high: 'bg-[#ff3366]/10 text-[#ff3366] border-[#ff3366]/20',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider', styles[level as keyof typeof styles] || styles.medium)}>
      {level}
    </span>
  );
}

export function VaultTable({ vaults, depositAmount, onSelectVault, onDeposit, selectedVault, gasEstimates }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('apy');
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [aiNarrative, setAiNarrative] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const fetchAiNarrative = useCallback(async (vault: Vault) => {
    if (aiNarrative[vault.slug] || aiLoading === vault.slug) return;
    setAiLoading(vault.slug);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'risk', vault }),
      });
      const data = await res.json();
      if (data.narrative) {
        setAiNarrative(prev => ({ ...prev, [vault.slug]: data.narrative }));
      }
    } catch { /* fallback to template */ }
    setAiLoading(null);
  }, [aiNarrative, aiLoading]);

  const sorted = [...vaults].sort((a, b) => {
    switch (sortKey) {
      case 'apy': return b.analytics.apy.total - a.analytics.apy.total;
      case 'netApy': {
        const na = calculateNetYield(a, depositAmount, false, gasEstimates).netApy;
        const nb = calculateNetYield(b, depositAmount, false, gasEstimates).netApy;
        return nb - na;
      }
      case 'tvl': return parseTvl(b.analytics.tvl.usd) - parseTvl(a.analytics.tvl.usd);
      case 'risk': {
        const ra = analyzeRisk(a);
        const rb = analyzeRisk(b);
        const order = { low: 0, medium: 1, high: 2 };
        return order[ra.overall] - order[rb.overall];
      }
      default: return 0;
    }
  });

  function SortHeader({ label, sortId }: { label: string; sortId: SortKey }) {
    return (
      <button
        onClick={() => setSortKey(sortId)}
        className={cn(
          'flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider transition-colors',
          sortKey === sortId ? 'text-[#4488ff]' : 'text-[#e0e6f0]/30 hover:text-[#e0e6f0]/60',
        )}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-2.5 border-b border-[#1a2240]/50 items-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/30">Vault</span>
        <SortHeader label="APY" sortId="apy" />
        <SortHeader label="Net APY" sortId="netApy" />
        <SortHeader label="TVL" sortId="tvl" />
        <SortHeader label="Risk" sortId="risk" />
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#1a2240]/30 max-h-[480px] overflow-y-auto">
        {sorted.map(vault => {
          const risk = analyzeRisk(vault);
          const netYield = calculateNetYield(vault, depositAmount, false, gasEstimates);
          const isExpanded = expandedSlug === vault.slug;
          const isSelected = selectedVault?.slug === vault.slug;
          const tokens = vault.underlyingTokens.map(t => t.symbol).join('/');

          return (
            <div key={vault.slug}>
              <div
                className={cn(
                  'grid grid-cols-[2fr_1fr_1fr_1fr_80px_80px] gap-2 px-4 py-3 items-center cursor-pointer transition-colors',
                  isSelected ? 'bg-[#4488ff]/5 border-l-2 border-l-[#4488ff]' : 'hover:bg-[#141d35] border-l-2 border-l-transparent',
                )}
                onClick={() => {
                  onSelectVault(vault);
                  setExpandedSlug(isExpanded ? null : vault.slug);
                }}
              >
                {/* Vault name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-[#e0e6f0]/30">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{vault.name}</div>
                    <div className="text-[10px] text-[#e0e6f0]/30">
                      {vault.protocol.name} · {vault.network} · {tokens}
                    </div>
                  </div>
                </div>

                {/* APY */}
                <div>
                  <div className="text-sm font-bold tabular-nums text-[#00ff88] font-[var(--font-geist-mono)]">
                    {formatApy(vault.analytics.apy.total)}
                  </div>
                  {vault.analytics.apy.reward !== null && vault.analytics.apy.reward > 0 && (
                    <div className="text-[9px] text-[#e0e6f0]/25">
                      +{formatApy(vault.analytics.apy.reward)} reward
                    </div>
                  )}
                </div>

                {/* Net APY */}
                <div className={cn(
                  'text-sm font-bold tabular-nums font-[var(--font-geist-mono)]',
                  netYield.netApy > 0 ? 'text-[#00ff88]/70' : 'text-[#ff3366]',
                )}>
                  {formatApy(netYield.netApy)}
                </div>

                {/* TVL */}
                <div className="text-sm tabular-nums text-[#e0e6f0]/60 font-[var(--font-geist-mono)]">
                  {formatUsd(parseTvl(vault.analytics.tvl.usd))}
                </div>

                {/* Risk */}
                <RiskBadge level={risk.overall} />

                {/* Action */}
                <button
                  onClick={e => { e.stopPropagation(); onDeposit(vault); }}
                  className="text-[11px] font-medium text-[#4488ff] hover:text-[#4488ff]/80 transition-colors"
                >
                  Deposit →
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 pl-12 animate-fade-in">
                  {/* APY History Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">1d APY</div>
                      <div className="tabular-nums font-[var(--font-geist-mono)]">{formatApy(vault.analytics.apy1d)}</div>
                    </div>
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">7d APY</div>
                      <div className="tabular-nums font-[var(--font-geist-mono)]">{formatApy(vault.analytics.apy7d)}</div>
                    </div>
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">30d APY</div>
                      <div className="tabular-nums font-[var(--font-geist-mono)]">{formatApy(vault.analytics.apy30d)}</div>
                    </div>
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">Est. earnings/yr</div>
                      <div className="tabular-nums font-[var(--font-geist-mono)] text-[#00ff88]">{formatUsd(netYield.annualEarnings)}</div>
                    </div>
                  </div>

                  {/* Deposit Details Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] mt-2">
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">Break-even</div>
                      <div className="tabular-nums font-[var(--font-geist-mono)]">
                        {netYield.breakEvenDays < 1 ? '<1 day' : `${Math.ceil(netYield.breakEvenDays)} days`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">Deposit type</div>
                      <div className="font-[var(--font-geist-mono)]">
                        {vault.depositPacks.some(d => d.stepsType === 'instant')
                          ? <span className="text-[#00ff88]/70">Instant</span>
                          : <span className="text-[#ff9f1c]">Multi-step</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">Withdrawal</div>
                      <div className="font-[var(--font-geist-mono)]">
                        {vault.timeLock && vault.timeLock > 0
                          ? <span className="text-[#ff9f1c]">{Math.ceil(vault.timeLock / 86400)}d lock</span>
                          : vault.isRedeemable
                            ? <span className="text-[#00ff88]/70">Instant</span>
                            : <span className="text-[#e0e6f0]/25">N/A</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#e0e6f0]/25 mb-0.5">Updated</div>
                      <div className="text-[#e0e6f0]/30 font-[var(--font-geist-mono)]">
                        {new Date(vault.analytics.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Tags + Rewards + Warnings */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vault.tags.map(t => (
                      <span key={t} className="rounded-full bg-[#1a2240] px-2 py-0.5 text-[9px] text-[#e0e6f0]/40">{t}</span>
                    ))}
                    {vault.rewardTokens && vault.rewardTokens.length > 0 && vault.rewardTokens.map(rt => (
                      <span key={rt.symbol} className="rounded-full bg-[#a855f7]/10 px-2 py-0.5 text-[9px] text-[#a855f7]">+{rt.symbol} rewards</span>
                    ))}
                    {vault.kyc && (
                      <span className="rounded-full bg-[#ff9f1c]/10 px-2 py-0.5 text-[9px] text-[#ff9f1c]">KYC required</span>
                    )}
                    {vault.caps?.maxCap && (
                      <span className="rounded-full bg-[#4488ff]/10 px-2 py-0.5 text-[9px] text-[#4488ff]">Cap: {formatUsd(parseInt(vault.caps.maxCap))}</span>
                    )}
                  </div>

                  {/* Description if available */}
                  {vault.description && (
                    <div className="mt-2 text-[10px] text-[#e0e6f0]/25 italic">{vault.description}</div>
                  )}

                  {/* AI-generated risk narrative */}
                  <div className="mt-2 text-[11px] text-[#e0e6f0]/40">
                    {aiNarrative[vault.slug] ? (
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="h-3 w-3 text-[#a855f7] shrink-0 mt-0.5" />
                        <span>{aiNarrative[vault.slug]}</span>
                      </div>
                    ) : aiLoading === vault.slug ? (
                      <span className="text-[#a855f7]/50">Generating AI analysis...</span>
                    ) : (
                      <div>
                        <span className="text-[#e0e6f0]/30">{risk.summary}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); fetchAiNarrative(vault); }}
                          className="ml-2 text-[10px] text-[#a855f7] hover:text-[#a855f7]/80"
                        >
                          AI analysis →
                        </button>
                      </div>
                    )}
                  </div>
                  <a
                    href={vault.protocol.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-[10px] text-[#4488ff]/60 hover:text-[#4488ff]"
                  >
                    View on {vault.protocol.name} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="px-4 py-12 text-center text-sm text-[#e0e6f0]/30">
          No vaults match your filters
        </div>
      )}
    </div>
  );
}
