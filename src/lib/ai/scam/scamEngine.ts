import { extractFeatures, TokenInfo } from './scamFeatures'
import { applyRules } from './scamRules'
import { simulateHoneypot } from './honeypotSimulator'
import { ScamMLModel } from './scamModel'
import { isWhitelisted } from '../../config/tokenWhitelist'
import { aiCache, CacheKeys } from '../shared/cache'

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
    const cacheKey = CacheKeys.SCAM_ANALYSIS(token.address)
    const cached = aiCache.get<ScamDetectionResult>(cacheKey)
    if (cached) return cached

    const features = await extractFeatures(token, userAddress)
    const simulation = await simulateHoneypot(token, features)
    const rules = await applyRules({ ...features })
    const ml = await new ScamMLModel().predictScamProbability({ ...features, rulesScore: rules.score })

    let score = Math.round(rules.score)
    // Token symbols are user-controlled; trust only known mainnet contracts.
    const isTrusted = isWhitelisted(token.address)
    if (isTrusted) score = Math.max(0, score - 60)

    if (simulation.canSell === false) score = Math.max(score, 90)
    if (rules.signal === 'ESCALATE') score = Math.max(score, 75)

    const riskLevel: 'low' | 'medium' | 'high' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
    const reasons = rules.reasons.length > 0 ? rules.reasons : ['Analyzed']
    const marketUnread = features.holderTop1Pct <= 0 && features.taxRatePct <= 0 && features.liquidityUSD <= 0
    const confidencePct = marketUnread
      ? Math.min(40, Math.round(ml.confidence))
      : Math.min(95, Math.max(50, Math.round(ml.confidence)))

    const result: ScamDetectionResult = {
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

    aiCache.set(cacheKey, result, 5 * 60 * 1000)
    
    return result
  }
}
