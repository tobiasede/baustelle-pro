/**
 * LV Import Schema - Canonical schema and header aliases
 */

export interface LVRow {
  'Positions-ID': string;
  'Kurztext': string;
  'Einheit': string;
  'EP': number;
  'Kategorie'?: string;
}

export const REQUIRED_HEADERS = ['Positions-ID', 'Kurztext', 'Einheit', 'EP'] as const;
export const OPTIONAL_HEADERS = ['Kategorie'] as const;
export const ALL_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS] as const;

export type RequiredHeader = typeof REQUIRED_HEADERS[number];
export type OptionalHeader = typeof OPTIONAL_HEADERS[number];
export type CanonicalHeader = typeof ALL_HEADERS[number];

/**
 * Known legacy header aliases (lowercase, trimmed)
 * Maps legacy headers to canonical headers
 */
export const HEADER_ALIASES: Record<string, CanonicalHeader> = {
  // German variations
  'gruppe': 'Kategorie',
  'kategorie': 'Kategorie',
  'category': 'Kategorie',
  
  'kompaktposition': 'Kurztext',
  'kurztext': 'Kurztext',
  'kurz-text': 'Kurztext',
  'beschreibung': 'Kurztext',
  'text': 'Kurztext',
  'position': 'Kurztext',
  'leistung': 'Kurztext',
  'short_text': 'Kurztext',
  'shorttext': 'Kurztext',
  
  'umsatz (leistung) je einheit': 'EP',
  'umsatz je einheit': 'EP',
  'einheitspreis': 'EP',
  'ep': 'EP',
  'preis': 'EP',
  'unit_price': 'EP',
  'unitprice': 'EP',
  'price': 'EP',
  'ep (€)': 'EP',
  'ep €': 'EP',
  
  'einheit': 'Einheit',
  'unit': 'Einheit',
  'me': 'Einheit',
  'mengeneinheit': 'Einheit',
  
  'positions-id': 'Positions-ID',
  'positionsid': 'Positions-ID',
  'position_code': 'Positions-ID',
  'positionscode': 'Positions-ID',
  'pos': 'Positions-ID',
  'pos.': 'Positions-ID',
  'pos-nr': 'Positions-ID',
  'pos-nr.': 'Positions-ID',
  'posnr': 'Positions-ID',
  'id': 'Positions-ID',
  'nr': 'Positions-ID',
  'nr.': 'Positions-ID',
  'lfd. nr.': 'Positions-ID',
  'lfd nr': 'Positions-ID',
};

/**
 * Known valid units (whitelist for validation warnings)
 */
export const KNOWN_UNITS = [
  'm', 'm²', 'm³', 'm2', 'm3',
  'STCK', 'Stck', 'stck', 'STK', 'Stk', 'stk', 'Stück', 'stück',
  'Std', 'std', 'h', 'H',
  'Std / MA', 'std / ma', 'Std/MA',
  'kg', 'KG', 'Kg',
  't', 'T',
  'l', 'L', 'Liter', 'liter',
  'psch', 'Psch', 'PSCH', 'pauschal', 'Pauschal',
  '%',
  'lfm', 'Lfm', 'LFM', 'lfdm', 'Lfdm',
  'Tag', 'tag', 'Tage', 'tage',
  'km', 'Km', 'KM',
];

/**
 * Normalize a header string for comparison
 */
export const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    .replace(/[\r\n]+/g, ' ')  // Remove line breaks
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
};

/**
 * Check if file headers match the canonical schema exactly
 */
export const isCanonicalSchema = (headers: string[]): boolean => {
  const normalizedHeaders = headers.map(normalizeHeader);
  const requiredNormalized = REQUIRED_HEADERS.map(h => h.toLowerCase());
  
  // Check if all required headers are present
  return requiredNormalized.every(req => 
    normalizedHeaders.some(h => h === req || HEADER_ALIASES[h] === req)
  );
};

/**
 * Try to auto-map headers using aliases
 */
export const autoMapHeaders = (
  sourceHeaders: string[]
): Record<CanonicalHeader, number | null> => {
  const mapping: Record<CanonicalHeader, number | null> = {
    'Positions-ID': null,
    'Kurztext': null,
    'Einheit': null,
    'EP': null,
    'Kategorie': null,
  };

  sourceHeaders.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    
    // Direct match to canonical header
    const canonicalMatch = ALL_HEADERS.find(
      h => normalizeHeader(h) === normalized
    );
    if (canonicalMatch && mapping[canonicalMatch] === null) {
      mapping[canonicalMatch] = index;
      return;
    }
    
    // Check aliases
    const aliasMatch = HEADER_ALIASES[normalized];
    if (aliasMatch && mapping[aliasMatch] === null) {
      mapping[aliasMatch] = index;
    }
  });

  return mapping;
};

/**
 * Validate that all required headers are mapped
 */
export const validateMapping = (
  mapping: Record<CanonicalHeader, number | null>
): { valid: boolean; missing: RequiredHeader[] } => {
  const missing: RequiredHeader[] = [];
  
  for (const header of REQUIRED_HEADERS) {
    if (mapping[header] === null) {
      missing.push(header);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Generate storage key for mapping persistence
 */
export const getMappingStorageKey = (fileName: string, fileSize: number): string => {
  // Simple hash based on name and size
  return `lv-mapping:${fileName}:${fileSize}`;
};

/**
 * Save mapping to localStorage
 */
export const saveMappingToStorage = (
  key: string,
  mapping: Record<CanonicalHeader, number | null>
): void => {
  try {
    localStorage.setItem(key, JSON.stringify(mapping));
  } catch (e) {
    console.warn('Failed to save mapping to localStorage', e);
  }
};

/**
 * Load mapping from localStorage
 */
export const loadMappingFromStorage = (
  key: string
): Record<CanonicalHeader, number | null> | null => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load mapping from localStorage', e);
  }
  return null;
};
