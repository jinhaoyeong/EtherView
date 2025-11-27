import type { TokenInfo } from './scamFeatures'

export interface HoneypotSimulationResult {
  canSell: boolean
  revertReason: string | null
  priceImpactPct: number
  slippagePct: number
  gasUsed: number
}

export async function simulateHoneypot(token: TokenInfo, ctx?: unknown): Promise<HoneypotSimulationResult> {
  return {
    canSell: true,
    revertReason: null,
    priceImpactPct: 5,
    slippagePct: 3,
    gasUsed: 120000
  }
}