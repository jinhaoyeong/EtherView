/** Combine two observations of the same holding without letting a missing quote erase a real one. */

function observedBalance(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? String(value) : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? value : null;
}

function observedAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function mergeHolding<T extends { balance?: unknown; priceUSD?: unknown; valueUSD?: unknown }>(previous: T, next: T): T {
  const balance = observedBalance(next.balance) ?? observedBalance(previous.balance) ?? '0';
  const priceUSD = observedAmount(next.priceUSD) ?? observedAmount(previous.priceUSD) ?? 0;
  const balanceNum = Number(balance);
  const pricedValue = priceUSD > 0 && Number.isFinite(balanceNum) ? priceUSD * balanceNum : null;
  const valueUSD = pricedValue ?? observedAmount(next.valueUSD) ?? observedAmount(previous.valueUSD) ?? 0;
  return { ...previous, ...next, balance, priceUSD, valueUSD };
}
