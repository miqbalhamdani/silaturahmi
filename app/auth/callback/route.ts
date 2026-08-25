import { NextResponse, type NextRequest } from "next/server";
import { sessionClient } from "@/lib/supabase/server";

/**
 * The one Route Handler in the app. OAuth and magic links land here with a PKCE
 * code that has to be traded for a session before any redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sign-in link was incomplete.")}`);
  }

  const supabase = await sessionClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // next is attacker-influenced; only same-origin relative paths are safe.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return NextResponse.redirect(`${origin}${target}`);
}
