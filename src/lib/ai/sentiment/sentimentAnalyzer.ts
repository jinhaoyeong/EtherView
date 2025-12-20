/**
 * Advanced Sentiment Analysis Engine
 * Uses GLM AI model for sophisticated sentiment analysis with fallback to heuristics
 */

import { EnrichedNewsArticle } from './newsAggregator';

export interface SentimentAnalysis {
  score: number; // -1 to 1
  label: 'Bullish' | 'Neutral' | 'Bearish';
  confidence: number; // 0 to 1
  reasoning: string[];
  impactLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  marketSegment: 'Crypto' | 'Traditional' | 'Macro' | 'Regulatory';
  keyPhrases: string[];
  emotionalIndicators: {
    fear: number;
    greed: number;
    uncertainty: number;
    optimism: number;
  };
  meta?: { source?: 'GLM' | 'OpenAI' | 'Fallback'; model?: string };
  summary?: string; // Comprehensive summary of news and market implications
  affectedAssets?: string[]; // Assets likely to be affected
  timeline?: string; // Expected impact timeline
}

export class SentimentAnalyzer {
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  private readonly GLM_API_KEY = process.env.GLM_API_KEY;
  private readonly GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  private readonly OPENAI_BASE_URL = 'https://api.openai.com/v1';

  private readonly FINANCIAL_SENTIMENT_LEXICON = {
    // Strong positive indicators
    strongPositive: [
      'bullish', 'rally', 'surge', 'jump', 'skyrocket', 'boom', 'explosion',
      'breakthrough', 'milestone', 'record high', 'all-time high', ' ATH ',
      'adoption', 'integration', 'partnership', 'approval', 'launch', 'success',
      'growth', 'expansion', 'innovation', 'upgrade', 'improvement', 'optimistic'
    ],

    // Moderate positive indicators
    moderatePositive: [
      'rise', 'gain', 'increase', 'up', 'positive', 'favorable', 'support',
      'resistance break', 'momentum', 'uptrend', 'bull run', 'recovery',
      'stability', 'strength', 'confidence', 'opportunity', 'potential'
    ],

    // Strong negative indicators
    strongNegative: [
      'bearish', 'crash', 'collapse', 'plunge', 'tumble', 'dump', 'slump',
      'crisis', 'panic', 'fear', 'scam', 'hack', 'breach', 'vulnerability',
      'ban', 'prohibit', 'restrict', 'delay', 'rejection', 'failure', 'concern'
    ],

    // Moderate negative indicators
    moderateNegative: [
      'fall', 'drop', 'decline', 'down', 'negative', 'pressure', 'correction',
      'downtrend', 'bear market', 'volatility', 'risk', 'uncertainty', 'caution',
      'challenge', 'obstacle', 'headwind', 'struggle', 'difficulty'
    ],

    // Neutral indicators
    neutral: [
      'stable', 'steady', 'unchanged', 'flat', 'neutral', 'sideways', 'range',
      'consolidation', 'pause', 'hold', 'maintain', 'continue', 'monitor',
      'observe', 'analysis', 'report', 'update', 'announcement'
    ]
  };

  private readonly CONTEXT_MODIFIERS = {
    negators: [
      'not', 'no', 'never', 'none', 'without', 'lack', 'absence', 'despite',
      'however', 'although', 'but', 'yet', 'contrary', 'opposite'
    ],
    amplifiers: [
      'very', 'extremely', 'highly', 'significantly', 'major', 'massive',
      'huge', 'enormous', 'tremendous', 'substantial', 'considerable', 'dramatic'
    ],
    diminishers: [
      'slightly', 'somewhat', 'moderately', 'marginally', 'barely', 'hardly',
      'minimally', 'minor', 'small', 'limited', 'little', 'few'
    ],
    regulatoryPositive: [
      'approval', 'approved', 'cleared', 'green light', 'support', 'favorable',
      'positive', 'constructive', 'cooperation', 'framework', 'clarity'
    ],
    regulatoryNegative: [
      'ban', 'banned', 'prohibited', 'restricted', 'rejection', 'rejected',
      'delayed', 'postponed', 'suspended', 'investigation', 'lawsuit', 'penalty'
    ]
  };

