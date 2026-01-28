/**
 * LV Import Service - Handles Excel and CSV file parsing
 */
import * as XLSX from 'xlsx';
import {
  type LVRow,
  type CanonicalHeader,
  REQUIRED_HEADERS,
  ALL_HEADERS,
  autoMapHeaders,
  validateMapping,
  normalizeHeader,
  KNOWN_UNITS,
  getMappingStorageKey,
  loadMappingFromStorage,
} from './importSchema';
import { parseNumber, isValidEP } from './parseNumber';

export interface ParsedFile {
  fileName: string;
  fileSize: number;
  fileType: 'excel' | 'csv';
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  rawData: unknown[][];
  mapping: Record<CanonicalHeader, number | null>;
  isCanonical: boolean;
  storedMappingKey: string;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportResult {
  rows: LVRow[];
  errors: ValidationError[];
  warnings: ValidationError[];
  totalRows: number;
  validRows: number;
}

/**
 * Detect CSV delimiter by analyzing content
 */
const detectDelimiter = (content: string): string => {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  
  const delimiters = [';', ',', '\t'];
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: (firstLines.match(new RegExp(d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
  }));
  
  // Sort by count descending
  counts.sort((a, b) => b.count - a.count);
  
  // Return the most common delimiter (default to semicolon for German files)
  return counts[0]?.count > 0 ? counts[0].delimiter : ';';
};

/**
 * Try to decode content with different encodings
 */
const decodeContent = async (buffer: ArrayBuffer): Promise<string> => {
  const uint8 = new Uint8Array(buffer);
  
  // Check for BOM
  if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    // UTF-8 BOM
    return new TextDecoder('utf-8').decode(uint8.slice(3));
  }
  if (uint8[0] === 0xFF && uint8[1] === 0xFE) {
    // UTF-16 LE BOM
    return new TextDecoder('utf-16le').decode(uint8.slice(2));
  }
  if (uint8[0] === 0xFE && uint8[1] === 0xFF) {
    // UTF-16 BE BOM
    return new TextDecoder('utf-16be').decode(uint8.slice(2));
  }

  // Try UTF-8 first
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(uint8);
  } catch {
    // Fall back to Windows-1252 (common for German files)
    try {
      const decoder = new TextDecoder('windows-1252');
      return decoder.decode(uint8);
    } catch {
      // Last resort: ISO-8859-1
      const decoder = new TextDecoder('iso-8859-1');
      return decoder.decode(uint8);
    }
  }
};

/**
 * Parse CSV content into rows
 */
const parseCSV = (content: string, delimiter: string): unknown[][] => {
  const rows: unknown[][] = [];
  const lines = content.split(/\r?\n/);
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    const cells: unknown[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  
  return rows;
};

/**
 * Check if headers match canonical schema exactly
 */
const checkCanonicalSchema = (headers: string[]): boolean => {
  const normalized = headers.map(normalizeHeader);
  const required = REQUIRED_HEADERS.map(h => normalizeHeader(h));
  
  // Check if all required canonical headers are present (exact match)
  return required.every(req => normalized.includes(req));
};

/**
 * Parse a file and extract metadata
 */
export const parseFile = async (file: File): Promise<ParsedFile> => {
  const fileName = file.name;
  const fileSize = file.size;
  const extension = fileName.toLowerCase().split('.').pop();
  
  let sheets: string[] = [];
  let selectedSheet = '';
  let headers: string[] = [];
  let rawData: unknown[][] = [];
  let fileType: 'excel' | 'csv' = 'excel';

  if (extension === 'csv') {
    fileType = 'csv';
    const buffer = await file.arrayBuffer();
    const content = await decodeContent(buffer);
    const delimiter = detectDelimiter(content);
    const rows = parseCSV(content, delimiter);
    
    if (rows.length === 0) {
      throw new Error('Die Datei ist leer');
    }
    
    sheets = ['CSV'];
    selectedSheet = 'CSV';
    headers = (rows[0] as string[]).map(h => String(h || ''));
    rawData = rows.slice(1);
  } else if (extension === 'xlsx' || extension === 'xls') {
    fileType = 'excel';
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    
    sheets = workbook.SheetNames;
    if (sheets.length === 0) {
      throw new Error('Die Excel-Datei enthält keine Tabellenblätter');
    }
    
    selectedSheet = sheets[0];
    const worksheet = workbook.Sheets[selectedSheet];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
    
    if (jsonData.length === 0) {
      throw new Error('Das Tabellenblatt ist leer');
    }
    
    headers = (jsonData[0] as unknown[]).map(h => String(h ?? ''));
    rawData = jsonData.slice(1);
  } else {
    throw new Error('Nicht unterstütztes Dateiformat. Bitte verwenden Sie .xlsx, .xls oder .csv');
  }

  // Check if canonical schema
  const isCanonical = checkCanonicalSchema(headers);
  
  // Get storage key and try to load saved mapping
  const storedMappingKey = getMappingStorageKey(fileName, fileSize);
  const storedMapping = loadMappingFromStorage(storedMappingKey);
  
  // Auto-map headers (prefer stored mapping if available)
  const mapping = storedMapping || autoMapHeaders(headers);

  return {
    fileName,
    fileSize,
    fileType,
    sheets,
    selectedSheet,
    headers,
    rawData,
    mapping,
    isCanonical,
    storedMappingKey,
  };
};

/**
 * Re-parse a specific sheet from an Excel file
 */
export const parseSheet = async (file: File, sheetName: string): Promise<{
  headers: string[];
  rawData: unknown[][];
  mapping: Record<CanonicalHeader, number | null>;
  isCanonical: boolean;
}> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[sheetName];
  
  if (!worksheet) {
    throw new Error(`Tabellenblatt "${sheetName}" nicht gefunden`);
  }
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  
  if (jsonData.length === 0) {
    throw new Error('Das Tabellenblatt ist leer');
  }
  
  const headers = (jsonData[0] as unknown[]).map(h => String(h ?? ''));
  const rawData = jsonData.slice(1);
  const isCanonical = checkCanonicalSchema(headers);
  const mapping = autoMapHeaders(headers);

  return { headers, rawData, mapping, isCanonical };
};

