import type { Playback } from "../api/playback";

const SPEEDS = [0.5, 1, 2, 4];

export interface RoundMarker {
  round: number;
  tick: number;
}

/** First frame tick of each round. */
export function roundMarkers(pb: Playback): RoundMarker[] {
  const out: RoundMarker[] = [];
  let last = -1;
  for (const f of pb.frames) {
    if (f.round !== last) {
      out.push({ round: f.round, tick: f.tick });
      last = f.round;
    }
  }
  return out;
}

interface Props {
  playback: Playback;
  markers: RoundMarker[];
  /** forces re-render from parent ticker */
  tick: number;
}

export function ReplayControls({ playback: pb, markers, tick }: Props) {
  const a = pb.firstTick;
  const b = pb.lastTick;
  const span = Math.max(1, b - a);
  const pct = (t: number) => `${((t - a) / span) * 100}%`;
  const secs = (t: number) => Math.max(0, (t - a) / pb.tickRate);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const togglePlay = () => {
    if (!pb.playing && pb.tick >= pb.lastTick) pb.seek(pb.firstTick);
    pb.playing = !pb.playing;
  };

  return (
    <div className="hud-panel replay-controls">
      <button className="rc-play" onClick={togglePlay} title="Play/pause (space)">
        {pb.playing ? "❚❚" : "▶"}
      </button>
      <div className="rc-speeds">
        {SPEEDS.map((s) => (
          <button key={s} className={pb.speed === s ? "on" : ""} onClick={() => (pb.speed = s)}>
            {s}x
          </button>
        ))}
      </div>
      <div className="rc-timeline">
        <div className="rc-markers">
          {markers.map((m) => (
            <button
              key={m.round}
              className="rc-marker"
              style={{ left: pct(m.tick) }}
              title={`Round ${m.round}`}
              onClick={() => pb.seek(m.tick)}
            >
              <span>{m.round}</span>
            </button>
          ))}
        </div>
        <input
          type="range"
          min={a}
          max={b}
          step={1}
          value={Number.isFinite(tick) ? tick : a}
          onChange={(e) => pb.seek(Number(e.target.value))}
          aria-label="Timeline"
        />
      </div>
      <span className="rc-time">
        {fmt(secs(tick))} / {fmt(secs(b))}
      </span>
    </div>
  );
}
