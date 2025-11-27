## Tasks To Complete
- Add in‑memory TTL caches to the price proxy for whitelist quotes (10 min) and token address prices (5–10 min), and honor `CRYPTOCOMPARE_API_KEY` header if present.
- Fully wire Dexscreener in the proxy rotation and provide `confidence` with liquidity‑aware ratings; return cached results when available.
- Expand scam detection: add liquidity info via Dexscreener, basic transfer controls detection, and a minimal multi‑router simulation in honeypot simulator; update types.
- Add shared fetchers for Dexscreener, CMC, and external signals with timeouts and one retry.

## Files
- `src/app/api/price-proxy/route.ts`: add caches (whitelist + token), provider header usage, integrate Dexscreener confidence, and return `confidence` fields.
- `src/lib/providers/cmc.ts`: no change (already normalizes quotes), used by proxy cache.
- `src/lib/providers/dexscreener.ts`: expose liquidity info for confidence computation.
- `lib/ai/scam/types.ts`: add `liquidityInfo`, `controlsInfo`, `simulationResults`, `externalSignals`.
- `lib/ai/scam/scamFeatures.ts`: populate new fields using Dexscreener + static code heuristics; compute risk score and confidence.
- `lib/ai/scam/honeypotSimulator.ts`: minimal multi‑router simulation, fee/tax estimation; reuse existing patterns.
- `lib/ai/shared/fetcher.ts`: add lightweight wrappers with timeout/retry and cooldown flags.

## Verification
- Whitelist route returns CMC quotes and honors cache; token route returns prices with sources and confidence from Dexscreener/alternates.
- Scam features include liquidity and simulation signals; majors bypass heavy scans.

I will implement these changes now and only report back if any blocking issues arise.