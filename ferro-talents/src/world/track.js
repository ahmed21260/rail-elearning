// Voie ballastée (double voie), rails UIC 60, traverses béton, attaches, caniveaux, caténaire 25 kV.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { frame, sweep, matrixAt, lineLength, P, rng } from "./line.js";
import { tex, chunked } from "../core/assets.js";

export const TRACK_LAT = -2.1; // voie 1 (circulation à gauche)
export const OTHER_LAT = 2.1;
export const RAIL_HALF = 0.7535;
export const RAIL_BASE_Y = 0.19;
export const RAIL_TOP_Y = RAIL_BASE_Y + 0.172;
export const CONTACT_Y = RAIL_TOP_Y + 5.5;
export const SPAN = 54;
export const MAST_S0 = -250;
export const MAST_LAT = 6.1;

export function contactLat(s, trackLat) {
  const k = Math.floor((s - MAST_S0) / SPAN);
  const u = (s - MAST_S0 - k * SPAN) / SPAN;
  const z0 = k % 2 === 0 ? 0.2 : -0.2;
  return trackLat + z0 - 2 * z0 * u;
}
export const messengerY = (s) => {
  const u = ((((s - MAST_S0) % SPAN) + SPAN) % SPAN) / SPAN;
  return CONTACT_Y + 1.35 - 0.9 * 4 * u * (1 - u);
};

export function buildTrack(scene, { quality, skipMasts = [] }) {
  const S0 = -250;
  const S1 = lineLength() + 250;
  const gravel = new THREE.MeshStandardMaterial({
    map: tex("gravel_stones/Diffuse.jpg", { repeat: 0.9 }),
    normalMap: tex("gravel_stones/nor_gl.jpg", { srgb: false, repeat: 0.9 }),
    roughnessMap: tex("gravel_stones/Rough.jpg", { srgb: false, repeat: 0.9 }),
    normalScale: new THREE.Vector2(1.6, 1.6),
    color: new THREE.Color(0.92, 0.88, 0.84),
  });
  const ballast = new THREE.Mesh(sweep({ s0: S0, s1: S1, step: 2, profile: [[-5.4, -0.62], [-4.05, 0.15], [4.05, 0.15], [5.4, -0.62]] }), gravel);
  ballast.receiveShadow = true;
  scene.add(ballast);

  const concrete = new THREE.MeshStandardMaterial({
    map: tex("concrete_floor_worn_001/Diffuse.jpg", { repeat: 0.8 }),
    normalMap: tex("concrete_floor_worn_001/nor_gl.jpg", { srgb: false, repeat: 0.8 }),
    roughness: 0.9,
  });
  for (const lat of [-6.9, 6.9]) {
    const m = new THREE.Mesh(sweep({ s0: S0, s1: S1, step: 4, lat, y: -0.62, profile: [[-0.22, 0], [-0.22, 0.28], [0.22, 0.28], [0.22, 0]] }), concrete);
    m.receiveShadow = true;
    scene.add(m);
  }

  const sleeperGeo = new THREE.BoxGeometry(2.6, 0.22, 0.28);
  const sleeperMat = new THREE.MeshStandardMaterial({
    map: tex("concrete_floor_worn_001/Diffuse.jpg"),
    normalMap: tex("concrete_floor_worn_001/nor_gl.jpg", { srgb: false }),
    color: new THREE.Color(0.95, 0.93, 0.9),
    roughness: 0.85,
  });
  const clipGeo = new THREE.BoxGeometry(0.15, 0.07, 0.13);
  const clipMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6, metalness: 0.5 });
  const sleepers = [];
  const clips = [];
  const r = rng(11);
  for (const tl of [TRACK_LAT, OTHER_LAT]) {
    for (let s = S0; s < S1; s += 0.6) {
      sleepers.push({ m: matrixAt(new THREE.Matrix4(), s, tl, 0.07, (r() - 0.5) * 0.02) });
      if (quality !== "low" || Math.round(s / 0.6) % 2 === 0) {
        for (const d of [-RAIL_HALF - 0.1, -RAIL_HALF + 0.1, RAIL_HALF - 0.1, RAIL_HALF + 0.1]) clips.push({ m: matrixAt(new THREE.Matrix4(), s, tl + d, 0.21) });
      }
    }
  }
  chunked(scene, sleeperGeo, sleeperMat, sleepers, { receive: true, cast: true, cell: 100 });
  chunked(scene, clipGeo, clipMat, clips, { cell: 60 });

  const railProfile = [
    [-0.075, 0], [-0.075, 0.012], [-0.012, 0.03], [-0.0085, 0.045], [-0.0085, 0.115], [-0.036, 0.125],
    [-0.036, 0.162], [-0.03, 0.172], [0.03, 0.172], [0.036, 0.162], [0.036, 0.125], [0.0085, 0.115],
    [0.0085, 0.045], [0.012, 0.03], [0.075, 0.012], [0.075, 0],
  ];
  const rust = new THREE.MeshStandardMaterial({ map: tex("rusty_metal_02/Diffuse.jpg", { repeat: 2 }), color: new THREE.Color(0.75, 0.62, 0.52), roughness: 0.75, metalness: 0.4 });
  const shiny = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.18, metalness: 1.0 });
  for (const tl of [TRACK_LAT, OTHER_LAT]) {
    for (const side of [-1, 1]) {
      const lat = tl + side * RAIL_HALF;
      const rail = new THREE.Mesh(sweep({ s0: S0, s1: S1, step: 2, lat, y: RAIL_BASE_Y, profile: railProfile, closed: true }), rust);
      rail.castShadow = rail.receiveShadow = true;
      scene.add(rail);
      scene.add(new THREE.Mesh(sweep({ s0: S0, s1: S1, step: 2, lat, y: RAIL_BASE_Y + 0.1722, profile: [[-0.029, 0], [0.029, 0]] }), shiny));
    }
  }
  return buildCatenary(scene, skipMasts);
}

