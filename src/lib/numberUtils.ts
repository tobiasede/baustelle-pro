/**
 * Utility functions for robust numeric handling
 * Treats missing/invalid inputs as zero for arithmetic
 */

/**
 * Converts any value to a number, treating null/undefined/empty as 0.
 * Handles both German (comma) and English (dot) decimal separators.
 */
export function toNumberOrZero(x: unknown): number {
  if (x === null || x === undefined || x === '') return 0;
  
  if (typeof x === 'number') {
    return Number.isFinite(x) ? x : 0;
  }
  
  if (typeof x === 'string') {
    // Trim and handle empty string
    const trimmed = x.trim();
    if (trimmed === '') return 0;
    
    // Replace comma with dot for German decimal format
    const normalized = trimmed.replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formats a number as German currency (EUR)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(value);
}

/**
 * Formats a date as German date string
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE');
}

/**
 * Safe division that returns 0 or a fallback when dividing by zero
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0 || !Number.isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}
