import type { PlayerState, Side } from "../api/types";

/** `AGGRO_AWP_3` -> `AGGRO_AWP`. Mirrors `team_of_bot` in live.rs. */
export function teamOfBot(name: string): string {
  const i = name.lastIndexOf("_");
  if (i < 0) return name;
  const n = name.slice(i + 1);
  return n.length > 0 && /^[0-9]+$/.test(n) ? name.slice(0, i) : name;
}

/** Most common team prefix among the players on `side` (null if none). */
export function teamNameForSide(players: PlayerState[], side: Side): string | null {
  const counts = new Map<string, number>();
  for (const p of players) {
    if (p.side !== side) continue;
    const t = teamOfBot(p.name);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [t, n] of counts) {
    if (n > bestN) {
      best = t;
      bestN = n;
    }
  }
  return best;
}

export const SIDE_COLOR: Record<Side, string> = { CT: "#5aa9ff", T: "#ff9a3c" };
