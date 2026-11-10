const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Exercise the real TypeScript modules with deterministic provider responses and no network.
function loadSource(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  const localRequire = specifier => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
      const target = specifier.startsWith('@/')
        ? path.join(root, 'src', specifier.slice(2))
        : path.resolve(path.dirname(filename), specifier);
      return loadSource(path.relative(root, target + '.ts'), mocks);
    }
    return require(specifier);
  };
  const context = { module, exports: module.exports, require: localRequire, console: mocks.__console || { log() {}, warn() {}, error() {} },
    process, Date, Math, Promise, Map, Set, performance, URL, URLSearchParams, TextEncoder, AbortSignal,
    fetch: (...args) => globalThis.fetch(...args), setTimeout, clearTimeout, setInterval: (...args) => { const timer = setInterval(...args); timer.unref(); return timer; }, clearInterval, ...mocks.__globals };
  vm.runInNewContext(output, context, { filename });
  return module.exports;
}
const address = '0x1111111111111111111111111111111111111111';
const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

test('Ethereum endpoints reject malformed addresses and unsafe RPC batches', () => {
  const { isEthereumAddress, isReadOnlyRpcPayload } = loadSource('src/lib/api/request-validation.ts');
  assert.equal(isEthereumAddress(address), true);
  assert.equal(isEthereumAddress('0x' + 'z'.repeat(40)), false);
  assert.equal(isEthereumAddress(address + '&apikey=override'), false);
  assert.equal(isEthereumAddress(123), false);
  const read = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: address, data: '0x' }, 'latest'] };
  const write = { ...read, method: 'eth_sendRawTransaction' };
  assert.equal(isReadOnlyRpcPayload(read), true);
  assert.equal(isReadOnlyRpcPayload([read, write]), false);
  assert.equal(isReadOnlyRpcPayload(write), false);
  assert.equal(isReadOnlyRpcPayload([]), false);
  assert.equal(isReadOnlyRpcPayload(Array(51).fill(read)), false);
});

test('Token registry uses canonical mainnet contract identity, never symbols or dummy contracts', () => {
  const { WHITELIST_MAINNET, isWhitelisted } = loadSource('src/lib/config/tokenWhitelist.ts');
  for (const [contract, meta] of Object.entries(WHITELIST_MAINNET)) {
    assert.match(contract, /^0x[0-9a-f]{40}$/);
    assert.ok(Number.isInteger(meta.decimals));
  }
  assert.equal(WHITELIST_MAINNET[usdc].symbol, 'USDC');
  assert.equal(WHITELIST_MAINNET['0xba100000625a3754423978a60c9317c58a424e3d'].symbol, 'BAL');
  assert.equal(WHITELIST_MAINNET['0xd533a949740bb3306d119cc777fa900ba034cd52'].symbol, 'CRV');
  assert.equal(isWhitelisted(address), false);
  assert.equal(isWhitelisted('0x1234567890123456789012345678901234567890'), false);
  assert.equal(isWhitelisted(usdc.toUpperCase().replace('0X', '0x')), true);
  assert.equal(isWhitelisted(usdc, 10), false);
});

test('Unconfigured honeypot simulation reports unknown sellability', async () => {
  const { simulateHoneypot } = loadSource('src/lib/ai/scam/honeypotSimulator.ts');
  const result = await simulateHoneypot({ address, symbol: 'USDC' });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.canSell, null);
  assert.equal(result.gasUsed, null);
});

const priceMocks = { '@/lib/providers/dexscreener': { getDexTokenQuote: async () => null } };
test('ETH provider failure never invents or caches a dollar quote', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const { PriceCache } = loadSource('src/lib/api/priceCache.ts', priceMocks);
  const cache = PriceCache.getInstance();
  assert.equal(await cache.fetchETHPrice(), 0);
  assert.equal(cache.getCachedETHPrice(), null);
});

test('ETH quotes expire and refresh; expired token quotes are not returned', async t => {
  let now = 1_000_000;
  let quote = 2100;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ ethereum: { usd: quote } }) }));
  const { PriceCache } = loadSource('src/lib/api/priceCache.ts', priceMocks);
  const cache = PriceCache.getInstance();
  assert.equal(await cache.fetchETHPrice(), 2100);
  quote = 2200;
  assert.equal(await cache.fetchETHPrice(), 2100);
  now += 120_001;
  assert.equal(cache.getCachedETHPrice(), null);
  assert.equal(await cache.fetchETHPrice(), 2200);
  cache.cacheTokenPrice('USDC', usdc, 0.99, 'coinbase', 0.8);
  assert.equal(cache.getCachedTokenPrice('USDC', usdc), 0.99);
  now += 120_001;
  assert.equal(cache.getCachedTokenPrice('USDC', usdc), null);
  assert.equal(cache.hasTokenPrice('USDC', usdc), false);
});

