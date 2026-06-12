import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

// User-scoped client for server components and server actions.
// Reads/writes go through RLS keyed on app_metadata.firm_id.
export async function userClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a server component; middleware refreshes sessions there.
          }
        },
      },
    }
  );
}

export async function requireUser() {
  const supabase = await userClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // RLS depends on firm_id in app_metadata; new magic-link users get it
  // assigned in the auth bootstrap route.
  if (!user.app_metadata?.firm_id) redirect("/auth/bootstrap");
  return { supabase, user, firmId: user.app_metadata.firm_id as string };
}
