"use client";

import { ReactNode, createContext, useContext } from 'react';
import { useSettings } from '@/hooks/use-settings';

 

interface CurrencyLanguageContextType {
  formatCurrency: (amount: number) => string;
  formatNumber: (amount: number) => string;
  getCurrencySymbol: () => string;
  getLanguageCode: () => string;
}

const CurrencyLanguageContext = createContext<CurrencyLanguageContextType | undefined>(undefined);

interface CurrencyLanguageProviderProps {
  children: ReactNode;
}

export function CurrencyLanguageProvider({ children }: CurrencyLanguageProviderProps) {
  const { settings } = useSettings();

  const getCurrencySymbol = (): string => {
    if (!settings?.appearance.currency) return '$';

    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'ETH': 'Ξ',
      'BTC': '₿'
    };

    return symbols[settings.appearance.currency] || '$';
  };

  const getLanguageCode = (): string => {
    if (!settings?.appearance.language) return 'en-US';
    return settings.appearance.language === 'en' ? 'en-US' :
           settings.appearance.language === 'es' ? 'es-ES' :
           settings.appearance.language === 'fr' ? 'fr-FR' :
           settings.appearance.language === 'de' ? 'de-DE' :
           settings.appearance.language === 'ja' ? 'ja-JP' :
           settings.appearance.language === 'zh' ? 'zh-CN' : 'en-US';
  };

  const formatCurrency = (amount: number): string => {
    if (!settings?.appearance.currency) return `$${amount.toLocaleString()}`;

    try {
      const locale = getLanguageCode();
      const currency = settings.appearance.currency;

      // Handle crypto currencies differently
      if (currency === 'ETH') {
        return `${amount.toLocaleString(locale)} Ξ`;
      }
      if (currency === 'BTC') {
        return `${amount.toLocaleString(locale)} ₿`;
      }

      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `$${amount.toLocaleString()}`;
    }
  };

  const formatNumber = (amount: number): string => {
    try {
      const locale = getLanguageCode();
      return new Intl.NumberFormat(locale).format(amount);
    } catch (error) {
      console.error('Number formatting error:', error);
      return amount.toLocaleString();
    }
  };

  const contextValue: CurrencyLanguageContextType = {
    formatCurrency,
    formatNumber,
    getCurrencySymbol,
    getLanguageCode,
  };

  return (
    <CurrencyLanguageContext.Provider value={contextValue}>
      {children}
    </CurrencyLanguageContext.Provider>
  );
}

export function useCurrencyLanguage() {
  const context = useContext(CurrencyLanguageContext);
  if (context === undefined) {
    throw new Error('useCurrencyLanguage must be used within a CurrencyLanguageProvider');
  }
  return context;
}
