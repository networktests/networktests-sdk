import { describe, it, expect } from "vitest";
import { NetworkTestsError, AbortError, TimeoutError } from "../../src/errors.js";

describe("error classes", () => {
  it("NetworkTestsError carries code + message", () => {
    const e = new NetworkTestsError("WS_ERROR", "boom");
    expect(e.code).toBe("WS_ERROR");
    expect(e.message).toBe("boom");
    expect(e.name).toBe("NetworkTestsError");
    expect(e).toBeInstanceOf(Error);
  });

  it("AbortError inherits from NetworkTestsError with code ABORTED", () => {
    const e = new AbortError();
    expect(e).toBeInstanceOf(NetworkTestsError);
    expect(e.code).toBe("ABORTED");
    expect(e.name).toBe("AbortError");
  });

  it("TimeoutError inherits from NetworkTestsError with code TIMEOUT", () => {
    const e = new TimeoutError("too slow");
    expect(e).toBeInstanceOf(NetworkTestsError);
    expect(e.code).toBe("TIMEOUT");
    expect(e.message).toBe("too slow");
  });
});
