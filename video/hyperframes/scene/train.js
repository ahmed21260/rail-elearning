// Automoteur générique (aucune livrée réelle) : 2 caisses, nez profilés, pantographe levé.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { place } from "./path.js";
import { RAIL_HALF, RAIL_TOP_Y, CONTACT_Y } from "./world.js";

const W = 2.9;
const FLOOR = 1.18;
const ROOF = 4.05;
const BODY = 21.5;
const NOSE = 4.3;
export const CAR = BODY + NOSE;
const GAP = 0.9;

const M = {
  body: new THREE.MeshPhysicalMaterial({ color: 0xf3f5f7, roughness: 0.28, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1520, roughness: 0.05, metalness: 0.9 }),
  band: new THREE.MeshStandardMaterial({ color: 0x1d3f8f, roughness: 0.35, metalness: 0.2 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x22b6e6, roughness: 0.35 }),
  skirt: new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.3 }),
  bogie: new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.7, metalness: 0.5 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.35, metalness: 0.9 }),
  roofBox: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.5, metalness: 0.4 }),
  panto: new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.4, metalness: 0.8 }),
  head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d8, emissiveIntensity: 3 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 2 }),
};

function box(w, h, d, x, y, z, mat, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function roundedSection() {
  const s = new THREE.Shape();
  const r = 0.55;
  s.moveTo(-W / 2, FLOOR);
  s.lineTo(W / 2, FLOOR);
  s.lineTo(W / 2 + 0.02, ROOF - r);
  s.quadraticCurveTo(W / 2, ROOF, W / 2 - r, ROOF);
  s.lineTo(-W / 2 + r, ROOF);
  s.quadraticCurveTo(-W / 2, ROOF, -W / 2 - 0.02, ROOF - r);
  s.closePath();
  return s;
}

function noseGeometry() {
  // Profil latéral (f = avancée vers l'avant, y), extrudé sur la largeur puis tourné.
  // Le chanfrein (0,2 m) élargit le profil : on le trace donc en retrait.
  const b = 0.2;
  const fl = FLOOR + b;
  const rf = ROOF - b;
  const n = NOSE - b;
  const s = new THREE.Shape();
  s.moveTo(0, fl);
  s.lineTo(n - 0.35, fl);
  s.quadraticCurveTo(n + 0.05, fl + 0.1, n, fl + 0.7);
  s.quadraticCurveTo(n - 0.25, 2.5, n - 1.0, 2.95);
  s.quadraticCurveTo(n - 2.2, 3.75, n - 3.0, rf);
  s.lineTo(0, rf);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: W - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 12 });
  g.translate(0, 0, -(W - 2 * b) / 2);
  g.rotateY(Math.PI / 2); // f → -Z, épaisseur → X
  return g;
}

function bogie(parent, z) {
  const b = new THREE.Group();
  box(2.3, 0.45, 2.8, 0, 0.78, 0, M.bogie, b);
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 20);
  wg.rotateZ(Math.PI / 2);
  for (const dz of [-1.0, 1.0]) {
    for (const dx of [-RAIL_HALF, RAIL_HALF]) {
      const w = new THREE.Mesh(wg, M.wheel);
      w.position.set(dx, RAIL_TOP_Y + 0.42, dz);
      w.castShadow = true;
      b.add(w);
    }
  }
  b.position.z = z;
  parent.add(b);
}

