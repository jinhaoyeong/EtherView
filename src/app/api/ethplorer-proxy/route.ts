import { isEthereumAddress } from '@/lib/api/request-validation'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const addr = (searchParams.get('addr') || '').toLowerCase()
    if (!isEthereumAddress(addr)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    const url = `https://api.ethplorer.io/getAddressInfo/${addr}?apiKey=freekey`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'EtherView/1.0' },
      signal: AbortSignal.timeout(12000)
    })
    if (!res.ok) return NextResponse.json({ error: 'Token provider is unavailable', code: 'PROVIDER_UNAVAILABLE' }, { status: 503 })
    const json = await res.json()

    const rawTokens: any[] = Array.isArray(json?.tokens) ? json.tokens : []
    const out = rawTokens.map(t => {
      const info = t?.tokenInfo || {}
      const parsedDecimals = Number(info?.decimals ?? 18)
      const decimals = Number.isInteger(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 255 ? parsedDecimals : 18
      const balance = typeof t?.balance === 'number' ? t.balance : parseFloat(t?.balance || '0')
      const amount = balance / Math.pow(10, decimals)
      const price = typeof info?.price?.rate === 'number' ? info.price.rate : 0
      return {
        id: (info?.address || '').toLowerCase(),
        address: (info?.address || '').toLowerCase(),
        symbol: info?.symbol || 'UNKNOWN',
        name: info?.name || info?.symbol || 'Unknown Token',
        decimals,
        amount,
        price,
      }
    })

    return NextResponse.json({ tokens: out })
  } catch {
    return NextResponse.json({ error: 'Token provider is unavailable', code: 'PROVIDER_UNAVAILABLE' }, { status: 503 })
  }
}
