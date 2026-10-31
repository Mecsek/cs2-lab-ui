// Tiny synthetic CS2 match simulator for UI development. Not realistic, just plausible:
// 10 bots wander between spawns and bombsites, shoot each other, plant/defuse, throw nades.
// Emits objects shaped exactly like lab-core `LiveFrame` / `GameEvent` (see src/api/types.ts).

const TICK_RATE = 64;
const FRAME_TICKS = 4; // 16 frames/s
const FREEZE_S = 3;
const ROUND_S = 75;
const OVER_S = 4;
const BOMB_S = 40;
const DEFUSE_S = 5;
const WIN_ROUNDS = 13;
const HALF = 12;

const CT_SPAWN = [1200, 1500, 0];
const T_SPAWN = [-1400, -1300, 0];
const SITES = { A: [1100, -500, 0], B: [-900, 1100, 0] };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const jitter = (p, r) => [p[0] + rnd(-r, r), p[1] + rnd(-r, r), 0];
const heightAt = (x, y) => Math.round(40 * Math.sin(x / 700) + 30 * Math.cos(y / 500)); // gentle "terrain"

export class Sim {
  constructor({ teamA, teamB, map = "de_mock" }) {
    this.teamA = teamA;
    this.teamB = teamB;
    this.map = map;
    this.tick = Math.floor(rnd(1000, 50000));
    this.round = 0;
    this.scoreA = 0;
    this.scoreB = 0;
    this.rounds = []; // RoundSummary
    this.finished = false;
    this.players = [];
    for (let i = 1; i <= 5; i++) this.players.push(this.#newPlayer(`${teamA}_${i}`));
    for (let i = 1; i <= 5; i++) this.players.push(this.#newPlayer(`${teamB}_${i}`));
    this.#startRound();
  }

  #newPlayer(name) {
    return {
      name,
      side: "CT",
      alive: true,
      hp: 100,
      armor: 0,
      helmet: false,
      defuser: false,
      money: 800,
      equip_value: 200,
      pos: [0, 0, 0],
      yaw: 0,
      pitch: 0,
      active_weapon: "weapon_knife",
      weapons: ["weapon_knife"],
      flash: 0,
      _target: null,
    };
  }

  /** Team a is CT in the first half. */
  sideOfTeamA() {
    return this.round <= HALF ? "CT" : "T";
  }
  get scoreCt() {
    return this.sideOfTeamA() === "CT" ? this.scoreA : this.scoreB;
  }
  get scoreT() {
    return this.sideOfTeamA() === "CT" ? this.scoreB : this.scoreA;
  }

  #startRound() {
    this.round += 1;
    this.phase = "freezetime";
    this.phaseEnds = this.tick + FREEZE_S * TICK_RATE;
    this.roundTimeLeft = ROUND_S;
    this.bomb = { planted: false, site: null, time_left: null, defusing: false, pos: null };
    this.defuseStart = null;
    this.events = [{ tick: this.tick, kind: "round_start", round: this.round }];
    const aSide = this.sideOfTeamA();
    if (this.round === HALF + 1) for (const p of this.players) p.money = 800; // halftime reset
    for (const p of this.players) {
      p.side = p.name.startsWith(this.teamA + "_") ? aSide : aSide === "CT" ? "T" : "CT";
      p.alive = true;
      p.hp = 100;
      p.flash = 0;
      p.pos = jitter(p.side === "CT" ? CT_SPAWN : T_SPAWN, 250);
      p.pos[2] = heightAt(p.pos[0], p.pos[1]);
      p.yaw = p.side === "CT" ? -120 : 45;
      p._target = null;
      this.#buy(p);
    }
    const ts = this.players.filter((p) => p.side === "T");
    pick(ts).weapons.push("weapon_c4");
    this.siteGoal = pick(["A", "B"]);
  }

