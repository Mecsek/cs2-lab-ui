import type { EventOf, GameEvent, PlayerState, Side } from "../api/types";
import { weaponLabel } from "../lib/format";

export function KillFeed({ events, players }: { events: GameEvent[]; players: PlayerState[] }) {
  const sideOf = new Map<string, Side>(players.map((p) => [p.name, p.side]));
  const kills = events.filter((e): e is EventOf<"kill"> => e.kind === "kill").slice(-6);
  if (kills.length === 0) return null;
  return (
    <div className="killfeed">
      {kills.map((k) => (
        <div key={`${k.tick}-${k.victim}`} className="kf-row">
          {k.attacker && <span className={`kf-${sideOf.get(k.attacker) ?? "x"}`}>{k.attacker}</span>}
          {k.assister && <span className="kf-assist"> + {k.assister}</span>}
          <span className="kf-wpn">
            {weaponLabel(k.weapon)}
            {k.headshot && " ◎"}
          </span>
          <span className={`kf-${sideOf.get(k.victim) ?? "x"}`}>{k.victim}</span>
        </div>
      ))}
    </div>
  );
}
