import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  email: string | null;
  // Zustand's persist middleware reads localStorage asynchronously relative to the
  // first render (to avoid Next.js hydration mismatches), so `token` is briefly
  // null even for an already-logged-in user. Pages must wait for `hasHydrated`
  // before treating a null token as "not logged in".
  hasHydrated: boolean;
  // Set when api.ts's request() sees a 401 (expired/revoked token), so the login
  // page can explain *why* the user landed there instead of an unexplained redirect.
  sessionExpiredMessage: string | null;
  setAuth: (token: string, email: string) => void;
  logout: (sessionExpiredMessage?: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      hasHydrated: false,
      sessionExpiredMessage: null,
      setAuth: (token, email) => set({ token, email, sessionExpiredMessage: null }),
      logout: (sessionExpiredMessage) => set({ token: null, email: null, sessionExpiredMessage: sessionExpiredMessage ?? null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "mch-english-auth",
      // sessionExpiredMessage is a one-shot UI signal, not account state -- it must
      // not survive a browser restart and reappear on an unrelated future login.
      partialize: (state) => ({ token: state.token, email: state.email }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
