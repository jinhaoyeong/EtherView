import { NextResponse } from 'next/server';
import { WalletAPI } from '@/lib/api/wallet';

export async function GET() {
  const started = performance.now();
  try {
    const ethPrice = await WalletAPI.fetchETHPrice();
    const available = Number.isFinite(ethPrice) && ethPrice > 0;
    return NextResponse.json({
      status: available ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      components: { pricing: { status: available ? 'operational' : 'unavailable', ethPrice: available ? ethPrice : null } },
      performance: { responseTimeMs: Math.round(performance.now() - started) }
    }, { status: available ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'degraded', components: { pricing: { status: 'unavailable' } } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
