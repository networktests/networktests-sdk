// Triggers a DNS resolution of a single FQDN from the browser.
//
// Our authoritative DNS server responds to every query with 192.0.2.1
// (TEST-NET-1, guaranteed unreachable per RFC 5737) — the HTTP request
// is *expected* to fail. We only care that the recursive resolver had
// to look up the name, so its IP gets recorded server-side.
//
// Strategy (most-reliable first):
//   1. new Image() — no CORS, no fetch policy. Triggers DNS even on
//      CSP-restricted pages. Errors are silent (image fails to decode).
//   2. fetch(no-cors) — fallback. Some environments (workers, certain
//      WebView shells) lack DOM image support.
//
// Both error paths are normal. The function resolves on any terminal
// state (success or error), never throws.

const ABORT_AFTER_MS = 5000;

export function triggerDnsResolution(fqdn: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  // Prefer Image — broader browser support, no CORS.
  if (typeof Image !== "undefined") {
    return triggerViaImage(fqdn, signal);
  }
  return triggerViaFetch(fqdn, signal);
}

function triggerViaImage(fqdn: string, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      img.src = ""; // cancel any pending request
      resolve();
    };

    const onAbort = () => finish();
    signal?.addEventListener("abort", onAbort, { once: true });

    const timer = setTimeout(finish, ABORT_AFTER_MS);

    img.onload = () => { clearTimeout(timer); finish(); };
    img.onerror = () => { clearTimeout(timer); finish(); };

    // Cache-bust so subsequent runs against the same FQDN actually
    // re-resolve. Path doesn't matter — server returns 192.0.2.1
    // regardless.
    img.src = `https://${fqdn}/_/leak.gif?t=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
}

function triggerViaFetch(fqdn: string, signal?: AbortSignal): Promise<void> {
  const controller = new AbortController();
  const abortSignal = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;
  const timer = setTimeout(() => controller.abort(), ABORT_AFTER_MS);

  return fetch(`https://${fqdn}/_/leak?t=${Date.now()}`, {
    method: "GET",
    mode: "no-cors",
    cache: "no-store",
    signal: abortSignal,
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer))
    .then(() => undefined);
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (a.aborted || b.aborted) c.abort();
  else {
    a.addEventListener("abort", onAbort, { once: true });
    b.addEventListener("abort", onAbort, { once: true });
  }
  return c.signal;
}
