// Lieux du jeu : base travaux (parking, hangar, bungalow, stock), point d'enraillement,
// chantier de dégarnissage, gare. Déclare les zones planes et les zones sans végétation.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { P, frame, sweep, project, lineLength, rng } from "./line.js";
import { addPad, groundHeight } from "./terrain.js";
import { tex } from "../core/assets.js";
import { TRACK_LAT, RAIL_TOP_Y } from "./track.js";

export const DEPOT = { s0: 250, s1: 470, l0: -78, l1: -12, y: 0.3 };
export const ENRAIL = { s: 440, half: 12 }; // point d'enraillement (voie 1)
export const WORKSITE = { s0: 880, s1: 980, skipS: 931, skipLat: -8.4, spots: [925, 928.5, 932, 935.5] };
export const STATION = { from: 5280, to: 5540, stopMark: 5520, name: "VALBRUCHE" };
export const NACELLE_TASK = { mast: 722, dropperS: 744.5 };

/** Déclare les plateformes AVANT la construction du terrain. */
export function declarePads() {
  addPad(DEPOT);
  addPad({ s0: ENRAIL.s - ENRAIL.half, s1: ENRAIL.s + ENRAIL.half, l0: -12, l1: -6.2, y: 0.3 });
}

const inRect = (p, r, m = 0) => p.s > r.s0 - m && p.s < r.s1 + m && p.lat > r.l0 - m && p.lat < r.l1 + m;

/** Faux si la végétation ne doit pas pousser ici (voie, base, gare…). */
export function isFree(x, z, grass = false) {
  const p = project(x, z, 100);
  if (p.d > 95) return true;
  if (Math.abs(p.lat) < (grass ? 6.4 : 7.4) && p.s > -260 && p.s < lineLength() + 260) return false;
  if (inRect(p, DEPOT, grass ? 1 : 6)) return false;
  if (p.s > STATION.from - 5 && p.s < STATION.to + 5 && p.lat > -12 && p.lat < 0) return false;
  if (p.s > ENRAIL.s - ENRAIL.half - 2 && p.s < ENRAIL.s + ENRAIL.half + 2 && p.lat < 0 && p.lat > -14) return false;
  return true;
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function boxAt(scene, mat, [w, h, d], s, lat, y, yaw = 0, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.copy(P(s, lat, y + h / 2));
  m.rotation.y = -frame(s).th + yaw;
  m.castShadow = cast;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

function placeGltf(scene, gltf, s, lat, yaw = 0, scale = 1, dy = 0) {
  const o = gltf.scene.clone(true);
  const f = frame(s);
  const x = f.x + f.rx * lat;
  const z = f.z + f.rz * lat;
  o.position.set(x, groundHeight(x, z) + dy, z);
  o.rotation.y = -f.th + yaw;
  o.scale.setScalar(scale);
  o.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = c.receiveShadow = true;
    }
  });
  scene.add(o);
  return o;
}

