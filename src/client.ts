import { runUdpTest } from "./udp/index.js";
import { runDnsLeakTest } from "./dnsleak/index.js";
import type {
  UdpSession,
  DnsLeakSession,
  UdpResult,
  RunUdpOptions,
  RunDnsLeakOptions,
} from "./types.js";

/**
 * Entry point for the networktests.com browser SDK.
 *
 * The constructor takes no arguments — the SDK is keyless on the wire.
 * Customers' backends mint session tickets via the authenticated
 * api.networktests.com API and ship them to the browser.
 *
 * @example
 * const nt = new NetworkTests();
 * const session = await fetch("/my-backend/start-udp").then(r => r.json());
 * const result = await nt.runUdpTest(session);
 */
export class NetworkTests {
  /**
   * Run the UDP throughput probe to completion.
   *
   * Opens a WebSocket to `session.wsUrl`, negotiates a WebRTC DataChannel,
   * runs the packet-loss test, and resolves with the final stats once the
   * server emits `test-complete`.
   */
  runUdpTest(session: UdpSession, options?: RunUdpOptions): Promise<UdpResult> {
    return runUdpTest(session, options);
  }

  /**
   * Trigger DNS resolution of every FQDN in the session. Returns once all
   * triggers have fired (or errored — errors are expected because the
   * fake server returns 192.0.2.1).
   *
   * Actual resolver IPs are observed server-side. Customer's backend
   * polls `GET /v1/probe/dns-leak/sessions/:id` to retrieve them.
   */
  runDnsLeakTest(session: DnsLeakSession, options?: RunDnsLeakOptions): Promise<void> {
    return runDnsLeakTest(session, options);
  }
}
