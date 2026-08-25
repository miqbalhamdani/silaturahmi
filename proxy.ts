import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Next 16 renamed middleware.ts to proxy.ts. A file named middleware.ts is
 * INERT in this version — it fails silently, which is the worst failure mode.
 * See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie. Cookie-only, no database calls — proxy runs
  // on prefetches too, so anything expensive here runs on links never clicked.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data);

  const path = request.nextUrl.pathname;

  // Optimistic only, in the sense the Next.js auth guide means: cheap, and NOT
  // a security boundary. Real authorization lives in the Server Actions.
  if (!signedIn && path.startsWith("/app")) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }
  if (signedIn && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/app", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
