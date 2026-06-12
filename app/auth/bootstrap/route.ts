import { NextRequest, NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase";

// RLS keys every read on app_metadata.firm_id, but a fresh magic-link user has
// no firm. The demo runs one seeded firm, so first sign-in claims it here,
// then the session is refreshed so the new JWT carries the claim.
export async function GET(req: NextRequest) {
  const supabase = await userClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl));

  if (!user.app_metadata?.firm_id) {
    const db = adminClient();
    const { data: firm } = await db.from("firms").select("id").limit(1).single();
    if (!firm) {
      return NextResponse.redirect(
        new URL("/login?error=No+firm+seeded.+Run+npm+run+seed+first.", req.nextUrl)
      );
    }
    const { error } = await db.auth.admin.updateUserById(user.id, {
      app_metadata: { firm_id: firm.id },
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, req.nextUrl)
      );
    }
    await supabase.auth.refreshSession();
  }

  return NextResponse.redirect(new URL("/notices", req.nextUrl));
}
