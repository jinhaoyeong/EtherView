type ProviderKey =
  | 'dexscreener'
  | 'cmc'
  | 'honeypotis'
  | 'chainabuse'
  | 'coingecko'
  | 'cryptocompare'
  | 'coinbase'
  | 'etherscan'
  | 'tenderly'
  | 'moralis'

interface ProviderConfig {
  maxRequestsPerMinute: number
  maxRequestsPerHour?: number
  baseCooldownSeconds: number
  rateLimitCooldownSeconds: number
  errorMultiplier: number
  backoffMultiplier: number
}

interface ProviderStats {
  requestsThisMinute: number
  requestsThisHour: number
  lastRequestTime: number
  consecutiveErrors: number
  totalRequests: number
  successfulRequests: number
}

const PROVIDER_CONFIGS: Record<ProviderKey, ProviderConfig> = {
  dexscreener: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    baseCooldownSeconds: 0,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 2
  },
  cmc: {
    maxRequestsPerMinute: 30,
    maxRequestsPerHour: 500,
    baseCooldownSeconds: 0,
    rateLimitCooldownSeconds: 120,
    errorMultiplier: 2,
    backoffMultiplier: 2
  },
  honeypotis: {
    maxRequestsPerMinute: 20,
    baseCooldownSeconds: 5,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 1.5
  },
  chainabuse: {
    maxRequestsPerMinute: 15,
    baseCooldownSeconds: 2,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 1.5
  },
  coingecko: {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 1000,
    baseCooldownSeconds: 1,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 2
  },
  cryptocompare: {
    maxRequestsPerMinute: 100,
    baseCooldownSeconds: 1,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 2
  },
  coinbase: {
    maxRequestsPerMinute: 100,
    baseCooldownSeconds: 1,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 2
  },
  etherscan: {
    maxRequestsPerSecond: 5,
    maxRequestsPerMinute: 200,
    baseCooldownSeconds: 0,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 2,
    backoffMultiplier: 2
  },
  tenderly: {
    maxRequestsPerMinute: 120,
    baseCooldownSeconds: 0,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 2
  },
  moralis: {
    maxRequestsPerMinute: 100,
    baseCooldownSeconds: 0,
    rateLimitCooldownSeconds: 60,
    errorMultiplier: 1.5,
    backoffMultiplier: 2
  }
}

const cooldowns: Record<ProviderKey, number> = {}
const stats: Record<ProviderKey, ProviderStats> = {} as any

// Initialize cooldowns and stats
Object.keys(PROVIDER_CONFIGS).forEach(key => {
  const provider = key as ProviderKey
  cooldowns[provider] = 0
  stats[provider] = {
    requestsThisMinute: 0,
    requestsThisHour: 0,
    lastRequestTime: 0,
    consecutiveErrors: 0,
    totalRequests: 0,
    successfulRequests: 0
  }
})

// Reset counters when time windows pass
function updateRateLimitCounters(provider: ProviderKey) {
  const now = Date.now()
  const stat = stats[provider]

  // Reset minute counter if needed
  if (now - stat.lastRequestTime > 60000) {
    stat.requestsThisMinute = 0
  }

  // Reset hour counter if needed
  if (now - stat.lastRequestTime > 3600000) {
    stat.requestsThisHour = 0
  }

  stat.lastRequestTime = now
}

function inCooldown(provider: ProviderKey): boolean {
  return Date.now() < cooldowns[provider]
}

function calculateAdaptiveCooldown(provider: ProviderKey, baseSeconds: number, errorType: 'rate_limit' | 'server_error' | 'timeout' | 'network_error'): number {
  const config = PROVIDER_CONFIGS[provider]
  const stat = stats[provider]
  let cooldown = baseSeconds

  // Apply error multiplier based on consecutive errors
  if (stat.consecutiveErrors > 1) {
    cooldown *= Math.pow(config.backoffMultiplier, stat.consecutiveErrors - 1)
  }

  // Apply error-specific multipliers
  switch (errorType) {
    case 'rate_limit':
      cooldown = config.rateLimitCooldownSeconds
      break
    case 'server_error':
      cooldown *= config.errorMultiplier
      break
    case 'timeout':
      cooldown *= 1.5
      break
    case 'network_error':
      cooldown *= 1.2
      break
  }

  return Math.min(cooldown, 300) // Cap at 5 minutes
}

