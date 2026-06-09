import { useCallback, useRef, useState } from "react";
import { runUdpTest } from "../udp/index.js";
import type {
  UdpSession,
  UdpResult,
  UdpProgress,
  RunUdpOptions,
} from "../types.js";

export interface UseUdpTestState {
  result: UdpResult | null;
  error: Error | null;
  isRunning: boolean;
  progress: UdpProgress | null;
}

export interface UseUdpTestApi extends UseUdpTestState {
  /** Start the test. Throws if already running. */
  run: (session: UdpSession, options?: Omit<RunUdpOptions, "onProgress" | "signal">) => Promise<UdpResult>;
  /** Abort an in-flight test. No-op if idle. */
  cancel: () => void;
  /** Reset state to initial. */
  reset: () => void;
}

const INITIAL: UseUdpTestState = {
  result: null,
  error: null,
  isRunning: false,
  progress: null,
};

export function useUdpTest(): UseUdpTestApi {
  const [state, setState] = useState<UseUdpTestState>(INITIAL);
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
    session: UdpSession,
    options?: Omit<RunUdpOptions, "onProgress" | "signal">,
  ): Promise<UdpResult> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ ...INITIAL, isRunning: true });
    try {
      const result = await runUdpTest(session, {
        ...options,
        signal: ctrl.signal,
        onProgress: (progress) => {
          setState((s) => (s.isRunning ? { ...s, progress } : s));
        },
      });
      setState({ result, error: null, isRunning: false, progress: null });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setState({ result: null, error, isRunning: false, progress: null });
      throw error;
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, []);

  return { ...state, run, cancel, reset };
}
