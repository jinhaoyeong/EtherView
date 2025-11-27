/**
 * Advanced Sentiment Analysis Engine
 * Finance-tuned sentiment analysis with context-aware scoring
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
}

export class SentimentAnalyzer {
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
    // These words change the meaning of subsequent words
    negators: ['not', 'no', 'never', "don't", "doesn't", "won't", "can't"],
    diminishers: ['slight', 'minor', 'small', 'modest', 'limited', 'partial'],
    amplifiers: ['major', 'significant', 'substantial', 'dramatic', 'sharp', 'massive'],

    // Regulatory sentiment modifiers
    regulatoryPositive: ['approval', 'green light', 'clearance', 'support', 'framework'],
    regulatoryNegative: ['rejection', 'denial', 'delay', 'postpone', 'investigation', 'warning'],

    // Market condition modifiers
    marketPositive: ['breakout', 'rally', 'momentum', 'bull run'],
    marketNegative: ['correction', 'downturn', 'bear market', 'sell-off']
  };

  analyzeSentiment(article: EnrichedNewsArticle): SentimentAnalysis {
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

    return {
      score: finalScore,
      label,
      confidence,
      reasoning,
      impactLevel,
      marketSegment,
      keyPhrases,
      emotionalIndicators
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
    this.CONTEXT_MODIFIERS.negators.forEach(negator => {
      if (text.includes(negator)) {
        modifiedScore *= -0.8; // Invert and slightly reduce
      }
    });

    // Apply amplifiers
    this.CONTEXT_MODIFIERS.amplifiers.forEach(amplifier => {
      if (text.includes(amplifier)) {
        modifiedScore *= 1.3;
      }
    });

    // Apply diminishers
    this.CONTEXT_MODIFIERS.diminishers.forEach(diminisher => {
      if (text.includes(diminisher)) {
        modifiedScore *= 0.7;
      }
    });

    // Apply regulatory context
    this.CONTEXT_MODIFIERS.regulatoryPositive.forEach(term => {
      if (text.includes(term)) {
        modifiedScore += 0.2;
      }
    });

    this.CONTEXT_MODIFIERS.regulatoryNegative.forEach(term => {
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

    // Base sentiment reasoning
    if (score > 0.3) {
      reasoning.push('Strong positive indicators detected in content');
    } else if (score > 0.1) {
      reasoning.push('Moderate positive sentiment identified');
    } else if (score < -0.3) {
      reasoning.push('Strong negative indicators detected in content');
    } else if (score < -0.1) {
      reasoning.push('Moderate negative sentiment identified');
    } else {
      reasoning.push('Content appears neutral or balanced');
    }

    // Market segment reasoning
    if (article.onChainMetadata?.mentionedTokens.length > 0) {
      reasoning.push(`References to ${article.onChainMetadata.mentionedTokens.join(', ')} indicate crypto market relevance`);
    }

    // Source reasoning
    if (article.sourceTrust > 0.8) {
      reasoning.push('Highly credible source increases confidence in analysis');
    }

    // Recency reasoning
    if (article.recencyWeight > 0.7) {
      reasoning.push('Recent news with high market relevance');
    }

    // Category-specific reasoning
    if (article.category === 'regulation') {
      reasoning.push('Regulatory developments typically have significant market impact');
    }

    // Entity reasoning
    if (article.entityCount > 5) {
      reasoning.push(`High entity density (${article.entityCount} entities) suggests comprehensive market coverage`);
    }

    return reasoning.slice(0, 4); // Limit to top 4 reasoning points
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

    return [...new Set(phrases)].slice(0, 8); // Remove duplicates and limit
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
}

export const sentimentAnalyzer = new SentimentAnalyzer();