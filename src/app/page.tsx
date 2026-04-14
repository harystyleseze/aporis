'use client';

import { useState, useMemo, useCallback } from 'react';
import { useVaults, useChains, useProtocols, useGasEstimates } from '@/hooks/useVaults';
import { Header } from '@/components/Header';
import { HeroStats } from '@/components/HeroStats';
import { SmartSearch } from '@/components/SmartSearch';
import { YieldOptimizer } from '@/components/YieldOptimizer';
import { VaultTable } from '@/components/VaultTable';
import { VaultBubbles } from '@/components/VaultBubbles';
import { RiskRadar } from '@/components/RiskRadar';
import { NetYieldBar } from '@/components/NetYieldBar';
import { MarketIntel } from '@/components/MarketIntel';
import { PortfolioPanel } from '@/components/PortfolioPanel';
import { DepositModal } from '@/components/DepositModal';
import { analyzeRisk } from '@/lib/risk-engine';
import { calculateNetYield } from '@/lib/optimizer';
import { generateInsights } from '@/lib/market-intel';
import { parseTvl } from '@/lib/utils';
import type { Vault, SearchFilters } from '@/types';
import { Loader2, LayoutGrid, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { data: vaults, isLoading, error } = useVaults();
  const { data: chains } = useChains();
  const { data: protocols } = useProtocols();

  // Fetch real-time gas estimates for all chains that have vaults
  const vaultChainIds = useMemo(() => {
    if (!vaults) return [];
    return [...new Set(vaults.map(v => v.chainId))];
  }, [vaults]);
  const { data: gasEstimates } = useGasEstimates(vaultChainIds);

  const [filters, setFilters] = useState<SearchFilters>({});
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [depositVault, setDepositVault] = useState<Vault | null>(null);
  const [depositAmount, setDepositAmount] = useState(1000);
  const [viewMode, setViewMode] = useState<'bubbles' | 'table'>('bubbles');

  const handleFiltersChange = useCallback((f: SearchFilters) => setFilters(f), []);

  // Apply filters to vault list
  const filteredVaults = useMemo(() => {
    if (!vaults) return [];
    let result = [...vaults];

    if (filters.chainId) {
      result = result.filter(v => v.chainId === filters.chainId);
    }
    if (filters.asset) {
      result = result.filter(v =>
        v.underlyingTokens.some(t => t.symbol.toUpperCase() === filters.asset!.toUpperCase()),
      );
    }
    if (filters.protocol) {
      result = result.filter(v => v.protocol.name === filters.protocol);
    }
    if (filters.minApy) {
      result = result.filter(v => v.analytics.apy.total >= filters.minApy!);
    }
    if (filters.riskTolerance) {
      result = result.filter(v => {
        const tvl = parseTvl(v.analytics.tvl.usd);
        if (filters.riskTolerance === 'low') return tvl >= 10_000_000 && v.analytics.apy.total < 20 && !v.tags.includes('il-risk');
        if (filters.riskTolerance === 'medium') return tvl >= 1_000_000 && v.analytics.apy.total < 50;
        return true;
      });
    }

    return result;
  }, [vaults, filters]);

  // Risk and yield analysis for selected vault
  const selectedRisk = useMemo(
    () => selectedVault ? analyzeRisk(selectedVault) : null,
    [selectedVault],
  );
  const selectedNetYield = useMemo(
    () => selectedVault ? calculateNetYield(selectedVault, depositAmount, false, gasEstimates) : null,
    [selectedVault, depositAmount, gasEstimates],
  );

  // Market insights
  const insights = useMemo(
    () => vaults ? generateInsights(vaults) : [],
    [vaults],
  );

  return (
    <div className="min-h-screen relative z-10">
      <Header />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#4488ff]" />
            <p className="text-sm text-[#e0e6f0]/30">Loading vaults from LI.FI Earn...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-[#ff3366]/20 bg-[#ff3366]/5 p-6 text-center">
            <p className="text-[#ff3366] font-medium">Failed to load vaults</p>
            <p className="text-[11px] text-[#e0e6f0]/30 mt-1">{error.message}</p>
          </div>
        )}

        {/* Dashboard */}
        {vaults && !isLoading && (
          <>
            {/* Hero Stats */}
            <HeroStats vaults={vaults} chainCount={chains?.length} protocolCount={protocols?.length} />

            {/* Smart Search */}
            <SmartSearch filters={filters} onFiltersChange={handleFiltersChange} />

            {/* Main grid: left (60%) + right (40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

              {/* LEFT COLUMN */}
              <div className="space-y-4">
                {/* Yield Optimizer */}
                <YieldOptimizer
                  vaults={filteredVaults}
                  onDeposit={setDepositVault}
                  onSelectVault={setSelectedVault}
                  gasEstimates={gasEstimates}
                />

                {/* Controls: deposit amount + view toggle */}
                <div className="flex items-center justify-between rounded-lg border border-[#1a2240] bg-[#0f1528]/80 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#e0e6f0]/30 uppercase tracking-wider whitespace-nowrap">
                      Net APY for:
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[#e0e6f0]/30">$</span>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)}
                        className="w-24 bg-transparent text-sm font-[var(--font-geist-mono)] text-[#e0e6f0] outline-none tabular-nums"
                        min="0"
                      />
                    </div>
                    <span className="text-[10px] text-[#e0e6f0]/15">
                      {filteredVaults.length} vaults
                    </span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-[#0a0e1a] p-0.5">
                    <button
                      onClick={() => setViewMode('bubbles')}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                        viewMode === 'bubbles' ? 'bg-[#4488ff]/15 text-[#4488ff]' : 'text-[#e0e6f0]/25 hover:text-[#e0e6f0]/50',
                      )}
                    >
                      <Circle className="h-3 w-3" />Map
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                        viewMode === 'table' ? 'bg-[#4488ff]/15 text-[#4488ff]' : 'text-[#e0e6f0]/25 hover:text-[#e0e6f0]/50',
                      )}
                    >
                      <LayoutGrid className="h-3 w-3" />Table
                    </button>
                  </div>
                </div>

                {/* Vault View */}
                {viewMode === 'bubbles' ? (
                  <VaultBubbles
                    vaults={filteredVaults}
                    onSelectVault={setSelectedVault}
                    onDeposit={setDepositVault}
                    selectedVault={selectedVault}
                  />
                ) : (
                  <VaultTable
                    vaults={filteredVaults}
                    depositAmount={depositAmount}
                    onSelectVault={setSelectedVault}
                    onDeposit={setDepositVault}
                    selectedVault={selectedVault}
                    gasEstimates={gasEstimates}
                  />
                )}
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-4">
                {/* Risk Radar */}
                {selectedRisk && (
                  <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4 animate-fade-in overflow-hidden">
                    <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/40 mb-2">
                      Risk Analysis — {selectedVault?.name}
                    </h3>
                    <div className="flex justify-center">
                      <RiskRadar
                        scores={selectedRisk.radarScores}
                        overall={selectedRisk.overall}
                        size={200}
                      />
                    </div>
                    {/* Risk factors */}
                    <div className="mt-3 space-y-1.5">
                      {selectedRisk.factors.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] min-w-0">
                          <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                            f.level === 'low' ? 'bg-[#00ff88]' : f.level === 'medium' ? 'bg-[#ff9f1c]' : 'bg-[#ff3366]'
                          }`} />
                          <div className="min-w-0">
                            <span className="font-medium text-[#e0e6f0]/60">{f.label}</span>
                            <p className="text-[#e0e6f0]/25 text-[10px] break-words">{f.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Net Yield Breakdown */}
                {selectedNetYield && selectedVault && (
                  <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4 animate-fade-in">
                    <NetYieldBar netYield={selectedNetYield} depositAmount={depositAmount} />
                  </div>
                )}

                {/* Market Intelligence */}
                <MarketIntel insights={insights} />

                {/* Portfolio */}
                <PortfolioPanel vaults={vaults} />
              </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-[#1a2240]/50 py-4 mt-4 text-center">
              <p className="text-[10px] text-[#e0e6f0]/20 font-[var(--font-geist-mono)]">
                Powered by LI.FI Earn Data API + Composer · earn.li.fi · li.quest · Real-time data
              </p>
            </footer>
          </>
        )}
      </main>

      {/* Deposit Modal */}
      {depositVault && (
        <DepositModal vault={depositVault} onClose={() => setDepositVault(null)} />
      )}
    </div>
  );
}
