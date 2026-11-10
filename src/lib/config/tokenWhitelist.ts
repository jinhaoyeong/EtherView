export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
  verified: boolean;
  canonicalSymbol?: string; // e.g., WETH -> ETH, WBTC -> BTC
  fixedUSD?: number; // e.g., stablecoins set to 1.0 when providers fail
  cmcRank?: number; // CoinMarketCap ranking for priority
  category?: 'stablecoin' | 'defi' | 'layer1' | 'gaming' | 'meme' | 'infrastructure' | 'exchange';
  liquidityPriority?: number; // Priority for liquidity-based pricing (higher = more liquid)
}

// Mainnet whitelist: lowercased addresses with enhanced metadata
// Contract identities verified against Uniswap's mainnet token list:
// https://github.com/Uniswap/default-token-list/blob/main/src/tokens/mainnet.json
// A recognized contract is not a guarantee of safety or a live price.
export const WHITELIST_MAINNET: Record<string, TokenMeta> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    symbol: 'USDC', name: "USDCoin", decimals: 6, verified: true, fixedUSD: 1,
    cmcRank: 6, category: 'stablecoin', liquidityPriority: 100
  },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': {
    symbol: 'USDT', name: "Tether USD", decimals: 6, verified: true, fixedUSD: 1,
    cmcRank: 3, category: 'stablecoin', liquidityPriority: 95
  },
  '0x6b175474e89094c44da98b954eedeac495271d0f': {
    symbol: 'DAI', name: "Dai Stablecoin", decimals: 18, verified: true, fixedUSD: 1,
    cmcRank: 22, category: 'stablecoin', liquidityPriority: 85
  },
  '0x853d955acef822db058eb8505911ed77f175b99e': {
    symbol: 'FRAX', name: "Frax", decimals: 18, verified: true, fixedUSD: 1,
    cmcRank: 75, category: 'stablecoin', liquidityPriority: 70
  },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
    symbol: 'WETH', name: "Wrapped Ether", decimals: 18, verified: true, canonicalSymbol: 'ETH',
    cmcRank: 2, category: 'layer1', liquidityPriority: 100
  },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': {
    symbol: 'WBTC', name: "Wrapped BTC", decimals: 8, verified: true, canonicalSymbol: 'BTC',
    cmcRank: 1, category: 'layer1', liquidityPriority: 98
  },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': {
    symbol: 'MATIC', name: "Polygon", decimals: 18, verified: true,
    cmcRank: 15, category: 'layer1', liquidityPriority: 85
  },
  '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1': {
    symbol: 'ARB', name: "Arbitrum", decimals: 18, verified: true,
    cmcRank: 39, category: 'layer1', liquidityPriority: 80
  },
  '0x514910771af9ca656af840dff83e8264ecf986ca': {
    symbol: 'LINK', name: "ChainLink Token", decimals: 18, verified: true,
    cmcRank: 13, category: 'infrastructure', liquidityPriority: 85
  },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': {
    symbol: 'UNI', name: "Uniswap", decimals: 18, verified: true,
    cmcRank: 17, category: 'exchange', liquidityPriority: 80
  },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {
    symbol: 'AAVE', name: "Aave", decimals: 18, verified: true,
    cmcRank: 32, category: 'defi', liquidityPriority: 75
  },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': {
    symbol: 'MKR', name: "Maker", decimals: 18, verified: true,
    cmcRank: 51, category: 'defi', liquidityPriority: 70
  },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': {
    symbol: 'COMP', name: "Compound", decimals: 18, verified: true,
    cmcRank: 66, category: 'defi', liquidityPriority: 65
  },
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': {
    symbol: 'LDO', name: "Lido DAO", decimals: 18, verified: true,
    cmcRank: 28, category: 'defi', liquidityPriority: 75
  },
  '0xd533a949740bb3306d119cc777fa900ba034cd52': {
    symbol: 'CRV', name: "Curve DAO Token", decimals: 18, verified: true,
    cmcRank: 82, category: 'defi', liquidityPriority: 70
  },
  '0xba100000625a3754423978a60c9317c58a424e3d': {
    symbol: 'BAL', name: "Balancer", decimals: 18, verified: true,
    cmcRank: 156, category: 'exchange', liquidityPriority: 60
  },
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': {
    symbol: 'YFI', name: "yearn finance", decimals: 18, verified: true,
    cmcRank: 103, category: 'defi', liquidityPriority: 65
  },
  '0x111111111117dc0aa78b770fa6a738034120c302': {
    symbol: '1INCH', name: "1inch", decimals: 18, verified: true,
    cmcRank: 95, category: 'exchange', liquidityPriority: 60
  },
  '0x3845badade8e6dff049820680d1f14bd3903a5d0': {
    symbol: 'SAND', name: "The Sandbox", decimals: 18, verified: true,
    cmcRank: 45, category: 'gaming', liquidityPriority: 50
  },
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': {
    symbol: 'MANA', name: "Decentraland", decimals: 18, verified: true,
    cmcRank: 40, category: 'gaming', liquidityPriority: 50
  },
  '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b': {
    symbol: 'AXS', name: "Axie Infinity", decimals: 18, verified: true,
    cmcRank: 48, category: 'gaming', liquidityPriority: 45
  },
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef': {
    symbol: 'BAT', name: "Basic Attention Token", decimals: 18, verified: true,
    cmcRank: 88, category: 'infrastructure', liquidityPriority: 55
  },
  '0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206': {
    symbol: 'NEXO', name: "Nexo", decimals: 18, verified: true,
    cmcRank: 58, category: 'defi', liquidityPriority: 50
  },
  '0x45804880de22913dafe09f4980848ece6ecbaf78': {
    symbol: 'PAXG', name: "PAX Gold", decimals: 18, verified: true,
    cmcRank: 71, category: 'stablecoin', liquidityPriority: 40
  },
  '0x18084fba666a33d37592fa2633fd49a74dd93a88': {
    symbol: 'tBTC', name: "tBTC", decimals: 18, verified: true,
    cmcRank: 247, category: 'layer1', liquidityPriority: 30
  }
};

