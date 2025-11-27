## Goals
- Detect latest scam techniques beyond current checks.
- Keep whitelist bypass intact; focus effort on non‑whitelist tokens.
- Maintain fast UI response via caching and adaptive throttling.

## New Detection Modules
- Honeypot/Tax & Transfer Controls:
  - Detect dynamic fees, block‑height based taxation, trading gates, maxTx/maxWallet limits, blacklist/whitelist enforcement, anti‑whale rules.
  - Identify hidden owner privileges (mint/burn/upgrade/toggle fees) and proxy upgradability controls.
- Liquidity & Market Integrity (Dexscreener):
  - Pool age, liquidity size, lock status, LP unlock schedule, multi‑router presence, price impact/slippage risk, wash‑trading indicators.
- Airdrop/Dusting & Approval Scams:
  - Mass very‑small airdrops, approval phishing signatures, sudden `increaseAllowance` waves.
- On‑Chain Behavior & Source Heuristics:
  - Post‑deploy mint/burn spikes, ownership renounce status, AccessControl roles, obfuscated/assembly blocks, delegatecall/proxy patterns.
- External Signals:
  - Honeypot.is API check (where available), Dexscreener flags, Etherscan labels (phishing/address tags), Chainabuse/CryptoScamDB lookups.

## Feature Extraction Additions
- Static Code:
  - Parse common patterns: Ownable, AccessControl, Upgradeable, Pausable, FeeManager; locate write functions that change taxation or enable trading.
- Holder Distribution:
  - Exclude LP/routers; compute top holders net of contracts; flag dev wallets.
- Liquidity:
  - Query Dexscreener pools; capture liquidity USD, lock info, pool age; mark rug risk if LP unlock imminent.
- Simulation:
  - Multi‑router buy/sell sim (Uniswap v2/v3, Sushi, 1inch router); capture revert reasons; test with typical slippage and gas limits.
- Transactions:
  - Detect mint/burn spikes; straight‑line inflows to single wallet; bot pattern (high‑frequency micro swaps).
- External Reputation:
  - Etherscan label presence; Honeypot.is (boolean + reason); Chainabuse/CryptoScamDB count.

## Scoring & Output
- Risk score components with weights:
  - Liquidity risk, transfer controls/tax, code privileges, holder concentration, simulation sellability, external reputation.
- Confidence band based on data coverage.
- Reasons list and recommended actions.

## Implementation Steps
- Files:
  - `lib/ai/scam/scamFeatures.ts`: add detection hooks, scoring, and new evidence fields.
  - `lib/ai/scam/honeypotSimulator.ts`: extend multi‑router simulation, revert capture, fee/tax estimation.
  - `lib/ai/scam/types.ts`: add fields: liquidityInfo, controlsInfo, simulationResults, externalSignals.
  - `lib/ai/shared/fetcher.ts`: add Dexscreener/Honeypot.is/Chainabuse endpoints with rate‑limit aware wrappers.
- Performance:
  - Cache per contract results (24h metadata, 1h liquidity), concurrency caps, retry once with backoff; whitelist skip stays.

## Verification
- Run detection on known honeypot/memecoins and majors; compare:
  - Honeypot tokens flagged; majors remain low risk.
  - Liquidity lock/unlock data present; simulation reports sellability.
  - External signals populated when available.

## Keys & Limits
- No mandatory new keys; optional endpoints:
  - Honeypot.is (if available), Chainabuse/CryptoScamDB (public/free).
- Respect provider rate limits with cool‑downs and caching.

If you approve, I’ll implement these modules, expand types, wire Dexscreener/externals, and verify against recent scam patterns.