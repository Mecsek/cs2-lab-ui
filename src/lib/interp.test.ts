import { describe, expect, it } from "vitest";
import type { LiveFrame, PlayerState } from "../api/types";
import { advanceLiveClock, bracket, frameIndexAt, lerpAngleDeg, samplePlayers } from "./interp";

const player = (pos: [number, number, number], yaw = 0, alive = true): PlayerState => ({
  name: "A_1",
  side: "CT",
  alive,
  hp: 100,
  armor: 0,
  helmet: false,
  defuser: false,
  money: 800,
  equip_value: 200,
  pos,
  yaw,
  pitch: 0,
  active_weapon: "weapon_knife",
  weapons: [],
});

const frame = (tick: number, players: PlayerState[]): LiveFrame => ({
  tick,
  map: "de_test",
  round: 1,
  phase: "live",
  round_time_left: 100,
  score_ct: 0,
  score_t: 0,
  bomb: { planted: false, site: null, time_left: null, defusing: false, pos: null },
  players,
});

describe("lerpAngleDeg", () => {
  it("takes the short way around", () => {
    expect(Math.abs(lerpAngleDeg(170, -170, 0.5))).toBeCloseTo(180, 6);
    expect(Math.abs(lerpAngleDeg(-170, 170, 0.5))).toBeCloseTo(180, 6);
    expect(lerpAngleDeg(10, 30, 0.5)).toBeCloseTo(20, 6);
    expect(lerpAngleDeg(350, 10, 0.25)).toBeCloseTo(-5, 6);
  });
});

describe("frame lookup", () => {
  const frames = [frame(0, []), frame(8, []), frame(16, [])];
  it("finds the last frame at or before tick", () => {
    expect(frameIndexAt(frames, -1)).toBe(-1);
    expect(frameIndexAt(frames, 0)).toBe(0);
    expect(frameIndexAt(frames, 15.9)).toBe(1);
    expect(frameIndexAt(frames, 99)).toBe(2);
  });
  it("brackets and clamps", () => {
    expect(bracket(frames, 12)!.t).toBeCloseTo(0.5);
    expect(bracket(frames, 100)!.a.tick).toBe(16);
    expect(bracket(frames, -5)!.a.tick).toBe(0);
    expect(bracket([], 0)).toBeNull();
  });
});

describe("samplePlayers", () => {
  it("interpolates position and yaw", () => {
    const frames = [frame(0, [player([0, 0, 0], 170)]), frame(8, [player([100, 0, 0], -170)])];
    const [p] = samplePlayers(frames, 4);
    expect(p.pos[0]).toBeCloseTo(50);
    expect(Math.abs(p.yaw)).toBeCloseTo(180);
  });
  it("snaps on teleports instead of lerping", () => {
    const frames = [frame(0, [player([0, 0, 0])]), frame(8, [player([5000, 0, 0])])];
    expect(samplePlayers(frames, 2)[0].pos[0]).toBe(0);
    expect(samplePlayers(frames, 6)[0].pos[0]).toBe(5000);
  });
});

describe("advanceLiveClock", () => {
  it("snaps when far from target, then advances at tick rate", () => {
    expect(advanceLiveClock(NaN, 1000, 0.016, 64, 8)).toBe(992);
    const next = advanceLiveClock(992, 1000, 0.1, 64, 8);
    expect(next).toBeGreaterThan(992);
    expect(next).toBeLessThanOrEqual(1000);
  });
  it("never runs past the newest frame", () => {
    expect(advanceLiveClock(999, 1000, 0.5, 64, 8)).toBeLessThanOrEqual(1000);
  });
});
