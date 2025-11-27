## Overview

The dashboard shows total portfolio value lower than ETH holding value. Root cause: mi totals. Thxed data sources and stalee server keeps `portfolio.totalValueUSD` from the fast summary while recomputing `ethValueUSD` later, and the client transforms tokens without recalculating the total. Prior abort logs are a dev-mode artifact and unrelated to calculation correctness.

## Step 1: Verify Data Sources & Logic

* Server: `src/app/api/analyze-wallet/route.ts`

  * Uses `WalletAPI.fetchPortfolioSummaryFast` to build `portfolioData` (with `totalValueUSD`), then recomputes `balanceETH` and `ethValueUSD` using a different price path.

  * Keeps `portfolio.totalValueUSD = portfolioData.totalValueUSD` leading to mismatch.

* Client: `src/components/features/portfolio/enhanced-overview.tsx`

  * Transforms tokens (`safeTokens` + top no-price tokens) but does not recalc `totalValueUSD` after transformation.

* Token prices: `src/lib/api/wallet.ts`

  * Fast summary uses estimated prices; recent changes removed volatile fallbacks, keeping 0 for unknowns, which is correct but requires clear totals.

## Step 2: Correct Totals & Missing Assets

* Server recompute:

  * In `route.ts` POST, after computing `balanceETH` and `ethValueUSD`, set `totalTokenUSD = sum((portfolioData.tokens || []).map(t => t.valueUSD || 0))`.

  * Set `analysisResult.portfolio.totalValueUSD = (ethValueUSD || 0) + totalTokenUSD`.

  * If `ethValueUSD` is null (price unavailable), set `totalValueUSD = totalTokenUSD` and include `ethPriceSource` for transparency.

* Client recompute:

  * In `EnhancedOverview`, after building `transformedPortfolioData.tokens`, set `transformedPortfolioData.totalValueUSD = (transformedPortfolioData.ethValueUSD || 0) + sum(displayTokens.valueUSD)`.

  * Ensure tokens with `hasNoPriceData` show "Value Unavailable" and are excluded from the sum (use only numeric `valueUSD`).

## Step 3: Review Previous Issue & History

* Prior issue: `net::ERR_ABORTED /api/analyze-wallet` during mount is dev Strict Mode abort. We already:

  * Added `AbortController` and silent abort handling in `WalletAPI.analyzeWallet` and `EnhancedOverview`.

  * This has no effect on totals and is not a production defect. No further change needed unless you want to suppress the devtools entry (we can gate the effect with a ref).

## Step 4: Dependencies & Side Effects

* Consistency across sources:

  * Ensure both server (route) and client (overview) compute totals from the same token list and the final `ethValueUSD`.

  * Avoid using `portfolioData.totalValueUSD` from fast summary directly; always recompute using the latest eth price and token values.

* Tokens with no price:

  * Keep them visible with labels but exclude from total to avoid inflating/deflating value.

## Step 5: Implement Fixes & Tests

* Server changes:

  * Update `route.ts` to recompute `totalValueUSD` from `ethValueUSD` + tokens.

  * Include `ethPriceSource` and make `ethValueUSD` nullable when price unavailable.

* Client changes:

  * Update `EnhancedOverview` to recompute `totalValueUSD` after token transformation.

* Unit tests:

  * Add tests in `src/lib/test/portfolio-calculation.test.ts`:

    * Given tokens A/B with `valueUSD = 100/50` and `ethValueUSD = 200`, expect `totalValueUSD = 350`.

    * With a token having `hasNoPriceData` and `valueUSD = 0`, ensure it is excluded from sum.

    * With `ethValueUSD = null`, ensure total equals tokens sum and ETH USD label shows "Unavailable".

## Step 6: Validation & Regression Safety

* Verify dashboard:

  * ETH USD value equals latest server price and matches portfolio total sum.

  * Scam Token Alert list remains populated; counts (verified/unverified/flagged/noPrice) unaffected.

* Cross-check Whale and Transactions tabs continue working (no dependency on the total recomputation).

* Run tests to ensure no regressions.

## Deliverables

* Corrected and consistent totals across server response and client display.

* Clarified handling for tokens with no price and ETH price source.

* Unit tests proving totals and null price scenarios.

* Short documentation note in PR description summarizing root causes and fixes.