export function buildDepot(scene, models) {
  const Y = DEPOT.y;
  const asphalt = new THREE.MeshStandardMaterial({
    map: tex("asphalt_02/Diffuse.jpg", { repeat: 0.25 }),
    normalMap: tex("asphalt_02/nor_gl.jpg", { srgb: false, repeat: 0.25 }),
    roughness: 0.92,
  });
  // Parking : dalle d'enrobé suivant la plateforme
  const yard = new THREE.Mesh(sweep({ s0: DEPOT.s0, s1: DEPOT.s1, step: 4, profile: [[DEPOT.l0, Y + 0.03], [DEPOT.l1, Y + 0.03]] }), asphalt);
  yard.receiveShadow = true;
  scene.add(yard);
  // Rampe vers le point d'enraillement + panneaux de platelage entre les rails
  const ramp = new THREE.Mesh(sweep({ s0: ENRAIL.s - ENRAIL.half, s1: ENRAIL.s + ENRAIL.half, step: 1, profile: [[-12, Y + 0.03], [-6.4, RAIL_TOP_Y - 0.02], [TRACK_LAT - 0.85, RAIL_TOP_Y - 0.01]] }), asphalt);
  ramp.receiveShadow = true;
  scene.add(ramp);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x222325, roughness: 0.85 });
  for (const [a, b] of [[TRACK_LAT - 0.68, TRACK_LAT + 0.68], [TRACK_LAT + 0.84, TRACK_LAT + 1.6]]) {
    scene.add(new THREE.Mesh(sweep({ s0: ENRAIL.s - ENRAIL.half, s1: ENRAIL.s + ENRAIL.half, step: 1, profile: [[a, RAIL_TOP_Y - 0.005], [b, RAIL_TOP_Y - 0.005]] }), rubber));
  }
  // Marquage au sol : bandes jaunes des emplacements d'engins
  const paint = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.6 });
  for (const s of [300, 318, 336, 354]) {
    scene.add(new THREE.Mesh(sweep({ s0: s, s1: s + 0.15, step: 0.15, profile: [[-40, Y + 0.035], [-18, Y + 0.035]] }), paint));
  }
  scene.add(new THREE.Mesh(sweep({ s0: ENRAIL.s - ENRAIL.half - 0.2, s1: ENRAIL.s - ENRAIL.half, step: 0.2, profile: [[-12, Y + 0.035], [-6.6, RAIL_TOP_Y + 0.01]] }), paint));

  // Hangar en bardage acier ondulé, façade ouverte côté voie
  const iron = new THREE.MeshStandardMaterial({
    map: tex("corrugated_iron_02/Diffuse.jpg", { repeat: 0.35 }),
    normalMap: tex("corrugated_iron_02/nor_gl.jpg", { srgb: false, repeat: 0.35 }),
    color: 0x9aa8b3,
    roughness: 0.55,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3d4650, roughness: 0.45, metalness: 0.7 });
  const shS = 390;
  boxAt(scene, iron, [0.15, 7, 24], shS, -74, Y); // fond
  boxAt(scene, iron, [26, 7, 0.15], shS - 12, -62, Y, Math.PI / 2);
  boxAt(scene, iron, [26, 7, 0.15], shS + 12, -62, Y, Math.PI / 2);
  const roof = boxAt(scene, iron, [26, 0.2, 25], shS, -62, Y + 7);
  roof.rotation.z = 0.04;
  for (const ds of [-12, -4, 4, 12]) boxAt(scene, steel, [0.3, 7, 0.3], shS + ds, -49.2, Y);
  // Bungalow de chantier + panneau
  const white = new THREE.MeshStandardMaterial({ color: 0xe9ebe6, roughness: 0.6 });
  const office = boxAt(scene, white, [6, 2.6, 2.4], 290, -60, Y + 0.25, Math.PI / 2);
  const winTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#e9ebe6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1b2a3a";
    for (const x of [40, 200, 360]) g.fillRect(x, 30, 110, 60);
  });
  office.material = [white, white, white, white, new THREE.MeshStandardMaterial({ map: winTex }), new THREE.MeshStandardMaterial({ map: winTex })];
  boxAt(scene, steel, [6.2, 0.25, 2.6], 290, -60, Y, Math.PI / 2);
  const sign = canvasTex(1024, 320, (g, w, h) => {
    g.fillStyle = "#0e2a5c";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffc21a";
    g.fillRect(0, h - 36, w, 36);
    g.fillStyle = "#fff";
    g.font = "800 92px Inter, sans-serif";
    g.fillText("BASE TRAVAUX", 40, 120);
    g.font = "600 64px Inter, sans-serif";
    g.fillText("Vallée de la Bruche · Ferro Talents", 40, 220);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.25), new THREE.MeshStandardMaterial({ map: sign }));
  board.position.copy(P(270, -14, Y + 2.6));
  board.rotation.y = -frame(270).th - Math.PI / 2;
  scene.add(board);
  for (const d of [-1.6, 1.6]) boxAt(scene, steel, [0.1, 3.2, 0.1], 270 + d, -14.05, Y);

  // Stock : traverses neuves, barres de rail, tas de ballast
  const concrete = new THREE.MeshStandardMaterial({ map: tex("concrete_floor_worn_001/Diffuse.jpg"), color: 0xd8d4cc, roughness: 0.9 });
  const sl = [];
  for (let layer = 0; layer < 5; layer++) {
    for (let i = 0; i < 10; i++) {
      const g = new THREE.BoxGeometry(0.28, 0.22, 2.6);
      g.translate(0, 0.11 + layer * 0.3, 0);
      const f = frame(430);
      const p = P(430 + i * 0.4 - 2, -55, Y + 0.02);
      g.rotateY(-f.th + Math.PI / 2);
      g.translate(p.x, p.y, p.z);
      sl.push(g);
    }
  }
  const stack = new THREE.Mesh(mergeGeometries(sl), concrete);
  stack.castShadow = stack.receiveShadow = true;
  scene.add(stack);
  const rust = new THREE.MeshStandardMaterial({ map: tex("rusty_metal_02/Diffuse.jpg"), color: 0x8a6e5a, roughness: 0.7, metalness: 0.5 });
  for (let i = 0; i < 6; i++) boxAt(scene, rust, [0.15, 0.17, 18], 455, -30 - i * 0.35, Y + 0.12, 0).rotation.y += Math.PI / 2 - Math.PI / 2;
  const pile = new THREE.Mesh(new THREE.ConeGeometry(5, 3, 24, 1), new THREE.MeshStandardMaterial({ map: tex("gravel_stones/Diffuse.jpg", { repeat: 2 }), roughness: 1 }));
  pile.position.copy(P(460, -62, Y + 1.5));
  pile.castShadow = pile.receiveShadow = true;
  scene.add(pile);

  // Props Poly Haven
  const barrier = models.concrete_road_barrier;
  for (let i = 0; i < 9; i++) placeGltf(scene, barrier, 262 + i * 1.6, -12.8, Math.PI / 2);
  for (let i = 0; i < 6; i++) placeGltf(scene, barrier, 462 + i * 1.6, -12.8, Math.PI / 2);
  placeGltf(scene, models.portable_generator, 298, -52, 0.4, 1.4);
  placeGltf(scene, models.tool_cart, 378, -70, 0.2, 1);
  placeGltf(scene, models.metal_toolbox, 380, -71.5, 0.8, 1.3, 0.96);
  placeGltf(scene, models.wooden_crate_01, 405, -71, 0.1, 1.5);
  placeGltf(scene, models.wooden_crate_01, 406.5, -71, 0.4, 1.5);
  placeGltf(scene, models.industrial_pastic_container, 300, -54, 0, 1.6);
  placeGltf(scene, models.propane_tank, 301, -55, 0, 1.3);
  placeGltf(scene, models.wooden_ladder, 402, -73.6, Math.PI / 2, 1.8);
  for (const s of [265, 330, 400, 465]) placeGltf(scene, models.street_lamp_01, s, -16, Math.PI / 2, 1.9);

  // Chantier de dégarnissage : balises, zone marquée, benne
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.5 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.5 });
  for (let s = WORKSITE.s0; s <= WORKSITE.s1; s += 10) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 16), orange);
    cone.position.copy(P(s, -7.3, 0.35));
    cone.castShadow = true;
    scene.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 16), whiteM);
    band.position.copy(P(s, -7.3, 0.42));
    scene.add(band);
  }
  const skip = new THREE.Group();
  const skipMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.6, metalness: 0.4 });
  const W = 2.2;
  const L = 4.2;
  const Hs = 1.4;
  for (const [w, h, d, x, y, z] of [[W, 0.1, L, 0, 0.05, 0], [0.08, Hs, L, -W / 2, Hs / 2, 0], [0.08, Hs, L, W / 2, Hs / 2, 0], [W, Hs, 0.08, 0, Hs / 2, -L / 2], [W, Hs, 0.08, 0, Hs / 2, L / 2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skipMat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    skip.add(m);
  }
  const sp = P(WORKSITE.skipS, WORKSITE.skipLat);
  skip.position.set(sp.x, groundHeight(sp.x, sp.z), sp.z);
  skip.rotation.y = -frame(WORKSITE.skipS).th;
  scene.add(skip);
  const skipFill = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 1, L - 0.2), new THREE.MeshStandardMaterial({ map: tex("gravel_stones/Diffuse.jpg"), color: 0x8a8070, roughness: 1 }));
  skipFill.scale.y = 0.001;
  skipFill.position.y = 0.1;
  skip.add(skipFill);

  // Gare
  buildStation(scene);
  return { skip, skipFill };
}

