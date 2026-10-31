import { useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Playback } from "../api/playback";
import type { PlayerState } from "../api/types";
import { BombMarker } from "./BombMarker";
import { CameraRig } from "./CameraRig";
import { GrenadeEffects } from "./GrenadeEffects";
import { MapModel } from "./MapModel";
import { PlayerMarker } from "./PlayerMarker";
import { SceneCtx, type CameraMode, type SceneState } from "./sceneState";

/** Advances the playback clock and samples interpolated players once per render frame. */
function ClockDriver({ state }: { state: SceneState }) {
  useFrame((_, dt) => {
    const pb = state.playback;
    pb.advance(Math.min(dt, 0.25));
    state.players.clear();
    for (const p of pb.players()) state.players.set(p.name, p);
  });
  return null;
}

interface Props {
  playback: Playback;
  map: string | null;
  /** Current (non-interpolated) players, refreshed at HUD rate. */
  hudPlayers: PlayerState[];
  cameraMode: CameraMode;
  follow: string | null;
  onSelectPlayer: (name: string) => void;
}

export function MatchScene({ playback, map, hudPlayers, cameraMode, follow, onSelectPlayer }: Props) {
  const state = useMemo<SceneState>(() => ({ playback, players: new Map() }), [playback]);
  return (
    <Canvas
      className="scene-canvas"
      camera={{ fov: 55, near: 0.1, far: 2000, position: [30, 40, 40] }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <SceneCtx.Provider value={state}>
        <ClockDriver state={state} />
        <color attach="background" args={["#0b0f14"]} />
        <fog attach="fog" args={["#0b0f14", 120, 400]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#bcd3ff", "#202020", 0.5]} />
        <directionalLight position={[50, 100, 30]} intensity={1.2} />
        {map && <MapModel map={map} playback={playback} />}
        {hudPlayers.map((p) => (
          <PlayerMarker
            key={p.name}
            name={p.name}
            hud={p}
            selected={follow === p.name}
            onSelect={onSelectPlayer}
          />
        ))}
        <BombMarker />
        <GrenadeEffects />
        <CameraRig mode={cameraMode} follow={follow} />
      </SceneCtx.Provider>
    </Canvas>
  );
}