function boxBetween(parts, s, p1, p2, t) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const g = new THREE.BoxGeometry(len, t, t);
  g.rotateZ(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]));
  g.translate((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0);
  const f = frame(s);
  g.rotateY(-f.th);
  g.translate(f.x, f.y, f.z);
  parts.push(g);
}

/** Tube rond entre deux points du plan (lat, y) au droit de l'abscisse s. */
function tubeBetween(parts, s, p1, p2, r, seg = 10) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.rotateZ(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.PI / 2);
  g.translate((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0);
  const f = frame(s);
  g.rotateY(-f.th);
  g.translate(f.x, f.y, f.z);
  parts.push(g);
}

/** Isolateur céramique à ailettes (axe local Y), de longueur L. */
let insulatorGeo = null;
function insulator(L) {
  if (!insulatorGeo) {
    const pts = [new THREE.Vector2(0.001, 0)];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const y = (i + 0.5) / n;
      pts.push(new THREE.Vector2(0.035, y - 0.45 / n), new THREE.Vector2(0.075, y - 0.1 / n), new THREE.Vector2(0.035, y + 0.3 / n));
    }
    pts.push(new THREE.Vector2(0.03, 1), new THREE.Vector2(0.001, 1));
    insulatorGeo = new THREE.LatheGeometry(pts, 14);
  }
  return insulatorGeo.clone().scale(1, L, 1);
}
function insulatorBetween(parts, s, p1, p2) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const g = insulator(len);
  g.rotateZ(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) - Math.PI / 2);
  g.translate(p1[0], p1[1], 0);
  const f = frame(s);
  g.rotateY(-f.th);
  g.translate(f.x, f.y, f.z);
  parts.push(g);
}

/** Poteau à treillis (deux membrures en U reliées par un laçage en zigzag), repère local : x = travers, z = long de la voie. */
let latticeGeo = null;
function latticeMast() {
  if (latticeGeo) return latticeGeo;
  const parts = [];
  const H = 9.0;
  const y0 = -0.6;
  const bar = (x1, y1, z1, x2, y2, z2, w, d) => {
    const a = new THREE.Vector3(x1, y1, z1);
    const b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(w, len, d);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    parts.push(g);
  };
  const half = (y) => 0.2 - 0.07 * ((y - y0) / H); // léger fruit (poteau plus large en pied)
  for (const sz of [-1, 1]) {
    // Membrures (profilés en U) de chaque côté, le long de la voie
    bar(0, y0, sz * half(y0), 0, y0 + H, sz * half(y0 + H), 0.2, 0.05);
  }
  // Laçage en zigzag sur les deux faces
  const step = 0.42;
  for (const sx of [-1, 1]) {
    let k = 0;
    for (let y = y0 + 0.3; y < y0 + H - 0.3; y += step, k++) {
      const z1 = (k % 2 ? 1 : -1) * half(y);
      const z2 = -z1 * (half(y + step) / half(y));
      bar(sx * 0.085, y, z1, sx * 0.085, y + step, z2, 0.025, 0.035);
    }
  }
  // Plaque de tête et semelle
  bar(0, y0 + H - 0.01, 0, 0, y0 + H + 0.02, 0, 0.26, 0.34);
  latticeGeo = mergeGeometries(parts);
  return latticeGeo;
}

