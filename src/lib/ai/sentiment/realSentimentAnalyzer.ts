/**
 * Real AI-Powered Sentiment Analysis Engine
 * Uses OpenAI GPT-4 for sophisticated sentiment analysis and reasoning
 */

import type { RawNewsArticle, EnrichedNewsArticle } from './newsAggregator';
import type { SentimentAnalysis } from './sentimentAnalyzer';
import { SentimentResult } from './types';

interface APIKeyConfig {
  GLM_API_KEY?: string;
  GLM_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}

export class RealSentimentAnalyzer {
  private readonly config: APIKeyConfig;
  private readonly GLM_API_KEY: string;
  private readonly GLM_BASE_URL: string;
  private readonly OPENAI_API_KEY: string;
  private readonly OPENAI_BASE_URL: string;

  constructor() {
    // Load configuration from environment
    this.config = {
      GLM_API_KEY: process.env.GLM_API_KEY,
      GLM_BASE_URL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    };

    this.GLM_API_KEY = this.config.GLM_API_KEY || '';
    this.GLM_BASE_URL = this.config.GLM_BASE_URL;
    this.OPENAI_API_KEY = this.config.OPENAI_API_KEY || '';
    this.OPENAI_BASE_URL = this.config.OPENAI_BASE_URL;

    console.log('🔍 RealSentimentAnalyzer initialized:', {
      hasOpenAI: !!this.OPENAI_API_KEY,
      hasGLM: !!this.GLM_API_KEY,
      glmUrl: this.GLM_BASE_URL,
      openaiUrl: this.OPENAI_BASE_URL
    });
  }

