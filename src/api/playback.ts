// Mutable frame/event store + render clock shared by live and replay modes.
// The 3D scene reads it every animation frame (no React re-render); the HUD
// snapshots it at ~10 Hz via `useHudSnapshot`.

import { DEFAULT_TICK_RATE, LIVE_DELAY_MS } from "../config";
import { advanceLiveClock, frameIndexAt, samplePlayers } from "../lib/interp";
import type { GameEvent, LiveFrame, PlayerState, WinProbPoint } from "./types";

export type PlaybackMode = "live" | "replay";

const LIVE_MAX_FRAMES = 16 * 60; // ~1 minute of history
const LIVE_MAX_EVENTS = 500;

export class Playback {
  frames: LiveFrame[] = [];
  events: GameEvent[] = [];
  winProb: WinProbPoint[] = [];
  tickRate = DEFAULT_TICK_RATE;
  /** Fractional render tick. */
  tick = NaN;
  playing = true;
  speed = 1;

  constructor(public readonly mode: PlaybackMode) {}

  get firstTick(): number {
    return this.frames[0]?.tick ?? 0;
  }
  get lastTick(): number {
    return this.frames[this.frames.length - 1]?.tick ?? 0;
  }

  // ---- ingest ----

  reset() {
    this.frames = [];
    this.events = [];
    this.winProb = [];
    this.tick = NaN;
  }

  loadReplay(frames: LiveFrame[], events: GameEvent[], tickRate: number) {
    this.frames = [...frames].sort((a, b) => a.tick - b.tick);
    this.events = [...events].sort((a, b) => a.tick - b.tick);
    this.tickRate = tickRate || DEFAULT_TICK_RATE;
    this.tick = this.firstTick;
  }

  pushFrame(f: LiveFrame) {
    const last = this.frames[this.frames.length - 1];
    if (last && f.tick < last.tick - this.tickRate) {
      // Server restarted / map changed: tick counter went backwards.
      this.reset();
    } else if (last && f.tick <= last.tick) {
      return; // duplicate or out of order
    }
    this.frames.push(f);
    if (this.frames.length > LIVE_MAX_FRAMES) this.frames.splice(0, this.frames.length - LIVE_MAX_FRAMES);
  }

  pushEvent(e: GameEvent) {
    const evs = this.events;
    if (evs.some((x) => x.tick === e.tick && x.kind === e.kind && JSON.stringify(x) === JSON.stringify(e))) return;
    let i = evs.length;
    while (i > 0 && evs[i - 1].tick > e.tick) i--;
    evs.splice(i, 0, e);
    if (evs.length > LIVE_MAX_EVENTS) evs.splice(0, evs.length - LIVE_MAX_EVENTS);
  }

  pushWinProb(p: WinProbPoint) {
    this.winProb.push(p);
    if (this.winProb.length > 4000) this.winProb.splice(0, 1000);
  }

  // ---- clock ----

  /** Called once per rendered frame with the elapsed seconds. */
  advance(dt: number) {
    if (this.frames.length === 0) return;
    if (this.mode === "live") {
      const delay = (LIVE_DELAY_MS / 1000) * this.tickRate;
      this.tick = advanceLiveClock(this.tick, this.lastTick, dt, this.tickRate, delay);
    } else {
      if (!Number.isFinite(this.tick)) this.tick = this.firstTick;
      if (this.playing) this.tick += dt * this.tickRate * this.speed;
      if (this.tick >= this.lastTick) {
        this.tick = this.lastTick;
        this.playing = false;
      }
    }
  }

  seek(tick: number) {
    this.tick = Math.min(this.lastTick, Math.max(this.firstTick, tick));
  }

  // ---- queries ----

  /** Latest frame at or before the render tick (non-interpolated HUD data). */
  currentFrame(): LiveFrame | null {
    if (this.frames.length === 0) return null;
    const i = frameIndexAt(this.frames, Number.isFinite(this.tick) ? this.tick : this.lastTick);
    return this.frames[Math.max(0, i)];
  }

  /** Interpolated players at the render tick. */
  players(): PlayerState[] {
    if (this.frames.length === 0) return [];
    return samplePlayers(this.frames, Number.isFinite(this.tick) ? this.tick : this.lastTick);
  }

  /** Events with `from < tick <= to`. */
  eventsBetween(from: number, to: number): GameEvent[] {
    const out: GameEvent[] = [];
    for (const e of this.events) {
      if (e.tick > to) break;
      if (e.tick > from) out.push(e);
    }
    return out;
  }
}
