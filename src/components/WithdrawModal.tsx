'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useSendTransaction, useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt as waitForTxReceipt } from '@wagmi/core';
import type { PortfolioPosition, ComposerQuote } from '@/types';
import { fetchQuote, fetchStatus } from '@/lib/api';
import { config } from '@/lib/wagmi';
import { formatUsd, cn } from '@/lib/utils';
import { X, Loader2, CheckCircle2, ExternalLink, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  position: PortfolioPosition;
  vaultAddress: string;
  onClose: () => void;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum', 10: 'Optimism',
  137: 'Polygon', 143: 'Monad', 56: 'BSC', 43114: 'Avalanche',
};

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const;

type Step = 'confirm' | 'quoting' | 'approving' | 'signing' | 'confirming' | 'success' | 'error';

export function WithdrawModal({ position, vaultAddress, onClose }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>('confirm');
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chainName = CHAIN_NAMES[position.chainId] || `Chain ${position.chainId}`;

  const { data: receipt, isError: receiptError } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  useEffect(() => {
    if (step !== 'confirming' || !txHash) return;
    if (receipt) {
      setStep(receipt.status === 'success' ? 'success' : 'error');
      if (receipt.status !== 'success') setError('Transaction reverted on-chain.');
    }
    if (receiptError) {
      setError('Transaction not confirmed. It may have been cancelled by your wallet.');
      setStep('error');
    }
  }, [receipt, receiptError, step, txHash]);

  async function handleWithdraw() {
    if (!address) return;
    setStep('quoting');
    setError(null);

    try {
      // Withdraw: fromToken = vault/LP token address, toToken = underlying asset
      // The position.asset.address is the underlying token (USDC)
      // For Morpho, the vault address IS the LP token
      // We need to find the vault address — it's stored in the position data indirectly
      // Read actual on-chain LP token balance via wagmi config
      const { readContract } = await import('@wagmi/core');
      let withdrawAmount: string;
      try {
        const balance = await readContract(config, {
          address: vaultAddress as `0x${string}`,
          abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        });
        // Use 99% to avoid rounding
        withdrawAmount = ((balance * 99n) / 100n).toString();
      } catch {
        // Fallback: estimate from portfolio value
        withdrawAmount = BigInt(Math.floor(parseFloat(position.balanceNative) * 0.95 * 1e18)).toString();
      }

      if (withdrawAmount === '0') {
        setError('No vault token balance found. The position may have already been withdrawn.');
        setStep('error');
        return;
      }

      const q = await fetchQuote({
        fromChain: position.chainId,
        toChain: position.chainId,
        fromToken: vaultAddress,
        toToken: position.asset.address,
        fromAddress: address,
        fromAmount: withdrawAmount,
        slippage: 0.01,
      });
      setQuote(q);

      // Check if approval needed by reading current allowance
      const approvalAddress = (q.estimate as Record<string, unknown>).approvalAddress as string | undefined;
      if (approvalAddress && vaultAddress !== '0x0000000000000000000000000000000000000000') {
        const { readContract } = await import('@wagmi/core');
        try {
          const allowance = await readContract(config, {
            address: vaultAddress as `0x${string}`,
            abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }] as const,
            functionName: 'allowance',
            args: [address as `0x${string}`, approvalAddress as `0x${string}`],
          });

          if (allowance < BigInt(withdrawAmount)) {
            setStep('approving');
            const approveTxHash = await writeContractAsync({
              address: vaultAddress as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [approvalAddress as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
              chainId: position.chainId,
            });
            await waitForTxReceipt(config, { hash: approveTxHash, confirmations: 1 });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('rejected')) {
            setError('Approval rejected.');
            setStep('error');
            return;
          }
          // If allowance check fails, try proceeding without approval — it might already be approved
        }
      }

      setStep('signing');
      const txReq: Record<string, unknown> = {
        to: q.transactionRequest.to as `0x${string}`,
        data: q.transactionRequest.data as `0x${string}`,
        value: BigInt(q.transactionRequest.value || '0'),
        chainId: position.chainId,
      };
      const rawTx = q.transactionRequest as Record<string, unknown>;
      if (rawTx.gasLimit) txReq.gas = BigInt(rawTx.gasLimit as string);

      const tx = await sendTransactionAsync(txReq as Parameters<typeof sendTransactionAsync>[0]);
      setTxHash(tx);
      setStep('confirming');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Withdraw failed';
      if (msg.includes('No available quotes') || msg.includes('no routes')) {
        setError(`Withdrawal not available via Composer for this position. Try withdrawing directly on ${position.protocolName}'s app.`);
      } else if (msg.includes('rejected')) {
        setError('Transaction rejected.');
      } else if (msg.includes('internal error') || msg.includes('RPC') || msg.includes('client error')) {
        setError(`Transaction simulation failed. You may not have enough ETH for gas on ${chainName}, or the vault balance has changed. Try again.`);
      } else {
        setError(msg.length > 150 ? msg.slice(0, 150) + '...' : msg);
      }
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#1a2240] bg-[#0a0e1a] shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-[#1a2240] px-5 py-4">
          <h2 className="text-sm font-semibold">Withdraw from {position.protocolName}</h2>
          <button onClick={onClose} className="rounded p-1 text-[#e0e6f0]/30 hover:text-[#e0e6f0]/60 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Confirm step */}
          {(step === 'confirm' || step === 'error') && (
            <>
              <div className="rounded-lg border border-[#1a2240] bg-[#0f1528] p-4 space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">Asset</span>
                  <span className="font-semibold">{position.asset.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">Protocol</span>
                  <span>{position.protocolName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">Chain</span>
                  <span>{chainName}</span>
                </div>
                <hr className="border-[#1a2240]" />
                <div className="flex justify-between font-medium">
                  <span className="text-[#e0e6f0]/60">Withdraw amount</span>
                  <span className="text-[#e0e6f0] font-[var(--font-geist-mono)]">
                    {parseFloat(position.balanceNative).toFixed(6)} {position.asset.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">Value</span>
                  <span className="text-[#e0e6f0]/60 font-[var(--font-geist-mono)]">{formatUsd(parseFloat(position.balanceUsd))}</span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-[#ff3366]/20 bg-[#ff3366]/5 px-3 py-2 text-[11px] text-[#ff3366]">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />{error}
                </div>
              )}

              <button
                onClick={handleWithdraw}
                className="w-full rounded-lg bg-[#ff9f1c]/15 border border-[#ff9f1c]/25 py-3 text-sm font-semibold text-[#ff9f1c] hover:bg-[#ff9f1c]/25 cursor-pointer transition-colors"
              >
                Withdraw All
              </button>
            </>
          )}

          {step === 'quoting' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#4488ff]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Getting withdrawal quote...</p>
            </div>
          )}

          {step === 'approving' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#4488ff]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Step 1/2: Approve token</p>
              <p className="text-[9px] text-[#e0e6f0]/20">Confirm approval in your wallet</p>
            </div>
          )}

          {step === 'signing' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff9f1c]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Confirm withdrawal in your wallet</p>
            </div>
          )}

          {step === 'confirming' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#4488ff]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Verifying on-chain...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-6 gap-4">
              <CheckCircle2 className="h-10 w-10 text-[#00ff88]" />
              <div className="text-center">
                <p className="font-semibold text-[#00ff88]">Withdrawal Complete</p>
                <p className="text-[10px] text-[#e0e6f0]/30 mt-1">
                  {parseFloat(position.balanceNative).toFixed(6)} {position.asset.symbol} returned to your wallet
                </p>
              </div>
              {txHash && (
                <a href={`https://scan.li.fi/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-[#4488ff] hover:text-[#4488ff]/70">
                  <ExternalLink className="h-3 w-3" />View on LI.FI Explorer
                </a>
              )}
              <button onClick={onClose} className="w-full rounded-lg border border-[#1a2240] py-2.5 text-sm text-[#e0e6f0]/40 hover:bg-[#1a2240]/30 cursor-pointer">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
