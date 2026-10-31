/** Base URL of the api service. Set `VITE_API_URL` at build time. */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(
  /\/+$/,
  "",
);

/** WebSocket base derived from API_URL (http -> ws, https -> wss). */
export const WS_URL: string = API_URL.replace(/^http/, "ws");

/** Server tick rate (CS2 = 64). Replays carry their own value. */
export const DEFAULT_TICK_RATE = 64;

/** How far behind the newest live frame we render, for smooth interpolation. */
export const LIVE_DELAY_MS = 125;
