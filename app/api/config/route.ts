import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    mins: {
      ETH:        process.env.MIN_ETH      ?? '0',
      BNB:        process.env.MIN_BNB      ?? '0',
      USDT:       process.env.MIN_USDT     ?? '0',
      'USDT-ETH': process.env.MIN_USDT     ?? '0',
    },
  })
}
