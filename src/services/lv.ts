/**
 * LV (Leistungsverzeichnis) service layer with validation
 */
import { supabase } from '@/integrations/supabase/client';
import { toSupaError, type SupaError, type SupaResult } from './supa';

export interface LVVersion {
  id: string;
  name: string;
  project: string | null;
  project_id: string | null;
  version: string;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface CreateLVInput {
  name: string;
  project?: string | null;
  project_id?: string | null;
  version?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  created_by?: string | null;
}

/**
 * List all LV versions, ordered by creation date
 */
export async function listLVs(): Promise<SupaResult<LVVersion[]>> {
  const { data, error } = await supabase
    .from('lvs')
    .select('*')
    .order('created_at', { ascending: false });

  return {
    data: data as LVVersion[] | null,
    error: toSupaError(error),
  };
}

/**
 * Create a new LV version with validation
 */
export async function createLV(
  input: CreateLVInput
): Promise<SupaResult<LVVersion>> {
  // Validation
  const name = input.name?.trim();
  if (!name) {
    return {
      data: null,
      error: {
        code: 'VALIDATION',
        message: 'LV-Name darf nicht leer sein',
        details: null,
      },
    };
  }

  // Validate date range
  if (input.valid_from && input.valid_to) {
    if (new Date(input.valid_from) > new Date(input.valid_to)) {
      return {
        data: null,
        error: {
          code: 'VALIDATION',
          message: 'Gültig ab muss vor oder gleich Gültig bis sein',
          details: null,
        },
      };
    }
  }

  const { data, error } = await supabase
    .from('lvs')
    .insert({
      name,
      project: input.project?.trim() || null,
      project_id: input.project_id || null,
      version: input.version?.trim() || '1.0',
      valid_from: input.valid_from || null,
      valid_to: input.valid_to || null,
      created_by: input.created_by || null,
    })
    .select()
    .single();

  return {
    data: data as LVVersion | null,
    error: toSupaError(error),
  };
}

/**
 * Update an LV version
 */
export async function updateLV(
  id: string,
  input: Partial<CreateLVInput>
): Promise<SupaResult<LVVersion>> {
  // Validate date range if both provided
  if (input.valid_from && input.valid_to) {
    if (new Date(input.valid_from) > new Date(input.valid_to)) {
      return {
        data: null,
        error: {
          code: 'VALIDATION',
          message: 'Gültig ab muss vor oder gleich Gültig bis sein',
          details: null,
        },
      };
    }
  }

  const updates: {
    name?: string;
    project?: string | null;
    project_id?: string | null;
    version?: string;
    valid_from?: string | null;
    valid_to?: string | null;
  } = {};
  
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.project !== undefined) updates.project = input.project?.trim() || null;
  if (input.project_id !== undefined) updates.project_id = input.project_id || null;
  if (input.version !== undefined) updates.version = input.version.trim() || '1.0';
  if (input.valid_from !== undefined) updates.valid_from = input.valid_from || null;
  if (input.valid_to !== undefined) updates.valid_to = input.valid_to || null;

  const { data, error } = await supabase
    .from('lvs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return {
    data: data as LVVersion | null,
    error: toSupaError(error),
  };
}

/**
 * Delete an LV version
 */
export async function deleteLV(id: string): Promise<SupaResult<null>> {
  const { error } = await supabase.from('lvs').delete().eq('id', id);
  return { data: null, error: toSupaError(error) };
}
