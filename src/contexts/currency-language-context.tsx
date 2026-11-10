"use client";

import { type ReactNode, createContext, useContext } from 'react';
import { useSettings } from '@/hooks/use-settings';

interface CurrencyLanguageContextType {
  formatCurrency: (amount: number) => string;
  formatNumber: (amount: number) => string;
  getCurrencySymbol: () => string;
  getLanguageCode: () => string;
}

const CurrencyLanguageContext = createContext<CurrencyLanguageContextType | undefined>(undefined);

export function CurrencyLanguageProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const getLanguageCode = () => ({ en: 'en-US', zh: 'zh-CN', ms: 'ms-MY', ja: 'ja-JP' }[settings?.appearance.language || 'en'] || 'en-US');
  const formatCurrency = (amount: number) => new Intl.NumberFormat(getLanguageCode(), { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(amount);
  const formatNumber = (amount: number) => new Intl.NumberFormat(getLanguageCode()).format(amount);

  return <CurrencyLanguageContext.Provider value={{ formatCurrency, formatNumber, getCurrencySymbol: () => '$', getLanguageCode }}>{children}</CurrencyLanguageContext.Provider>;
}

export function useCurrencyLanguage() {
  const context = useContext(CurrencyLanguageContext);
  if (!context) throw new Error('useCurrencyLanguage must be used within a CurrencyLanguageProvider');
  return context;
}
