import type { LiveFrame } from "../api/types";

export interface SourceBounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** Bounding box (Source units) of every player position in `frames` (sampled). */
export function playerBounds(frames: readonly LiveFrame[], maxSamples = 400): SourceBounds | null {
  if (frames.length === 0) return null;
  const step = Math.max(1, Math.floor(frames.length / maxSamples));
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < frames.length; i += step) {
    for (const p of frames[i].players) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p.pos[k]);
        max[k] = Math.max(max[k], p.pos[k]);
      }
    }
  }
  return Number.isFinite(min[0]) ? { min, max } : null;
}

export function boundsCenter(b: SourceBounds): [number, number, number] {
  return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]];
}

export function boundsSize(b: SourceBounds): number {
  return Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], 512);
}
