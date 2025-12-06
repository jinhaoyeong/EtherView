# CLAUDE.md

## Updated Folder Structure (Clean Slate)

```
src/
  app/
    api/
      analyze-wallet/route.ts
      etherscan-proxy/route.ts
      price-proxy/route.ts
      debank-proxy/route.ts
      covalent-proxy/route.ts
      news-sentiment/route.ts
      metrics/route.ts
      token-stats/route.ts
      health/route.ts
    scam/page.tsx
    whale/page.tsx
    news/page.tsx
    transactions/page.tsx
    settings/page.tsx
    privacy/page.tsx
    index/page.tsx
  components/
    layout/
      dashboard-layout.tsx
      header.tsx
    ui/
      button.tsx
      card.tsx
      badge.tsx
      table.tsx
      input.tsx
    features/
      portfolio/
        enhanced-overview.tsx
        token-detail-modal.tsx
      landing/
        documentation-modal.tsx
    error-boundary.tsx
  contexts/
    wallet-context.tsx
  hooks/
    use-currency-formatter.ts
    usePerformanceMonitor.tsx
  lib/
    api/
      wallet.ts
    ai/
      scam/
        scamEngine.ts
      whale/
        whaleEngine.ts
      sentiment/
        sentimentAnalyzer.ts
      shared/
        fetcher.ts
        api.ts
    eth/
      multicall.ts
    providers/
      cmc.ts
      dexscreener.ts
    config/
      tokenWhitelist.ts
    metrics.ts
    theme-manager.ts

metrics/
  metrics-overview.md
  metricsguide.txt
  labels/
    sentiment.jsonl
    scam.jsonl
    whale.jsonl
    prices.jsonl

package.json
tsconfig.json
next.config.js
```

## Clean-up Policy

- Removed file-based metrics snapshots and HTML report generation
- Removed diagnostic and test utilities from `src/lib/diagnostic/`
- Kept labeled datasets in `metrics/labels/` for reporting and evaluation
- Metrics are in-memory only, gated by `METRICS_ENABLED`; no disk writes

## Measurement Plan (per metricsguide.txt)

- Detection (scam, whale, sentiment): precision/recall/F1, PR curves, confusion matrix
- Fetching (prices, balances, transactions): coverage, latency, freshness, error/timeout rate, cache hit rate, MAPE for prices

## Viewing Metrics

- Enable with `METRICS_ENABLED=true`
- Read snapshot at `GET /api/metrics`


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EtherView** is an Ethereum Intelligence Dashboard that provides real-time wallet analytics, scam detection, whale tracking, and sentiment analysis. Users input a wallet address → the app fetches on-chain/off-chain data → displays analysis across five main tabs.

**Framework:** Next.js 15.2.4 + TypeScript + Tailwind CSS + ShadCN/UI
**Architecture:** Component-based with AI-driven analysis modules
**Focus:** Data logic accuracy and AI feature quality over UI polishing

## Development Commands

```bash
# Core Development
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Development Workflow
npm run dev          # Primary command for active development
```

## Architecture Overview

### Core Application Structure
- **Next.js App Router**: Uses `/app` directory with TypeScript
- **Component Architecture**: Feature-based organization under `/components/features/`
- **AI Modules**: Centralized AI analysis engines in `/lib/ai/`
- **API Integration**: Direct API calls with TanStack Query for state management
- **Performance-First**: Lazy loading, optimized caching, and error boundaries


# /init — EtherView (Ethereum Intelligence Dashboard)

**Project Type:** Web Application
**Framework:** Next.js + TypeScript + Tailwind + ShadCN/UI
**Goal:** Build a fully functional Ethereum intelligence dashboard that provides wallet analytics, scam detection, whale tracking, and sentiment analysis.

---

## 🌐 Project Description

EtherView is a **web application** designed to analyze any Ethereum wallet in real time.
Users input their wallet address on the landing page → the app fetches on-chain and off-chain data → then displays a full analysis dashboard across **five main tabs**:

1. **Overview** — main portfolio summary and asset breakdown
2. **Transactions** — historical transaction log with filters
3. **Whale Movement** — AI-driven detection of large market-moving transfers
4. **Scam Token Alert** — advanced detection of risky or malicious tokens
5. **News Sentiment** — AI-powered news and social sentiment analysis