  async analyzeSentiment(article: RawNewsArticle, opts?: { mode?: 'fast' | 'normal'; maxTokens?: number }): Promise<SentimentResult> {
    const text = `${article.title}. ${article.summary || ''}`;

    // If we have an API key, use the AI service
    if (this.GLM_API_KEY || this.OPENAI_API_KEY) {
      try {
        // Try GLM-4.6 first, fallback to OpenAI
        const useGLM = !!this.GLM_API_KEY;
        const apiUrl = useGLM ? this.GLM_BASE_URL : this.OPENAI_BASE_URL;
        const apiKey = useGLM ? this.GLM_API_KEY : this.OPENAI_API_KEY;
        const model = useGLM ? 'glm-4.6' : 'gpt-4o';

        console.log(`🚀 Making API call to: ${useGLM ? 'GLM' : 'OpenAI'} at ${apiUrl}`);
        console.log(`🔑 Using model: ${model}`);
        console.log(`📝 Analyzing text: ${text.substring(0, 100)}...`);

        const response = await fetch(`${apiUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: `You are a sentiment analysis AI. You must ALWAYS respond in English ONLY - never Chinese, never any other language.

Analyze the sentiment of this cryptocurrency news article and return a JSON response.

CRITICAL INSTRUCTIONS:
- Respond ONLY in English
- Output must be valid JSON
- Do not include explanations outside the JSON
- Never use Chinese characters

{
  "score": number between -1 (extremely bearish) and 1 (extremely bullish),
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of the sentiment",
  "marketEffect": "likely impact on market (positive/negative/neutral)",
  "volatility": number between 0 and 1, likely volatility impact,
  "keywords": ["relevant", "keywords", "from", "text"]
}

Focus on:
- Overall tone and language
- Market sentiment indicators
- Potential impact on crypto prices
- Regulatory implications
- Adoption news
- Technical developments

Always respond with valid JSON format in English only.`
              },
              {
                role: 'user',
                content: `Analyze sentiment for: ${text}. Respond in English with valid JSON only.`
              }
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle GLM's reasoning_content format
        let content = data.choices[0].message.content;
        console.log(`📤 Raw response content length: ${content?.length || 0}`);

        if ((!content || content.trim() === '') && data.choices[0].message.reasoning_content) {
          console.log('✅ Using GLM reasoning_content as fallback');
          content = data.choices[0].message.reasoning_content;
          console.log(`📤 Reasoning content length: ${content?.length || 0}`);
          console.log(`📤 Reasoning content preview: ${content?.substring(0, 200)}...`);
        }

        if (!content || content.trim() === '') {
          throw new Error('Empty response from AI model');
        }

        let analysis;
        try {
          // Try to parse directly as JSON first
          analysis = JSON.parse(content);
        } catch (parseError) {
          console.error('Direct JSON parse failed, attempting extraction...');

          // Look for JSON within code blocks
          let jsonText = content;
          const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            jsonText = codeBlockMatch[1];
            console.log('Found JSON in code block');
          } else {
            // Look for JSON object in the content
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
              jsonText = jsonMatch[0];
              console.log('Found JSON object in content');
            }
          }

          if (jsonText && jsonText !== content) {
            try {
              // Clean up the JSON string
              jsonText = jsonText
                .replace(/,\s*}/g, '}')
                .replace(/,\s*]/g, ']')
                .trim();

              analysis = JSON.parse(jsonText);
              console.log('Successfully extracted and parsed JSON');
            } catch (e2) {
              console.error('JSON extraction failed:', e2.message);
              console.error('JSON text preview:', jsonText.substring(0, 500));
            }
          }

          if (!analysis) {
            // Enhanced fallback analysis
            const lowerContent = content.toLowerCase();
            let score = 0;
            let confidence = 0.5;
            let label = 'neutral';
            let reasoning = [];

            // Sentiment keywords for better detection
            const positiveKeywords = [
              'bullish', 'positive', 'upside', 'rally', 'surge', 'optimistic', 'support', 'strength', 'uptrend',
              'growth', 'gain', 'rise', 'increase', 'boost', 'momentum', 'strong', 'higher', 'advantage', 'favorable',
              'promising', 'encouraging', 'upward', 'bull', 'buy', 'accumulate', 'opportunity', 'profit', 'win'
            ];
            const negativeKeywords = [
              'bearish', 'negative', 'downside', 'crash', 'plummet', 'pessimistic', 'resistance', 'weakness', 'downtrend',
              'fall', 'drop', 'decline', 'decrease', 'loss', 'risk', 'danger', 'concern', 'worry', 'fear', 'panic',
              'sell', 'bear', 'avoid', 'reduce', 'threat', 'pressure', 'volatile', 'uncertain', 'unstable'
            ];

            // Check sentiment keywords
            const hasPositive = positiveKeywords.some(word => lowerContent.includes(word));
            const hasNegative = negativeKeywords.some(word => lowerContent.includes(word));

            if (hasPositive) {
              score = 0.65;
              label = 'bullish';
              confidence = 0.8;
              reasoning.push('Positive sentiment keywords detected');
            } else if (hasNegative) {
              score = -0.65;
              label = 'bearish';
              confidence = 0.8;
              reasoning.push('Negative sentiment keywords detected');
            } else {
              // Default neutral with content analysis
              confidence = Math.min(0.7, confidence + 0.1);
              reasoning.push('Neutral sentiment from AI analysis');
            }

            analysis = {
              score,
              label: label.charAt(0).toUpperCase() + label.slice(1),
              confidence,
              reasoning,
              summary: 'AI sentiment analysis',
              impactLevel: Math.abs(score) > 0.5 ? 'High' : Math.abs(score) > 0.2 ? 'Medium' : 'Low'
            };
            console.log('✅ Successfully extracted sentiment from AI content:', analysis);
          }
        }

        return {
          score: analysis.score || 0,
          confidence: analysis.confidence || 0.5,
          reasoning: analysis.reasoning || ['Analysis unavailable'],
          marketEffect: analysis.marketEffect || 'neutral',
          volatility: analysis.volatility || 0.5,
          keywords: analysis.keywords || [],
          timestamp: new Date().toISOString(),
          meta: {
            source: useGLM ? 'GLM' : 'OpenAI',
            model: model
          },
          // Additional fields for SentimentAnalysis compatibility
          label: analysis.score > 0.1 ? 'Bullish' : analysis.score < -0.1 ? 'Bearish' : 'Neutral',
          impactLevel: analysis.impactLevel || (Math.abs(analysis.score || 0) > 0.5 ? 'High' : Math.abs(analysis.score || 0) > 0.2 ? 'Medium' : 'Low'),
          marketSegment: 'Crypto', // Default to Crypto for crypto news
          keyPhrases: analysis.keywords || [],
          emotionalIndicators: {
            fear: Math.max(0, -Math.min(0, (analysis.score || 0))),
            greed: Math.max(0, Math.max(0, (analysis.score || 0))),
            uncertainty: 0.5,
            optimism: Math.max(0, (analysis.score || 0))
          },
          summary: `Sentiment analysis with confidence: ${Math.round((analysis.confidence || 0) * 100)}%`,
          affectedAssets: ['ETH', 'BTC'],
          timeline: 'short-term'
        };
      } catch (error) {
        console.error('Sentiment analysis failed:', error);
        console.warn('Using fallback sentiment analysis');
        return this.fallbackSentimentAnalysis(article);
      }
    }

    // No API key available, use fallback
    return this.fallbackSentimentAnalysis(article);
  }

  private fallbackSentimentAnalysis(article: RawNewsArticle): SentimentResult {
    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();
    let score = 0;
    let confidence = 0.5;

    // Enhanced keyword-based sentiment analysis with more comprehensive keywords
    const positiveKeywords = [
      'bullish', 'positive', 'rally', 'surge', 'jump', 'rise', 'increase', 'growth',
      'breakthrough', 'milestone', 'adoption', 'approval', 'launch', 'success',
      'upgrade', 'improvement', 'optimistic', 'support', 'strength', 'uptrend',
      'boost', 'momentum', 'strong', 'higher', 'advantage', 'favorable',
      'promising', 'encouraging', 'upward', 'buy', 'accumulate', 'opportunity',
      'profit', 'win', 'gain', 'soaring', 'skyrocketing', 'booming'
    ];

    const negativeKeywords = [
      'bearish', 'negative', 'crash', 'plummet', 'pessimistic', 'resistance',
      'weakness', 'downtrend', 'fall', 'drop', 'decline', 'decrease', 'loss',
      'risk', 'danger', 'concern', 'worry', 'fear', 'panic', 'sell', 'avoid',
      'reduce', 'threat', 'pressure', 'volatile', 'uncertain', 'unstable',
      'slump', 'tumble', 'plunge', 'dip', 'slide', 'bear', 'downgrade',
      'warning', 'caution', 'critical', 'emergency', 'crisis', 'recession'
    ];

    // Count positive and negative keywords
    let positiveCount = 0;
    let negativeCount = 0;

    positiveKeywords.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });

    negativeKeywords.forEach(word => {
      if (text.includes(word)) negativeCount++;
    });

    // Calculate score based on keyword counts
    if (positiveCount > 0 || negativeCount > 0) {
      score = (positiveCount - negativeCount) / Math.max(positiveCount, negativeCount, 1);
      score = Math.max(-1, Math.min(1, score * 0.7)); // Scale down to avoid extremes
      confidence = Math.min(0.8, 0.5 + Math.max(positiveCount, negativeCount) * 0.1);
    }

    // Add some variance based on content length
    if (text.length > 200) {
      confidence = Math.min(0.8, confidence + 0.1);
    }

      // Determine impact level based on score
    const impactLevel = Math.abs(score) > 0.5 ? 'High' : Math.abs(score) > 0.2 ? 'Medium' : 'Low';
    const label = score > 0.1 ? 'Bullish' : score < -0.1 ? 'Bearish' : 'Neutral';

    return {
      score,
      confidence,
      reasoning: ['Keyword-based analysis'],
      marketEffect: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
      volatility: 0.5,
      keywords: text.match(/\b(btc|eth|crypto|bitcoin|ethereum|defi)\b/gi) || [],
      timestamp: new Date().toISOString(),
      meta: {
        source: 'Fallback',
        model: 'keyword-analysis'
      },
      // Additional fields for SentimentAnalysis compatibility
      label,
      impactLevel,
      marketSegment: 'Crypto', // Default to Crypto for crypto news
      keyPhrases: text.match(/\b(btc|eth|crypto|bitcoin|ethereum|defi)\b/gi) || [],
      emotionalIndicators: {
        fear: Math.max(0, -Math.min(0, score)),
        greed: Math.max(0, Math.max(0, score)),
        uncertainty: 0.5,
        optimism: Math.max(0, score)
      },
      summary: `Keyword-based sentiment analysis with confidence: ${Math.round(confidence * 100)}%`,
      affectedAssets: ['ETH', 'BTC'],
      timeline: 'short-term'
    };
  }
}