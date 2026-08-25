// Shared presentational bits for the auth pages. These pages are always
// light (white background) regardless of the app's .dark class, so colors
// are the light-palette values written out explicitly.
export const inputClass =
  "h-13 w-full rounded-full border border-[#e7dfd2] bg-white px-6 text-base text-[#2c2418] placeholder:text-[#a99e8c] focus-visible:outline-[#3d5a3c]";

export const labelClass = "mb-2 block text-sm font-semibold text-[#2c2418]";

export const primaryButtonClass =
  "h-13 w-full rounded-full bg-[#3d5a3c] text-base font-semibold text-[#fffdf9] transition-colors hover:bg-[#334c32]";

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-4">
      <span className="h-px flex-1 bg-[#e7dfd2]" />
      <span className="text-sm text-[#6b5f4e]">Or continue with</span>
      <span className="h-px flex-1 bg-[#e7dfd2]" />
    </div>
  );
}

export function GoogleButton() {
  return (
    <button
      type="button"
      className="flex h-13 w-full items-center justify-center gap-3 rounded-full border border-[#e7dfd2] bg-white text-base font-semibold text-[#2c2418] transition-colors hover:bg-[#faf7f2]"
    >
      <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
        />
      </svg>
      Continue with Google
    </button>
  );
}