test('Merged transaction pages retain distinct token transfers and respect page size', async t => {
  const normal = Array.from({ length: 8 }, (_, i) => ({
    hash: `eth${i}`, timeStamp: String(100 - i * 2), value: '1000000000000000000', from: address, to: usdc,
    gasUsed: '21000', gasPrice: '1', isError: '0'
  }));
  const tokens = Array.from({ length: 8 }, (_, i) => ({
    hash: `token${i}`, logIndex: String(i), timeStamp: String(99 - i * 2), value: '1000000',
    from: address, to: usdc, contractAddress: usdc, tokenSymbol: 'USDC', tokenDecimal: '6', gasUsed: '21000', gasPrice: '1'
  }));
  t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url).searchParams;
    const source = params.get('action') === 'txlist' ? normal : tokens;
    return { ok: true, json: async () => ({ status: '1', result: source.slice(0, Number(params.get('offset'))) }) };
  });
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: { fetchETHPrice: async () => 2000, fetchTokenPrice: async () => 1 } }
  });
  const first = await WalletAPI.fetchTransactions(address, 1, 3);
  const second = await WalletAPI.fetchTransactions(address, 2, 3);
  assert.deepEqual(Array.from(first, tx => tx.hash), ['eth0', 'token0', 'eth1']);
  assert.deepEqual(Array.from(second, tx => tx.hash), ['token1', 'eth2', 'token2']);
  const bigger = await WalletAPI.fetchTransactions(address, 1, 5);
  assert.equal(bigger.length, 5, 'a smaller cached page must not replace a larger request');
});

test('RPC route rejects writes, malformed JSON, and oversized bodies before contacting providers', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Network must not be reached'); });
  const { POST } = loadSource('src/app/api/rpc-proxy/route.ts');
  const request = body => new Request('http://localhost/api/rpc-proxy', { method: 'POST', body });
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal((await POST(request(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: ['0x'] })))).status, 400);
  assert.equal((await POST(request(' '.repeat(65_537)))).status, 413);
  assert.equal(calls, 0);
});

test('Explorer proxy rejects parameter injection and other chains before contacting providers', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Network must not be reached'); });
  const { GET } = loadSource('src/app/api/etherscan-proxy/route.ts');
  const make = query => new Request(`http://localhost/api/etherscan-proxy?${query}`);
  assert.equal((await GET(make(`module=account&action=balance&address=${address}&chainid=56`))).status, 400);
  assert.equal((await GET(make(`module=account&action=balance&address=${encodeURIComponent(address + '&apikey=bad')}`))).status, 400);
  assert.equal((await GET(make(`module=account&action=tokentx&address=${address}&offset=1000000`))).status, 400);
  assert.equal(calls, 0);
});

test('Native balance distinguishes an observed zero from provider failure', async t => {
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', { './priceCache': { priceCache: {} } });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ result: '0x0' }) }));
  assert.equal(await WalletAPI.fetchETHBalance(address), '0');
  globalThis.fetch.mock.mockImplementation(async () => { throw new Error('offline'); });
  await assert.rejects(() => WalletAPI.fetchETHBalance(address), /unavailable/);
});

test('Browser balances use the active app origin instead of a stale build-time URL', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    calls.push({ input, options });
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: '0xde0b6b3a7640000' }) };
  });
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: {} },
    __globals: {
      window: { location: { origin: 'https://etherview.example' } },
      process: { env: { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' } },
    },
  });
  assert.equal(await WalletAPI.fetchETHBalance(address), '1000000000000000000');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, 'https://etherview.example/api/rpc-proxy');
  assert.equal(JSON.parse(calls[0].options.body).method, 'eth_getBalance');
});

test('Browser native balance recovers from hosted RPC failure with a credential-free public read', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    calls.push({ input, options });
    return input.includes('/api/rpc-proxy')
      ? { ok: false, status: 502 }
      : { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x2a' }) };
  });
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: {} },
    __globals: { window: { location: { origin: 'https://etherview.example' } } },
  });
  assert.equal(await WalletAPI.fetchETHBalance(address), '42');
  assert.deepEqual(calls.map(call => call.input), ['https://etherview.example/api/rpc-proxy', 'https://ethereum.publicnode.com']);
  const direct = calls[1].options;
  assert.deepEqual(JSON.parse(direct.body), { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });
  assert.deepEqual(Object.keys(direct.headers), ['Content-Type']);
  assert.equal(direct.credentials, undefined);
});

test('Native balance rejects malformed RPC results and falls back to an observed explorer value', async t => {
  t.mock.method(globalThis, 'fetch', async input => ({
    ok: true,
    json: async () => input.includes('/api/etherscan-proxy')
      ? { status: '1', result: '123' }
      : { jsonrpc: '2.0', id: 1, result: '-0x10' },
  }));
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: {} },
    __globals: { window: { location: { origin: 'https://etherview.example' } } },
  });
  assert.equal(await WalletAPI.fetchETHBalance(address), '123');
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ result: '0x' }) }));
  await assert.rejects(() => WalletAPI.fetchETHBalance(address), /unavailable/);
});

test('Cancelling a native balance read aborts the current request and prevents fallback requests', async t => {
  let calls = 0;
  let requestSignal;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    calls++;
    requestSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
  });
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: {} },
    __globals: { window: { location: { origin: 'https://etherview.example' } } },
  });
  const controller = new AbortController();
  const pending = WalletAPI.fetchETHBalance(address, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);
  assert.equal(calls, 1);
  await assert.rejects(() => WalletAPI.fetchETHBalance(address, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1, 'an already cancelled caller must not start a request');
});

