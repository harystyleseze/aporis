'use client';

import { useEffect, useRef } from 'react';
import { useChainId } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { getApiStats } from '@/lib/api';
import { Activity } from 'lucide-react';

export function Header() {
  const { calls, endpoints } = getApiStats();
  const chainId = useChainId();
  const { close } = useAppKit();
  const prevChainRef = useRef(chainId);

  // Auto-close the AppKit modal after a network switch
  useEffect(() => {
    if (prevChainRef.current !== chainId) {
      prevChainRef.current = chainId;
      close();
    }
  }, [chainId, close]);

  return (
    <header className="sticky top-0 z-40 border-b border-[#1a2240] bg-[#0a0e1a]/90 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#4488ff]/15 border border-[#4488ff]/20">
              <span className="text-sm font-bold text-[#4488ff]">A</span>
            </div>
            <span className="text-sm font-bold tracking-wide">
              Apo<span className="text-[#4488ff]">ris</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] font-[var(--font-geist-mono)] text-[#e0e6f0]/30">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] animate-pulse-live" />
            <span className="text-[#00ff88]/70">{calls} CALLS</span>
            <span className="text-[#e0e6f0]/15">·</span>
            <span>{endpoints} EP</span>
            <span className="text-[#e0e6f0]/15">·</span>
            <span>2 SERVICES</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[9px] text-[#e0e6f0]/20 font-[var(--font-geist-mono)]">
            <Activity className="h-3 w-3" />
            earn.li.fi + li.quest
          </div>
          <w3m-button size="sm" balance="hide" />
        </div>
      </div>
    </header>
  );
}
