## Summary
- Fix a runtime crash in `src/app/api/analyze-wallet/route.ts` caused by an undefined variable, which returns 500 and breaks the wallet overview.
- Improve error handling and fallbacks in the wallet overview so UI degrades gracefully when analysis fails.
- Validate and unify Etherscan key usage and add guardrails to reduce non-OK responses that lead to zero balances.
- Add tests and lint rules to prevent similar regressions.

## Root Causes
1. Terminal error (server): `ReferenceError: flaggedTokens is not defined` in `src/app/api/analyze-wallet/route.ts:501–511`, followed by `console.error('❌ Wallet analysis error')` and a 500 response.
2. Wallet display degradation (client): Etherscan non-OK responses log warnings in `src/lib/api/wallet.ts:319–322`, returning `'0'` for balances and empty tokens; combined with analysis 500, `EnhancedOverview` throws at `src/components/features/portfolio/enhanced-overview.tsx:245`.

## Implementation Steps
### 1) Route Bugfix
- Replace `flaggedTokens.push(...)` with `allFlaggedTokens.push(...)` and ensure `allFlaggedTokens` is the single source of truth for flagged items.
- Add a local `const flaggedTokensForScamTab = [...]` init check and keep `allFlaggedTokens = [...flaggedTokensForScamTab]` consistent.
- Verify surrounding variables (`highRiskCount`, `lowRiskCount`, `scamResults`) are defined and used consistently.

### 2) Client Error Handling
- In `EnhancedOverview`, remove the hard throw when `analysisResult.success === false`; set component `error` state and show the existing error UI block instead of throwing.
- Ensure the overview renders ETH balance, price, and any tokens available even when analysis fails.

### 3) API Key Validation & Fallbacks
- Add a small helper in `wallet.ts` to resolve Etherscan API key once with precedence: `NEXT_PUBLIC_ETHERSCAN_API_KEY` → `ETHERSCAN_API_KEY` → fallback sample key.
- Log a single diagnostic when using the fallback key and annotate potential rate limiting; avoid constructing URLs with `apikey=undefined` (e.g., paths in `ai/shared/api.ts`).
- Optional: If keys are missing, skip Etherscan calls and prefer DeBank/Zapper paths to avoid repeated non-OK responses.

### 4) Timeouts & Circuit Breaker Hygiene
- Keep existing short timeouts; add source-tagged errors to circuit breaker when a source returns non-OK (not only on network errors) to reduce repeated failing calls.
- Confirm success recording resets breaker state.

### 5) Tests
- Unit test the route: given a sample `overviewData.tokens`, ensure flagged tokens are aggregated without crashing and 200 is returned.
- Unit test `WalletAPI.analyzeWallet` to assert: non-OK route response maps to `{ success: false }` and client handles gracefully.
- Add a test for Etherscan key resolution to ensure no `undefined` apikey in URLs.

### 6) Lint/Build Guardrails
- Enable `no-undef` and basic TypeScript strictness that fails on build in `next.config.ts` or ESLint config.
- Add CI step to run lint/test to catch undefined identifiers.

## Expected Outcome
- Terminal crash eliminated; route returns 200 and valid payloads.
- Wallet overview no longer hard-crashes; shows data with clear error banner when deeper analysis fails.
- Reduced warnings about non-OK Etherscan status; fewer zero balance fallbacks; more robust multi-source behavior.

## Verification
- Run dev server, load an address to confirm route returns 200 and UI renders without throws.
- Inspect logs to ensure no `flaggedTokens is not defined` and that analysis performance logs show success.
- Simulate missing API keys to ensure URLs never include `apikey=undefined` and client still renders fallback data.

## Files To Update
- `src/app/api/analyze-wallet/route.ts` (bugfix and minor consistency)
- `src/components/features/portfolio/enhanced-overview.tsx` (error handling)
- `src/lib/api/wallet.ts` and `src/lib/ai/shared/api.ts` (API key resolution helper and usage)
- Test files under `src/__tests__/` (new tests)
- ESLint configuration and `next.config.ts` (guardrails)