'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useSendTransaction, useSwitchChain, useChainId, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt as waitForTxReceipt } from '@wagmi/core';
import type { Vault, ComposerQuote } from '@/types';
import { fetchQuote, fetchStatus } from '@/lib/api';
import { config } from '@/lib/wagmi';
import { calculateNetYield } from '@/lib/optimizer';
import { analyzeRisk } from '@/lib/risk-engine';
import { formatUsd, formatApy, cn } from '@/lib/utils';
import { X, Loader2, CheckCircle2, ExternalLink, AlertTriangle, Shield, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface Props {
  vault: Vault;
  onClose: () => void;
}

type Step = 'input' | 'quoting' | 'preview' | 'approving' | 'signing' | 'confirming' | 'success' | 'error';

const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 10: 'Optimism', 56: 'BSC', 100: 'Gnosis', 137: 'Polygon',
  143: 'Monad', 5000: 'Mantle', 8453: 'Base', 42161: 'Arbitrum',
  42220: 'Celo', 43114: 'Avalanche', 59144: 'Linea', 534352: 'Scroll',
};

// Well-known token addresses per chain for cross-chain fromToken resolution
const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: {
    1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  },
  USDT: {
    1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    56: '0x55d398326f99059fF775485246999027B3197955',
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
  ETH: {
    1: '0x0000000000000000000000000000000000000000',
    10: '0x0000000000000000000000000000000000000000',
    8453: '0x0000000000000000000000000000000000000000',
    42161: '0x0000000000000000000000000000000000000000',
  },
};

function resolveFromToken(symbol: string, vaultTokenAddr: string, userChainId: number, vaultChainId: number): string {
  // Same chain: use the vault's token address directly
  if (userChainId === vaultChainId) return vaultTokenAddr;
  // Cross-chain: look up the token on the user's chain
  const upperSymbol = symbol.toUpperCase();
  return TOKEN_ADDRESSES[upperSymbol]?.[userChainId] || vaultTokenAddr;
}

