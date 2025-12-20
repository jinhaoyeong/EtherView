import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_MS = 30 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const addr = searchParams.get('addr') || ''
  const chainid = searchParams.get('chainid') || '1'

  if (!addr) {
    return NextResponse.json({ error: 'Missing addr' }, { status: 400 })
  }

  const key = `covalent_${chainid}_${addr}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    const apiKey = process.env.COVALENT_API_KEY || ''
    const chain = chainid === '1' ? 'eth-mainnet' : chainid
    const baseUrl = `https://api.covalenthq.com/v1/${chain}/address/${addr}/balances_v2/?no-nft-fetch=true${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''}`

    // Try with query param only
    let res = await fetch(baseUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    })

    // Fallbacks for auth formats
    if (!res.ok && apiKey) {
      res = await fetch(baseUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(15000)
      })
    }

    if (!res.ok && apiKey) {
      const basic = Buffer.from(`${apiKey}:`).toString('base64')
      res = await fetch(baseUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${basic}`
        },
        signal: AbortSignal.timeout(15000)
      })
    }

    if (!res.ok) {
      return NextResponse.json({ tokens: [] })
    }

    const json = await res.json()
    const dataObj = json as { data?: { items?: unknown[] } }
    const items = Array.isArray(dataObj.data?.items) ? (dataObj.data?.items as unknown[]) : []
    const data = { tokens: items }
    cache.set(key, { data, ts: Date.now() })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ tokens: [] })
  }
}