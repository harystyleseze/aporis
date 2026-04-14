'use client';

import { useState } from 'react';
import type { Vault, OptimizerResult } from '@/types';
import { findBestVaults } from '@/lib/optimizer';
import { formatUsd, formatApy, cn } from '@/lib/utils';
import { Zap, TrendingUp, Shield, Clock, ChevronRight, Sparkles } from 'lucide-react';

interface Props {
  vaults: Vault[];
  onDeposit: (vault: Vault) => void;
  onSelectVault: (vault: Vault) => void;
  gasEstimates?: Record<number, number>;
}

const ASSETS = ['USDC', 'USDT', 'ETH', 'WETH', 'wstETH', 'weETH', 'DAI'];
const RISK_LEVELS = [
  { value: 'low' as const, label: 'Conservative', emoji: '🛡️' },
  { value: 'medium' as const, label: 'Balanced', emoji: '⚖️' },
  { value: 'high' as const, label: 'Aggressive', emoji: '🔥' },
];

export function YieldOptimizer({ vaults, onDeposit, onSelectVault, gasEstimates }: Props) {
  const [amount, setAmount] = useState('1000');
  const [asset, setAsset] = useState('USDC');
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [results, setResults] = useState<OptimizerResult[] | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);

  async function handleOptimize() {
    setIsScanning(true);
    setResults(null);
    setAiRecommendation(null);

    // Brief delay for visual scanning effect
    await new Promise(r => setTimeout(r, 300));

    const found = findBestVaults(vaults, {
      amount: parseFloat(amount) || 0,
      asset,
      riskTolerance: risk,
      gasEstimates,
    }, 3);
    setResults(found);
    setIsScanning(false);

    if (found.length > 0) {
      onSelectVault(found[0].vault);

      // Fetch AI recommendation for the top result (non-blocking)
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'recommendation',
          vault: found[0].vault,
          depositAmount: parseFloat(amount) || 1000,
          riskTolerance: risk,
        }),
      })
        .then(res => res.json())
        .then(data => { if (data.narrative) setAiRecommendation(data.narrative); })
        .catch(() => {}); // fallback handled in component
    }
  }

  return (
    <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4 shadow-[0_0_15px_rgba(68,136,255,0.05)]">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-[#4488ff]" />
        <h2 className="text-sm font-semibold tracking-wide">Yield Optimizer</h2>
        <span className="text-[9px] bg-[#4488ff]/10 text-[#4488ff] rounded-full px-2 py-0.5">AI</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* Amount */}
        <div>
          <label className="block text-[10px] text-[#e0e6f0]/30 mb-1 uppercase tracking-wider">Amount ($)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full rounded-lg border border-[#1a2240] bg-[#0a0e1a] px-3 py-2 text-sm font-[var(--font-geist-mono)] text-[#e0e6f0] outline-none focus:border-[#4488ff]/40"
            min="0"
          />
        </div>

        {/* Asset */}
        <div>
          <label className="block text-[10px] text-[#e0e6f0]/30 mb-1 uppercase tracking-wider">Asset</label>
          <select
            value={asset}
            onChange={e => setAsset(e.target.value)}
            className="w-full rounded-lg border border-[#1a2240] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e0e6f0] outline-none focus:border-[#4488ff]/40 appearance-none"
          >
            {ASSETS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Risk */}
        <div>
          <label className="block text-[10px] text-[#e0e6f0]/30 mb-1 uppercase tracking-wider">Risk</label>
          <select
            value={risk}
            onChange={e => setRisk(e.target.value as 'low' | 'medium' | 'high')}
            className="w-full rounded-lg border border-[#1a2240] bg-[#0a0e1a] px-3 py-2 text-sm text-[#e0e6f0] outline-none focus:border-[#4488ff]/40 appearance-none"
          >
            {RISK_LEVELS.map(r => (
              <option key={r.value} value={r.value}>{r.emoji} {r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleOptimize}
        disabled={isScanning || !amount || parseFloat(amount) <= 0}
        className="w-full rounded-lg bg-[#4488ff]/15 border border-[#4488ff]/25 py-2.5 text-sm font-medium text-[#4488ff] hover:bg-[#4488ff]/25 transition-all disabled:opacity-40"
      >
        {isScanning ? 'Scanning vaults...' : '🔍 Find Best Yield'}
      </button>

      {/* Results */}
      {results !== null && results.length > 0 && (
        <div className="mt-4 space-y-2 animate-fade-in">
          {/* AI recommendation narrative */}
          {aiRecommendation && (
            <div className="rounded-lg border border-[#a855f7]/20 bg-[#a855f7]/5 px-3 py-2.5 text-[11px] text-[#e0e6f0]/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3 w-3 text-[#a855f7]" />
                <span className="text-[9px] font-medium text-[#a855f7] uppercase tracking-wider">AI Recommendation</span>
              </div>
              {aiRecommendation}
            </div>
          )}
          {results.map((r, i) => {
            const isTop = i === 0;
            return (
              <div
                key={r.vault.slug}
                className={cn(
                  'rounded-lg border p-3 cursor-pointer transition-all',
                  isTop
                    ? 'border-[#00ff88]/30 bg-[#00ff88]/5 glow-green'
                    : 'border-[#1a2240] bg-[#0a0e1a]/50 hover:border-[#1a2240]/80',
                )}
                onClick={() => onSelectVault(r.vault)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isTop && <span className="text-[10px] bg-[#00ff88]/15 text-[#00ff88] rounded px-1.5 py-0.5 font-medium">BEST</span>}
                    <span className="text-sm font-semibold">{r.vault.name}</span>
                    <span className="text-[10px] text-[#e0e6f0]/25">{r.vault.protocol.name} · {r.vault.network}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onDeposit(r.vault); }}
                    className="flex items-center gap-1 rounded-lg bg-[#4488ff]/15 px-3 py-1 text-[11px] font-medium text-[#4488ff] hover:bg-[#4488ff]/25 transition-colors"
                  >
                    Deposit <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <div className="text-[#e0e6f0]/25 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Net APY</div>
                    <div className={cn('font-bold font-[var(--font-geist-mono)] tabular-nums', r.netYield.netApy > 0 ? 'text-[#00ff88]' : 'text-[#ff3366]')}>
                      {formatApy(r.netYield.netApy)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#e0e6f0]/25 flex items-center gap-1"><Shield className="h-3 w-3" />Risk</div>
                    <div className={cn('font-medium uppercase', r.risk.overall === 'low' ? 'text-[#00ff88]' : r.risk.overall === 'medium' ? 'text-[#ff9f1c]' : 'text-[#ff3366]')}>
                      {r.risk.overall}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#e0e6f0]/25">Est. yearly</div>
                    <div className="font-bold font-[var(--font-geist-mono)] tabular-nums text-[#00ff88]">
                      {formatUsd(r.netYield.annualEarnings)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#e0e6f0]/25 flex items-center gap-1"><Clock className="h-3 w-3" />Break-even</div>
                    <div className="font-[var(--font-geist-mono)] tabular-nums text-[#e0e6f0]/60">
                      {r.netYield.breakEvenDays < 1 ? '<1 day' : `${Math.ceil(r.netYield.breakEvenDays)}d`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="mt-4 text-center text-[11px] text-[#e0e6f0]/30 py-4">
          No vaults match your criteria. Try adjusting risk tolerance or asset.
        </div>
      )}
    </div>
  );
}
