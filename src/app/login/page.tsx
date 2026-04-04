import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-rpg-gold mb-8">Sign In</h1>
        <LoginForm />
        <p className="mt-4 text-sm text-slate-400">
          No account?{" "}
          <Link href="/register" className="text-rpg-gold hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
