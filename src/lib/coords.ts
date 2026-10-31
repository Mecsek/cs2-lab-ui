// Single place for Source-engine -> three.js coordinate conversion.
//
// Source: right-handed, Z-up, units are inches (1 unit = 1 inch = 0.0254 m).
//   +X = "east" (yaw 0), +Y = "north" (yaw 90), +Z = up.
// three.js: right-handed, Y-up. We render in metres.
//
// Mapping:  three = (x, z, -y) * SOURCE_TO_METERS
// This is a proper rotation (-90 deg about X) plus uniform scale, so handedness is preserved
// and a top-down camera looking at -Y sees the radar orientation (Source +Y = screen up).
//
// Map GLBs exported from the game need to land in this same frame; see
// `src/scene/mapConfig.ts` for the (configurable) transform applied to the GLB.

import type { Vec3 } from "../api/types";

export const SOURCE_TO_METERS = 0.0254;

/** Player hull height in Source units (standing). */
export const PLAYER_HEIGHT_SU = 72;

export type V3 = [number, number, number];

/** Source position (Z-up, inches) -> three.js position (Y-up, metres). */
export function sourceToThree(p: Vec3 | V3, scale = SOURCE_TO_METERS): V3 {
  return [p[0] * scale, p[2] * scale, -p[1] * scale];
}

/** Inverse of `sourceToThree`. */
export function threeToSource(p: V3, scale = SOURCE_TO_METERS): V3 {
  return [p[0] / scale, -p[2] / scale, p[1] / scale];
}

const DEG = Math.PI / 180;

/**
 * Unit view direction in Source space from yaw/pitch in degrees.
 * Source: yaw 0 = +X, yaw 90 = +Y; positive pitch looks DOWN.
 */
export function sourceViewDir(yawDeg: number, pitchDeg: number): V3 {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  return [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), -Math.sin(p)];
}

/** Unit view direction in three.js space (no scaling for directions). */
export function threeViewDir(yawDeg: number, pitchDeg: number): V3 {
  return sourceToThree(sourceViewDir(yawDeg, pitchDeg), 1);
}

/**
 * Rotation about three.js +Y (radians) that turns an object whose "forward" is +X
 * to face the given Source yaw. (Source yaw rotates CCW seen from above, which in our
 * mapping is a positive rotation about +Y.)
 */
export function yawToThreeRotY(yawDeg: number): number {
  return yawDeg * DEG;
}
