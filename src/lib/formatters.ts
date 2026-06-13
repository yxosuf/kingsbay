/**
 * Shared currency formatting utilities.
 *
 * Replaces the scattered `Rs. ${x.toLocaleString()}` / `LKR ${x.toLocaleString()}`
 * patterns found throughout the codebase.
 */

export function formatLKR(amount: number | null | undefined): string {
  if (amount == null) return 'Rs. 0';
  return `Rs. ${amount.toLocaleString()}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function lkrToUsd(lkr: number, fxRate: number | null | undefined): number | null {
  if (!fxRate || fxRate === 0) return null;
  return Math.round(lkr / fxRate);
}
