import { NextRequest, NextResponse } from 'next/server';
import { sentimentAnalysisEngine } from '@/lib/ai/sentiment/sentimentEngine';
import { performanceManager } from '@/lib/ai/sentiment/performanceManager';
import { isEthereumAddress } from '@/lib/api/request-validation';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };
type AnalysisOptions = { walletAddress?: string; forceRefresh: boolean; fast: boolean };

function validWallet(value: unknown): value is string | undefined {
  return value === undefined || isEthereumAddress(value);
}
function badRequest() {
  return NextResponse.json({ success: false, error: { message: 'Invalid news request. Use a valid Ethereum address and boolean analysis options.' } }, { status: 400, headers: noStore });
}
async function analyze(options: AnalysisOptions, requestType: 'GET' | 'POST') {
  const start = performance.now();
  try {
    const result = await sentimentAnalysisEngine.analyzeMarketSentiment(options.walletAddress, options.forceRefresh, options.fast);
    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        processingTime: `${Math.round(performance.now() - start)}ms`,
        timestamp: new Date().toISOString(),
        requestType,
        apiVersion: '2.0.0',
        performance: { cacheHitRate: performanceManager.getCacheStats().hitRate, serviceHealth: performanceManager.getServiceHealthSummary() },
      },
    }, { headers: noStore });
  } catch {
    // Provider outages are recoverable; never return stack traces or credentials.
    return NextResponse.json({ success: false, error: { message: 'News sources are temporarily unavailable. Try again shortly.' } }, { status: 503, headers: { ...noStore, 'Retry-After': '30' } });
  }
}
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const walletAddress = params.get('walletAddress') || undefined;
  const force = params.get('forceRefresh') || '0';
  const fast = params.get('fast') || '1';
  if (!validWallet(walletAddress) || !/^(0|1|true|false)$/i.test(force) || !/^(0|1|true|false)$/i.test(fast)) return badRequest();
  return analyze({ walletAddress, forceRefresh: /^(1|true)$/i.test(force), fast: /^(1|true)$/i.test(fast) }, 'GET');
}
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).length > 16_384) return NextResponse.json({ success: false, error: { message: 'Request body is too large' } }, { status: 413, headers: noStore });
    body = JSON.parse(text);
  } catch { return badRequest(); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest();
  const input = body as Record<string, unknown>;
  if (!validWallet(input.walletAddress) || (input.forceRefresh !== undefined && typeof input.forceRefresh !== 'boolean') || (input.fast !== undefined && typeof input.fast !== 'boolean')) return badRequest();
  // Custom article analysis is not implemented; do not pretend it was analyzed.
  if (input.customArticles !== undefined) return badRequest();
  return analyze({ walletAddress: input.walletAddress, forceRefresh: input.forceRefresh === true, fast: input.fast !== false }, 'POST');
}
