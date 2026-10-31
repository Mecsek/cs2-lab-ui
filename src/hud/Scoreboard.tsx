import type { PlayerState, Side } from "../api/types";
import { fmtMoney, weaponLabel } from "../lib/format";

interface Props {
  players: PlayerState[];
  teamNames: Record<Side, string>;
  follow: string | null;
  onSelect: (name: string) => void;
}

function SideTable({ side, players, name, follow, onSelect }: { side: Side; players: PlayerState[]; name: string } & Pick<Props, "follow" | "onSelect">) {
  const alive = players.filter((p) => p.alive).length;
  return (
    <div className={`sb-side sb-${side}`}>
      <div className="sb-head">
        <span>
          {name} <small>({side})</small>
        </span>
        <span>
          {alive}/{players.length} alive
        </span>
      </div>
      {players.map((p) => (
        <button
          key={p.name}
          className={`sb-row ${p.alive ? "" : "dead"} ${follow === p.name ? "sel" : ""}`}
          onClick={() => onSelect(p.name)}
          title="Follow this player"
        >
          <span className="sb-name">{p.name}</span>
          <span className="sb-hp">
            <i style={{ width: `${p.alive ? Math.max(0, Math.min(100, p.hp)) : 0}%` }} />
            <em>{p.alive ? p.hp : "✕"}</em>
          </span>
          <span className="sb-armor">{p.armor > 0 ? (p.helmet ? "⛑" : "◈") : ""}{p.defuser ? " ✂" : ""}</span>
          <span className="sb-wpn">{p.alive ? weaponLabel(p.active_weapon) : ""}</span>
          <span className="sb-money">{fmtMoney(p.money)}</span>
        </button>
      ))}
    </div>
  );
}

export function Scoreboard({ players, teamNames, follow, onSelect }: Props) {
  const by = (s: Side) => players.filter((p) => p.side === s).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="hud-panel scoreboard">
      {(["CT", "T"] as const).map((s) => (
        <SideTable key={s} side={s} players={by(s)} name={teamNames[s]} follow={follow} onSelect={onSelect} />
      ))}
    </div>
  );
}
