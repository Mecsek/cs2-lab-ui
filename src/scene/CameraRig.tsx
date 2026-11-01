import { useEffect, useRef, type ElementRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { SOURCE_TO_METERS, sourceToThree, threeViewDir } from "../lib/coords";
import { boundsCenter, boundsSize, playerBounds } from "./bounds";
import { useSceneState, type CameraMode } from "./sceneState";

/** Seconds without mouse input before the follow camera swings back behind the player. */
const IDLE_BEFORE_RECENTER = 3;
/** Follow camera: orbit centre height above the player's feet, metres. */
const FOLLOW_EYE = 1.2;
/** Follow camera start offset behind / above the orbit centre, metres. */
const FOLLOW_BACK = 4;
const FOLLOW_UP = 1.4;

const tmpLook = new Vector3();
const tmpDelta = new Vector3();
const tmpOffset = new Vector3();
const tmpDesired = new Vector3();

/** Orbit (default), top-down and follow-player cameras. */
export function CameraRig({ mode, follow }: { mode: CameraMode; follow: string | null }) {
  const { playback, players } = useSceneState();
  const camera = useThree((s) => s.camera);
  const clock = useThree((s) => s.clock);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const framed = useRef(false);
  // Follow mode: placed behind the player yet? Mouse held? Time of last manual input.
  const followPlaced = useRef(false);
  const dragging = useRef(false);
  const lastInput = useRef(-Infinity);

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
    // Entering follow or picking another player starts behind them again.
    followPlaced.current = false;
    lastInput.current = -Infinity;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, follow]);

  useFrame((_, dt) => {
    if (mode !== "follow") {
      if (!framed.current) framed.current = frame();
      return;
    }
    const ctl = controls.current;
    const p = follow ? players.get(follow) : undefined;
    if (!p || !ctl) return;
    const [x, y, z] = sourceToThree(p.pos);
    const look = threeViewDir(p.yaw, 0);
    tmpLook.set(x, y + FOLLOW_EYE, z);

    if (!followPlaced.current) {
      ctl.target.copy(tmpLook);
      camera.position.set(x - look[0] * FOLLOW_BACK, y + FOLLOW_EYE + FOLLOW_UP, z - look[2] * FOLLOW_BACK);
      followPlaced.current = true;
      ctl.update();
      return;
    }

    // The orbit centre follows the player; the camera moves with it, keeping the user's angle.
    const k = 1 - Math.exp(-dt * 6);
    tmpDelta.copy(tmpLook).sub(ctl.target).multiplyScalar(k);
    ctl.target.add(tmpDelta);
    camera.position.add(tmpDelta);

    // After a while without input, ease the angle back behind the player; keep the zoom.
    const idle = clock.elapsedTime - lastInput.current;
    if (!dragging.current && idle > IDLE_BEFORE_RECENTER) {
      tmpOffset.copy(camera.position).sub(ctl.target);
      const dist = tmpOffset.length();
      tmpDesired.set(-look[0] * FOLLOW_BACK, FOLLOW_UP, -look[2] * FOLLOW_BACK).setLength(dist);
      tmpOffset.lerp(tmpDesired, 1 - Math.exp(-dt * 3)).setLength(dist);
      camera.position.copy(ctl.target).add(tmpOffset);
    }
    ctl.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={mode !== "top"}
      enablePan={mode !== "follow"}
      minDistance={mode === "follow" ? 1.5 : 0}
      maxDistance={mode === "follow" ? 40 : Infinity}
      screenSpacePanning={mode === "top"}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
      // Drag and wheel both fire start/end; the idle timer counts from the last input.
      onStart={() => {
        dragging.current = true;
        lastInput.current = clock.elapsedTime;
      }}
      onEnd={() => {
        dragging.current = false;
        lastInput.current = clock.elapsedTime;
      }}
    />
  );
}
