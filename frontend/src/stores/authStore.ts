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
  setAuth: (token: string, email: string) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      hasHydrated: false,
      setAuth: (token, email) => set({ token, email }),
      logout: () => set({ token: null, email: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "mch-english-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
