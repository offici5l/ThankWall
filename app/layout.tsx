import type { Metadata } from 'next'
import { AppKitProvider } from '@/components/AppKitProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'ThankWall',
  description: 'On-chain wall of supporters.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projectId = process.env.REOWN_PROJECT_ID ?? ''
  return (
    <html lang="en">
      <body>
        <AppKitProvider projectId={projectId}>
          {children}
        </AppKitProvider>
      </body>
    </html>
  )
}