test('Dexscreener never assigns the base price to a quote token or another chain', () => {
  const { dexscreenerProvider } = loadSource('src/lib/providers/dexscreener.ts');
  const quoteOnly = { chainId: 'ethereum', baseToken: { address }, quoteToken: { address: usdc }, priceUsd: '2000', liquidity: { usd: 1_000_000 } };
  const otherChain = { ...quoteOnly, chainId: 'base', baseToken: { address: usdc } };
  const actual = { ...quoteOnly, baseToken: { address: usdc }, quoteToken: { address }, priceUsd: '0.99' };
  assert.equal(dexscreenerProvider.findBestPair([quoteOnly, otherChain], usdc), null);
  assert.equal(dexscreenerProvider.findBestPair([quoteOnly, otherChain, actual], usdc), actual);
});

test('Transaction provider outages throw; an observed empty history remains empty', async t => {
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: { fetchETHPrice: async () => 2000 } }
  });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(() => WalletAPI.fetchTransactions(address, 1, 10), /unavailable/);
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ status: '0', result: [] }) }));
  assert.equal((await WalletAPI.fetchTransactions(address, 1, 10)).length, 0);
});

test('Browser history recovers from shared hosting rate limits without exposing provider keys', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async input => {
    calls.push(new URL(input).origin);
    return { ok: false, status: 503 };
  });
  const direct = [];
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    __globals: { window: { location: { origin: 'https://etherview.example' } }, Response },
    './priceCache': { priceCache: { fetchETHPrice: async () => 2000 } },
    './public-history': { fetchPublicHistory: async params => {
      direct.push(params);
      return { status: '1', result: params.get('action') === 'txlist' ? [{ hash: '0x' + 'a'.repeat(64), timeStamp: '123', from: address, to: usdc, value: '1000000000000000000' }] : [] };
    } },
  });
  const history = await WalletAPI.fetchTransactions(address, 1, 10);
  assert.equal(history.length, 1);
  assert.equal(history[0].value, '1');
  assert.equal(direct.length, 2);
  assert.ok(direct.every(params => params.get('address') === address && !params.has('apikey')));
  assert.deepEqual(calls, ['https://etherview.example', 'https://etherview.example']);
});

test('Browser public-history fallback uses CORS-safe headers and validates provider records', async t => {
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    assert.equal(new URL(input).origin, 'https://eth.blockscout.com');
    assert.deepEqual(Object.keys(options.headers), ['Accept']);
    return { ok: true, json: async () => ({ items: [], next_page_params: null }) };
  });
  const { fetchPublicHistory } = loadSource('src/lib/api/public-history.ts', { __globals: { window: {} } });
  const result = await fetchPublicHistory(new URLSearchParams({ action: 'txlist', address }));
  assert.equal(result.result.length, 0);
});

test('Zero-decimal token normalization retains whole-token balances', () => {
  const { normalizeTokenDecimals } = loadSource('src/lib/api/request-validation.ts');
  assert.equal(normalizeTokenDecimals(0), 0);
  assert.equal(normalizeTokenDecimals('0'), 0);
  assert.equal(normalizeTokenDecimals('6'), 6);
  assert.equal(normalizeTokenDecimals(-1), 18);
  assert.equal(normalizeTokenDecimals(1000), 18);
  assert.equal(normalizeTokenDecimals(undefined), 18);
});


test('Public-history adapter normalizes actual transactions and ERC-20 amounts without inventing transfer fees', () => {
  const { normalizePublicHistoryRecord } = loadSource('src/lib/api/public-history.ts');
  const hash = '0x' + 'a'.repeat(64);
  const common = { block_number: 123, timestamp: '2026-11-08T11:15:23.000000Z', from: { hash: address }, to: { hash: usdc } };
  const normal = normalizePublicHistoryRecord({ ...common, hash, value: '1000000000000000000', gas_used: '21000', gas_price: '100', status: 'ok' }, 'txlist');
  assert.equal(normal.value, '1000000000000000000');
  assert.equal(normal.timeStamp, String(Date.parse(common.timestamp) / 1000));
  assert.equal(normal.gasUsed, '21000');
  assert.equal(normal.gasPrice, '100');
  assert.equal(normal.isError, '0');
  const transfer = normalizePublicHistoryRecord({ ...common, transaction_hash: hash, log_index: 3, token: { address_hash: usdc, decimals: '6', symbol: 'USDC', name: 'USD Coin' }, total: { value: '42000000', decimals: '6' } }, 'tokentx');
  assert.equal(transfer.value, '42000000');
  assert.equal(transfer.tokenDecimal, '6');
  assert.equal(transfer.logIndex, '3');
  assert.equal(transfer.gasUsed, undefined);
  assert.equal(transfer.gasPrice, undefined);
  assert.equal(transfer.isError, undefined);
  const failedTransfer = normalizePublicHistoryRecord({ ...common, transaction_hash: hash, log_index: 4, status: 'error', token: { address_hash: usdc, decimals: '6', symbol: 'USDC', name: 'USD Coin' }, total: { value: '1', decimals: '6' } }, 'tokentx');
  assert.equal(failedTransfer.isError, '1');
  assert.equal(failedTransfer.status, 'error');
  const pendingTransfer = normalizePublicHistoryRecord({ ...common, transaction_hash: hash, log_index: 5, status: null, token: { address_hash: usdc, decimals: '6', symbol: 'USDC', name: 'USD Coin' }, total: { value: '1', decimals: '6' } }, 'tokentx');
  assert.equal(pendingTransfer.status, 'pending');
  assert.equal(normalizePublicHistoryRecord({ ...common, hash: 'not-a-hash', value: '0' }, 'txlist'), null);
});

