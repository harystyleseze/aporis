'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchAllVaults, fetchChains, fetchProtocols,
  fetchPortfolio, fetchTools, fetchTokens,
  fetchGasEstimates,
} from '@/lib/api';
import type { EarnChain, EarnProtocol } from '@/types';

export function useVaults(chainId?: number) {
  return useQuery({
    queryKey: ['vaults', chainId],
    queryFn: () => fetchAllVaults({ chainId, maxPages: 8 }),
    staleTime: 60_000,
    select: (data) => data.vaults,
  });
}

export function useChains() {
  return useQuery<EarnChain[]>({
    queryKey: ['chains'],
    queryFn: fetchChains,
    staleTime: 300_000,
  });
}

export function useProtocols() {
  return useQuery<EarnProtocol[]>({
    queryKey: ['protocols'],
    queryFn: fetchProtocols,
    staleTime: 300_000,
  });
}

export function usePortfolio(address?: string) {
  return useQuery({
    queryKey: ['portfolio', address],
    queryFn: () => fetchPortfolio(address!),
    enabled: !!address,
    staleTime: 30_000,
  });
}

export function useTools() {
  return useQuery({
    queryKey: ['tools'],
    queryFn: fetchTools,
    staleTime: 300_000,
  });
}

export function useTokens(chainId?: number) {
  return useQuery({
    queryKey: ['tokens', chainId],
    queryFn: () => fetchTokens(chainId!),
    enabled: !!chainId,
    staleTime: 120_000,
  });
}

export function useGasEstimates(chainIds: number[]) {
  return useQuery({
    queryKey: ['gas-estimates', chainIds.sort().join(',')],
    queryFn: () => fetchGasEstimates(chainIds),
    enabled: chainIds.length > 0,
    staleTime: 120_000,
  });
}
