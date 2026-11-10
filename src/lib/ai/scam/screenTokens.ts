import { ScamDetectionEngine } from './scamEngine';
import { isWhitelisted } from '@/lib/config/tokenWhitelist';

export interface ScreeningToken {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  valueUSD?: number;
  balance?: string;
}

const NON_FINDINGS = new Set([
  'Contract is not in the known-address registry',
  'Price coverage unavailable',
  'Analyzed',
]);

export function hasActionableFinding(reasons: string[]): boolean {
  return reasons.some(reason => !NON_FINDINGS.has(reason));
}

/** Metadata/registry screening only. No claims about holders, taxes or sellability. */
export async function screenTokenMetadata(tokens: ScreeningToken[], walletAddress: string) {
  const unique = [...new Map(tokens.map(token => [token.address.toLowerCase(), token])).values()];
  const engine = new ScamDetectionEngine();
  const findings = await Promise.all(unique.map(async token => {
    const result = await engine.analyzeToken({
      ...token,
      symbol: token.symbol || 'TOKEN',
      verified: isWhitelisted(token.address),
    }, walletAddress);
    return result;
  }));
  const flaggedTokens = findings.filter(result => hasActionableFinding(result.reasons));
  return {
    flaggedTokens,
    knownCount: unique.filter(token => isWhitelisted(token.address)).length,
    totalTokens: unique.length,
    highRiskCount: flaggedTokens.filter(token => token.riskLevel === 'high').length,
    mediumRiskCount: flaggedTokens.filter(token => token.riskLevel === 'medium').length,
    lowRiskCount: flaggedTokens.filter(token => token.riskLevel === 'low').length,
    coverage: 'metadata-and-known-address-registry' as const,
    unavailableChecks: ['holder-concentration', 'liquidity', 'taxes', 'sell-simulation'],
  };
}
