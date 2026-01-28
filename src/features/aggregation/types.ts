/**
 * Types for daily report aggregation
 */

export interface DailyRecord {
  id: string;
  date: string;
  kolonne_id: string;
  employees_count: number;
  hours_per_employee: number;
  planned_revenue: number;
  actual_revenue: number;
  rev_per_employee: number | null;
  rev_per_hour: number | null;
  kolonnen?: {
    id: string;
    number: string;
    project: string | null;
  };
}

export interface PeriodTotals {
  totalPlanned: number;
  totalActual: number;
  totalEmployees: number;
  totalHours: number;
  recordCount: number;
}

export interface PeriodAggregation {
  totals: PeriodTotals;
  contributingCrewsCount: number;
  contributingCrewIds: Set<string>;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export type PeriodPreset = 
  | 'today' 
  | 'this_week' 
  | 'this_month' 
  | 'this_quarter' 
  | 'this_year' 
  | 'custom';

export interface PeriodPresetOption {
  value: PeriodPreset;
  label: string;
}

export const PERIOD_PRESETS: PeriodPresetOption[] = [
  { value: 'today', label: 'Heute' },
  { value: 'this_week', label: 'Diese Woche' },
  { value: 'this_month', label: 'Dieser Monat' },
  { value: 'this_quarter', label: 'Dieses Quartal' },
  { value: 'this_year', label: 'Dieses Jahr' },
  { value: 'custom', label: 'Benutzerdefiniert' },
];
