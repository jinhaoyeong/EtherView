import { NextRequest, NextResponse } from 'next/server'

const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_MS = 30 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const addr = searchParams.get('addr') || ''

  if (!addr) {
    return NextResponse.json({ error: 'Missing addr' }, { status: 400 })
  }

  const key = `debank_${addr}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    const urls = [
      `https://openapi.debank.com/v1/user/token_list?id=${addr}&is_all=true`,
      `https://openapi.debank.com/v1/token/token_list?addr=${addr}`
    ]

    let result: unknown[] = []
    for (const url of urls) {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EtherView/1.0'
        },
        // Debank can be slow; keep a reasonable timeout
        signal: AbortSignal.timeout(10000)
      })
      if (!res.ok) {
        continue
      }
      const json = await res.json()
      if (Array.isArray(json)) {
        result = json
        break
      }
      const jsonObj = json as { data?: unknown[] }
      if (Array.isArray(jsonObj.data)) {
        result = jsonObj.data
        break
      }
    }

    const data = { tokens: Array.isArray(result) ? result : [] }
    cache.set(key, { data, ts: Date.now() })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ tokens: [] })
  }
}