'use client';

import { useAccount } from 'wagmi';
import { usePortfolio } from '@/hooks/useVaults';
import { formatUsd, shortenAddress } from '@/lib/utils';
import { useAppKit } from '@reown/appkit/react';
import { Wallet, AlertCircle, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PortfolioPosition, Vault } from '@/types';
import { WithdrawModal } from './WithdrawModal';

function ConnectWalletButton() {
  const { open } = useAppKit();
  return (
    <button onClick={() => open()} className="w-full rounded-lg border border-[#4488ff]/25 bg-[#4488ff]/10 py-2 text-[11px] font-medium text-[#4488ff] hover:bg-[#4488ff]/20 transition-colors">
      Connect Wallet
    </button>
  );
}

interface PanelProps {
  vaults?: Vault[];
}

export function PortfolioPanel({ vaults: allVaults }: PanelProps = {}) {
  const { address, isConnected } = useAccount();
  const [withdrawPosition, setWithdrawPosition] = useState<PortfolioPosition | null>(null);
  const [withdrawVaultAddress, setWithdrawVaultAddress] = useState<string | null>(null);
  const { data: portfolio, isLoading } = usePortfolio(address);

  const activePositions = useMemo(() => {
    if (!portfolio?.positions) return [];
    return portfolio.positions.filter(p => parseFloat(p.balanceUsd) > 0.001);
  }, [portfolio]);

  const totalValue = useMemo(() => {
    return activePositions.reduce((s, p) => s + parseFloat(p.balanceUsd), 0);
  }, [activePositions]);

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-3.5 w-3.5 text-[#4488ff]" />
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/40">Portfolio</h3>
        </div>
        <p className="text-[11px] text-[#e0e6f0]/30 mb-3">Connect wallet to see positions</p>
        <ConnectWalletButton />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1a2240] bg-[#0f1528]/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-[#4488ff]" />
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-[#e0e6f0]/40">Portfolio</h3>
        </div>
        <span className="text-[9px] text-[#e0e6f0]/20 font-[var(--font-geist-mono)]">{shortenAddress(address!)}</span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[#4488ff]" />
          <span className="text-[11px] text-[#e0e6f0]/30">Loading...</span>
        </div>
      )}

      {!isLoading && activePositions.length > 0 && (
        <>
          <div className="rounded-lg bg-[#0a0e1a]/60 p-3 mb-3">
            <div className="text-[9px] text-[#e0e6f0]/25 uppercase">Total Value</div>
            <div className="text-lg font-bold font-[var(--font-geist-mono)] tabular-nums text-[#00ff88]">
              {formatUsd(totalValue)}
            </div>
            <div className="text-[9px] text-[#e0e6f0]/20">{activePositions.length} positions</div>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {activePositions.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[#0a0e1a]/30 px-2.5 py-1.5">
                <div>
                  <span className="text-[11px] font-medium">{p.asset.symbol}</span>
                  <span className="text-[9px] text-[#e0e6f0]/20 ml-1.5">{p.protocolName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-[var(--font-geist-mono)] tabular-nums text-[#e0e6f0]/60">
                    {formatUsd(parseFloat(p.balanceUsd))}
                  </span>
                  <button
                    onClick={async () => {
                      // Find ALL matching vaults, then check on-chain balance to find the right one
                      const matches = allVaults?.filter(v =>
                        v.chainId === p.chainId &&
                        v.protocol.name === p.protocolName &&
                        v.underlyingTokens.some(t => t.address.toLowerCase() === p.asset.address.toLowerCase()) &&
                        v.isRedeemable
                      ) || [];

                      if (matches.length === 0) return;
                      if (matches.length === 1) {
                        setWithdrawVaultAddress(matches[0].address);
                        setWithdrawPosition(p);
                        return;
                      }

                      // Multiple matches — check on-chain balance for each
                      const balanceData = '0x70a08231000000000000000000000000' + (address || '').slice(2).toLowerCase();
                      for (const vault of matches) {
                        try {
                          const res = await fetch('https://mainnet.base.org', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: vault.address, data: balanceData }, 'latest'], id: 1 }),
                          });
                          const result = await res.json();
                          const bal = BigInt(result?.result || '0x0');
                          if (bal > 0n) {
                            setWithdrawVaultAddress(vault.address);
                            setWithdrawPosition(p);
                            return;
                          }
                        } catch { continue; }
                      }
                      // Fallback to first match
                      setWithdrawVaultAddress(matches[0].address);
                      setWithdrawPosition(p);
                    }}
                    className="text-[9px] text-[#ff9f1c] hover:text-[#ff9f1c]/70 cursor-pointer"
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isLoading && activePositions.length === 0 && (
        <div className="rounded-lg border border-[#ff9f1c]/15 bg-[#ff9f1c]/5 px-3 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-[#ff9f1c] mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-medium text-[#ff9f1c]">No active positions</p>
              <p className="text-[10px] text-[#e0e6f0]/30 mt-0.5">Your assets are idle. Use the Yield Optimizer to start earning.</p>
            </div>
          </div>
        </div>
      )}
      {withdrawPosition && withdrawVaultAddress && (
        <WithdrawModal
          position={withdrawPosition}
          vaultAddress={withdrawVaultAddress}
          onClose={() => { setWithdrawPosition(null); setWithdrawVaultAddress(null); }}
        />
      )}
    </div>
  );
}
