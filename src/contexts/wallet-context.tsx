"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface WalletContextType {
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  handleDisconnect: () => void;
  isConnected: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  // Load wallet from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("etherview_wallet");
    console.log('💳 WalletContext - Loading from localStorage:', stored);
    if (stored) {
      setWalletAddress(stored);
      console.log('💳 WalletContext - Set wallet address:', stored);
    }
  }, []);

  const handleSetWalletAddress = (address: string | null) => {
    console.log('💳 WalletContext - Setting wallet address:', address);
    setWalletAddress(address);
    if (address) {
      localStorage.setItem("etherview_wallet", address);
      console.log('💳 WalletContext - Saved to localStorage:', address);
    } else {
      localStorage.removeItem("etherview_wallet");
      console.log('💳 WalletContext - Removed from localStorage');
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    localStorage.removeItem("etherview_wallet");
    router.push('/');
  };

  const isConnected = walletAddress !== null;

  const contextValue: WalletContextType = {
    walletAddress,
    setWalletAddress: handleSetWalletAddress,
    handleDisconnect,
    isConnected,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}