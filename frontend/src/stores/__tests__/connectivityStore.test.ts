import { beforeEach, describe, expect, it } from "vitest";
import { useConnectivityStore } from "@/stores/connectivityStore";

describe("connectivityStore", () => {
  beforeEach(() => {
    useConnectivityStore.setState({ isOnline: true, pendingOutboxCount: 0 });
  });

  it("defaults to online with an empty outbox", () => {
    const state = useConnectivityStore.getState();
    expect(state.isOnline).toBe(true);
    expect(state.pendingOutboxCount).toBe(0);
  });

  it("tracks online/offline transitions", () => {
    useConnectivityStore.getState().setOnline(false);
    expect(useConnectivityStore.getState().isOnline).toBe(false);
    useConnectivityStore.getState().setOnline(true);
    expect(useConnectivityStore.getState().isOnline).toBe(true);
  });

  it("never lets the pending count go negative", () => {
    useConnectivityStore.getState().setPendingOutboxCount(-3);
    expect(useConnectivityStore.getState().pendingOutboxCount).toBe(0);
    useConnectivityStore.getState().setPendingOutboxCount(4);
    expect(useConnectivityStore.getState().pendingOutboxCount).toBe(4);
  });
});
