import { useParams } from "react-router-dom";
import { useLiveMatch } from "../api/live";
import { ConnectionBadge } from "../hud/ConnectionBadge";
import { MatchView } from "./MatchView";

export function LivePage() {
  const { id = "" } = useParams();
  const live = useLiveMatch(id);
  const info = live.info;
  return (
    <MatchView
      playback={live.playback}
      map={info?.map ?? null}
      title={info ? `${info.team_a} vs ${info.team_b} · ${info.worker}` : `Match ${id.slice(0, 8)}`}
      badges={
        <>
          <ConnectionBadge conn={live.conn} retryInMs={live.retryInMs} />
          {live.status && live.status !== "running" && <span className="tb-status">{live.status}</span>}
        </>
      }
      emptyMessage={live.conn === "open" ? "Waiting for the first frame…" : "Connecting to the live stream…"}
    />
  );
}