export function isWhitelisted(address: string, chainId: number = 1): boolean {
  if (!address) return false;
  const addr = address.toLowerCase();
  if (chainId === 1) return !!WHITELIST_MAINNET[addr];
  return false;
}

export function getWhitelistMeta(address: string, chainId: number = 1): TokenMeta | null {
  const addr = (address || '').toLowerCase();
  if (chainId === 1) return WHITELIST_MAINNET[addr] || null;
  return null;
}

export function getWhitelistAddresses(chainId: number = 1): string[] {
  if (chainId === 1) return Object.keys(WHITELIST_MAINNET);
  return [];
}

export function getTopSymbols(limit: number = 100): string[] {
  const seen = new Set<string>()
  const symbols: string[] = []

  // Sort by CMC rank first, then by liquidity priority
  const sortedEntries = Object.entries(WHITELIST_MAINNET).sort(([, a], [, b]) => {
    // Priority: CMC rank (lower is better), then liquidity priority (higher is better)
    const aRank = a.cmcRank || 999999
    const bRank = b.cmcRank || 999999
    const aLiquidity = a.liquidityPriority || 0
    const bLiquidity = b.liquidityPriority || 0

    if (aRank !== bRank) return aRank - bRank
    return bLiquidity - aLiquidity
  })

  for (const [, meta] of sortedEntries) {
    const sym = (meta.canonicalSymbol || meta.symbol || '').toUpperCase()
    if (!sym || seen.has(sym)) continue

    seen.add(sym)
    symbols.push(sym)
    if (symbols.length >= limit) break
  }

  return symbols
}

export function getTokensByCategory(category: TokenMeta['category']): string[] {
  const symbols: string[] = []
  for (const [, meta] of Object.entries(WHITELIST_MAINNET)) {
    if (meta.category === category) {
      const sym = (meta.canonicalSymbol || meta.symbol || '').toUpperCase()
      if (sym && !symbols.includes(sym)) {
        symbols.push(sym)
      }
    }
  }
  return symbols.sort()
}

export function getHighLiquidityTokens(minPriority: number = 70): string[] {
  const symbols: string[] = []
  for (const [, meta] of Object.entries(WHITELIST_MAINNET)) {
    if ((meta.liquidityPriority || 0) >= minPriority) {
      const sym = (meta.canonicalSymbol || meta.symbol || '').toUpperCase()
      if (sym && !symbols.includes(sym)) {
        symbols.push(sym)
      }
    }
  }
  return symbols.sort((a, b) => {
    const aMeta = Object.values(WHITELIST_MAINNET).find(
      m => (m.canonicalSymbol || m.symbol || '').toUpperCase() === a
    )
    const bMeta = Object.values(WHITELIST_MAINNET).find(
      m => (m.canonicalSymbol || m.symbol || '').toUpperCase() === b
    )
    return (bMeta?.liquidityPriority || 0) - (aMeta?.liquidityPriority || 0)
  })
}

export function getStablecoinAddresses(): string[] {
  const addresses: string[] = []
  for (const [address, meta] of Object.entries(WHITELIST_MAINNET)) {
    if (meta.category === 'stablecoin') {
      addresses.push(address)
    }
  }
  return addresses
}

export function getCanonicalSymbol(address: string): string | null {
  const meta = getWhitelistMeta(address)
  if (!meta) return null
  return (meta.canonicalSymbol || meta.symbol).toUpperCase()
}

export function getLiquidityPriority(address: string): number {
  const meta = getWhitelistMeta(address)
  return meta?.liquidityPriority || 0
}
