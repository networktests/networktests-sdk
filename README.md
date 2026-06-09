# @networktests/sdk

Browser SDK for the [networktests.com API](https://api.networktests.com/v1/docs). Run UDP throughput tests and DNS-leak probes from your frontend without reimplementing WebRTC signaling or DNS query orchestration.

```
npm install @networktests/sdk
```

## Why an SDK?

Two of the endpoints on `api.networktests.com/v1/*` need cooperation from the end-user's browser:

- **UDP throughput** requires a WebRTC DataChannel — the browser pushes thousands of packets through it so we can measure loss, latency, and jitter from the path your customer's network actually uses.
- **DNS leak** requires the browser to resolve 10 short-lived FQDNs so our authoritative DNS server can record which recursive resolver each query hit.

The SDK hides this. Your application code stays a few lines.

## Security model

**The SDK never sees your API key.**

```
┌──────────────────────────────┐         ┌────────────────────────────┐
│   Your backend               │  HTTPS  │  api.networktests.com      │
│   (holds the API key)        │  ────▶  │  POST /v1/probe/udp/       │
│                              │  ◀────  │       sessions             │
│   POST /v1/probe/udp/        │         │  → { sessionId, wsUrl }    │
│        sessions              │         └────────────────────────────┘
└──────┬───────────────────────┘
       │ session (opaque ticket)
       ▼
┌──────────────────────────────┐         ┌────────────────────────────┐
│   Your frontend              │   WSS   │  api.networktests.com      │
│   (this SDK)                 │  ────▶  │  /ws/v1/probe/udp/<id>     │
│   nt.runUdpTest(session)     │         └────────────────────────────┘
└──────────────────────────────┘
```

Your backend mints a single-use session ticket via the authenticated API and ships it to the browser. The SDK uses the ticket to talk to our signaling server. Same shape as Stripe Elements, Twilio, or 100ms — frontend SDKs never hold long-lived secrets.

## Quickstart — UDP throughput

**Backend** (any language, here in Node):

```js
const r = await fetch("https://api.networktests.com/v1/probe/udp/sessions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ntsk_live_…",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ duration: 10, rate: 200, packetSize: 256 }),
});
const { data } = await r.json();
// → { sessionId, wsUrl, iceServers, duration, rate, packetSize }
res.json(data);
```

**Frontend**:

```ts
import { NetworkTests } from "@networktests/sdk";

const nt = new NetworkTests();
const session = await fetch("/my-backend/start-udp").then(r => r.json());

const result = await nt.runUdpTest(session, {
  onProgress: ({ packetsSent, packetsReceived, lossPercent }) => {
    console.log(`${packetsReceived}/${packetsSent} (${lossPercent}%)`);
  },
});

console.log(`loss: ${result.lossPercent}%`);
console.log(`p95 latency: ${result.latency.p95} ms`);
console.log(`jitter: ${result.jitter} ms`);
```

## Quickstart — DNS leak

**Backend**:

```js
const r = await fetch("https://api.networktests.com/v1/probe/dns-leak/sessions", {
  method: "POST",
  headers: { "Authorization": "Bearer ntsk_live_…" },
});
const { data } = await r.json();
// → { sessionId, fqdns: [10 short-lived names] }
res.json(data);
```

**Frontend**:

```ts
import { NetworkTests } from "@networktests/sdk";

const nt = new NetworkTests();
const session = await fetch("/my-backend/start-leak-test").then(r => r.json());
await nt.runDnsLeakTest(session);

// Poll your backend for the resolver list.
const leak = await fetch(`/my-backend/leak-results/${session.sessionId}`)
  .then(r => r.json());
// → { resolvers: [{ ip, org, asn, country, encrypted, known_provider }, ...] }
```

## React

```tsx
import { useUdpTest } from "@networktests/sdk/react";

function SpeedTest({ session }) {
  const { run, isRunning, progress, result, error } = useUdpTest();

  if (error) return <div>Error: {error.message}</div>;
  if (result) return <div>Loss: {result.lossPercent}%</div>;
  if (isRunning) return <div>{progress?.packetsReceived ?? 0} packets…</div>;
  return <button onClick={() => run(session)}>Start</button>;
}
```

## CDN drop-in (no build step)

```html
<script src="https://cdn.jsdelivr.net/npm/@networktests/sdk@0/dist/networktests.umd.js"></script>
<script>
  const nt = new NetworkTests.NetworkTests();
  // ...
</script>
```

## API reference

### `new NetworkTests()`

Takes no arguments. The SDK is keyless on the wire.

### `nt.runUdpTest(session, options?)`

| Param | Type | Notes |
|---|---|---|
| `session` | `UdpSession` | From your backend's call to `POST /v1/probe/udp/sessions`. |
| `options.onProgress` | `(p: UdpProgress) => void` | Fired ~10× per second during the test. |
| `options.signal` | `AbortSignal` | Cancels the test cleanly. |
| `options.timeoutMs` | `number` | Hard timeout. Defaults to `(session.duration + 10) * 1000`. |

Resolves with `UdpResult`. Rejects with `NetworkTestsError`, `AbortError`, or `TimeoutError`.

### `nt.runDnsLeakTest(session, options?)`

| Param | Type | Notes |
|---|---|---|
| `session` | `DnsLeakSession` | From `POST /v1/probe/dns-leak/sessions`. |
| `options.onResolved` | `(fqdn: string) => void` | Fired per FQDN. |
| `options.signal` | `AbortSignal` | Cancels in-flight triggers. |
| `options.timeoutMs` | `number` | Default 15000. |

Resolves with `void` once all triggers complete. The resolver list lives server-side — poll the `GET /v1/probe/dns-leak/sessions/:id` endpoint from your backend.

### Errors

```ts
import {
  NetworkTestsError,   // base class with .code
  AbortError,          // signal fired
  TimeoutError,        // exceeded timeoutMs
} from "@networktests/sdk";
```

Common `code` values: `WS_ERROR`, `WS_CLOSED`, `DC_ERROR`, `DC_CLOSED`, `SERVER_ERROR`, `TEST_STOPPED`, `BAD_STATE`, `UNKNOWN`.

## Browser support

Evergreen Chromium, Firefox, Safari, and Edge from 2022 onward. Requires `RTCPeerConnection`, `RTCDataChannel`, `WebSocket`, and either `Image` or `fetch` with `mode: "no-cors"`. No Node, no React Native in v0.1.

## License

MIT
