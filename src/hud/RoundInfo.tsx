import type { LiveFrame } from "../api/types";
import { fmtClock } from "../lib/format";

const PHASE: Record<LiveFrame["phase"], string> = {
  warmup: "Warmup",
  freezetime: "Freeze time",
  live: "Live",
  over: "Round over",
};

export function RoundInfo({ frame, ctName, tName }: { frame: LiveFrame; ctName: string; tName: string }) {
  const b = frame.bomb;
  return (
    <div className="hud-panel round-info">
      <div className="ri-team ct">
        <span className="ri-name">{ctName}</span>
        <span className="ri-score">{frame.score_ct}</span>
      </div>
      <div className="ri-mid">
        <div className="ri-clock">{fmtClock(frame.round_time_left)}</div>
        <div className="ri-round">
          Round {frame.round} · {PHASE[frame.phase] ?? frame.phase}
        </div>
      </div>
      <div className="ri-team t">
        <span className="ri-score">{frame.score_t}</span>
        <span className="ri-name">{tName}</span>
      </div>
      {b.planted && (
        <div className={`ri-bomb ${b.defusing ? "defusing" : ""}`}>
          BOMB {b.site ? `@ ${b.site}` : ""} · {b.time_left != null ? `${b.time_left.toFixed(1)}s` : "planted"}
          {b.defusing && " · DEFUSING"}
        </div>
      )}
    </div>
  );
}
