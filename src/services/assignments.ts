/**
 * Kolonne-LV Assignment service with auto-closing previous assignments
 */
import { supabase } from '@/integrations/supabase/client';
import { toSupaError, type SupaResult } from './supa';

export interface KolonneLVAssignment {
  id: string;
  kolonne_id: string;
  lv_id: string;
  is_active: boolean | null;
  valid_from: string | null;
  valid_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
}

export interface AssignInput {
  kolonne_id: string;
  lv_id: string;
  valid_from?: string;
  assigned_by?: string;
}

/**
 * List assignments for a kolonne
 */
export async function listByKolonne(
  kolonneId: string
): Promise<SupaResult<KolonneLVAssignment[]>> {
  const { data, error } = await supabase
    .from('kolonne_lv_assignments')
    .select('*')
    .eq('kolonne_id', kolonneId)
    .order('valid_from', { ascending: false });

  return {
    data: data as KolonneLVAssignment[] | null,
    error: toSupaError(error),
  };
}

/**
 * List all active assignments
 */
export async function listActive(): Promise<SupaResult<KolonneLVAssignment[]>> {
  const { data, error } = await supabase
    .from('kolonne_lv_assignments')
    .select('*')
    .eq('is_active', true);

  return {
    data: data as KolonneLVAssignment[] | null,
    error: toSupaError(error),
  };
}

/**
 * Create a new assignment with auto-closing previous active assignment
 */
export async function assign(
  input: AssignInput
): Promise<SupaResult<KolonneLVAssignment>> {
  // Validation
  if (!input.kolonne_id) {
    return {
      data: null,
      error: {
        code: 'VALIDATION',
        message: 'Kolonne muss ausgewählt werden',
        details: null,
      },
    };
  }

  if (!input.lv_id) {
    return {
      data: null,
      error: {
        code: 'VALIDATION',
        message: 'LV muss ausgewählt werden',
        details: null,
      },
    };
  }

  const validFrom = input.valid_from || new Date().toISOString().split('T')[0];

  // Auto-close previous active assignment for this kolonne
  const { data: existing } = await supabase
    .from('kolonne_lv_assignments')
    .select('id')
    .eq('kolonne_id', input.kolonne_id)
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    // Set valid_to to day before new assignment
    const prevDate = new Date(validFrom);
    prevDate.setDate(prevDate.getDate() - 1);
    const validTo = prevDate.toISOString().split('T')[0];

    await supabase
      .from('kolonne_lv_assignments')
      .update({ is_active: false, valid_to: validTo })
      .eq('id', existing.id);
  }

  // Create new active assignment
  const { data, error } = await supabase
    .from('kolonne_lv_assignments')
    .insert({
      kolonne_id: input.kolonne_id,
      lv_id: input.lv_id,
      valid_from: validFrom,
      is_active: true,
      assigned_by: input.assigned_by || null,
    })
    .select()
    .single();

  return {
    data: data as KolonneLVAssignment | null,
    error: toSupaError(error),
  };
}

/**
 * Deactivate an assignment
 */
export async function deactivate(
  id: string,
  validTo?: string
): Promise<SupaResult<null>> {
  const { error } = await supabase
    .from('kolonne_lv_assignments')
    .update({
      is_active: false,
      valid_to: validTo || new Date().toISOString().split('T')[0],
    })
    .eq('id', id);

  return { data: null, error: toSupaError(error) };
}
