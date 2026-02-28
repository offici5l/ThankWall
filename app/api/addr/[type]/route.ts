import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const address = process.env.ADDRESS_EVM
  if (!address) return NextResponse.json({ error: 'Not configured' }, { status: 404 })
  return NextResponse.json({ address })
}
