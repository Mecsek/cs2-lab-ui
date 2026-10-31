import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import type { Grenade } from "../api/types";
import { sourceToThree } from "../lib/coords";
import { useSceneState } from "./sceneState";

interface Style {
  color: string;
  /** seconds visible */
  dur: number;
  /** radius in metres */
  radius: number;
  /** grows quickly then fades (flash) vs stays (smoke/fire) */
  burst: boolean;
}

const STYLE: Record<Grenade, Style> = {
  he: { color: "#ffb347", dur: 0.6, radius: 3.5, burst: true },
  flash: { color: "#ffffff", dur: 0.4, radius: 4, burst: true },
  decoy: { color: "#9ad1ff", dur: 0.5, radius: 1, burst: true },
  smoke: { color: "#9aa4ae", dur: 18, radius: 3.6, burst: false },
  molotov: { color: "#ff5a1f", dur: 7, radius: 3, burst: false },
};
const MAX_DUR = Math.max(...Object.values(STYLE).map((s) => s.dur));
const POOL = 32;

/** Detonation flashes / smoke / fire derived from `grenade_detonate` events at the render tick. */
export function GrenadeEffects() {
  const { playback } = useSceneState();
  const group = useRef<Group>(null);
  const slots = useMemo(() => Array.from({ length: POOL }, (_, i) => i), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const tick = playback.tick;
    const rate = playback.tickRate;
    const evs = Number.isFinite(tick) ? playback.eventsBetween(tick - MAX_DUR * rate, tick) : [];
    let n = 0;
    for (const e of evs) {
      if (e.kind !== "grenade_detonate" || n >= POOL) continue;
      const st = STYLE[e.grenade] ?? STYLE.he;
      const age = (tick - e.tick) / rate;
      if (age > st.dur) continue;
      const k = age / st.dur;
      const mesh = g.children[n++] as Mesh;
      const [x, y, z] = sourceToThree(e.pos);
      mesh.visible = true;
      mesh.position.set(x, y + (st.burst ? 0.5 : 0.2), z);
      const r = st.burst ? st.radius * (0.3 + 0.7 * Math.min(1, k * 3)) : st.radius * Math.min(1, age * 2 + 0.2);
      mesh.scale.set(r, st.burst ? r : r * (e.grenade === "molotov" ? 0.15 : 0.7), r);
      const m = mesh.material as MeshBasicMaterial;
      m.color.set(st.color);
      m.opacity = st.burst ? 0.85 * (1 - k) : 0.45 * Math.min(1, (1 - k) * 4);
    }
    for (let i = n; i < POOL; i++) g.children[i].visible = false;
  });

  return (
    <group ref={group}>
      {slots.map((i) => (
        <mesh key={i} visible={false}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
