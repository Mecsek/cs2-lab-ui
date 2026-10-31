import { useEffect, useRef, type ElementRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { SOURCE_TO_METERS, sourceToThree, threeViewDir } from "../lib/coords";
import { boundsCenter, boundsSize, playerBounds } from "./bounds";
import { useSceneState, type CameraMode } from "./sceneState";

const tmpPos = new Vector3();
const tmpLook = new Vector3();

/** Orbit (default), top-down and follow-player cameras. */
export function CameraRig({ mode, follow }: { mode: CameraMode; follow: string | null }) {
  const { playback, players } = useSceneState();
  const camera = useThree((s) => s.camera);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const framed = useRef(false);

  // Re-frame the camera when switching orbit/top, or once data arrives.
  const frame = () => {
    const b = playerBounds(playback.frames);
    if (!b || !controls.current) return false;
    const c = sourceToThree(boundsCenter(b));
    const size = boundsSize(b) * SOURCE_TO_METERS;
    controls.current.target.set(c[0], c[1], c[2]);
    if (mode === "top") camera.position.set(c[0], c[1] + size * 1.1, c[2] + 0.01);
    else camera.position.set(c[0] + size * 0.35, c[1] + size * 0.55, c[2] + size * 0.6);
    camera.lookAt(c[0], c[1], c[2]);
    controls.current.update();
    return true;
  };

  useEffect(() => {
    if (mode !== "follow") framed.current = frame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useFrame((_, dt) => {
    if (mode !== "follow") {
      if (!framed.current) framed.current = frame();
      return;
    }
    const p = follow ? players.get(follow) : undefined;
    if (!p) return;
    const [x, y, z] = sourceToThree(p.pos);
    const d = threeViewDir(p.yaw, 0);
    tmpPos.set(x - d[0] * 4, y + 2.6, z - d[2] * 4);
    const k = 1 - Math.exp(-dt * 6);
    camera.position.lerp(tmpPos, k);
    tmpLook.set(x + d[0] * 3, y + 1.2, z + d[2] * 3);
    if (controls.current) {
      controls.current.target.lerp(tmpLook, k);
      camera.lookAt(controls.current.target);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={mode !== "follow"}
      enableRotate={mode === "orbit"}
      screenSpacePanning={mode === "top"}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
    />
  );
}
