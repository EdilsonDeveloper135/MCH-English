"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/progress", label: "Progress" },
  { href: "/gamification", label: "Gamification" },
];

const SESSION_PREFIXES = ["/practice", "/recall", "/dictation"];
const HIDDEN_PATHS = ["/", "/login", "/register"];

export function AppHeader() {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!token || HIDDEN_PATHS.includes(pathname)) return null;

  if (SESSION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return (
      <div className="sticky top-0 z-10 bg-black px-6 py-3 border-b border-neutral-900">
        <Link
          href="/library"
          className="text-sm text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-2 py-1 inline-block"
        >
          ← Salir / Volver a Biblioteca
        </Link>
      </div>
    );
  }

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await api.logout();
    } catch {
      // token may already be expired or network offline
    } finally {
      logout();
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-black border-b border-neutral-900">
      <div className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto text-sm relative">
        <Link
          href="/library"
          className="text-white font-semibold focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-1 py-0.5"
        >
          MCH English
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4 text-gray-400" aria-label="Navegación principal">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`transition-colors ${
                  active ? "text-white font-medium" : "hover:text-white"
                } focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-2 py-1`}
              >
                {link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-2 py-1"
          >
            Salir
          </button>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          className="md:hidden text-gray-400 hover:text-white p-2 rounded focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Mobile Dropdown Panel */}
        {isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación móvil"
            className="md:hidden absolute top-full left-0 right-0 bg-neutral-950/98 backdrop-blur border-b border-neutral-800 px-6 py-4 flex flex-col gap-2 z-50 shadow-2xl"
          >
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`min-h-[48px] flex items-center px-4 rounded-lg text-base ${
                    active
                      ? "bg-neutral-800 text-white font-medium"
                      : "text-gray-300 hover:bg-neutral-900 hover:text-white"
                  } focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[48px] flex items-center px-4 rounded-lg text-base text-red-400 hover:bg-neutral-900 hover:text-red-300 text-left focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

