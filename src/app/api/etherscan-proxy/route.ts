/**
 * Etherscan API Proxy - Server-side proxy for Etherscan API
 * Solves CORS issues by routing requests through Next.js backend
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache for Etherscan data to reduce API calls
const etherscanCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30 seconds for balance data

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
    // Generate cache key
    const cacheKey = `${apiModule}_${action}_${address}_${contractaddress}_${tag}_${chainid}`;
    const cached = etherscanCache.get(cacheKey);

    // Check cache first
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`🔗 ETHERSCAN PROXY: Using cached data for ${cacheKey}`);
      return NextResponse.json(cached.data);
    }

    // Build Etherscan API URL
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

    // Fetch from Etherscan with proper headers
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EtherView/1.0',
        'Origin': 'https://etherview.app',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`🔗 ETHERSCAN PROXY: Etherscan API error: ${response.status} ${response.statusText}`);

      // Return fallback response for token balances
      if (action === 'tokenbalance' && contractaddress) {
        const fallbackData = {
          status: '0',
          message: 'API unavailable',
          result: '0'
        };
        etherscanCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
        return NextResponse.json(fallbackData);
      }

      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

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