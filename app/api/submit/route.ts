import { NextResponse } from 'next/server'
import redis from '@/lib/redis'
import { verifyEVM, verifyERC20, PendingError } from '@/lib/verify'
import type { Entry } from '@/lib/types'

export const dynamic = 'force-dynamic'

const USDT_BSC_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'
const USDT_ETH_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

export async function POST(req: Request) {
  let body: { name?: string; message?: string; type?: string; hash?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { name, message, type, hash } = body

  if (!name || !type || !hash)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
    return NextResponse.json({ error: 'Invalid transaction hash' }, { status: 400 })

  const cleanName = name.trim()
  if (cleanName.length < 1 || cleanName.length > 30)
    return NextResponse.json({ error: 'Name must be 1–30 characters' }, { status: 400 })

  const cleanMsg = message?.trim() || null
  if (cleanMsg && cleanMsg.length > 200)
    return NextResponse.json({ error: 'Message max 200 characters' }, { status: 400 })

  const currency = type.toUpperCase()

  const validCurrencies = ['ETH', 'BNB', 'USDT', 'USDT-ETH']
  if (!validCurrencies.includes(currency))
    return NextResponse.json({ error: `${currency} not supported` }, { status: 400 })

  const ourAddress = process.env.ADDRESS_EVM
  if (!ourAddress)
    return NextResponse.json({ error: 'Wallet not configured' }, { status: 400 })

  let amount: string
  try {
    if (currency === 'USDT') {
      amount = await verifyERC20(hash, ourAddress, USDT_BSC_CONTRACT, 56, 'USDT', 18)
    } else if (currency === 'USDT-ETH') {
      amount = await verifyERC20(hash, ourAddress, USDT_ETH_CONTRACT, 1, 'USDT', 6)
    } else {
      amount = await verifyEVM(hash, ourAddress, currency === 'ETH' ? 1 : 56, currency)
    }
  } catch (e: unknown) {
    if (e instanceof PendingError)
      return NextResponse.json({ error: e.message, pending: true }, { status: 202 })
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const saved = await redis.set(`hash:${hash}`, '1', { nx: true })
  if (!saved)
    return NextResponse.json({ error: 'Transaction already submitted' }, { status: 409 })

  const entry: Entry = {
    id:      crypto.randomUUID(),
    name:    cleanName,
    message: cleanMsg,
    type:    currency,
    amount,
    date:    new Date().toISOString(),
  }

  try {
    await redis.pipeline()
      .lpush('entries', entry)
      .ltrim('entries', 0, 999)
      .exec()
  } catch (e: unknown) {
    await redis.del(`hash:${hash}`)
    return NextResponse.json({ error: 'Failed to save entry. Please retry.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, entry }, { status: 201 })
}
