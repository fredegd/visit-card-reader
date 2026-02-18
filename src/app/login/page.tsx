"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success">(
    "idle",
  );
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus("loading");

    const action = mode === "signup" ? "signUp" : "signInWithPassword";

    const { error } = await supabase.auth[action]({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }

    setStatus("success");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-sand-100 text-ink-900">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-32 top-16 h-72 w-72 rounded-full bg-coral-200 blur-[110px]" />
        <div className="absolute right-10 top-40 h-80 w-80 rounded-full bg-ocean-200 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-moss-200 blur-[110px]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-6">
        <form
          onSubmit={handleSubmit}
          className="grid w-full gap-6 rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-soft"
        >
          <div>
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="text-sm text-ink-500">
              Sign in or create an account to manage your cards.
            </p>
          </div>

          <div className="flex rounded-full border border-ink-200/70 bg-sand-50 p-1">
            {[
              { label: "Sign in", value: "signin" },
              { label: "Sign up", value: "signup" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value as "signin" | "signup")}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 text-xs font-semibold",
                  mode === item.value
                    ? "bg-ink-900 text-sand-100"
                    : "text-ink-600",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="grid gap-1 text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
              required
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-sand-100"
            disabled={status === "loading"}
          >
            {status === "loading"
              ? "Working..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
