import type { CameraMode } from "../scene/sceneState";

interface Props {
  mode: CameraMode;
  follow: string | null;
  onMode: (m: CameraMode) => void;
}

export function CameraBar({ mode, follow, onMode }: Props) {
  const modes: [CameraMode, string][] = [
    ["orbit", "Orbit"],
    ["top", "Top-down"],
    ["follow", follow ? `Follow ${follow}` : "Follow (pick a player)"],
  ];
  return (
    <div className="hud-panel camera-bar">
      {modes.map(([m, label]) => (
        <button
          key={m}
          className={mode === m ? "on" : ""}
          disabled={m === "follow" && !follow}
          onClick={() => onMode(m)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
