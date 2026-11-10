import { NextRequest, NextResponse } from 'next/server';
import { isEthereumAddress } from '@/lib/api/request-validation';

const cache = new Map<string, { holders: number; ts: number }>();

export async function GET(req: NextRequest) {
  const address = (new URL(req.url).searchParams.get('address') || '').toLowerCase();
  if (!isEthereumAddress(address)) return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
  const cached = cache.get(address);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return NextResponse.json({ holders: cached.holders });
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) return NextResponse.json({ holders: null, status: 'unavailable' });
  try {
    // Holder LIST rows do not contain a total count. Use the dedicated PRO count endpoint.
    // https://docs.etherscan.io/api-reference/endpoint/tokenholdercount
    const params = new URLSearchParams({ chainid: '1', module: 'token', action: 'tokenholdercount', contractaddress: address, apikey: key });
    const response = await fetch(`https://api.etherscan.io/v2/api?${params}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (response.ok) {
      const data = await response.json();
      const holders = Number(data.result);
      if (data.status === '1' && /^\d+$/.test(String(data.result)) && Number.isSafeInteger(holders) && holders >= 0) {
        if (cache.size >= 500) cache.delete(cache.keys().next().value!);
        cache.set(address, { holders, ts: Date.now() });
        return NextResponse.json({ holders, status: 'available' });
      }
    }
  } catch { /* Provider outages and unavailable paid endpoints are unknown, never zero. */ }
  return NextResponse.json({ holders: null, status: 'unavailable' });
}
