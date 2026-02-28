import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  const currencies: string[] = []
  if (process.env.ADDRESS_EVM) {
    currencies.push('ETH', 'BNB', 'USDT', 'USDT-ETH')
  }
  return NextResponse.json({ currencies })
}
