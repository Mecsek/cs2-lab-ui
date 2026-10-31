import { useEffect, useState } from "react";

export interface Polled<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Calls `fn` now and every `intervalMs` (0 = once). Keeps the last good data on error. */
export function usePolling<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): Polled<T> {
  const [s, setS] = useState<Polled<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const run = async () => {
      ac = new AbortController();
      try {
        const data = await fn(ac.signal);
        if (alive) setS({ data, error: null, loading: false });
      } catch (e) {
        if (alive && !ac.signal.aborted) setS((p) => ({ ...p, error: String(e), loading: false }));
      }
      if (alive && intervalMs > 0) timer = setTimeout(run, intervalMs);
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return s;
}