The focus must always be on **data logic accuracy** and **AI feature quality** before UI polishing.
After all core systems are stable and accurate, the UI can be enhanced to resemble **Framer / Vercel v0 style** — smooth transitions, consistent color palette, and minimalistic card layouts.

---

## 🧭 Dashboard Layout (matches uploaded screenshots)

### 🧩 General UI Layout

* **Sidebar (left):** persistent navigation between Overview, Transactions, Whale Movement, Scam Token Alert, and News Sentiment.
* **Top Bar:** wallet input box + "Load Wallet" button + network dropdown.
* **Main Area:** each tab renders a self-contained component wrapped in a consistent layout.
* **Theme:** dark mode first (reference image) with orange primary accents and teal secondary; light mode must replicate same structure and spacing.
* **Card System:** all content shown as modular cards with consistent padding, rounded corners, shadow, and spacing.

---

## 🪙 Tab 1 — Overview

**Purpose:** Provide summary of wallet's entire portfolio.

### Sections:

1. **Your Balance**

   * Show total wallet value in **USD** and **ETH**.
   * Include **24h change percentage** (green/red text).
   * Data source: CoinGecko + on-chain balance.

2. **ETH Balance**

   * Show main ETH holdings separately.
   * **Do not double count** ETH (show once in total).
   * WETH must appear in Token Positions as a separate token.

3. **Portfolio Items**

   * Count total verified, unverified, and flagged tokens.

4. **General Statistics**

   * Historical chart (Recharts/Chart.js) with time filters:

     * Today, Last Week, Last Month, Last 6 Months, Year.
   * Show "No portfolio data" placeholder when empty.

5. **Token Positions**

   * Columns: Token | Price (USD) | Amount | Value (USD)
   * Include token icon, name, and verified badge.
   * Exclude scam tokens (those shown under Scam Token Alert tab).
   * Sortable by amount or value.
   * Handle pagination for large wallets.

### UI note:

* Layout: 3 balance cards on top → chart → token table.
* Replicate screenshot alignment exactly (consistent vertical spacing).

---

## 📜 Tab 2 — Transactions

**Purpose:** Show user's full transaction history with filtering and risk labeling.

### Sections:

1. **Filters:**

   * Trade, Received, Sent, Token Received, Token Sent.
   * Search box for hash or token symbol.

2. **Transaction List:**

   * Group by date.
   * Each card shows:

     * Token symbol, type, hash, from/to, USD value, and risk notes.
   * Label suspicious airdrop tokens or scam claim links.
   * Link hash to Etherscan.
   * Handle infinite scroll for large lists.

### Data:

* Etherscan API + CoinGecko for price mapping.
* Detect "phishing claim rewards" URLs and flag automatically.

### UI note:

* Style cards with same green/red tone for value changes as screenshot.
* Maintain clear spacing, identical to reference dark mode.

---

## 🐋 Tab 3 — Whale Movement

**Purpose:** Identify large transfers linked to potential market impact.

### Sections:

1. **Header cards:**

   * Total Events | Exchange Inflows | Exchange Outflows | Avg Impact.
2. **Whale Events List:**

   * Token, value (USD), from → to addresses.
   * Confidence level bar or badge.
   * "Why it matters" section with AI-generated explanations.
   * Impact score shown at right.
   * Timestamp at bottom.

### Logic:

* Detect large USD transfers (≥ $1M).
* Classify transfer type (wallet→wallet, wallet→exchange, etc).
* Estimate potential market impact.
* Correlate whale moves with news and price actions.

### UI note:

* Follow reference spacing.
* "Impact" badge aligned top-right.
* Confidence bar same horizontal alignment as sample.

---

## 🧠 Tab 4 — Scam Token Alert

**Purpose:** Detect and display risky or scam tokens in the user's wallet.

### Sections:

1. **Summary Cards:**

   * Critical, High Risk, Medium Risk, Honeypots, Total flagged tokens.
2. **List of Flagged Tokens:**

   * Token name, address, risk level, and score.
   * **Risk Factors:**

     * Contract unverified
     * Restrictive limits
     * Liquidity removal
     * Ownership concentration
   * **Warnings & Recommendations:**

     * "Medium risk - some concerns identified"
     * "Do thorough research before investing."
   * **Evidence Panel:**

     * Confidence percentage
     * Simulation log (if available)
     * Contract snippet

### Rules:

* Tokens labeled risky must **not** appear in Token Positions under Overview.
* Known safe tokens (e.g., Chainlink, Uniswap) must not be flagged.

