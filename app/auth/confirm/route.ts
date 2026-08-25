import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sessionClient } from "@/lib/supabase/server";

/** Email confirmation and recovery links land here with a token hash. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That confirmation link is incomplete.")}`,
    );
  }

  const supabase = await sessionClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That link has expired. Request a new one.")}`,
    );
  }

  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return NextResponse.redirect(`${origin}${target}`);
}