/**
 * Validate and transform parsed data into LVRows
 */
export const validateAndTransform = (
  rawData: unknown[][],
  mapping: Record<CanonicalHeader, number | null>,
  options?: {
    generateAutoIds?: boolean;
  }
): ImportResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const rows: LVRow[] = [];
  const seenIds = new Set<string>();
  let autoIdCounter = 1;

  // Validate mapping first
  const mappingValidation = validateMapping(mapping);
  if (!mappingValidation.valid) {
    mappingValidation.missing.forEach(field => {
      errors.push({
        row: 0,
        column: field,
        message: `Pflichtfeld "${field}" ist nicht zugeordnet`,
        severity: 'error',
      });
    });
    return { rows: [], errors, warnings, totalRows: rawData.length, validRows: 0 };
  }

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2; // Excel row number (1-indexed, skip header)
    
    // Skip empty rows
    if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue;
    }

    let hasError = false;
    
    // Extract values
    let positionId = mapping['Positions-ID'] !== null 
      ? String(row[mapping['Positions-ID']] ?? '').trim()
      : '';
    
    const kurztext = mapping['Kurztext'] !== null
      ? String(row[mapping['Kurztext']] ?? '').trim()
      : '';
    
    const einheit = mapping['Einheit'] !== null
      ? String(row[mapping['Einheit']] ?? '').trim()
      : '';
    
    const epRaw = mapping['EP'] !== null ? row[mapping['EP']] : null;
    const ep = parseNumber(epRaw);
    
    const kategorie = mapping['Kategorie'] !== null
      ? String(row[mapping['Kategorie']] ?? '').trim() || undefined
      : undefined;

    // Handle auto-ID generation
    if (!positionId && options?.generateAutoIds) {
      positionId = `AUTO-${String(autoIdCounter).padStart(4, '0')}`;
      autoIdCounter++;
    }

    // Validate required fields
    if (!positionId) {
      errors.push({
        row: rowNum,
        column: 'Positions-ID',
        message: 'Positions-ID ist leer',
        severity: 'error',
      });
      hasError = true;
    } else if (seenIds.has(positionId)) {
      errors.push({
        row: rowNum,
        column: 'Positions-ID',
        message: `Doppelte Positions-ID: "${positionId}"`,
        severity: 'error',
      });
      hasError = true;
    } else {
      seenIds.add(positionId);
    }

    if (!kurztext) {
      errors.push({
        row: rowNum,
        column: 'Kurztext',
        message: 'Kurztext ist leer',
        severity: 'error',
      });
      hasError = true;
    }

    if (!einheit) {
      errors.push({
        row: rowNum,
        column: 'Einheit',
        message: 'Einheit ist leer',
        severity: 'error',
      });
      hasError = true;
    } else {
      // Check if unit is known
      const normalizedUnit = einheit.toLowerCase().replace(/\s+/g, ' ');
      const isKnown = KNOWN_UNITS.some(u => 
        u.toLowerCase().replace(/\s+/g, ' ') === normalizedUnit
      );
      if (!isKnown) {
        warnings.push({
          row: rowNum,
          column: 'Einheit',
          message: `Unbekannte Einheit: "${einheit}"`,
          severity: 'warning',
        });
      }
    }

    if (!isValidEP(ep)) {
      errors.push({
        row: rowNum,
        column: 'EP',
        message: ep === null 
          ? 'EP ist leer oder nicht numerisch'
          : `Ungültiger EP-Wert: "${epRaw}"`,
        severity: 'error',
      });
      hasError = true;
    }

    if (!hasError && ep !== null) {
      rows.push({
        'Positions-ID': positionId,
        'Kurztext': kurztext,
        'Einheit': einheit,
        'EP': ep,
        'Kategorie': kategorie,
      });
    }
  }

  return {
    rows,
    errors,
    warnings,
    totalRows: rawData.length,
    validRows: rows.length,
  };
};

/**
 * Generate a template file for download
 */
export const generateTemplateCSV = (): string => {
  const headers = ALL_HEADERS.join(';');
  const exampleRow = 'POS-001;Beispiel Leistung;m²;12,50;Erdarbeiten';
  return `${headers}\n${exampleRow}`;
};

/**
 * Generate a template Excel file for download
 */
export const generateTemplateExcel = (): ArrayBuffer => {
  const workbook = XLSX.utils.book_new();
  const data = [
    [...ALL_HEADERS],
    ['POS-001', 'Beispiel Leistung', 'm²', 12.50, 'Erdarbeiten'],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'LV-Vorlage');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

/**
 * Download template file
 */
export const downloadTemplate = (format: 'csv' | 'xlsx'): void => {
  if (format === 'csv') {
    const content = generateTemplateCSV();
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LV-Vorlage.csv';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const buffer = generateTemplateExcel();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LV-Vorlage.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
};
