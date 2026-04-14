'use client';

import { useState, type ReactNode } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider, type State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiAdapter, config, networks } from '@/lib/wagmi';

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';

const metadata = {
  name: 'Aporis',
  description: 'AI Yield Intelligence Terminal — powered by LI.FI Earn',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://aporis.vercel.app',
  icons: [],
};

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [networks[0], ...networks.slice(1)] as [typeof networks[0], ...typeof networks],
  defaultNetwork: networks[0],
  metadata,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#4488ff',
    '--w3m-border-radius-master': '8px',
  },
  features: {
    analytics: false,
    onramp: false,
    swaps: false,
  },
});

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
