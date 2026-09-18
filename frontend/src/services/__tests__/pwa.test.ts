import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canUseServiceWorker, postToServiceWorker } from "@/services/pwa";

interface FakeContainer {
  controller: { postMessage: ReturnType<typeof vi.fn> } | null;
  ready: Promise<{ active: { postMessage: ReturnType<typeof vi.fn> } | null }>;
}

function installServiceWorker(container: FakeContainer | undefined) {
  if (container === undefined) {
    delete (globalThis.navigator as unknown as Record<string, unknown>).serviceWorker;
    return;
  }
  Object.defineProperty(globalThis.navigator, "serviceWorker", {
    value: container,
    configurable: true,
    writable: true,
  });
}

describe("pwa service", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "serviceWorker");

  beforeEach(() => {
    installServiceWorker(undefined);
  });

  afterEach(() => {
    if (original) Object.defineProperty(globalThis.navigator, "serviceWorker", original);
    else delete (globalThis.navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  it("canUseServiceWorker is false when the API is missing (jsdom)", () => {
    expect(canUseServiceWorker()).toBe(false);
  });

  it("canUseServiceWorker is true when the API exists", () => {
    installServiceWorker({
      controller: null,
      ready: Promise.resolve({ active: null }),
    });
    expect(canUseServiceWorker()).toBe(true);
  });

  it("postToServiceWorker no-ops without the API instead of throwing", () => {
    expect(() => postToServiceWorker({ type: "REQUEST_OUTBOX_FLUSH" })).not.toThrow();
  });

  it("posts straight to the active controller when one exists", () => {
    const postMessage = vi.fn();
    installServiceWorker({
      controller: { postMessage },
      ready: Promise.resolve({ active: null }),
    });

    postToServiceWorker({ type: "REQUEST_OUTBOX_FLUSH" });

    expect(postMessage).toHaveBeenCalledWith({ type: "REQUEST_OUTBOX_FLUSH" });
  });

  it("falls back to registration.active when there is no controller yet", async () => {
    const postMessage = vi.fn();
    installServiceWorker({
      controller: null,
      ready: Promise.resolve({ active: { postMessage } }),
    });

    postToServiceWorker({ type: "OUTBOX_SYNCED", synced: 2, remaining: 0 });
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith({ type: "OUTBOX_SYNCED", synced: 2, remaining: 0 });
  });
});
