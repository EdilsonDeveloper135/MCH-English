import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueSessionResult,
  flushOutbox,
  isRetryableSyncError,
  pendingOutboxCount,
  readOutbox,
  OUTBOX_STORAGE_KEY,
} from "@/services/offlineOutbox";
import { ApiError } from "@/services/api";
import { useConnectivityStore } from "@/stores/connectivityStore";

import type { ErrorInput } from "@/types";

const errorInput: ErrorInput = {
  position: 3,
  expected_char: "a",
  typed_char: "e",
  word: "cat",
  sentence_id: "sent-1",
};

const payload = {
  correct_characters: 48,
  incorrect_characters: 2,
  total_characters: 50,
  duration_seconds: 30,
  errors: [errorInput],
};

function mockFinishSessionSequence(...behaviors: Array<"ok" | "network" | "client-error">) {
  const calls: Array<{ sessionId: string }> = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ sessionId: url });
    const behavior = behaviors.shift() ?? "ok";
    if (behavior === "network") throw new TypeError("Failed to fetch");
    if (behavior === "client-error") {
      return new Response(JSON.stringify({ detail: "nope" }), { status: 404 });
    }
    return new Response(
      JSON.stringify({ id: "s", wpm: 60, accuracy: 99, new_achievements: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as unknown as typeof fetch;
  return calls;
}

describe("offlineOutbox", () => {
  beforeEach(() => {
    window.localStorage.removeItem(OUTBOX_STORAGE_KEY);
    useConnectivityStore.setState({ pendingOutboxCount: 0, isOnline: true });
  });

  it("enqueue persists the entry FIFO and updates the connectivity store", () => {
    enqueueSessionResult("s-1", payload);
    enqueueSessionResult("s-2", payload);

    const entries = readOutbox();
    expect(entries.map((e) => e.sessionId)).toEqual(["s-1", "s-2"]);
    expect(entries[0].retries).toBe(0);
    expect(useConnectivityStore.getState().pendingOutboxCount).toBe(2);
  });

  it("flush replays queued results in order and empties the outbox", async () => {
    enqueueSessionResult("s-1", payload);
    enqueueSessionResult("s-2", payload);
    const calls = mockFinishSessionSequence("ok", "ok");

    const result = await flushOutbox();

    expect(result).toEqual({ synced: 2, remaining: 0 });
    expect(calls[0].sessionId).toContain("/sessions/s-1");
    expect(calls[1].sessionId).toContain("/sessions/s-2");
    expect(pendingOutboxCount()).toBe(0);
  });

  it("flush stops on a network error so later entries never overtake earlier ones", async () => {
    enqueueSessionResult("s-1", payload);
    enqueueSessionResult("s-2", payload);
    const calls = mockFinishSessionSequence("network");

    const result = await flushOutbox();

    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(2);
    expect(calls).toHaveLength(1);
    expect(readOutbox()[0].retries).toBe(1);
  });

  it("drops a permanently-rejected entry (4xx) and continues with the next one", async () => {
    enqueueSessionResult("s-bad", payload);
    enqueueSessionResult("s-good", payload);
    mockFinishSessionSequence("client-error", "ok");

    const result = await flushOutbox();

    expect(result.synced).toBe(1);
    expect(pendingOutboxCount()).toBe(0);
  });

  it("concurrent flushes share a single in-flight pass", async () => {
    enqueueSessionResult("s-1", payload);
    mockFinishSessionSequence("ok");
    const [a, b] = await Promise.all([flushOutbox(), flushOutbox()]);
    expect(a).toEqual(b);
  });

  it("isRetryableSyncError treats network failures and 5xx as retryable, 4xx as permanent", () => {
    expect(isRetryableSyncError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableSyncError(new ApiError(503, "down"))).toBe(true);
    expect(isRetryableSyncError(new ApiError(404, "gone"))).toBe(false);
    expect(isRetryableSyncError(new ApiError(401, "expired"))).toBe(false);
  });
});
