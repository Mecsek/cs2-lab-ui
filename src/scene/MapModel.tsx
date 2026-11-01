import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { MeshLambertMaterial, type Mesh } from "three";
import { useGLTF } from "@react-three/drei";
import { blockoutMapUrl, mapTransform } from "./mapConfig";

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

/** Renders nothing if the model fails to load or parse. */
class GlbBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("Map blockout failed to load; showing no map", e);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Flat-shaded so every face reads as a solid plane; the model carries height colours.
const BLOCKOUT = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** The blockout model (`<map>.blockout.glb`): architecture only, one simplified mesh. */
function BlockoutGlb({ map }: { map: string }) {
  const { scene } = useGLTF(blockoutMapUrl(map));
  useMemo(() => {
    scene.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.material = BLOCKOUT;
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

/** The map as its blockout model; nothing while it loads or if there is none. */
export function MapModel({ map }: { map: string }) {
  const available = useGlbAvailable(blockoutMapUrl(map));
  if (available !== "yes") return null;
  return (
    // Keyed by map so a failure on one map doesn't hide the next one.
    <GlbBoundary key={map}>
      <Suspense fallback={null}>
        <BlockoutGlb map={map} />
      </Suspense>
    </GlbBoundary>
  );
}
