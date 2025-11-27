export interface TokenInfo {
  address: string
  symbol: string
  name?: string
  decimals?: number
  verified?: boolean
  valueUSD?: number
  balance?: string
}

export interface TokenFeatures {
  contractVerified: boolean
  nameLength: number
  symbolWeirdChars: boolean
  hasURLInName: boolean
  holderTop1Pct: number
  holderTop5Pct: number
  totalHolders: number
  liquidityUSD: number
  recentLiquidityRemoved: boolean
  ageDays: number
  taxRatePct: number
  dynamicTax: boolean
  txVolume24h: number
  buySellRatio: number
  largeTransferCount: number
  infiniteSupply: boolean
  supplyMintEvents: number
  externalListings: number
  communityReports: number
}

export async function extractFeatures(token: TokenInfo, userAddress?: string): Promise<TokenFeatures> {
  const name = (token.name || '').toLowerCase()
  const symbol = (token.symbol || '')
  const hasURL = /https?:\/\/|www\.|\.(com|org|net|io|app|xyz|finance|tech|crypto)\b/i.test(name)
  const weird = /[^a-zA-Z0-9\s]/.test(symbol)
  return {
    contractVerified: token.verified === true,
    nameLength: name.length,
    symbolWeirdChars: weird,
    hasURLInName: hasURL,
    holderTop1Pct: 0,
    holderTop5Pct: 0,
    totalHolders: 0,
    liquidityUSD: 0,
    recentLiquidityRemoved: false,
    ageDays: 0,
    taxRatePct: 0,
    dynamicTax: false,
    txVolume24h: 0,
    buySellRatio: 1,
    largeTransferCount: 0,
    infiniteSupply: false,
    supplyMintEvents: 0,
    externalListings: token.valueUSD && token.valueUSD > 0 ? 1 : 0,
    communityReports: 0
  }
}