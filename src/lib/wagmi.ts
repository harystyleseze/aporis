import { cookieStorage, createStorage } from '@wagmi/core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  mainnet, arbitrum, optimism, base, polygon,
  avalanche, bsc, gnosis, linea, scroll, mantle, celo,
} from '@reown/appkit/networks';

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';

export const networks = [
  mainnet, base, arbitrum, optimism, polygon,
  avalanche, bsc, gnosis, linea, scroll, mantle, celo,
];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId,
  networks,
});

export const config = wagmiAdapter.wagmiConfig;
