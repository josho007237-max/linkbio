import { createClient } from "@supabase/supabase-js";

import { hasSupabaseEnv, supabaseEnv } from "@/lib/supabase/env";

export const getSupabaseClient = () => {
  if (!hasSupabaseEnv || !supabaseEnv.url || !supabaseEnv.anonKey) {
    return null;
  }

  return createClient(supabaseEnv.url, supabaseEnv.anonKey);
};

