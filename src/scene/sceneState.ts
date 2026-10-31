import { createContext, useContext } from "react";
import type { Playback } from "../api/playback";
import type { PlayerState } from "../api/types";

/** Per-render-frame interpolated state, written by <ClockDriver/>, read by scene objects. */
export interface SceneState {
  playback: Playback;
  players: Map<string, PlayerState>;
}

export const SceneCtx = createContext<SceneState | null>(null);

export function useSceneState(): SceneState {
  const s = useContext(SceneCtx);
  if (!s) throw new Error("SceneCtx missing");
  return s;
}

export type CameraMode = "orbit" | "top" | "follow";
