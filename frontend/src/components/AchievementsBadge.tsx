"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

export function AchievementsBadge() {
  const token = useAuthStore((s) => s.token);
  const [unseenCount, setUnseenCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    if (typeof api?.getAchievements === "function") {
      api
        .getAchievements()
        .then((items) => {
          if (!mounted) return;
          const count = items.filter((item) => item.unlocked_at && !item.seen).length;
          setUnseenCount(count);
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
    };
  }, [token]);

  return (
    <Link
      href="/achievements"
      className="relative p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none flex items-center gap-1 text-xs font-mono"
      aria-label={
        unseenCount > 0
          ? `${unseenCount} logros nuevos por revisar`
          : "Ver logros y medallas"
      }
      title="Galería de Logros"
    >
      <span aria-hidden="true">🏆</span>
      <span className="hidden sm:inline">Logros</span>
      {unseenCount > 0 && (
        <span
          className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold leading-none text-black bg-amber-400 rounded-full animate-pulse"
          aria-hidden="true"
        >
          {unseenCount}
        </span>
      )}
    </Link>
  );
}
