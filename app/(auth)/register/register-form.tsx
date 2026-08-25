"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  Divider,
  FormMessage,
  GoogleButton,
  SubmitButton,
  inputClass,
  labelClass,
} from "../auth-ui";
import { signUpWithPassword, type AuthState } from "../actions";

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction] = useActionState<AuthState, FormData>(signUpWithPassword, {});

  // On success there is nothing left to fill in — the next step is the inbox.
  if (state.notice) {
    return (
      <div>
        <h1 className="font-display text-4xl text-[#2c2418]">Check your email</h1>
        <p className="mt-3 text-[#6b5f4e]">{state.notice}</p>
        <p className="mt-6 text-center text-sm text-[#6b5f4e]">
          Already confirmed?{" "}
          <Link href="/login" className="font-semibold text-[#c1694f] underline">
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-[#2c2418]">Create your account</h1>
      <p className="mt-3 text-[#6b5f4e]">Start a living map of your family — free to begin.</p>

      <form className="mt-8 space-y-5" action={formAction}>
        <div>
          <label htmlFor="name" className={labelClass}>
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={state.values?.name}
            autoComplete="name"
            placeholder="Enter your full name"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email Address
          </label>
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
              autoComplete="new-password"
              placeholder="Create a password"
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

        <FormMessage error={state.error} />

        <SubmitButton pendingLabel="Creating account…">Create Account</SubmitButton>
      </form>

      <Divider />
      <GoogleButton />

      <p className="mt-6 text-center text-sm text-[#6b5f4e]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#c1694f] underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
