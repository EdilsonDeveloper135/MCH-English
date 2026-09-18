"use client";

import { useEffect } from "react";
import { useConnectivityStore } from "@/stores/connectivityStore";
import { flushOutbox, syncPendingCount, OUTBOX_CHANGED_EVENT } from "@/services/offlineOutbox";
import { registerServiceWorker } from "@/services/pwa";

/* Owns everything the PWA layer needs exactly once per tab: SW registration,
 * online/offline tracking, outbox flushing on reconnect, and cross-tab outbox
 * sync messages relayed by the SW. Rendered via ClientOverlays (ssr: false),
 * so browser APIs are safe to touch inside effects. */
export function PwaRegistry() {
  useEffect(() => {
    void registerServiceWorker();
    syncPendingCount();

    const handleOnline = () => {
      useConnectivityStore.getState().setOnline(true);
      void flushOutbox();
    };
    const handleOffline = () => {
      useConnectivityStore.getState().setOnline(false);
    };
    const handleStorage = (event: StorageEvent) => {
      // Another tab mutated the outbox -- keep this tab's badge in step.
      if (event.key && event.key.includes("outbox")) syncPendingCount();
    };
    const handleOutboxChanged = () => syncPendingCount();
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined;
      if (!data || typeof data !== "object") return;
      if (data.type === "OUTBOX_SYNC_REQUESTED") {
        void flushOutbox();
      } else if (data.type === "OUTBOX_SYNCED") {
        syncPendingCount();
      }
    };

    handleOnline();
    if (typeof navigator !== "undefined" && !navigator.onLine) handleOffline();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(OUTBOX_CHANGED_EVENT, handleOutboxChanged);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(OUTBOX_CHANGED_EVENT, handleOutboxChanged);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      }
    };
  }, []);

  return null;
}
