import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { sourceToThree } from "../lib/coords";
import { useSceneState } from "./sceneState";

/** Bomb: small box on the carrier's back, on the ground when dropped, pulsing when planted. */
export function BombMarker() {
  const { playback, players } = useSceneState();
  const root = useRef<Group>(null);
  const box = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const g = root.current;
    const f = playback.currentFrame();
    if (!g || !f) return;
    const carrier = f.bomb.planted
      ? undefined
      : f.players.find((p) => p.alive && p.weapons.some((w) => w === "weapon_c4" || w === "c4"));
    const carrierNow = carrier && players.get(carrier.name);
    const src = carrierNow ? carrierNow.pos : f.bomb.pos;
    g.visible = !!src;
    if (!src) return;
    const [x, y, z] = sourceToThree(src);
    g.position.set(x, y + (carrierNow ? 1.2 : 0.1), z);

    const planted = f.bomb.planted;
    const pulse = planted ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * (f.bomb.time_left != null && f.bomb.time_left < 10 ? 14 : 6)) : 0;
    if (box.current) {
      const m = box.current.material as MeshStandardMaterial;
      m.emissiveIntensity = planted ? 0.5 + pulse * 1.5 : 0.4;
      box.current.scale.setScalar(carrierNow ? 0.6 : 1);
    }
    if (ring.current) {
      ring.current.visible = planted;
      ring.current.scale.setScalar(1 + pulse * 0.6);
    }
  });

  return (
    <group ref={root}>
      <mesh ref={box}>
        <boxGeometry args={[0.35, 0.15, 0.25]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff2020" emissiveIntensity={0.4} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.75, 32]} />
        <meshBasicMaterial color="#ff3b3b" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
