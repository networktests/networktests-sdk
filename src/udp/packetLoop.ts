// DataChannel side of the packet-loss test.
//
// Server drives the test: it pushes packets at the configured rate, we
// ack each one back. Server tracks send/ack timestamps and computes
// loss + latency, then ships the final result via the WebSocket as
// `test-complete`.
//
// Local job here is:
//   1. Decode incoming server packets ({ type: "packet", seq, p? })
//   2. Send ack back over DC ({ type: "ack", seq })
//   3. Surface progress to the caller (sent/received/loss%/elapsed)

import type { UdpProgress } from "../types.js";

export interface PacketLoopHandle {
  /** Stop ack'ing future packets. Safe to call multiple times. */
  stop(): void;
}

export interface PacketLoopOptions {
  channel: RTCDataChannel;
  onProgress?: (progress: UdpProgress) => void;
  /** Throttle progress callbacks to once per this many ms (default 100). */
  progressIntervalMs?: number;
}

export function startPacketLoop(opts: PacketLoopOptions): PacketLoopHandle {
  const { channel, onProgress } = opts;
  const progressMs = opts.progressIntervalMs ?? 100;
  const startTs = Date.now();

  // Server sends them; we count locally for the onProgress callback.
  // The server's count is the source of truth in the final result.
  let received = 0;
  // We don't know what the server has sent (it tracks that side), but
  // we surface "received" as the progress signal. lossPercent below is
  // a coarse local estimate based on expected packets per second; we
  // intentionally don't try to be exact — the server's final number is.
  let highestSeq = -1;
  let stopped = false;

  const onMsg = (ev: MessageEvent<string>) => {
    if (stopped) return;
    try {
      const msg = JSON.parse(ev.data);
      if (msg && msg.type === "packet" && typeof msg.seq === "number") {
        received++;
        if (msg.seq > highestSeq) highestSeq = msg.seq;
        // Fire-and-forget ack. Send may throw if DC closed mid-flight;
        // silently drop — the server handles the missing ack as a lost
        // packet which is the same as a real network loss.
        try {
          channel.send(JSON.stringify({ type: "ack", seq: msg.seq }));
        } catch { /* DC closed; loop will exit when WS closes */ }
      }
    } catch { /* malformed packet — ignore */ }
  };

  channel.addEventListener("message", onMsg);

  let progressTimer: ReturnType<typeof setInterval> | null = null;
  if (onProgress) {
    progressTimer = setInterval(() => {
      if (stopped) return;
      // highestSeq is 0-indexed; +1 gives count of packets the server
      // has sent us. lossPercent is locally estimated and approximate;
      // server emits the authoritative number in test-complete.
      const sent = highestSeq + 1;
      const loss = sent > 0 ? ((sent - received) / sent) * 100 : 0;
      onProgress({
        packetsSent: sent,
        packetsReceived: received,
        lossPercent: Math.round(loss * 100) / 100,
        elapsedMs: Date.now() - startTs,
      });
    }, progressMs);
  }

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      channel.removeEventListener("message", onMsg);
      if (progressTimer) clearInterval(progressTimer);
    },
  };
}
