# EtherView redesign and review

## Design

The app uses a clean graphite interface with an Ethereum mark, compact sidebar navigation, global address lookup, and a shared type and spacing system. Color identifies assets, actual portfolio composition, and semantic risk/market signals rather than decorating every panel.

The portfolio has an open balance-and-composition area, inline native/coverage metrics, and a full-width holdings ledger. On phones, the ledger prioritizes asset and value; the detail modal contains the remaining fields. The empty explorer has real network snapshots and public address examples. Transactions, whale activity, risk, news, settings, privacy, and the 404 view use the same design system.

## Transaction history recovery

- Missing `ETHERSCAN_API_KEY` no longer blocks transaction history. The explorer proxy uses a fixed-host Blockscout v2 fallback without a key or when the preferred provider rejects a request.
- Public history is bounded to 300 recent records per feed, paged through validated cursors, and cached with in-flight deduplication. Unavailable or malformed upstream results are not cached as empty wallets.
- The client timeout accounts for server failover (30 seconds rather than 2 seconds).
- Handled provider outages use a recoverable typed error and inline retry state rather than `console.error`, preventing the Next development overlay for an expected outage.
- Large transfers fetch one combined 300-record window instead of making three overlapping requests.
- Missing ERC-20 transfer fee fields remain unavailable; fees are not fabricated.

## Correctness and security fixes

- Removed a committed Etherscan credential and credential-bearing URL logs. **Rotate that credential; removing it from current source does not remove it from Git history.**
- Validated Ethereum addresses, explorer parameters, mainnet chain selection, JSON bodies, batch limits, and read-only RPC methods.
- Corrected canonical token contract identities. Token symbols cannot establish identity, safety, or price.
- Fixed stale ETH/token pricing and provider-failure fallbacks. Missing prices are unavailable, never an invented ETH quote.
- Corrected Dexscreener base/quote and network matching, zero-decimal token handling, native ETH double counting, transaction pagination, and transfer deduplication.
- Removed fabricated news/outlook fallback data, invented token statistics, and a fake successful honeypot simulation.
- Replaced duplicate portfolio/analysis fetch sequences with one portfolio query, independent native RPC, cached results, search, and explicit partial-data handling.
- Fixed missing modal imports/runtime references and baseline sentiment TypeScript errors. Production builds now enforce TypeScript.
- Fixed cross-component settings synchronization, wallet remembrance, import validation, theme listener lifecycle, and storage clearing that previously erased unrelated origin data.
- USD is explicit until a real conversion source exists; static exchange rates cannot relabel wallet valuations.
- Removed runtime Google font downloads. The app uses system fonts and builds without a font network dependency.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. 31 regression tests cover keyless history fallback, validated cursor pagination, provider failover, recoverable outage handling, request rejection, canonical identities, unknown simulation results, price expiry/outages, distinct transfers, quote-side pricing, decimal normalization, and provider-failure versus empty-history handling.

Desktop and 390px mobile browser checks covered navigation, dark/light themes, input validation, public-wallet loading, asset search, token details, settings, empty states, and explicit provider-outage guidance. Production routes were smoke-tested. The redesigned frontend files pass targeted ESLint. `npm run lint` is functional but still reports legacy issues in provider/library code (primarily `any` and unused declarations). Build-time ESLint skipping is retained from the original project; TypeScript skipping is removed. Generated `.next` files are excluded from lint.

## Remaining boundaries

- Etherscan is an optional preferred history source. The public fallback is bounded, and public RPC/price/token providers can be limited, incomplete, delayed, or unavailable. A discovered-assets total is not a complete audited net worth.
- A recognized contract is not a safety guarantee. The app has no real transaction sell simulation provider; sellability remains unknown.
- Whale tracking is relative to the selected wallet's observed transfers. It is not a global mempool or full-network whale feed.
- Heuristic sentiment is not a verified forecast. Old unreferenced research modules (such as the standalone whale engine) still contain simulation code; the active whale page does not use that engine.
- The app is read-only and does not request signing, seed phrases, or private keys.

## Dependency maintenance

Updated compatible runtime dependencies, including Next.js 15.5.29, and pinned Next's PostCSS dependency to the patched 8.5 series with an override. The final `npm audit --omit=dev` reports **zero runtime vulnerabilities**. Six moderate advisories remain in the development-only ESLint dependency tree. Production and development builds use separate output directories to avoid cache corruption while both are active.

## App-wide verification

See [E2E-REPORT.md](E2E-REPORT.md) for the browser interaction matrix, production pagination/retry evidence, 31 regression checks, fixes found during testing, and limitations for unavailable news coverage. Settings reads no longer write back to storage, fixing a real cross-tab theme race. Risk screening now runs without unrelated market/history calls; unmeasured metrics and unsupported settings controls are not presented as working features.
