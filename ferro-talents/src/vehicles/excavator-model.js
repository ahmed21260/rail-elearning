// Pelle rail-route réaliste : modèle Sketchfab « Atek 4321 excavator » (Randonavt, CC BY 4.0) recalé sur la
// cinématique du jeu. Les pièces du modèle sont rattachées aux articulations (tourelle, flèche, balancier,
// godet) dans la pose où elles coïncident avec le modèle ; les vérins sont réorientés à chaque image.
// Les points de contrôle du limiteur de hauteur et du gabarit sont extraits de la forme réelle des pièces.
import * as THREE from "three";
import { MAT, cyl, RoadRail } from "./roadrail.js";
import { EXC } from "./excavator.js";

const WHEEL_DIAMETER = 1.05; // m : fixe l'échelle du modèle (pneus jumelés d'une pelle de 13 t)
const PAINT = new THREE.Color(0xf2b705); // jaune engin, sans logo de constructeur

// Répartition des pièces du modèle sur les groupes articulés
const PARTS = {
  boom: ["boom_1"],
  stick: ["boom_2"],
  bucket: ["shovel"],
  // Vérins : [corps (sur le parent), tige (sur l'enfant), parent, enfant]
  rams: [
    ["right_piston_1", "right_piston_2", "upper", "boom"],
    ["left_piston_1", "left_piston_2", "upper", "boom"],
    ["boom_piston_1", "boom_piston_2", "boom", "stick"],
    ["shovel_piston_1", "shovel_piston_2", "stick", "bucket"],
  ],
  chassis: /^(base_frame|.*_wheel$|.*_outriger$)/,
};

/** Peinture : la tôle rouge d'origine devient jaune en gardant la salissure de la texture. */
function repaint(mat) {
  const m = mat.clone();
  m.color.set(0xffffff);
  m.roughness = 0.55;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPaint = { value: PAINT };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uPaint;")
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 texelColor = texture2D( map, vMapUv );
          float l = dot( texelColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
          diffuseColor.rgb *= uPaint * clamp( l / 0.075, 0.45, 1.2 );
        #else
          diffuseColor.rgb *= uPaint;
        #endif`,
      );
  };
  m.customProgramCacheKey = () => "exc-paint";
  return m;
}

/** Sommets d'un sous-arbre exprimés dans le repère de `frame` (monde à jour). */
function pointsIn(obj, frame) {
  const pts = [];
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const v = new THREE.Vector3();
  obj.traverse((c) => {
    if (!c.isMesh) return;
    const pos = c.geometry.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 1500));
    for (let i = 0; i < pos.count; i += step) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m).clone());
  });
  return pts;
}

/** Points hauts d'une pièce, échantillonnés le long de son axe (−Z local). */
function topProfile(pts, bins = 8) {
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of pts) [z0, z1] = [Math.min(z0, p.z), Math.max(z1, p.z)];
  const best = new Array(bins).fill(null);
  for (const p of pts) {
    const b = Math.min(bins - 1, Math.floor(((p.z - z0) / (z1 - z0 + 1e-6)) * bins));
    if (!best[b] || p.y > best[b].y) best[b] = p;
  }
  return best.filter(Boolean);
}

