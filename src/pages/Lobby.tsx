import { Link } from "react-router-dom";
import { api } from "../api/rest";
import { usePolling } from "../api/usePolling";
import type { MatchSummary, PairStats, TeamInfo } from "../api/types";
import { fmtDuration, fmtTime } from "../lib/format";
import { API_URL } from "../config";

function RunningCard({ m }: { m: MatchSummary }) {
  return (
    <Link to={`/live/${m.id}`} className="card running-card">
      <div className="rc-head">
        <span className="map-tag">{m.map}</span>
        <span className="live-dot">LIVE</span>
      </div>
      <div className="rc-teams">
        <span className="team">{m.team_a}</span>
        <span className="score">
          {m.score_a} : {m.score_b}
        </span>
        <span className="team">{m.team_b}</span>
      </div>
      <div className="rc-foot">
        <span>{m.worker}</span>
        <span>{fmtDuration(m.started_at, null)}</span>
      </div>
    </Link>
  );
}

function FinishedTable({ rows }: { rows: MatchSummary[] }) {
  if (rows.length === 0) return <p className="muted">No finished matches yet.</p>;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Finished</th>
          <th>Map</th>
          <th>Team A</th>
          <th className="num">Score</th>
          <th>Team B</th>
          <th>Worker</th>
          <th>Length</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td>{fmtTime(m.finished_at ?? m.started_at)}</td>
            <td>{m.map}</td>
            <td className={m.score_a > m.score_b ? "win" : ""}>{m.team_a}</td>
            <td className="num">
              {m.score_a} : {m.score_b}
            </td>
            <td className={m.score_b > m.score_a ? "win" : ""}>{m.team_b}</td>
            <td>{m.worker}</td>
            <td>{fmtDuration(m.started_at, m.finished_at)}</td>
            <td>
              <Link to={`/replay/${m.id}`}>Replay →</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamsList({ teams }: { teams: TeamInfo[] }) {
  return (
    <div className="teams">
      {teams.map((t) => (
        <div key={t.name} className="card team-card">
          <b>{t.name}</b>
          {t.description && <p className="muted">{t.description}</p>}
          <dl>
            <dt>skill</dt>
            <dd>{t.params.skill.toFixed(0)}</dd>
            <dt>aggr.</dt>
            <dd>{t.params.aggression.toFixed(0)}</dd>
            <dt>teamwork</dt>
            <dd>{t.params.teamwork.toFixed(0)}</dd>
            <dt>reaction</dt>
            <dd>{t.params.reaction_time.toFixed(2)}s</dd>
            <dt>difficulty</dt>
            <dd>{t.params.difficulty.toFixed(1)}</dd>
            <dt>AWPers</dt>
            <dd>{t.params.awpers}</dd>
          </dl>
        </div>
      ))}
    </div>
  );
}

function StatsTable({ pairs }: { pairs: PairStats[] }) {
  if (pairs.length === 0) return null;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Team X</th>
          <th>Team Y</th>
          <th>Map</th>
          <th className="num">Matches</th>
          <th className="num">Rounds X : Y</th>
          <th className="num">X round win %</th>
        </tr>
      </thead>
      <tbody>
        {pairs.map((p) => {
          const tot = p.rounds_x + p.rounds_y;
          return (
            <tr key={`${p.team_x}-${p.team_y}-${p.map}`}>
              <td>{p.team_x}</td>
              <td>{p.team_y}</td>
              <td>{p.map}</td>
              <td className="num">{p.matches}</td>
              <td className="num">
                {p.rounds_x} : {p.rounds_y}
              </td>
              <td className="num">{tot ? ((100 * p.rounds_x) / tot).toFixed(1) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Lobby() {
  const running = usePolling((s) => api.matches("running", 50, s), 3000);
  const finished = usePolling((s) => api.matches("finished", 50, s), 15000);
  const teams = usePolling((s) => api.teams(s), 0);
  const stats = usePolling((s) => api.stats(s), 30000);

  return (
    <div className="lobby">
      <header className="lobby-header">
        <h1>CS2 Bot Lab</h1>
        <span className="muted">api: {API_URL}</span>
        {running.error && <span className="err">api unreachable: {running.error}</span>}
      </header>

      <section>
        <h2>Running matches</h2>
        {running.loading ? (
          <p className="muted">Loading…</p>
        ) : running.data && running.data.length > 0 ? (
          <div className="cards">
            {running.data.map((m) => (
              <RunningCard key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <p className="muted">No matches running.</p>
        )}
      </section>

      <section>
        <h2>Finished matches</h2>
        {finished.data ? <FinishedTable rows={finished.data} /> : <p className="muted">{finished.error ?? "Loading…"}</p>}
      </section>

      <section>
        <h2>Teams</h2>
        {teams.data ? <TeamsList teams={teams.data} /> : <p className="muted">{teams.error ?? "Loading…"}</p>}
      </section>

      {stats.data && stats.data.pairs.length > 0 && (
        <section>
          <h2>Head-to-head</h2>
          <StatsTable pairs={stats.data.pairs} />
        </section>
      )}
    </div>
  );
}
