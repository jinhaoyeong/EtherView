## Diagnosis
- The server error “await is only valid in async functions...” occurs while loading an SSR chunk. This is typically caused by Stage‑3 decorators generating helper code that relies on top‑level await. Next/Turbopack can produce this when TypeScript decorators are present in server components/libraries.
- Remaining decorator sites were found in `lib/ai/scam/scamFeatures.ts` with multiple `@cached(...)` usages. Earlier errors referenced `_decorateClass` and `_decorateElement`, which aligns with decorator transforms.
- Fallback price logs are produced by `estimateTokenPrice()` when cache misses. We already changed portfolio and transactions to actively fetch prices; we’ll ensure no other usage remains.

## Fix Plan
1) Remove decorators from `lib/ai/scam/scamFeatures.ts`:
- Replace `@cached(...)` with explicit, local memoization using the existing `cache` helper or a lightweight Map keyed by method + args.
- Remove imports of `cached` where no longer needed.

2) Audit all remaining `@cached` usages and remove them:
- Confirm `lib/ai/shared/alchemy.ts` and `lib/ai/whale/whaleEngine.ts` have no decorators (we already removed them).
- Verify no other files import or use `cached`/decorators.

3) Ensure no top‑level await or non‑async await in server components:
- Review `src/app/*` and shared libs to confirm `await` is only inside `async` functions.
- Adjust any helper using `await` in non‑async functions.

4) Price fetching behavior
- Confirm no remaining calls to `estimateTokenPrice()` for live pricing; switch to:
  - Batch by address (`fetchTokenPricesByAddress`) for portfolio tokens.
  - On‑demand fetch (`fetchTokenPrice`) for cache misses in transaction views.
- Keep stablecoin fallbacks only when network calls fail.

5) Verification
- Run dev server, ensure no SSR chunk load errors.
- Confirm Token Positions show tokens with prices and reduced 429s.
- Re-run diagnostics on `lib/ai/whale/whaleEngine.ts` and `lib/ai/scam/scamFeatures.ts` to verify clean compilation.

If approved, I’ll remove the remaining decorators, implement explicit caching in scam features, and verify the server starts without the chunk error, while keeping the improved price fetching behavior.