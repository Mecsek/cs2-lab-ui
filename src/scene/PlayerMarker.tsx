import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import type { PlayerState } from "../api/types";
import { sourceToThree, yawToThreeRotY } from "../lib/coords";
import { SIDE_COLOR } from "../lib/teams";
import { useSceneState } from "./sceneState";

const DEG = Math.PI / 180;
const HEIGHT = 1.83; // 72 units
const RADIUS = 0.32;
const EYE = 1.62; // 64 units
const CONE_LEN = 1.6;

interface Props {
  name: string;
  /** Non-interpolated state for the label (updated at HUD rate). */
  hud: PlayerState;
  selected: boolean;
  onSelect: (name: string) => void;
}

export function PlayerMarker({ name, hud, selected, onSelect }: Props) {
  const scene = useSceneState();
  const root = useRef<Group>(null);
  const yawG = useRef<Group>(null);
  const pitchG = useRef<Group>(null);

  useFrame(() => {
    const p = scene.players.get(name);
    if (!root.current) return;
    root.current.visible = !!p;
    if (!p) return;
    const [x, y, z] = sourceToThree(p.pos);
    root.current.position.set(x, y, z);
    if (yawG.current) yawG.current.rotation.y = yawToThreeRotY(p.yaw);
    if (pitchG.current) pitchG.current.rotation.z = -p.pitch * DEG;
  });

  const color = SIDE_COLOR[hud.side];
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(name);
  };

  return (
    <group ref={root}>
      {hud.alive ? (
        <>
          <mesh position={[0, HEIGHT / 2, 0]} onClick={click} castShadow>
            <capsuleGeometry args={[RADIUS, HEIGHT - 2 * RADIUS, 4, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.15} />
          </mesh>
          <group ref={yawG} position={[0, EYE, 0]}>
            <group ref={pitchG}>
              {/* Cone apex at the eye, opening along local +X (view direction). */}
              <mesh position={[CONE_LEN / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[0.45, CONE_LEN, 16, 1, true]} />
                <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} side={2} />
              </mesh>
            </group>
          </group>
          {selected && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <ringGeometry args={[0.55, 0.7, 32]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )}
          <Html position={[0, HEIGHT + 0.45, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div className={`plabel plabel-${hud.side}`}>
              <span>{name}</span>
              <span className="plabel-hp">
                <i style={{ width: `${Math.max(0, Math.min(100, hud.hp))}%` }} />
              </span>
            </div>
          </Html>
        </>
      ) : (
        <group position={[0, 0.05, 0]} onClick={click}>
          {[Math.PI / 4, -Math.PI / 4].map((r) => (
            <mesh key={r} rotation={[0, r, 0]}>
              <boxGeometry args={[0.9, 0.06, 0.12]} />
              <meshBasicMaterial color={color} transparent opacity={0.4} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
