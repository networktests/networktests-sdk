// Public types for @networktests/sdk.
//
// These mirror the shapes returned by api.networktests.com/v1 — the
// customer's backend calls POST /v1/probe/.../sessions, gets one of the
// session objects below, and ships it to its frontend, where the SDK
// consumes it. The SDK never sees the API key.

/**
 * UDP throughput probe session. Returned by the customer's backend from
 * `POST /v1/probe/udp/sessions` on api.networktests.com.
 *
 * The frontend passes this to `nt.runUdpTest(session)`.
 */
export interface UdpSession {
  /** Opaque session ticket. Single-use; valid for ~30 minutes. */
  sessionId: string;
  /** WebSocket URL the SDK must connect to (region-pinned). */
  wsUrl: string;
  /** ICE servers to seed the RTCPeerConnection. Server may override via `welcome` message. */
  iceServers?: RTCIceServer[];
  /** Test duration in seconds (defaults to server config). */
  duration?: number;
  /** Packet rate (packets per second). */
  rate?: number;
  /** Packet size in bytes (max 1400). */
  packetSize?: number;
}

/**
 * DNS leak probe session. Returned by `POST /v1/probe/dns-leak/sessions`.
 *
 * The SDK iterates `fqdns` and triggers DNS resolution of each one. Our
 * authoritative DNS server records which recursive resolver did the
 * lookup; the customer's backend later calls
 * `GET /v1/probe/dns-leak/sessions/:id` to retrieve the resolver list.
 */
export interface DnsLeakSession {
  sessionId: string;
  fqdns: string[];
}

export interface LatencyStats {
  /** Mean RTT in milliseconds. */
  avg: number;
  min: number;
  max: number;
  /** 50th percentile. */
  p50: number;
  /** 95th percentile. */
  p95: number;
  /** Down-sampled to 200 evenly-spaced points across the full test. */
  samples?: number[];
}

export interface UdpResult {
  sessionId: string;
  packetsSent: number;
  packetsReceived: number;
  packetsLost: number;
  /** Packet loss percentage (0-100). */
  lossPercent: number;
  /** Inter-packet arrival jitter, in ms. */
  jitter: number;
  latency: LatencyStats;
  /** Total test duration in ms (wall clock from WS open to result). */
  durationMs: number;
  completedAt: string;
}

export interface UdpProgress {
  packetsSent: number;
  packetsReceived: number;
  lossPercent: number;
  elapsedMs: number;
}

export interface RunUdpOptions {
  /** Per-packet progress callback. Fires ~10x/sec, debounced. */
  onProgress?: (progress: UdpProgress) => void;
  /** AbortSignal — abort cancels the test cleanly (closes WS + DC). */
  signal?: AbortSignal;
  /** Hard timeout in ms. Defaults to (session.duration + 10) * 1000. */
  timeoutMs?: number;
}

export interface RunDnsLeakOptions {
  /** Called after each FQDN trigger resolves or errors. */
  onResolved?: (fqdn: string) => void;
  /** AbortSignal — cancels any in-flight image/fetch triggers. */
  signal?: AbortSignal;
  /** Hard timeout in ms. Default 15000. */
  timeoutMs?: number;
}
