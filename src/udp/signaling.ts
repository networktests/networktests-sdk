// WebSocket protocol contract with server/websocket/signaling.js on the
// networktests.com API server. Keep these in lockstep with the server.

export interface WelcomeMsg {
  type: "welcome";
  clientId: string;
  turn?: { urls: string[]; username: string; credential: string };
}

export interface AnswerMsg {
  type: "answer";
  /** Server wraps the SDP in a nested object. */
  sdp: { type: "answer"; sdp: string };
}

export interface IceCandidateMsg {
  type: "ice-candidate";
  candidate: RTCIceCandidateInit;
}

export interface DataChannelOpenMsg { type: "datachannel-open"; }
export interface TestStartedMsg {
  type: "test-started";
  test: "packet-loss";
  duration: number;
  rate: number;
  packetSize: number;
}
export interface TestStoppedMsg { type: "test-stopped"; }
export interface ErrorMsg { type: "error"; message: string; }

export interface TestCompleteMsg {
  type: "test-complete";
  test: "packet-loss";
  results: {
    packetsSent: number;
    packetsReceived: number;
    packetsLost: number;
    lossPercent: number;
    uploadReceived: number;
    latency: {
      avg: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      samples?: number[];
    };
    jitter: number;
  };
}

export type ServerMsg =
  | WelcomeMsg
  | AnswerMsg
  | IceCandidateMsg
  | DataChannelOpenMsg
  | TestStartedMsg
  | TestStoppedMsg
  | TestCompleteMsg
  | ErrorMsg;

export type ClientMsg =
  | { type: "offer"; sdp: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "datachannel-ready" }
  | { type: "start-packet-test"; duration?: number; rate?: number; packetSize?: number }
  | { type: "stop-test" };

/** Type guard for runtime ServerMsg validation. */
export function isServerMsg(value: unknown): value is ServerMsg {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
