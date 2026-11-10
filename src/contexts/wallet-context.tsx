"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { getAddress, isAddress } from "ethers";

type WalletContextType = {
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  handleDisconnect: () => void;
  isConnected: boolean;
  hydrated: boolean;
};
const WalletContext = createContext<WalletContextType | undefined>(undefined);
function rememberWallet() {
  try {
    return (
      JSON.parse(localStorage.getItem("etherview_settings") || "{}").storage
        ?.rememberWalletAddress !== false
    );
  } catch {
    return true;
  }
}
export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setAddress] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  useEffect(() => {
    try {
      const stored = localStorage.getItem("etherview_wallet");
      if (rememberWallet() && stored && isAddress(stored))
        setAddress(getAddress(stored));
      else localStorage.removeItem("etherview_wallet");
    } catch {
      /* Storage is optional in private browsing. */
    }
    setHydrated(true);
    const syncPreference = () => {
      try {
        if (!rememberWallet()) localStorage.removeItem("etherview_wallet");
      } catch {}
    };
    window.addEventListener("etherview:settings-changed", syncPreference);
    return () =>
      window.removeEventListener("etherview:settings-changed", syncPreference);
  }, []);
  const setWalletAddress = useCallback((address: string | null) => {
    if (address !== null && !isAddress(address.trim()))
      throw new Error("Invalid Ethereum address");
    const normalized = address ? getAddress(address.trim()) : null;
    setAddress(normalized);
    try {
      if (normalized && rememberWallet())
        localStorage.setItem("etherview_wallet", normalized);
      else localStorage.removeItem("etherview_wallet");
    } catch {}
  }, []);
  const handleDisconnect = useCallback(() => {
    setWalletAddress(null);
    router.push("/");
  }, [setWalletAddress, router]);
  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        setWalletAddress,
        handleDisconnect,
        isConnected: !!walletAddress,
        hydrated,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
export function useWallet() {
  const context = useContext(WalletContext);
  if (!context)
    throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
