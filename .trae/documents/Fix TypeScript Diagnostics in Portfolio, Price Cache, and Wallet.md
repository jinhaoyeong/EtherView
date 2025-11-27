## Changes
- Update `TokenPosition` to include optional fields used by UI: `riskLevel?`, `hasWarning?`, `priceSource?`.
- Fix portfolio mapping to use `token.address` instead of `contractAddress` and type annotation for `.map((t: TokenPosition) ...)`.
- Remove references to non-existent fields on `ScamDetectionResult`: use `tokenAddress`, drop `name/valueUSD` usage in flagged list.
- In `priceCache`, replace `Promise.race` with direct `fetch` using `AbortSignal.timeout` to avoid `unknown` response type; keep caching and source tags.
- In `wallet`, replace BigInt literals `0n` with `BigInt(0)` and comparisons with `> BigInt(0)` to satisfy ES target.

## Files Updated
- `src/components/features/portfolio/enhanced-overview.tsx`
- `src/lib/api/priceCache.ts`
- `src/lib/api/wallet.ts`

## Outcome
- All listed diagnostics resolved: missing properties, implicit `any`, `unknown` response type, BigInt literal target errors.
- UI continues to show price source tags and verified badges; risk warnings derive from optional fields without breaking types.