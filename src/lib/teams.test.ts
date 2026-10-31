import { describe, expect, it } from "vitest";
import { teamNameForSide, teamOfBot } from "./teams";
import type { PlayerState } from "../api/types";

describe("teamOfBot", () => {
  it("strips a numeric suffix (same cases as live.rs)", () => {
    expect(teamOfBot("AGGRO_AWP_3")).toBe("AGGRO_AWP");
    expect(teamOfBot("SOLO")).toBe("SOLO");
    expect(teamOfBot("X_Y")).toBe("X_Y");
    expect(teamOfBot("X_")).toBe("X_");
    expect(teamOfBot("TEAM_12")).toBe("TEAM");
  });
});

describe("teamNameForSide", () => {
  const p = (name: string, side: "CT" | "T") => ({ name, side }) as PlayerState;
  it("picks the majority prefix for the side", () => {
    const players = [p("A_1", "CT"), p("A_2", "CT"), p("B_1", "CT"), p("B_2", "T")];
    expect(teamNameForSide(players, "CT")).toBe("A");
    expect(teamNameForSide(players, "T")).toBe("B");
    expect(teamNameForSide([], "T")).toBeNull();
  });
});