### UI note:

* Match dark mode layout exactly.
* Light mode must replicate same structure, size, and spacing.

---

## 📰 Tab 5 — News Sentiment

**Purpose:** Provide AI-analyzed summaries of crypto and macro news.

### Sections:

1. **Comprehensive Market Summary**

   * Aggregated market sentiment (Bullish / Neutral / Bearish)
   * Confidence score (0–100)
   * Recent trend indicator (arrow or color).

2. **Live News Feed**

   * Fetch from multiple APIs (NewsAPI, GNews, Reddit, Twitter).
   * Show:

     * Title
     * Source
     * Short AI-generated summary
     * Sentiment badge (Bullish/Neutral/Bearish)
     * Entity tags (e.g., "Fed", "BTC", "Regulation")
   * Expandable cards for detail.

3. **Influencer & Social Data**

   * Show trending crypto discussions and tweets.
   * Use influencer-weighted signals to boost importance.

4. **Prediction Card**

   * AI-generated ETH short-term trend prediction with reasoning and confidence.

### UI note:

* Split screen layout:

  * Top = Market summary cards
  * Bottom = Scrollable news feed with expandable rows

---

## ⚙️ Core AI Modules

All logic resides in `/lib/ai/`:

* `/ai/scam/` → token risk detection
* `/ai/sentiment/` → sentiment & summarization
* `/ai/whale/` → large movement analysis

Each exposes a clean JSON API consumed by the UI components under `/components/features/`.

---

