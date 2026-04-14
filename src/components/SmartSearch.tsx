'use client';

import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { parseSearchQuery } from '@/lib/search-parser';
import type { SearchFilters } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  onFiltersChange: (filters: SearchFilters) => void;
  filters: SearchFilters;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 10: 'Optimism', 56: 'BSC', 100: 'Gnosis', 137: 'Polygon',
  5000: 'Mantle', 8453: 'Base', 42161: 'Arbitrum', 42220: 'Celo',
  43114: 'Avalanche', 59144: 'Linea', 80094: 'Berachain',
};

export function SmartSearch({ onFiltersChange, filters }: Props) {
  const [query, setQuery] = useState('');

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length >= 2) {
      const parsed = parseSearchQuery(value);
      onFiltersChange(parsed);
    } else if (value.trim().length === 0) {
      onFiltersChange({});
    }
  }, [onFiltersChange]);

  const removeFilter = (key: keyof SearchFilters) => {
    const next = { ...filters };
    delete next[key];
    onFiltersChange(next);
  };

  const activeFilters: { key: keyof SearchFilters; label: string; color: string }[] = [];
  if (filters.chainId) activeFilters.push({ key: 'chainId', label: CHAIN_NAMES[filters.chainId] || `Chain ${filters.chainId}`, color: 'bg-[#4488ff]/15 text-[#4488ff]' });
  if (filters.asset) activeFilters.push({ key: 'asset', label: filters.asset, color: 'bg-[#00ff88]/15 text-[#00ff88]' });
  if (filters.protocol) activeFilters.push({ key: 'protocol', label: filters.protocol, color: 'bg-[#a855f7]/15 text-[#a855f7]' });
  if (filters.minApy) activeFilters.push({ key: 'minApy', label: `>${filters.minApy}% APY`, color: 'bg-[#00ff88]/15 text-[#00ff88]' });
  if (filters.riskTolerance) activeFilters.push({ key: 'riskTolerance', label: `${filters.riskTolerance} risk`, color: filters.riskTolerance === 'low' ? 'bg-[#00ff88]/15 text-[#00ff88]' : filters.riskTolerance === 'high' ? 'bg-[#ff3366]/15 text-[#ff3366]' : 'bg-[#ff9f1c]/15 text-[#ff9f1c]' });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#e0e6f0]/30" />
        <input
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder='Try "safe USDC vaults on Base above 5%" ...'
          className="w-full rounded-lg border border-[#1a2240] bg-[#0f1528] py-2.5 pl-10 pr-4 text-sm text-[#e0e6f0] placeholder-[#e0e6f0]/20 outline-none focus:border-[#4488ff]/40 transition-colors"
        />
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 animate-fade-in">
          {activeFilters.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => removeFilter(key)}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all hover:opacity-70',
                color,
              )}
            >
              {label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={() => { setQuery(''); onFiltersChange({}); }}
            className="text-[11px] text-[#e0e6f0]/30 hover:text-[#e0e6f0]/60 px-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