export function buildFromModel(scene, gltf) {
  const src = gltf.scene;
  const wrap = new THREE.Group();
  wrap.add(src);
  let root = null;
  // Les pièces sont déplacées vers le squelette articulé : on les cherche dans les deux arbres
  const node = (n) => src.getObjectByName(n) || root?.getObjectByName(n);
  // Échelle par le diamètre des roues, sol à y = 0
  wrap.updateMatrixWorld(true);
  const wb = new THREE.Box3().setFromObject(node("right_front_wheel"));
  const k = WHEEL_DIAMETER / (wb.max.y - wb.min.y);
  wrap.scale.setScalar(k);
  wrap.updateMatrixWorld(true);
  wrap.position.y = -new THREE.Box3().setFromObject(src).min.y;
  wrap.updateMatrixWorld(true);
  const W = (n) => node(n).getWorldPosition(new THREE.Vector3());
  const turn = W("turnable_part");
  const pBoom = W("boom_1");
  const pStick = W("boom_2");
  const pBucket = W("shovel");
  const yzAngle = (a, b) => Math.atan2(b.y - a.y, -(b.z - a.z));
  const yzLen = (a, b) => Math.hypot(b.y - a.y, b.z - a.z);
  const rest = { swing: 0, boom: yzAngle(pBoom, pStick), stick: yzAngle(pStick, pBucket) - yzAngle(pBoom, pStick), bucket: 0 };
  EXC.boomLen = yzLen(pBoom, pStick);
  EXC.stickLen = yzLen(pStick, pBucket);
  EXC.pivot.copy(pBoom).sub(turn);

  // Squelette articulé (mêmes conventions que la version procédurale)
  root = new THREE.Group();
  const upper = new THREE.Group();
  upper.position.copy(turn).setX(0).setZ(0);
  root.add(upper);
  const boomPivot = new THREE.Group();
  boomPivot.position.copy(EXC.pivot);
  upper.add(boomPivot);
  const boom = new THREE.Group();
  boomPivot.add(boom);
  const stickPivot = new THREE.Group();
  stickPivot.position.set(0, 0, -EXC.boomLen);
  boom.add(stickPivot);
  const bucketPivot = new THREE.Group();
  bucketPivot.position.set(0, 0, -EXC.stickLen);
  stickPivot.add(bucketPivot);
  const groups = { root, upper, boom, stick: stickPivot, bucket: bucketPivot };
  const pose = (j) => {
    upper.rotation.y = j.swing;
    boom.rotation.x = j.boom;
    stickPivot.rotation.x = j.stick;
    bucketPivot.rotation.x = j.bucket;
  };
  // Pose de repos du modèle : les pièces se rattachent sans bouger
  pose(rest);
  root.updateMatrixWorld(true);

  // Vérins : pivot à chaque axe, orienté vers l'axe opposé
  const rams = [];
  for (const [bodyName, rodName, parentKey, childKey] of PARTS.rams) {
    const body = node(bodyName);
    const rod = node(rodName);
    if (!body || !rod) continue;
    const a = new THREE.Box3().setFromObject(body);
    const b = new THREE.Box3().setFromObject(rod);
    const d = b.getCenter(new THREE.Vector3()).sub(a.getCenter(new THREE.Vector3())).normalize();
    // Axes = extrémités des boîtes le long de la direction du vérin
    const ext = (box, dir) => {
      const c = box.getCenter(new THREE.Vector3());
      const h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      return c.addScaledVector(dir, Math.abs(dir.x) * h.x + Math.abs(dir.y) * h.y + Math.abs(dir.z) * h.z);
    };
    const A = ext(a, d.clone().negate());
    const B = ext(b, d);
    const pa = new THREE.Object3D();
    const pb = new THREE.Object3D();
    pa.position.copy(A);
    pb.position.copy(B);
    pa.lookAt(B);
    pb.lookAt(A);
    pa.updateMatrixWorld(true);
    pb.updateMatrixWorld(true);
    pa.attach(body);
    pb.attach(rod);
    groups[parentKey].attach(pa);
    groups[childKey].attach(pb);
    const wa = new THREE.Vector3();
    const wbv = new THREE.Vector3();
    rams.push(() => {
      pa.getWorldPosition(wa);
      pb.getWorldPosition(wbv);
      pa.lookAt(wbv);
      pb.lookAt(wa);
    });
  }
  // Pièces principales
  for (const [key, names] of Object.entries({ boom: PARTS.boom, stick: PARTS.stick, bucket: PARTS.bucket })) for (const n of names) groups[key].attach(node(n));
  // Le reste : châssis (roues, stabilisateurs) ou tourelle (cabine, commandes)
  for (const c of [...node("RootNode").children]) (PARTS.chassis.test(c.name) ? root : upper).attach(c);

  // Matériaux : peinture jaune, ombres, vitrage
  const painted = new Map();
  root.traverse((c) => {
    if (!c.isMesh) return;
    c.castShadow = c.receiveShadow = true;
    const mats = [c.material].flat().map((m) => {
      if (/red_metal|red_aluminium/.test(m.name)) {
        if (!painted.has(m)) painted.set(m, repaint(m));
        return painted.get(m);
      }
      if (/glass/.test(m.name)) {
        m.transparent = true;
        m.depthWrite = false;
        c.castShadow = false;
      }
      return m;
    });
    c.material = Array.isArray(c.material) ? mats : mats[0];
  });
  root.updateMatrixWorld(true);

  // Géométrie utile : dents du godet, profils hauts, arrière de tourelle, poste de conduite
  const bucketPts = pointsIn(node("shovel"), bucketPivot);
  const tipLocal = bucketPts.reduce((best, p) => (p.length() > best.length() ? p : best), new THREE.Vector3());
  tipLocal.x = 0; // milieu de la rangée de dents
  const boomTop = topProfile(pointsIn(node("boom_1"), boom), 8);
  const stickTop = topProfile(pointsIn(node("boom_2"), stickPivot), 4);
  const upperBox = new THREE.Box3().setFromObject(node("turnable_part"));
  upper.worldToLocal(upperBox.min);
  upper.worldToLocal(upperBox.max);
  const tail = [-1, 0, 1].map((sx) => new THREE.Vector3(sx * upperBox.max.x * 0.92, (upperBox.min.y + upperBox.max.y) / 2, upperBox.max.z));
  const glass = node("turnable_part_glass_0") || node("turnable_part");
  const cabBox = new THREE.Box3().setFromObject(glass);
  const seatW = cabBox.getCenter(new THREE.Vector3());
  seatW.y = cabBox.min.y + (cabBox.max.y - cabBox.min.y) * 0.62;
  const cab = new THREE.Group();
  cab.position.copy(upper.worldToLocal(seatW.clone()));
  upper.add(cab);
  const beacon = cyl(upper, 0.08, 0.13, [cab.position.x + 0.25, upperBox.max.y + 0.07, cab.position.z + 0.3], MAT.beacon, "y", 12);

  // Galets de guidage rail (le modèle d'origine est routier) : avant et arrière du châssis
  const frameBox = new THREE.Box3().setFromObject(node("base_frame"));
  const guideArms = [];
  for (const z of [frameBox.min.z + 0.25, frameBox.max.z - 0.25]) {
    const arm = new THREE.Group();
    const y0 = 0.62;
    arm.position.set(0, y0, z);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.2), MAT.dark);
    beam.position.y = -0.1;
    beam.castShadow = true;
    arm.add(beam);
    for (const x of [-0.7175, 0.7175]) {
      const w = cyl(arm, 0.2, 0.11, [x, -0.3, 0], MAT.steel, "x");
      cyl(w, 0.24, 0.03, [-Math.sign(x) * 0.055, 0, 0], MAT.steel, "x"); // boudin
    }
    root.add(arm);
    guideArms.push((kk) => {
      arm.position.y = y0 - 0.26 * kk;
      arm.rotation.x = (1 - kk) * 0.5 * Math.sign(z);
    });
  }

  const load = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 1 }));
  load.scale.set(1.1, 0.6, 1.0);
  load.position.copy(tipLocal).multiplyScalar(0.5);
  load.visible = false;
  bucketPivot.add(load);
  scene.add(root);

  const wheelZ = [W("right_front_wheel").z, W("left_rear_wheel").z];
  const rr = new RoadRail(root, { wheelbase: Math.abs(wheelZ[1] - wheelZ[0]), rideHeight: 0.0, railLift: 0.06, maxRoad: 20 / 3.6, maxRail: 20 / 3.6 });
  rr.guideArms = guideArms;
  const joints = { ...EXC.transport };
  const apply = () => pose(joints);
  apply();
  const tip = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  return {
    rr,
    root,
    upper,
    cab,
    beacon,
    joints,
    load,
    pose,
    wheels: [],
    realistic: true,
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
    tip() {
      root.updateMatrixWorld(true);
      return bucketPivot.localToWorld(tip.copy(tipLocal));
    },
    /** Points de contrôle réels : dessus de la flèche et du balancier, godet, dents, arrière de tourelle. */
    probes() {
      root.updateMatrixWorld(true);
      return [
        ...boomTop.map((p) => boom.localToWorld(p.clone())),
        ...stickTop.map((p) => stickPivot.localToWorld(p.clone())),
        bucketPivot.localToWorld(new THREE.Vector3()),
        bucketPivot.localToWorld(tipLocal.clone()),
        ...tail.map((p) => upper.localToWorld(p.clone())),
      ];
    },
    seat() {
      root.updateMatrixWorld(true);
      return cab.localToWorld(tmp.set(0, 0, 0)).clone();
    },
    update() {
      for (const f of rams) f();
    },
  };
}
