/**
 * Cost-saving configuration for GLM API usage
 * Optimized for $3 budget to maximize usage
 */

export const COST_CONFIG = {
  // GLM-4.6 estimated pricing (approximate)
  PRICING: {
    inputCostPer1K: 0.0025,  // ~$0.0025 per 1K input tokens (estimated)
    outputCostPer1K: 0.0075,  // ~$0.0075 per 1K output tokens (estimated)
  },

  // Cost-saving limits
  LIMITS: {
    maxTokensPerRequest: 300,     // Hard limit for any single request
    maxArticlesPerBatch: 3,       // Process fewer articles at once
    maxDailyRequests: 100,        // Daily request limit to stay within budget

    // News feed limits
    maxNewsArticles: 5,           // Maximum 5 articles in news feed (major cost saving)
    summaryLength: 100,           // Characters for summary view
    maxSentimentAnalyses: 5,      // Max articles to analyze for sentiment (all displayed articles)

    // Budget tracking
    dailyBudget: 3.00,            // $3 daily budget
    costPerAnalysis: 0.02,        // Estimated cost per sentiment analysis

    // Cache duration (longer cache = fewer API calls)
    cacheDuration: {
      sentiment: 30 * 60 * 1000,  // 30 minutes (was 15)
      prediction: 60 * 60 * 1000, // 1 hour (was 30)
      news: 10 * 60 * 1000,       // 10 minutes (was 5)
    }
  },

  // Model settings for cost efficiency
  MODEL_SETTINGS: {
    temperature: 0.1,             // Lower temperature = more deterministic, less cost
    topP: 0.9,                    // Slightly restrict sampling
    presencePenalty: 0,           // No penalty for repetition
    frequencyPenalty: 0,          // No penalty for frequency
  },

  // Fast mode settings (minimal API usage)
  FAST_MODE: {
    enabled: true,                // Enable fast mode by default
    sampleSize: 5,                // Analyze only 5 articles instead of 20
    skipSocialAnalysis: true,     // Skip expensive social media aggregation
    useSimplePredictions: true,   // Use simpler prediction model
  }
};

/**
 * Estimate cost for an API call
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  const { PRICING } = COST_CONFIG;
  return (inputTokens / 1000) * PRICING.inputCostPer1K +
         (outputTokens / 1000) * PRICING.outputCostPer1K;
}

/**
 * Check if we can afford another request
 */
export function canAffordRequest(estimatedCost: number, spentToday: number): boolean {
  return (spentToday + estimatedCost) <= COST_CONFIG.LIMITS.dailyBudget;
}

/**
 * Get cost-effective max tokens based on budget remaining
 */
export function getCostEffectiveMaxTokens(budgetRemaining: number): number {
  const baseTokens = 150;  // Minimum viable tokens
  const maxTokens = Math.min(
    COST_CONFIG.LIMITS.maxTokensPerRequest,
    Math.floor((budgetRemaining / COST_CONFIG.PRICING.outputCostPer1K) * 100)
  );
  return Math.max(baseTokens, maxTokens);
}