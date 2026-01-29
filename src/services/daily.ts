/**
 * Daily records service (read-only for inspector)
 */
import { supabase } from '@/integrations/supabase/client';
import { toSupaError, type SupaResult } from './supa';

export interface DailyRecordSummary {
  id: string;
  date: string;
  kolonne_id: string;
  foreman_id: string;
  employees_count: number;
  employees_plan: number | null;
  hours_per_employee: number;
  hours_plan: number | null;
  planned_revenue: number | null;
  actual_revenue: number | null;
  has_entries: boolean | null;
}

/**
 * List top N daily records for inspector
 */
export async function listTop(
  limit: number = 10
): Promise<SupaResult<DailyRecordSummary[]>> {
  const { data, error } = await supabase
    .from('leistungsmeldung_tags')
    .select('id, date, kolonne_id, foreman_id, employees_count, employees_plan, hours_per_employee, hours_plan, planned_revenue, actual_revenue, has_entries')
    .order('date', { ascending: false })
    .limit(limit);

  return {
    data: data as DailyRecordSummary[] | null,
    error: toSupaError(error),
  };
}
