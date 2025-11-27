import { NextRequest, NextResponse } from 'next/server'

type CacheEntry = { holders: number; ts: number }
const cache: Map<string, CacheEntry> = new Map()

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const address = (url.searchParams.get('address') || '').toLowerCase()
    if (!address || !address.startsWith('0x')) {
      return NextResponse.json({}, { status: 200 })
    }

    const now = Date.now()
    const ttl = 10 * 60 * 1000
    const cached = cache.get(address)
    if (cached && now - cached.ts < ttl) {
      return NextResponse.json({ holders: cached.holders }, { status: 200 })
    }

    const key = process.env.ETHERSCAN_API_KEY || ''
    const apiUrl = `https://api.etherscan.io/v2/api?chainid=1&module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=1&apikey=${key}`
    let holders = 0
    try {
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data?.result) ? data.result : []
        const total = list.length > 0 ? parseInt(list[0]?.TotalHolders || '0') : 0
        if (!isNaN(total) && total > 0) holders = total
      }
    } catch {}

    cache.set(address, { holders, ts: now })
    return NextResponse.json({ holders }, { status: 200 })
  } catch {
    return NextResponse.json({}, { status: 200 })
  }
}