ai_integration:
  description: >
    Build EtherView's complete AI-driven intelligence system from scratch.
    The goal is to power wallet analytics through three main intelligence modules:
    Scam Detection, News & Social Sentiment, and Whale Movement.
    All logic must focus on accuracy, explainability, and reliability before UI polish.

  architecture:
    root_directory: "/lib/ai/"
    structure:
      - scam: Token risk and scam detection engine
      - sentiment: News, social, and market sentiment pipeline
      - whale: Whale movement and correlation analysis system
      - shared: Common utilities for caching, fetch logic, and models
    design_principles:
      - Accuracy first — deterministic logic before AI predictions
      - Transparency — every output includes reason, confidence, and evidence
      - Privacy & consent — no private keys or sensitive data sent to APIs
      - Resilience — caching, rate limit handling, and fallback logic required

  scam_detection:
    goal: >
      Detect and classify risky ERC-20 tokens from a user's wallet.
      Provide confidence, reasons, and evidence for each classification.
    workflow:
      - step_1: Static analysis of contract source code for suspicious functions (owner, mint, setFee, blacklist)
      - step_2: On-chain analysis of holder concentration, LP activity, transfer taxes, and token age
      - step_3: Honeypot simulation using forked RPC (Alchemy, Tenderly, or QuickNode)
      - step_4: Machine learning scoring with XGBoost or TFJS model using labeled dataset
      - step_5: Output risk label, score, reasons, and display evidence in UI
    required_files:
      - /lib/ai/scam/scamFeatures.ts
      - /lib/ai/scam/scamRules.ts
      - /lib/ai/scam/honeypotSimulator.ts
      - /lib/ai/scam/scamModel.ts
    ui_integration:
      overview_tab: >
        Filter out all high-risk tokens before showing under “Token Positions.”
      scam_alert_tab: >
        Display flagged tokens with detailed reasoning, risk factors, and confidence panel.
    testing_metrics:
      - ROC_AUC: ">0.85"
      - false_positive_rate: "<5%"
      - known_legit_tokens: "Must remain unflagged (AAVE, UNI, LINK)"

  sentiment_analysis:
    goal: >
      Collect and analyze multi-source crypto news and social data to
      summarize market sentiment, influencer signals, and predict short-term trends.
    workflow:
      - step_1: Fetch from NewsAPI, GNews, Bing News, CoinDesk, CoinTelegraph
      - step_2: Collect social posts from Twitter, Reddit, and influencer feeds
      - step_3: Deduplicate using cosine similarity on embeddings
      - step_4: Analyze sentiment using FinBERT or finance-tuned LLM
      - step_5: Summarize using PEGASUS or GPT summarizer for 1–2 sentence insight
      - step_6: Tag entities (Fed, CPI, ETH, BTC) using NER model
      - step_7: Aggregate weighted sentiment (source trust + influencer weight + recency)
      - step_8: Predict short-term ETH movement with confidence and reasoning
    required_files:
      - /lib/ai/sentiment/newsAggregator.ts
      - /lib/ai/sentiment/sentimentAnalyzer.ts
      - /lib/ai/sentiment/summarizer.ts
      - /lib/ai/sentiment/influencerWeighting.ts
      - /lib/ai/sentiment/predictionModel.ts
    ui_integration:
      news_tab:
        layout:
          - top_card: Market summary, confidence, and trend indicator
          - feed: List of summarized articles with sentiment badges and entity chips
          - sidebar: Influencer signals and AI trend prediction
    testing:
      - validate_labels: "Cross-check sentiment labels against finance dataset"
      - correlation_check: "Compare aggregated sentiment vs ETH price movement"

  whale_movement:
    goal: >
      Detect and analyze large-value Ethereum transfers, estimate market impact,
      and correlate them with sentiment and price movement.
    workflow:
      - step_1: Detect transfers over 1M USD and classify type (wallet→exchange, etc.)
      - step_2: Extract features (usdValue, supplyRatio, clusterCount, senderHistory)
      - step_3: Estimate price impact using DEX liquidity pool reserves
      - step_4: Correlate whale events with price change and sentiment trend
      - step_5: Output structured data with confidence, impact score, and supporting evidence
    required_files:
      - /lib/ai/whale/whaleEngine.ts
      - /lib/ai/whale/impactEstimator.ts
      - /lib/ai/whale/whaleCorrelation.ts
    ui_integration:
      whale_tab:
        layout:
          - header_cards: Total Events, Exchange Inflows, Exchange Outflows, Avg Impact
          - event_list: Each card shows token, value, confidence bar, and AI reasoning
          - simulate_button: Simulate impact and show estimated slippage
    testing_metrics:
      - precision_target: ">70% correlation between whale alert and price move"
      - false_positive_threshold: "<10%"

  overview_tab_logic:
    goal: >
      Provide complete portfolio overview with accurate balances and token data.
    data_flow:
      - Fetch balance and token list from Alchemy/Infura/Etherscan
      - Convert token values to USD using CoinGecko
      - Compute total balance, 24h change, and verified/unverified token count
      - Fetch historical balance data for charts
      - Filter scam tokens using scam_detection module before display
    ui_structure:
      - top: Balance cards (ETH, Total USD, 24h Change)
      - middle: Historical chart with time filter (1D, 1W, 1M)
      - bottom: Token table (sortable, paginated, with verified badges)

  transactions_tab_logic:
    goal: >
      Show complete transaction history with classification, USD conversion, and safety tagging.
    data_flow:
      - Fetch transactions from Etherscan or Alchemy
      - Decode token symbols and classify (Received, Sent, Swap, Mint, Airdrop)
      - Fetch historical USD value based on timestamp
      - Cross-check token risk using scam_detection
      - Tag suspicious or phishing-related transactions
    ui_structure:
      - filter_bar: Dropdown filters by type + search box
      - grouped_cards: Transactions grouped by date
      - card_fields: Token, amount, value (USD), type color (green/red), risk tag, Etherscan link

  testing_validation:
    logic_tests:
      - mock_dataset_validation: "Test each AI module with mock data"
      - precision_recall_metrics: "Track per module"
      - integration_tests: "Wallet → scam → whale → sentiment flow"
    monitoring:
      - log_failed_api_calls: true
      - enable_caching: true
      - user_feedback_collection: true

  development_stages:
    - stage: 1
      name: Data Accuracy
      focus: Fix and validate wallet, balance, and transaction logic
    - stage: 2
      name: Scam Detection
      focus: Implement hybrid model with reasoning and evidence display
    - stage: 3
      name: Sentiment Analysis
      focus: Build news, social, and influencer aggregation with prediction
    - stage: 4
      name: Whale Tracking
      focus: Integrate correlation engine and slippage estimator
    - stage: 5
      name: UI & UX Polish
      focus: Apply Framer-style transitions and responsive layout

---


# Extended AI Integration Details — Scam Detection Depth & Comprehensive News Factors
# Add/merge this section into your existing ai_integration YAML (or replace previous scam_detection & sentiment parts).
# This file expands every possible scam pattern, detection signals, required checks, and exhaustive news factors
# so the AI models can fetch, reason, and explain why a token was flagged and what news to include for market analysis.

