import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";
import { useAuthStore } from "@/stores/authStore";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
  } as Response;
}

describe("api error handling", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, email: null, sessionExpiredMessage: null });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("formats a FastAPI/Pydantic validation error (array detail) into a readable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          detail: [{ msg: "String should have at least 8 characters", loc: ["body", "password"] }],
        })
      )
    );

    await expect(api.login("a@b.com", "short")).rejects.toMatchObject({
      message: "String should have at least 8 characters",
      status: 422,
    });
  });

  it("passes a plain-string detail (ordinary HTTPException) through untouched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { detail: "Invalid email or password" })));

    await expect(api.login("a@b.com", "wrong")).rejects.toMatchObject({
      message: "Invalid email or password",
      status: 401,
    });
  });

  it("does not trigger the session-expired interceptor for an unauthenticated request (e.g. a failed login)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { detail: "Invalid email or password" })));

    await expect(api.login("a@b.com", "wrong")).rejects.toBeInstanceOf(ApiError);

    // A wrong password must never be reinterpreted as "your session expired" --
    // that would hide the real error and clear a token that was never invalid.
    expect(useAuthStore.getState().sessionExpiredMessage).toBeNull();
  });

  it("logs the user out and surfaces an informative message when an authenticated request gets a 401", async () => {
    useAuthStore.setState({ token: "some-token", email: "a@b.com" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { detail: "Could not validate credentials" })));

    await expect(api.getVocabulary()).rejects.toBeInstanceOf(ApiError);

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().sessionExpiredMessage).toBe("Tu sesion expiro. Inicia sesion de nuevo.");
  });

  it("falls back to the response statusText when the error body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("no body")),
      } as unknown as Response)
    );

    await expect(api.getVocabulary()).rejects.toMatchObject({ message: "Internal Server Error", status: 500 });
  });
});

describe("api.lookupWord caching", () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, email: null, sessionExpiredMessage: null });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("caches a found word and does not re-fetch it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { word: "run", translations: "correr" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await api.lookupWord("run")).toBe("correr");
    expect(await api.lookupWord("run")).toBe("correr");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches a 404 (word not in the dictionary) so repeating the same typo doesn't re-fetch either", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { detail: "Not found" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await api.lookupWord("zzz")).toBeNull();
    expect(await api.lookupWord("zzz")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
