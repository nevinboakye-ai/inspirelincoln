import { afterEach, describe, expect, it, vi } from "vitest";
import { timedFetch } from "@/lib/supabase/timed-fetch";

afterEach(() => vi.unstubAllGlobals());

/** A fetch that never answers unless it is aborted, like an overloaded database. */
function hangingFetch() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    }),
  );
}

describe("timedFetch", () => {
  it("gives up on a request that hangs", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    await expect(timedFetch(50)("https://example.test")).rejects.toThrow();
  });

  it("still honours the caller's own abort", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const own = new AbortController();
    const p = timedFetch(10_000)("https://example.test", { signal: own.signal });
    own.abort(new Error("caller stopped"));
    await expect(p).rejects.toThrow("caller stopped");
  });

  it("passes a quick answer straight through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    const res = await timedFetch(1000)("https://example.test");
    expect(await res.text()).toBe("ok");
  });
});
