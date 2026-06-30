import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente com service_role — bypassa RLS. Usar apenas em operações admin.
export const supabaseAdmin = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } },
)
