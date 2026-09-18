"use client";

/* Service-worker wiring shared by the PWA registry and the connectivity
 * indicator. Kept dependency-free (no workbox) to honor the project's
 * zero-opaque-dependency rule -- sw.js in /public is hand-written. */

export interface ServiceWorkerLike {
  postMessage: (message: unknown) => void;
}

export interface ServiceWorkerContainerLike {
  register: (scriptURL: string) => Promise<unknown>;
  ready: Promise<unknown>;
  controller: unknown;
  addEventListener: (type: string, listener: (event: Event) => void) => void;
}

/** jsdom and non-secure contexts expose no serviceWorker API. */
export function canUseServiceWorker(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function postToServiceWorker(message: unknown): void {
  if (!canUseServiceWorker()) return;
  const container = navigator.serviceWorker as unknown as ServiceWorkerContainerLike;
  const controller = container.controller as ServiceWorkerLike | null;
  if (controller) {
    controller.postMessage(message);
    return;
  }
  // No controller yet (first load): deliver once the worker is ready.
  void container.ready.then((registration) => {
    const active = (registration as { active?: ServiceWorkerLike | null }).active;
    active?.postMessage(message);
  });
}

/** Registers /sw.js. Never rejects -- a failed registration must not break the app. */
export async function registerServiceWorker(): Promise<boolean> {
  if (!canUseServiceWorker()) return false;
  try {
    const container = navigator.serviceWorker as unknown as ServiceWorkerContainerLike;
    await container.register("/sw.js");
    return true;
  } catch {
    return false;
  }
}

/** Warm the SW's IndexedDB audio store so dictation survives a dropped connection. */
export function cacheDictationAudio(sentenceId: string, blob: Blob): void {
  if (!canUseServiceWorker()) return;
  void blob.arrayBuffer().then((buffer) => {
    postToServiceWorker({
      type: "CACHE_DICTATION_AUDIO",
      sentenceId,
      buffer,
      contentType: blob.type || "audio/wav",
    });
  });
}

/** Asks the active SW to relay an outbox-flush request back to all clients. */
export function requestOutboxFlush(): void {
  postToServiceWorker({ type: "REQUEST_OUTBOX_FLUSH" });
}

/** Page -> SW -> every client: how many queued results just synced/remain. */
export function broadcastOutboxSynced(synced: number, remaining: number): void {
  postToServiceWorker({ type: "OUTBOX_SYNCED", synced, remaining });
}
