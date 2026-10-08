import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { env } from "@/lib/config/env";

/**
 * Server Component / Route Handler / Server Action client.
 * Runs as the signed-in user — every query still passes through RLS.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabase.url(), env.supabase.anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component with no response to write cookies
          // to — safe to ignore because middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses Row Level Security entirely — use it ONLY in
 * trusted server-side code that has already verified what it's doing:
 *   - the Paystack webhook handler, to write verified payment rows
 *   - background job processors moving an optimization_job through its states
 *   - the admin dashboard's aggregate/reporting queries
 * NEVER import this from a Client Component or send its key to the browser.
 */
export function createServiceRoleClient() {
  return createSupabaseJsClient<Database>(
    env.supabase.url(),
    env.supabase.serviceRoleKey(),
    { auth: { persistSession: false } }
  );
}