test('Explorer history works without an Etherscan key and uses validated public cursor pagination', async t => {
  const previousKey = process.env.ETHERSCAN_API_KEY;
  const previousPublicKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  delete process.env.ETHERSCAN_API_KEY;
  delete process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  t.after(() => { if (previousKey === undefined) delete process.env.ETHERSCAN_API_KEY; else process.env.ETHERSCAN_API_KEY = previousKey; if (previousPublicKey === undefined) delete process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY; else process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY = previousPublicKey; });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(url.origin, 'https://eth.blockscout.com');
    assert.equal(url.searchParams.has('apikey'), false);
    assert.equal(options.headers['User-Agent'], 'EtherView/1.0');
    const second = url.searchParams.has('index');
    const items = [{ hash: '0x' + (second ? 'b' : 'a').repeat(64), block_number: second ? 99 : 100, timestamp: '2026-11-08T00:00:00Z', from: { hash: address }, to: { hash: usdc }, value: '0', status: 'ok' }];
    return { ok: true, json: async () => ({ items, next_page_params: second ? null : { block_number: 100, index: 5, items_count: 50, url: 'https://evil.example' } }) };
  });
  const { GET } = loadSource('src/app/api/etherscan-proxy/route.ts');
  const response = await GET(new Request(`http://localhost/api/etherscan-proxy?module=account&action=txlist&address=${address}&page=1&offset=2&sort=desc`));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.source, 'blockscout');
  assert.equal(body.result.length, 2);
  assert.equal(body.partial, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get('index'), '5');
  assert.equal(calls[1].searchParams.has('url'), false);
});

test('Explorer falls back when a configured Etherscan provider rejects the request', async t => {
  const oldKey = process.env.ETHERSCAN_API_KEY;
  process.env.ETHERSCAN_API_KEY = 'test-key-never-returned';
  t.after(() => { if (oldKey === undefined) delete process.env.ETHERSCAN_API_KEY; else process.env.ETHERSCAN_API_KEY = oldKey; });
  const hosts = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    hosts.push(url.hostname);
    if (url.hostname === 'api.etherscan.io') return { ok: true, json: async () => ({ status: '0', result: 'Invalid API Key' }) };
    return { ok: true, json: async () => ({ items: [], next_page_params: null }) };
  });
  const { GET } = loadSource('src/app/api/etherscan-proxy/route.ts');
  const response = await GET(new Request(`http://localhost/api/etherscan-proxy?module=account&action=tokentx&address=${address}&page=1&offset=10&sort=desc`));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(hosts, ['api.etherscan.io', 'eth.blockscout.com']);
  assert.equal(body.source, 'blockscout');
  assert.deepEqual(body.result, []);
  assert.equal(JSON.stringify(body).includes('test-key'), false);
});

test('Unavailable history is typed, recoverable, and never logged as a console error', async t => {
  let errors = 0;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  const { WalletAPI, HistoryUnavailableError } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: { fetchETHPrice: async () => 0 } },
    __console: { log() {}, warn() {}, error() { errors++; } }
  });
  await assert.rejects(() => WalletAPI.fetchTransactions(address), error => {
    assert.ok(error instanceof HistoryUnavailableError);
    assert.equal(error.code, 'HISTORY_UNAVAILABLE');
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(errors, 0);
});

test('Malformed and unavailable public provider responses are not cached as empty history', async t => {
  const oldKey = process.env.ETHERSCAN_API_KEY;
  const oldPublicKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  delete process.env.ETHERSCAN_API_KEY; delete process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  t.after(() => { if (oldKey === undefined) delete process.env.ETHERSCAN_API_KEY; else process.env.ETHERSCAN_API_KEY = oldKey; if (oldPublicKey === undefined) delete process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY; else process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY = oldPublicKey; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true, json: async () => calls === 1 ? ({ result: [] }) : ({ items: [], next_page_params: null }) }; });
  const { GET } = loadSource('src/app/api/etherscan-proxy/route.ts');
  const url = `http://localhost/api/etherscan-proxy?module=account&action=txlist&address=${address}&page=1&offset=10`;
  const first = await GET(new Request(url));
  assert.equal(first.status, 503);
  assert.equal((await first.json()).code, 'HISTORY_UNAVAILABLE');
  // A short shared outage cooldown avoids repeated provider calls, but never
  // represents unavailable data as an empty successful history.
  assert.equal((await GET(new Request(url))).status, 503);
  assert.equal(calls, 1);
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 5_001);
  assert.equal((await GET(new Request(url))).status, 200);
  assert.equal(calls, 2);
});


