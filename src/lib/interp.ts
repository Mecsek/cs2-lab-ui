import type { LiveFrame, PlayerState, Vec3 } from "../api/types";

/** Jumps larger than this (Source units) between two frames are snapped, not lerped. */
export const TELEPORT_SU = 400;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Shortest-path angle interpolation in degrees. Result is in (-180, 180]. */
export function lerpAngleDeg(a: number, b: number, t: number): number {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  if (d === -180) d = 180;
  const r = a + d * t;
  return ((r + 180) % 360 + 360) % 360 - 180 || 0;
}

/** Index of the last frame with `tick <= tick`, or -1. `frames` must be sorted by tick. */
export function frameIndexAt(frames: readonly LiveFrame[], tick: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].tick <= tick) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export interface Bracket {
  a: LiveFrame;
  b: LiveFrame;
  /** 0..1 between a and b */
  t: number;
}

/** The two frames around `tick` and the blend factor. Clamps at both ends. */
export function bracket(frames: readonly LiveFrame[], tick: number): Bracket | null {
  if (frames.length === 0) return null;
  const i = frameIndexAt(frames, tick);
  if (i < 0) return { a: frames[0], b: frames[0], t: 0 };
  if (i >= frames.length - 1) return { a: frames[i], b: frames[i], t: 0 };
  const a = frames[i];
  const b = frames[i + 1];
  const span = b.tick - a.tick;
  const t = span > 0 ? Math.min(1, Math.max(0, (tick - a.tick) / span)) : 0;
  return { a, b, t };
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Interpolates one player between two snapshots. Non-spatial fields come from `a`. */
export function lerpPlayer(a: PlayerState, b: PlayerState | undefined, t: number): PlayerState {
  if (!b || t <= 0) return a;
  if (a.alive !== b.alive || dist(a.pos, b.pos) > TELEPORT_SU) return t < 0.5 ? a : { ...a, pos: b.pos, yaw: b.yaw, pitch: b.pitch };
  return {
    ...a,
    pos: lerpVec(a.pos, b.pos, t),
    yaw: lerpAngleDeg(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
  };
}

/** Players at an arbitrary (fractional) tick. */
export function samplePlayers(frames: readonly LiveFrame[], tick: number): PlayerState[] {
  const br = bracket(frames, tick);
  if (!br) return [];
  if (br.a === br.b || br.t === 0) return br.a.players;
  const byName = new Map(br.b.players.map((p) => [p.name, p]));
  return br.a.players.map((p) => lerpPlayer(p, byName.get(p.name), br.t));
}

/**
 * Advances the live render clock by `dt` seconds, steering it towards
 * `latestTick - delayTicks`. Snaps if more than a second off (e.g. after reconnect).
 */
export function advanceLiveClock(
  renderTick: number,
  latestTick: number,
  dtSec: number,
  tickRate: number,
  delayTicks: number,
): number {
  const target = latestTick - delayTicks;
  if (!Number.isFinite(renderTick) || Math.abs(target - renderTick) > tickRate) return target;
  let next = renderTick + dtSec * tickRate;
  // Gentle drift correction so we neither starve nor lag behind.
  next += (target - next) * Math.min(1, dtSec * 2);
  return Math.min(next, latestTick);
}
