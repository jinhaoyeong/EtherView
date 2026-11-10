"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getAddress, isAddress, formatUnits } from "ethers";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  Box,
  Coins,
  Flame,
  Loader2,
  Newspaper,
  Search,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useSettings } from "@/hooks/use-settings";
import { EthereumPrism } from "@/components/shared/ethereum-prism";
import "./landing-premium.css";
const examples = [
  {
    name: "Vitalik Buterin",
    subtitle: "vitalik.eth",
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    type: "Individual",
    symbol: "VB",
  },
  {
    name: "Ethereum Foundation",
    subtitle: "Foundation wallet",
    address: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
    type: "Organization",
    symbol: "EF",
  },
  {
    name: "Uniswap V3",
    subtitle: "Protocol factory",
    address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    type: "Contract",
    symbol: "UNI",
  },
];
async function networkSnapshot(signal: AbortSignal) {
  const [price, rpc] = await Promise.allSettled([
    fetch("/api/price-proxy?type=eth", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(18_000)]),
    }).then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json();
      const value = Number(body.price ?? body.usd ?? body.ethereum?.usd);
      return Number.isFinite(value) && value > 0 ? value : null;
    }),
    fetch("/api/rpc-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] },
        { jsonrpc: "2.0", id: 2, method: "eth_gasPrice", params: [] },
      ]),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    }).then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json();
      if (!Array.isArray(body)) return null;
      const result = (id: number) =>
        body.find((x: { id?: number }) => x.id === id)?.result;
      const block = result(1),
        gas = result(2);
      return {
        block:
          typeof block === "string" && /^0x[\da-f]+$/i.test(block)
            ? Number(BigInt(block))
            : null,
        gas:
          typeof gas === "string" && /^0x[\da-f]+$/i.test(gas)
            ? Number(formatUnits(BigInt(gas), "gwei"))
            : null,
      };
    }),
  ]);
  return {
    price: price.status === "fulfilled" ? price.value : null,
    block: rpc.status === "fulfilled" ? (rpc.value?.block ?? null) : null,
    gas: rpc.status === "fulfilled" ? (rpc.value?.gas ?? null) : null,
  };
}
export function LandingPage({
  onWalletConnect,
}: {
  onWalletConnect: (address: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const { settings } = useSettings();
  const network = useQuery({
    queryKey: ["network-snapshot"],
    queryFn: ({ signal }) => networkSnapshot(signal),
    staleTime: 60_000,
    retry: false,
    refetchInterval: settings?.data.autoRefresh ? 60_000 : false,
  });
  function open(value: string) {
    if (!isAddress(value.trim())) {
      setError(
        "Enter a valid Ethereum address: 0x followed by 40 hexadecimal characters.",
      );
      return;
    }
    setError(null);
    setOpening(true);
    try {
      onWalletConnect(getAddress(value.trim()));
    } catch {
      setOpening(false);
      setError("Could not open this address. Please try again.");
    }
  }
  const metrics = [
    {
      name: "ETH price",
      value: network.data?.price
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          }).format(network.data.price)
        : null,
      detail: "Current quote · USD",
      icon: Coins,
    },
    {
      name: "Gas price",
      value:
        network.data?.gas != null
          ? `${network.data.gas.toLocaleString("en-US", { maximumFractionDigits: 3 })} Gwei`
          : null,
      detail: "Standard network gas price",
      icon: Flame,
    },
    {
      name: "Latest block",
      value:
        network.data?.block != null
          ? network.data.block.toLocaleString("en-US")
          : null,
      detail: "Ethereum Mainnet",
      icon: Box,
    },
  ];
  return (
    <DashboardLayout walletAddress="" onDisconnect={() => {}}>
      <div className="ev-discover workspace-page">
        <section className="ev-discover-hero" aria-labelledby="discover-heading">
          <div className="ev-discover-copy">
            <p className="ev-kicker"><span /> THE ETHEREUM EXPLORER</p>
            <h1 id="discover-heading">A clearer view<br />of <span>Ethereum.</span></h1>
            <p className="ev-discover-description">
              Every wallet has a story. Explore the assets, activity, and signals behind any public address.
            </p>
            <div className="ev-address-entry" id="wallet-search">
              <form onSubmit={(e) => { e.preventDefault(); open(address); }}>
                <label htmlFor="wallet-address">Your next discovery starts here</label>
                <div className="ev-address-field">
                  <Search size={19} strokeWidth={1.6} aria-hidden="true" />
                  <input
                    id="wallet-address"
                    aria-label="Ethereum wallet address"
                    placeholder="Enter an Ethereum address, 0x…"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setError(null); }}
                    aria-invalid={!!error}
                    aria-describedby={error ? "wallet-error" : "wallet-start-hint"}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={opening}
                  />
                  <button type="submit" disabled={opening} aria-label="View portfolio">
                    {opening ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
                  </button>
                </div>
              </form>
              {error ? (
                <p className="input-error" id="wallet-error" role="alert">{error}</p>
              ) : (
                <p id="wallet-start-hint" className="ev-address-hint"><ShieldCheck size={13} /> Read-only. No connection or signature needed.</p>
              )}
            </div>
            <div className="ev-quick-start">
              <span>Take a look around</span>
              <button disabled={opening} onClick={() => open(examples[0].address)}>vitalik.eth <ArrowUpRight size={13} /></button>
            </div>
          </div>
          <div className="ev-discover-art" aria-hidden="true">
            <div className="ev-art-topline"><span>ETHEREUM</span><span>EST. 2015</span></div>
            <div className="ev-prism-stage"><EthereumPrism /></div>
            <div className="ev-art-footline"><span>Open by nature.<br /><strong>Clear by design.</strong></span><span className="ev-art-chain">01<small>MAINNET</small></span></div>
          </div>
        </section>

        <section className="ev-network-strip" aria-label="Ethereum network snapshot">
          <div className="ev-network-title"><span className="ev-network-dot" /><span>On the network<small>Ethereum mainnet</small></span></div>
          {metrics.map(({ name, value, detail, icon: Icon }) => (
            <div className="ev-network-stat" key={name}>
              <div className="ev-network-stat-label"><Icon size={14} strokeWidth={1.7} /><span>{name}</span></div>
              <strong>{network.isPending ? <span className="ev-stat-skeleton" /> : (value ?? "Unavailable")}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </section>

        <section className="ev-wallet-discovery" aria-labelledby="public-wallets-heading">
          <div className="ev-section-heading">
            <div><p className="ev-kicker">A PLACE TO START</p><h2 id="public-wallets-heading">Follow the addresses you know.</h2></div>
            <span>Public wallets & contracts</span>
          </div>
          <div className="ev-public-wallets">
            {examples.map((ex, i) => (
              <button className={`ev-public-wallet ev-public-wallet-${i + 1}`} key={ex.address} disabled={opening} onClick={() => open(ex.address)} aria-label={`Explore ${ex.name}`}>
                <div className="ev-public-wallet-top"><span className="ev-wallet-avatar">{ex.symbol}</span><ArrowUpRight size={20} strokeWidth={1.6} /></div>
                <div className="ev-public-wallet-name"><strong>{ex.name}</strong><span>{ex.subtitle}</span></div>
                <div className="ev-public-wallet-bottom"><span className="mono">{ex.address.slice(0, 8)}…{ex.address.slice(-6)}</span><small>{ex.type}</small></div>
              </button>
            ))}
          </div>
        </section>

        <section className="ev-research" aria-label="Explore analytics tools">
          <div className="ev-research-intro"><p className="ev-kicker">LOOK A LITTLE CLOSER</p><h2>Beyond the balance.</h2><p>Follow the movement.<br />Understand the context.</p></div>
          <div className="ev-research-links">
            {[
              { title: "Transactions", copy: "Trace transfers and fees", href: "/transactions", icon: ArrowLeftRight },
              { title: "Whale watch", copy: "Follow larger movements", href: "/whale", icon: Waves },
              { title: "Token risk", copy: "Read the contract signals", href: "/scam", icon: ShieldCheck },
              { title: "News & sentiment", copy: "Stay close to the conversation", href: "/news", icon: Newspaper },
            ].map(({ title, copy, href, icon: Icon }) => (
              <Link href={href} className="ev-research-link" key={href}><Icon size={21} strokeWidth={1.5} /><span><strong>{title}</strong><small>{copy}</small></span><ArrowUpRight size={16} /></Link>
            ))}
          </div>
        </section>
        <p className="ev-discover-footnote">Public data, with perspective. Coverage varies by provider; valuations are estimates.</p>
      </div>
    </DashboardLayout>
  );
}
