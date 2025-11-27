## Suspected Cause
- Server `portfolio.tokens` may be empty or include ETH due to payload errors or over‑filtering. The client applies a $50 threshold and slices to 15, which hides ERC‑20s when `valueUSD = 0`. Dev aborts can delay token population.

## Plan
1) Inspect and log server payload
- Add concise logs in `route.ts` showing `portfolio.tokens.length`, first 10 token symbols, and ensure ETH is excluded (no `contractAddress` → filtered out).
- Ensure `WalletAPI.fetchTopTokensOnly` and `getAllTokens` return ERC‑20 tokens with `address` and do not inject ETH.

2) Exclude ETH from tokens at the server
- Filter `portfolio.tokens` to only entries with `address` and symbols not equal to `ETH`.
- Keep tokens with `hasNoPriceData` and set `valueUSD` to 0; do not discard.

3) Loosen client display filters
- Remove the `$50` significant threshold for initial render; show up to 20 tokens regardless of `valueUSD`.
- Always include a capped subset of no‑price tokens.
- Ensure ETH never appears in the token table.

4) Validation
- Log UI counts before/after: number of displayed tokens, count of no‑price tokens.
- Verify total equals ETH USD plus token USD sum.

5) Tests
- Add tests to validate that ETH is not included in `portfolio.tokens` and that client renders tokens when many have zero prices.

## Deliverables
- Server and client fixes applied.
- Verification logs and screenshots.
- Tests covering token visibility and total correctness.