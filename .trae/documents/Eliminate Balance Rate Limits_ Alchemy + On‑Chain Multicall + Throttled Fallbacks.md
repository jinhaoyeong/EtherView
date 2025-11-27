## Problem
- Etherscan account/tokenbalance calls hit 5/sec caps (“Max rate limit reached”), so many tokens end up with zero amounts and never get priced.

## Solution Overview
- Make Alchemy the authoritative source for ERC‑20 balances.
- For extra contracts discovered via `tokentx`, use on‑chain Multicall (one JSON‑RPC request) to query many `balanceOf(wallet)` in a batch.
- Only throttle to Etherscan V2 for rare fallbacks (≤4/sec) with backoff and single retry, and cache results.
- Pre‑filter spam/airdrop tokens to avoid wasting calls.

## Implementation Steps
### 1) Alchemy Primary
- File: `src/lib/api/wallet.ts`
  - Ensure `fetchTokensFromAlchemy(address)` builds the full token list and marks contracts as “checked”.
  - Do not re‑check those same contracts with Etherscan.

### 2) On‑Chain Multicall for Extras
- Files:
  - `src/lib/eth/multicall.ts` (new):
    - Expose `batchBalanceOf(wallet, contracts)` using a Multicall contract (e.g., 0x5BA1e… on mainnet) and ERC‑20 `balanceOf(address)` ABI.
    - Accept up to ~500 calls; split into chunks of 100–150 to keep gas reasonable.
  - `src/lib/api/wallet.ts`:
    - For contracts discovered via `tokentx` that aren’t in the Alchemy set, call `batchBalanceOf` to get balances in one RPC.
    - Parse results, filter zeros, and add to token list.

### 3) Throttled Etherscan Fallback
- File: `src/lib/api/wallet.ts`
  - Implement a small queue/throttle for rare Etherscan tokenbalance fallbacks: max 4/sec, short backoff (e.g., 500–1000ms) if we see “rate limit”. Retry only once.
  - Cache positive balances for 5–10 min (`cacheManager`) to avoid repeating.

### 4) Spam/Airdrop Pre‑Filters
- File: `src/lib/api/wallet.ts`
  - Tighten heuristics to drop obvious spam tokens (e.g., names containing “Visit website … claim rewards”, “airdrop”, “gift”) before any balance call.
  - Always keep whitelist majors regardless of heuristics.

### 5) Provider Health & Caching
- Files: `src/lib/api/wallet.ts`, `src/lib/eth/multicall.ts`
  - Provider health state: skip Etherscan when we hit rate limit; prefer Alchemy/multicall for the rest of the session.
  - Cache per address and per contract balances (Map) with TTL 5–10 min.

### 6) Keys
- Required: `ALCHEMY_API_KEY`, `ETHERSCAN_API_KEY` (already present)
- No new key required for Multicall; it uses your existing JSON‑RPC via Alchemy.
- Optional: Covalent fallback (if desired) `COVALENT_API_KEY` (`/v1/1/address/{wallet}/balances_v2/`) — only if Alchemy fails completely.

### 7) Verification
- Restart dev server; analyze a wallet with many tokens.
- Confirm logs show "Multicall batch" for extras instead of per‑token Etherscan; no “Max rate limit reached”.
- Verify positions list includes tokens with correct amounts; pricing rotation (CG→Dexscreener→CC→Coinbase) fills USD values.

## Files to Update
- `src/lib/api/wallet.ts`: wire Alchemy primary, add multicall path, throttle queue, caching, and spam filters.
- `src/lib/eth/multicall.ts`: implement ERC‑20 batched balance queries.

## Outcome
- Balance discovery no longer rate‑limits, tokens get accurate amounts, and pricing can apply everywhere. Majors and whitelist tokens appear reliably with USD values.