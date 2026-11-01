import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Light, Material, Mesh, MeshStandardMaterial, Object3D } from "three";
import { useGLTF } from "@react-three/drei";
import { mapTransform, mapUrl } from "./mapConfig";
import { GroundGrid } from "./GroundGrid";
import type { Playback } from "../api/playback";

type Availability = "checking" | "yes" | "no";

/** HEAD-checks the GLB. Dev servers / SPA fallbacks answer 200 text/html for missing files. */
function useGlbAvailable(url: string): Availability {
  const [a, setA] = useState<Availability>("checking");
  useEffect(() => {
    const ac = new AbortController();
    setA("checking");
    fetch(url, { method: "HEAD", signal: ac.signal })
      .then((r) => {
        const ct = r.headers.get("content-type") ?? "";
        setA(r.ok && !ct.includes("text/html") ? "yes" : "no");
      })
      .catch(() => !ac.signal.aborted && setA("no"));
    return () => ac.abort();
  }, [url]);
  return a;
}

class GlbBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("Map GLB failed to load, using grid fallback", e);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** CS2 surfaces that are invisible in-game or only make sense with the game's own shaders. */
const HIDDEN_SHADERS = new Set(["csgo_effects.vfx", "csgo_black_unlit.vfx"]);

/** The exporter stores the source CS2 material (path, shader) in glTF extras -> `userData.vmat`. */
function isHidden(m: Material): boolean {
  const vmat = m.userData?.vmat as { Name?: string; ShaderName?: string } | undefined;
  if (!vmat) return false;
  return (
    (vmat.Name ?? "").startsWith("materials/tools/") || HIDDEN_SHADERS.has(vmat.ShaderName ?? "")
  );
}

function Glb({ map }: { map: string }) {
  const { scene } = useGLTF(mapUrl(map));
  useMemo(() => {
    // Map exports carry the map's sun as a KHR_lights_punctual light in physical units
    // (intensity ~2000), which washes every upward-facing surface out to white. The scene
    // has its own lighting, so drop any lights that come with the GLB.
    const lights: Object3D[] = [];
    scene.traverse((o) => {
      if ((o as Light).isLight) lights.push(o);
    });
    lights.forEach((l) => l.removeFromParent());

    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // Tool brushes (light blockers), effect cards (dust, light shafts) and black
      // out-of-bounds fillers are not drawn in-game.
      if (mats.every(isHidden)) mesh.visible = false;
      // CS2 vertex colours hold shader data (foliage wind, blend weights), not tints;
      // multiplying by them turns foliage purple.
      for (const m of mats) {
        if ((m as MeshStandardMaterial).vertexColors) {
          (m as MeshStandardMaterial).vertexColors = false;
          m.needsUpdate = true;
        }
      }
    });
  }, [scene]);
  const t = mapTransform(map);
  return (
    <group position={t.offset} scale={[t.scale, t.scale, t.mirrorZ ? -t.scale : t.scale]}>
      <group rotation={[0, t.rotationY, 0]}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

export function MapModel({ map, playback }: { map: string; playback: Playback }) {
  const avail = useGlbAvailable(mapUrl(map));
  const grid = <GroundGrid playback={playback} />;
  if (avail !== "yes") return grid;
  return (
    <GlbBoundary fallback={grid}>
      <Suspense fallback={grid}>
        <Glb map={map} />
      </Suspense>
    </GlbBoundary>
  );
}
