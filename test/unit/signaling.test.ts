import { describe, it, expect } from "vitest";
import { isServerMsg } from "../../src/udp/signaling.js";

describe("isServerMsg", () => {
  it("accepts well-formed messages", () => {
    expect(isServerMsg({ type: "welcome", clientId: "abc" })).toBe(true);
    expect(isServerMsg({ type: "answer", sdp: { type: "answer", sdp: "v=0\r\n" } })).toBe(true);
    expect(isServerMsg({ type: "test-complete", test: "packet-loss", results: {} })).toBe(true);
  });

  it("rejects junk", () => {
    expect(isServerMsg(null)).toBe(false);
    expect(isServerMsg(undefined)).toBe(false);
    expect(isServerMsg("welcome")).toBe(false);
    expect(isServerMsg(42)).toBe(false);
    expect(isServerMsg({})).toBe(false);
    expect(isServerMsg({ type: 42 })).toBe(false);
  });
});
