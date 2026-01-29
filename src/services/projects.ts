/**
 * Projects service layer
 */
import { supabase } from '@/integrations/supabase/client';
import { toSupaError, type SupaResult } from './supa';

export interface Project {
  id: string;
  name: string;
  code: string | null;
  client: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateProjectInput {
  name: string;
  code?: string | null;
  client?: string | null;
  status?: string | null;
}

/**
 * List all projects
 */
export async function listProjects(): Promise<SupaResult<Project[]>> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name', { ascending: true });

  return {
    data: data as Project[] | null,
    error: toSupaError(error),
  };
}

/**
 * Create a new project
 */
export async function createProject(
  input: CreateProjectInput
): Promise<SupaResult<Project>> {
  const name = input.name?.trim();
  if (!name) {
    return {
      data: null,
      error: {
        code: 'VALIDATION',
        message: 'Projektname darf nicht leer sein',
        details: null,
      },
    };
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name,
      code: input.code?.trim() || null,
      client: input.client?.trim() || null,
      status: input.status || 'active',
    })
    .select()
    .single();

  return {
    data: data as Project | null,
    error: toSupaError(error),
  };
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  input: Partial<CreateProjectInput>
): Promise<SupaResult<Project>> {
  const updates: {
    name?: string;
    code?: string | null;
    client?: string | null;
    status?: string | null;
  } = {};
  
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.code !== undefined) updates.code = input.code?.trim() || null;
  if (input.client !== undefined) updates.client = input.client?.trim() || null;
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  return {
    data: data as Project | null,
    error: toSupaError(error),
  };
}
