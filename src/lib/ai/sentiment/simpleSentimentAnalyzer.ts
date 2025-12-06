/**
 * Simplified Sentiment Analyzer with better GLM compatibility
 */

import { EnrichedNewsArticle, SentimentAnalysis } from './types';

export class SimpleSentimentAnalyzer {
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  private readonly GLM_API_KEY = process.env.GLM_API_KEY;
  private readonly GLM_BASE_URL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
  private readonly OPENAI_BASE_URL = 'https://api.openai.com/v1';

  async analyzeSentiment(article: EnrichedNewsArticle): Promise<SentimentAnalysis> {
    const text = `${article.title}. ${article.summary || ''}`;

    if (!this.GLM_API_KEY && !this.OPENAI_API_KEY) {
      throw new Error('GLM or OpenAI API key is required for sentiment analysis');
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Use GLM if available, otherwise OpenAI
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
            model,
            messages: [
              {
                role: 'system',
                content: `Analyze crypto news sentiment and impact. Respond with JSON:
{
  "sentiment": "bullish|bearish|neutral",
  "score": -1 to 1,
  "confidence": 0 to 1,
  "reason": "Brief explanation of market impact and which coins are affected",
  "affected_coins": ["BTC", "ETH", etc. if mentioned]
}`
              },
              {
                role: 'user',
                content: `Analyze this crypto news: "${text.substring(0, 300)}"`
              }
            ],
            temperature: 0.1,
            max_tokens: 100
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            console.warn('Rate limit hit, using fallback');
            return this.fallbackAnalysis(text, article);
          }
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('Empty response from AI');
        }

        // Try to parse as JSON
        let analysis;
        try {
          // Look for JSON in the response
          const jsonMatch = content.match(/\{[^}]+\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        } catch (parseError) {
          // If JSON parsing fails, extract from text
          const lowerContent = content.toLowerCase();
          let score = 0;
          let sentiment = 'neutral';

          if (lowerContent.includes('bullish') || lowerContent.includes('positive')) {
            score = 0.5;
            sentiment = 'bullish';
          } else if (lowerContent.includes('bearish') || lowerContent.includes('negative')) {
            score = -0.5;
            sentiment = 'bearish';
          }

          analysis = {
            sentiment,
            score,
            confidence: 0.5,
            reason: 'Extracted from text response'
          };
        }

        // Map to expected format
        return {
          score: analysis.score || 0,
          label: ((analysis.sentiment || 'neutral').charAt(0).toUpperCase() + (analysis.sentiment || 'neutral').slice(1)) as 'Bullish' | 'Bearish' | 'Neutral',
          confidence: analysis.confidence || 0.5,
          reasoning: [analysis.reason || 'AI analysis of market impact'],
          impactLevel: Math.abs(analysis.score || 0) > 0.3 ? 'High' : 'Medium',
          marketSegment: 'Crypto',
          keyPhrases: [],
          emotionalIndicators: {
            fear: Math.max(0, -(analysis.score || 0)),
            greed: Math.max(0, analysis.score || 0),
            uncertainty: 0.5,
            optimism: Math.max(0, analysis.score || 0)
          },
          entities: (analysis.affected_coins || []).map(coin => ({
            name: coin,
            type: 'currency',
            sentiment: analysis.score || 0,
            relevance: 1
          })),
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

    // Fallback
    return this.fallbackAnalysis(text, article);
  }

  private fallbackAnalysis(text: string, article: EnrichedNewsArticle): SentimentAnalysis {
    const lowerText = text.toLowerCase();
    let score = 0;
    let reasoning = [];
    let affectedCoins = [];

    // Detect mentioned coins
    const coinPatterns = [
      { symbol: 'BTC', names: ['bitcoin', 'btc', 'bitcoin '] },
      { symbol: 'ETH', names: ['ethereum', 'eth', 'ether '] },
      { symbol: 'BNB', names: ['binance', 'bnb', 'binance coin '] },
      { symbol: 'USDC', names: ['usdc', 'usd coin'] },
      { symbol: 'USDT', names: ['usdt', 'tether', 'usd tether'] }
    ];

    coinPatterns.forEach(coin => {
      if (coin.names.some(name => lowerText.includes(name))) {
        affectedCoins.push(coin.symbol);
      }
    });

    // Analyze market impact
    if (lowerText.includes('fund') || lowerText.includes('etf') || lowerText.includes('institutional')) {
      reasoning.push('Institutional investment detected - positive for market');
      score += 0.2;
    }

    if (lowerText.includes('hack') || lowerText.includes('exploit') || lowerText.includes('scam')) {
      reasoning.push('Security incident detected - negative for affected coin');
      score -= 0.3;
    }

    if (lowerText.includes('launch') || lowerText.includes('upgrade') || lowerText.includes('partnership')) {
      reasoning.push('Positive development detected');
      score += 0.2;
    }

    if (lowerText.includes('ban') || lowerText.includes('regulation') || lowerText.includes('sec')) {
      reasoning.push('Regulatory concern detected');
      score -= 0.2;
    }

    if (lowerText.includes('surge') || lowerText.includes('rally') || lowerText.includes('pump')) {
      reasoning.push('Price surge indicated');
      score += 0.25;
    }

    if (lowerText.includes('crash') || lowerText.includes('dump') || lowerText.includes('slump')) {
      reasoning.push('Price decline indicated');
      score -= 0.25;
    }

    // Generate comprehensive reasoning
    if (reasoning.length === 0) {
      if (affectedCoins.length > 0) {
        reasoning.push(`News about ${affectedCoins.join(', ')} with unclear market impact`);
      } else {
        reasoning.push('Crypto news with neutral market implications');
      }
    }

    score = Math.max(-1, Math.min(1, score));

    let label = 'NEUTRAL';
    if (score > 0.1) label = 'BULLISH';
    else if (score < -0.1) label = 'BEARISH';

    const confidence = Math.min(0.8, Math.abs(score) + 0.3);

    return {
      score,
      label,
      confidence,
      reasoning,
      impactLevel: Math.abs(score) > 0.3 ? 'High' : 'Medium',
      marketSegment: 'Crypto',
      keyPhrases: [],
      emotionalIndicators: {
        fear: Math.max(0, -score),
        greed: Math.max(0, score),
        uncertainty: 0.5,
        optimism: Math.max(0, score)
      },
      entities: affectedCoins.map(coin => ({
        name: coin,
        type: 'currency',
        sentiment: score,
        relevance: 1
      })),
      meta: { source: 'Fallback', model: 'keyword-lexicon' }
    };
  }
}
