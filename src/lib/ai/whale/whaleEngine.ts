/**
 * Whale Movement Detection and Impact Analysis Engine
 * Identifies large transfers and estimates market impact
 */

export interface WhaleEvent {
  id: string;
  timestamp: number;
  hash: string;
  tokenSymbol: string;
  tokenAddress: string;
  valueUSD: number;
  amount: string;
  fromAddress: string;
  toAddress: string;
  transferType: 'wallet_to_wallet' | 'wallet_to_exchange' | 'exchange_to_wallet' | 'exchange_to_exchange';
  confidenceScore: number;
  impactScore: number;
  aiAnalysis: {
    significance: string;
    marketImplications: string;
    historicalContext: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  priceCorrelation?: {
    priceChange: number;
    timeWindow: string;
    correlation: number;
  };
}

export interface WhaleMovementResult {
  events: WhaleEvent[];
  summary: {
    totalEvents: number;
    exchangeInflows: number;
    exchangeOutflows: number;
    avgImpact: number;
    highImpactEvents: number;
  };
  timeframe: {
    start: string;
    end: string;
  };
  lastAnalyzed: string;
}

export interface ImpactEstimate {
  immediateImpact: number; // -1 to 1
  shortTermImpact: number; // -1 to 1
  confidence: number;
  factors: string[];
  estimatedSlippage?: number;
  liquidityDepth?: number;
}

export class WhaleMovementEngine {
  private readonly WHALE_THRESHOLD_USD = 1000000; // $1M
  private readonly HIGH_IMPACT_THRESHOLD = 0.7;
  private readonly EXCHANGE_ADDRESSES = new Set([
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase(), // Uniswap V2 Router
    '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
    // Add more known exchange addresses
  ]);

  async analyzeWhaleMovements(walletAddress?: string): Promise<WhaleMovementResult> {
    // Fetch recent large transactions
    const largeTransactions = await this.fetchLargeTransactions(walletAddress);

    // Analyze each transaction for whale characteristics
    const whaleEvents = await Promise.all(
      largeTransactions.map(tx => this.analyzeWhaleEvent(tx))
    );

    // Generate summary statistics
    const summary = this.generateSummary(whaleEvents);

    return {
      events: whaleEvents,
      summary,
      timeframe: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
        end: new Date().toISOString()
      },
      lastAnalyzed: new Date().toISOString()
    };
  }

  async estimateMarketImpact(whaleEvent: WhaleEvent): Promise<ImpactEstimate> {
    const factors: string[] = [];
    let immediateImpact = 0;
    let shortTermImpact = 0;

    // Transfer type impact
    switch (whaleEvent.transferType) {
      case 'wallet_to_exchange':
        immediateImpact = -0.3; // Selling pressure
        factors.push('Large transfer to exchange suggests selling intention');
        break;
      case 'exchange_to_wallet':
        immediateImpact = 0.2; // Accumulation
        factors.push('Transfer from exchange suggests accumulation');
        break;
      case 'wallet_to_wallet':
        immediateImpact = 0.1; // Neutral to slightly positive
        factors.push('Whale-to-whale transfer, minimal immediate market impact');
        break;
      case 'exchange_to_exchange':
        immediateImpact = 0.05; // Minimal impact
        factors.push('Internal exchange transfer, low market impact');
        break;
    }

    // Value-based impact scaling
    const valueMultiplier = Math.log10(whaleEvent.valueUSD / 1000000); // Log scale based on millions
    immediateImpact *= Math.min(2, valueMultiplier);

    // Confidence based on transfer type and amount
    const confidence = Math.min(0.95, 0.5 + valueMultiplier * 0.2);

    // Historical correlation adjustment
    if (whaleEvent.priceCorrelation) {
      shortTermImpact = whaleEvent.priceCorrelation.priceChange * 0.5;
      factors.push(`Historical correlation: ${whaleEvent.priceCorrelation.correlation.toFixed(2)}`);
    }

    return {
      immediateImpact: Math.max(-1, Math.min(1, immediateImpact)),
      shortTermImpact: Math.max(-1, Math.min(1, shortTermImpact)),
      confidence,
      factors,
      estimatedSlippage: this.estimateSlippage(whaleEvent),
      liquidityDepth: await this.estimateLiquidityDepth(whaleEvent.tokenAddress)
    };
  }

