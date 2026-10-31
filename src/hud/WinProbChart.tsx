import type { WinProbPoint } from "../api/types";

const W = 280;
const H = 110;
const PAD = { l: 30, r: 8, t: 8, b: 18 };

/** CT win probability over the current round (hand-rolled SVG line). */
export function WinProbChart({ points, round, tickRate }: { points: WinProbPoint[]; round: number; tickRate: number }) {
  const pts = points.filter((p) => p.round === round);
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const t0 = pts[0]?.tick ?? 0;
  const span = Math.max(tickRate * 30, (pts[pts.length - 1]?.tick ?? 0) - t0);
  const x = (tick: number) => PAD.l + ((tick - t0) / span) * iw;
  const y = (p: number) => PAD.t + (1 - p) * ih;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.tick).toFixed(1)},${y(p.p_ct).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];

  return (
    <div className="hud-panel winprob">
      <div className="wp-title">
        CT win probability · round {round}
        {last && <b>{Math.round(last.p_ct * 100)}%</b>}
      </div>
      <svg width={W} height={H} role="img" aria-label="CT win probability chart">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className={v === 0.5 ? "wp-mid" : "wp-grid"} />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" className="wp-axis">
              {v * 100}%
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 4} className="wp-axis">
          0s
        </text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" className="wp-axis">
          {Math.round(span / tickRate)}s
        </text>
        {pts.length > 0 && <path d={d} className="wp-line" />}
        {last && <circle cx={x(last.tick)} cy={y(last.p_ct)} r={3} className="wp-dot" />}
        {pts.length === 0 && (
          <text x={PAD.l + iw / 2} y={PAD.t + ih / 2} textAnchor="middle" className="wp-axis">
            waiting for this round…
          </text>
        )}
      </svg>
    </div>
  );
}
