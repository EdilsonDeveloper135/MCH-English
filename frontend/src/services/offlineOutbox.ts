"use client";

/* Offline outbox for finished practice sessions.
 *
 * When the PATCH /sessions/:id call fails because the network is down, the
 * payload is persisted here (localStorage, FIFO) and replayed in order once
 * connectivity returns. The store name is versioned in the key so a future
 * schema change never replays stale shapes. */

import type { ErrorInput } from "@/types";
import { api, ApiError } from "@/services/api";
import { useConnectivityStore } from "@/stores/connectivityStore";
import { broadcastOutboxSynced } from "@/services/pwa";

export const OUTBOX_STORAGE_KEY = "mch-english-session-outbox-v1";
export const OUTBOX_CHANGED_EVENT = "mch-outbox-changed";
const MAX_RETRIES = 5;

export interface OutboxEntry {
  id: string;
  sessionId: string;
  payload: {
    correct_characters: number;
    incorrect_characters: number;
    total_characters: number;
    duration_seconds: number;
    errors: ErrorInput[];
  };
  queuedAt: string;
  retries: number;
}

function canUseStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function readOutbox(): OutboxEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is OutboxEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as OutboxEntry).sessionId === "string" &&
        typeof (e as OutboxEntry).payload === "object"
    );
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(entries));
  const count = entries.length;
  useConnectivityStore.getState().setPendingOutboxCount(count);
  window.dispatchEvent(new CustomEvent(OUTBOX_CHANGED_EVENT, { detail: { count } }));
}

export function pendingOutboxCount(): number {
  return readOutbox().length;
}

/** Re-syncs the store + listeners with whatever is currently persisted. */
export function syncPendingCount(): void {
  useConnectivityStore.getState().setPendingOutboxCount(pendingOutboxCount());
}

function newEntryId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** True for network failures / 5xx -- the cases where replaying later is correct. */
export function isRetryableSyncError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500;
  return true; // fetch TypeError ("Failed to fetch") and friends
}

export function enqueueSessionResult(sessionId: string, payload: OutboxEntry["payload"]): OutboxEntry {
  const entry: OutboxEntry = {
    id: newEntryId(),
    sessionId,
    payload,
    queuedAt: new Date().toISOString(),
    retries: 0,
  };
  writeOutbox([...readOutbox(), entry]);
  return entry;
}

export interface FlushResult {
  synced: number;
  remaining: number;
}

let flushInFlight: Promise<FlushResult> | null = null;

/**
 * Replays queued results FIFO. A retryable failure stops the flush so later
 * entries never overtake an earlier one (server-side session order matters
 * for streak/XP math). A permanent failure (4xx) drops the entry after
 * MAX_RETRIES attempts so one bad payload can't jam the queue forever.
 */
export function flushOutbox(): Promise<FlushResult> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = doFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function doFlush(): Promise<FlushResult> {
  let synced = 0;
  let entries = readOutbox();

  while (entries.length > 0) {
    const entry = entries[0];
    try {
      await api.finishSession(entry.sessionId, entry.payload);
      synced += 1;
      entries = entries.slice(1);
      writeOutbox(entries);
    } catch (err) {
      if (isRetryableSyncError(err)) {
        entry.retries += 1;
        if (entry.retries > MAX_RETRIES) {
          entries = entries.slice(1);
          writeOutbox(entries);
          continue;
        }
        writeOutbox(entries); // persist bumped retry counter
        break; // still offline or server down -- try again on next reconnect
      }
      // Permanent rejection (e.g. session already finished server-side): drop it.
      entries = entries.slice(1);
      writeOutbox(entries);
    }
  }

  const result = { synced, remaining: entries.length };
  if (synced > 0) broadcastOutboxSynced(synced, entries.length);
  return result;
}
