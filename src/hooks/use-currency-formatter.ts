"use client";

import { useSettings } from './use-settings';
import { CURRENCY_NAMES, convertCurrency } from '@/lib/currency-conversion';

export function useCurrencyFormatter() {
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

  const getCurrencyName = (): string => {
    if (!settings?.appearance.currency) return 'USD';
    return CURRENCY_NAMES[settings.appearance.currency] || 'USD';
  };

  const getLanguageCode = (): string => {
    if (!settings?.appearance.language) return 'en-US';
    return settings.appearance.language === 'en' ? 'en-US' :
           settings.appearance.language === 'zh' ? 'zh-CN' :
           settings.appearance.language === 'ms' ? 'ms-MY' :
           settings.appearance.language === 'ja' ? 'ja-JP' : 'en-US';
  };

  const formatCurrency = (usdAmount: number): string => {
    if (!settings?.appearance.currency) return `$${usdAmount.toLocaleString()}`;

    try {
      const locale = getLanguageCode();
      const targetCurrency = settings.appearance.currency;
      const currencySymbol = getCurrencySymbol();

      // Convert USD to target currency
      const convertedAmount = convertCurrency(usdAmount, 'USD', targetCurrency);

      // Handle crypto currencies with special formatting
      if (targetCurrency === 'ETH') {
        return `${currencySymbol}${convertedAmount.toLocaleString(locale, { maximumFractionDigits: 6 })}`;
      }
      if (targetCurrency === 'BTC') {
        return `${currencySymbol}${convertedAmount.toLocaleString(locale, { maximumFractionDigits: 8 })}`;
      }

      // For traditional currencies, use appropriate decimal places
      let minimumFractionDigits = 0;
      let maximumFractionDigits = 0;

      if (targetCurrency === 'USD' || targetCurrency === 'EUR' || targetCurrency === 'GBP') {
        const absAmount = Math.abs(convertedAmount);
        if (absAmount > 0 && absAmount < 0.0001) {
          const exp = absAmount.toExponential();
          const parts = exp.split('e-');
          if (parts.length === 2) {
            const zeros = Math.max(0, parseInt(parts[1], 10) - 1);
            const subDigits = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
            const toSubscript = (n: number) => String(n).split('').map(d => subDigits[parseInt(d, 10)]).join('');
            const mantissa = parts[0].replace('.', '').replace(/^0+/, '');
            const sig = mantissa.slice(0, 6) || '0';
            return `${currencySymbol}0.0${toSubscript(zeros)}${sig}`;
          }
        }
        if (absAmount < 1) {
          minimumFractionDigits = 2;
          maximumFractionDigits = 4;
        } else if (absAmount < 100) {
          minimumFractionDigits = 2;
          maximumFractionDigits = 2;
        } else {
          minimumFractionDigits = 0;
          maximumFractionDigits = 0;
        }
      }

      return `${currencySymbol}${convertedAmount.toLocaleString(locale, {
        minimumFractionDigits,
        maximumFractionDigits
      })}`;
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `$${usdAmount.toLocaleString()}`;
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

  return {
    formatCurrency,
    formatNumber,
    getCurrencySymbol,
    getCurrencyName,
    getLanguageCode,
  };
}
