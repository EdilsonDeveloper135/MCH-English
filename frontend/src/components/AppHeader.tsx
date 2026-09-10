"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/progress", label: "Progress" },
  { href: "/gamification", label: "Gamification" },
];

// Practice/Recall/Dictation are full-screen typing sessions -- the full nav would
// just be one more thing competing for attention while typing, so they get a single
// unobtrusive way back out instead (still always available, per the audit).
const SESSION_PREFIXES = ["/practice", "/recall", "/dictation"];

const HIDDEN_PATHS = ["/", "/login", "/register"];

export function AppHeader() {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  if (!token || HIDDEN_PATHS.includes(pathname)) return null;

  if (SESSION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return (
      <div className="sticky top-0 z-10 bg-black px-6 py-3">
        <Link href="/library" className="text-sm text-gray-400 hover:text-white">
          ← Salir / Volver a Biblioteca
        </Link>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-10 bg-black flex items-center justify-between px-6 py-4 max-w-3xl mx-auto text-sm">
      <Link href="/library" className="text-white font-semibold">
        MCH English
      </Link>
      <nav className="flex items-center gap-4 text-gray-400">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={active ? "text-white" : "hover:text-white"}
            >
              {link.label}
            </Link>
          );
        })}
        <button onClick={logout} className="hover:text-white">
          Salir
        </button>
      </nav>
    </header>
  );
}
