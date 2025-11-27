## Problems
- HEX appears with “Price Unavailable” though it’s a legitimate token.
- Duplicate entries (HEX/HXT repeated) reduce clarity.
- Price prefetch only covers top ~20 tokens; legitimate tokens may be skipped.

## Plan
1) Whitelist HEX
- Add HEX contract `0x2b591e99afe9f32eaa6214f7b7629768c40eeb39` with decimals to `ETHEREUM_TOKEN_WHITELIST` so it’s marked verified and prioritized.

2) Deduplicate Tokens by Address
- Before computing prices and display, de-duplicate the token array by lowercase `address` to remove repeated entries (HEX/HXT duplicates).

3) Expand Price Prefetch Coverage
- In `WalletAPI.fetchTopTokensOnly`:
  - Build `tokensToFetch` as: all verified/whitelisted tokens (by address) + remaining top tokens by balance, capped at ~60.
  - Ensure fetch uses `address` so CoinGecko `simple/token_price` endpoint succeeds for HEX.
  - Cache results; `estimateTokenPrice` will then return cached values.

4) Display Logic
- Use deduped tokens for overview; keep `hasNoPriceData` only when price fetch returns 0; avoid showing duplicates.
- Continue excluding flagged tokens from overview; HEX should not be flagged when whitelisted.

5) Validation
- Log pricing results for HEX and other whitelist tokens (address → price).
- Add a test for deduplication and price availability for a whitelisted token.

## Deliverables
- Code updates in `wallet.ts` and route to prioritize whitelist pricing and deduplicate tokens.
- Verification logs and a small unit test to ensure deduplication and HEX pricing behave correctly.