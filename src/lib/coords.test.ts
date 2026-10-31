import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  SOURCE_TO_METERS,
  sourceToThree,
  sourceViewDir,
  threeToSource,
  threeViewDir,
  yawToThreeRotY,
} from "./coords";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("sourceToThree", () => {
  it("maps Z-up to Y-up and scales inches to metres", () => {
    close(sourceToThree([0, 0, 100]), [0, 100 * SOURCE_TO_METERS, 0]);
    close(sourceToThree([100, 0, 0]), [100 * SOURCE_TO_METERS, 0, 0]);
    close(sourceToThree([0, 100, 0]), [0, 0, -100 * SOURCE_TO_METERS]);
  });

  it("round-trips", () => {
    const p: [number, number, number] = [-1234.5, 678.25, 42];
    close(threeToSource(sourceToThree(p)), p);
  });

  it("is a proper rotation (preserves handedness)", () => {
    const x = new THREE.Vector3(...sourceToThree([1, 0, 0], 1));
    const y = new THREE.Vector3(...sourceToThree([0, 1, 0], 1));
    const z = new THREE.Vector3(...sourceToThree([0, 0, 1], 1));
    close(x.clone().cross(y).toArray(), z.toArray());
  });

  it("equals a -90deg rotation about X plus scale", () => {
    const m = new THREE.Matrix4()
      .makeScale(SOURCE_TO_METERS, SOURCE_TO_METERS, SOURCE_TO_METERS)
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    const p = new THREE.Vector3(300, -200, 64).applyMatrix4(m);
    close(sourceToThree([300, -200, 64]), p.toArray());
  });
});

describe("view direction", () => {
  it("yaw 0 looks along +X, yaw 90 along +Y (source)", () => {
    close(sourceViewDir(0, 0), [1, 0, 0]);
    close(sourceViewDir(90, 0), [0, 1, 0]);
  });

  it("positive pitch looks down", () => {
    close(sourceViewDir(0, 90), [0, 0, -1]);
    close(threeViewDir(0, 90), [0, -1, 0]);
  });

  it("yawToThreeRotY rotates +X onto the converted view direction", () => {
    for (const yaw of [0, 45, 90, 180, -135]) {
      const v = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yawToThreeRotY(yaw),
      );
      close(v.toArray(), threeViewDir(yaw, 0));
    }
  });
});
