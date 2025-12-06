import type { TokenFeatures, TokenInfo } from './scamFeatures'

export interface RulesResult {
  score: number
  reasons: string[]
  signal: 'IMMEDIATE' | 'ESCALATE' | null
  details: Record<string, unknown>
}

export async function applyRules(features: TokenFeatures, _token?: TokenInfo): Promise<RulesResult> {
  void _token;
  let score = 0
  const reasons: string[] = []
  let signal: 'IMMEDIATE' | 'ESCALATE' | null = null

  if (!features.contractVerified) {
    score += 15
    reasons.push('Unverified contract')
  }
  if (features.hasURLInName) {
    score += 25
    reasons.push('URL pattern in name')
  }
  if (features.nameLength > 30) {
    score += 15
    reasons.push('Unusually long name')
  }
  if (features.symbolWeirdChars) {
    score += 20
    reasons.push('Special characters in symbol')
  }
  if (features.recentLiquidityRemoved) {
    score += 40
    reasons.push('Recent liquidity removed')
    signal = signal || 'ESCALATE'
  }
  if (features.taxRatePct > 50) {
    score += 45
    reasons.push('Critical tax rate >50%')
    signal = 'ESCALATE'
  } else if (features.taxRatePct > 10) {
    score += 20
    reasons.push('Abnormal tax rate >10%')
  }
  if (features.infiniteSupply) {
    score += 30
    reasons.push('Infinite supply')
  }
  if (features.holderTop1Pct >= 70) {
    score += 25
    reasons.push('Top holder concentration >=70%')
  }
  if (features.externalListings === 0) {
    score += 10
    reasons.push('No external listings')
  }

  return {
    score,
    reasons,
    signal,
    details: {
      contractVerified: features.contractVerified,
      nameLength: features.nameLength,
      symbolWeirdChars: features.symbolWeirdChars,
      hasURLInName: features.hasURLInName,
      taxRatePct: features.taxRatePct,
      holderTop1Pct: features.holderTop1Pct,
      externalListings: features.externalListings
    }
  }
}
