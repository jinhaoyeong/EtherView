# EtherView verification — 9 November 2026

The app was exercised through the browser using public Ethereum addresses, with desktop and 390px phone layouts. Checks covered the real development app and a separate production build. No wallet signing or private credentials were used.

## Browser interaction coverage

| Area | Checks | Result |
| --- | --- | --- |
| Address explorer | Invalid address feedback, whitespace trimming, public examples, lookup from another page, network quote/gas/block display | Passed |
| Portfolio | Real balances and asset positions, allocation, text search, no-match state, recognized/unpriced filters, clear filters, native asset details, refresh while retaining previous snapshot | Passed |
| Transactions | Live history, address/asset search, failed-transfer filter, empty-filter recovery, refresh, source links, production pagination from 15/page 1 to 30/page 2 | Passed |
| Large transfers | Available-history screening, threshold and direction selection, no-match state, failed/pending attempts excluded | Passed |
| Token risk | Actual token screening, search, list/grid, pagination, evidence expansion, risk filters, no-match state | Passed |
| News | No-source state, search, analysis-depth switch, refresh, source-coverage disclosure | Passed with data limitation: no live stories returned; populated article expansion was not verified |
| Settings | Compact mode, motion, light/dark selection, reload persistence, cross-tab sync, automatic-refresh control | Passed |
| Settings files | Exported JSON parsed successfully, malformed import rejected, exported settings imported successfully | Passed |
| Wallet remembrance | Turning remembrance off removes the saved address; reload shows no selected wallet | Passed |
| Documentation, privacy, recovery | Open/close dialog, coverage tab, privacy navigation, matching 404 screen and return to portfolio | Passed |
| Phone layout | Sidebar drawer, keyboard dismissal, page routing, layout width, asset/value holdings view and asset details | Passed |

The production history endpoint experienced a temporary upstream outage during this run. The inline retry state was verified, and retry subsequently returned real records with no console exception.

Provider availability changes over time. Public history is bounded and quotes may be unavailable. An empty news response is shown honestly, without invented headlines or sentiment. Native/history/pricing outage and malformed-response behavior is additionally covered by deterministic regression tests.

## Errors found and corrected

- Theme reads wrote preferences back to storage, allowing another tab to overwrite the latest user choice. Preference reads now apply appearance without writing; two-tab interleaving is regression-tested.
- Risk screening performed unrelated balance/history/whale requests. A bounded, validated risk-only endpoint now uses the supplied token data.
- Risk details displayed unobserved holder/tax values as zero and exposed internal score keys. These were removed; limited heuristic coverage is explicit.
- Risk counts omitted known addresses from the visible breakdown; the summary now reconciles assessed and known assets.
- Risk telemetry could delay completion; it is now nonblocking with a timeout.
- Risk filters and expanded results could survive a wallet change. State now resets per address.
- Sentiment batching ignored its concurrency setting and could shift results onto the wrong articles after a failed request. Order and failures are now handled explicitly.
- Concurrent pricing and analysis consumers could multiply provider requests. Shared in-flight work and bounded caching reduce request pressure.
- A legacy DEX fallback could price a quote token as the base token or use another chain. Contract/network checks now match the primary provider safeguards.
- Failed/pending transfer attempts were eligible for whale classification. They are excluded.
- Global rejection handling suppressed and duplicated genuine errors. That suppression was removed.
- Removed unsupported daily-change and analysis-window settings instead of displaying controls with no active consumer.
- The old red debug page redirects to the overview; the 404 page uses the app layout.

## Repeatable checks

- `npm test`: **31 deterministic regressions passed**.
- `npm run typecheck`: passed.
- Production build: passed.
- Targeted ESLint on redesigned pages, layout, settings, and providers: passed.
- `git diff --check`: passed.

The repository-wide lint command still reports 148 legacy provider/library typing and unused-declaration errors. It is not described as passing. This report is evidence of the listed flows, not a guarantee of every provider, token, browser, or future network condition.

## Cloudflare deployment verification — 2026-11-09

