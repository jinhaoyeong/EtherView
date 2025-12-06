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

  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = (event && 'reason' in event) ? event.reason : undefined;
      const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : JSON.stringify(reason ?? 'Unknown rejection');
      console.error('Unhandled promise rejection:', message);
      try { event.preventDefault(); } catch {}
    };
    const onWindowError = (event: ErrorEvent) => {
      const message = event?.error?.message || event?.message || 'Unknown error';
      console.error('Window error:', message);
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
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