scam_detection_detailed:
  purpose: >
    Exhaustively enumerate scam token patterns, detection signals, and evidence types so the system
    can reliably filter potential scam tokens out of the Overview token positions and surface them
    under "Potential Scam Tokens" with clear reasons and evidence.
  notes:
    - Treat this as authoritative detection checklist and feature set for both deterministic rules and ML features.
    - Each flagged token must produce a structured evidence object for UI display: { reasons[], evidence: {...}, confidence, score }.
    - Overview page must exclude tokens flagged as >= Medium risk; they appear instead in "Potential Scam Tokens" with reasons.

  scam_patterns_and_vectors:
    - honeypot:
        description: "Contract allows buys but prevents sells (reverts on sell)."
        evidence_to_collect:
          - eth_call sell simulation result (revert / success)
          - transaction traces showing failed sells
          - user-reported sell failures
        detection_signals:
          - eth_call revert when simulating small sell
          - TX revert patterns in mempool or on-chain
          - suspicious inline assembly or low-level revert messages
    - rug_pull:
        description: "Liquidity added then removed by owner/privileged address."
        evidence_to_collect:
          - LP add timestamp and LP removal timestamp
          - liquidity ownership / LP token withdrawal transactions
          - large subsequent transfers by owner
        detection_signals:
          - LP removed soon after liquidity add (<hours/days)
          - owner or dev address withdraws LP tokens
          - sudden low liquidity / drastic price drop events
    - malicious_tax_or_transfer_lock:
        description: "Dynamic or excessive transfer tax, or sell locks after certain time."
        evidence_to_collect:
          - contract functions adjusting fees (setFee, setTax)
          - on-chain transfer tax observed via simulation or events
          - blacklisted addresses or transfer restrictions
        detection_signals:
          - presence of setFee/setTax/blacklist functions in source
          - observed sell taxed at suspiciously high % when compared to buy
          - events showing address blacklist additions
    - owner_concentration:
        description: "Owner/dev wallet holds an overwhelming share of supply."
        evidence_to_collect:
          - holder distribution (top 1, top 5, top 10 percentages)
          - token holders count versus supply
        detection_signals:
          - top1 > X% (e.g., 40–90% threshold configurable)
          - top5 combined concentration very high
    - fake_liquidity_or_ghost_volume:
        description: "Wash trading, fake volume or low actual on-chain liquidity vs reported volume."
        evidence_to_collect:
          - DEX reserves vs reported centralised exchange volume
          - odd on-chain trading patterns (repeats between same wallets)
        detection_signals:
          - low on-chain liquidity for reported daily volume
          - high number of tiny repetitive trades between few addresses
    - impersonation_and_phishing_airdrops:
        description: "Airdrop messages or links that request signature/transfer — social engineering."
        evidence_to_collect:
          - transaction memos / token metadata linking to scam URLs
          - token name/icon/website suspicious similarities to popular tokens
          - presence of reward-claim URLs in token description or tx data
        detection_signals:
          - off-chain links in token metadata matching known phishing domains
          - claim/approve flows followed by token approvals to suspicious contracts
    - rug-contract-with-hidden-owner:
        description: "Renounced ownership but still functions controlled via proxy or hidden admin."
        evidence_to_collect:
          - proxy patterns, timelocks, admin variables in storage
          - code obfuscation to hide privileged functions
        detection_signals:
          - renounceOwnership present but proxy admin still accessible
          - suspicious delegatecall patterns
    - minting_backdoor:
        description: "Contract contains owner mint functions capable of arbitrary minting."
        evidence_to_collect:
          - presence of mintTo / increaseSupply / _mint in source
          - on-chain large mint events
        detection_signals:
          - code contains mint functions callable by owner
          - sudden supply inflation via on-chain events
    - malicious_approve_patterns:
        description: "Tokens request approvals to malicious contracts or unlimited allowances."
        evidence_to_collect:
          - approvals to known scam spender addresses
          - unlimited approvals not matching typical DEX router addresses
        detection_signals:
          - top spender addresses are suspicious or blacklisted
    - obfuscated_source_unverified_contract:
        description: "Unverified contracts increase risk (no source to audit)."
        evidence_to_collect:
          - Etherscan verified status
          - similarity to known malicious bytecode patterns
        detection_signals:
          - unverified on Etherscan + suspicious on-chain behavior
    - deceptive_tokenomics_and_social_pump:
        description: "Token uses misleading total supply or fake partnerships for pump."
        evidence_to_collect:
          - tokenomics mismatch between docs and on-chain
          - suspicious social posts claiming partnerships
        detection_signals:
          - website / whitepaper contradictions
          - suspicious influencer promotions not backed by on-chain evidence

  detection_signals_and_features (to compute per token):
    - static_code_flags:
      - suspicious_function_names: [ "setFee", "setTax", "blockSell", "blacklist", "mintTo", "renounceOwnership", "transferOwnership" ]
      - proxy_pattern_detected: boolean
      - contract_verified: boolean
    - holder_metrics:
      - top1_pct
      - top5_pct
      - holder_count
      - owner_balance_address_list
    - liquidity_metrics:
      - lp_added_timestamp
      - lp_removed_timestamp
      - lp_age_days
      - lp_ownership_pct
      - dex_reserves_usd
    - transaction_metrics:
      - tx_count_24h
      - avg_tx_value
      - large_transfers_count
      - suspicious_tx_patterns (repeats between same wallets)
    - tokenomics_metrics:
      - total_supply
      - decimals
      - mint_events_count
      - burn_events_count
    - tax_and_fee_metrics:
      - estimated_buy_fee_pct
      - estimated_sell_fee_pct
      - abnormal_tax_flag
    - simulation_metrics:
      - honeypot_canSell: boolean
      - simulation_revert_reason: string
    - external_reputation:
      - coingecko_listed: boolean
      - cmc_listed: boolean
      - audit_report_found: boolean
      - community_reports_count
      - token_age_days
    - social_signals:
      - mentions_last_24h
      - sentiment_score_mentions
      - suspicious_promotion_flags

  scoring_and_decision_rules:
    - base_rule_engine:
      description: "Weighted sum of feature groups with thresholds and independent-signal overrides."
      scoring_weights:
        static_code: 15
        holder_metrics: 20
        liquidity_metrics: 20
        transaction_metrics: 10
        tokenomics: 10
        tax_and_fee: 10
        simulation_metrics: 30
        external_reputation: -20  # reduces score if reputable
        social_signals: 5
      independent_signal_overrides:
        - honeypot_canSell == false => mark High (score += 40)
        - lp_removed_recently (within 72h of add) => mark High (score += 35)
        - owner_concentration_top1 > 70 => mark Medium/High depending on other signals
      normalization: "Clamp final score to 0–100"
      risk_level_thresholds:
        - low: "<40"
        - medium: "40–74"
        - high: ">=75"
    - whitelist_and_trusted_rules:
      description: >
        Tokens verified by major listing + audits have score reductions; whitelist maintained list (LINK, UNI, AAVE, USDC, USDT, WBTC, WETH) must not be flagged unless multiple strong signals present.
      whitelist_reduce_points: 50
      exception_condition: "If combined strong signals >= 2 (honeypot fail or LP drain + owner > 40%), do not skip."

  evidence_and_ui_payload_structure:
    description: "Standardized object returned by scam detection for UI rendering."
    shape:
      tokenAddress: string
      symbol: string
      score: number
      riskLevel: enum [low, medium, high]
      confidencePct: number
      reasons:
        - string
      evidence:
        staticCode: { suspiciousFunctions: [string], verified: boolean }
        holderDistribution: { top1: number, top5: number, totalHolders: number }
        liquidityEvents: [{ type: add|remove, timestamp, txHash }]
        simulation: { canSell: boolean, revertReason: string, simulationTxHash?: string }
        txExamples: [{ txHash, type, valueUsd }]
        external: { coingeckoListed: boolean, audits: [string], communityReports: number }
      recommended_actions:
        - "Avoid interaction"
        - "Do not approve token spenders until verified"
        - "If you already interacted, consider revoking approvals"

  overview_filtering_rules:
    description: >
      Rules the Overview component must apply before rendering Token Positions.
      Tokens flagged as riskLevel >= medium must be excluded from the main token table and shown under the "Potential Scam Tokens" section below the table.
    implementation_guidelines:
      - run scam detection pipeline (scamRules + quick simulation if enabled) as part of token aggregation step
      - mark tokens that are flagged with riskLevel >= medium and exclude from positions
      - still show token count summary but separate counts: { totalTokens, safeTokens, potentialScams }
      - show inline warning banner if any tokens filtered: "X potential high-risk tokens filtered — view under Potential Scam Tokens"
      - allow user override (consent) to include filtered token for debugging view (checkbox "Show filtered tokens for debugging")

  potential_scam_tokens_ui:
    layout:
      - position: "Directly below the Token Positions table"
      - card_per_token: true
      - summary_line: "TokenName (SYMBOL) — Risk: <level> — Score: <score> — Confidence: <pct>"
      - evidence_toggle: "Show Evidence" expands the evidence object in readable format
    actions_available:
      - "View on Etherscan"
      - "Run honeypot simulation" (requires explicit consent)
      - "Mark as false positive" (sends feedback to local dataset for retraining)

