import { NextResponse } from 'next/server'
import redis from '@/lib/redis'
import type { Entry } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const raw = await redis.lrange<Entry>('entries', 0, -1)
  return NextResponse.json({ count: raw.length, data: raw })
}