  #buy(p) {
    const pistol = p.side === "CT" ? "weapon_usp_silencer" : "weapon_glock";
    const rifle = p.side === "CT" ? "weapon_m4a1" : "weapon_ak47";
    p.weapons = ["weapon_knife", pistol];
    p.armor = 0;
    p.helmet = false;
    p.defuser = false;
    let value = 200;
    if (p.money >= 4000) {
      const awp = p.name.endsWith("_1") && p.money >= 6000;
      p.weapons.push(awp ? "weapon_awp" : rifle);
      p.money -= awp ? 4750 : 2900;
      value += awp ? 4750 : 2900;
      p.armor = 100;
      p.helmet = true;
      p.money -= 1000;
      value += 1000;
      if (p.money >= 300) {
        p.weapons.push(pick(["weapon_smokegrenade", "weapon_hegrenade", "weapon_flashbang", "weapon_molotov"]));
        p.money -= 300;
        value += 300;
      }
      if (p.side === "CT" && p.money >= 400) {
        p.defuser = true;
        p.money -= 400;
        value += 400;
      }
    } else if (p.money >= 1500 && Math.random() < 0.5) {
      p.weapons.push("weapon_deagle");
      p.money -= 700;
      value += 700;
      p.armor = 100;
      p.money -= 650;
      value += 650;
    }
    p.active_weapon = p.weapons[p.weapons.length - 1].includes("grenade") || p.weapons[p.weapons.length - 1] === "weapon_flashbang" || p.weapons[p.weapons.length - 1] === "weapon_molotov"
      ? p.weapons[2] ?? pistol
      : p.weapons[p.weapons.length - 1];
    p.equip_value = value;
  }

  #emit(e) {
    this.events.push({ tick: this.tick, ...e });
  }

  #endRound(winner, reason) {
    if (this.phase === "over") return;
    this.phase = "over";
    this.phaseEnds = this.tick + OVER_S * TICK_RATE;
    this.bomb.defusing = false;
    const aWon = winner === this.sideOfTeamA();
    if (aWon) this.scoreA++;
    else this.scoreB++;
    this.rounds.push({
      round: this.round,
      winner_side: winner,
      winner_team: aWon ? this.teamA : this.teamB,
      reason,
      end_tick: this.tick,
    });
    this.#emit({ kind: "round_end", round: this.round, winner, reason });
    for (const p of this.players) p.money = Math.min(16000, p.money + (p.side === winner ? 3250 : 1900));
    if (this.scoreA >= WIN_ROUNDS || this.scoreB >= WIN_ROUNDS || this.round >= 2 * HALF) {
      this.#emit({ kind: "match_end", score_ct: this.scoreCt, score_t: this.scoreT });
      this.finished = true;
    }
  }

  /** Advances one frame (4 ticks). Returns { frame, events, winProb|null }. */
  step() {
    this.events = this.events ?? [];
    const out = [];
    this.tick += FRAME_TICKS;
    const dt = FRAME_TICKS / TICK_RATE;

    if (this.phase === "freezetime" && this.tick >= this.phaseEnds) {
      this.phase = "live";
      this.#emit({ kind: "freeze_end", round: this.round });
    } else if (this.phase === "over" && this.tick >= this.phaseEnds && !this.finished) {
      const pending = this.events;
      this.#startRound();
      this.events = [...pending, ...this.events];
    }

    if (this.phase === "live") this.#simulateLive(dt);

    const frame = this.frame();
    out.push(...this.events);
    this.events = [];
    const winProb =
      this.phase === "live" && (this.frameCount = (this.frameCount ?? 0) + 1) % 4 === 0
        ? { tick: this.tick, round: this.round, p_ct: this.#winProb() }
        : null;
    return { frame, events: out, winProb };
  }

  #simulateLive(dt) {
    if (!this.bomb.planted) {
      this.roundTimeLeft = Math.max(0, this.roundTimeLeft - dt);
      if (this.roundTimeLeft <= 0) return this.#endRound("CT", "target_saved");
    } else {
      this.bomb.time_left = Math.max(0, this.bomb.time_left - dt);
      if (this.bomb.time_left <= 0) {
        this.#emit({ kind: "bomb_exploded", site: this.bomb.site });
        for (const p of this.players) if (p.alive && dist2d(p.pos, this.bomb.pos) < 600) this.#die(p, null, "planted_c4");
        return this.#endRound("T", "target_bombed");
      }
    }

    const alive = this.players.filter((p) => p.alive);
    const site = SITES[this.siteGoal];
    for (const p of alive) {
      // choose a target
      const carrier = p.weapons.includes("weapon_c4");
      if (this.bomb.planted && p.side === "CT") p._target = this.bomb.pos;
      else if (!this.bomb.planted && this.bomb.pos && p.side === "T" && !this.#carrier()) p._target = this.bomb.pos;
      else if (!p._target || dist2d(p.pos, p._target) < 60) {
        p._target = carrier ? jitter(site, 80) : p.side === "T" ? jitter(site, 700) : jitter(pick([SITES.A, SITES.B]), 600);
      }
      const d = dist2d(p.pos, p._target);
      if (d > 20) {
        const speed = (carrier ? 200 : 230) * dt;
        const k = Math.min(1, speed / d);
        const dx = p._target[0] - p.pos[0];
        const dy = p._target[1] - p.pos[1];
        p.pos = [p.pos[0] + dx * k, p.pos[1] + dy * k, 0];
        p.pos[2] = heightAt(p.pos[0], p.pos[1]);
        const wantYaw = (Math.atan2(dy, dx) * 180) / Math.PI;
        p.yaw = wantYaw + rnd(-15, 15);
      }
      p.pitch = rnd(-3, 6);
      p.flash = Math.max(0, p.flash - dt);

      // pick up dropped bomb
      if (p.side === "T" && !this.bomb.planted && this.bomb.pos && !this.#carrier() && dist2d(p.pos, this.bomb.pos) < 60) {
        p.weapons.push("weapon_c4");
        this.bomb.pos = null;
      }
      // plant
      if (carrier && dist2d(p.pos, site) < 120) {
        p.weapons = p.weapons.filter((w) => w !== "weapon_c4");
        this.bomb = { planted: true, site: this.siteGoal, time_left: BOMB_S, defusing: false, pos: [...p.pos] };
        this.#emit({ kind: "bomb_planted", player: p.name, site: this.siteGoal });
      }
      // grenades
      const nade = p.weapons.find((w) => /grenade|flashbang|molotov/.test(w));
      if (nade && Math.random() < 0.004) {
        p.weapons = p.weapons.filter((w) => w !== nade);
        const yaw = (p.yaw * Math.PI) / 180;
        const r = rnd(300, 900);
        const pos = [p.pos[0] + Math.cos(yaw) * r, p.pos[1] + Math.sin(yaw) * r, 0];
        pos[2] = heightAt(pos[0], pos[1]);
        const grenade = { weapon_smokegrenade: "smoke", weapon_hegrenade: "he", weapon_flashbang: "flash", weapon_molotov: "molotov" }[nade] ?? "decoy";
        this.#emit({ kind: "grenade_detonate", thrower: p.name, grenade, pos });
        if (grenade === "flash")
          for (const q of alive) if (dist2d(q.pos, pos) < 500) q.flash = rnd(0.5, 2.5);
      }
    }

    // combat
    for (const a of alive) {
      if (!a.alive) continue;
      for (const b of alive) {
        if (!b.alive || a.side === b.side) continue;
        const d = dist2d(a.pos, b.pos);
        if (d > 1100 || Math.random() > 0.035) continue;
        a.yaw = (Math.atan2(b.pos[1] - a.pos[1], b.pos[0] - a.pos[0]) * 180) / Math.PI;
        const dmg = Math.round(rnd(15, 45) * (a.active_weapon === "weapon_awp" ? 4 : 1));
        const hs = Math.random() < 0.2;
        const total = hs ? dmg * 3 : dmg;
        b.hp -= total;
        this.#emit({
          kind: "hurt",
          attacker: a.name,
          victim: b.name,
          weapon: a.active_weapon.replace(/^weapon_/, ""),
          damage: Math.min(total, b.hp + total),
          armor_damage: b.armor > 0 ? 5 : 0,
          hitgroup: hs ? 1 : 2,
        });
        if (b.hp <= 0) {
          const assister = alive.find((x) => x.alive && x !== a && x.side === a.side && dist2d(x.pos, b.pos) < 700);
          this.#die(b, a, a.active_weapon.replace(/^weapon_/, ""), hs, assister?.name ?? null);
        }
      }
    }

    // defuse
    if (this.bomb.planted) {
      const defuser = this.players.find((p) => p.alive && p.side === "CT" && dist2d(p.pos, this.bomb.pos) < 90);
      if (defuser) {
        if (!this.bomb.defusing) {
          this.bomb.defusing = true;
          this.defuseStart = this.tick;
        }
        const need = (defuser.defuser ? DEFUSE_S : DEFUSE_S * 2) * TICK_RATE;
        if (this.tick - this.defuseStart >= need) {
          this.#emit({ kind: "bomb_defused", player: defuser.name, site: this.bomb.site });
          return this.#endRound("CT", "bomb_defused");
        }
      } else this.bomb.defusing = false;
    }

    const ctAlive = this.players.some((p) => p.alive && p.side === "CT");
    const tAlive = this.players.some((p) => p.alive && p.side === "T");
    if (!ctAlive) return this.#endRound("T", "ct_killed");
    if (!tAlive && !this.bomb.planted) return this.#endRound("CT", "t_killed");
  }

  #carrier() {
    return this.players.find((p) => p.alive && p.weapons.includes("weapon_c4"));
  }

  #die(p, attacker, weapon, headshot = false, assister = null) {
    if (!p.alive) return;
    p.alive = false;
    p.hp = 0;
    if (p.weapons.includes("weapon_c4")) {
      p.weapons = p.weapons.filter((w) => w !== "weapon_c4");
      this.bomb.pos = [...p.pos];
    }
    if (attacker) attacker.money = Math.min(16000, attacker.money + 300);
    this.#emit({
      kind: "kill",
      attacker: attacker?.name ?? null,
      victim: p.name,
      assister,
      weapon,
      headshot,
      attacker_pos: attacker ? [...attacker.pos] : null,
      victim_pos: [...p.pos],
    });
  }

  #winProb() {
    const ct = this.players.filter((p) => p.alive && p.side === "CT").length;
    const t = this.players.filter((p) => p.alive && p.side === "T").length;
    let x = 0.55 * (ct - t);
    if (this.bomb.planted) x -= 1.2;
    return 1 / (1 + Math.exp(-x));
  }

  frame() {
    const carrier = this.#carrier();
    if (carrier && !this.bomb.planted) this.bomb.pos = [...carrier.pos];
    return {
      tick: this.tick,
      map: this.map,
      round: this.round,
      phase: this.phase,
      round_time_left: this.phase === "freezetime" ? ROUND_S : this.roundTimeLeft,
      score_ct: this.scoreCt,
      score_t: this.scoreT,
      bomb: {
        ...this.bomb,
        pos: this.bomb.pos ? [...this.bomb.pos] : null,
        time_left: this.bomb.time_left != null ? Math.round(this.bomb.time_left * 10) / 10 : null,
      },
      players: this.players.map(({ _target, ...p }) => ({ ...p, pos: p.pos.map((v) => Math.round(v * 10) / 10), weapons: [...p.weapons] })),
    };
  }
}

/** Runs a sim offline for `rounds` rounds and returns a replay payload (frames every 8 ticks). */
export function simulateReplay({ teamA, teamB, map, rounds = 4 }) {
  const sim = new Sim({ teamA, teamB, map });
  const frames = [];
  const events = [];
  let n = 0;
  while (!sim.finished && sim.round <= rounds) {
    const { frame, events: evs } = sim.step();
    events.push(...evs);
    if (n++ % 2 === 0) frames.push(frame);
    if (n > 200_000) break;
  }
  return { tick_rate: TICK_RATE, frames, events, sim };
}

export { TICK_RATE, FRAME_TICKS };
