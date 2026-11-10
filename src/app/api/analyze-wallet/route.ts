// Next.js API Route for wallet risk screening
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'
import { WalletAPI } from '@/lib/api/wallet';
import { isEthereumAddress } from '@/lib/api/request-validation';

interface TokenInfo {
  symbol?: string;
  name?: string;
  address?: string;
  decimals?: number;
  balance?: string;
  priceUSD?: number;
  valueUSD?: number;
  verified?: boolean;
  hasNoPriceData?: boolean;
  chain?: string;
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let walletAddress: string | undefined = url.searchParams.get('walletAddress') || url.searchParams.get('wallet') || undefined;
    let timeRange: string = url.searchParams.get('timeRange') || '24h';
    let providedTokens: TokenInfo[] = [];
    let hasProvidedTokens = false;
    let scope = url.searchParams.get('scope') || '';
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > 256 * 1024) return NextResponse.json({ error: 'Analysis request body is too large' }, { status: 413 });
        const body = JSON.parse(raw);
        walletAddress = body?.walletAddress;
        timeRange = body?.timeRange || '24h';
        if (body?.scope !== undefined) scope = body.scope;
        if (body?.tokens !== undefined && !Array.isArray(body.tokens)) return NextResponse.json({ error: 'Token data must be an array' }, { status: 400 });
        hasProvidedTokens = Array.isArray(body?.tokens);
        const bodyTokens = Array.isArray(body?.tokens) ? body.tokens : [];
        if (bodyTokens.length > 0) {
          providedTokens = bodyTokens as TokenInfo[];
        }
      }
    } catch {
      return NextResponse.json({ error: 'Invalid analysis JSON' }, { status: 400 });
    }

    if (!isEthereumAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    if (providedTokens.length > 300 || providedTokens.some(token =>
      !token || !isEthereumAddress(token.address) ||
      (token.symbol !== undefined && (typeof token.symbol !== 'string' || token.symbol.length > 64)) ||
      (token.name !== undefined && (typeof token.name !== 'string' || token.name.length > 256)) ||
      (token.balance !== undefined && (typeof token.balance !== 'string' || token.balance.length > 1000 || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token.balance))) ||
      (token.decimals !== undefined && (!Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 255)) ||
      (token.priceUSD !== undefined && (!Number.isFinite(token.priceUSD) || token.priceUSD < 0)) ||
      (token.valueUSD !== undefined && (!Number.isFinite(token.valueUSD) || token.valueUSD < 0))
    )) {
      return NextResponse.json({ error: 'Invalid token data or more than 300 tokens' }, { status: 400 });
    }
    if (!['1h', '24h', '7d', '30d', '90d', '1y', 'all'].includes(timeRange)) {
      return NextResponse.json({ error: 'Invalid time range' }, { status: 400 });
    }

    if (scope !== 'risk') return NextResponse.json({ error: 'Invalid analysis scope' }, { status: 400 });
    const tokens = hasProvidedTokens ? providedTokens : await WalletAPI.getPortfolioTokens(walletAddress);
    const validated = (tokens as TokenInfo[]).filter(token => token && isEthereumAddress(token.address));
    if (validated.length > 300) return NextResponse.json({ error: 'More than 300 tokens' }, { status: 400 });
    const { screenTokenMetadata } = await import('@/lib/ai/scam/screenTokens');
    const scam = await screenTokenMetadata(validated as import('@/lib/ai/scam/screenTokens').ScreeningToken[], walletAddress);
    return NextResponse.json({ success: true, data: { scam }, metadata: { scope: 'risk', coverage: scam.coverage } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Wallet risk screening failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      success: false,
      data: null,
      error: 'Failed to analyze wallet. Try again when data providers recover.',
    }, { status: 502 });
  }
}
