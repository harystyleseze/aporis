'use client';

import type { MarketInsight } from '@/types';
import { TrendingUp, TrendingDown, Minus, Sparkles, AlertCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  insights: MarketInsight[];
}

const ICONS = {
  trend: BarChart3,
  opportunity: Sparkles,
  alert: AlertCircle,
  stat: BarChart3,
};

const DIR_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function MarketIntel({ insights }: Props) {
  if (!insights.length) return null;

  return (
    <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-[#a855f7]" />
        <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/40">
          Market Intelligence
        </h3>
        <span className="text-[9px] bg-[#a855f7]/10 text-[#a855f7] rounded-full px-2 py-0.5">AI</span>
      </div>

      <div className="space-y-2">
        {insights.map(insight => {
          const Icon = ICONS[insight.type];
          const DirIcon = insight.direction ? DIR_ICONS[insight.direction] : null;

          return (
            <div
              key={insight.id}
              className="flex items-start gap-2 rounded-lg bg-[#0a0e1a]/40 px-3 py-2"
            >
              <Icon className={cn(
                'h-3.5 w-3.5 mt-0.5 shrink-0',
                insight.type === 'opportunity' ? 'text-[#00ff88]' :
                insight.type === 'alert' ? 'text-[#ff9f1c]' :
                'text-[#4488ff]',
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#e0e6f0]/60">{insight.text}</div>
                {insight.value && (
                  <div className="flex items-center gap-1 mt-0.5">
                    {DirIcon && (
                      <DirIcon className={cn(
                        'h-3 w-3',
                        insight.direction === 'up' ? 'text-[#00ff88]' :
                        insight.direction === 'down' ? 'text-[#ff3366]' :
                        'text-[#e0e6f0]/30',
                      )} />
                    )}
                    <span className="text-[12px] font-bold font-[var(--font-geist-mono)] tabular-nums text-[#e0e6f0]">
                      {insight.value}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