test('Concurrent public-history consumers reuse one snapshot across different page sizes', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { ok: true, json: async () => ({ items: Array.from({ length: 50 }, (_, i) => ({ hash: '0x' + i.toString(16).padStart(64, '0'), block_number: 100 - i, timestamp: '2026-11-08T00:00:00Z', from: { hash: address }, to: { hash: usdc }, value: '0', status: 'ok' })), next_page_params: null }) };
  });
  const { fetchPublicHistory } = loadSource('src/lib/api/public-history.ts');
  const query = offset => new URLSearchParams({ address, action: 'txlist', page: '1', offset: String(offset) });
  const [first, second, third] = await Promise.all([fetchPublicHistory(query(10)), fetchPublicHistory(query(25)), fetchPublicHistory(query(50))]);
  assert.equal(first.result.length, 10);
  assert.equal(second.result.length, 25);
  assert.equal(third.result.length, 50);
  assert.equal(calls, 1);
});

test('Concurrent ETH quote consumers share one request and cache only a real quote', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { ok: true, json: async () => ({ ethereum: { usd: 2300 } }) };
  });
  const { PriceCache } = loadSource('src/lib/api/priceCache.ts', priceMocks);
  const cache = PriceCache.getInstance();
  assert.deepEqual(await Promise.all([cache.fetchETHPrice(), cache.fetchETHPrice(), cache.fetchETHPrice()]), [2300, 2300, 2300]);
  assert.equal(calls, 1);
});

test('Whale screening excludes failed and pending transfer attempts and includes the selected threshold', async () => {
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', { './priceCache': { priceCache: {} } });
  const transactions = ['failed', 'pending', 'success'].map((status, index) => ({ id: String(index), hash: String(index), status, valueUSD: 20_000, value: '10', from: address, to: usdc, timestamp: 100 }));
  const result = await WalletAPI.detectWhaleMovements(transactions, 20_000);
  assert.equal(result.length, 1);
  assert.equal(result[0].hash, '2');
  assert.equal(result[0].dataSource, 'explorer');
});

test('Legacy DEX fallback cannot misprice a quote-side or cross-chain token', async t => {
  const pair = { chainId: 'ethereum', baseToken: { address }, quoteToken: { address: usdc }, priceUsd: '2000', liquidity: { usd: 1e9 } };
  const otherChain = { ...pair, chainId: 'base', baseToken: { address: usdc } };
  const actual = { ...pair, baseToken: { address: usdc }, priceUsd: '0.99', liquidity: { usd: 100 } };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ pairs: [pair, otherChain, actual] }) }));
  const { fetchDexscreenerToken, fetchDexscreenerBatch } = loadSource('src/lib/ai/shared/fetcher.ts');
  assert.equal((await fetchDexscreenerToken(usdc)).usd, 0.99);
  const prices = await fetchDexscreenerBatch([usdc.toUpperCase()]);
  assert.equal(prices[usdc].usd, 0.99);
});

test('Concurrent analysis calls share work and cached falsy values are respected', async () => {
  const values = new Map();
  const { PerformanceManager } = loadSource('src/lib/ai/sentiment/performanceManager.ts', {
    '../shared/cache': { aiCache: { get: key => values.has(key) ? values.get(key) : null, set: (key, value) => values.set(key, value) }, CacheKeys: {} }
  });
  const manager = new PerformanceManager();
  let calls = 0;
  const analyze = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return 0; };
  await Promise.all([manager.executeWithCaching('zero', analyze), manager.executeWithCaching('zero', analyze)]);
  assert.equal(calls, 1);
  assert.equal(await manager.executeWithCaching('zero', analyze), 0);
  assert.equal(calls, 1);
});

test('News requests validate before contacting providers and refresh results are never HTTP-cached', async () => {
  let calls = 0;
  const { GET, POST } = loadSource('src/app/api/news-sentiment/route.ts', {
    '@/lib/ai/sentiment/sentimentEngine': { sentimentAnalysisEngine: { analyzeMarketSentiment: async () => { calls++; return { articles: [] }; } } },
    '@/lib/ai/sentiment/performanceManager': { performanceManager: { getCacheStats: () => ({ hitRate: 0 }), getServiceHealthSummary: () => ({}) } }
  });
  assert.equal((await GET(new Request('http://localhost/api/news-sentiment?walletAddress=bad'))).status, 400);
  assert.equal((await GET(new Request('http://localhost/api/news-sentiment?fast=maybe'))).status, 400);
  assert.equal((await POST(new Request('http://localhost/api/news-sentiment', { method: 'POST', body: '{' }))).status, 400);
  assert.equal((await POST(new Request('http://localhost/api/news-sentiment', { method: 'POST', body: JSON.stringify({ preferences: null, customArticles: ['not implemented'] }) }))).status, 400);
  assert.equal(calls, 0);
  const response = await GET(new Request('http://localhost/api/news-sentiment?forceRefresh=1&fast=1'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls, 1);
});

test('ETH proxy coalesces provider races and maintains the ethereum.usd response contract', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { ok: true, json: async () => String(url).includes('coinbase') ? ({ data: { amount: '2300' } }) : ({ USD: 2301 }) };
  });
  const { GET } = loadSource('src/app/api/price-proxy/route.ts', {
    '@/lib/providers/cmc': { cmcProvider: {} },
    '@/lib/providers/dexscreener': { dexscreenerProvider: {} },
  });
  const request = () => new Request('http://localhost/api/price-proxy?type=eth');
  const results = await Promise.all([GET(request()), GET(request()), GET(request())]);
  assert.equal(calls, 2); // One hedged provider race, not one per consumer.
  for (const result of results) assert.equal((await result.json()).ethereum.usd, 2300);
  assert.equal((await (await GET(request())).json()).ethereum.usd, 2300);
  assert.equal(calls, 2);
});

