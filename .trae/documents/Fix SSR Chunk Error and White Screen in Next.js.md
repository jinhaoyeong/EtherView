## Diagnosis
- The dev server fails with “await is only valid in async functions…” while loading an SSR chunk for `/page`. This typically happens when TypeScript decorators are present or a module emits decorator helpers into the server bundle. We already removed decorators from Whale/Alchemy/Scam modules, but stale builds or remaining decorator usages can still poison the SSR chunk.
- White screen is a direct consequence of SSR failing; page returns 500.

## Plan
1) Repository-wide audit
- Search for any remaining decorator usages (`@cached`, other `@...`) and remove them; replace with explicit caching.
- Verify there is no top‑level `await` and no browser‑only APIs executed at module scope in server-shared files.

2) Scam features cleanup
- Finish decorator removal in `lib/ai/scam/scamFeatures.ts` (done); ensure all Etherscan calls use query strings; confirm compilation diagnostics are clean.

3) Whale engine guards (done)
- Keep the added null-safety for `Promise.allSettled` results (`tokens.value.data`, `nfts.value.data`, `recentActivity.value.data`).

4) Clean build artifacts
- Delete `.next` folder to clear stale SSR chunks; restart dev server after fixes.

5) Verify
- Start dev server and load `/` to ensure no SSR chunk error and page renders.
- Confirm Token Positions load with ERC‑20s and prices and the logs are free of 429 bursts.

On approval, I’ll run the audit, remove any residual decorators, clear `.next`, and restart dev to verify the page renders normally.