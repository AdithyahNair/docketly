import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase-server";

// Magic-link landing. Supports both PKCE (?code=) and token-hash links.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;

  const supabase = await userClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code or token_hash") };

  if (result.error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(result.error.message)}`, url)
    );
  }
  return NextResponse.redirect(new URL("/auth/bootstrap", url));
}