function setCooldown(provider: ProviderKey, seconds: number, errorType?: 'rate_limit' | 'server_error' | 'timeout' | 'network_error'): void {
  const adaptiveSeconds = errorType
    ? calculateAdaptiveCooldown(provider, seconds, errorType)
    : seconds

  cooldowns[provider] = Date.now() + adaptiveSeconds * 1000

  if (errorType) {
    stats[provider].consecutiveErrors++
  }
}

function clearCooldown(provider: ProviderKey): void {
  cooldowns[provider] = 0
  stats[provider].consecutiveErrors = 0
}

function canMakeRequest(provider: ProviderKey): boolean {
  if (inCooldown(provider)) return false

  const config = PROVIDER_CONFIGS[provider]
  const stat = stats[provider]

  updateRateLimitCounters(provider)

  // Check rate limits
  const perSecondLimit = (provider as any) === 'etherscan' ? 5 : Infinity
  if (perSecondLimit !== Infinity && Date.now() - stat.lastRequestTime < 1000 / perSecondLimit) {
    return false
  }

  if (stat.requestsThisMinute >= config.maxRequestsPerMinute) {
    return false
  }

  if (config.maxRequestsPerHour && stat.requestsThisHour >= config.maxRequestsPerHour) {
    return false
  }

  return true
}

async function fetchJSON(url: string, options: RequestInit & {
  timeoutMs?: number;
  provider?: ProviderKey;
  skipCooldown?: boolean;
  priority?: 'high' | 'normal' | 'low';
} = {}) {
  const { timeoutMs = 6000, provider, skipCooldown = false, priority = 'normal' } = options

  if (provider && !skipCooldown) {
    // Wait for cooldown if we can't make the request yet
    let attempts = 0
    const maxAttempts = priority === 'high' ? 3 : 1

    while (!canMakeRequest(provider) && attempts < maxAttempts) {
      const waitTime = Math.max(0, cooldowns[provider] - Date.now())
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 1000)))
      }
      attempts++
    }

    if (!canMakeRequest(provider)) {
      throw new Error(`${provider} rate limited or in cooldown`)
    }

    // Update counters
    stats[provider].requestsThisMinute++
    stats[provider].requestsThisHour++
    stats[provider].totalRequests++
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'EtherView/1.0',
    ...(options.headers as Record<string, string> || {})
  }

  const signal = AbortSignal.timeout(timeoutMs)
  let res: Response | null = null
  let errorType: 'rate_limit' | 'server_error' | 'timeout' | 'network_error' | undefined

  try {
    res = await fetch(url, { ...options, headers, signal })
  } catch (e: any) {
    if (provider && !skipCooldown) {
      if (e.name === 'AbortError') {
        errorType = 'timeout'
      } else {
        errorType = 'network_error'
      }
      setCooldown(provider, PROVIDER_CONFIGS[provider].baseCooldownSeconds || 30, errorType)
    }
    throw e
  }

  if (!res.ok) {
    if (provider && !skipCooldown) {
      if (res.status === 429) {
        errorType = 'rate_limit'
      } else if (res.status >= 500) {
        errorType = 'server_error'
      }
      setCooldown(provider, PROVIDER_CONFIGS[provider].baseCooldownSeconds || 30, errorType)
    }
    throw new Error(`${provider || 'fetch'} ${res.status}`)
  }

  // Success - clear consecutive errors
  if (provider && !skipCooldown) {
    stats[provider].consecutiveErrors = 0
    stats[provider].successfulRequests++
  }

  return res.json()
}