  async analyzeSentiment(article: EnrichedNewsArticle): Promise<SentimentAnalysis> {
    try {
      // Try GLM analysis first if API key is available
      if (this.GLM_API_KEY || this.OPENAI_API_KEY) {
        try {
          return await this.analyzeSentimentWithAI(article);
        } catch (error) {
          console.warn('AI sentiment analysis failed, falling back to heuristics:', error);
        }
      }

      // Fallback to heuristics
      return this.analyzeSentimentWithHeuristics(article);
    } catch (error) {
      // Final error handler to prevent unhandled rejections
      console.error('Critical error in sentiment analysis:', error);
      return this.analyzeSentimentWithHeuristics(article);
    }
  }

  private async analyzeSentimentWithAI(article: EnrichedNewsArticle): Promise<SentimentAnalysis> {
    const text = `${article.title}. ${article.summary || ''}`;
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Try GLM-4.6 first, fallback to OpenAI
        const apiUrl = this.GLM_API_KEY ? this.GLM_BASE_URL : this.OPENAI_BASE_URL;
        const apiKey = this.GLM_API_KEY || this.OPENAI_API_KEY;
        const model = this.GLM_API_KEY ? 'glm-4.6' : 'gpt-4o';
        const authHeader = this.GLM_API_KEY ?
          { 'Authorization': `Bearer ${this.GLM_API_KEY}` } :
          { 'Authorization': `Bearer ${this.OPENAI_API_KEY}` };

        const response = await fetch(`${apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            ...authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: `You are an expert financial market analyst with deep expertise in cryptocurrency markets, traditional finance, and macroeconomic analysis. Your task is to provide comprehensive market analysis of news articles.

Analyze the given news article and provide detailed insights in this JSON format:
{
  "score": number between -1 (extremely bearish) and 1 (extremely bullish),
  "label": "Bullish" | "Neutral" | "Bearish",
  "confidence": number between 0 and 1 representing analysis certainty,
  "reasoning": [
    "Comprehensive analysis of what the news means for markets",
    "Specific assets or sectors likely to be affected",
    "Expected market reaction and timeline"
  ],
  "impactLevel": "Low" | "Medium" | "High" | "Critical" based on market impact potential,
  "marketSegment": "Crypto" | "Traditional" | "Macro" | "Regulatory",
  "keyPhrases": ["key_market_theme_1", "key_market_theme_2", "key_market_theme_3"],
  "emotionalIndicators": {
    "fear": number 0-1 (fear/uncertainty level),
    "greed": number 0-1 (optimism/excitement level),
    "uncertainty": number 0-1 (ambiguity level),
    "optimism": number 0-1 (positive outlook level)
  },
  "summary": "Brief but comprehensive summary of the news and its market implications",
  "affectedAssets": ["BTC", "ETH", "Stocks", "Bonds", etc.],
  "timeline": "Immediate/Short-term/Medium-term/Long-term impact expectation"
}

ANALYSIS FRAMEWORK:
1. **Context**: What is happening and why it matters
2. **Market Impact**: Which markets/assets will be affected and how
3. **Timeline**: When the impact will be felt
4. **Magnitude**: How significant the impact will be
5. **Risks**: Potential counter-arguments or risks to the analysis

Focus on providing actionable market intelligence, not just sentiment labels. Explain the "why" behind market movements.`
              },
              {
                role: 'user',
                content: `Article: "${text}"\n\nSource: ${article.source}\nPublished: ${article.publishedAt}\nMarket Relevance: ${article.marketRelevance}\n\nAnalyze with market impact focus.`
              }
            ],
            temperature: 0.1,
            max_tokens: 400
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429 && retryCount < maxRetries - 1) {
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.warn(`Rate limit hit, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
            continue;
          }
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('Empty response from AI model');
        }

        let analysis;
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
          // Extract from text as fallback
          const lowerContent = content.toLowerCase();
          let score = 0;
          let label = 'neutral';
          let confidence = 0.5;

