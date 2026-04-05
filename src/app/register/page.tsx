import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-poe-void flex flex-col">
      {/* Header bar */}
      <div className="poe-header">
        <div className="poe-ornate-border" />
        <div className="h-14 flex items-center justify-center px-6">
          <Link href="/" className="font-cinzel text-lg font-bold text-poe-gold-bright tracking-wider">
            SKILLTREE
          </Link>
        </div>
        <div className="poe-ornate-border" />
      </div>

      {/* Centered form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-cinzel text-3xl font-bold text-poe-text-primary mb-8">Create Account</h1>
          <RegisterForm />
          <p className="mt-6 text-sm text-poe-text-dim">
            Already have an account?{" "}
            <Link href="/login" className="text-poe-gold-mid hover:text-poe-gold-bright transition">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
