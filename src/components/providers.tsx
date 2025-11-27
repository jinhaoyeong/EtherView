"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, useEffect } from "react";
import { themeManager } from "@/lib/theme-manager";
import { CurrencyLanguageProvider } from "@/contexts/currency-language-context";
import { WalletProvider } from "@/contexts/wallet-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Initialize theme manager immediately on mount
  useEffect(() => {
    // Load theme preference immediately
    themeManager.loadThemePreference();

    // Apply theme again after a short delay to ensure it sticks during navigation
    const applyThemeTimeout = setTimeout(() => {
      themeManager.loadThemePreference();
    }, 100);

    // Cleanup on unmount
    return () => {
      clearTimeout(applyThemeTimeout);
      themeManager.cleanup();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <CurrencyLanguageProvider>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </CurrencyLanguageProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}