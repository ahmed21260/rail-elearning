// Nacelle rail-route caténaire : porteur, stabilisateurs, tourelle, bras articulés, panier auto-nivelé.
import * as THREE from "three";
import { MAT, box, cyl, wheel, ram, hazardMat, RoadRail } from "./roadrail.js";

export const NAC = {
  low: 4.6,
  up: 4.4,
  limits: { slew: [-Math.PI, Math.PI], lower: [0.02, 1.35], upper: [-3.05, 0.35] },
  transport: { slew: 0, lower: 0.02, upper: -3.05 },
};

export function buildNacelle(scene) {
  const root = new THREE.Group();
  const hz = hazardMat();
  // Porteur
  box(root, [2.3, 0.45, 7.2], [0, 1.0, 0.2], MAT.dark);
  box(root, [2.45, 0.3, 4.6], [0, 1.35, 1.2], MAT.white); // plateau
  box(root, [2.5, 0.18, 0.25], [0, 1.0, 3.85], hz);
  const cab = new THREE.Group();
  cab.position.set(0, 1.2, -2.45);
  root.add(cab);
  box(cab, [2.4, 1.9, 2.0], [0, 1.0, 0], MAT.orange);
  box(cab, [2.42, 0.9, 1.4], [0, 1.45, -0.35], MAT.glass);
  box(cab, [2.44, 0.12, 0.2], [0, 0.45, -1.02], MAT.dark);
  const beacon = cyl(cab, 0.1, 0.16, [0.8, 2.05, 0.6], MAT.beacon, "y", 12);
  const beacon2 = cyl(cab, 0.1, 0.16, [-0.8, 2.05, 0.6], MAT.beacon, "y", 12);
  for (const [x, z] of [[-0.95, -2.1], [0.95, -2.1], [-0.95, 1.9], [0.95, 1.9]]) wheel(root, 0.5, 0.5, [x, 0.5, z], z > 0);
  const guideArms = [];
  for (const z of [-3.35, 3.6]) {
    const arm = new THREE.Group();
    arm.position.set(0, 0.75, z);
    box(arm, [1.7, 0.16, 0.2], [0, -0.08, 0], MAT.dark);
    for (const x of [-0.7175, 0.7175]) {
      const w = cyl(arm, 0.22, 0.12, [x, -0.25, 0], MAT.steel, "x");
      cyl(w, 0.26, 0.03, [-Math.sign(x) * 0.06, 0, 0], MAT.steel, "x");
    }
    root.add(arm);
    guideArms.push((k) => {
      arm.position.y = 0.75 - 0.25 * k;
      arm.rotation.x = (1 - k) * 0.5 * Math.sign(z);
    });
  }
  // Stabilisateurs (poutre télescopique + vérin + patin)
  const stabs = [];
  for (const [side, z] of [[-1, -0.9], [1, -0.9], [-1, 3.3], [1, 3.3]]) {
    const g = new THREE.Group();
    g.position.set(side * 1.1, 1.05, z);
    root.add(g);
    const beam = box(g, [0.6, 0.18, 0.2], [side * 0.3, 0, 0], MAT.yellow);
    const leg = new THREE.Group();
    g.add(leg);
    box(leg, [0.14, 1.0, 0.14], [0, -0.5, 0], MAT.chrome);
    const pad = box(leg, [0.45, 0.06, 0.45], [0, -1.02, 0], MAT.dark);
    stabs.push((k) => {
      const ext = 0.9 * Math.min(1, k * 2);
      const down = Math.max(0, k * 2 - 1);
      beam.position.x = side * (0.3 + ext / 2);
      beam.scale.x = 1 + ext / 0.6;
      leg.position.x = side * (0.55 + ext);
      leg.position.y = 0.3 - 0.35 * down - 0.4 * (1 - down);
      leg.scale.y = 0.4 + 0.6 * down;
      pad.visible = down > 0.05;
    });
  }
  // Tourelle et bras
  const turret = new THREE.Group();
  turret.position.set(0, 1.55, 2.2);
  root.add(turret);
  cyl(turret, 0.6, 0.3, [0, 0.15, 0], MAT.dark, "y", 24);
  box(turret, [1.0, 0.8, 1.1], [0, 0.65, 0.1], MAT.white);
  const lower = new THREE.Group();
  lower.position.set(0, 1.0, 0);
  turret.add(lower);
  const lg = new THREE.BoxGeometry(0.34, 0.36, NAC.low);
  lg.translate(0, 0, -NAC.low / 2);
  const lm = new THREE.Mesh(lg, MAT.white);
  lm.castShadow = true;
  lower.add(lm);
  const upperP = new THREE.Group();
  upperP.position.set(0, 0, -NAC.low);
  lower.add(upperP);
  const ug = new THREE.BoxGeometry(0.28, 0.3, NAC.up);
  ug.translate(0, 0, -NAC.up / 2);
  const um = new THREE.Mesh(ug, MAT.white);
  um.castShadow = true;
  upperP.add(um);
  // Isolant (bande orange) sur le bras supérieur
  box(upperP, [0.3, 0.32, 0.8], [0, 0, -NAC.up + 0.7], MAT.orange);
  const basketP = new THREE.Group();
  basketP.position.set(0, 0, -NAC.up);
  upperP.add(basketP);
  const basket = new THREE.Group();
  basketP.add(basket);
  box(basket, [1.7, 0.08, 1.0], [0, -0.1, -0.4], MAT.dark);
  for (const [w, d, x, z] of [[1.7, 0.05, 0, -0.9], [1.7, 0.05, 0, 0.1], [0.05, 1.0, -0.85, -0.4], [0.05, 1.0, 0.85, -0.4]]) {
    box(basket, [w, 0.05, d], [x, 1.0, z], MAT.orange);
    box(basket, [w, 0.05, d], [x, 0.5, z], MAT.orange);
  }
  for (const [x, z] of [[-0.85, -0.9], [0.85, -0.9], [-0.85, 0.1], [0.85, 0.1]]) box(basket, [0.05, 1.05, 0.05], [x, 0.45, z], MAT.orange);
  box(basket, [1.7, 0.45, 0.04], [0, 0.12, -0.9], hazardMat());
  const rams = [
    ram(scene, turret, new THREE.Vector3(0, 0.5, -0.4), lower, new THREE.Vector3(0, -0.2, -1.8), 0.08),
    ram(scene, lower, new THREE.Vector3(0, 0.25, -NAC.low + 1.2), upperP, new THREE.Vector3(0, 0.25, -0.8), 0.07),
  ];
  scene.add(root);

  const rr = new RoadRail(root, { wheelbase: 4.0, rideHeight: 0.0, railLift: 0.05, maxRoad: 25 / 3.6, maxRail: 20 / 3.6 });
  rr.guideArms = guideArms;
  const joints = { ...NAC.transport };
  const state = { stab: 0 };
  const apply = () => {
    turret.rotation.y = joints.slew;
    lower.rotation.x = joints.lower;
    upperP.rotation.x = joints.upper;
    basketP.rotation.x = -(joints.lower + joints.upper); // nivellement automatique
    for (const f of stabs) f(state.stab);
  };
  apply();
  const tmp = new THREE.Vector3();
  return {
    rr,
    root,
    cab,
    beacons: [beacon, beacon2],
    joints,
    state,
    basket,
    move(dt, cmd) {
      const L = NAC.limits;
      joints.slew = Math.min(L.slew[1], Math.max(L.slew[0], joints.slew + (cmd.slew || 0) * 0.3 * dt));
      joints.lower = Math.min(L.lower[1], Math.max(L.lower[0], joints.lower + (cmd.lower || 0) * 0.22 * dt));
      joints.upper = Math.min(L.upper[1], Math.max(L.upper[0], joints.upper + (cmd.upper || 0) * 0.3 * dt));
      apply();
    },
    setStab(k) {
      state.stab = Math.min(1, Math.max(0, k));
      apply();
    },
    /** Centre du plancher du panier et point de travail (main de l'opérateur, 1,6 m au-dessus). */
    basketPos() {
      root.updateMatrixWorld(true);
      return basket.localToWorld(tmp.set(0, 0, -0.4)).clone();
    },
    workPoint() {
      root.updateMatrixWorld(true);
      return basket.localToWorld(new THREE.Vector3(0, 1.6, -0.9));
    },
    isTransport() {
      return joints.lower < 0.06 && joints.upper < -2.95;
    },
    update() {
      for (const f of rams) f();
    },
  };
}
