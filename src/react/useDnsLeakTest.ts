import { useCallback, useRef, useState } from "react";
import { runDnsLeakTest } from "../dnsleak/index.js";
import type { DnsLeakSession, RunDnsLeakOptions } from "../types.js";

export interface UseDnsLeakTestState {
  isRunning: boolean;
  error: Error | null;
  /** FQDNs that have been triggered (server-side resolver list is separate). */
  resolved: string[];
  /** True once all FQDNs have been triggered. */
  complete: boolean;
}

export interface UseDnsLeakTestApi extends UseDnsLeakTestState {
  run: (
    session: DnsLeakSession,
    options?: Omit<RunDnsLeakOptions, "onResolved" | "signal">,
  ) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

const INITIAL: UseDnsLeakTestState = {
  isRunning: false,
  error: null,
  resolved: [],
  complete: false,
};

export function useDnsLeakTest(): UseDnsLeakTestApi {
  const [state, setState] = useState<UseDnsLeakTestState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async (
    session: DnsLeakSession,
    options?: Omit<RunDnsLeakOptions, "onResolved" | "signal">,
  ): Promise<void> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL, isRunning: true });
    try {
      await runDnsLeakTest(session, {
        ...options,
        signal: ctrl.signal,
        onResolved: (fqdn) => {
          setState((s) =>
            s.isRunning ? { ...s, resolved: [...s.resolved, fqdn] } : s,
          );
        },
      });
      setState((s) => ({ ...s, isRunning: false, complete: true }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState((s) => ({ ...s, isRunning: false, error }));
      throw error;
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);

  return { ...state, run, cancel, reset };
}
