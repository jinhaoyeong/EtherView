import { NextRequest, NextResponse } from 'next/server';
import { isEthereumAddress } from '@/lib/api/request-validation';
import { fetchPublicHistory } from '@/lib/api/public-history';

export const runtime = 'nodejs';
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_MS = 30_000;
const inflight = new Map<string, Promise<unknown>>();
const ACCOUNT_ACTIONS = new Set(['balance', 'tokenbalance', 'txlist', 'tokentx']);

export async function GET(request: NextRequest) {
  const input = new URL(request.url).searchParams;
  const action = input.get('action') || '';
  const address = input.get('address');
  const contract = input.get('contractaddress');
  if (input.get('module') !== 'account' || !ACCOUNT_ACTIONS.has(action) ||
      !isEthereumAddress(address) || (action === 'tokenbalance' && !isEthereumAddress(contract)) ||
      (contract !== null && !isEthereumAddress(contract)) ||
      (input.get('chainid') !== null && input.get('chainid') !== '1')) {
    return NextResponse.json({ error: 'Invalid Ethereum mainnet account request' }, { status: 400 });
  }
  for (const key of ['page', 'offset', 'startblock', 'endblock']) {
    const value = input.get(key);
    if (value !== null && (!/^\d{1,12}$/.test(value) ||
        ((key === 'page' || key === 'offset') && Number(value) < 1) ||
        (key === 'offset' && Number(value) > 1000))) {
      return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
    }
  }
  if (input.has('sort') && !['asc', 'desc'].includes(input.get('sort')!)) {
    return NextResponse.json({ error: 'Invalid sort' }, { status: 400 });
  }
  if (input.has('tag') && !/^(latest|earliest|pending|0x[0-9a-fA-F]+)$/.test(input.get('tag')!)) {
    return NextResponse.json({ error: 'Invalid block tag' }, { status: 400 });
  }
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const params = new URLSearchParams({ chainid: '1', module: 'account', action, address: address.toLowerCase() });
  for (const key of ['contractaddress', 'tag', 'page', 'offset', 'sort', 'startblock', 'endblock']) {
    const value = input.get(key);
    if (value !== null) params.set(key, value);
  }
  const cacheKey = params.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_MS) return NextResponse.json(cached.data);
  const isHistory = action === 'txlist' || action === 'tokentx';
  if (!apiKey && !isHistory) {
    return NextResponse.json({ error: 'This explorer lookup is not configured.', code: 'PROVIDER_NOT_CONFIGURED' }, { status: 503 });
  }
  let task = inflight.get(cacheKey);
  if (!task) {
    task = (async () => {
      if (apiKey) {
        try {
          const keyedParams = new URLSearchParams(params);
          keyedParams.set('apikey', apiKey);
          const response = await fetch(`https://api.etherscan.io/v2/api?${keyedParams}`, {
            headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000)
          });
          if (response.ok) {
            const data = await response.json();
            // Genuine empty history is valid; provider error strings are not.
            if (data.status === '1' || (Array.isArray(data.result) && data.result.length === 0)) return { ...data, source: 'etherscan' };
          }
        } catch { /* Continue to the public history provider without logging secrets. */ }
      }
      if (isHistory) return fetchPublicHistory(params);
      throw new Error('Explorer lookup unavailable');
    })();
    inflight.set(cacheKey, task);
  }
  try {
    const data = await task;
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch {
    // Expected provider outages are handled by the UI, not console-error overlays.
    return NextResponse.json({ error: 'Transaction history is temporarily unavailable. Try again shortly.', code: 'HISTORY_UNAVAILABLE', retryable: true }, { status: 503, headers: { 'Retry-After': '5' } });
  } finally {
    inflight.delete(cacheKey);
  }
}
