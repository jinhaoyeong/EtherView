import type { TokenInfo } from './scamFeatures'

export interface HoneypotSimulationResult {
  status: 'unavailable'
  canSell: boolean | null
  revertReason: string | null
  priceImpactPct: number | null
  slippagePct: number | null
  gasUsed: number | null
}

export async function simulateHoneypot(_token: TokenInfo, _ctx?: unknown): Promise<HoneypotSimulationResult> {
  void _token;
  void _ctx;
  // There is no execution/simulation provider configured. Unknown is not proof of sellability.
  return {
    status: 'unavailable',
    canSell: null,
    revertReason: null,
    priceImpactPct: null,
    slippagePct: null,
    gasUsed: null
  }
}
