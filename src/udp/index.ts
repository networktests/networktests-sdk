// Public entry: runUdpTest(session, options).
//
// Sequence (must match server/websocket/signaling.js):
//   1. Open WS → server sends `welcome` with optional TURN credentials
//   2. Create RTCPeerConnection (iceServers from session ∪ welcome.turn)
//   3. Create DataChannel (client-initiated, label "test")
//   4. Create offer → send `{ type: "offer", sdp }`
//   5. Receive `answer` → setRemoteDescription
//   6. Trickle ICE in both directions
//   7. Wait for DataChannel to open + server's `datachannel-open` ack
//   8. Send `{ type: "start-packet-test", duration, rate, packetSize }`
//   9. Receive `test-started` → start packet loop (ack incoming packets)
//  10. Receive `test-complete` → close WS, resolve with results
//
// Any "error" message from the server or any unhandled WS/PC close
// rejects the promise with NetworkTestsError.

import { NetworkTestsError, AbortError, TimeoutError } from "../errors.js";
import type {
  UdpSession,
  UdpResult,
  RunUdpOptions,
} from "../types.js";
import {
  createPeerConnection,
  setupDataChannel,
  createOffer,
  applyAnswer,
} from "./webrtc.js";
import { startPacketLoop } from "./packetLoop.js";
import type { ServerMsg, ClientMsg } from "./signaling.js";
import { isServerMsg } from "./signaling.js";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export async function runUdpTest(
  session: UdpSession,
  options: RunUdpOptions = {},
): Promise<UdpResult> {
  const startedAt = Date.now();
  const { signal, onProgress } = options;
  const timeoutMs = options.timeoutMs ?? ((session.duration ?? 30) + 10) * 1000;

  if (signal?.aborted) throw new AbortError();

  const ws = new WebSocket(session.wsUrl);
  ws.binaryType = "arraybuffer";

  let pc: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let packetLoop: ReturnType<typeof startPacketLoop> | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let abortHandler: (() => void) | null = null;

  const cleanup = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
    packetLoop?.stop();
    try { dataChannel?.close(); } catch { /* ignore */ }
    try { pc?.close(); } catch { /* ignore */ }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try { ws.close(); } catch { /* ignore */ }
    }
  };

  return new Promise<UdpResult>((resolve, reject) => {
    const fail = (err: Error) => { cleanup(); reject(err); };
    const succeed = (result: UdpResult) => { cleanup(); resolve(result); };

    timeoutHandle = setTimeout(
      () => fail(new TimeoutError(`UDP test exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
    if (signal) {
      abortHandler = () => fail(new AbortError());
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    const send = (msg: ClientMsg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };

    ws.addEventListener("error", () =>
      fail(new NetworkTestsError("WS_ERROR", "WebSocket error")),
    );

    ws.addEventListener("close", (ev) => {
      // Close before result = unexpected. After resolve we've already
      // cleaned up so this handler is a no-op.
      if (ws.readyState === WebSocket.CLOSED) {
        const reason = ev.reason || `WebSocket closed (code ${ev.code})`;
        fail(new NetworkTestsError("WS_CLOSED", reason));
      }
    });

    ws.addEventListener("open", async () => {
      try {
        // The PC creation waits until the welcome arrives so we can
        // merge server-provided TURN creds into the iceServers list.
      } catch (err) {
        fail(toError(err));
      }
    });

    ws.addEventListener("message", async (ev) => {
      let msg: unknown;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (!isServerMsg(msg)) return;
      const m = msg as ServerMsg;

      try {
        switch (m.type) {
          case "welcome": {
            const iceServers: RTCIceServer[] = [
              ...(session.iceServers ?? DEFAULT_ICE_SERVERS),
            ];
            if (m.turn) {
              iceServers.push({
                urls: m.turn.urls,
                username: m.turn.username,
                credential: m.turn.credential,
              });
            }
            pc = createPeerConnection(iceServers);
            pc.addEventListener("icecandidate", (e) => {
              if (e.candidate) {
                send({ type: "ice-candidate", candidate: e.candidate.toJSON() });
              }
            });
            const dcSetup = setupDataChannel(pc);
            dataChannel = dcSetup.channel;
            const offer = await createOffer(pc);
            send({ type: "offer", sdp: offer.sdp ?? "" });
            // Wait for DC to open then notify server.
            dcSetup.ready
              .then(() => send({ type: "datachannel-ready" }))
              .catch((err) => fail(toError(err)));
            break;
          }

          case "answer": {
            if (!pc) throw new NetworkTestsError("BAD_STATE", "answer before welcome");
            await applyAnswer(pc, m.sdp.sdp);
            break;
          }

          case "ice-candidate": {
            if (!pc) return;
            try { await pc.addIceCandidate(m.candidate); } catch { /* end-of-cands */ }
            break;
          }

          case "datachannel-open": {
            if (!dataChannel) throw new NetworkTestsError("BAD_STATE", "no DC");
            packetLoop = startPacketLoop({ channel: dataChannel, onProgress });
            send({
              type: "start-packet-test",
              duration: session.duration,
              rate: session.rate,
              packetSize: session.packetSize,
            });
            break;
          }

          case "test-started":
            // Server confirmed test parameters; nothing further to do
            // until packets arrive on the DC.
            break;

          case "test-complete": {
            const r = m.results;
            succeed({
              sessionId: session.sessionId,
              packetsSent: r.packetsSent,
              packetsReceived: r.packetsReceived,
              packetsLost: r.packetsLost,
              lossPercent: r.lossPercent,
              jitter: r.jitter,
              latency: {
                avg: r.latency.avg,
                min: r.latency.min,
                max: r.latency.max,
                p50: r.latency.p50,
                p95: r.latency.p95,
                samples: r.latency.samples,
              },
              durationMs: Date.now() - startedAt,
              completedAt: new Date().toISOString(),
            });
            break;
          }

          case "test-stopped":
            fail(new NetworkTestsError("TEST_STOPPED", "Server stopped the test"));
            break;

          case "error":
            fail(new NetworkTestsError("SERVER_ERROR", m.message));
            break;
        }
      } catch (err) {
        fail(toError(err));
      }
    });
  });
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new NetworkTestsError("UNKNOWN", String(value));
}
