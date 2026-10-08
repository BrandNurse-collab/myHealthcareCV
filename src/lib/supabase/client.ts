"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { env } from "@/lib/config/env";

// One client per component tree render is fine — createBrowserClient is cheap
// and memoizes the underlying connection internally.
export function createClient() {
  return createBrowserClient<Database>(env.supabase.url(), env.supabase.anonKey());
}