- Published the full app, static assets, and server API routes to https://etherview.yeongjinhao09.workers.dev.
- Worker: `etherview`; deployed version: `f59ed609f9c94608b9360069c9358f20`. HTTPS and the workers.dev route are enabled. Logs and traces are enabled with query-string redaction.
- Cloudflare production build, original Next.js production build, and the current strict TypeScript check passed. All **33 regression tests** passed. The installed dependency audit reported **zero known vulnerabilities**.
- Live `/api/health` returned HTTP 200 with healthy pricing. The read-only balance RPC returned HTTP 200 and a real ETH balance.
- The mobile public-wallet portfolio loaded its native balance and valuation after retrying an initial provider failure. The UI identified limited asset discovery instead of presenting the result as a complete portfolio.
- Blockscout and Ethplorer returned HTTP 429 to Cloudflare's shared hosting IP. Added a bounded direct-browser history fallback, retaining address/record validation and excluding provider credentials. Live transaction history then loaded 15 records, including a failed transaction. Whale watch read 100 available records and showed no matches at the selected threshold.
- Tested the hosted overview, portfolio, transactions, whale watch, risk, news, settings, privacy, and mobile navigation at a 390×844 viewport; checked the transaction layout at 1440×1000. Added horizontal overflow clipping while keeping wide transaction tables independently scrollable. Reset the test viewport and cleared the sample wallet before leaving the app open.
- Risk and news rendered their explicit unavailable/empty states. Full token discovery and news remain dependent on provider availability and optional credentials; these integrations are not represented as fully configured.
- Removed the temporary provider-diagnostic Worker and temporary upload credentials after deployment.

Screenshots: `cloudflare-mobile-preview.png` (portfolio) and `cloudflare-mobile-transactions.png` (final mobile transaction view).

## Premium visual redesign — 2026-11-09

Replaced the previous sidebar and accumulated visual overrides with a shared horizontal navigation, a faceted Ethereum landing illustration, a platinum portfolio balance panel, proportional allocation, and coordinated research pages. The mobile navigation and transaction records have dedicated small-screen layouts. Motion includes navigation, page entries, hover transitions, and the Ethereum illustration; both the system reduced-motion preference and the saved motion setting are respected.

- Strict TypeScript, 33 regression tests, the Cloudflare production build, and targeted ESLint across all redesigned pages/components passed. Updated the Next.js lint config and TypeScript ESLint packages to fix their ESLint 9 compatibility crashes. Production dependency audit: zero known vulnerabilities. `git diff --check` passed.
- Local browser checks covered a populated portfolio (101 discovered assets), asset details, real transaction history, risk results (100 assessed tokens), insights' no-source state, privacy, settings, and mobile menu routing/Escape dismissal. Light mode and the saved motion toggle were verified at 390×844. Portfolio and privacy document widths stayed within the viewport.
- Deployed Worker version `c3527fd373ef43bda23aef12e0b166b3` to the same public URL. All seven page routes and `/api/health` returned HTTP 200 after deployment.
- The live mobile landing displays the new design and real network statistics. Invalid wallet input is rejected inline; the public example starts a real portfolio lookup.

The earlier flow coverage remains recorded above. This pass rechecked the redesigned surfaces; it does not imply fresh exhaustive coverage of every provider or populated news content.

- Live history loaded 15 real transfers; searching for VITALIK returned the two matching records. Mobile transfer cards displayed amounts, counterparties, status, and source links without horizontal overflow. Whale screening completed across 300 records and returned a matching transfer. No console errors were captured in these live flows.
- The hosted portfolio loaded a real ETH balance and quote, with incomplete token discovery explicitly disclosed. The original Next.js production build also passed.

### Hosted balance recovery follow-up

A fresh browser session exposed intermittent balance failures after the initial successful lookup. The API still returned a valid balance in a separate read, so the precise cause of those specific browser failures was not established. Review found two concrete weaknesses: the shared balance helper could fall back to localhost in a browser, and its timeout could expire before the RPC proxy completed its default provider chain.

- Browser balance requests now use the active app origin. The portfolio reuses the shared validated balance reader rather than maintaining a second implementation.
- Added a fixed, credential-free public RPC recovery path, caller cancellation, and a maximum 32-second sequence inside the portfolio’s 35-second boundary. Failure remains unavailable rather than becoming zero.
- All **37 deterministic regression tests** passed, including four new balance-origin, fallback, malformed-response, and cancellation cases. Strict TypeScript and targeted portfolio lint passed; the final Cloudflare build passed.
- Final Worker version: `c3527fd373ef43bda23aef12e0b166b3`. Screenshots: `premium-desktop-preview.png`, `premium-mobile-preview.png`, and `premium-mobile-transactions.png`.
- The final hosted build successfully loaded the public example's 5.79382 ETH balance and an observed quote, producing a $12,326.09 estimate during verification. The Uniswap factory example also returned an observed zero native balance. Token discovery remained partial; upstream multicall warnings were present, so this is not reported as a warning-free provider run.
- Saved `premium-portfolio-preview.png`, cleared the sample wallet, reset the temporary viewport, and left the hosted app open as the deliverable. Temporary deployment credentials and the agent-owned local preview server were removed/stopped.