test('Sentiment batches honor concurrency, preserve article order, and never shift failed results', async () => {
  const cache = new Map();
  const { PerformanceManager } = loadSource('src/lib/ai/sentiment/performanceManager.ts', {
    '../shared/cache': { aiCache: { get: key => cache.get(key) ?? null, set: (key, value) => cache.set(key, value) } }
  });
  const manager = new PerformanceManager();
  let active = 0; let peak = 0;
  const result = await manager.executeBatch([0, 1, 2, 3, 4], async value => {
    active++; peak = Math.max(active, peak);
    await new Promise(resolve => setTimeout(resolve, value % 2 ? 1 : 5));
    active--; return value;
  }, { batchSize: 5, concurrency: 2, delayBetweenBatches: 0, cacheKey: value => `ordered-${value}` });
  assert.deepEqual([...result], [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
  await assert.rejects(() => manager.executeBatch([0, 1, 2], async value => {
    if (value === 1) throw new Error('Article analysis unavailable');
    return value;
  }, { batchSize: 3, concurrency: 2, cacheKey: value => `failed-${value}` }), /unavailable/);
});

test('Risk-only screening uses supplied tokens without unrelated balance, history or pricing fetches', async () => {
  let scans = 0;
  const { POST } = loadSource('src/app/api/analyze-wallet/route.ts', {
    '@/lib/api/wallet': { WalletAPI: new Proxy({}, { get() { throw new Error('Unrelated network path reached'); } }) },
    '@/lib/ai/scam/screenTokens': { screenTokenMetadata: async tokens => { scans++; return { totalTokens: tokens.length, flaggedTokens: [], coverage: 'metadata-and-known-address-registry' }; } }
  });
  const response = await POST(new Request('http://localhost/api/analyze-wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress: address, tokens: [], scope: 'risk' }) }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.scam.totalTokens, 0);
  assert.equal(payload.metadata.coverage, 'metadata-and-known-address-registry');
  assert.equal(scans, 1);
});

test('Analysis validates scope, body, token bounds and token fields before provider access', async () => {
  const { POST } = loadSource('src/app/api/analyze-wallet/route.ts', { '@/lib/api/wallet': { WalletAPI: {} } });
  const request = body => new Request('http://localhost/api/analyze-wallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  for (const value of [
    { walletAddress: address, scope: 'arbitrary' },
    { walletAddress: address, scope: 'full' },
    { walletAddress: address, scope: 'risk', tokens: {} },
    { walletAddress: address, scope: 'risk', tokens: Array(301).fill({ address: usdc }) },
    { walletAddress: address, scope: 'risk', tokens: [{ address: usdc, name: 'x'.repeat(257) }] },
    { walletAddress: address, scope: 'risk', tokens: [{ address: usdc, balance: 'NaN' }] },
  ]) assert.equal((await POST(request(JSON.stringify(value)))).status, 400);
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal((await POST(request(' '.repeat(256 * 1024 + 1)))).status, 413);
});

test('DEX reads coalesce, back off missing quotes, and return cached data during provider cooldown', async t => {
  let now = 1_000_000;
  let calls = 0;
  let pairs = [];
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 5));
    return { ok: true, json: async () => ({ pairs }) };
  });
  const { dexscreenerProvider: provider } = loadSource('src/lib/providers/dexscreener.ts');
  await Promise.all([provider.getTokenPairs(usdc), provider.getTokenPairs(usdc), provider.getTokenPairs(usdc)]);
  assert.equal(calls, 1);
  assert.equal(await provider.getTokenPairs(usdc), null);
  assert.equal(calls, 1);
  now += 30_001;
  pairs = [{ chainId: 'ethereum', dexId: 'test', pairAddress: address, baseToken: { address: usdc, symbol: 'USDC' }, quoteToken: { address, symbol: 'ETH' }, priceUsd: '0.99', priceNative: '0.001', liquidity: { usd: 1000, base: 100, quote: 1 }, volume: { h24: 100 }, priceChange: { h24: 1, h1: 1 }, pairCreatedAt: 1 }];
  assert.equal((await provider.getTokenPairs(usdc)).price, 0.99);
  provider.blockedUntil = now + 60_000;
  assert.equal((await provider.getTokenPairs(usdc)).price, 0.99);
  assert.equal(calls, 2);
});

