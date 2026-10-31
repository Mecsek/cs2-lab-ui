import { useEffect, useMemo, useState } from "react";
import { Playback } from "./playback";
import { api, HttpError } from "./rest";
import type { MatchDetail } from "./types";

export type ReplayLoad =
  | { state: "loading" }
  | { state: "ready" }
  | { state: "not_ready" } // 404: demo not processed yet
  | { state: "error"; message: string };

export function useReplay(id: string): {
  playback: Playback;
  load: ReplayLoad;
  detail: MatchDetail | null;
} {
  const playback = useMemo(() => new Playback("replay"), [id]);
  const [load, setLoad] = useState<ReplayLoad>({ state: "loading" });
  const [detail, setDetail] = useState<MatchDetail | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoad({ state: "loading" });
    api.match(id, ac.signal).then(setDetail, () => {});
    api.replay(id, ac.signal).then(
      (r) => {
        playback.loadReplay(r.frames, r.events, r.tick_rate);
        setLoad(r.frames.length ? { state: "ready" } : { state: "error", message: "Replay has no frames" });
      },
      (e: unknown) => {
        if (ac.signal.aborted) return;
        if (e instanceof HttpError && e.status === 404) setLoad({ state: "not_ready" });
        else setLoad({ state: "error", message: String(e) });
      },
    );
    return () => ac.abort();
  }, [id, playback]);

  return { playback, load, detail };
}
