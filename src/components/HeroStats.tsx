'use client';

import type { Vault } from '@/types';
import { formatUsd } from '@/lib/utils';
import { getApiStats } from '@/lib/api';
import { Activity, Layers, TrendingUp, Globe } from 'lucide-react';

interface Props {
  vaults: Vault[];
  chainCount?: number;
  protocolCount?: number;
}

export function HeroStats({ vaults, chainCount, protocolCount }: Props) {
  const totalTvl = vaults.reduce((s, v) => s + (parseInt(v.analytics.tvl.usd) || 0), 0);
  const apys = vaults.map(v => v.analytics.apy.total).filter(a => a > 0).sort((a, b) => a - b);
  const medianApy = apys.length > 0 ? apys[Math.floor(apys.length / 2)] : 0;
  const { calls } = getApiStats();

  // Use API-sourced counts when available, fall back to vault-derived
  const chainsFromVaults = new Set(vaults.map(v => v.network)).size;
  const protosFromVaults = new Set(vaults.map(v => v.protocol.name)).size;

  const stats = [
    { label: 'VAULTS', value: String(vaults.length), sub: `${chainCount ?? chainsFromVaults} chains`, color: 'blue' as const, icon: Layers },
    { label: 'TOTAL TVL', value: formatUsd(totalTvl), sub: 'across all vaults', color: 'green' as const, icon: Activity },
    { label: 'MEDIAN APY', value: `${medianApy.toFixed(2)}%`, sub: 'all depositable', color: 'green' as const, icon: TrendingUp },
    { label: 'PROTOCOLS', value: String(protocolCount ?? protosFromVaults), sub: `${calls} API calls`, color: 'purple' as const, icon: Globe },
  ];

  const colorMap = {
    blue: { text: 'text-[#4488ff]', border: 'border-[#4488ff]/20', glow: 'shadow-[0_0_15px_rgba(68,136,255,0.08)]' },
    green: { text: 'text-[#00ff88]', border: 'border-[#00ff88]/20', glow: 'shadow-[0_0_15px_rgba(0,255,136,0.08)]' },
    purple: { text: 'text-[#a855f7]', border: 'border-[#a855f7]/20', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.08)]' },
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
      {stats.map(({ label, value, sub, color, icon: Icon }) => {
        const c = colorMap[color];
        return (
          <div
            key={label}
            className={`rounded-xl border ${c.border} bg-[#0f1528]/80 p-4 ${c.glow} transition-all hover:bg-[#141d35]`}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className={`h-3.5 w-3.5 ${c.text} opacity-60`} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/40">
                {label}
              </span>
            </div>
            <div className={`text-2xl font-bold tabular-nums font-[var(--font-geist-mono)] ${c.text}`}>
              {value}
            </div>
            <div className="text-[10px] text-[#e0e6f0]/30 mt-1">{sub}</div>
          </div>
        );
      })}
    </div>
  );
}