test('Missing token quotes are not requested from the same DEX provider twice per proxy call', async t => {
  let dexCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({}) }));
  const { GET } = loadSource('src/app/api/price-proxy/route.ts', {
    '@/lib/providers/cmc': { cmcProvider: {} },
    '@/lib/providers/dexscreener': { dexscreenerProvider: { isBlocked: () => false, getBatchTokenPrices: async () => { dexCalls++; return new Map(); } } },
  });
  const response = await GET(new Request(`http://localhost/api/price-proxy?type=token&addresses=${address}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
  assert.equal(dexCalls, 1);
});

// Mount just the real hook's effects/subscribers against two browser-like tabs.
// Storage events are deliberately delivered between the settings and theme writes,
// reproducing the ordering that exposed a cross-tab overwrite in browser E2E.
function themeTab(shared) {
  const listeners = new Map();
  const effects = [];
  const cleanups = [];
  const classes = new Set();
  const classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), toggle: (name, force) => force ? classes.add(name) : classes.delete(name) };
  let meta = null;
  const document = { documentElement: { classList, style: {} }, body: { classList }, querySelector: () => meta, createElement: () => ({ setAttribute() {} }), head: { appendChild: element => { meta = element; } } };
  const window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    dispatchEvent: event => { for (const fn of [...(listeners.get(event.type) || [])]) fn(event); },
  };
  const tab = { window, document, classes };
  const storage = {
    getItem: key => shared.values.get(key) ?? null,
    setItem: (key, value) => {
      value = String(value);
      const previous = shared.values.get(key) ?? null;
      shared.writes.push({ tab, key, value });
      shared.values.set(key, value);
      if (previous !== value) for (const target of shared.tabs) if (target !== tab) target.window.dispatchEvent({ type: 'storage', key, oldValue: previous, newValue: value });
    },
    removeItem: key => {
      if (!shared.values.has(key)) return;
      shared.values.delete(key);
      for (const target of shared.tabs) if (target !== tab) target.window.dispatchEvent({ type: 'storage', key, newValue: null });
    },
  };
  const globals = { window, document, localStorage: storage, structuredClone, Event: class { constructor(type) { this.type = type; } } };
  const { themeManager: manager } = loadSource('src/lib/theme-manager.ts', { __globals: globals });
  const react = {
    useState: initial => { let current = typeof initial === 'function' ? initial() : initial; return [current, next => { current = typeof next === 'function' ? next(current) : next; }]; },
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
  };
  const { useSettings } = loadSource('src/hooks/use-settings.ts', { react, '@/lib/theme-manager': { themeManager: manager }, __globals: globals });
  const hook = useSettings();
  for (const mount of effects) { const cleanup = mount(); if (cleanup) cleanups.push(cleanup); }
  Object.assign(tab, { manager, hook, close: () => { cleanups.forEach(cleanup => cleanup()); manager.cleanup(); } });
  shared.tabs.push(tab);
  return tab;
}

test('Reading theme preferences and settings never writes storage', t => {
  const shared = { values: new Map([['etherview_theme', 'light']]), writes: [], tabs: [] };
  const tab = themeTab(shared);
  t.after(() => tab.close());
  assert.equal(tab.manager.getTheme(), 'light');
  tab.manager.loadThemePreference();
  tab.hook.reloadSettings();
  assert.equal(tab.manager.getTheme(), 'light');
  assert.equal(shared.writes.length, 0);
});

test('Two tabs preserve the last user theme choice when storage events interleave writes', t => {
  const shared = { values: new Map([['etherview_theme', 'light']]), writes: [], tabs: [] };
  const first = themeTab(shared);
  const second = themeTab(shared);
  t.after(() => { first.close(); second.close(); });
  assert.equal(shared.writes.length, 0);
  first.hook.updateSetting('appearance', 'theme', 'dark');
  assert.equal(shared.values.get('etherview_theme'), 'dark');
  assert.equal(first.manager.getTheme(), 'dark');
  assert.equal(second.manager.getTheme(), 'dark');
  assert.equal(shared.writes.filter(write => write.key === 'etherview_theme').length, 1);
  assert.equal(shared.writes.filter(write => write.tab === second).length, 0);
  second.hook.updateSetting('appearance', 'theme', 'light');
  assert.equal(shared.values.get('etherview_theme'), 'light');
  assert.equal(first.manager.getTheme(), 'light');
  assert.equal(second.manager.getTheme(), 'light');
  assert.equal(shared.writes.filter(write => write.key === 'etherview_theme').length, 2);
  first.manager.loadThemePreference();
  second.hook.reloadSettings();
  assert.equal(shared.values.get('etherview_theme'), 'light');
  assert.equal(shared.writes.filter(write => write.key === 'etherview_theme').length, 2);
});

test('News aggregation returns no written headlines when providers are unconfigured', async t => {
  const keys = ['NEWSAPI_API_KEY', 'NEWS_API_KEY', 'CRYPTOCOMPARE_API_KEY', 'CURRENTS_API_KEY'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  t.after(() => { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const { realNewsAggregator } = loadSource('src/lib/ai/sentiment/realNewsAggregator.ts');
  const articles = await realNewsAggregator.aggregateNews(true, true);
  assert.equal(articles.length, 0);
  assert.equal(articles.some(article => /reuters|bloomberg|financial times/i.test(article.source || '')), false);
});

test('Holding merge keeps an observed balance and price when a later source reports zero', () => {
  const { mergeHolding } = loadSource('src/lib/api/holding-merge.ts');
  const merged = mergeHolding(
    { symbol: 'ABC', balance: '1.5', priceUSD: 4, valueUSD: 6 },
    { symbol: 'ABC', balance: '0', priceUSD: 0, valueUSD: 0 }
  );
  assert.equal(merged.balance, '1.5');
  assert.equal(merged.priceUSD, 4);
  assert.equal(merged.valueUSD, 6);
  const updated = mergeHolding(merged, { symbol: 'ABC', balance: '2', priceUSD: 5, valueUSD: 10 });
  assert.equal(updated.balance, '2');
  assert.equal(updated.priceUSD, 5);
  assert.equal(updated.valueUSD, 10);
});

test('A normal unknown token is not a risk finding and known addresses come from the registry', async () => {
  const { screenTokenMetadata } = loadSource('src/lib/ai/scam/screenTokens.ts');
  const unknown = '0x2222222222222222222222222222222222222222';
  const linked = '0x3333333333333333333333333333333333333333';
  const result = await screenTokenMetadata([
    { address: unknown, symbol: 'ABC', name: 'Example Token' },
    { address: usdc, symbol: 'USDC', name: 'USD Coin' },
    { address: linked, symbol: 'CLAIM', name: 'Visit https://airdrop.example' },
  ], address);
  assert.equal(result.knownCount, 1);
  assert.equal(result.totalTokens, 3);
  assert.equal(result.flaggedTokens.length, 1);
  assert.equal(result.flaggedTokens[0].tokenAddress.toLowerCase(), linked);
  assert.equal(result.flaggedTokens[0].confidencePct <= 40, true);
});

test('A stablecoin quote more than ten times its reference is replaced', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({ [usdc]: { usd: 20 } }) }));
  const { GET } = loadSource('src/app/api/price-proxy/route.ts', {
    '@/lib/providers/cmc': { cmcProvider: { getWhitelistQuotes: async symbols => new Map(symbols.map(symbol => [symbol, { price: 1, confidence: 0.9 }])) } },
    '@/lib/providers/dexscreener': { dexscreenerProvider: { isBlocked: () => false, getBatchTokenPrices: async () => new Map() } },
  });
  const response = await GET(new Request(`http://localhost/api/price-proxy?type=token&addresses=${usdc}`));
  const body = await response.json();
  assert.equal(body[usdc].usd, 1);
  assert.equal(body[usdc].source, 'cmc');
});

