import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-rpg-gold mb-8">
          Create Account
        </h1>
        <RegisterForm />
        <p className="mt-4 text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-rpg-gold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
