import { useEffect, useMemo, useState } from "react";
import { WS_URL } from "../config";
import { Playback } from "./playback";
import type { GameEvent, MatchInfo, UiMessage } from "./types";

export type ConnState = "connecting" | "open" | "reconnecting" | "closed";

export interface LiveState {
  conn: ConnState;
  info: MatchInfo | null;
  status: string | null;
  /** Ms until the next reconnect attempt, when reconnecting. */
  retryInMs: number | null;
}

/** Applies one server message to the playback store. Returns info/status updates. */
export function applyUiMessage(
  pb: Playback,
  msg: UiMessage,
): { info?: MatchInfo; status?: string } {
  switch (msg.type) {
    case "hello":
      pb.reset();
      if (msg.frame) pb.pushFrame(msg.frame);
      for (const e of msg.recent_events) pb.pushEvent(e);
      return { info: msg.info, status: msg.info.status };
    case "frame": {
      const { type: _t, ...frame } = msg;
      pb.pushFrame(frame);
      return {};
    }
    case "event": {
      const { type: _t, ...ev } = msg;
      pb.pushEvent(ev as GameEvent);
      return {};
    }
    case "win_prob":
      pb.pushWinProb({ tick: msg.tick, round: msg.round, p_ct: msg.p_ct });
      return {};
    case "status":
      return { status: msg.status };
  }
}

/** Connects to `/ws/live/:id` with exponential-backoff reconnect. */
export function useLiveMatch(id: string): { playback: Playback } & LiveState {
  const playback = useMemo(() => new Playback("live"), [id]);
  const [state, setState] = useState<LiveState>({
    conn: "connecting",
    info: null,
    status: null,
    retryInMs: null,
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      setState((s) => ({ ...s, conn: attempt === 0 ? "connecting" : "reconnecting", retryInMs: null }));
      ws = new WebSocket(`${WS_URL}/ws/live/${encodeURIComponent(id)}`);
      ws.onopen = () => {
        attempt = 0;
        setState((s) => ({ ...s, conn: "open", retryInMs: null }));
      };
      ws.onmessage = (ev) => {
        let msg: UiMessage;
        try {
          msg = JSON.parse(String(ev.data)) as UiMessage;
        } catch {
          return;
        }
        const upd = applyUiMessage(playback, msg);
        if (upd.info || upd.status) setState((s) => ({ ...s, ...upd }));
      };
      ws.onclose = () => {
        ws = null;
        if (disposed) return;
        attempt++;
        const delay = Math.min(10_000, 500 * 2 ** Math.min(attempt, 5));
        setState((s) => ({ ...s, conn: "reconnecting", retryInMs: delay }));
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    // Deferred so React StrictMode's mount/unmount/mount doesn't open a socket it immediately closes.
    timer = setTimeout(connect, 0);
    return () => {
      disposed = true;
      clearTimeout(timer);
      ws?.close();
      setState((s) => ({ ...s, conn: "closed" }));
    };
  }, [id, playback]);

  return { playback, ...state };
}
