## Problems Identified
- ETH value displayed in wei, causing massive numbers in UI and API.
- Token discovery pulls in many airdrop/scam contracts, slowing balance/price fetching and corrupting overview.
- Scam detector runs on noisy token lists, making alerts inconsistent with overview.
- Private WalletAPI cache calls used from API route.
- TypeScript error in `lib/ai/shared/alchemy.ts` blocks typecheck.

## API Route Stabilization (`src/app/api/analyze-wallet/route.ts`)
1. Guard `Promise.allSettled` results before property access and derive `portfolioData` via safe fallbacks.
2. Convert wei → ETH for `ethBalance` and compute `ethValueUSD` from ETH units.
3. Replace private cache usage (`WalletAPI.getCache/setCache`) with a local in-memory `Map` or expose a public method.
4. Use consistent `portfolioData` variables and remove unused params from background work.
5. Ensure `applyRulesDetection(features, simulationResult, tokenAddress)` call has all required args.

## Token Discovery & Filtering (`src/lib/api/wallet.ts`)
1. Build `contractCounts` from recent transactions and compute a `txCount` per contract.
2. Filter likely spam:
   - Exclude single-transaction contracts with names containing `airdrop`, `claim`, `reward`, `gift`, `test`.
   - Exclude extremely long symbols (>12 chars).
   - Always keep major/DeFi tokens (`isMajorToken`/`isDeFiToken`).
3. Cap the candidate contracts to the top 60 by `txCount`.
4. Fetch balances in chunked concurrency (e.g., groups of 10) with short timeouts.
5. Maintain circuit breaker checks to skip sources when overwhelmed.
6. Prefetch prices for top tokens (limit ~20) and mark `hasNoPriceData` when price is unavailable.
7. Sort by `valueUSD` and limit to top 15 for overview.

## Scam Detection Integration (`src/app/api/analyze-wallet/route.ts` & `src/lib/ai/scam/*`)
1. Create `features` objects that match `TokenFeatures` exactly (fill required fields; remove extraneous ones).
2. Provide a `simulationResult`:
   - Use honeypot simulator if available; otherwise a minimal stub `{ canSell: true, success: true, gasUsed: 150000 }`.
3. Run detection only on filtered tokens; aggregate `high`/`medium` risk into `allFlaggedTokens`.
4. Keep `safeTokens` list for overview; report counts (verified/unverified/flagged).

## UI Normalization (`src/components/features/portfolio/enhanced-overview.tsx`)
1. Display ETH with fixed precision (e.g., 4 decimals) from ETH units.
2. Show token table balances with consistent precision (e.g., 6 decimals) and label `Price Unavailable` when `hasNoPriceData`.
3. Insert ETH as the first token if missing using computed `ethBalance` and `ethValueUSD`.

## TypeScript Hygiene
- Fix syntax error in `lib/ai/shared/alchemy.ts:31` to allow `tsc --noEmit` to succeed.
- Remove unused imports (e.g., `TokenData`) and implicit `any` hot spots as needed.

## Validation Plan
1. Run dev server and hit `/api/analyze-wallet?address=<large_wallet>`.
2. Confirm:
   - ETH displays ~29.8537 for the reported wallet.
   - Overview loads quickly with top tokens and price-unavailable labels where needed.
   - Scam alert lists only filtered high/medium-risk tokens; counts match overview.
3. Measure performance (log timings) and adjust chunk sizes/limits if needed.
4. Run `tsc --noEmit` and `next lint`; address only errors related to touched files.

## Files Touched
- `src/app/api/analyze-wallet/route.ts`
- `src/lib/api/wallet.ts`
- `src/components/features/portfolio/enhanced-overview.tsx`
- `src/lib/ai/shared/alchemy.ts` (syntax fix)

## Rollout & Safety
- Changes are guarded and additive; spam filtering retains majors/DeFi tokens.
- Concurrency and timeouts reduce API strain without breaking functionality.
- Local cache avoids private API interactions.

If you approve, I will implement these changes and verify in the running dev server, ensuring the overview and scam detector work together correctly for large/scam-heavy wallets.