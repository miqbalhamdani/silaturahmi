import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — Silaturahmi",
};

// searchParams is a Promise in Next 16. Reading ?error= here rather than with
// useSearchParams in the client keeps the form out of a Suspense boundary.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm callbackError={error} />;
}
