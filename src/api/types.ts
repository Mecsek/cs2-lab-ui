// Wire types. These MIRROR `cs2-bot-lab/crates/lab-core/src/live.rs` (and `TeamParams`
// from `team.rs`, `Grenade` from `weapons.rs`). Keep them in sync with the Rust source.
//
// Conventions: positions are Source engine units, Z-up, `[x, y, z]`; yaw/pitch in degrees.
// serde: `EventKind` is internally tagged with `kind` and flattened next to `tick` in
// `GameEvent`; `UiMessage` is tagged with `type` (snake_case) and its newtype variants
// (`frame`, `event`) inline their fields next to `type`.

export type Vec3 = [number, number, number];

/** serde: `#[serde(rename = "CT" | "T")]` */
export type Side = "CT" | "T";

export type RoundPhase = "warmup" | "freezetime" | "live" | "over";

export type BombSite = "A" | "B";

/** `weapons::Grenade`, snake_case. */
export type Grenade = "he" | "flash" | "smoke" | "molotov" | "decoy";

export interface BombState {
  planted: boolean;
  site: BombSite | null;
  /** Seconds until detonation while planted. */
  time_left: number | null;
  defusing: boolean;
  /** Planted, dropped or carried position. */
  pos: Vec3 | null;
}

export interface PlayerState {
  /** Bot name, `<TEAM>_<n>`; unique within a match. */
  name: string;
  side: Side;
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  defuser: boolean;
  money: number;
  /** Game-computed value of the current loadout. */
  equip_value: number;
  /** World position in Source units (Z up). */
  pos: Vec3;
  yaw: number;
  pitch: number;
  active_weapon: string;
  weapons: string[];
  /** Remaining flash blindness, seconds (serde default 0). */
  flash?: number;
}

/** One live snapshot of a server (~16/s). */
export interface LiveFrame {
  tick: number;
  map: string;
  /** 1-based round number. */
  round: number;
  phase: RoundPhase;
  /** Seconds left on the round clock (excluding the bomb timer). */
  round_time_left: number;
  score_ct: number;
  score_t: number;
  bomb: BombState;
  players: PlayerState[];
}

export type EventKind =
  | { kind: "round_start"; round: number }
  | { kind: "freeze_end"; round: number }
  | { kind: "round_end"; round: number; winner: Side; reason: string }
  | {
      kind: "kill";
      attacker: string | null;
      victim: string;
      assister: string | null;
      weapon: string;
      headshot: boolean;
      attacker_pos: Vec3 | null;
      victim_pos: Vec3;
    }
  | {
      kind: "hurt";
      attacker: string | null;
      victim: string;
      weapon: string;
      damage: number;
      armor_damage: number;
      hitgroup: number;
    }
  | { kind: "bomb_planted"; player: string; site: BombSite | null; pos?: Vec3 | null }
  | { kind: "bomb_defused"; player: string; site: BombSite | null }
  | { kind: "bomb_exploded"; site: BombSite | null }
  | { kind: "grenade_detonate"; thrower: string | null; grenade: Grenade; pos: Vec3 }
  | { kind: "match_end"; score_ct: number; score_t: number };

/** `GameEvent { tick, #[serde(flatten)] kind: EventKind }` */
export type GameEvent = { tick: number } & EventKind;

export type EventOf<K extends EventKind["kind"]> = GameEvent & { kind: K };

export interface MatchInfo {
  /** UUID */
  id: string;
  worker: string;
  map: string;
  /** Starts on CT; sides swap at halftime. */
  team_a: string;
  team_b: string;
  status: string;
}

/** api -> UI over `/ws/live/<match_id>`. */
export type UiMessage =
  | { type: "hello"; info: MatchInfo; frame: LiveFrame | null; recent_events: GameEvent[] }
  | ({ type: "frame" } & LiveFrame)
  | ({ type: "event" } & GameEvent)
  | { type: "win_prob"; tick: number; round: number; p_ct: number }
  | { type: "status"; status: string };

export type WinProbPoint = { tick: number; round: number; p_ct: number };

/** `team::TeamParams` */
export interface TeamParams {
  difficulty: number;
  skill: number;
  aggression: number;
  reaction_time: number;
  attack_delay: number;
  teamwork: number;
  /** Number of bots whose first weapon preference is the AWP. */
  awpers: number;
}

// ---- REST (api service) ----

export type MatchStatus = "running" | "finished" | "failed" | "queued";

export interface MatchSummary {
  id: string;
  worker: string;
  map: string;
  /** Starts on CT; sides swap at halftime. */
  team_a: string;
  team_b: string;
  status: MatchStatus;
  score_a: number;
  score_b: number;
  /** ISO timestamp */
  started_at: string;
  finished_at: string | null;
}

export interface RoundSummary {
  round: number;
  winner_side: Side;
  winner_team: string;
  reason: string;
  end_tick: number;
}

export interface MatchDetail {
  match: MatchSummary;
  rounds: RoundSummary[];
}

export interface TeamInfo {
  name: string;
  description: string;
  params: TeamParams;
}

export interface PairStats {
  team_x: string;
  team_y: string;
  map: string;
  matches: number;
  rounds_x: number;
  rounds_y: number;
}

export interface StatsResponse {
  pairs: PairStats[];
}

export interface ReplayData {
  tick_rate: number;
  frames: LiveFrame[];
  events: GameEvent[];
}