function buildStation(scene) {
  const { from, to, stopMark, name } = STATION;
  const top = RAIL_TOP_Y + 0.55;
  const concrete = new THREE.MeshStandardMaterial({ map: tex("concrete_floor_worn_001/Diffuse.jpg", { repeat: 0.5 }), color: 0xd8d4cc, roughness: 0.9 });
  const edge = TRACK_LAT - 1.65;
  const quay = new THREE.Mesh(sweep({ s0: from, s1: to, step: 4, profile: [[edge - 5.5, -0.8], [edge - 5.5, top], [edge, top], [edge, -0.8]] }), concrete);
  quay.receiveShadow = quay.castShadow = true;
  scene.add(quay);
  scene.add(new THREE.Mesh(sweep({ s0: from, s1: to, step: 4, profile: [[edge - 0.6, top + 0.005], [edge - 0.5, top + 0.005]] }), new THREE.MeshStandardMaterial({ color: 0xf1f1ea })));
  scene.add(new THREE.Mesh(sweep({ s0: from, s1: to, step: 4, profile: [[edge - 0.35, top + 0.006], [edge - 0.08, top + 0.006]] }), new THREE.MeshStandardMaterial({ color: 0xf2c200 })));
  const steel = new THREE.MeshStandardMaterial({ color: 0x3d4650, roughness: 0.45, metalness: 0.7 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6f8394, roughness: 0.35, metalness: 0.6, side: THREE.DoubleSide });
  const parts = [];
  for (let s = from + 90; s <= from + 150; s += 10) {
    for (const d of [2.2, 4.4]) {
      const g = new THREE.BoxGeometry(0.14, 3.2, 0.14);
      const p = P(s, edge - d, top + 1.6);
      g.rotateY(-frame(s).th);
      g.translate(p.x, p.y, p.z);
      parts.push(g);
    }
  }
  scene.add(new THREE.Mesh(mergeGeometries(parts), steel));
  const roof = new THREE.Mesh(sweep({ s0: from + 87, s1: from + 153, step: 3, profile: [[edge - 5.0, top + 3.15], [edge - 5.0, top + 3.3], [edge - 1.8, top + 3.5], [edge - 1.8, top + 3.35]], closed: true }), roofMat);
  roof.castShadow = true;
  scene.add(roof);
  const nameTex = canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = "#0f2f6b";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "800 110px Inter, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name, w / 2, h / 2 + 6);
  });
  for (const s of [from + 40, from + 200]) {
    const bmat = new THREE.MeshStandardMaterial({ map: nameTex });
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.6, 0.06), [steel, steel, steel, steel, bmat, bmat]);
    b.position.copy(P(s, edge - 3.3, top + 2.6));
    b.rotation.y = -frame(s).th + Math.PI / 2;
    scene.add(b);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), steel);
    pole.position.copy(P(s, edge - 3.3, top + 1.15));
    scene.add(pole);
  }
  const markTex = canvasTex(256, 256, (g, w) => {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, w, w);
    g.fillStyle = "#1a4fb5";
    g.fillRect(16, 16, w - 32, w - 32);
    g.fillStyle = "#fff";
    g.font = "800 150px Inter, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("T", w / 2, w / 2 + 8);
  });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: markTex }));
  mark.position.copy(P(stopMark, edge - 0.9, top + 2.1));
  mark.rotation.y = -frame(stopMark).th + Math.PI;
  scene.add(mark);
  const mp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.08), steel);
  mp.position.copy(P(stopMark, edge - 0.9, top + 1.05));
  scene.add(mp);
  const stop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xc8352b, roughness: 0.6 }));
  stop.position.copy(P(lineLength() + 20, TRACK_LAT, 0.8));
  stop.rotation.y = -frame(lineLength() + 20).th;
  scene.add(stop);
  void rng;
}
