import { describe, it, expect } from 'vitest';
import { 
  aggregatePeriod, 
  recordHasEntries, 
  getDateRangeForPreset,
  initTotals,
  addDailyToTotals
} from './stats';
import type { DailyRecord } from './types';

const createMockRecord = (overrides: Partial<DailyRecord> = {}): DailyRecord => ({
  id: 'test-id',
  date: '2025-01-15',
  kolonne_id: 'crew-1',
  employees_count: 5,
  hours_per_employee: 8,
  planned_revenue: 1000,
  actual_revenue: 1200,
  rev_per_employee: 240,
  rev_per_hour: 30,
  ...overrides,
});

describe('recordHasEntries', () => {
  it('returns true when planned_revenue > 0', () => {
    const record = createMockRecord({ planned_revenue: 100, actual_revenue: 0, employees_count: 0 });
    expect(recordHasEntries(record)).toBe(true);
  });

  it('returns true when actual_revenue > 0', () => {
    const record = createMockRecord({ planned_revenue: 0, actual_revenue: 100, employees_count: 0 });
    expect(recordHasEntries(record)).toBe(true);
  });

  it('returns true when employees_count > 0', () => {
    const record = createMockRecord({ planned_revenue: 0, actual_revenue: 0, employees_count: 3 });
    expect(recordHasEntries(record)).toBe(true);
  });

  it('returns false when all values are 0', () => {
    const record = createMockRecord({ planned_revenue: 0, actual_revenue: 0, employees_count: 0 });
    expect(recordHasEntries(record)).toBe(false);
  });
});

describe('aggregatePeriod', () => {
  it('excludes records outside date range', () => {
    const records = [
      createMockRecord({ date: '2025-01-10', kolonne_id: 'crew-1' }),
      createMockRecord({ date: '2025-01-15', kolonne_id: 'crew-2' }),
      createMockRecord({ date: '2025-01-20', kolonne_id: 'crew-3' }),
    ];

    const range = { from: new Date('2025-01-14'), to: new Date('2025-01-16') };
    const result = aggregatePeriod(records, range);

    expect(result.contributingCrewsCount).toBe(1);
    expect(result.contributingCrewIds.has('crew-2')).toBe(true);
    expect(result.contributingCrewIds.has('crew-1')).toBe(false);
  });

  it('excludes records with hasEntries = false (all zeros)', () => {
    const records = [
      createMockRecord({ kolonne_id: 'crew-1', planned_revenue: 100 }),
      createMockRecord({ kolonne_id: 'crew-2', planned_revenue: 0, actual_revenue: 0, employees_count: 0 }),
    ];

    const range = { from: new Date('2025-01-01'), to: new Date('2025-01-31') };
    const result = aggregatePeriod(records, range);

    expect(result.contributingCrewsCount).toBe(1);
    expect(result.contributingCrewIds.has('crew-1')).toBe(true);
    expect(result.contributingCrewIds.has('crew-2')).toBe(false);
  });

  it('counts unique crew IDs correctly', () => {
    const records = [
      createMockRecord({ date: '2025-01-10', kolonne_id: 'crew-1' }),
      createMockRecord({ date: '2025-01-11', kolonne_id: 'crew-1' }),
      createMockRecord({ date: '2025-01-12', kolonne_id: 'crew-2' }),
    ];

    const range = { from: new Date('2025-01-01'), to: new Date('2025-01-31') };
    const result = aggregatePeriod(records, range);

    expect(result.contributingCrewsCount).toBe(2);
  });

  it('aggregates totals correctly', () => {
    const records = [
      createMockRecord({ 
        kolonne_id: 'crew-1', 
        planned_revenue: 1000, 
        actual_revenue: 1200,
        employees_count: 5,
        hours_per_employee: 8
      }),
      createMockRecord({ 
        kolonne_id: 'crew-2', 
        planned_revenue: 2000, 
        actual_revenue: 1800,
        employees_count: 3,
        hours_per_employee: 10
      }),
    ];

    const range = { from: new Date('2025-01-01'), to: new Date('2025-01-31') };
    const result = aggregatePeriod(records, range);

    expect(result.totals.totalPlanned).toBe(3000);
    expect(result.totals.totalActual).toBe(3000);
    expect(result.totals.totalEmployees).toBe(8);
    expect(result.totals.totalHours).toBe(5 * 8 + 3 * 10); // 70
    expect(result.totals.recordCount).toBe(2);
  });
});

describe('getDateRangeForPreset', () => {
  it('returns today for "today" preset', () => {
    const range = getDateRangeForPreset('today');
    const today = new Date();
    
    expect(range.from.getFullYear()).toBe(today.getFullYear());
    expect(range.from.getMonth()).toBe(today.getMonth());
    expect(range.from.getDate()).toBe(today.getDate());
    expect(range.to.getDate()).toBe(today.getDate());
  });

  it('returns valid week range for "this_week" preset', () => {
    const range = getDateRangeForPreset('this_week');
    
    // Week should be 7 days
    const diffTime = range.to.getTime() - range.from.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(6); // Sunday - Monday = 6 days difference
  });

  it('returns full month for "this_month" preset', () => {
    const range = getDateRangeForPreset('this_month');
    const today = new Date();
    
    expect(range.from.getDate()).toBe(1);
    expect(range.from.getMonth()).toBe(today.getMonth());
    expect(range.to.getMonth()).toBe(today.getMonth());
  });

  it('returns full year for "this_year" preset', () => {
    const range = getDateRangeForPreset('this_year');
    const today = new Date();
    
    expect(range.from.getMonth()).toBe(0);
    expect(range.from.getDate()).toBe(1);
    expect(range.to.getMonth()).toBe(11);
    expect(range.to.getDate()).toBe(31);
    expect(range.from.getFullYear()).toBe(today.getFullYear());
  });
});
