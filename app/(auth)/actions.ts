"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase/server";

/** What useActionState carries back into the forms. */
export interface AuthState {
  error?: string;
  notice?: string;
  /**
   * Echoed so the form can repopulate: React resets an uncontrolled form after
   * a Server Action, so otherwise a typo in the password would also clear the
   * email. Passwords are deliberately never echoed.
   */
  values?: { email?: string; name?: string };
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  // x-forwarded-host is what Vercel sets; host covers local dev.
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

/**
 * One action for the whole login form. The form has three submit buttons
 * (sign in, magic link, reset) and each carries a different `intent`, so a
 * single useActionState drives one message area instead of three competing
 * states fighting over the same space.
 */
export async function loginAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  switch (String(formData.get("intent") ?? "password")) {
    case "magic":
      return signInWithMagicLink(prev, formData);
    case "reset":
      return sendPasswordReset(prev, formData);
    default:
      return signInWithPassword(prev, formData);
  }
}

export async function signInWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");

  // The forms began as markup with no name attributes. If that regresses, the
  // fields arrive empty and Supabase reports "invalid credentials", which reads
  // as a wrong password rather than a wiring bug. Say what actually happened.
  const values = { email };
  if (!email || !password) return { error: "Enter your email and password.", values };

  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password don't match.", values };

  redirect("/app");
}

export async function signUpWithPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const fullName = String(formData.get("name") ?? "").trim();
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");

  const values = { email, name: fullName };
  if (!fullName) return { error: "Enter your full name.", values };
  if (fullName.length > 120) return { error: "That name is too long.", values };
  if (!email) return { error: "Enter your email address.", values };
  if (password.length < 8)
    return { error: "Use at least 8 characters for your password.", values };

  const supabase = await sessionClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // full_name is the same key Google OAuth populates, so both paths read
      // back identically from user.user_metadata.full_name.
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });

  if (error) return { error: error.message, values };

  return {
    notice: `Check ${email} for a confirmation link to finish setting up your account.`,
  };
}

export async function signInWithMagicLink(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  const values = { email };
  if (!email) return { error: "Enter your email address first.", values };

  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) return { error: error.message, values };
  return { notice: `Check ${email} for your sign-in link.`, values };
}

export async function sendPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  const values = { email };
  if (!email) return { error: "Enter your email address first.", values };

  const supabase = await sessionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/app`,
  });

  if (error) return { error: error.message, values };
  return { notice: `Check ${email} for a link to reset your password.`, values };
}

/** A bare form action, so it must resolve to void — failures go back via ?error=. */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Could not reach Google. Try again.")}`);
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}
