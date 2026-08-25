import type { Metadata } from "next";
import RegisterForm from "./register-form";

export const metadata: Metadata = {
  title: "Create account — Silaturahmi",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
