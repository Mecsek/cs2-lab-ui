import { useEffect, useState } from "react";
import type { Playback } from "../api/playback";
import { sourceToThree, SOURCE_TO_METERS } from "../lib/coords";
import { boundsCenter, boundsSize, playerBounds, type SourceBounds } from "./bounds";

/** Fallback floor when no map GLB is available: a grid around the players' bounding box. */
export function GroundGrid({ playback }: { playback: Playback }) {
  const [b, setB] = useState<SourceBounds | null>(() => playerBounds(playback.frames));
  useEffect(() => {
    const id = setInterval(() => setB(playerBounds(playback.frames)), 2000);
    return () => clearInterval(id);
  }, [playback]);

  const center = b ? sourceToThree(boundsCenter(b)) : ([0, 0, 0] as const);
  const size = (b ? boundsSize(b) + 1024 : 4096) * SOURCE_TO_METERS;
  const divisions = Math.max(8, Math.round(size / 2.5)); // ~100 units per cell
  return (
    <group position={[center[0], center[1] - 0.02, center[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#141a22" />
      </mesh>
      <gridHelper args={[size, divisions, "#2d3a4a", "#1f2934"]} position={[0, 0.01, 0]} />
    </group>
  );
}