          if (lowerContent.includes('bullish') || lowerContent.includes('positive')) {
            score = 0.5;
            label = 'bullish';
            confidence = 0.6;
          } else if (lowerContent.includes('bearish') || lowerContent.includes('negative')) {
            score = -0.5;
            label = 'bearish';
            confidence = 0.6;
          }

          analysis = {
            score,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            confidence,
            reasoning: ['Extracted from unstructured AI response'],
            impactLevel: 'Medium',
            marketSegment: 'Crypto',
            keyPhrases: [],
            emotionalIndicators: {
              fear: Math.max(0, -score),
              greed: Math.max(0, score),
              uncertainty: 0.5,
              optimism: Math.max(0, score)
            }
          };
        }

        // Apply source and recency weighting
        const weightedScore = Math.max(-1, Math.min(1,
          analysis.score * article.sourceTrust * (0.5 + article.recencyWeight * 0.5)
        ));

        return {
          ...analysis,
          score: weightedScore,
          meta: {
            source: this.GLM_API_KEY ? 'GLM' : 'OpenAI',
            model
          }
        };

      } catch (error) {
        console.error(`Error in AI sentiment analysis (attempt ${retryCount + 1}):`, error);
        retryCount++;

        if (retryCount >= maxRetries) {
          // Don't throw - let the main method handle fallback gracefully
          throw new Error(`AI sentiment analysis failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private analyzeSentimentWithHeuristics(article: EnrichedNewsArticle): SentimentAnalysis {
    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

    // Calculate base sentiment score
    const baseScore = this.calculateBaseSentiment(text);

    // Apply context-aware modifications
    const contextScore = this.applyContextModifications(text, baseScore);

    // Apply source and recency weighting
    const finalScore = contextScore * article.sourceTrust * (0.5 + article.recencyWeight * 0.5);

    // Determine classification
    const label = this.classifySentiment(finalScore);
    const confidence = this.calculateConfidence(text, finalScore);
    const impactLevel = this.determineImpactLevel(article, finalScore);
    const marketSegment = this.determineMarketSegment(article);
    const reasoning = this.generateReasoning(text, finalScore, article);
    const keyPhrases = this.extractKeyPhrases(text);
    const emotionalIndicators = this.analyzeEmotionalIndicators(text);

    // Generate summary
    const summary = this.generateSummary(text, finalScore, article);
    const affectedAssets = this.detectAffectedAssets(text);
    const timeline = this.estimateTimeline(finalScore, article);

    return {
      score: finalScore,
      label,
      confidence,
      reasoning,
      impactLevel,
      marketSegment,
      keyPhrases,
      emotionalIndicators,
      summary,
      affectedAssets,
      timeline,
      meta: { source: 'Fallback', model: 'heuristics' }
    };
  }

  private calculateBaseSentiment(text: string): number {
    let score = 0;
    const words = text.split(/\s+/);

    words.forEach((word, index) => {
      // Check for sentiment words
      if (this.FINANCIAL_SENTIMENT_LEXICON.strongPositive.includes(word)) {
        score += 0.4;
      } else if (this.FINANCIAL_SENTIMENT_LEXICON.moderatePositive.includes(word)) {
        score += 0.2;
      } else if (this.FINANCIAL_SENTIMENT_LEXICON.strongNegative.includes(word)) {
        score -= 0.4;
      } else if (this.FINANCIAL_SENTIMENT_LEXICON.moderateNegative.includes(word)) {
        score -= 0.2;
      }

      // Check for phrases (next word combinations)
      if (index < words.length - 1) {
        const phrase = `${word} ${words[index + 1]}`;

        if (phrase.includes('all time high') || phrase.includes('record high')) {
          score += 0.5;
        } else if (phrase.includes('all time low') || phrase.includes('record low')) {
          score -= 0.5;
        } else if (phrase.includes('market cap') && words[index + 2] === 'increase') {
          score += 0.3;
        }
      }
    });

    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, score));
  }

  private applyContextModifications(text: string, baseScore: number): number {
    let modifiedScore = baseScore;

    // Apply negators
    this.CONTEXT_MODIFIERS.negators.forEach((negator: string) => {
      if (text.includes(negator)) {
        modifiedScore *= -0.8; // Invert and slightly reduce
      }
    });

    // Apply amplifiers
    this.CONTEXT_MODIFIERS.amplifiers.forEach((amplifier: string) => {
      if (text.includes(amplifier)) {
        modifiedScore *= 1.3;
      }
    });

    // Apply diminishers
    this.CONTEXT_MODIFIERS.diminishers.forEach((diminisher: string) => {
      if (text.includes(diminisher)) {
        modifiedScore *= 0.7;
      }
    });

    // Apply regulatory context
    this.CONTEXT_MODIFIERS.regulatoryPositive.forEach((term: string) => {
      if (text.includes(term)) {
        modifiedScore += 0.2;
      }
    });

    this.CONTEXT_MODIFIERS.regulatoryNegative.forEach((term: string) => {
      if (text.includes(term)) {
        modifiedScore -= 0.3;
      }
    });

    // Special case: Fed rate hikes are typically negative for risk assets
    if (text.includes('fed') && text.includes('rate') &&
        (text.includes('hike') || text.includes('increase') || text.includes('raise'))) {
      modifiedScore -= 0.4;
    }

    // Special case: ETF approval is very positive
    if (text.includes('etf') &&
        (text.includes('approval') || text.includes('approved') || text.includes('green light'))) {
      modifiedScore += 0.5;
    }

    return Math.max(-1, Math.min(1, modifiedScore));
  }

  private classifySentiment(score: number): 'Bullish' | 'Neutral' | 'Bearish' {
    if (score > 0.15) return 'Bullish';
    if (score < -0.15) return 'Bearish';
    return 'Neutral';
  }

  private calculateConfidence(text: string, score: number): number {
    // Higher confidence for more extreme scores and more indicators
    const extremityBonus = Math.abs(score) * 0.3;

    // Count sentiment indicators
    let indicatorCount = 0;
    Object.values(this.FINANCIAL_SENTIMENT_LEXICON).forEach(category => {
      category.forEach(word => {
        if (text.includes(word)) indicatorCount++;
      });
    });

    const indicatorBonus = Math.min(indicatorCount * 0.1, 0.4);

    // Text length factor (longer text often provides more context)
    const textLengthFactor = Math.min(text.length / 200, 0.2);

    return Math.min(1, 0.5 + extremityBonus + indicatorBonus + textLengthFactor);
  }

  private determineImpactLevel(article: EnrichedNewsArticle, score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    let impactScore = 0;

    // Source trust increases impact
    impactScore += article.sourceTrust * 0.3;

    // Market relevance increases impact
    impactScore += article.marketRelevance * 0.4;

    // Entity count increases impact
    impactScore += Math.min(article.entityCount * 0.1, 0.2);

    // Extreme sentiment increases impact
    impactScore += Math.abs(score) * 0.3;

    // Category-specific impact modifiers
    if (article.category === 'regulation') {
      impactScore += 0.3; // Regulatory news is high impact
    }
    if (article.category === 'macro') {
      impactScore += 0.2; // Macro news is high impact
    }

    // Source-specific modifiers
    if (article.source.toLowerCase().includes('sec') ||
        article.source.toLowerCase().includes('federal reserve')) {
      impactScore += 0.4; // Official sources are higher impact
    }

    if (impactScore < 0.3) return 'Low';
    if (impactScore < 0.6) return 'Medium';
    if (impactScore < 0.8) return 'High';
    return 'Critical';
  }

  private determineMarketSegment(article: EnrichedNewsArticle): 'Crypto' | 'Traditional' | 'Macro' | 'Regulatory' {
    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

    // Check for regulatory indicators
    if (text.includes('sec') || text.includes('regulation') || text.includes('compliance') ||
        text.includes('federal reserve') || text.includes('legislation')) {
      return 'Regulatory';
    }

    // Check for macro indicators
    if (text.includes('inflation') || text.includes('gdp') || text.includes('interest rate') ||
        text.includes('employment') || text.includes('economy')) {
      return 'Macro';
    }

    // Check for crypto-specific content
    if (text.includes('bitcoin') || text.includes('ethereum') || text.includes('blockchain') ||
        text.includes('defi') || text.includes('nft') || text.includes('crypto')) {
      return 'Crypto';
    }

    // Default to traditional finance
    return 'Traditional';
  }

  private generateReasoning(text: string, score: number, article: EnrichedNewsArticle): string[] {
    const reasoning: string[] = [];

    // Generate meaningful market analysis instead of keyword lists
    const hasCryptoKeywords = text.includes('bitcoin') || text.includes('ethereum') || text.includes('crypto') || text.includes('blockchain');
    const hasRegulatoryKeywords = text.includes('sec') || text.includes('regulation') || text.includes('federal reserve') || text.includes('fed');
    const hasMarketMovement = text.includes('surge') || text.includes('drop') || text.includes('rally') || text.includes('crash') || text.includes('plunge');

    if (score > 0.3) {
      if (hasCryptoKeywords && hasMarketMovement) {
        reasoning.push('Strong positive momentum detected in crypto markets with significant price movements expected');
      } else if (hasRegulatoryKeywords) {
        reasoning.push('Positive regulatory development likely to boost market confidence and adoption');
      } else {
        reasoning.push('Market-positive indicators suggest potential upside for related assets');
      }
    } else if (score > 0.1) {
      reasoning.push('Moderately positive sentiment with potential for gradual market appreciation');
    } else if (score < -0.3) {
      if (hasCryptoKeywords && hasMarketMovement) {
        reasoning.push('Significant negative pressure on crypto markets with potential for sustained downturn');
      } else if (hasRegulatoryKeywords) {
        reasoning.push('Regulatory concerns creating uncertainty and likely suppressing market activity');
      } else {
        reasoning.push('Negative market indicators suggest caution for exposed positions');
      }
    } else if (score < -0.1) {
      reasoning.push('Moderate bearish sentiment with limited immediate impact expected');
    } else {
      reasoning.push('Mixed signals with balanced market implications and limited directional bias');
    }

    // Add context-specific reasoning
    if (article.category === 'regulation') {
      reasoning.push('Regulatory news typically has widespread market effects beyond immediate sector');
    } else if (article.category === 'macro') {
      reasoning.push('Macro economic factors will influence risk asset performance across markets');
    }

    // Add source credibility impact
    if (article.sourceTrust > 0.8) {
      reasoning.push('High-credibility source increases reliability of market impact assessment');
    }

    return reasoning.slice(0, 3); // Focus on most relevant insights
  }

  private extractKeyPhrases(text: string): string[] {
    const phrases: string[] = [];

    // Extract significant phrases
    const phrasePatterns = [
      /\b(federal reserve|fed|interest rate|inflation|gdp)\b/gi,
      /\b(sec|securities and exchange commission|regulation|etf)\b/gi,
      /\b(bitcoin|ethereum|btc|eth|cryptocurrency|blockchain)\b/gi,
      /\b(all.time high|all.time low|record high|record low)\b/gi,
      /\b(market cap|trading volume|price target|support|resistance)\b/gi,
      /\b(technical analysis|fundamental analysis|market sentiment)\b/gi
    ];

    phrasePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return Array.from(new Set(phrases)).slice(0, 8); // Remove duplicates and limit
  }

  private analyzeEmotionalIndicators(text: string): SentimentAnalysis['emotionalIndicators'] {
    const fearWords = ['crash', 'panic', 'fear', 'scared', 'worried', 'concern', 'risk', 'danger'];
    const greedWords = ['greed', 'fomo', 'euphoria', 'excitement', 'hype', 'bullish', 'rally'];
    const uncertaintyWords = ['uncertain', 'unclear', 'unknown', 'wait', 'monitor', 'cautious'];
    const optimismWords = ['optimistic', 'positive', 'hopeful', 'confident', 'bright', 'promising'];

    const calculateEmotionalScore = (words: string[], text: string): number => {
      return words.reduce((score, word) => {
        return score + (text.toLowerCase().includes(word) ? 1 : 0);
      }, 0) / Math.max(words.length, 1);
    };

    const fear = calculateEmotionalScore(fearWords, text);
    const greed = calculateEmotionalScore(greedWords, text);
    const uncertainty = calculateEmotionalScore(uncertaintyWords, text);
    const optimism = calculateEmotionalScore(optimismWords, text);

    // Normalize to 0-1 range
    const total = fear + greed + uncertainty + optimism;
    if (total === 0) {
      return { fear: 0, greed: 0, uncertainty: 0, optimism: 0 };
    }

    return {
      fear: fear / total,
      greed: greed / total,
      uncertainty: uncertainty / total,
      optimism: optimism / total
    };
  }

  private generateSummary(text: string, score: number, article: EnrichedNewsArticle): string {
    const hasPositive = score > 0.15;
    const hasNegative = score < -0.15;
    const hasCrypto = text.includes('bitcoin') || text.includes('ethereum') || text.includes('crypto');
    const hasRegulation = text.includes('regulation') || text.includes('sec') || text.includes('fed');

    if (hasPositive && hasCrypto) {
      return 'Positive developments in cryptocurrency markets suggest potential upside for digital assets, with investor sentiment showing signs of recovery and increased adoption.';
    } else if (hasNegative && hasCrypto) {
      return 'Negative sentiment in crypto markets indicates potential headwinds for digital assets, with investors likely to exercise caution amid current market conditions.';
    } else if (hasPositive && hasRegulation) {
      return 'Supportive regulatory developments are creating a more favorable environment for market participants, potentially boosting confidence and investment flows.';
    } else if (hasNegative && hasRegulation) {
      return 'Regulatory challenges are creating uncertainty in markets, with potential compliance costs and operational adjustments affecting market participants.';
    } else if (hasPositive) {
      return 'Market-positive indicators suggest favorable conditions ahead, with economic developments supporting risk asset appreciation.';
    } else if (hasNegative) {
      return 'Current market indicators point to challenging conditions ahead, with investors likely to maintain defensive positioning until clarity improves.';
    }

    return 'Mixed market signals indicate balanced conditions with limited directional bias in the near term.';
  }

  private detectAffectedAssets(text: string): string[] {
    const assets: string[] = [];

    // Cryptocurrencies
    if (text.includes('bitcoin') || text.includes('btc')) assets.push('BTC');
    if (text.includes('ethereum') || text.includes('eth')) assets.push('ETH');
    if (text.includes('crypto') || text.includes('cryptocurrency')) assets.push('Crypto');

    // Traditional markets
    if (text.includes('stock') || text.includes('equity') || text.includes('s&p') || text.includes('nasdaq')) {
      assets.push('Stocks');
    }
    if (text.includes('bond') || text.includes('treasury') || text.includes('yield')) {
      assets.push('Bonds');
    }
    if (text.includes('dollar') || text.includes('usd') || text.includes('dxy')) {
      assets.push('USD');
    }

    // Commodities
    if (text.includes('gold') || text.includes('silver')) assets.push('Commodities');

    // DeFi/NFT
    if (text.includes('defi') || text.includes('nft') || text.includes('web3')) {
      assets.push('DeFi/NFT');
    }

    return assets.length > 0 ? assets : ['Markets'];
  }

  private estimateTimeline(score: number, article: EnrichedNewsArticle): string {
    const absScore = Math.abs(score);
    const isRecent = article.recencyWeight > 0.7;

    if (absScore > 0.5) {
      return isRecent ? 'Immediate impact expected' : 'Short-term impact';
    } else if (absScore > 0.2) {
      return 'Short to medium-term effects';
    } else if (article.category === 'regulation') {
      return 'Medium to long-term implications';
    } else if (article.category === 'macro') {
      return 'Medium-term trend influence';
    }

    return 'Limited near-term impact';
  }
}

export const sentimentAnalyzer = new SentimentAnalyzer();