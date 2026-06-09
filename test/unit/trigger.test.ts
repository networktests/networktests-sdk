import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triggerDnsResolution } from "../../src/dnsleak/trigger.js";

describe("triggerDnsResolution", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("resolves when the image onload fires", async () => {
    const ImgMock = vi.fn(() => {
      const handlers: { onload: (() => void) | null; onerror: (() => void) | null } =
        { onload: null, onerror: null };
      const img = Object.defineProperties({}, {
        src: {
          set() { queueMicrotask(() => handlers.onload?.()); },
        },
        onload: {
          set(fn: () => void) { handlers.onload = fn; },
        },
        onerror: {
          set(fn: () => void) { handlers.onerror = fn; },
        },
      });
      return img;
    });
    vi.stubGlobal("Image", ImgMock);

    const p = triggerDnsResolution("abc.dns.networktests.com");
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(ImgMock).toHaveBeenCalledTimes(1);
  });

  it("resolves when aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(triggerDnsResolution("x.dns.networktests.com", ctrl.signal)).resolves.toBeUndefined();
  });
});