  private async fetchLargeTransactions(walletAddress?: string) {
    // Mock implementation - would query blockchain APIs
    return [
      {
        hash: '0x123...abc',
        timestamp: Date.now() - 3600000, // 1 hour ago
        tokenSymbol: 'ETH',
        tokenAddress: '0x000...000',
        amount: '5000',
        fromAddress: '0xabc...123',
        toAddress: '0xdef...456',
        valueUSD: 8500000 // $8.5M
      },
      {
        hash: '0x456...def',
        timestamp: Date.now() - 7200000, // 2 hours ago
        tokenSymbol: 'USDC',
        tokenAddress: '0xA0b...8ec',
        amount: '10000000',
        fromAddress: '0x789...012',
        toAddress: '0x345...678',
        valueUSD: 10000000 // $10M
      },
      {
        hash: '0x789...012',
        timestamp: Date.now() - 10800000, // 3 hours ago
        tokenSymbol: 'SHIB',
        tokenAddress: '0x95a...993',
        amount: '1000000000000',
        fromAddress: '0x234...567',
        toAddress: '0x890...123',
        valueUSD: 15000000 // $15M
      }
    ];
  }

  private async analyzeWhaleEvent(transaction: any): Promise<WhaleEvent> {
    const transferType = this.classifyTransferType(transaction.fromAddress, transaction.toAddress);
    const confidenceScore = this.calculateConfidenceScore(transaction, transferType);
    const impactScore = this.calculateImpactScore(transaction, transferType);
    const aiAnalysis = await this.generateAIAnalysis(transaction, transferType);

    return {
      id: transaction.hash,
      timestamp: transaction.timestamp,
      hash: transaction.hash,
      tokenSymbol: transaction.tokenSymbol,
      tokenAddress: transaction.tokenAddress,
      valueUSD: transaction.valueUSD,
      amount: transaction.amount,
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      transferType,
      confidenceScore,
      impactScore,
      aiAnalysis,
      priceCorrelation: await this.analyzePriceCorrelation(transaction)
    };
  }

  private classifyTransferType(fromAddress: string, toAddress: string): WhaleEvent['transferType'] {
    const fromIsExchange = this.isExchangeAddress(fromAddress);
    const toIsExchange = this.isExchangeAddress(toAddress);

    if (fromIsExchange && toIsExchange) return 'exchange_to_exchange';
    if (fromIsExchange && !toIsExchange) return 'exchange_to_wallet';
    if (!fromIsExchange && toIsExchange) return 'wallet_to_exchange';
    return 'wallet_to_wallet';
  }

  private isExchangeAddress(address: string): boolean {
    return this.EXCHANGE_ADDRESSES.has(address.toLowerCase());
  }

