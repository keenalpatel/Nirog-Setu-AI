import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function for handling errors
export function handleSupabaseError<T>(data: T | null, error: any): { data: T | null; error: string | null } {
  if (error) {
    console.error('Supabase error:', error);
    return { data: null, error: error.message || 'An error occurred' };
  }
  return { data, error: null };
}
