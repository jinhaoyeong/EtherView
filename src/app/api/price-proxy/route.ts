import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { WHITELIST_MAINNET } from '@/lib/config/tokenWhitelist'
import { cmcProvider } from '@/lib/providers/cmc'
import { dexscreenerProvider } from '@/lib/providers/dexscreener'

type ProviderHealth = { cooldownUntil: number }
const health: Record<string, ProviderHealth> = {}
const wlCache: Map<string, { usd: number; source: string; ts: number; confidence: number }> = new Map()
const tokenCache: Map<string, { usd: number; source: string; ts: number; confidence: number }> = new Map()

function inCooldown(provider: string) {
  const h = health[provider]
  return h && Date.now() < h.cooldownUntil
}

function setCooldown(provider: string, seconds: number) {
  health[provider] = { cooldownUntil: Date.now() + seconds * 1000 }
}

async function coingeckoTokenBatch(addresses: string[]) {
  const map: Record<string, { usd: number; source: string; confidence: number }> = {}
  const chunkSize = 40
  for (let i = 0; i < addresses.length; i += chunkSize) {
    const chunk = addresses.slice(i, i + chunkSize)
    const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${chunk.join(',')}&vs_currencies=usd`
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'EtherView/1.0' }, signal: AbortSignal.timeout(6000) })
      if (res.status === 429) { setCooldown('coingecko', 20); break }
      if (!res.ok) { continue }
      const data = await res.json()
      for (const addr of chunk) {
        const usd = data[addr.toLowerCase()]?.usd || 0
        if (usd > 0) map[addr.toLowerCase()] = { usd, source: 'coingecko', confidence: 0.7 }
      }
      await new Promise(r => setTimeout(r, 150))
    } catch {}
  }
  return map
}

async function coinbaseSpot(symbol: string) {
  const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`coinbase ${res.status}`)
  const data = await res.json()
  const amount = parseFloat(data?.data?.amount)
  if (!isNaN(amount) && amount > 0) return { usd: amount, source: 'coinbase' }
  throw new Error('coinbase invalid')
}

async function cryptocompareSpot(symbol: string) {
  const headers: Record<string, string> = { 'Accept': 'application/json' }
  const apiKey = process.env.CRYPTOCOMPARE_API_KEY || ''
  if (apiKey) headers['authorization'] = `Apikey ${apiKey}`
  const res = await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`, { headers, signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`cryptocompare ${res.status}`)
  const data = await res.json()
  const usd = data?.USD
  if (typeof usd === 'number' && usd > 0) return { usd, source: 'cryptocompare' }
  throw new Error('cryptocompare invalid')
}

// Helper function to fetch from CMC using address mapping
async function fetchFromCMC(addresses: string[]): Promise<Record<string, { usd: number; source: string; confidence: number }>> {
  const result: Record<string, { usd: number; source: string; confidence: number }> = {}

  // Map addresses to symbols using whitelist
  const symbolMap = new Map<string, string>()
  addresses.forEach(addr => {
    const meta = WHITELIST_MAINNET[addr.toLowerCase()]
    if (meta) {
      const symbol = (meta.canonicalSymbol || meta.symbol).toUpperCase()
      symbolMap.set(addr, symbol)
    }
  })

  if (symbolMap.size === 0) {
    return {}
  }

  const symbols = Array.from(symbolMap.values())
  const cmcQuotes = await cmcProvider.getWhitelistQuotes(symbols)

  symbolMap.forEach((symbol, address) => {
    const quote = cmcQuotes.get(symbol)
    if (quote) {
      result[address.toLowerCase()] = {
        usd: quote.price,
        source: 'cmc',
        confidence: quote.confidence
      }
    }
  })

  return result
}

// Helper function to fetch from Dexscreener using new provider
async function fetchFromDexscreener(addresses: string[]): Promise<Record<string, { usd: number; source: string; confidence: number }>> {
  const result: Record<string, { usd: number; source: string; confidence: number }> = {}

  // Use the new Dexscreener provider for batch processing
  const dexPrices = await dexscreenerProvider.getBatchTokenPrices(addresses)

  dexPrices.forEach((priceInfo, address) => {
    result[address.toLowerCase()] = {
      usd: priceInfo.price,
      source: 'dexscreener',
      confidence: priceInfo.confidence
    }
  })

  return result
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'token'
  try {
    
    if (type === 'whitelist') {
      const symbolsParam = url.searchParams.get('symbols') || ''
      const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      if (symbols.length === 0) return NextResponse.json({}, { status: 200 })
      const out: Record<string, { usd: number; source: string; confidence: number }> = {}
      const now = Date.now()
      const toFetch: string[] = []
      for (const s of symbols) {
        const c = wlCache.get(s)
        if (c && now - c.ts < 10 * 60 * 1000) {
          out[s] = { usd: c.usd, source: c.source, confidence: c.confidence }
        } else {
          toFetch.push(s)
        }
      }
      if (toFetch.length > 0) {
        const quotes = await cmcProvider.getWhitelistQuotes(toFetch)
        for (const s of toFetch) {
          const q = quotes.get(s)
          if (q && q.price > 0) {
            wlCache.set(s, { usd: q.price, source: 'cmc', ts: now, confidence: q.confidence })
            out[s] = { usd: q.price, source: 'cmc', confidence: q.confidence }
          }
        }
        const stillMissingSyms = toFetch.filter(s => !out[s])
        for (const s of stillMissingSyms) {
          let filled: { usd: number; source: string } | null = null
          if (!inCooldown('cryptocompare')) {
            try { filled = await cryptocompareSpot(s) } catch {}
          }
          if (!filled && !inCooldown('coinbase')) {
            try { filled = await coinbaseSpot(s) } catch {}
          }
          if (!filled && ['USDC','USDT','DAI'].includes(s)) {
            filled = { usd: 1, source: 'fixed' }
          }
          if (filled && filled.usd > 0) {
            wlCache.set(s, { usd: filled.usd, source: filled.source, ts: now, confidence: 0.7 })
            out[s] = { usd: filled.usd, source: filled.source, confidence: 0.7 }
          }
        }
      }
      return NextResponse.json(out, { status: 200 })
    }
    if (type === 'token') {
      const budgetStart = Date.now()
      const BUDGET_MS = 12000
      const addressesParam = url.searchParams.get('addresses') || ''
      const addresses = addressesParam.split(',').map(s => s.trim()).filter(Boolean)
      if (addresses.length === 0) return NextResponse.json({}, { status: 200 })

      const result: Record<string, { usd: number; source: string; confidence?: number }> = {}

      // Use cache first to avoid rate limits
      const now = Date.now()
      const fresh: string[] = []
      for (const a of addresses) {
        const key = a.toLowerCase()
        const cached = tokenCache.get(key)
        if (cached) {
          const ttl = cached.source === 'cmc' ? 10 * 60 * 1000 : 5 * 60 * 1000
          if (now - cached.ts < ttl && cached.usd > 0) {
            result[key] = { usd: cached.usd, source: cached.source, confidence: cached.confidence }
            continue
          }
        }
        fresh.push(a)
      }

      if (fresh.length === 0) {
        return NextResponse.json(result, { status: 200 })
      }

      // Provider rotation strategy with adaptive cooldowns
      const providerOrder = [
        { name: 'coingecko', fn: () => coingeckoTokenBatch(fresh) },
        { name: 'cmc', fn: () => fetchFromCMC(fresh) },
        { name: 'dexscreener', fn: () => fetchFromDexscreener(fresh) }
      ]

  for (const provider of providerOrder) {
    if (inCooldown(provider.name)) {
      console.log(`⏳ Skipping ${provider.name} - in cooldown`)
      continue
    }
    if (provider.name === 'dexscreener' && dexscreenerProvider.isBlocked()) {
      console.log('⏳ Skipping dexscreener - provider blocked')
      continue
    }

        try {
          console.log(`🔄 Trying ${provider.name} for ${addresses.length} addresses`)
          const providerResult = await provider.fn()

          // Merge results, preferring higher confidence values
          Object.entries(providerResult).forEach(([addr, data]) => {
            const key = addr.toLowerCase()
            const existing = result[key]
            const newConfidence = data.confidence || 0.7

            if (!existing || (newConfidence > (existing.confidence || 0.7))) {
              result[key] = {
                usd: data.usd,
                source: data.source,
                confidence: newConfidence
              }
            }
          })

          // If we got most prices, break early
      const coverage = Object.keys(result).length / addresses.length
      if (coverage >= 0.6) {
        console.log(`✅ ${provider.name} provided ${coverage * 100}% coverage`)
        break
      }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'unknown error'
          console.error(`❌ ${provider.name} failed:`, message)
          // Adaptive cooldown based on error type
          const cooldownSeconds = typeof message === 'string' && message.includes('rate limit') ? 30 : 15
          setCooldown(provider.name, cooldownSeconds)
        }
      }

      // Fill missing with batch Dexscreener calls for remaining tokens
      const missing = fresh.filter(a => !result[a.toLowerCase()])
      if (missing.length > 0) {
        // Respect time budget to avoid long waits
        if (Date.now() - budgetStart < BUDGET_MS && !dexscreenerProvider.isBlocked()) {
          console.log(`🔍 Filling ${missing.length} missing tokens with Dexscreener batch call`)
          try {
            const dexPrices = await dexscreenerProvider.getBatchTokenPrices(missing)
            dexPrices.forEach((priceInfo, address) => {
              if (priceInfo.price > 0) {
                result[address.toLowerCase()] = {
                  usd: priceInfo.price,
                  source: 'dexscreener',
                  confidence: priceInfo.confidence
                }
              }
            })
          } catch (error) {
            console.error(`❌ Dexscreener batch failed:`, error)
          }
        } else {
          console.log('⏳ Skipping Dexscreener batch')
        }
      }

      // Final fallback - symbol-based pricing for whitelist tokens
      const stillMissing = fresh.filter(a => !result[a.toLowerCase()])
      for (const addr of stillMissing) {
        const meta = WHITELIST_MAINNET[addr.toLowerCase()]
        if (!meta) continue

        const symbol = (meta.canonicalSymbol || meta.symbol).toUpperCase()
        let filled: { usd: number; source: string } | null = null

        // Try secondary symbol providers
        if (!inCooldown('cryptocompare')) {
          try { filled = await cryptocompareSpot(symbol) } catch {}
        }
        if (!filled && !inCooldown('coinbase')) {
          try { filled = await coinbaseSpot(symbol) } catch {}
        }

        // Stablecoin fallback
        if (!filled && typeof meta.fixedUSD === 'number') {
          filled = { usd: meta.fixedUSD, source: 'fixed' }
        }

        if (filled && filled.usd > 0) {
          result[addr.toLowerCase()] = {
            usd: filled.usd,
            source: filled.source,
            confidence: 0.8
          }
        }
      }

      // Cache results (5-10 minutes based on source)
      for (const a of fresh) {
        const key = a.toLowerCase()
        const r = result[key]
        if (r && r.usd > 0) {
          tokenCache.set(key, {
            usd: r.usd,
            source: r.source,
            ts: now,
            confidence: r.confidence || 0.7
          })
        }
      }

      console.log(`📊 Token pricing complete: ${Object.keys(result).length}/${addresses.length} tokens priced`)
      return NextResponse.json(result, { status: 200 })
    }

    if (type === 'eth') {
      // Hedged race for ETH
      const tasks: Array<Promise<{ usd: number; source: string }>> = []
      if (!inCooldown('coinbase')) tasks.push(coinbaseSpot('ETH'))
      if (!inCooldown('cryptocompare')) tasks.push(cryptocompareSpot('ETH'))
      let first: { usd: number; source: string } | null = null
      try { first = await Promise.any(tasks) } catch {}
      if (first) {
        return NextResponse.json({ ethereum: { usd: first.usd, source: first.source } })
      }
      // If none succeeded, set cooldown briefly
      setCooldown('coinbase', 15); setCooldown('cryptocompare', 15)
      return NextResponse.json({ ethereum: { usd: 0, source: 'unavailable' } })
    }
    return NextResponse.json({}, { status: 400 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'proxy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