test('A whitelist quote above $1000 stays when it is within ten times its reference', async t => {
  const weth = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({ [weth]: { usd: 2300 } }) }));
  const { GET } = loadSource('src/app/api/price-proxy/route.ts', {
    '@/lib/providers/cmc': { cmcProvider: { getWhitelistQuotes: async symbols => new Map(symbols.map(symbol => [symbol, { price: 2400, confidence: 0.9 }])) } },
    '@/lib/providers/dexscreener': { dexscreenerProvider: { isBlocked: () => false, getBatchTokenPrices: async () => new Map() } },
  });
  const response = await GET(new Request(`http://localhost/api/price-proxy?type=token&addresses=${weth}`));
  const body = await response.json();
  assert.equal(body[weth].usd, 2300);
  assert.equal(body[weth].source, 'coingecko');
});

test('A transfer without a positive quote does not become a zero-dollar value', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const params = new URL(url).searchParams;
    if (params.get('action') === 'txlist') {
      return { ok: true, json: async () => ({ status: '1', result: [{ hash: '0x' + 'ab'.repeat(32), timeStamp: '100', value: '1000000000000000000', from: address, to: usdc, gasUsed: '21000', gasPrice: '1', isError: '0' }] }) };
    }
    return { ok: true, json: async () => ({ status: '1', result: [{ hash: '0x' + 'cd'.repeat(32), logIndex: '1', timeStamp: '99', value: '1000000', from: address, to: usdc, contractAddress: usdc, tokenSymbol: 'USDC', tokenDecimal: '6', isError: '1', status: 'error' }] }) };
  });
  const { WalletAPI } = loadSource('src/lib/api/wallet.ts', {
    './priceCache': { priceCache: { fetchETHPrice: async () => 0, fetchTokenPrice: async () => 0 } }
  });
  const transactions = await WalletAPI.fetchTransactions(address, 1, 10);
  const eth = transactions.find(tx => tx.tokenSymbol === 'ETH');
  const token = transactions.find(tx => tx.tokenSymbol === 'USDC');
  assert.equal(Object.hasOwn(eth, 'valueUSD'), false);
  assert.equal(eth.value, '1');
  assert.equal(Object.hasOwn(token, 'valueUSD'), false);
  assert.equal(token.status, 'failed');
  assert.equal((await WalletAPI.detectWhaleMovements(transactions, 1)).length, 0);
});

test('A public Etherscan environment name is not used as the server key', async t => {
  const previousKey = process.env.ETHERSCAN_API_KEY;
  const previousPublicKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  delete process.env.ETHERSCAN_API_KEY;
  process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY = 'public-key-must-not-be-used';
  t.after(() => {
    if (previousKey === undefined) delete process.env.ETHERSCAN_API_KEY;
    else process.env.ETHERSCAN_API_KEY = previousKey;
    if (previousPublicKey === undefined) delete process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
    else process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY = previousPublicKey;
  });
  const hosts = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    hosts.push(url.hostname);
    assert.equal(url.searchParams.has('apikey'), false);
    return { ok: true, json: async () => ({ items: [], next_page_params: null }) };
  });
  const { GET } = loadSource('src/app/api/etherscan-proxy/route.ts');
  const response = await GET(new Request(`http://localhost/api/etherscan-proxy?module=account&action=txlist&address=${address}&page=1&offset=10&sort=desc`));
  assert.equal(response.status, 200);
  assert.deepEqual(hosts, ['eth.blockscout.com']);
  assert.equal(JSON.stringify(await response.json()).includes('public-key-must-not-be-used'), false);
});

