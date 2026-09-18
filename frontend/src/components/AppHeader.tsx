"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useTypingStore } from "@/stores/typingStore";
import { useConnectivityStore } from "@/stores/connectivityStore";
import { useApplyTheme } from "@/features/typing/ZenToggle";
import { api } from "@/services/api";
import { AchievementsBadge } from "@/components/AchievementsBadge";
import { ShortcutsHelpModal } from "@/components/ShortcutsHelpModal";
import { useGlobalHotkeys } from "@/hooks/useGlobalHotkeys";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/quicktype", label: "QuickType" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/progress", label: "Progress" },
  { href: "/gamification", label: "Gamification" },
  { href: "/settings", label: "Settings" },
];

const SESSION_PREFIXES = ["/practice", "/recall", "/dictation"];
const HIDDEN_PATHS = ["/", "/login", "/register"];

/* Subtle, non-blocking connectivity pill. Hidden entirely while online with an
 * empty outbox so it never adds noise to the default UI. */
function ConnectivityIndicator() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const pending = useConnectivityStore((s) => s.pendingOutboxCount);
  if (isOnline && pending === 0) return null;

  const label = isOnline
    ? `${pending} resultado${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`
    : pending > 0
      ? `Sin conexión · ${pending} pendiente${pending === 1 ? "" : "s"}`
      : "Sin conexión";

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isOnline
          ? "border-cyan-800 bg-cyan-950/60 text-cyan-300"
          : "border-amber-800 bg-amber-950/60 text-amber-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-cyan-400" : "bg-amber-400 animate-pulse"}`}
      />
      {label}
    </span>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const isFocusMode = useTypingStore((s) => s.isFocusMode);
  const [isOpen, setIsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Mounted on every page, so this is where the saved theme gets applied.
  useApplyTheme();

  useGlobalHotkeys({
    onToggleHelp: () => setIsHelpOpen((prev) => !prev),
    onEscape: () => {
      setIsOpen(false);
      setIsHelpOpen(false);
    },
  });

  if (!token || HIDDEN_PATHS.includes(pathname)) return null;

  if (SESSION_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return (
      <div
        className={`sticky top-0 z-10 bg-black px-6 py-3 border-b border-neutral-900 transition-opacity duration-300 ${
          isFocusMode ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/library"
            className="text-sm text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-2 py-1 inline-flex items-center gap-1 truncate max-w-[85vw] sm:max-w-none"
          >
            ← Salir / Volver a Biblioteca
          </Link>
          <span className="text-xs text-gray-600 font-mono hidden md:block">
            ⌘K — Command Palette
          </span>
          <ConnectivityIndicator />
        </div>
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
      {/* Offline/pending-sync pill lives at header level on mobile so it's visible
          even with the hamburger menu closed; desktop shows it inside the nav. */}
      <div className="md:hidden px-6 pt-2 max-w-3xl mx-auto flex justify-end">
        <ConnectivityIndicator />
      </div>
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
            const isSecondary = link.href === "/settings" || link.href === "/gamification" || link.href === "/vocabulary" || link.href === "/progress";
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={!isSecondary}
                aria-current={active ? "page" : undefined}
                className={`transition-colors ${
                  active ? "text-white font-medium" : "hover:text-white"
                } focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-2 py-1`}
              >
                {link.label}
              </Link>
            );
          })}
          <ConnectivityIndicator />
          <AchievementsBadge />
          {/* A hint, not a control: the palette opens with the keyboard shortcut. */}
          <span className="text-gray-600 font-mono text-xs border border-gray-800 rounded px-1.5 py-0.5" title="Paleta de comandos (⌘K / Ctrl+K)">
            ⌘K
          </span>
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
            <ConnectivityIndicator />
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
      <ShortcutsHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </header>
  );
}
