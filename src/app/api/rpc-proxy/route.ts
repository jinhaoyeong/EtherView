import { NextRequest, NextResponse } from 'next/server';
import { isReadOnlyRpcPayload } from '@/lib/api/request-validation';

export const runtime = 'nodejs';

const RPC_URLS = [
  process.env.ALCHEMY_API_KEY ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : null,
  'https://ethereum.publicnode.com',
  'https://cloudflare-eth.com',
  'https://eth.llamarpc.com'
].filter(Boolean) as string[];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 64 * 1024) {
      return NextResponse.json({ error: 'RPC payload too large' }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isReadOnlyRpcPayload(body)) {
    return NextResponse.json({ error: 'Only supported read-only JSON-RPC requests are allowed (maximum 50 per batch)' }, { status: 400 });
  }

  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000)
      });
      if (!response.ok) continue;
      const data = await response.json();
      // Some providers respond with HTTP 200 on rate limits and outages. Try the next one.
      const results = Array.isArray(data) ? data : [data];
      if (!results.length || results.every(item => item?.error && [-32005, -32016, -32603, 429].includes(item.error.code))) continue;
      return NextResponse.json(data);
    } catch {
      // URLs can contain provider credentials; never log the URL or fetch error object.
      console.warn('An Ethereum RPC provider was unavailable');
    }
  }
  return NextResponse.json({ error: 'Ethereum RPC providers are unavailable' }, { status: 502 });
}
