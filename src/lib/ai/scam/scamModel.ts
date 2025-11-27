import type { TokenFeatures } from './scamFeatures'

export interface MLPrediction {
  probability: number
  confidence: number
  contributions: Array<{ feature: string; importance: number }>
}

export class ScamMLModel {
  async predictScamProbability(input: TokenFeatures & { rulesScore?: number }): Promise<MLPrediction> {
    const base = (input.rulesScore ?? 0) / 100
    const urlBoost = input.hasURLInName ? 0.2 : 0
    const verifyPenalty = input.contractVerified ? -0.1 : 0
    const holderBoost = input.holderTop1Pct >= 70 ? 0.15 : 0
    let prob = Math.min(1, Math.max(0, base + urlBoost + holderBoost + (input.taxRatePct > 10 ? 0.1 : 0) + (verifyPenalty)))
    const confidence = Math.min(95, Math.max(50, 70 + (input.externalListings > 0 ? 5 : -5)))
    return {
      probability: prob,
      confidence,
      contributions: [
        { feature: 'rules', importance: 0.6 },
        { feature: 'urlInName', importance: input.hasURLInName ? 0.2 : 0 },
        { feature: 'holderTop1', importance: input.holderTop1Pct >= 70 ? 0.15 : 0 },
        { feature: 'verification', importance: input.contractVerified ? -0.1 : 0 }
      ]
    }
  }
}