/**
 * Robust number parsing utility for LV imports
 * Handles various European and US number formats
 */

/**
 * Parse a number string that may use different decimal/thousands separators
 * Supports formats like:
 * - "1234.56" (US format)
 * - "1.234,56" (German format with thousands separator)
 * - "1234,56" (German format without thousands separator)
 * - "2,50" (German decimal)
 * - "2.500" (could be 2500 or 2.5 - we detect based on context)
 * - "1 234,56" (space as thousands separator)
 */
export const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  // If already a number, return it
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return null;
    }
    return value;
  }

  // Convert to string
  let str = String(value).trim();
  
  // Empty string
  if (str === '') {
    return null;
  }

  // Remove currency symbols and whitespace
  str = str.replace(/[€$\s]/g, '');

  // Handle negative numbers
  const isNegative = str.startsWith('-') || str.startsWith('(');
  str = str.replace(/^[-+()]|[)]$/g, '');

  // Count dots and commas
  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  let result: number;

  if (dotCount === 0 && commaCount === 0) {
    // No separators: plain integer
    result = parseFloat(str);
  } else if (dotCount === 0 && commaCount === 1) {
    // Only one comma: German decimal separator
    // "1234,56" -> 1234.56
    result = parseFloat(str.replace(',', '.'));
  } else if (dotCount === 1 && commaCount === 0) {
    // Only one dot: could be US decimal or German thousands
    // Check position: if exactly 3 digits after dot at end, it's thousands separator
    const parts = str.split('.');
    if (parts[1] && parts[1].length === 3 && /^\d+$/.test(parts[1])) {
      // "2.500" where 500 is a round thousands -> treat as 2500
      // But "1.234" -> 1234 (thousands separator)
      // However, for small numbers like "2.50" -> 2.5 (decimal)
      // Heuristic: if first part is single digit and second part has 3 digits, it's thousands
      if (parts[0].length <= 2 && !str.includes(' ')) {
        // Ambiguous: could be 2.500 (decimal 2.5) or 2500
        // For LV imports, prices are usually > 1, so 2.500 likely means 2500 or 2.5
        // We'll treat 3 digits after dot as thousands separator
        result = parseFloat(str.replace('.', ''));
      } else {
        result = parseFloat(str.replace('.', ''));
      }
    } else {
      // US decimal: "1234.56"
      result = parseFloat(str);
    }
  } else if (dotCount >= 1 && commaCount === 1) {
    // German format: dots are thousands, comma is decimal
    // "1.234,56" -> 1234.56
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    result = parseFloat(cleaned);
  } else if (dotCount === 1 && commaCount >= 1) {
    // US format: commas are thousands, dot is decimal
    // "1,234.56" -> 1234.56
    const cleaned = str.replace(/,/g, '');
    result = parseFloat(cleaned);
  } else if (dotCount > 1 && commaCount === 0) {
    // Multiple dots: dots are thousands separators
    // "1.234.567" -> 1234567
    result = parseFloat(str.replace(/\./g, ''));
  } else if (dotCount === 0 && commaCount > 1) {
    // Multiple commas: commas are thousands separators (unusual but handle it)
    // "1,234,567" -> 1234567
    result = parseFloat(str.replace(/,/g, ''));
  } else {
    // Complex case: try to be smart
    // Find last separator - that's likely the decimal
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    
    if (lastComma > lastDot) {
      // Comma is decimal, dots are thousands
      result = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    } else {
      // Dot is decimal, commas are thousands
      result = parseFloat(str.replace(/,/g, ''));
    }
  }

  if (!isFinite(result)) {
    return null;
  }

  return isNegative ? -result : result;
};

/**
 * Validate that a number is a valid unit price (EP)
 */
export const isValidEP = (value: number | null): boolean => {
  if (value === null) return false;
  return isFinite(value) && value >= 0;
};

/**
 * Format number for display (German locale)
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
