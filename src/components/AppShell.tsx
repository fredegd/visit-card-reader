import Link from "next/link";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "New Upload", href: "/cards/new" },
];

export default function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sand-100 text-ink-900">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-32 top-16 h-72 w-72 rounded-full bg-coral-200 blur-[110px]" />
        <div className="absolute right-10 top-40 h-80 w-80 rounded-full bg-ocean-200 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-moss-200 blur-[110px]" />
      </div>

      <header className="relative z-10 border-b border-ink-200/60 bg-sand-100/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-ink-900 text-sand-100">
              VC
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Visit Cards</p>
              <p className="text-xs text-ink-500">MVP workspace</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-600 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-ink-900">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-ink-500 md:inline">
              {user.email ?? "Signed in"}
            </span>
            <Link
              href="/logout"
              className="rounded-full border border-ink-200/70 px-4 py-2 text-ink-700 transition hover:border-ink-400 hover:text-ink-900"
            >
              Sign out
            </Link>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 pb-4 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 rounded-full border border-ink-200/70 px-4 py-2 text-center text-xs font-semibold text-ink-700"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-ink-200/60 bg-sand-100/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 text-xs text-ink-500">
          <span>OCR powered by Mistral OCR 3</span>
          <span>Local MVP · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