  private calculateConfidenceScore(transaction: any, transferType: WhaleEvent['transferType']): number {
    let score = 0.5;

    // Higher value = higher confidence
    const valueScore = Math.min(0.3, Math.log10(transaction.valueUSD / 1000000) * 0.1);
    score += valueScore;

    // Exchange transfers have higher confidence
    if (transferType.includes('exchange')) {
      score += 0.2;
    }

    // Known exchanges increase confidence
    if (this.isExchangeAddress(transaction.fromAddress) || this.isExchangeAddress(transaction.toAddress)) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private calculateImpactScore(transaction: any, transferType: WhaleEvent['transferType']): number {
    let score = 0;

    // Base impact from value
    const valueImpact = Math.log10(transaction.valueUSD / 1000000) / 2; // Normalize to 0-1 range
    score += valueImpact * 0.4;

    // Transfer type impact
    const typeImpacts = {
      'wallet_to_exchange': 0.4, // Highest impact (selling)
      'exchange_to_wallet': 0.3, // High impact (accumulation)
      'wallet_to_wallet': 0.2, // Medium impact
      'exchange_to_exchange': 0.1 // Lowest impact
    };
    score += typeImpacts[transferType];

    return Math.min(1.0, score);
  }

  private async generateAIAnalysis(transaction: any, transferType: WhaleEvent['transferType']) {
    const significance = this.generateSignificanceText(transaction, transferType);
    const marketImplications = this.generateMarketImplications(transaction, transferType);
    const historicalContext = this.generateHistoricalContext(transaction);
    const riskLevel = this.determineRiskLevel(transaction, transferType);

    return {
      significance,
      marketImplications,
      historicalContext,
      riskLevel
    };
  }

  private generateSignificanceText(transaction: any, transferType: WhaleEvent['transferType']): string {
    const valueText = `$${(transaction.valueUSD / 1000000).toFixed(1)}M`;

    switch (transferType) {
      case 'wallet_to_exchange':
        return `Large transfer of ${valueText} worth of ${transaction.tokenSymbol} to exchange suggests potential selling pressure`;
      case 'exchange_to_wallet':
        return `Significant accumulation of ${valueText} worth of ${transaction.tokenSymbol} from exchange to private wallet`;
      case 'wallet_to_wallet':
        return `${valueText} ${transaction.tokenSymbol} transfer between whale wallets, potentially repositioning assets`;
      case 'exchange_to_exchange':
        return `${valueText} ${transaction.tokenSymbol} moved between exchanges, likely institutional rebalancing`;
      default:
        return `Notable ${transaction.tokenSymbol} transaction worth ${valueText}`;
    }
  }

  private generateMarketImplications(transaction: any, transferType: WhaleEvent['transferType']): string {
    switch (transferType) {
      case 'wallet_to_exchange':
        return `This could create downward pressure on ${transaction.tokenSymbol} price if the holder intends to sell. Monitor order books for large sell walls.`;
      case 'exchange_to_wallet':
        return `This accumulation signal could be bullish for ${transaction.tokenSymbol}. Large holders often move assets to cold storage for long-term holding.`;
      case 'wallet_to_wallet':
        return `While not immediately market-impacting, this could indicate portfolio rebalancing or OTC deal execution.`;
      case 'exchange_to_exchange':
        return `Likely operational transfer with minimal market impact. Could be related to liquidity management across platforms.`;
      default:
        return `Monitor for follow-up transactions to determine market intent.`;
    }
  }

  private generateHistoricalContext(transaction: any): string {
    // Mock historical context - would analyze historical patterns
    const contexts = [
      'Similar transfers in the past have preceded 15-30 minute price adjustments of 2-5%',
      'This wallet has made 3 similar large transfers in the past month, typically during high volatility periods',
      'Historical data shows exchange outflows of this magnitude often precede price rallies within 24-48 hours',
      'This pattern is consistent with institutional accumulation behavior seen in previous market cycles'
    ];

    return contexts[Math.floor(Math.random() * contexts.length)];
  }

  private determineRiskLevel(transaction: any, transferType: WhaleEvent['transferType']): 'low' | 'medium' | 'high' {
    if (transaction.valueUSD > 50000000) return 'high'; // >$50M
    if (transferType === 'wallet_to_exchange' && transaction.valueUSD > 10000000) return 'high';
    if (transaction.valueUSD > 10000000) return 'medium';
    if (transferType === 'wallet_to_exchange') return 'medium';
    return 'low';
  }

  private async analyzePriceCorrelation(transaction: any) {
    // Mock correlation analysis - would analyze price data around transaction time
    return {
      priceChange: (Math.random() - 0.5) * 0.1, // -5% to +5%
      timeWindow: '1h',
      correlation: (Math.random() - 0.5) * 0.8 // -0.8 to 0.8
    };
  }

  private estimateSlippage(whaleEvent: WhaleEvent): number {
    // Estimate slippage based on transaction size relative to market depth
    const sizePercent = whaleEvent.valueUSD / 1000000; // Size in millions
    return Math.min(0.1, sizePercent * 0.01); // Max 10% slippage
  }

  private async estimateLiquidityDepth(tokenAddress: string): Promise<number> {
    // Mock liquidity depth estimation - would query DEX reserves
    return Math.random() * 10000000; // $0-$10M liquidity
  }

  private generateSummary(events: WhaleEvent[]) {
    const totalEvents = events.length;
    const exchangeInflows = events.filter(e => e.transferType === 'exchange_to_wallet').length;
    const exchangeOutflows = events.filter(e => e.transferType === 'wallet_to_exchange').length;
    const avgImpact = events.reduce((sum, e) => sum + e.impactScore, 0) / totalEvents;
    const highImpactEvents = events.filter(e => e.impactScore > this.HIGH_IMPACT_THRESHOLD).length;

    return {
      totalEvents,
      exchangeInflows,
      exchangeOutflows,
      avgImpact,
      highImpactEvents
    };
  }
}

export const whaleMovementEngine = new WhaleMovementEngine();