news_sentiment_detailed:
  purpose: >
    Enumerate all world-level news factors and social signals that can influence crypto markets.
    Provide exhaustive categories so the sentiment pipeline fetches and prioritizes the right types of content,
    computes impact weights, and returns multi-dimensional analysis (sentiment, impact type, affected assets, confidence).
  key_goals:
    - cover macroeconomic, geopolitical, regulatory, commodity, traditional finance, tech, and social signals
    - extract entity-level impacts (Fed, ECB, CPI, GDP, Gold, Oil, Major Bank Defaults)
    - compute influence weight by entity and source trust
    - provide both per-article sentiment + aggregated market-level indices
    - generate scenario-based insights (e.g., "If Fed hikes rate → likely bearish on risk assets such as ETH; confidence 72%")

  categories_and_examples:
    macroeconomic:
      - items:
        - interest_rate_policy:
            examples: ["Fed rate decision", "ECB policy statement", "BoJ intervention"]
            impact_logic: "Rate hikes typically negative for risk assets; quantitative easing often positive."
        - inflation_data:
            examples: ["CPI", "PCE", "Producer Price Index"]
            impact_logic: "Surging inflation can lead to rate hikes → bearish for crypto; details matter by region."
        - employment_reports:
            examples: ["US NFP", "Unemployment Rate"]
            impact_logic: "Surprising employment figures influence Fed expectations -> market volatility."
        - GDP_releases:
            examples: ["Quarterly GDP", "Recession signals"]
    geopolitical:
      - items:
        - armed_conflict:
            examples: ["War breakout", "sanctions", "trade embargoes"]
            impact_logic: "Flight-to-safety flows can move capital into/out of crypto depending on severity."
        - sanctions_and_trade_policy:
            examples: ["Country sanctions", "export controls on semiconductors"]
            impact_logic: "Affects liquidity and macro confidence."
        - regional_instability:
    banking_and_finance:
      - items:
        - bank_runs_and_defaults:
            examples: ["Regional bank collapse", "systemic bank failure", "bailouts"]
            impact_logic: "Liquidity shocks often cause crypto market turbulence."
        - central_bank_interventions:
        - liquidity_events:
            examples: ["Large ETF flows", "margin liquidations"]
    regulation_and_legal:
      - items:
        - regulatory_enforcement:
            examples: ["SEC lawsuits", "exchange fines", "token bans"]
            impact_logic: "Directly affect listed tokens and market sentiment (usually bearish)."
        - new_legislation:
            examples: ["Stablecoin regulations", "KYC/AML changes"]
    commodities_and_fx:
      - items:
        - gold_and_safe_haven:
            examples: ["Gold price moves", "yield curve inversion"]
            impact_logic: "Shifts in safe-haven preferences may affect crypto demand."
        - oil_prices:
            impact_logic: "OS supply shocks can affect markets broadly."
        - fx_shocks:
            examples: ["USD strength/weakness", "currency crises"]
            impact_logic: "USD strength often negatively correlated with crypto USD-denominated returns."
    tech_and_infrastructure:
      - items:
        - blockchain_upgrade_news:
            examples: ["Ethereum hard fork", "protocol upgrades", "major bug fixes"]
            impact_logic: "Generally positive for affected chain if successful."
        - exchange_outages_or_hacks:
            examples: ["Exchange hack", "mass withdrawal suspension"]
            impact_logic: "Negative market reaction and confidence hit."
    social_and_influencer:
      - items:
        - major_influencer_posts:
            examples: ["Tweets by major figures", "YouTube influencer videos"]
            impact_logic: "Amplifies short-term price moves; weight by follower/engagement."
        - reddit_trending_topics:
            examples: ["r/CryptoCurrency trending threads"]
        - on_chain_social_signals:
            examples: ["sudden spike in token mentions + whale transfers"]
    market_microstructure:
      - items:
        - orderbook_shocks:
            examples: ["Large bid/ask wall", "orderbook imbalance"]
            impact_logic: "Immediate short-term price effects"
        - liquidity_pool_changes:
            examples: ["LP withdrawals", "DEX reserve changes"]
    corporate_and_institutional:
      - items:
        - major_fund_flows:
            examples: ["ETF inflows/outflows", "institutional purchases/sales"]
        - corporate_treasury_moves:
            examples: ["Company buys BTC/ETH", "sell for cash flow"]

  entity_and_source_weighting:
    rules:
      - source_trust:
          - top_tier: ["WSJ", "FT", "Bloomberg", "Reuters"]
          - crypto_specialist: ["CoinDesk", "CoinTelegraph", "The Block"]
          - social: ["Twitter verified", "Reddit", "YouTube influencers"]
      - entity_impact: >
          Entities like "Fed", "ECB", "SEC", "CPI", "Major Banks" increase article weight by configurable multiplier (e.g., +0.5)
      - recency_decay:
          - half_life_hours: 6
          - recency_weight = exp(-ln(2) * age_hours / half_life_hours)

  fetch_and_aggregation_rules:
    - fetch_types:
        - breaking_news: high frequency, high priority
        - feature_articles: lower frequency, deeper analysis
        - social_posts: streaming (Twitter, Reddit)
    - deduplication:
        - remove duplicates by URL, then by semantic similarity using embeddings
    - enrichment:
        - attach on-chain metadata (token addresses mentioned)
        - attach price and volume snapshot at article timestamp

  sentiment_output_shape:
    - article:
        id: string
        title: string
        source: string
        timestamp: iso8601
        summary: string
        sentimentScore: float (-1..1)
        sentimentLabel: [Bullish, Neutral, Bearish]
        entities: [string]
        confidence: float (0..1)
        impactEstimate: { asset: string, probableDirection: up|down|neutral, confidence }
    - market_summary:
        aggregatedIndex: float (-1..1)
        label: [Bullish, Neutral, Bearish]
        confidence: float (0..1)
        topInfluencers: [{ handle, weight }]
        topEntities: [{ entity, influenceScore }]

  ui_and_reporting:
    - news_tab_display:
        - top_panel: market_summary with trend sparkline and confidence meter
        - feed: paginated article cards with sentiment badges and entity chips
        - filters: by category (macro, geo, reg, tech, social), timeframe, impact level
        - expand: show full article, summary, raw source link, and explanations for impact
    - alerting:
        - create market alerts for high-impact events (e.g., "Fed rate hike — significant market down risk")
        - allow user-configurable alert thresholds (impactScore, entity, sentiment shift)

  testing_and_validation_for_sentiment:
    - backtests:
        - correlation_test: measure correlation between aggregatedIndex and ETH price changes at 1h, 6h, 24h
    - labeled_dataset:
        - create small labeled dataset with known events (e.g., SEC lawsuits, Fed hikes) and expected sentiment
    - monitoring:
        - track drift in model outputs and raise retraining flag if confidence drops