function pantograph(parent, z) {
  const g = new THREE.Group();
  box(1.6, 0.18, 1.4, 0, ROOF + 0.12, 0, M.roofBox, g);
  const top = CONTACT_Y - 0.02;
  const base = ROOF + 0.3;
  const knee = [0, (base + top) / 2 + 0.15, 0.95];
  const arm = (a, b, t = 0.06) => {
    const len = Math.hypot(b[1] - a[1], b[2] - a[2]);
    const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), M.panto);
    m.position.set(a[0], (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.rotation.x = Math.atan2(b[2] - a[2], b[1] - a[1]);
    m.castShadow = true;
    g.add(m);
  };
  for (const x of [-0.35, 0.35]) {
    arm([x, base, -0.6], [x, knee[1], knee[2]]);
    arm([x, knee[1], knee[2]], [x, top - 0.05, 0]);
  }
  box(1.7, 0.05, 0.1, 0, top, 0.12, M.panto, g);
  box(1.7, 0.05, 0.1, 0, top, -0.12, M.panto, g);
  g.position.z = z;
  parent.add(g);
}

function car({ front = true, panto = false }) {
  const g = new THREE.Group();
  // Caisse : la face avant (nez) est vers -Z ; origine au centre de la caisse complète.
  const z0 = -CAR / 2 + NOSE; // début de la partie droite
  const body = new THREE.ExtrudeGeometry(roundedSection(), { depth: BODY, bevelEnabled: false });
  body.translate(0, 0, z0);
  const bodyMesh = new THREE.Mesh(body, M.body);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  g.add(bodyMesh);
  const nose = new THREE.Mesh(noseGeometry(), M.body);
  nose.position.z = z0;
  nose.castShadow = true;
  g.add(nose);
  // Pare-brise incliné, bandeaux, vitres, portes
  const ws = box(2.2, 0.03, 1.9, 0, 3.66, z0 - 2.15, M.glass, g);
  ws.rotation.x = -0.5;
  box(W + 0.03, 0.75, BODY - 1.6, 0, 2.62, z0 + BODY / 2 + 0.3, M.glass, g);
  box(W + 0.035, 0.22, BODY, 0, 1.6, z0 + BODY / 2, M.band, g);
  box(W + 0.04, 0.05, BODY, 0, 1.78, z0 + BODY / 2, M.accent, g);
  for (const dz of [4.2, BODY - 4.5]) {
    box(W + 0.05, 2.15, 1.35, 0, 2.3, z0 + dz, M.band, g);
    box(W + 0.06, 1.1, 0.5, 0, 2.7, z0 + dz, M.glass, g);
  }
  // Bande de nez colorée et feux
  const noseBand = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.2), M.band);
  noseBand.position.set(0, 1.6, z0 - NOSE + 0.9);
  g.add(noseBand);
  const lamp = front ? M.head : M.tail;
  for (const x of [-0.95, 0.95]) box(0.32, 0.12, 0.1, x, 1.95, z0 - NOSE + 0.28, lamp, g);
  box(0.4, 0.1, 0.1, 0, 3.72, z0 - 2.9, M.head, g);
  // Jupe, bogies, équipements de toiture
  box(W - 0.2, 0.5, BODY + NOSE - 1.2, 0, FLOOR - 0.12, z0 + BODY / 2 - 1.2, M.skirt, g);
  bogie(g, z0 + 2.2);
  bogie(g, z0 + BODY - 2.4);
  box(1.8, 0.35, 5, 0, ROOF + 0.12, z0 + BODY * 0.55, M.roofBox, g);
  if (panto) pantograph(g, z0 + BODY - 5.5);
  return g;
}

export function buildTrain(scene) {
  const a = car({ front: true, panto: false });
  const b = car({ front: false, panto: true });
  scene.add(a, b);
  return {
    group: [a, b],
    set visible(v) {
      a.visible = b.visible = v;
    },
    /** Positionne le train, nez avant à l'abscisse sFront. */
    update(sFront, lat) {
      place(a, sFront - CAR / 2, lat);
      place(b, sFront - CAR - GAP - CAR / 2, lat, 0, Math.PI);
    },
    /** Train circulant en sens inverse (nez vers les s décroissants). */
    updateReverse(sFront, lat) {
      place(a, sFront + CAR / 2, lat, 0, Math.PI);
      place(b, sFront + CAR + GAP + CAR / 2, lat);
    },
  };
}
