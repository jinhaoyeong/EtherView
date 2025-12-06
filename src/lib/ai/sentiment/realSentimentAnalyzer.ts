/**
 * Real AI-Powered Sentiment Analysis Engine
 * Uses OpenAI GPT-4 for sophisticated sentiment analysis and reasoning
 */

import { EnrichedNewsArticle } from './realNewsAggregator';

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
  entities: Array<{
    name: string;
    type: 'person' | 'organization' | 'currency' | 'concept';
    sentiment: number;
    relevance: number;
  }>;
  meta?: { source?: 'GLM' | 'OpenAI' | 'Fallback'; model?: string };
}

export class RealSentimentAnalyzer {
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  private readonly GLM_API_KEY = process.env.GLM_API_KEY;
  private readonly GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  private readonly OPENAI_BASE_URL = 'https://api.openai.com/v1';

  async analyzeSentiment(article: EnrichedNewsArticle, opts?: { mode?: 'fast' | 'normal'; maxTokens?: number }): Promise<SentimentAnalysis> {
    if (!this.GLM_API_KEY && !this.OPENAI_API_KEY) {
      throw new Error('GLM or OpenAI API key is required for sentiment analysis');
    }

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
                content: `You are an advanced financial sentiment analysis expert specializing in cryptocurrency markets, blockchain technology, and traditional finance.

Analyze the given news article with deep contextual understanding. Consider:
- Market impact and timing implications
- Regulatory and compliance factors
- Technical and fundamental analysis signals
- Investor sentiment indicators and behavioral economics
- Cross-asset correlations and spillover effects
- Institutional vs retail sentiment dynamics
- Supply-demand fundamentals and on-chain metrics relevance
- Macro-economic context and monetary policy impact
- Specific asset impact (ETH, BTC, DeFi tokens, etc.)
- Credibility of source and potential bias

Provide detailed analysis in this exact JSON format:
{
  "score": number between -1 (extremely bearish) and 1 (extremely bullish),
  "label": "Bullish" | "Neutral" | "Bearish",
  "confidence": number between 0 and 1 representing analysis certainty,
  "reasoning": ["specific_reason_1", "specific_reason_2", "specific_reason_3"],
  "impactLevel": "Low" | "Medium" | "High" | "Critical" based on market impact potential,
  "marketSegment": "Crypto" | "Traditional" | "Macro" | "Regulatory",
  "keyPhrases": ["key_market_phrase_1", "key_market_phrase_2", "key_market_phrase_3"],
  "emotionalIndicators": {
    "fear": number 0-1 (fear/uncertainty level),
    "greed": number 0-1 (optimism/excitement level),
    "uncertainty": number 0-1 (ambiguity level),
    "optimism": number 0-1 (positive outlook level)
  },
  "entities": [
    {
      "name": "entity_name",
      "type": "person" | "organization" | "currency" | "concept" | "protocol",
      "sentiment": number between -1 and 1 for this specific entity,
      "relevance": number between 0 and 1 for importance to overall sentiment
    }
  ]
}

Special attention to:
- Ethereum-specific impacts (upgrades, DeFi, NFTs, layer 2s)
- Bitcoin correlation and spillover effects
- Regulatory developments and their market implications
- Technical indicator confirmations or contradictions
- Sentiment momentum and potential trend changes`
              },
              {
                role: 'user',
                content: `Article: "${text}"\n\nSource: ${article.source}\nPublished: ${article.publishedAt}\nSource Trust: ${article.sourceTrust}\nMarket Relevance: ${article.marketRelevance}\n\nAnalyze with market impact focus for cryptocurrency trading.`
              }
            ],
            temperature: 0.1,
            max_tokens: typeof opts?.maxTokens === 'number'
              ? opts!.maxTokens
              : (opts?.mode === 'fast' ? 100 : 180),
            // response_format: { type: 'json_object' } // Removed - GLM doesn't support this parameter
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429 && retryCount < maxRetries - 1) {
            const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.warn(`OpenAI rate limit hit, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
            continue;
          }
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid API response structure');
        }

        const content = data.choices[0].message.content;
        if (!content || content.trim() === '') {
          throw new Error('Empty response from AI model');
        }

        let analysis;
        try {
          analysis = JSON.parse(content);
        } catch (parseError) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              analysis = JSON.parse(jsonMatch[0]);
            } catch (e2) {
              console.error('JSON parse error (regex), content:', content.substring(0, 200));
            }
          }
          if (!analysis) {
            const lowerContent = content.toLowerCase();
            let score = 0;
            let confidence = 0.5;
            let label = 'neutral';
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
              sentiment: label,
              confidence,
              reasoning: ['Model output unstructured; sentiment derived from tone and keywords']
            };
            console.warn('Using text fallback extraction:', analysis);
          }
        }

        // Validate analysis structure
        if (!analysis.score && !analysis.sentiment) {
          throw new Error('Invalid analysis response structure');
        }

        // Apply advanced weighting factors
        const sourceWeight = Math.sqrt(article.sourceTrust); // Square root for diminishing returns
        const recencyWeight = 0.6 + (article.recencyWeight * 0.4); // More emphasis on recency
        const relevanceWeight = 0.8 + (article.marketRelevance * 0.2); // Market relevance weighting
        const entityWeight = 1 + (article.entityCount * 0.05); // Entity count bonus

        const compositeWeight = sourceWeight * recencyWeight * relevanceWeight * entityWeight;
        const normalized = this.normalizeAnalysis(analysis);
        const weightedScore = Math.max(-1, Math.min(1, normalized.score * compositeWeight));

        const impactLevel = this.determineImpactLevel(article, weightedScore);

        const reasoningCount = Array.isArray(normalized.reasoning) ? normalized.reasoning.length : 0;
        const keyPhraseCount = Array.isArray(normalized.keyPhrases) ? normalized.keyPhrases.length : 0;
        const computedConfidenceBase =
          0.15 +
          0.30 * (normalized.confidence || 0.5) +
          0.25 * Math.abs(weightedScore) +
          0.15 * article.sourceTrust +
          0.10 * article.marketRelevance +
          0.05 * Math.min(article.entityCount, 12) / 12 +
          0.02 * Math.min(reasoningCount, 5) +
          0.01 * Math.min(keyPhraseCount, 6);
        const computedConfidence = Math.max(0, Math.min(1, computedConfidenceBase));

        const isPlaceholderEmotions = (
          normalized.emotionalIndicators &&
          normalized.emotionalIndicators.fear === 0 &&
          normalized.emotionalIndicators.greed === 0 &&
          Math.abs((normalized.emotionalIndicators.uncertainty || 0) - 0.5) < 0.001 &&
          normalized.emotionalIndicators.optimism === 0
        );
        const emotionalIndicators = (!normalized.emotionalIndicators || isPlaceholderEmotions)
          ? {
              fear: Math.max(0, Math.min(1, 0.5 - weightedScore * 0.6)),
              greed: Math.max(0, Math.min(1, 0.5 + weightedScore * 0.6)),
              uncertainty: Math.max(0, Math.min(1, 0.6 - Math.abs(weightedScore) * 0.5)),
              optimism: Math.max(0, Math.min(1, 0.4 + weightedScore * 0.6))
            }
          : normalized.emotionalIndicators;

          return {
            ...normalized,
            score: weightedScore,
            confidence: computedConfidence,
            impactLevel,
            emotionalIndicators,
            meta: { source: this.GLM_API_KEY ? 'GLM' : 'OpenAI', model }
          };

      } catch (error) {
        console.error(`Error in AI sentiment analysis (attempt ${retryCount + 1}):`, error);
        retryCount++;

        if (retryCount >= maxRetries) {
          console.warn('All retries exhausted, using fallback analysis');
          return this.fallbackAnalysis(text, article);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    // This should never be reached but TypeScript needs it
    return this.fallbackAnalysis(text, article);
  }

  private determineImpactLevel(article: EnrichedNewsArticle, score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    let impactScore = 0;
    impactScore += article.sourceTrust * 0.25;
    impactScore += article.marketRelevance * 0.35;
    impactScore += Math.min(article.entityCount, 12) * 0.02; // up to +0.24
    impactScore += Math.abs(score) * 0.35;

    if (article.category === 'regulation') impactScore += 0.25;
    if (article.category === 'macro') impactScore += 0.20;

    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();
    if (text.includes('hack') || text.includes('breach') || text.includes('exploit')) impactScore += 0.40;
    if (text.includes('lawsuit') || text.includes('ban') || text.includes('rejection')) impactScore += 0.25;
    if (text.includes('approval') || text.includes('etf') || text.includes('green light') || text.includes('listing')) impactScore += 0.20;
    if (text.includes('upgrade') || text.includes('fork') || text.includes('merge')) impactScore += 0.20;
    if (text.includes('surge') || text.includes('plunge') || text.includes('collapse') || text.includes('rally') || text.includes('selloff')) impactScore += 0.20;

    const src = article.source.toLowerCase();
    if (src.includes('sec') || src.includes('federal reserve')) impactScore += 0.30;

    if (impactScore < 0.25) return 'Low';
    if (impactScore < 0.55) return 'Medium';
    if (impactScore < 0.80) return 'High';
    return 'Critical';
  }

  private normalizeAnalysis(raw: any): SentimentAnalysis {
    const labelRaw = (raw.label ?? raw.sentiment ?? 'Neutral').toString().toLowerCase();
    const label: 'Bullish' | 'Neutral' | 'Bearish' = labelRaw === 'bullish' ? 'Bullish' : labelRaw === 'bearish' ? 'Bearish' : 'Neutral';
    const impactOptions = ['Low','Medium','High','Critical'];
    const impact = impactOptions.includes(raw.impactLevel) ? raw.impactLevel : 'Medium';
    const segOptions = ['Crypto','Traditional','Macro','Regulatory'];
    const segment = segOptions.includes(raw.marketSegment) ? raw.marketSegment : 'Crypto';
    const reasoningArr = Array.isArray(raw.reasoning) ? raw.reasoning.filter((r: any) => typeof r === 'string' && !/json parse error/i.test(r)) : [];
    const keyPhrases = Array.isArray(raw.keyPhrases) ? raw.keyPhrases.filter((p: any) => typeof p === 'string').slice(0, 6) : [];
    const emotional = raw.emotionalIndicators && typeof raw.emotionalIndicators === 'object' ? {
      fear: Math.max(0, Math.min(1, Number(raw.emotionalIndicators.fear) || 0)),
      greed: Math.max(0, Math.min(1, Number(raw.emotionalIndicators.greed) || 0)),
      uncertainty: Math.max(0, Math.min(1, Number(raw.emotionalIndicators.uncertainty) || 0.5)),
      optimism: Math.max(0, Math.min(1, Number(raw.emotionalIndicators.optimism) || 0)),
    } : { fear: 0, greed: 0, uncertainty: 0.5, optimism: 0 };
    const entities = Array.isArray(raw.entities) ? raw.entities.map((e: any) => ({
      name: e?.name || 'Entity',
      type: (e?.type === 'person' || e?.type === 'organization' || e?.type === 'currency' || e?.type === 'concept') ? e.type : 'concept',
      sentiment: Math.max(-1, Math.min(1, Number(e?.sentiment) || 0)),
      relevance: Math.max(0, Math.min(1, Number(e?.relevance) || 0.5)),
    })) : [];
    return {
      score: Math.max(-1, Math.min(1, Number(raw.score) || 0)),
      label,
      confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.5)),
      reasoning: reasoningArr,
      impactLevel: impact,
      marketSegment: segment,
      keyPhrases,
      emotionalIndicators: emotional,
      entities,
    } as SentimentAnalysis;
  }

  private fallbackAnalysis(text: string, article: EnrichedNewsArticle): SentimentAnalysis {
    // Enhanced keyword-based sentiment analysis
    const positiveWords = [
      'bullish', 'rally', 'surge', 'gain', 'growth', 'positive', 'optimistic', 'increase', 'rise',
      'up', 'high', 'strong', 'boost', 'breakthrough', 'success', 'milestone', 'achievement', 'profit',
      'adopt', 'launch', 'upgrade', 'recover', 'bounce', 'soar', 'jump', 'climb'
    ];

    const negativeWords = [
      'bearish', 'crash', 'fall', 'decline', 'negative', 'concern', 'fear', 'drop', 'decrease',
      'low', 'weak', 'loss', 'risk', 'threat', 'warning', 'alarm', 'panic', 'sell', 'dump',
      'hack', 'breach', 'fraud', 'scam', 'ban', 'restrict', 'delay', 'postpone', 'fail', 'slump'
    ];

    const lowerText = text.toLowerCase();
    let score = 0;
    let reasoning = [];

    // Count positive words
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) {
        score += 0.15;
        reasoning.push(`Positive keyword: "${word}"`);
      }
    });

    // Count negative words
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) {
        score -= 0.15;
        reasoning.push(`Negative keyword: "${word}"`);
      }
    });

    // Apply source trust weighting
    score = Math.max(-1, Math.min(1, score * article.sourceTrust));

    // Determine sentiment label
    let sentimentLabel: 'bullish' | 'neutral' | 'bearish' = 'neutral';
    if (score > 0.1) {
      sentimentLabel = 'bullish';
    } else if (score < -0.1) {
      sentimentLabel = 'bearish';
    }

    // Calculate confidence based on keyword matches
    const confidence = Math.min(0.8, Math.abs(score) + 0.3);

    // Add default reasoning if none found
    if (reasoning.length === 0) {
      reasoning.push('No clear sentiment indicators detected');
    }

    return {
      score,
      label: (sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1)) as 'Bullish' | 'Bearish' | 'Neutral',
      confidence,
      reasoning,
      impactLevel: 'Medium',
      marketSegment: 'Crypto',
      keyPhrases: [],
      emotionalIndicators: {
        fear: Math.max(0, -score),
        greed: Math.max(0, score),
        uncertainty: 0.5,
        optimism: Math.max(0, score)
      },
      entities: [],
      meta: { source: 'Fallback', model: 'keyword-lexicon' }
    };
  }

  async batchAnalyze(articles: EnrichedNewsArticle[]): Promise<SentimentAnalysis[]> {
    // For quota management, only analyze top 15 articles most recent
    const articlesToAnalyze = articles
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 15);

    const batchSize = 2; // Very small batches to avoid rate limits
    const results: SentimentAnalysis[] = [];

    console.log(`🧠 Analyzing sentiment for ${articlesToAnalyze.length} articles (batch size: ${batchSize})`);

    for (let i = 0; i < articlesToAnalyze.length; i += batchSize) {
      const batch = articlesToAnalyze.slice(i, i + batchSize);

      try {
        // Process sequentially to avoid rate limits
        const batchResults: SentimentAnalysis[] = [];
        for (const article of batch) {
          try {
            const result = await this.analyzeSentiment(article);
            batchResults.push(result);
            // Add delay between individual API calls
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.warn(`Failed to analyze article: ${article.title}`, error);
            batchResults.push(this.fallbackAnalysis(
              `${article.title}. ${article.summary || ''}`,
              article
            ));
          }
        }

        results.push(...batchResults);
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(articlesToAnalyze.length/batchSize)} completed`);

      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i/batchSize) + 1}:`, error);
        // Add fallback results for this batch
        batch.forEach(article => {
          results.push(this.fallbackAnalysis(
            `${article.title}. ${article.summary || ''}`,
            article
          ));
        });
      }

      // Longer delay between batches
      if (i + batchSize < articlesToAnalyze.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Add fallback analysis for remaining articles (no AI processing)
    const remainingArticles = articles.slice(articlesToAnalyze.length);
    for (const article of remainingArticles) {
      results.push(this.fallbackAnalysis(
        `${article.title}. ${article.summary || ''}`,
        article
      ));
    }

    console.log(`📊 Sentiment analysis complete: ${results.length} total results (${articlesToAnalyze.length} AI, ${remainingArticles.length} fallback)`);
    return results;
  }
}

export const realSentimentAnalyzer = new RealSentimentAnalyzer();
