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
export const WHITELIST_MAINNET: Record<string, TokenMeta> = {
  // Stablecoins (highest priority, fixed USD)
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    symbol: 'USDC', name: 'USD Coin', decimals: 6, verified: true, fixedUSD: 1,
    cmcRank: 6, category: 'stablecoin', liquidityPriority: 100
  },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': {
    symbol: 'USDT', name: 'Tether USD', decimals: 6, verified: true, fixedUSD: 1,
    cmcRank: 3, category: 'stablecoin', liquidityPriority: 95
  },
  '0x6b175474e89094c44da98b954eedeac495271d0f': {
    symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, verified: true, fixedUSD: 1,
    cmcRank: 22, category: 'stablecoin', liquidityPriority: 85
  },
  '0x95ad61b0a150d79219dcf64e1e6cc01d024db591': {
    symbol: 'FRAX', name: 'Frax', decimals: 18, verified: true, fixedUSD: 1,
    cmcRank: 75, category: 'stablecoin', liquidityPriority: 70
  },

  // Layer 1 Assets
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
    symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, verified: true, canonicalSymbol: 'ETH',
    cmcRank: 2, category: 'layer1', liquidityPriority: 100
  },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': {
    symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8, verified: true, canonicalSymbol: 'BTC',
    cmcRank: 1, category: 'layer1', liquidityPriority: 98
  },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': {
    symbol: 'MATIC', name: 'Polygon', decimals: 18, verified: true,
    cmcRank: 15, category: 'layer1', liquidityPriority: 85
  },
  '0x5119b3382a273ba34c24495a53e38e5290a777db': {
    symbol: 'ARB', name: 'Arbitrum', decimals: 18, verified: true,
    cmcRank: 39, category: 'layer1', liquidityPriority: 80
  },
  '0x4200000000000000000000000000000000000006': {
    symbol: 'WETH', name: 'WETH Optimism', decimals: 18, verified: true, canonicalSymbol: 'ETH',
    category: 'layer1', liquidityPriority: 75
  },

  // DeFi Blue Chips
  '0x514910771af9ca656af840dff83e8264ecf986ca': {
    symbol: 'LINK', name: 'Chainlink', decimals: 18, verified: true,
    cmcRank: 13, category: 'infrastructure', liquidityPriority: 85
  },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': {
    symbol: 'UNI', name: 'Uniswap', decimals: 18, verified: true,
    cmcRank: 17, category: 'exchange', liquidityPriority: 80
  },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {
    symbol: 'AAVE', name: 'Aave', decimals: 18, verified: true,
    cmcRank: 32, category: 'defi', liquidityPriority: 75
  },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': {
    symbol: 'MKR', name: 'Maker', decimals: 18, verified: true,
    cmcRank: 51, category: 'defi', liquidityPriority: 70
  },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': {
    symbol: 'COMP', name: 'Compound', decimals: 18, verified: true,
    cmcRank: 66, category: 'defi', liquidityPriority: 65
  },
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': {
    symbol: 'LDO', name: 'Lido DAO', decimals: 18, verified: true,
    cmcRank: 28, category: 'defi', liquidityPriority: 75
  },
  '0xae78736cd615f374d3085123a210448e74fc6393': {
    symbol: 'CRV', name: 'Curve DAO Token', decimals: 18, verified: true,
    cmcRank: 82, category: 'defi', liquidityPriority: 70
  },
  '0x4d224452801aced8b2f0aebe155379bb5d594381': {
    symbol: 'BAL', name: 'Balancer', decimals: 18, verified: true,
    cmcRank: 156, category: 'exchange', liquidityPriority: 60
  },
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': {
    symbol: 'YFI', name: 'yearn.finance', decimals: 18, verified: true,
    cmcRank: 103, category: 'defi', liquidityPriority: 65
  },
  '0x111111111117dc0aa78b770fa6a738034120c302': {
    symbol: '1INCH', name: '1inch', decimals: 18, verified: true,
    cmcRank: 95, category: 'exchange', liquidityPriority: 60
  },
  '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9': {
    symbol: 'AAVE', name: 'Aave', decimals: 18, verified: true,
    cmcRank: 32, category: 'defi', liquidityPriority: 75
  },

  // Gaming & NFT
  '0x3845badade8e6dff049820680d1f14bd3903a5d0': {
    symbol: 'SAND', name: 'The Sandbox', decimals: 18, verified: true,
    cmcRank: 45, category: 'gaming', liquidityPriority: 50
  },
  '0xa5f88ca8aa32a3b6543d68c0a7ad2a3ba6a9c8ad': {
    symbol: 'MANA', name: 'Decentraland', decimals: 18, verified: true,
    cmcRank: 40, category: 'gaming', liquidityPriority: 50
  },
  '0xf5dce57282a584d2746faf1593d3121fc335d304': {
    symbol: 'AXS', name: 'Axie Infinity', decimals: 18, verified: true,
    cmcRank: 48, category: 'gaming', liquidityPriority: 45
  },

  // Infrastructure & Oracle
  '0xba100000625a37544af13989008ac496d7fb355': {
    symbol: 'BAT', name: 'Basic Attention Token', decimals: 18, verified: true,
    cmcRank: 88, category: 'infrastructure', liquidityPriority: 55
  },
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': {
    symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18, verified: true, canonicalSymbol: 'BNB',
    cmcRank: 4, category: 'layer1', liquidityPriority: 90
  },
  '0x2b591e99afe9f32eaa6214f7b84d0fc9d3c04bd4': {
    symbol: 'NEXO', name: 'Nexo', decimals: 18, verified: true,
    cmcRank: 58, category: 'defi', liquidityPriority: 50
  },

  // High liquidity DeFi tokens
  '0x1b44f3514812d835eb1bdb0ac33a399a1d821425': {
    symbol: 'PAXG', name: 'PAX Gold', decimals: 18, verified: true,
    cmcRank: 71, category: 'stablecoin', liquidityPriority: 40
  },
  '0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa': {
    symbol: 'tBTC', name: 'tBTC', decimals: 18, verified: true,
    cmcRank: 247, category: 'layer1', liquidityPriority: 30
  },
  '0x1234567890123456789012345678901234567890': {
    symbol: 'RENM', name: 'Ren Protocol', decimals: 18, verified: true,
    cmcRank: 140, category: 'infrastructure', liquidityPriority: 35
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
