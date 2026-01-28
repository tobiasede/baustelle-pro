/**
 * Utility functions for Radix Select components
 * Prevents runtime errors from empty string values
 */

export const EMPTY_PLACEHOLDER = '__none__';

/**
 * Convert a value to a safe Radix Select value
 * Radix Select does not allow empty strings as values
 */
export const toRadixSelectValue = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === '') {
    return EMPTY_PLACEHOLDER;
  }
  return String(v);
};

/**
 * Convert a Radix Select value back to the original value
 * Returns undefined for the placeholder value
 */
export const fromRadixSelectValue = (v: string): string | undefined => {
  if (v === EMPTY_PLACEHOLDER) {
    return undefined;
  }
  return v;
};

/**
 * Check if a value is the empty placeholder
 */
export const isEmptyPlaceholder = (v: string): boolean => {
  return v === EMPTY_PLACEHOLDER;
};
