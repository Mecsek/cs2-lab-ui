import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useReplay } from "../api/replay";
import { ReplayControls, roundMarkers } from "../hud/ReplayControls";
import { MatchView } from "./MatchView";

export function ReplayPage() {
  const { id = "" } = useParams();
  const { playback, load, detail } = useReplay(id);
  const markers = useMemo(() => (load.state === "ready" ? roundMarkers(playback) : []), [load, playback]);
  const m = detail?.match;

  const empty =
    load.state === "loading"
      ? "Loading replay…"
      : load.state === "not_ready"
        ? "Replay not available yet — the demo has not been processed. Try again later."
        : load.state === "error"
          ? `Failed to load replay: ${load.message}`
          : null;

  return (
    <MatchView
      playback={playback}
      map={m?.map ?? null}
      title={m ? `${m.team_a} ${m.score_a} : ${m.score_b} ${m.team_b} · replay` : `Replay ${id.slice(0, 8)}`}
      badges={<span className="tb-status">Replay</span>}
      emptyMessage={empty}
      footer={load.state === "ready" ? (tick) => <ReplayControls playback={playback} markers={markers} tick={tick} /> : undefined}
    />
  );
}
