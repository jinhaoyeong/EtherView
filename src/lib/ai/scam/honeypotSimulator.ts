import type { TokenInfo } from './scamFeatures'

export interface HoneypotSimulationResult {
  canSell: boolean
  revertReason: string | null
  priceImpactPct: number
  slippagePct: number
  gasUsed: number
}

export async function simulateHoneypot(_token: TokenInfo, _ctx?: unknown): Promise<HoneypotSimulationResult> {
  void _token;
  void _ctx;
  return {
    canSell: true,
    revertReason: null,
    priceImpactPct: 5,
    slippagePct: 3,
    gasUsed: 120000
  }
}
