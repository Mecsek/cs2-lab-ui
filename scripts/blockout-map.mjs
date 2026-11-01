#!/usr/bin/env node
// Builds the blockout model of a map: its architecture as ONE solid, heavily simplified mesh,
// for the Blockout view and as the stand-in while the textured GLB loads.
//
// From the textured <map>.glb it keeps only world architecture (no props, foliage, decals,
// glass, effects, tool brushes or black fillers), bakes all instances into world space, merges
// everything into one primitive, simplifies it hard, and adds a vertex colour gradient by
// height (darker low, lighter high) so levels read. de_inferno: ~238k triangles, ~1.2 MB.
//
// Usage: node scripts/blockout-map.mjs <in.glb> <out.glb> [ratio=0.05] [error=0.005]
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize, meshopt, quantize, simplify, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const [input, output, ratioArg = "0.05", errorArg = "0.005"] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: blockout-map.mjs <in.glb> <out.glb> [ratio] [error]");
  process.exit(2);
}
const TRIANGLES = 4;

// Props, foliage, decals/overlays, glass, effect cards and black fillers; tool brushes by path.
const SKIP_SHADERS = new Set([
  "csgo_vertexlitgeneric.vfx",
  "csgo_foliage.vfx",
  "csgo_static_overlay.vfx",
  "csgo_glass.vfx",
  "csgo_effects.vfx",
  "csgo_black_unlit.vfx",
]);
const skip = (vmat) =>
  SKIP_SHADERS.has(vmat?.ShaderName) || (vmat?.Name ?? "").startsWith("materials/tools/");

// --- small column-major 4x4 helpers -------------------------------------------------------
function multiply(a, b) {
  const o = new Array(16).fill(0);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return o;
}
function compose([tx, ty, tz], [x, y, z, w], [sx, sy, sz]) {
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/** World matrices for a node: one, or one per EXT_mesh_gpu_instancing instance. */
function nodeMatrices(node) {
  const world = node.getWorldMatrix();
  const inst = node.getExtension("EXT_mesh_gpu_instancing");
  if (!inst) return [world];
  const T = inst.getAttribute("TRANSLATION");
  const R = inst.getAttribute("ROTATION");
  const S = inst.getAttribute("SCALE");
  const n = (T ?? R ?? S).getCount();
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(
      multiply(
        world,
        compose(T ? T.getElement(i, []) : [0, 0, 0], R ? R.getElement(i, []) : [0, 0, 0, 1], S ? S.getElement(i, []) : [1, 1, 1]),
      ),
    );
  }
  return out;
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(dequantize());

// World-space triangle soup of all kept primitives.
let soup = new Float32Array(1 << 22);
let used = 0;
function pushVertex(m, x, y, z) {
  if (used + 3 > soup.length) {
    const grown = new Float32Array(soup.length * 2);
    grown.set(soup);
    soup = grown;
  }
  soup[used++] = m[0] * x + m[4] * y + m[8] * z + m[12];
  soup[used++] = m[1] * x + m[5] * y + m[9] * z + m[13];
  soup[used++] = m[2] * x + m[6] * y + m[10] * z + m[14];
}
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  let matrices = null;
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== TRIANGLES || skip(prim.getMaterial()?.getExtras()?.vmat)) continue;
    const P = prim.getAttribute("POSITION");
    if (!P) continue;
    const pos = P.getArray();
    const I = prim.getIndices();
    const idx = I ? I.getArray() : Uint32Array.from({ length: P.getCount() }, (_, i) => i);
    matrices ??= nodeMatrices(node);
    for (const m of matrices) for (const i of idx) pushVertex(m, pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]);
  }
}
const trianglesIn = used / 9;

const out = new Document();
const buffer = out.createBuffer();
const prim = out
  .createPrimitive()
  .setAttribute("POSITION", out.createAccessor().setType("VEC3").setArray(soup.slice(0, used)).setBuffer(buffer));
out
  .getRoot()
  .setDefaultScene(out.createScene().addChild(out.createNode("blockout").setMesh(out.createMesh("blockout").addPrimitive(prim))));
await out.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratioArg), error: Number(errorArg), lockBorder: false }),
);

// Height gradient (glTF is Y-up): dark slate low -> light grey high.
const position = prim.getAttribute("POSITION").getArray();
let lo = Infinity, hi = -Infinity;
for (let i = 1; i < position.length; i += 3) {
  lo = Math.min(lo, position[i]);
  hi = Math.max(hi, position[i]);
}
const colour = new Float32Array(position.length);
for (let v = 0; v < position.length; v += 3) {
  const t = (position[v + 1] - lo) / (hi - lo || 1);
  colour[v] = 0.35 + 0.45 * t;
  colour[v + 1] = 0.38 + 0.42 * t;
  colour[v + 2] = 0.45 + 0.35 * t;
}
prim.setAttribute("COLOR_0", out.createAccessor().setType("VEC3").setArray(colour).setBuffer(buffer));

await out.transform(quantize(), meshopt({ encoder: MeshoptEncoder }));
await io.write(output, out);
const trianglesOut = prim.getIndices().getCount() / 3;
console.log(`blockout: ${output} (${Math.round(trianglesIn / 1000)}k -> ${Math.round(trianglesOut / 1000)}k triangles)`);
