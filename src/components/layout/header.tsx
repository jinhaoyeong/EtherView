"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAddress, isAddress } from "ethers";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { EtherMark } from "./brand";
export function Header({
  walletAddress,
  onDisconnect,
  currentPage,
}: {
  walletAddress: string;
  onDisconnect: () => void;
  currentPage: string;
}) {
  const { setWalletAddress } = useWallet();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest('input,textarea,select,[contenteditable="true"]')
        )
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAddress(search.trim())) {
      setError(
        "Enter a valid Ethereum address (0x followed by 40 hexadecimal characters).",
      );
      return;
    }
    setWalletAddress(getAddress(search.trim()));
    setSearch("");
    setError(null);
    router.push("/");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setCopyError(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <header className={`ev-utility ${walletAddress ? "has-wallet" : "is-exploring"}`} aria-label={`${currentPage} workspace controls`}>
      <div className="ev-utility-context"><span className="ev-network-icon"><EtherMark /></span><span>Ethereum <small>Mainnet</small></span><span className="ev-utility-divider"/><span className="ev-utility-mode">{walletAddress ? "Wallet explorer" : "An independent view of your on-chain world"}</span></div>
      <div className="topbar-workspace">
        {walletAddress && <form className="global-search" onSubmit={submit}>
          <Search size={16} />
          <input
            ref={input}
            aria-label="Search wallet address"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setError(null);
            }}
            placeholder="Search any Ethereum address"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={error ? "global-search-error" : undefined}
          />
          <button type="submit" aria-label="Open searched wallet">
            <ChevronRight size={16} />
          </button>
          <kbd>/</kbd>
        </form>}
        {walletAddress ? (
          <div className="active-wallet">
            <span className="wallet-monogram">0x</span>
            <span className="mono" title={walletAddress}>
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
            <button
              className="icon-button"
              onClick={copy}
              aria-label={copied ? "Address copied" : "Copy wallet address"}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <a
              className="icon-button wallet-external"
              href={`https://etherscan.io/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View wallet on Etherscan"
            >
              <ExternalLink size={13} />
            </a>
            <button
              className="icon-button"
              onClick={onDisconnect}
              aria-label="Clear selected wallet"
              title="Clear selected wallet"
            >
              <X size={14} />
            </button>
            <span className="sr-only" role="status">
              {copied
                ? "Address copied"
                : copyError
                  ? "Clipboard unavailable"
                  : ""}
            </span>
          </div>
        ) : (
          <span className="no-wallet-label">Explore freely. No connection needed.</span>
        )}
      </div>
      {error && (
        <p
          className="global-search-error"
          id="global-search-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </header>
  );
}
