// Pelle rail-route (type pelle sur pneus avec galets de guidage) : tourelle, flèche, balancier, godet.
import * as THREE from "three";
import { MAT, box, cyl, wheel, ram, hazardMat, RoadRail } from "./roadrail.js";

export const EXC = {
  boomLen: 5.4,
  stickLen: 2.9,
  pivot: new THREE.Vector3(0.45, 1.95, -0.95), // pied de flèche dans la tourelle
  limits: { boom: [-0.55, 1.15], stick: [-2.55, -0.45], bucket: [-1.9, 1.2] },
};

function bucketGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(-0.25, -0.2);
  s.quadraticCurveTo(-0.55, -0.95, -1.05, -0.95);
  s.lineTo(-1.15, -0.8);
  s.quadraticCurveTo(-0.7, -0.55, -0.55, 0.05);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  g.rotateY(-Math.PI / 2); // profil dans le plan (−Z, Y)
  return g;
}

export function buildExcavator(scene) {
  const root = new THREE.Group();
  const hz = hazardMat();
  // Châssis porteur
  box(root, [2.45, 0.7, 5.6], [0, 0.95, 0], MAT.dark);
  box(root, [2.5, 0.25, 5.7], [0, 1.4, 0], MAT.yellow);
  box(root, [2.55, 0.2, 0.3], [0, 0.95, -2.85], hz);
  box(root, [2.55, 0.2, 0.3], [0, 0.95, 2.85], hz);
  // Lame / stabilisateur avant
  box(root, [2.5, 0.55, 0.12], [0, 0.55, -3.05], MAT.yellow);
  // Roues route jumelées
  const wheels = [];
  for (const z of [-1.7, 1.7]) for (const x of [-0.95, 0.95]) wheels.push(wheel(root, 0.55, 0.55, [x, 0.55, z], true));
  // Essieux rail (galets de guidage) avant/arrière, articulés
  const guideArms = [];
  for (const z of [-2.55, 2.55]) {
    const arm = new THREE.Group();
    arm.position.set(0, 0.85, z);
    box(arm, [1.7, 0.18, 0.22], [0, -0.1, 0], MAT.dark);
    for (const x of [-0.7175, 0.7175]) {
      const w = cyl(arm, 0.24, 0.12, [x, -0.28, 0], MAT.steel, "x");
      cyl(w, 0.28, 0.03, [-Math.sign(x) * 0.06, 0, 0], MAT.steel, "x"); // boudin
    }
    root.add(arm);
    guideArms.push((k) => {
      arm.position.y = 0.85 - 0.28 * k;
      arm.rotation.x = (1 - k) * 0.5 * Math.sign(z);
    });
  }
  // Tourelle
  const upper = new THREE.Group();
  upper.position.y = 1.55;
  root.add(upper);
  cyl(upper, 1.0, 0.22, [0, 0.05, 0], MAT.dark, "y", 28);
  // Tourelle à rayon arrière court (« short tail ») : reste dans le gabarit de sa voie
  box(upper, [2.45, 0.9, 2.6], [0, 0.65, 0.2], MAT.yellow);
  box(upper, [2.5, 0.95, 0.75], [0, 0.72, 1.8], MAT.dark); // contrepoids
  box(upper, [2.52, 0.22, 0.77], [0, 0.35, 1.8], hz);
  box(upper, [1.3, 0.55, 1.6], [0.55, 1.3, 0.7], MAT.yellow); // capot moteur
  box(upper, [0.12, 0.8, 0.12], [1.0, 1.95, 1.2], MAT.dark); // échappement
  // Cabine (gauche)
  const cab = new THREE.Group();
  cab.position.set(-0.62, 1.1, -0.45);
  upper.add(cab);
  box(cab, [1.0, 1.75, 1.6], [0, 0.88, 0], MAT.dark);
  box(cab, [1.02, 1.25, 1.2], [0, 1.1, -0.15], MAT.glass);
  box(cab, [1.04, 0.08, 1.64], [0, 1.78, 0], MAT.yellow);
  const beacon = cyl(cab, 0.09, 0.14, [0.3, 1.9, 0.5], MAT.beacon, "y", 12);
  // Flèche, balancier, godet
  const boomPivot = new THREE.Group();
  boomPivot.position.copy(EXC.pivot);
  upper.add(boomPivot);
  const boom = new THREE.Group();
  boomPivot.add(boom);
  const boomG = new THREE.BoxGeometry(0.42, 0.6, EXC.boomLen);
  boomG.translate(0, 0, -EXC.boomLen / 2);
  // Flèche coudée : légère courbure via deux segments
  const bm = new THREE.Mesh(boomG, MAT.yellow);
  bm.castShadow = true;
  boom.add(bm);
  box(boom, [0.46, 0.2, EXC.boomLen * 0.6], [0, 0.38, -EXC.boomLen * 0.45], MAT.yellow);
  const stickPivot = new THREE.Group();
  stickPivot.position.set(0, 0, -EXC.boomLen);
  boom.add(stickPivot);
  const stickG = new THREE.BoxGeometry(0.34, 0.46, EXC.stickLen + 0.5);
  stickG.translate(0, 0, -EXC.stickLen / 2 + 0.25);
  const st = new THREE.Mesh(stickG, MAT.yellow);
  st.castShadow = true;
  stickPivot.add(st);
  const bucketPivot = new THREE.Group();
  bucketPivot.position.set(0, 0, -EXC.stickLen);
  stickPivot.add(bucketPivot);
  const bucket = new THREE.Mesh(bucketGeometry(), MAT.dark);
  bucket.castShadow = true;
  bucketPivot.add(bucket);
  const load = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 1 }));
  load.scale.set(1.1, 0.6, 1.0);
  load.position.set(0, -0.45, -0.55);
  load.visible = false;
  bucketPivot.add(load);
  const tipLocal = new THREE.Vector3(0, -0.9, -1.1);
  const rams = [
    ram(scene, upper, new THREE.Vector3(0.45, 1.2, -1.5), boom, new THREE.Vector3(0, -0.4, -2.2), 0.09),
    ram(scene, boom, new THREE.Vector3(0, 0.5, -1.2), stickPivot, new THREE.Vector3(0, 0.45, 0.5), 0.08),
    ram(scene, stickPivot, new THREE.Vector3(0, 0.35, -0.6), bucketPivot, new THREE.Vector3(0, 0.25, 0.15), 0.06),
  ];
  scene.add(root);

  const rr = new RoadRail(root, { wheelbase: 3.4, rideHeight: 0.0, railLift: 0.06, maxRoad: 20 / 3.6, maxRail: 20 / 3.6 });
  rr.guideArms = guideArms;
  const joints = { swing: 0, boom: 0.35, stick: -2.1, bucket: 0.9 };
  const tip = new THREE.Vector3();
  const pose = (j) => {
    upper.rotation.y = j.swing;
    boom.rotation.x = j.boom;
    stickPivot.rotation.x = j.stick;
    bucketPivot.rotation.x = j.bucket;
  };
  const apply = () => pose(joints);
  apply();
  return {
    rr,
    root,
    upper,
    cab,
    beacon,
    joints,
    load,
    pose,
    wheels,
    /** Applique les consignes de vitesse articulaire (rad/s) avec butées. */
    move(dt, cmd, clampFn) {
      const L = EXC.limits;
      const next = {
        swing: joints.swing + (cmd.swing || 0) * 0.45 * dt,
        boom: Math.min(L.boom[1], Math.max(L.boom[0], joints.boom + (cmd.boom || 0) * 0.4 * dt)),
        stick: Math.min(L.stick[1], Math.max(L.stick[0], joints.stick + (cmd.stick || 0) * 0.55 * dt)),
        bucket: Math.min(L.bucket[1], Math.max(L.bucket[0], joints.bucket + (cmd.bucket || 0) * 0.9 * dt)),
      };
      const accepted = clampFn ? clampFn(next, { ...joints }) : next;
      Object.assign(joints, accepted);
      apply();
    },
    /** Position monde des dents du godet. */
    tip() {
      root.updateMatrixWorld(true);
      return bucketPivot.localToWorld(tip.copy(tipLocal));
    },
    /** Points de contrôle du gabarit : pied de flèche, articulation, godet. */
    probes() {
      root.updateMatrixWorld(true);
      return [
        boom.localToWorld(new THREE.Vector3(0, 0.3, -EXC.boomLen * 0.5)),
        stickPivot.localToWorld(new THREE.Vector3(0, 0.3, 0)),
        bucketPivot.localToWorld(new THREE.Vector3(0, 0, 0)),
        bucketPivot.localToWorld(tipLocal.clone()),
        upper.localToWorld(new THREE.Vector3(0, 0.7, 2.18)),
      ];
    },
    seat() {
      root.updateMatrixWorld(true);
      return cab.localToWorld(new THREE.Vector3(0, 1.55, 0.1));
    },
    update() {
      for (const f of rams) f();
    },
  };
}
