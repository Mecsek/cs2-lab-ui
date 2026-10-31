// Dev mock of the cs2-bot-lab `api` service: REST endpoints + `/ws/live/:id`.
// Usage: node mock/server.mjs   (PORT env, default 8080)
import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { FRAME_TICKS, Sim, TICK_RATE, simulateReplay } from "./sim.mjs";

const TEAMS = [
  { name: "AGGRO", description: "Rushes, high aggression, two AWPers.", params: { difficulty: 3, skill: 90, aggression: 85, reaction_time: 0.2, attack_delay: 0.1, teamwork: 55, awpers: 2 } },
  { name: "TURTLE", description: "Passive, holds angles, strong teamwork.", params: { difficulty: 3, skill: 85, aggression: 20, reaction_time: 0.25, attack_delay: 0.15, teamwork: 90, awpers: 1 } },
  { name: "RANDO", description: "Normal difficulty baseline.", params: { difficulty: 1, skill: 50, aggression: 50, reaction_time: 0.4, attack_delay: 0.3, teamwork: 50, awpers: 0 } },
];

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();

/** @type {Map<string, {summary: any, sim?: Sim, clients: Set<any>, recent: any[], replay?: any, hasReplay: boolean}>} */
const matches = new Map();

function addRunning(worker, teamA, teamB) {
  const id = randomUUID();
  const sim = new Sim({ teamA, teamB, map: "de_mock" });
  matches.set(id, {
    summary: { id, worker, map: sim.map, team_a: teamA, team_b: teamB, status: "running", score_a: 0, score_b: 0, started_at: iso(0), finished_at: null },
    sim,
    clients: new Set(),
    recent: [],
    hasReplay: true,
  });
}

function addFinished(teamA, teamB, minutesAgo, hasReplay) {
  const id = randomUUID();
  const s = 13;
  const o = Math.floor(Math.random() * 12);
  const aWins = Math.random() < 0.5;
  matches.set(id, {
    summary: {
      id, worker: `worker-${1 + Math.floor(Math.random() * 3)}`, map: "de_mock", team_a: teamA, team_b: teamB, status: "finished",
      score_a: aWins ? s : o, score_b: aWins ? o : s, started_at: iso((minutesAgo + 40) * 60_000), finished_at: iso(minutesAgo * 60_000),
    },
    clients: new Set(),
    recent: [],
    hasReplay,
  });
}

addRunning("worker-1", "AGGRO", "TURTLE");
addRunning("worker-2", "TURTLE", "RANDO");
addFinished("AGGRO", "RANDO", 15, true);
addFinished("RANDO", "TURTLE", 70, true);
addFinished("AGGRO", "TURTLE", 130, false); // replay 404: "demo not processed yet"

function info(m) {
  const s = m.summary;
  return { id: s.id, worker: s.worker, map: s.map, team_a: s.team_a, team_b: s.team_b, status: s.status };
}

function broadcast(m, msg) {
  const data = JSON.stringify(msg);
  for (const ws of m.clients) if (ws.readyState === 1) ws.send(data);
}

// ---- simulation loop: one frame every 4 ticks (~16 Hz) ----
setInterval(() => {
  for (const m of matches.values()) {
    if (!m.sim || m.summary.status !== "running") continue;
    const { frame, events, winProb } = m.sim.step();
    m.lastFrame = frame;
    m.summary.score_a = m.sim.scoreA;
    m.summary.score_b = m.sim.scoreB;
    broadcast(m, { type: "frame", ...frame });
    for (const e of events) {
      broadcast(m, { type: "event", ...e });
      m.recent.push(e);
    }
    if (m.recent.length > 40) m.recent.splice(0, m.recent.length - 40);
    if (winProb) broadcast(m, { type: "win_prob", ...winProb });
    if (m.sim.finished) {
      m.summary.status = "finished";
      m.summary.finished_at = iso(0);
      broadcast(m, { type: "status", status: "finished" });
      addRunning(m.summary.worker, m.summary.team_b, m.summary.team_a);
    }
  }
}, (1000 * FRAME_TICKS) / TICK_RATE);

// ---- REST ----
function send(res, code, body) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

function stats() {
  const pairs = new Map();
  for (const { summary: s } of matches.values()) {
    if (s.status !== "finished") continue;
    const [x, y, sx, sy] = s.team_a < s.team_b ? [s.team_a, s.team_b, s.score_a, s.score_b] : [s.team_b, s.team_a, s.score_b, s.score_a];
    const k = `${x}|${y}|${s.map}`;
    const p = pairs.get(k) ?? { team_x: x, team_y: y, map: s.map, matches: 0, rounds_x: 0, rounds_y: 0 };
    p.matches++;
    p.rounds_x += sx;
    p.rounds_y += sy;
    pairs.set(k, p);
  }
  return { pairs: [...pairs.values()] };
}

function replayOf(m) {
  if (!m.replay) {
    const r = simulateReplay({ teamA: m.summary.team_a, teamB: m.summary.team_b, map: m.summary.map, rounds: 4 });
    m.replay = { tick_rate: r.tick_rate, frames: r.frames, events: r.events };
    m.rounds = r.sim.rounds;
  }
  return m.replay;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const parts = url.pathname.split("/").filter(Boolean);
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (parts[0] !== "api") return send(res, 404, { error: "not found" });

  if (parts[1] === "matches" && parts.length === 2) {
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const rows = [...matches.values()]
      .map((m) => m.summary)
      .filter((s) => !status || s.status === status)
      .sort((a, b) => (b.finished_at ?? b.started_at).localeCompare(a.finished_at ?? a.started_at))
      .slice(0, limit);
    return send(res, 200, rows);
  }
  if (parts[1] === "matches" && parts[2]) {
    const m = matches.get(parts[2]);
    if (!m) return send(res, 404, { error: "no such match" });
    if (parts[3] === "replay") {
      if (m.summary.status !== "finished" || !m.hasReplay) return send(res, 404, { error: "demo not processed" });
      return send(res, 200, replayOf(m));
    }
    if (parts.length === 3) {
      const rounds = m.sim ? m.sim.rounds : m.hasReplay ? (replayOf(m), m.rounds) : [];
      return send(res, 200, { match: m.summary, rounds });
    }
  }
  if (url.pathname === "/api/teams") return send(res, 200, TEAMS);
  if (url.pathname === "/api/stats") return send(res, 200, stats());
  send(res, 404, { error: "not found" });
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const m = /^\/ws\/live\/([^/?]+)/.exec(req.url ?? "");
  const match = m && matches.get(decodeURIComponent(m[1]));
  if (!match) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    match.clients.add(ws);
    ws.on("close", () => match.clients.delete(ws));
    ws.send(JSON.stringify({ type: "hello", info: info(match), frame: match.lastFrame ?? null, recent_events: match.recent.slice(-30) }));
  });
});

const PORT = Number(process.env.PORT ?? 8080);
server.listen(PORT, () => console.log(`[mock] api on http://localhost:${PORT}  (REST /api/*, WS /ws/live/:id)`));