export async function fetchDexscreenerToken(address: string) {
  try {
    const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { provider: 'dexscreener', timeoutMs: 6000 })
    const pairs = Array.isArray(data?.pairs) ? data.pairs : []
    if (pairs.length === 0) return null
    const best = pairs.reduce((a: any, b: any) => (Number(a?.liquidity?.usd || 0) > Number(b?.liquidity?.usd || 0) ? a : b))
    const price = Number(best?.priceUsd || 0)
    const liqUSD = Number(best?.liquidity?.usd || 0)
    const ageSeconds = Number(best?.age?.seconds || 0)
    const pairAgeDays = ageSeconds > 0 ? ageSeconds / 86400 : 0
    const lpLocked = Boolean(best?.liquidity?.locked)
    if (price > 0) {
      return {
        usd: price,
        liquidityUSD: liqUSD,
        pairAgeDays,
        lpLocked,
        source: 'dexscreener',
        confidence: liqUSD > 10000 ? 0.8 : 0.6
      }
    }
    return null
  } catch {
    return null
  }
}

// Batch version for multiple tokens
export async function fetchDexscreenerBatch(addresses: string[]) {
  if (addresses.length === 0) return {}
  try {
    const data = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${addresses.join(',')}`, { provider: 'dexscreener', timeoutMs: 8000 })
    const pairs = Array.isArray(data?.pairs) ? data.pairs : []
    const result: Record<string, any> = {}

    // Group pairs by token address and find best pair for each
    const tokenPairs: Record<string, any[]> = {}
    pairs.forEach((pair: any) => {
      const baseToken = pair?.baseToken?.address?.toLowerCase()
      const quoteToken = pair?.quoteToken?.address?.toLowerCase()

      if (baseToken && addresses.includes(baseToken)) {
        if (!tokenPairs[baseToken]) tokenPairs[baseToken] = []
        tokenPairs[baseToken].push(pair)
      }
      if (quoteToken && addresses.includes(quoteToken)) {
        if (!tokenPairs[quoteToken]) tokenPairs[quoteToken] = []
        tokenPairs[quoteToken].push(pair)
      }
    })

    // Find best pair for each token
    Object.entries(tokenPairs).forEach(([address, tokenPairList]) => {
      if (tokenPairList.length > 0) {
        const best = tokenPairList.reduce((a: any, b: any) =>
          (Number(a?.liquidity?.usd || 0) > Number(b?.liquidity?.usd || 0) ? a : b)
        )
        const price = Number(best?.priceUsd || 0)
        const liqUSD = Number(best?.liquidity?.usd || 0)
        const ageSeconds = Number(best?.age?.seconds || 0)
        const pairAgeDays = ageSeconds > 0 ? ageSeconds / 86400 : 0
        const lpLocked = Boolean(best?.liquidity?.locked)

        if (price > 0) {
          result[address] = {
            usd: price,
            liquidityUSD: liqUSD,
            pairAgeDays,
            lpLocked,
            source: 'dexscreener',
            confidence: liqUSD > 10000 ? 0.8 : 0.6
          }
        }
      }
    })

    return result
  } catch {
    return {}
  }
}

export async function fetchCMCQuotes(symbols: string[]) {
  const key = process.env.COINMARKETCAP_API_KEY || ''
  if (!key || symbols.length === 0) return {}
  try {
    const data = await fetchJSON(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(symbols.join(','))}`,
      { provider: 'cmc', timeoutMs: 6000, headers: { 'X-CMC_PRO_API_KEY': key } }
    )
    const quotes = data?.data || {}
    const out: Record<string, { usd: number; source: string; confidence: number }> = {}
    for (const sym of symbols) {
      const entry = quotes?.[sym]
      const usd = entry?.quote?.USD?.price
      if (typeof usd === 'number' && usd > 0) out[sym.toUpperCase()] = { usd, source: 'cmc', confidence: 0.95 }
    }
    return out
  } catch {
    return {}
  }
}

