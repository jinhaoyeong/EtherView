// Currency conversion rates (should be fetched from a real-time API in production)
// These are example rates - in a real app, fetch from CoinGecko, exchange API, etc.
export const EXCHANGE_RATES: Record<string, number> = {
  'USD': 1.0,        // Base currency
  'EUR': 0.92,       // 1 USD = 0.92 EUR
  'GBP': 0.79,       // 1 USD = 0.79 GBP
  'JPY': 149.50,     // 1 USD = 149.50 JPY
  'ETH': 0.00033,    // 1 USD = 0.00033 ETH (approximate - varies with ETH price)
  'BTC': 0.000015,   // 1 USD = 0.000015 BTC (approximate - varies with BTC price)
};

export const CURRENCY_NAMES: Record<string, string> = {
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'JPY': 'JPY',
  'ETH': 'ETH',
  'BTC': 'BTC'
};

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amount;

  // Convert to USD first (base currency), then to target currency
  const amountInUSD = fromCurrency === 'USD' ? amount : amount / EXCHANGE_RATES[fromCurrency];
  return amountInUSD * EXCHANGE_RATES[toCurrency];
}