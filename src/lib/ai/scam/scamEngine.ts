import { extractFeatures, TokenInfo } from './scamFeatures'
import { applyRules } from './scamRules'
import { simulateHoneypot } from './honeypotSimulator'
import { ScamMLModel } from './scamModel'

export interface ScamDetectionResult {
  tokenAddress: string
  symbol: string
  riskLevel: 'low' | 'medium' | 'high'
  score: number
  confidencePct: number
  reasons: string[]
  evidence: Record<string, unknown>
}

export class ScamDetectionEngine {
  async analyzeToken(token: TokenInfo, userAddress: string): Promise<ScamDetectionResult> {
    const features = await extractFeatures(token, userAddress)
    const simulation = await simulateHoneypot(token, features)
    const rules = await applyRules({ ...features })
    const ml = await new ScamMLModel().predictScamProbability({ ...features, rulesScore: rules.score })

    let score = Math.round(0.6 * rules.score + 0.4 * (ml.probability * 100))
    const trustedSymbols = ['USDC', 'USDT', 'WBTC', 'WETH', 'DAI', 'LINK', 'UNI', 'AAVE', 'COMP']
    const isTrusted = trustedSymbols.includes((token.symbol || '').toUpperCase())
    if (isTrusted) score = Math.max(0, score - 60)

    if (!simulation.canSell) score = Math.max(score, 90)
    if (rules.signal === 'ESCALATE') score = Math.max(score, 75)

    const riskLevel: 'low' | 'medium' | 'high' = score >= 75 ? 'high' : score >= 40 ? 'medium' : 'low'
    const reasons = rules.reasons.length > 0 ? rules.reasons : ['Analyzed']
    const confidencePct = Math.min(95, Math.max(50, Math.round(ml.confidence)))

    return {
      tokenAddress: token.address,
      symbol: token.symbol,
      riskLevel,
      score,
      confidencePct,
      reasons,
      evidence: {
        features,
        simulation,
        rules: rules.details,
        ml: {
          probability: ml.probability,
          confidence: ml.confidence,
          contributions: ml.contributions
        }
      }
    }
  }
}
