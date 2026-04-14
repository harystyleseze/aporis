'use client';

import { useState, useMemo, useRef } from 'react';
import type { Vault } from '@/types';
import { analyzeRisk } from '@/lib/risk-engine';
import { formatUsd, formatApy, parseTvl, cn } from '@/lib/utils';

interface Props {
  vaults: Vault[];
  onSelectVault: (vault: Vault) => void;
  onDeposit: (vault: Vault) => void;
  selectedVault?: Vault | null;
}

const RISK_COLORS = {
  low: '#00ff88',
  medium: '#ff9f1c',
  high: '#ff3366',
};

const RISK_BG = {
  low: 'rgba(0,255,136,0.03)',
  medium: 'rgba(255,159,28,0.03)',
  high: 'rgba(255,51,102,0.03)',
};

const RISK_ORDER: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
const RISK_LABELS = { low: 'LOW RISK', medium: 'MEDIUM RISK', high: 'HIGH RISK' };

const WIDTH = 820;
const HEIGHT = 440;
const PAD = { top: 12, right: 16, bottom: 32, left: 90 };

export function VaultBubbles({ vaults, onSelectVault, onDeposit, selectedVault }: Props) {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [chainFilter, setChainFilter] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const laneH = plotH / 3;

  // Extract available chains and assets from vaults
  const chains = useMemo(() => [...new Set(vaults.map(v => v.network))].sort(), [vaults]);
  const assets = useMemo(() => {
    const set = new Set<string>();
    vaults.forEach(v => v.underlyingTokens.forEach(t => set.add(t.symbol)));
    return [...set].sort();
  }, [vaults]);

  const bubbles = useMemo(() => {
    if (!vaults.length) return [];

    const categorized = vaults
      .filter(v => v.analytics.apy.total > 0 && parseTvl(v.analytics.tvl.usd) > 0)
      .map(vault => {
        const risk = analyzeRisk(vault);
        return { vault, risk: risk.overall, apy: vault.analytics.apy.total, tvl: parseTvl(vault.analytics.tvl.usd) };
      });

    if (!categorized.length) return [];

    const allApys = categorized.map(c => c.apy);
    const minApy = Math.max(0.5, Math.min(...allApys));
    const maxApy = Math.max(...allApys) * 1.15;
    const logMin = Math.log10(minApy);
    const logMax = Math.log10(maxApy);
    const logRange = logMax - logMin || 1;
    const maxTvl = Math.max(...categorized.map(c => c.tvl));

    return categorized.map(({ vault, risk, apy, tvl }) => {
      const logApy = Math.log10(Math.max(apy, minApy));
      const xNorm = (logApy - logMin) / logRange;
      const x = PAD.left + xNorm * plotW;

      const laneIndex = RISK_ORDER.indexOf(risk);
      const laneTop = PAD.top + laneIndex * laneH;
      const laneCenter = laneTop + laneH / 2;
      const hash = vault.address.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const jitter = ((hash % 100) / 100 - 0.5) * (laneH * 0.6);
      const y = laneCenter + jitter;

      const r = Math.max(5, Math.min(28, 5 + Math.sqrt(tvl / maxTvl) * 23));
      const color = RISK_COLORS[risk];

      // Check if this bubble matches the active filters
      const matchesChain = !chainFilter || vault.network === chainFilter;
      const matchesAsset = !assetFilter || vault.underlyingTokens.some(t => t.symbol === assetFilter);
      const isFiltered = matchesChain && matchesAsset;

      return { vault, x, y, r, color, risk, tvl, apy, isFiltered };
    });
  }, [vaults, plotW, plotH, laneH, chainFilter, assetFilter]);

  const apyTicks = useMemo(() => {
    const ticks = [1, 2, 5, 10, 20, 50, 100, 500, 1000, 5000];
    const allApys = bubbles.map(b => b.apy);
    if (!allApys.length) return [];
    const min = Math.max(0.5, Math.min(...allApys));
    const max = Math.max(...allApys) * 1.15;
    return ticks.filter(t => t >= min * 0.8 && t <= max);
  }, [bubbles]);

  const hoveredBubble = bubbles.find(b => b.vault.slug === hoveredSlug);
  const hasFilters = chainFilter || assetFilter;
  const filteredCount = bubbles.filter(b => b.isFiltered).length;

  function apyToX(apy: number): number {
    const allApys = bubbles.map(b => b.apy);
    if (!allApys.length) return PAD.left;
    const minApy = Math.max(0.5, Math.min(...allApys));
    const maxApy = Math.max(...allApys) * 1.15;
    const logMin = Math.log10(minApy);
    const logMax = Math.log10(maxApy);
    const logRange = logMax - logMin || 1;
    return PAD.left + ((Math.log10(apy) - logMin) / logRange) * plotW;
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div className="relative rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4 overflow-hidden">
      {/* Header + Legend */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/40">
          Vault Map
        </h3>
        <div className="flex items-center gap-3 text-[9px] text-[#e0e6f0]/30">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#00ff88]" />Low</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ff9f1c]" />Med</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ff3366]" />High</span>
        </div>
      </div>

      {/* Quick filters for chain and asset */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {/* Chain pills */}
        <button
          onClick={() => setChainFilter(null)}
          className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-medium transition-all border',
            !chainFilter ? 'border-[#4488ff]/40 bg-[#4488ff]/15 text-[#4488ff]' : 'border-[#1a2240] text-[#e0e6f0]/25 hover:text-[#e0e6f0]/50',
          )}
        >
          All chains
        </button>
        {chains.slice(0, 8).map(chain => (
          <button
            key={chain}
            onClick={() => setChainFilter(chainFilter === chain ? null : chain)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[9px] font-medium transition-all border',
              chainFilter === chain ? 'border-[#4488ff]/40 bg-[#4488ff]/15 text-[#4488ff]' : 'border-[#1a2240] text-[#e0e6f0]/20 hover:text-[#e0e6f0]/40',
            )}
          >
            {chain}
          </button>
        ))}

        <span className="text-[#e0e6f0]/10 mx-0.5">|</span>

        {/* Asset pills */}
        <button
          onClick={() => setAssetFilter(null)}
          className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-medium transition-all border',
            !assetFilter ? 'border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]' : 'border-[#1a2240] text-[#e0e6f0]/25 hover:text-[#e0e6f0]/50',
          )}
        >
          All assets
        </button>
        {assets.slice(0, 6).map(asset => (
          <button
            key={asset}
            onClick={() => setAssetFilter(assetFilter === asset ? null : asset)}
            className={cn(
              'rounded-full px-2 py-0.5 text-[9px] font-medium transition-all border',
              assetFilter === asset ? 'border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]' : 'border-[#1a2240] text-[#e0e6f0]/20 hover:text-[#e0e6f0]/40',
            )}
          >
            {asset}
          </button>
        ))}

        {hasFilters && (
          <span className="text-[9px] text-[#e0e6f0]/20 ml-1">{filteredCount} match</span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredSlug(null); setTooltipPos(null); }}
      >
        {/* Risk lane backgrounds */}
        {RISK_ORDER.map((risk, i) => (
          <g key={risk}>
            <rect x={PAD.left} y={PAD.top + i * laneH} width={plotW} height={laneH} fill={RISK_BG[risk]} stroke="#1a2240" strokeWidth="0.5" />
            <text x={PAD.left - 8} y={PAD.top + i * laneH + laneH / 2} textAnchor="end" dominantBaseline="middle" fill={RISK_COLORS[risk]} opacity="0.5" fontSize="9" fontWeight="bold" fontFamily="var(--font-geist-mono), monospace">
              {RISK_LABELS[risk]}
            </text>
          </g>
        ))}

        {/* APY grid lines */}
        {apyTicks.map(tick => {
          const x = apyToX(tick);
          if (x < PAD.left || x > PAD.left + plotW) return null;
          return (
            <g key={`tick-${tick}`}>
              <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + plotH} stroke="#1a2240" strokeWidth="0.5" strokeDasharray="2,4" />
              <text x={x} y={HEIGHT - 8} textAnchor="middle" fill="#e0e6f0" opacity="0.25" fontSize="9" fontFamily="var(--font-geist-mono), monospace">
                {tick}%
              </text>
            </g>
          );
        })}

        <text x={PAD.left + plotW / 2} y={HEIGHT - 1} textAnchor="middle" fill="#e0e6f0" opacity="0.15" fontSize="8" fontFamily="var(--font-geist-mono), monospace">
          APY (log scale) →
        </text>

        {/* Bubbles — larger first so smaller render on top */}
        {[...bubbles].sort((a, b) => b.r - a.r).map(b => {
          const isHovered = hoveredSlug === b.vault.slug;
          const isSelected = selectedVault?.slug === b.vault.slug;
          const dimmed = hasFilters && !b.isFiltered;

          return (
            <g
              key={`${b.vault.slug}-${b.vault.address}`}
              style={{ cursor: dimmed ? 'default' : 'pointer' }}
              onMouseEnter={() => !dimmed && setHoveredSlug(b.vault.slug)}
              onClick={() => !dimmed && onSelectVault(b.vault)}
              onDoubleClick={() => !dimmed && onDeposit(b.vault)}
            >
              {isSelected && !dimmed && (
                <circle cx={b.x} cy={b.y} r={b.r + 4} fill="none" stroke={b.color} strokeWidth="1.5" opacity="0.5">
                  <animate attributeName="r" values={`${b.r + 3};${b.r + 6};${b.r + 3}`} dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              <circle
                cx={b.x}
                cy={b.y}
                r={isHovered && !dimmed ? b.r + 2 : b.r}
                fill={b.color}
                opacity={dimmed ? 0.07 : isHovered || isSelected ? 0.8 : 0.35}
                stroke={isHovered && !dimmed ? '#e0e6f0' : 'none'}
                strokeWidth={isHovered && !dimmed ? 1 : 0}
                style={{ transition: 'all 0.15s ease-out' }}
              />

              {b.r > 12 && !dimmed && (
                <text
                  x={b.x} y={b.y + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#0a0e1a"
                  fontSize={Math.min(8, b.r * 0.55)}
                  fontWeight="bold"
                  fontFamily="var(--font-geist-mono), monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {b.vault.underlyingTokens[0]?.symbol || ''}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredBubble && tooltipPos && (
        <div
          className="absolute pointer-events-none z-30 rounded-lg border border-[#1a2240] bg-[#0a0e1a]/95 px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(tooltipPos.x + 14, (svgRef.current?.clientWidth ?? 600) - 200),
            top: Math.max(tooltipPos.y - 70, 8),
          }}
        >
          <div className="font-semibold text-[#e0e6f0] mb-0.5">{hoveredBubble.vault.name}</div>
          <div className="text-[#e0e6f0]/30 text-[10px] mb-1.5">{hoveredBubble.vault.protocol.name} · {hoveredBubble.vault.network}</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[#e0e6f0]/20 text-[9px]">APY</div>
              <div className="font-[var(--font-geist-mono)] text-[#00ff88] font-bold">{formatApy(hoveredBubble.apy)}</div>
            </div>
            <div>
              <div className="text-[#e0e6f0]/20 text-[9px]">TVL</div>
              <div className="font-[var(--font-geist-mono)] text-[#e0e6f0]/70">{formatUsd(hoveredBubble.tvl)}</div>
            </div>
            <div>
              <div className="text-[#e0e6f0]/20 text-[9px]">Risk</div>
              <div className="font-bold" style={{ color: hoveredBubble.color }}>{hoveredBubble.risk.toUpperCase()}</div>
            </div>
          </div>
          <div className="mt-1 text-[9px] text-[#e0e6f0]/15">Click to select · Double-click to deposit</div>
        </div>
      )}

      {bubbles.length === 0 && (
        <div className="text-center py-16 text-[11px] text-[#e0e6f0]/25">No vaults match your filters</div>
      )}
    </div>
  );
}
