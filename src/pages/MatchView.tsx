import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Playback } from "../api/playback";
import type { Side } from "../api/types";
import { teamNameForSide } from "../lib/teams";
import { MatchScene } from "../scene/MatchScene";
import type { CameraMode } from "../scene/sceneState";
import { CameraBar } from "../hud/CameraBar";
import { Economy } from "../hud/Economy";
import { KillFeed } from "../hud/KillFeed";
import { RoundInfo } from "../hud/RoundInfo";
import { Scoreboard } from "../hud/Scoreboard";
import { WinProbChart } from "../hud/WinProbChart";

/** Re-renders the caller every `ms` milliseconds. */
export function useTicker(ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

const KILLFEED_SECONDS = 6;

interface Props {
  playback: Playback;
  /** Map name if known before the first frame. */
  map: string | null;
  title: ReactNode;
  /** Extra items for the top bar (connection badge, status…). */
  badges?: ReactNode;
  /** Bottom overlay (replay controls). */
  footer?: (tick: number) => ReactNode;
  /** Shown centred while there are no frames. */
  emptyMessage?: ReactNode;
}

/** Full-screen 3D view + HUD; shared by live and replay modes. */
export function MatchView({ playback: pb, map, title, badges, footer, emptyMessage }: Props) {
  useTicker(100);
  const [cameraMode, setCameraMode] = useState<CameraMode>("orbit");
  const [follow, setFollow] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Escape") setCameraMode("orbit");
      if (e.key === " " && pb.mode === "replay") {
        e.preventDefault();
        pb.playing = !pb.playing;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pb]);

  const frame = pb.currentFrame();
  const tick = Number.isFinite(pb.tick) ? pb.tick : pb.lastTick;
  const players = frame?.players ?? [];
  const mapName = frame?.map ?? map;
  const teamNames: Record<Side, string> = {
    CT: teamNameForSide(players, "CT") ?? "CT",
    T: teamNameForSide(players, "T") ?? "T",
  };
  const recent = pb.eventsBetween(tick - KILLFEED_SECONDS * pb.tickRate, tick);
  const selectPlayer = useMemo(
    () => (name: string) => {
      setFollow(name);
      setCameraMode("follow");
    },
    [],
  );

  return (
    <div className="match-view">
      <MatchScene
        playback={pb}
        map={mapName}
        hudPlayers={players}
        cameraMode={cameraMode}
        follow={follow}
        onSelectPlayer={selectPlayer}
      />

      <div className="hud-top">
        <div className="hud-panel topbar">
          <Link to="/" className="back">
            ← Lobby
          </Link>
          <span className="tb-title">{title}</span>
          {mapName && <span className="tb-map">{mapName}</span>}
          {badges}
        </div>
        {frame && <RoundInfo frame={frame} ctName={teamNames.CT} tName={teamNames.T} />}
        <CameraBar mode={cameraMode} follow={follow} onMode={setCameraMode} />
      </div>

      {frame && (
        <>
          <div className="hud-left">
            <Scoreboard players={players} teamNames={teamNames} follow={follow} onSelect={selectPlayer} />
            <Economy players={players} />
          </div>
          <div className="hud-right">
            <KillFeed events={recent} players={players} />
            {pb.winProb.length > 0 && <WinProbChart points={pb.winProb} round={frame.round} tickRate={pb.tickRate} />}
          </div>
        </>
      )}

      {!frame && emptyMessage && <div className="hud-empty hud-panel">{emptyMessage}</div>}
      {footer && <div className="hud-bottom">{footer(tick)}</div>}
    </div>
  );
}
