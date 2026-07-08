import { createClient } from '@supabase/supabase-js'
import { env } from '@/core/config/env'
import type { Database } from '@/core/supabase/database.types'

export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
