import { NextRequest, NextResponse } from 'next/server'
import { sentimentAnalysisEngine } from '@/lib/ai/sentiment/sentimentEngine'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const walletAddress = url.searchParams.get('walletAddress') || undefined
    const forceRefreshParam = url.searchParams.get('forceRefresh') || '0'
    const forceRefresh = forceRefreshParam === '1' || forceRefreshParam.toLowerCase() === 'true'

    const result = await sentimentAnalysisEngine.analyzeMarketSentiment(walletAddress, forceRefresh)
    const payload = { ...result }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0'
      }
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to analyze sentiment' }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0'
      }
    })
  }
}
