/**
 * Unified Supabase error types
 */
import type { PostgrestError } from '@supabase/supabase-js';

export interface SupaError {
  code: string;
  message: string;
  details: string | null;
}

export interface SupaResult<T> {
  data: T | null;
  error: SupaError | null;
}

export function toSupaError(err: PostgrestError | null): SupaError | null {
  if (!err) return null;
  return {
    code: err.code || 'UNKNOWN',
    message: err.message || 'Ein unbekannter Fehler ist aufgetreten',
    details: err.details || err.hint || null,
  };
}

/**
 * Format error for user display
 */
export function formatSupaError(err: SupaError): string {
  let msg = err.message;
  if (err.code === '42501') {
    msg = 'Keine Berechtigung für diese Aktion (RLS)';
  } else if (err.code === '23505') {
    msg = 'Ein Eintrag mit diesen Daten existiert bereits';
  } else if (err.code === '23503') {
    msg = 'Referenzierter Eintrag existiert nicht';
  }
  return `${msg} [${err.code}]`;
}