function buildCatenary(scene, skip) {
  // Acier galvanisé (gris clair mat), fils cuivre/bronze patinés, isolateurs porcelaine brune émaillée
  const steel = new THREE.MeshStandardMaterial({ color: 0xaeb4b8, roughness: 0.5, metalness: 0.45 }); // acier galvanisé
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3530, roughness: 0.5, metalness: 0.6 });
  const insul = new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 0.22, metalness: 0.05 });
  const concreteM = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.95 });
  const chunks = new Map();
  const masts = [];
  const push = (s, key, g) => {
    const k = `${key}:${Math.floor(s / 300)}`;
    if (!chunks.has(k)) chunks.set(k, { key, list: [] });
    chunks.get(k).list.push(g);
  };
  const end = lineLength() + 250;
  let n = 0;
  for (let s = MAST_S0; s < end; s += SPAN, n++) {
    for (const [mastLat, tl] of [[-MAST_LAT, TRACK_LAT], [MAST_LAT, OTHER_LAT]]) {
      if (skip.some((f) => f(s, mastLat))) continue;
      const dir = Math.sign(tl - mastLat);
      const parts = [];
      // Poteau à treillis galvanisé, orienté face à la voie
      const lat = latticeMast().clone();
      const f0 = frame(s);
      lat.rotateY(-f0.th);
      lat.translate(f0.x + f0.rx * mastLat, f0.y, f0.z + f0.rz * mastLat);
      parts.push(lat);
      const zig = contactLat(s, tl);
      const yT = CONTACT_Y + 1.35; // porteur
      const yB = CONTACT_Y + 0.25; // tube de console
      const m0 = mastLat + dir * 0.12;
      // Console tubulaire : tube horizontal du porteur, tube incliné (hauban), bras de rappel du fil de contact
      tubeBetween(parts, s, [m0 + dir * 0.7, yT], [tl + dir * 0.9, yT], 0.03);
      tubeBetween(parts, s, [m0 + dir * 0.65, yB], [zig - dir * 0.35, yB - 0.08], 0.028);
      tubeBetween(parts, s, [zig - dir * 0.35, yB - 0.08], [zig - dir * 0.02, CONTACT_Y + 0.1], 0.016);
      tubeBetween(parts, s, [m0 + dir * 0.6, yB + 0.02], [tl + dir * 0.35, yT], 0.022);
      tubeBetween(parts, s, [zig, CONTACT_Y + 0.02], [zig, CONTACT_Y + 0.16], 0.012);
      // Ferrures de fixation au poteau
      boxBetween(parts, s, [mastLat, yT - 0.12], [m0 + 0.02 * dir, yT - 0.12], 0.12);
      boxBetween(parts, s, [mastLat, yB - 0.1], [m0 + 0.02 * dir, yB - 0.1], 0.12);
      push(s, "steel", mergeGeometries(parts));
      // Isolateurs céramique à ailettes entre poteau et console
      const ins = [];
      insulatorBetween(ins, s, [m0, yT], [m0 + dir * 0.7, yT]);
      insulatorBetween(ins, s, [m0, yB], [m0 + dir * 0.65, yB]);
      push(s, "insul", mergeGeometries(ins));
      const base = new THREE.BoxGeometry(0.9, 0.5, 0.9);
      const b = P(s, mastLat, -0.55);
      base.translate(b.x, b.y, b.z);
      push(s, "concrete", base);
      masts.push({ s, lat: mastLat, num: `${mastLat < 0 ? 1 : 2}-${String(n).padStart(3, "0")}` });
    }
  }
  const mats = { steel, insul, concrete: concreteM };
  for (const { key, list } of chunks.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), mats[key]);
    m.castShadow = key !== "concrete";
    m.receiveShadow = true;
    scene.add(m);
  }
  const wire = (r) => [[-r, 0], [0, r], [r, 0], [0, -r]];
  const sag = (s, base, depth) => {
    const u = ((((s - MAST_S0) % SPAN) + SPAN) % SPAN) / SPAN;
    return base - depth * 4 * u * (1 - u);
  };
  const droppers = [];
  const wires = [];
  for (const [tl, mastLat] of [[TRACK_LAT, -MAST_LAT], [OTHER_LAT, MAST_LAT]]) {
    const add = (g) => {
      const m = new THREE.Mesh(g, dark);
      m.castShadow = true;
      scene.add(m);
      wires.push(m);
    };
    add(sweep({ s0: MAST_S0, s1: end, step: 3, lat: (s) => contactLat(s, tl), y: CONTACT_Y, profile: wire(0.014), closed: true }));
    add(sweep({ s0: MAST_S0, s1: end, step: 3, lat: tl, y: (s) => sag(s, CONTACT_Y + 1.35, 0.9), profile: wire(0.012), closed: true }));
    add(sweep({ s0: MAST_S0, s1: end, step: 3, lat: mastLat, y: (s) => sag(s, 8.3, 0.6), profile: wire(0.016), closed: true }));
    for (let s = MAST_S0 + 4.5; s < end; s += 9) {
      if ((((s - MAST_S0) % SPAN) + SPAN) % SPAN < 3) continue;
      const h = sag(s, CONTACT_Y + 1.35, 0.9) - CONTACT_Y;
      const lat = (contactLat(s, tl) + tl) / 2;
      droppers.push({ s, tl, m: new THREE.Matrix4().compose(P(s, lat, CONTACT_Y + h / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -frame(s).th), new THREE.Vector3(1, h, 1)) });
    }
  }
  chunked(scene, new THREE.BoxGeometry(0.012, 1, 0.012), dark, droppers, { cell: 150 });
  return { masts, droppers, wireMat: dark };
}
