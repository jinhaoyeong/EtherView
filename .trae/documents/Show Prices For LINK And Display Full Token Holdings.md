## Diagnosis
- LINK shows “Price Unavailable” because the current price path either rate-limited (429) or didn’t obtain the contract-address price. The code prefers a proxy first, then direct CoinGecko; if both fail, it marks `hasNoPriceData`.
- Only two tokens display because the main table hides small-balance tokens by default and the discovery path may return few tokens when Alchemy isn’t configured or Etherscan pages are limited.

## Fix Plan
1) Price Reliability (LINK)
- Always attempt batched address-based pricing first for all tokens (contract addresses).
- If batch misses a token, immediately use direct contract-address pricing, then fallback providers (Coinbase/CryptoCompare for majors like LINK) before marking `hasNoPriceData`.
- Add a short delay/retry on 429 per token to reduce “no price” cases.

2) Token Discovery Coverage
- Use Alchemy `getTokenBalances` as the primary source. If zero or Alchemy not configured, expand Etherscan V2 discovery to up to 5 pages (1000 tx) when token count < 5, then balance-check contracts.
- Ensure all Etherscan calls are V2 with `chainid=1`.

3) UI Visibility Improvement
- Auto-expand “Small Balance Tokens” when the overview list has fewer than 5 tokens so users see full holdings immediately.
- Keep ETH injection only when tokens array is empty.

4) Verification
- Run the app, load a wallet with LINK and other ERC‑20s.
- Confirm LINK has a price and value populated.
- Confirm more tokens appear (not just ETH and LINK), and small-balance tokens are visible by default when the list is short.

On approval, I’ll implement these changes, restart the dev server, and verify the UI and logs to ensure LINK is priced and additional tokens are shown.