"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

/** Global floating Quick Practice button available on all non-practice pages.
 * Navigates to /practice/weak-words for adaptive practice based on recent errors. */
export function QuickPractice() {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [isHovered, setIsHovered] = useState(false);

  // Hide on auth pages, during practice, or when not logged in
  const hiddenPrefixes = ["/practice", "/recall", "/dictation", "/login", "/register"];
  const shouldHide =
    !token || pathname === "/" || hiddenPrefixes.some((p) => pathname.startsWith(p));

  if (shouldHide) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/practice/weak-words")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-[var(--accent)] text-black rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
      style={{
        padding: isHovered ? "12px 20px" : "14px",
      }}
      aria-label="Quick Practice — Practice your weak keys and words"
      title="Quick Practice"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      {isHovered && (
        <span className="text-sm font-medium whitespace-nowrap animate-fadeIn">
          Quick Practice
        </span>
      )}
    </button>
  );
}