# End of extended definitions
# Instructions:
# - Merge or append this YAML into your existing ai_integration / /init file.
# - Use the 'detection_signals_and_features' section as a canonical feature spec for both deterministic rules and ML feature engineering.
# - Ensure Overview implements 'overview_filtering_rules' strictly: tokens >= medium risk DO NOT appear in main token table.
# - Ensure UI displays the 'evidence_and_ui_payload_structure' exactly for transparency and allow user feedback to collect false positive labels.

---

## 🧪 Testing & Quality Goals

* Logic validated with mock wallets.
* Caching and fallback for API rate limits.
* Clear error boundaries and skeleton loaders.
* E2E test: wallet → scam → whale → news → summary with no runtime error.

---

## 🎨 UI/UX Enhancement Phase (post-stability)

After logic and data layers are stable:

* Add **Framer Motion** animations (fade-in cards, smooth transitions between tabs).
* Apply **ShadCN color theming** with orange accent and dark gray base.
* Add hover glow for buttons and smooth page transitions.
* Maintain layout identical to dark mode reference; replicate proportions in light mode.

---

## ✅ Development Instruction Summary

1. Fix and validate data logic first.
2. Strengthen AI accuracy and cross-correlation.
3. Ensure wallet load, scam detection, and news sentiment work smoothly.
4. Only after that, refine UI with Framer-like animations and transitions.

---

**End of /init**
