// runDnsLeakTest(session, options) — triggers DNS resolution of every
// FQDN in the session in parallel and resolves once all triggers have
// fired (or errored — errors are expected).

import { AbortError, TimeoutError } from "../errors.js";
import { triggerDnsResolution } from "./trigger.js";
import type { DnsLeakSession, RunDnsLeakOptions } from "../types.js";

export async function runDnsLeakTest(
  session: DnsLeakSession,
  options: RunDnsLeakOptions = {},
): Promise<void> {
  if (options.signal?.aborted) throw new AbortError();
  const timeoutMs = options.timeoutMs ?? 15000;

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutController = new AbortController();
  const combinedSignal = mergeSignals(options.signal, timeoutController.signal);

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timeoutController.abort();
      reject(new TimeoutError(`DNS-leak test exceeded ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const abortPromise = new Promise<never>((_, reject) => {
    options.signal?.addEventListener(
      "abort",
      () => reject(new AbortError()),
      { once: true },
    );
  });

  const triggers = session.fqdns.map((fqdn) =>
    triggerDnsResolution(fqdn, combinedSignal).then(() => {
      options.onResolved?.(fqdn);
    }),
  );

  try {
    await Promise.race([
      Promise.all(triggers),
      timeoutPromise,
      abortPromise,
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function mergeSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  const c = new AbortController();
  if (a.aborted || b.aborted) c.abort();
  else {
    a.addEventListener("abort", () => c.abort(), { once: true });
    b.addEventListener("abort", () => c.abort(), { once: true });
  }
  return c.signal;
}
