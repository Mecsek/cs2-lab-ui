import type { PlayerState, Side } from "../api/types";
import { fmtMoney } from "../lib/format";

function summary(players: PlayerState[], side: Side) {
  const ps = players.filter((p) => p.side === side);
  const money = ps.reduce((a, p) => a + p.money, 0);
  const equip = ps.reduce((a, p) => a + (p.alive ? p.equip_value : 0), 0);
  return { money, equip, n: ps.length };
}

/** Rough buy-type label from average equipment value. */
function buyType(equipPerPlayer: number): string {
  if (equipPerPlayer >= 3800) return "full buy";
  if (equipPerPlayer >= 2000) return "half buy";
  if (equipPerPlayer >= 1000) return "force/pistols";
  return "eco";
}

export function Economy({ players }: { players: PlayerState[] }) {
  return (
    <div className="hud-panel economy">
      {(["CT", "T"] as const).map((s) => {
        const e = summary(players, s);
        return (
          <div key={s} className={`eco-row eco-${s}`}>
            <b>{s}</b>
            <span title="Team bank">{fmtMoney(e.money)}</span>
            <span title="Equipment value (alive)">eq {fmtMoney(e.equip)}</span>
            <small>{e.n ? buyType(e.equip / e.n) : ""}</small>
          </div>
        );
      })}
    </div>
  );
}
