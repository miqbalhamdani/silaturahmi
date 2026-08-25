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

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <h1 className="font-display text-4xl text-[#2c2418]">Create your account</h1>
      <p className="mt-3 text-[#6b5f4e]">
        Start a living map of your family — free to begin.
      </p>

      <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="name" className={labelClass}>
            Full Name
          </label>
          <input
            id="name"
            type="text"
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

        <button type="submit" className={primaryButtonClass}>
          Create Account
        </button>
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
