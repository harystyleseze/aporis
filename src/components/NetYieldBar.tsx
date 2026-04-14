'use client';

import type { NetYieldResult } from '@/types';
import { formatUsd, formatApy } from '@/lib/utils';

interface Props {
  netYield: NetYieldResult;
  depositAmount: number;
}

export function NetYieldBar({ netYield, depositAmount }: Props) {
  const { nominalApy, netApy, gasCostUsd, feeCostUsd, totalCostUsd, annualEarnings, breakEvenDays } = netYield;

  // Calculate bar widths relative to nominal
  const maxWidth = 100;
  const netWidth = nominalApy > 0 ? (netApy / nominalApy) * maxWidth : 0;
  const gasWidth = nominalApy > 0 ? ((gasCostUsd / depositAmount) * 100 / nominalApy) * maxWidth : 0;
  const feeWidth = nominalApy > 0 ? ((feeCostUsd / depositAmount) * 100 / nominalApy) * maxWidth : 0;

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/30">
        Net Yield Breakdown
      </h3>

      {/* Nominal APY bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-[#e0e6f0]/50">Nominal APY</span>
          <span className="font-[var(--font-geist-mono)] tabular-nums text-[#00ff88]">{formatApy(nominalApy)}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#1a2240] overflow-hidden">
          <div className="h-full rounded-full bg-[#00ff88]/60 transition-all duration-500" style={{ width: `${maxWidth}%` }} />
        </div>
      </div>

      {/* Cost deductions */}
      {totalCostUsd > 0 && (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#e0e6f0]/50">Gas cost</span>
              <span className="font-[var(--font-geist-mono)] tabular-nums text-[#ff3366]">-{formatUsd(gasCostUsd)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#1a2240] overflow-hidden">
              <div className="h-full rounded-full bg-[#ff3366]/40" style={{ width: `${Math.max(gasWidth, 2)}%` }} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#e0e6f0]/50">Protocol fees</span>
              <span className="font-[var(--font-geist-mono)] tabular-nums text-[#ff9f1c]">-{formatUsd(feeCostUsd)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#1a2240] overflow-hidden">
              <div className="h-full rounded-full bg-[#ff9f1c]/40" style={{ width: `${Math.max(feeWidth, 2)}%` }} />
            </div>
          </div>
        </>
      )}

      {/* Net APY bar */}
      <div className="space-y-1 pt-1 border-t border-[#1a2240]">
        <div className="flex justify-between text-[11px]">
          <span className="text-[#e0e6f0]/70 font-medium">Net APY</span>
          <span className={`font-bold font-[var(--font-geist-mono)] tabular-nums ${netApy > 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
            {formatApy(netApy)}
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-[#1a2240] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${netApy > 0 ? 'bg-[#00ff88]/50' : 'bg-[#ff3366]/50'}`}
            style={{ width: `${Math.max(netWidth, 0)}%` }}
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <div className="rounded-lg bg-[#0a0e1a]/60 p-2">
          <div className="text-[9px] text-[#e0e6f0]/25 uppercase">Est. yearly</div>
          <div className="text-sm font-bold font-[var(--font-geist-mono)] tabular-nums text-[#00ff88]">
            {formatUsd(annualEarnings)}
          </div>
        </div>
        <div className="rounded-lg bg-[#0a0e1a]/60 p-2">
          <div className="text-[9px] text-[#e0e6f0]/25 uppercase">Break-even</div>
          <div className="text-sm font-bold font-[var(--font-geist-mono)] tabular-nums text-[#e0e6f0]/60">
            {breakEvenDays < 1 ? '<1 day' : `${Math.ceil(breakEvenDays)} days`}
          </div>
        </div>
      </div>
    </div>
  );
}