// Get CMC map for token metadata
export async function fetchCMCMap(limit: number = 5000) {
  const key = process.env.COINMARKETCAP_API_KEY || ''
  if (!key) return {}
  try {
    const data = await fetchJSON(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?limit=${limit}`,
      { provider: 'cmc', timeoutMs: 8000, headers: { 'X-CMC_PRO_API_KEY': key } }
    )
    return data?.data || []
  } catch {
    return []
  }
}

// CryptoCompare batch price lookup
export async function fetchCryptoCompareSymbols(symbols: string[]) {
  const key = process.env.CRYPTOCOMPARE_API_KEY
  if (symbols.length === 0) return {}
  try {
    const url = `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${encodeURIComponent(symbols.join(','))}&tsyms=USD`
    const headers: Record<string, string> = { 'Accept': 'application/json' }
    if (key) headers['authorization'] = `Apikey ${key}`

    const data = await fetchJSON(url, { provider: 'cryptocompare', timeoutMs: 6000, headers })
    const result: Record<string, { usd: number; source: string; confidence: number }> = {}

    Object.entries(data).forEach(([symbol, prices]: [string, any]) => {
      const usd = prices?.USD
      if (typeof usd === 'number' && usd > 0) {
        result[symbol.toUpperCase()] = { usd, source: 'cryptocompare', confidence: 0.85 }
      }
    })

    return result
  } catch {
    return {}
  }
}

// Coinbase price lookup
export async function fetchCoinbasePrice(symbol: string) {
  try {
    const data = await fetchJSON(
      `https://api.coinbase.com/v2/prices/${symbol}-USD/spot`,
      { provider: 'coinbase', timeoutMs: 5000 }
    )
    const amount = parseFloat(data?.data?.amount)
    if (!isNaN(amount) && amount > 0) {
      return { usd: amount, source: 'coinbase', confidence: 0.85 }
    }
    throw new Error('Invalid price data')
  } catch {
    return null
  }
}

// CoinGecko token batch lookup
export async function fetchCoinGeckoTokenBatch(addresses: string[]) {
  if (addresses.length === 0) return {}
  try {
    const data = await fetchJSON(
      `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${addresses.join(',')}&vs_currencies=usd`,
      { provider: 'coingecko', timeoutMs: 6000 }
    )
    const result: Record<string, { usd: number; source: string; confidence: number }> = {}

    Object.entries(data).forEach(([address, priceData]: [string, any]) => {
      const usd = priceData?.usd
      if (typeof usd === 'number' && usd > 0) {
        result[address.toLowerCase()] = { usd, source: 'coingecko', confidence: 0.8 }
      }
    })

    return result
  } catch {
    return {}
  }
}

// Etherscan contract source verification
export async function fetchEtherscanContract(address: string) {
  const apiKey = process.env.ETHERSCAN_API_KEY
  if (!apiKey) return null

  try {
    const data = await fetchJSON(
      `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`,
      { provider: 'etherscan', timeoutMs: 8000 }
    )

    const result = data?.result?.[0]
    if (result && result.ABI !== 'Contract source code not verified') {
      return {
        verified: Boolean(parseInt(result.IsVerified || '0')),
        sourceCode: result.SourceCode,
        abi: result.ABI,
        contractName: result.ContractName,
        compilerVersion: result.CompilerVersion,
        optimizationUsed: Boolean(parseInt(result.OptimizationUsed || '0')),
        runs: parseInt(result.Runs || '0')
      }
    }

    return { verified: false }
  } catch {
    return { verified: false }
  }
}

// Etherscan token info
export async function fetchEtherscanTokenInfo(address: string) {
  const apiKey = process.env.ETHERSCAN_API_KEY
  if (!apiKey) return null

  try {
    const data = await fetchJSON(
      `https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=${address}&apikey=${apiKey}`,
      { provider: 'etherscan', timeoutMs: 6000 }
    )

    const result = data?.result
    if (result && result.contractAddress) {
      return {
        symbol: result.symbol,
        name: result.tokenName,
        decimals: parseInt(result.divisible || '0'),
        totalSupply: result.totalSupply,
        contractAddress: result.contractAddress
      }
    }

    return null
  } catch {
    return null
  }
}

