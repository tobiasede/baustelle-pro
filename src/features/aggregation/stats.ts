/**
 * Aggregation functions for daily reports
 */

import { toNumberOrZero, safeDivide } from '@/lib/numberUtils';
import type { 
  DailyRecord, 
  PeriodTotals, 
  PeriodAggregation, 
  DateRange,
  PeriodPreset 
} from './types';

/**
 * Initialize empty totals
 */
export function initTotals(): PeriodTotals {
  return {
    totalPlanned: 0,
    totalActual: 0,
    totalEmployees: 0,
    totalHours: 0,
    recordCount: 0,
  };
}

/**
 * Add a daily record to running totals
 */
export function addDailyToTotals(totals: PeriodTotals, record: DailyRecord): PeriodTotals {
  const employees = toNumberOrZero(record.employees_count);
  const hoursPerEmployee = toNumberOrZero(record.hours_per_employee);
  
  return {
    totalPlanned: totals.totalPlanned + toNumberOrZero(record.planned_revenue),
    totalActual: totals.totalActual + toNumberOrZero(record.actual_revenue),
    totalEmployees: totals.totalEmployees + employees,
    totalHours: totals.totalHours + (employees * hoursPerEmployee),
    recordCount: totals.recordCount + 1,
  };
}

/**
 * Check if a record has meaningful entries (not just default zeros)
 * A crew contributes if any value field is > 0
 */
export function recordHasEntries(record: DailyRecord): boolean {
  const planned = toNumberOrZero(record.planned_revenue);
  const actual = toNumberOrZero(record.actual_revenue);
  const employees = toNumberOrZero(record.employees_count);
  
  // A record has entries if it has any non-zero meaningful data
  return planned > 0 || actual > 0 || employees > 0;
}

/**
 * Check if a date is within a range (inclusive)
 */
function isDateInRange(dateStr: string, range: DateRange): boolean {
  const date = new Date(dateStr);
  // Normalize to start of day for comparison
  const dateNorm = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const fromNorm = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
  const toNorm = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate());
  
  return dateNorm >= fromNorm && dateNorm <= toNorm;
}

/**
 * Aggregate records for a period, counting only crews that provided values
 */
export function aggregatePeriod(
  records: DailyRecord[], 
  range: DateRange
): PeriodAggregation {
  const contributingCrewIds = new Set<string>();
  let totals = initTotals();
  
  for (const record of records) {
    // Filter by date range
    if (!isDateInRange(record.date, range)) continue;
    
    // Only include if the record has actual entries
    if (!recordHasEntries(record)) continue;
    
    contributingCrewIds.add(record.kolonne_id);
    totals = addDailyToTotals(totals, record);
  }
  
  return {
    totals,
    contributingCrewsCount: contributingCrewIds.size,
    contributingCrewIds,
  };
}

/**
 * Calculate derived KPIs from totals
 */
export function calculateKPIs(totals: PeriodTotals) {
  const delta = totals.totalActual - totals.totalPlanned;
  const deltaPositive = delta >= 0;
  
  // Average revenue per employee per day (AT = Arbeitstag)
  const avgRevPerEmployee = safeDivide(totals.totalActual, totals.totalEmployees);
  
  // Average revenue per hour
  const avgRevPerHour = safeDivide(totals.totalActual, totals.totalHours);
  
  return {
    delta,
    deltaPositive,
    avgRevPerEmployee,
    avgRevPerHour,
  };
}

/**
 * Get date range for a period preset
 */
export function getDateRangeForPreset(preset: PeriodPreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'today':
      return { from: today, to: today };
      
    case 'this_week': {
      // Get Monday of current week (German week starts on Monday)
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6 days back, otherwise day - 1
      const monday = new Date(today);
      monday.setDate(today.getDate() - diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: monday, to: sunday };
    }
    
    case 'this_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: firstDay, to: lastDay };
    }
    
    case 'this_quarter': {
      const quarter = Math.floor(today.getMonth() / 3);
      const firstMonth = quarter * 3;
      const firstDay = new Date(today.getFullYear(), firstMonth, 1);
      const lastDay = new Date(today.getFullYear(), firstMonth + 3, 0);
      return { from: firstDay, to: lastDay };
    }
    
    case 'this_year': {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      return { from: firstDay, to: lastDay };
    }
    
    case 'custom':
    default:
      // Return empty range for custom - caller should provide dates
      return { from: today, to: today };
  }
}

/**
 * Format date as ISO string (YYYY-MM-DD) for database queries
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}
