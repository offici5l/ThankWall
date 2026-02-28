'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, bsc } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ReactNode, useRef } from 'react'

let _adapter: WagmiAdapter | null = null

export function getWagmiAdapter() {
  if (!_adapter) throw new Error('AppKitProvider not mounted')
  return _adapter
}

function initAppKit(projectId: string) {
  if (_adapter) return

  _adapter = new WagmiAdapter({
    networks: [mainnet, bsc],
    projectId,
    ssr: true,
  })

  createAppKit({
    adapters:  [_adapter],
    networks:  [mainnet, bsc],
    projectId,
    metadata: {
      name:        'ThankWall',
      description: 'On-chain wall of supporters.',
      url:         typeof window !== 'undefined' ? window.location.origin : '',
      icons:       [],
    },
    features: {
      analytics:    false,
      swaps:        false,
      onramp:       false,
      legalCheckbox: false,
    },
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent':               '#0A1628',
      '--w3m-border-radius-master': '0',
    },
  })
}

export function AppKitProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  initAppKit(projectId)

  const queryClient = useRef(new QueryClient()).current

  return (
    <WagmiProvider config={_adapter!.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
