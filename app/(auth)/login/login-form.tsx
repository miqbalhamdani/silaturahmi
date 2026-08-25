"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import {
  Divider,
  GoogleButton,
  inputClass,
  labelClass,
  primaryButtonClass,
} from "../auth-ui";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <h1 className="font-display text-4xl text-[#2c2418]">Welcome back</h1>
      <p className="mt-3 text-[#6b5f4e]">
        Sign in to continue mapping your family story.
      </p>

      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
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
            <input type="checkbox" className="size-4 accent-[#3d5a3c]" />
            Keep me signed in
          </label>
          <a href="#" className="font-semibold text-[#c1694f] hover:underline">
            Reset password
          </a>
        </div>

        <button type="submit" className={primaryButtonClass}>
          Sign In
        </button>
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