// Enhanced Honeypot.is check with rate limit awareness
export async function checkHoneypotIs(address: string) {
  try {
    const data = await fetchJSON(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}`,
      { provider: 'honeypotis', timeoutMs: 10000, priority: 'high' }
    )
    return data
  } catch {
    return null
  }
}

// Enhanced Chainabuse check
export async function checkChainabuse(address: string) {
  try {
    const data = await fetchJSON(
      `https://api.chainabuse.com/v1/address/${address}`,
      { provider: 'chainabuse', timeoutMs: 8000 }
    )
    return data
  } catch {
    return null
  }
}

// Utility functions for provider management
export function getProviderCooldowns() {
  const result: Record<string, { cooldownUntil: number; inCooldown: boolean; stats: ProviderStats }> = {}
  Object.keys(cooldowns).forEach(key => {
    const provider = key as ProviderKey
    result[provider] = {
      cooldownUntil: cooldowns[provider],
      inCooldown: Date.now() < cooldowns[provider],
      stats: stats[provider]
    }
  })
  return result
}

export function getProviderStats() {
  return { ...stats }
}

export function resetProviderStats(provider?: ProviderKey) {
  if (provider) {
    clearCooldown(provider)
    stats[provider] = {
      requestsThisMinute: 0,
      requestsThisHour: 0,
      lastRequestTime: 0,
      consecutiveErrors: 0,
      totalRequests: 0,
      successfulRequests: 0
    }
  } else {
    // Reset all providers
    Object.keys(stats).forEach(key => {
      const providerKey = key as ProviderKey
      clearCooldown(providerKey)
      stats[providerKey] = {
        requestsThisMinute: 0,
        requestsThisHour: 0,
        lastRequestTime: 0,
        consecutiveErrors: 0,
        totalRequests: 0,
        successfulRequests: 0
      }
    })
  }
}

export function getProviderHealth(): Record<string, {
  status: 'healthy' | 'degraded' | 'critical';
  successRate: number;
  avgResponseTime?: number;
  nextAvailable?: number;
}> {
  const health: Record<string, any> = {}

  Object.entries(stats).forEach(([key, stat]) => {
    const successRate = stat.totalRequests > 0 ? stat.successfulRequests / stat.totalRequests : 1
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'

    if (stat.consecutiveErrors > 3) {
      status = 'critical'
    } else if (stat.consecutiveErrors > 1 || successRate < 0.8) {
      status = 'degraded'
    }

    health[key] = {
      status,
      successRate,
      nextAvailable: inCooldown(key as ProviderKey) ? cooldowns[key] : undefined
    }
  })

  return health
}

// Provider priority for rotation strategies
export function getProviderPriority(): ProviderKey[] {
  const availableProviders = Object.keys(stats).filter(provider => !inCooldown(provider as ProviderKey)) as ProviderKey[]

  // Sort by success rate and error count
  return availableProviders.sort((a, b) => {
    const aStats = stats[a]
    const bStats = stats[b]
    const aSuccessRate = aStats.totalRequests > 0 ? aStats.successfulRequests / aStats.totalRequests : 1
    const bSuccessRate = bStats.totalRequests > 0 ? bStats.successfulRequests / bStats.totalRequests : 1

    // Prefer providers with higher success rates and fewer consecutive errors
    const aScore = aSuccessRate - (aStats.consecutiveErrors * 0.1)
    const bScore = bSuccessRate - (bStats.consecutiveErrors * 0.1)

    return bScore - aScore
  })
}

// Function to wait for provider availability
export async function waitForProvider(provider: ProviderKey, maxWaitMs: number = 30000): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    if (!inCooldown(provider)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return false
}

