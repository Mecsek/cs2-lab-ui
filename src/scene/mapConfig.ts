// The ONE place to configure how map GLBs are placed in the scene.
//
// Scene frame (see src/lib/coords.ts): three = (x, z, -y) * 0.0254, i.e. Y-up, metres.
//
// Assumption about Source2Viewer / ValveResourceFormat glTF exports (verify for your
// version!): the exporter already converts to glTF conventions (Y-up, metres, scale
// 0.0254) and maps Source (x, y, z) -> glTF (y, z, x). A +90 deg rotation about Y turns
// that into our (x, z, -y), hence `rotationY: Math.PI / 2` below.
//
// If players float beside the geometry, are mirrored or rotated, tweak the default or add
// a per-map override. Quick check: a player standing at a known spot (e.g. CT spawn) should
// stand on the floor there. If your export is NOT pre-scaled (map looks ~40x too big), set
// `scale: 0.0254`.

export interface MapTransform {
  /** Uniform scale applied to the GLB. */
  scale: number;
  /** Rotation about the scene +Y axis, radians. */
  rotationY: number;
  /** Mirror the GLB along scene Z (use if the map appears mirrored). */
  mirrorZ: boolean;
  /** Translation in scene units (metres), applied after rotation/scale. */
  offset: [number, number, number];
}

export const DEFAULT_MAP_TRANSFORM: MapTransform = {
  scale: 1,
  rotationY: Math.PI / 2,
  mirrorZ: false,
  offset: [0, 0, 0],
};

/** Per-map overrides, keyed by map name (e.g. "de_dust2"). */
export const MAP_TRANSFORMS: Record<string, Partial<MapTransform>> = {
  // de_dust2: { offset: [0, 0, 0] },
};

export function mapTransform(map: string): MapTransform {
  return { ...DEFAULT_MAP_TRANSFORM, ...(MAP_TRANSFORMS[map] ?? {}) };
}

/** URL of the map model, served from `public/maps/`. */
export function mapUrl(map: string): string {
  return `${import.meta.env.BASE_URL}maps/${encodeURIComponent(map)}.glb`;
}
