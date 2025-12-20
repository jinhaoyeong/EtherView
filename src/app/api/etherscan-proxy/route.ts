/**
 * Etherscan API Proxy - Server-side proxy for Etherscan API
 * Solves CORS issues by routing requests through Next.js backend
 */

import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs'

// Cache for Etherscan data to reduce API calls
const etherscanCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 30 * 1000;
const TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

// Get API key from environment
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'VMUSQTMBBDUWZJ4VG2FCMAFCMBMRXYSGGH';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const apiModule = searchParams.get('module');
  const action = searchParams.get('action'); // balance, tokenbalance, etc.
  const contractaddress = searchParams.get('contractaddress');
  const address = searchParams.get('address');
  const tag = searchParams.get('tag');
  const chainid = searchParams.get('chainid') || '1';
  const page = searchParams.get('page');
  const offset = searchParams.get('offset');
  const sort = searchParams.get('sort');
  const startblock = searchParams.get('startblock');
  const endblock = searchParams.get('endblock');

  try {
    // Generate cache key (include paging/sort params to avoid serving page 1 for all pages)
    const cacheKey = `${apiModule}_${action}_${address || ''}_${contractaddress || ''}_${tag || ''}_${chainid}_${page || ''}_${offset || ''}_${sort || ''}_${startblock || ''}_${endblock || ''}`;
    const cached = etherscanCache.get(cacheKey);

    // Check cache first
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`🔗 ETHERSCAN PROXY: Using cached data for ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    // Build Etherscan API URL (v2)
    let apiUrl = `https://api.etherscan.io/v2/api?chainid=${chainid}&module=${apiModule}&action=${action}&apikey=${ETHERSCAN_API_KEY}`;

    if (address) apiUrl += `&address=${address}`;
    if (contractaddress) apiUrl += `&contractaddress=${contractaddress}`;
    if (tag) apiUrl += `&tag=${tag}`;
    if (page) apiUrl += `&page=${page}`;
    if (offset) apiUrl += `&offset=${offset}`;
    if (sort) apiUrl += `&sort=${sort}`;
    if (startblock) apiUrl += `&startblock=${startblock}`;
    if (endblock) apiUrl += `&endblock=${endblock}`;

    console.log(`🔗 ETHERSCAN PROXY: Fetching from Etherscan: ${apiUrl}`);

    let response: Response | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EtherView/1.0'
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.ok) break;
      } catch {}
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
    if (!response) throw new Error('No response from Etherscan v2');

    // If v2 not ok or returns empty, fallback to v1 endpoint
    let data: unknown = null;
    if (!response.ok) {
      console.warn(`🔗 ETHERSCAN PROXY: Etherscan API error: ${response.status} ${response.statusText}`);
    } else {
      try {
        data = await response.json();
      } catch {}
    }

    if (!response.ok || (data && (data as { status?: string }).status === '0' && (Array.isArray((data as { result?: unknown[] }).result) ? ((data as { result?: unknown[] }).result || []).length === 0 : true))) {
      if (action === 'tokentx') {
        etherscanCache.set(cacheKey, { data: data || { status: '0', message: 'unavailable', result: [] }, timestamp: Date.now() });
        return NextResponse.json(data || { status: '0', message: 'unavailable', result: [] });
      }
      
      // V1 fallback (widely supported)
      let v1Url = `https://api.etherscan.io/api?module=${apiModule}&action=${action}&apikey=${ETHERSCAN_API_KEY}`;
      if (address) v1Url += `&address=${address}`;
      if (contractaddress) v1Url += `&contractaddress=${contractaddress}`;
      if (tag) v1Url += `&tag=${tag}`;
      if (page) v1Url += `&page=${page}`;
      if (offset) v1Url += `&offset=${offset}`;
      if (sort) v1Url += `&sort=${sort}`;
      if (startblock) v1Url += `&startblock=${startblock}`;
      if (endblock) v1Url += `&endblock=${endblock}`;

      console.log(`🔗 ETHERSCAN PROXY: Falling back to v1: ${v1Url}`);
      let v1Res: Response | null = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          v1Res = await fetch(v1Url, { headers: { 'Accept': 'application/json', 'User-Agent': 'EtherView/1.0' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
          if (v1Res.ok) break;
        } catch {}
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
      if (!v1Res) throw new Error('No response from Etherscan v1');
      if (!v1Res.ok) {
        console.warn(`🔗 ETHERSCAN PROXY: V1 fallback error: ${v1Res.status} ${v1Res.statusText}`);
        // Return fallback for tokenbalance specifically
        if (action === 'tokenbalance' && contractaddress) {
          const fallbackData = { status: '0', message: 'API unavailable', result: '0' };
          etherscanCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
          return NextResponse.json(fallbackData);
        }
        throw new Error(`API responded with status: ${v1Res.status}`);
      }
      data = await v1Res.json();
      // Normalize v1 payload into v2-compatible shape
      if (typeof (data as { status?: string })?.status === 'string') {
        etherscanCache.set(cacheKey, { data, timestamp: Date.now() });
        return NextResponse.json(data);
      }
    }

    // If original v2 worked, use it
    if (!data) {
      data = await response.json();
    }

    // Cache the successful response
    etherscanCache.set(cacheKey, { data, timestamp: Date.now() });
    console.log(`🔗 ETHERSCAN PROXY: Successfully fetched and cached data`);

    return NextResponse.json(data);

  } catch (error) {
    console.error('🔗 ETHERSCAN PROXY: Error fetching Etherscan data:', error);

    // Return fallback for token balance requests
    if (action === 'tokenbalance') {
      const fallbackData = {
        status: '0',
        message: 'API unavailable',
        result: '0'
      };
      return NextResponse.json(fallbackData);
    }

    return NextResponse.json(
      { error: 'Failed to fetch Etherscan data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Clean up old cache entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of etherscanCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        etherscanCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}
