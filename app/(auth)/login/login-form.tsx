"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { Divider, FormMessage, GoogleButton, inputClass, labelClass } from "../auth-ui";
import { loginAction, type AuthState } from "../actions";

/** Each button carries its own intent, so one action serves all three paths. */
function Buttons() {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <button
        type="submit"
        name="intent"
        value="password"
        disabled={pending}
        aria-busy={pending}
        className="h-13 w-full rounded-full bg-[#3d5a3c] text-base font-semibold text-[#fffdf9] transition-colors hover:bg-[#334c32] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Working…" : "Sign In"}
      </button>
      <button
        type="submit"
        name="intent"
        value="magic"
        disabled={pending}
        className="h-13 w-full rounded-full border border-[#e7dfd2] bg-white text-base font-semibold text-[#2c2418] transition-colors hover:bg-[#faf7f2] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Email me a sign-in link
      </button>
    </div>
  );
}

function ResetLink() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value="reset"
      disabled={pending}
      className="font-semibold text-[#c1694f] hover:underline disabled:opacity-60"
    >
      Reset password
    </button>
  );
}

export default function LoginForm({ callbackError }: { callbackError?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <div>
      <h1 className="font-display text-4xl text-[#2c2418]">Welcome back</h1>
      <p className="mt-3 text-[#6b5f4e]">Sign in to continue mapping your family story.</p>

      <form className="mt-8 space-y-5" action={formAction}>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email Address
          </label>
          {/* defaultValue, not value: React resets the form after a Server
              Action, and the reset lands on whatever the action echoed back. */}
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={state.values?.email}
            autoComplete="email"
            placeholder="Enter your email address"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              className={`${inputClass} pr-14`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-2 text-[#6b5f4e] hover:text-[#2c2418]"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-[#2c2418]">
            {/* Supabase persists sessions by default; this reflects that rather
                than pretending to toggle something. */}
            <input type="checkbox" name="remember" defaultChecked className="size-4 accent-[#3d5a3c]" />
            Keep me signed in
          </label>
          <ResetLink />
        </div>

        <FormMessage error={state.error ?? callbackError} notice={state.notice} />

        <Buttons />
      </form>

      <Divider />
      <GoogleButton />

      <p className="mt-6 text-center text-sm text-[#6b5f4e]">
        New to Silaturahmi?{" "}
        <Link href="/register" className="font-semibold text-[#c1694f] underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
