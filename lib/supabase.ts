import { createClient } from "@supabase/supabase-js";

// Service-role client. Server-side only: pipeline functions and API routes.
export function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