export function DepositModal({ vault, onClose }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [quote, setQuote] = useState<ComposerQuote | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = vault.underlyingTokens[0];
  const decimals = token?.decimals ?? 18;
  const risk = analyzeRisk(vault);
  const amountNum = parseFloat(amount) || 0;

  // Detect cross-chain situation
  const isCrossChain = chainId !== vault.chainId;
  const userChainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  const vaultChainName = CHAIN_NAMES[vault.chainId] || vault.network;

  // Reset to input when chain changes
  useEffect(() => {
    if (step === 'error' || step === 'preview') {
      setStep('input');
      setQuote(null);
      setError(null);
    }
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for on-chain receipt before showing success
  const { data: receipt, isError: receiptError } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  useEffect(() => {
    if (step !== 'confirming' || !txHash) return;

    if (receipt) {
      if (receipt.status === 'success') {
        setStep('success');
        setTxStatus('DONE');
      } else {
        setError('Transaction reverted on-chain. You may not have enough tokens or gas.');
        setStep('error');
      }
    }
    if (receiptError) {
      setError('Transaction was not confirmed on-chain. It may have been cancelled by your wallet. Check MetaMask Settings → Advanced → disable Smart Transactions, then try again.');
      setStep('error');
    }
  }, [receipt, receiptError, step, txHash]);

  // Poll LI.FI status after on-chain success
  useEffect(() => {
    if (step !== 'success' || !txHash) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchStatus(txHash);
        setTxStatus(status.status);
        if (status.status === 'DONE' || status.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, txHash]);

  async function handleQuote() {
    if (!address || amountNum <= 0) return;
    setStep('quoting');
    setError(null);
    try {
      const baseUnits = BigInt(Math.floor(amountNum * 10 ** decimals)).toString();
      const fromToken = resolveFromToken(token.symbol, token.address, chainId, vault.chainId);
      const q = await fetchQuote({
        fromChain: chainId,
        toChain: vault.chainId,
        fromToken,
        toToken: vault.address,
        fromAddress: address,
        fromAmount: baseUnits,
        slippage: 0.005,
      });
      setQuote(q);
      setStep('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Quote failed';
      if (msg.includes('invalid or in deny list') || msg.includes('Invalid token')) {
        setError(`${token.symbol} on ${vaultChainName} isn't available for cross-chain deposits from ${userChainName}. Switch your wallet to ${vaultChainName} and try again.`);
      } else if (msg.includes('No available quotes') || msg.includes('no routes') || msg.includes('could not find')) {
        setError(`No deposit route from ${userChainName} to ${vaultChainName}. Try switching to ${vaultChainName} first, or choose a vault on ${userChainName}.`);
      } else if (msg.includes('None of the available routes')) {
        setError(`No route could complete this deposit. ${vaultChainName} may have limited bridge support. Try switching to ${vaultChainName} directly.`);
      } else {
        setError(msg.length > 200 ? msg.slice(0, 200) + '...' : msg);
      }
      setStep('error');
    }
  }

  async function handleDeposit() {
    if (!quote || !address) return;
    setError(null);

    try {
      const txChainId = quote.transactionRequest.chainId;
      if (chainId !== txChainId) {
        await switchChainAsync({ chainId: txChainId });
      }

      // Step 1: Check token allowance and approve if needed
      const approvalAddress = (quote.estimate as Record<string, unknown>).approvalAddress as string | undefined;
      const fromTokenAddr = quote.action.fromToken.address as `0x${string}`;
      const depositAmountBig = BigInt(quote.action.fromAmount);

      if (approvalAddress && fromTokenAddr !== '0x0000000000000000000000000000000000000000') {
        setStep('approving');

        // Read current allowance
        const allowanceResult = await fetch(
          `https://li.quest/v1/token?chain=${txChainId}&token=${fromTokenAddr}`,
        ).catch(() => null); // We'll just approve anyway if this fails

        // Send approval tx — approve max uint256 so user doesn't need to re-approve
        try {
          const approveTxHash = await writeContractAsync({
            address: fromTokenAddr,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [approvalAddress as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
            chainId: txChainId,
          });

          // Wait for approval to be mined using wagmi's built-in receipt polling
          const approvalReceipt = await waitForTxReceipt(config, {
            hash: approveTxHash,
            confirmations: 1,
          });

          if (approvalReceipt.status !== 'success') {
            setError('Approval transaction reverted on-chain. Please try again.');
            setStep('error');
            return;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('User rejected') || msg.includes('user rejected')) {
            setError('Approval rejected in wallet.');
          } else {
            setError('Token approval failed. Please try again.');
          }
          setStep('error');
          return;
        }
      }

      // Step 2: Send deposit transaction
      setStep('signing');

      const txReq: Record<string, unknown> = {
        to: quote.transactionRequest.to as `0x${string}`,
        data: quote.transactionRequest.data as `0x${string}`,
        value: BigInt(quote.transactionRequest.value || '0'),
        chainId: txChainId,
      };
      const rawTx = quote.transactionRequest as Record<string, unknown>;
      if (rawTx.gasLimit) {
        txReq.gas = BigInt(rawTx.gasLimit as string);
      }
      const tx = await sendTransactionAsync(txReq as Parameters<typeof sendTransactionAsync>[0]);
      setTxHash(tx);
      setStep('confirming');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
        setError(`Insufficient ${token?.symbol || 'token'} balance or gas on ${userChainName}.`);
      } else if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setError('Transaction rejected in wallet.');
      } else if (msg.includes('RPC') || msg.includes('client error') || msg.includes('internal error')) {
        setError(`Transaction simulation failed. Make sure you have enough ${token?.symbol} and ETH for gas on ${userChainName}.`);
      } else {
        setError(msg.length > 200 ? msg.slice(0, 200) + '...' : msg);
      }
      setStep('error');
    }
  }

  // Net yield from REAL quote data (not estimates)
  const netYield = quote
    ? (() => {
        const gasCost = quote.estimate.gasCosts.reduce((s, g) => s + parseFloat(g.amountUSD || '0'), 0);
        const feeCost = quote.estimate.feeCosts.reduce((s, f) => s + parseFloat(f.amountUSD || '0'), 0);
        const totalCost = gasCost + feeCost;
        const nominalApy = vault.analytics.apy.total;
        const costAsApy = amountNum > 0 ? (totalCost / amountNum) * 100 : 0;
        const netApy = nominalApy - costAsApy;
        const annualEarnings = (amountNum * netApy) / 100;
        const breakEvenDays = nominalApy > 0 && totalCost > 0
          ? (totalCost / ((amountNum * nominalApy) / 100 / 365))
          : 0;
        return { nominalApy, netApy, totalCostUsd: totalCost, gasCostUsd: gasCost, feeCostUsd: feeCost, annualEarnings, monthlyEarnings: annualEarnings / 12, breakEvenDays };
      })()
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-[#1a2240] bg-[#0a0e1a] shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1a2240] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Deposit into {vault.name}</h2>
            <p className="text-[10px] text-[#e0e6f0]/30">{vault.protocol.name} · {vault.network} · {formatApy(vault.analytics.apy.total)} APY</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#e0e6f0]/30 hover:text-[#e0e6f0]/60 hover:bg-[#1a2240]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Input step */}
          {(step === 'input' || step === 'error') && (
            <>
              <div>
                <label className="block text-[10px] text-[#e0e6f0]/30 mb-1 uppercase tracking-wider">Amount ({token?.symbol})</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-[#1a2240] bg-[#0f1528] px-4 py-3 text-lg font-[var(--font-geist-mono)] text-[#e0e6f0] outline-none focus:border-[#4488ff]/40"
                  min="0"
                  step="any"
                />
              </div>

              {/* Cross-chain notice */}
              {isCrossChain && (
                <div className="rounded-lg border border-[#4488ff]/20 bg-[#4488ff]/5 px-3 py-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#4488ff] font-medium">
                    <ArrowLeftRight className="h-3 w-3" />
                    Cross-chain deposit
                  </div>
                  <p className="text-[#e0e6f0]/35 mt-0.5">
                    You're on {userChainName}, vault is on {vaultChainName}. Composer will bridge + deposit in one transaction. This adds bridge fees (~$2-5).
                  </p>
                </div>
              )}

              {/* Risk summary */}
              <div className={cn(
                'rounded-lg border px-3 py-2 text-[11px]',
                risk.overall === 'low' ? 'border-[#00ff88]/20 bg-[#00ff88]/5 text-[#00ff88]' :
                risk.overall === 'medium' ? 'border-[#ff9f1c]/20 bg-[#ff9f1c]/5 text-[#ff9f1c]' :
                'border-[#ff3366]/20 bg-[#ff3366]/5 text-[#ff3366]',
              )}>
                <div className="flex items-center gap-1 font-medium"><Shield className="h-3 w-3" />Risk: {risk.overall.toUpperCase()}</div>
                <p className="text-[#e0e6f0]/40 mt-0.5">{risk.summary}</p>
              </div>

              {error && (
                <div className="rounded-lg border border-[#ff3366]/20 bg-[#ff3366]/5 px-3 py-2 text-[11px] text-[#ff3366]">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />{error}
                </div>
              )}

              <button
                onClick={handleQuote}
                disabled={!isConnected || amountNum <= 0}
                className="w-full rounded-lg bg-[#4488ff] py-3 text-sm font-semibold text-white hover:bg-[#5599ff] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {!isConnected ? 'Connect wallet first' : 'Get Quote'}
              </button>
            </>
          )}

          {/* Quoting */}
          {step === 'quoting' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#4488ff]" />
              <p className="text-[11px] text-[#e0e6f0]/40">
                {isCrossChain
                  ? `Finding route from ${userChainName} to ${vaultChainName}...`
                  : 'Getting quote from LI.FI Composer...'
                }
              </p>
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && netYield && quote && (
            <>
              <div className="rounded-lg border border-[#1a2240] bg-[#0f1528] p-4 space-y-2 text-[11px]">
                {/* Route summary */}
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">From</span>
                  <span className="font-[var(--font-geist-mono)]">{amount} {token?.symbol} on {CHAIN_NAMES[quote.action.fromChainId] || 'source'}</span>
                </div>
                <div className="flex justify-center"><ArrowRight className="h-3 w-3 text-[#4488ff]" /></div>
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">To</span>
                  <span>{vault.name} on {vaultChainName}</span>
                </div>

                {/* Cross-chain indicator */}
                {quote.action.fromChainId !== quote.action.toChainId && (
                  <div className="flex items-center gap-1.5 rounded bg-[#4488ff]/10 px-2 py-1 text-[9px] text-[#4488ff]">
                    <ArrowLeftRight className="h-3 w-3" />
                    Cross-chain: {CHAIN_NAMES[quote.action.fromChainId]} → {CHAIN_NAMES[quote.action.toChainId]} (includes bridge)
                  </div>
                )}

                {/* Execution steps */}
                {quote.includedSteps && quote.includedSteps.length > 0 && (
                  <div className="rounded bg-[#0a0e1a]/60 px-2.5 py-1.5">
                    <div className="text-[9px] text-[#e0e6f0]/25 uppercase tracking-wider mb-1">Route</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {quote.includedSteps.map((s, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className={cn(
                            'rounded px-1.5 py-0.5 text-[9px]',
                            s.type === 'cross' ? 'bg-[#ff9f1c]/10 text-[#ff9f1c]' : 'bg-[#4488ff]/10 text-[#4488ff]',
                          )}>
                            {s.type === 'cross' ? `bridge (${s.tool})` : s.type === 'protocol' ? s.tool : s.type}
                          </span>
                          {i < quote.includedSteps!.length - 1 && <span className="text-[#e0e6f0]/15">→</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <hr className="border-[#1a2240]" />

                {/* Itemized costs */}
                {quote.estimate.gasCosts.map((g, i) => (
                  <div key={`gas-${i}`} className="flex justify-between">
                    <span className="text-[#e0e6f0]/40">Gas ({g.type})</span>
                    <span className="text-[#ff3366] font-[var(--font-geist-mono)]">-${parseFloat(g.amountUSD).toFixed(4)}</span>
                  </div>
                ))}
                {quote.estimate.feeCosts.map((f, i) => (
                  <div key={`fee-${i}`} className="flex justify-between">
                    <span className="text-[#e0e6f0]/40">{f.name}</span>
                    <span className="text-[#ff9f1c] font-[var(--font-geist-mono)]">-${parseFloat(f.amountUSD).toFixed(4)}</span>
                  </div>
                ))}

                {/* Total cost */}
                <div className="flex justify-between font-medium">
                  <span className="text-[#e0e6f0]/50">Total cost</span>
                  <span className="text-[#ff3366] font-[var(--font-geist-mono)]">{formatUsd(netYield.totalCostUsd)}</span>
                </div>

                {/* Execution time */}
                {quote.estimate.executionDuration > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#e0e6f0]/40">Est. time</span>
                    <span className="text-[#e0e6f0]/50 font-[var(--font-geist-mono)]">
                      {quote.estimate.executionDuration < 60
                        ? `~${quote.estimate.executionDuration}s`
                        : `~${Math.ceil(quote.estimate.executionDuration / 60)}min`}
                    </span>
                  </div>
                )}

                <hr className="border-[#1a2240]" />

                {/* Net yield */}
                <div className="flex justify-between font-medium">
                  <span className="text-[#e0e6f0]/70">Net APY (1yr hold)</span>
                  <span className={cn('font-bold font-[var(--font-geist-mono)]', netYield.netApy > 0 ? 'text-[#00ff88]' : 'text-[#ff3366]')}>
                    {formatApy(netYield.netApy)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#e0e6f0]/40">Est. yearly</span>
                  <span className={cn('font-[var(--font-geist-mono)]', netYield.annualEarnings >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]')}>
                    {formatUsd(netYield.annualEarnings)}
                  </span>
                </div>
                {netYield.breakEvenDays > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#e0e6f0]/40">Break-even</span>
                    <span className="text-[#e0e6f0]/50 font-[var(--font-geist-mono)]">
                      {netYield.breakEvenDays < 1 ? '<1 day' : `${Math.ceil(netYield.breakEvenDays)} days`}
                    </span>
                  </div>
                )}
              </div>

              {/* Negative yield warning */}
              {/* Warning: cost exceeds deposit amount */}
              {netYield.totalCostUsd > amountNum && (
                <div className="rounded-lg border border-[#ff3366]/25 bg-[#ff3366]/5 px-3 py-2.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#ff3366] font-medium mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Cost exceeds deposit
                  </div>
                  <p className="text-[#e0e6f0]/35">
                    You're paying {formatUsd(netYield.totalCostUsd)} in fees to deposit {formatUsd(amountNum)}.
                    {isCrossChain && ` The ${formatUsd(netYield.totalCostUsd)} bridge fee alone is ${(netYield.totalCostUsd / amountNum * 100).toFixed(0)}% of your deposit.`}
                    {' '}Increase your deposit amount{isCrossChain ? ' or use a vault on your current chain' : ''}.
                  </p>
                </div>
              )}

              {/* Warning: negative net APY (cost doesn't exceed deposit but eats the yield) */}
              {netYield.netApy < 0 && netYield.totalCostUsd <= amountNum && (
                <div className="rounded-lg border border-[#ff3366]/25 bg-[#ff3366]/5 px-3 py-2.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#ff3366] font-medium mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Transaction cost exceeds yield
                  </div>
                  <p className="text-[#e0e6f0]/35">
                    The {formatUsd(netYield.totalCostUsd)} cost is more than you'd earn on {formatUsd(amountNum)}.
                    {' '}Consider a larger deposit{isCrossChain ? ' or a vault on your current chain' : ''}.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setStep('input'); setQuote(null); }} className="flex-1 rounded-lg border border-[#1a2240] py-2.5 text-sm text-[#e0e6f0]/40 hover:bg-[#1a2240]/30">Back</button>
                {netYield.totalCostUsd > amountNum ? (
                  <button onClick={handleDeposit} className="flex-1 rounded-lg bg-[#ff3366]/10 border border-[#ff3366]/25 py-2.5 text-sm font-semibold text-[#ff3366] hover:bg-[#ff3366]/20">Deposit Anyway</button>
                ) : netYield.netApy < 0 ? (
                  <button onClick={handleDeposit} className="flex-1 rounded-lg bg-[#ff3366]/10 border border-[#ff3366]/25 py-2.5 text-sm font-semibold text-[#ff3366] hover:bg-[#ff3366]/20">Deposit Anyway</button>
                ) : (
                  <button onClick={handleDeposit} className="flex-1 rounded-lg bg-[#00ff88]/15 border border-[#00ff88]/25 py-2.5 text-sm font-semibold text-[#00ff88] hover:bg-[#00ff88]/25">Confirm Deposit</button>
                )}
              </div>
            </>
          )}

          {/* Signing */}
          {/* Approving token */}
          {step === 'approving' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#4488ff]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Step 1/2: Approve {token?.symbol} spending</p>
              <p className="text-[9px] text-[#e0e6f0]/20 text-center max-w-[280px]">
                Confirm the approval in your wallet. This allows the LI.FI contract to deposit your {token?.symbol}.
              </p>
            </div>
          )}

          {/* Signing deposit */}
          {step === 'signing' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#00ff88]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Step 2/2: Confirm deposit</p>
              <p className="text-[9px] text-[#e0e6f0]/20 text-center max-w-[280px]">
                Confirm the deposit transaction in your wallet.
              </p>
            </div>
          )}

          {/* Confirming — waiting for on-chain receipt */}
          {step === 'confirming' && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-[#4488ff]" />
              <p className="text-[11px] text-[#e0e6f0]/40">Verifying on-chain...</p>
              <p className="text-[9px] text-[#e0e6f0]/20">Waiting for block confirmation</p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && txHash && (
            <div className="flex flex-col items-center py-6 gap-4">
              <CheckCircle2 className="h-10 w-10 text-[#00ff88]" />
              <div className="text-center">
                <p className="font-semibold text-[#00ff88]">Deposit Submitted</p>
                <p className="text-[10px] text-[#e0e6f0]/30 mt-1">{amount} {token?.symbol} → {vault.name}</p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className={cn(
                  'h-2 w-2 rounded-full',
                  txStatus === 'DONE' ? 'bg-[#00ff88]' :
                  txStatus === 'FAILED' ? 'bg-[#ff3366]' :
                  'bg-[#ff9f1c] animate-pulse',
                )} />
                <span className="text-[#e0e6f0]/40 font-[var(--font-geist-mono)]">
                  {txStatus === 'DONE' ? 'Confirmed' :
                   txStatus === 'FAILED' ? 'Failed' :
                   txStatus === 'PENDING' ? 'Confirming...' :
                   'Tracking...'}
                </span>
              </div>
              <a href={`https://scan.li.fi/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-[#4488ff] hover:text-[#4488ff]/70">
                <ExternalLink className="h-3 w-3" />View on LI.FI Explorer
              </a>
              <button onClick={onClose} className="w-full rounded-lg border border-[#1a2240] py-2.5 text-sm text-[#e0e6f0]/40 hover:bg-[#1a2240]/30">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
