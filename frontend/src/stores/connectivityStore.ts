"use client";

import { create } from "zustand";

/* Connectivity is global UI state (header pill + practice-page banner), so it
 * lives in a store instead of being re-derived by every consumer. Events are
 * bound once by <PwaRegistry>; the store itself stays pure and testable. */

interface ConnectivityState {
  /** Mirrors navigator.onLine; SSR-safe default is "online". */
  isOnline: boolean;
  /** Queued practice results waiting to be replayed to the backend. */
  pendingOutboxCount: number;
  setOnline: (online: boolean) => void;
  setPendingOutboxCount: (count: number) => void;
}

export const useConnectivityStore = create<ConnectivityState>()((set) => ({
  isOnline: true,
  pendingOutboxCount: 0,
  setOnline: (online) => set({ isOnline: online }),
  setPendingOutboxCount: (count) => set({ pendingOutboxCount: Math.max(0, count) }),
}));
