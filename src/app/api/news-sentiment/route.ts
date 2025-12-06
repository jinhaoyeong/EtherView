import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { sentimentAnalysisEngine } from '@/lib/ai/sentiment/sentimentEngine';
import { performanceManager } from '@/lib/ai/sentiment/performanceManager';

export async function GET(req: NextRequest) {
  const startTime = performance.now();

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('walletAddress') || undefined;
    const forceRefreshParam = url.searchParams.get('forceRefresh') || '0';
    const fastParam = url.searchParams.get('fast') || '1'; // Default to fast mode to save quota
    const forceRefresh = forceRefreshParam === '1' || forceRefreshParam.toLowerCase() === 'true';
    const fast = fastParam === '1' || fastParam.toLowerCase() === 'true';

    console.log(`📊 API: News sentiment request (forceRefresh: ${forceRefresh}, fast: ${fast}, wallet: ${walletAddress || 'none'})`);

    const result = await sentimentAnalysisEngine.analyzeMarketSentiment(walletAddress, forceRefresh, fast);
    const processingTime = performance.now() - startTime;

    const payload = {
      success: true,
      data: result,
      metadata: {
        processingTime: `${processingTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString(),
        apiVersion: '2.0.0',
        performance: {
          cacheHitRate: performanceManager.getCacheStats().hitRate,
          serviceHealth: performanceManager.getServiceHealthSummary()
        }
      }
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': fast ? 'public, max-age=300' : 'public, max-age=600', // 5-10 minute cache
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error('❌ News sentiment API error:', error);

    const errorResponse = {
      success: false,
      error: {
        message: 'Failed to analyze market sentiment',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: `${processingTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString(),
        suggestion: 'Please try again in a few minutes or contact support if the issue persists'
      }
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Content-Type': 'application/json'
      }
    });
  }
}

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    const body = await req.json();
    const {
      forceRefresh = false,
      fast = false,
      walletAddress,
      customArticles,
      preferences = {}
    } = body;

    console.log(`📊 API: POST news sentiment request (forceRefresh: ${forceRefresh}, fast: ${fast})`);

    // Enhanced request processing with preferences
    const result = await sentimentAnalysisEngine.analyzeMarketSentiment(
      walletAddress,
      forceRefresh,
      fast
    );

    const processingTime = performance.now() - startTime;

    const payload = {
      success: true,
      data: result,
      metadata: {
        processingTime: `${processingTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString(),
        requestType: 'POST',
        customArticleCount: customArticles?.length || 0,
        preferences: Object.keys(preferences).length > 0 ? preferences : undefined,
        apiVersion: '2.0.0'
      }
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error('❌ POST news sentiment API error:', error);

    const errorResponse = {
      success: false,
      error: {
        message: 'Failed to process sentiment analysis request',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: `${processingTime.toFixed(0)}ms`,
        timestamp: new Date().toISOString(),
        requestType: 'POST'
      }
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Content-Type': 'application/json'
      }
    });
  }
}
