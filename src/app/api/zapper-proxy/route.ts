import { isEthereumAddress } from '@/lib/api/request-validation'
import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_MS = 30 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const addr = searchParams.get('addr') || ''
  const network = (searchParams.get('network') || 'ethereum').toLowerCase()

  if (!isEthereumAddress(addr)) {
    return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
  }

  if (network !== 'ethereum') return NextResponse.json({ error: 'Only Ethereum mainnet is supported' }, { status: 400 })

  const key = `zapper_${network}_${addr}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data)
  }

  const apiKey = process.env.ZAPPER_API_KEY || ''

  try {
    const urls = [
      `https://api.zapper.xyz/v2/balances/tokens?addresses%5B%5D=${addr}&network=${network}`,
      `https://api.zapper.xyz/v2/balances/apps?addresses%5B%5D=${addr}&network=${network}`,
      `https://api.zapper.fi/v2/balances/${addr}`
    ]

    let json: unknown = null
    for (const url of urls) {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'x-api-key': apiKey
        },
        signal: AbortSignal.timeout(15000)
      })
      if (!res.ok) {
        continue
      }
      json = await res.json()
      break
    }

    if (json == null) {
      return NextResponse.json({ error: 'Token provider is unavailable', code: 'PROVIDER_UNAVAILABLE' }, { status: 503 })
    }
    cache.set(key, { data: json, ts: Date.now() })
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ error: 'Token provider is unavailable', code: 'PROVIDER_UNAVAILABLE' }, { status: 503 })
  }
}