import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
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

function Glb({ map }: { map: string }) {
  const { scene } = useGLTF(mapUrl(map));
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
