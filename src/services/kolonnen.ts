/**
 * Kolonnen service layer with validation and error handling
 */
import { supabase } from '@/integrations/supabase/client';
import { toSupaError, type SupaError, type SupaResult } from './supa';

export interface Kolonne {
  id: string;
  number: string;
  project: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateKolonneInput {
  number: string;
  project?: string | null;
}

export interface UpdateKolonneInput {
  number?: string;
  project?: string | null;
}

/**
 * List all Kolonnen, ordered by number
 */
export async function listKolonnen(): Promise<SupaResult<Kolonne[]>> {
  const { data, error } = await supabase
    .from('kolonnen')
    .select('*')
    .order('number', { ascending: true });

  return {
    data: data as Kolonne[] | null,
    error: toSupaError(error),
  };
}

/**
 * Create a new Kolonne with validation
 */
export async function createKolonne(
  input: CreateKolonneInput
): Promise<SupaResult<Kolonne>> {
  // Validation
  const number = input.number?.trim();
  if (!number) {
    return {
      data: null,
      error: {
        code: 'VALIDATION',
        message: 'Kolonnennummer darf nicht leer sein',
        details: null,
      },
    };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('kolonnen')
    .select('id')
    .eq('number', number)
    .maybeSingle();

  if (existing) {
    return {
      data: null,
      error: {
        code: 'DUPLICATE',
        message: `Kolonne "${number}" existiert bereits`,
        details: null,
      },
    };
  }

  const project = input.project?.trim() || null;

  const { data, error } = await supabase
    .from('kolonnen')
    .insert({ number, project })
    .select()
    .single();

  return {
    data: data as Kolonne | null,
    error: toSupaError(error),
  };
}

/**
 * Update a Kolonne
 */
export async function updateKolonne(
  id: string,
  input: UpdateKolonneInput
): Promise<SupaResult<Kolonne>> {
  const updates: Record<string, unknown> = {};

  if (input.number !== undefined) {
    const number = input.number.trim();
    if (!number) {
      return {
        data: null,
        error: {
          code: 'VALIDATION',
          message: 'Kolonnennummer darf nicht leer sein',
          details: null,
        },
      };
    }
    updates.number = number;
  }

  if (input.project !== undefined) {
    updates.project = input.project?.trim() || null;
  }

  const { data, error } = await supabase
    .from('kolonnen')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return {
    data: data as Kolonne | null,
    error: toSupaError(error),
  };
}

/**
 * Delete a Kolonne
 */
export async function deleteKolonne(id: string): Promise<SupaResult<null>> {
  const { error } = await supabase.from('kolonnen').delete().eq('id', id);
  return { data: null, error: toSupaError(error) };
}
