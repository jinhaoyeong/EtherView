## Summary of Issues
- Decorator signature mismatch: `@cached(...)` errors at lines 97, 129, 470, 636 in `lib/ai/whale/whaleEngine.ts` because the decorator in `lib/ai/shared/cache.ts` uses legacy 3-arg signature, while the compiler/runtime is invoking stage-3 (2-arg) decorators.
- Implicit `any[]`: `clusters` declared without type at lines 155, 195.
- Possibly undefined `.value.data`: Access of `alchemyEth.value.data`, `AlchemyTokens.value.data`, `tokens.value.data`, `nfts.value.data`, `recentActivity.value.data` without guards after `Promise.allSettled`.
- Incorrect fetch client usage: `ETHERSCAN_CLIENT.get('', { params: {...} })` — `FetchOptions` has no `params`. Query parameters must be in the URL.

## Fix Plan
### 1) Decorators: Make `cached` compatible with stage-3 and legacy
- Update `lib/ai/shared/cache.ts` to support both new (2-arg) and legacy (3-arg) decorator forms:
  - Detect `(value, context)` new-method decorator and wrap `value` with a caching proxy using `context.name` plus `JSON.stringify(args)` as key.
  - Fallback to legacy `(target, propertyName, descriptor)` when three args are provided.
- Keep same TTL functionality; no API changes to call sites (`@cached(300)` continues to work).

### 2) Type the `clusters` variable
- In `whaleEngine.ts`, replace `const clusters = []` with a typed structure, e.g.:
  - `const clusters: Array<{ id: string; addresses: string[]; label: string; behavior: { averageMovementSize: number; preferredDestinations: string[]; activityPattern: string; riskLevel: string }; metadata: { firstSeen: number; lastSeen: number; totalVolume: number; classification: string } }> = [];`

### 3) Guard possibly-undefined `.value.data`
- After `Promise.allSettled`, use optional chaining and default arrays:
  - `const ethTransfers = alchemyEth.status === 'fulfilled' && alchemyEth.value.success ? (alchemyEth.value.data?.transfers ?? []) : [];`
  - Same for `AlchemyTokens` token transfers.
- In enhanced analysis:
  - `const tokenBalances = tokens.status === 'fulfilled' && tokens.value.success ? (tokens.value.data?.tokenBalances ?? []) : [];`
  - `const ownedNfts = nfts.status === 'fulfilled' && nfts.value.success ? (nfts.value.data?.ownedNfts ?? []) : [];`
  - `const transfers = recentActivity.status === 'fulfilled' && recentActivity.value.success ? (recentActivity.value.data?.transfers ?? []) : [];`

### 4) Replace `params` with query strings in `ETHERSCAN_CLIENT.get`
- Build URLs explicitly:
  - `ETHERSCAN_CLIENT.get(
    \'?chainid=1&module=account&action=txlist&startblock=0&endblock=99999999&sort=desc&page=1&offset=100&apikey=...\'
  )`
  - Same for `tokentx`.

### 5) Remove random USD fallbacks for whale value calc
- In `calculateUSDValue`, if token price is unavailable, return `0` instead of a random large value; this prevents distorted whale classification and inconsistencies.

### 6) Validation and Tests
- Add unit test(s) for the `cached` decorator new-style:
  - Verify the wrapper caches results for identical args and respects TTL.
- Add a small test for URL building to ensure no `params` usage remains and the URL contains expected query keys.
- Run type-check to ensure diagnostics are resolved.

## Dependencies & Side Effects
- The decorator change affects any other `@cached` usages; compatibility mode prevents breakage.
- URL changes only affect Etherscan requests in WhaleEngine.
- Returning `0` for unknown token prices may reduce counted whale events; this is correct and safer than fake values.

## Deliverables
- Updated `lib/ai/shared/cache.ts` decorator implementation.
- Typed and guarded whaleEngine methods eliminating TS diagnostics.
- Correct Etherscan URL construction.
- Unit tests for caching and URL building.
- Verified build without decorator or implicit-any/type-undefined errors.