// RTCPeerConnection wrapper. Encapsulates the offer/answer/ICE dance.
//
// Browser-native WebRTC only — no shims. The server uses `werift` and
// speaks vanilla SDP, so any modern browser RTC stack interoperates.

import { NetworkTestsError } from "../errors.js";

export interface WebrtcSession {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  /** Resolves once the DataChannel is open. */
  ready: Promise<void>;
  close: () => void;
}

export function createPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers });
}

export function setupDataChannel(pc: RTCPeerConnection): {
  channel: RTCDataChannel;
  ready: Promise<void>;
} {
  // Server expects a client-initiated DataChannel. Label "test" matches
  // what the consumer site has always used; server doesn't filter on it
  // but keeping it stable simplifies the wire trace.
  const channel = pc.createDataChannel("test", { ordered: false });

  const ready = new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new NetworkTestsError("DC_ERROR", "DataChannel error before open"));
    };
    const onClose = () => {
      cleanup();
      reject(new NetworkTestsError("DC_CLOSED", "DataChannel closed before open"));
    };
    function cleanup() {
      channel.removeEventListener("open", onOpen);
      channel.removeEventListener("error", onError);
      channel.removeEventListener("close", onClose);
    }
    channel.addEventListener("open", onOpen);
    channel.addEventListener("error", onError);
    channel.addEventListener("close", onClose);
  });

  return { channel, ready };
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function applyAnswer(
  pc: RTCPeerConnection,
  sdp: string,
): Promise<void> {
  await pc.setRemoteDescription({ type: "answer", sdp });
}
