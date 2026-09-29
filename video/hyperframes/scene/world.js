// Décor : terrain, plateforme ferroviaire, caténaire, végétation, collines.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { P, frame, sweep, matrixAt, rng, fbm, noise2, smooth } from "./path.js";

export const TRACK_LAT = -2.1; // voie empruntée (circulation à gauche)
export const OTHER_LAT = 2.1;
export const RAIL_HALF = 0.7535; // demi-entraxe des rails (écartement 1 435 mm + demi-champignon)
export const RAIL_BASE_Y = 0.19;
export const RAIL_TOP_Y = RAIL_BASE_Y + 0.172;

const TEX = "assets/textures/";
const texLoader = new THREE.TextureLoader();
const pending = [];
/** Résolu quand toutes les textures sont chargées (sinon l'image serait noire au premier rendu). */
export const texturesReady = () => Promise.all(pending);

function tex(path, { srgb = true, repeat = 1, aniso = 8 } = {}) {
  let done;
  pending.push(new Promise((ok, ko) => (done = [ok, ko])));
  const t = texLoader.load(TEX + path, () => done[0](), undefined, () => done[1](new Error(TEX + path)));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** InstancedMesh découpés par tronçons le long de s : le frustum culling reste efficace. */
function chunked(parent, geo, mat, items, { chunk = 100, cast = false, receive = false } = {}) {
  const groups = new Map();
  for (const it of items) {
    const k = Math.floor(it.s / chunk);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  for (const list of groups.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.c) im.setColorAt(i, it.c);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast;
    im.receiveShadow = receive;
    parent.add(im);
  }
}

// ------------------------------------------------------------------------------------
// Terrain : grille dans le repère de la ligne (s, lat) → la plateforme reste plane.
export function groundHeight(s, lat) {
  const a = Math.abs(lat);
  const ditch = -0.5 * Math.exp(-(((a - 7.6) / 0.9) ** 2));
  const w = smooth(10, 110, a);
  const hills = fbm(s * 0.0016 + 3.1, lat * 0.0016 + 0.7) * 42 + fbm(s * 0.008, lat * 0.008) * 3.5;
  return -0.6 + ditch + w * (hills + 14 * smooth(250, 1500, a));
}

const FIELD_S = 170;
const FIELD_L = 120;
function fieldCell(s, lat) {
  const side = lat < 0 ? -1 : 1;
  const a = Math.abs(lat) - 14;
  const row = Math.floor(a / FIELD_L);
  const off = noise2(row * 3.1, side * 7.7) * FIELD_S;
  const col = Math.floor((s + off) / FIELD_S);
  const h = (noise2(col * 1.37 + 0.5, row * 2.11 + side * 5.3) + 1) / 2;
  const edgeS = Math.min(((s + off) % FIELD_S + FIELD_S) % FIELD_S, FIELD_S - (((s + off) % FIELD_S + FIELD_S) % FIELD_S));
  const edgeL = Math.min(((a % FIELD_L) + FIELD_L) % FIELD_L, FIELD_L - (((a % FIELD_L) + FIELD_L) % FIELD_L));
  return { type: Math.floor(h * 4.999), edge: Math.min(edgeS, edgeL), row, col };
}

const FIELD_TINT = [
  new THREE.Color(1.0, 1.0, 0.95), // prairie
  new THREE.Color(1.55, 1.3, 0.62), // blé mûr
  new THREE.Color(0.78, 0.6, 0.46), // labour
  new THREE.Color(0.85, 1.12, 0.62), // culture verte
  new THREE.Color(1.15, 1.08, 0.7), // chaume
];

function buildTerrain(scene) {
  const lats = [];
  const side = [];
  for (let l = 5.2; l < 30; l += 1) side.push(l);
  for (let l = 30; l < 200; l += 5) side.push(l);
  for (let l = 200; l <= 1600; l += 40) side.push(l);
  for (let i = side.length - 1; i >= 0; i--) lats.push(-side[i]);
  lats.push(-2, 2);
  lats.push(...side);
  const ss = [];
  for (let s = -1600; s < -300; s += 20) ss.push(s);
  for (let s = -300; s < 2200; s += 4) ss.push(s);
  for (let s = 2200; s <= 3600; s += 20) ss.push(s);

  const nv = ss.length * lats.length;
  const pos = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const c = new THREE.Color();
  const cess = new THREE.Color(0.62, 0.56, 0.5);
  const ditchC = new THREE.Color(0.7, 0.85, 0.55);
  let v = 0;
  for (const s of ss) {
    const f = frame(s);
    for (const lat of lats) {
      const y = groundHeight(s, lat);
      const x = f.x + f.rx * lat;
      const z = f.z + f.rz * lat;
      pos.set([x, y, z], v * 3);
      uv.set([x / 3.5, z / 3.5], v * 2);
      const a = Math.abs(lat);
      if (a < 6.4) c.copy(cess);
      else if (a < 9) c.copy(ditchC);
      else if (a < 16) c.setRGB(1, 1, 0.92);
      else {
        const fc = fieldCell(s, lat);
        c.copy(FIELD_TINT[fc.type]);
        if (fc.edge < 4) c.lerp(FIELD_TINT[0], 0.6);
      }
      const n = 0.9 + 0.12 * noise2(x * 0.05, z * 0.05);
      c.multiplyScalar(n);
      col.set([c.r, c.g, c.b], v * 3);
      v++;
    }
  }
  const idx = [];
  const W = lats.length;
  for (let j = 0; j < ss.length - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      const b = (j + 1) * W + i;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: tex("sparse_grass/Diffuse.jpg"),
    normalMap: tex("sparse_grass/nor_gl.jpg", { srgb: false }),
    normalScale: new THREE.Vector2(0.8, 0.8),
    vertexColors: true,
    roughness: 0.95,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ------------------------------------------------------------------------------------
function buildTrackbed(scene) {
  const S0 = -400;
  const S1 = 2400;
  const gravel = new THREE.MeshStandardMaterial({
    map: tex("gravel_stones/Diffuse.jpg", { repeat: 0.9 }),
    normalMap: tex("gravel_stones/nor_gl.jpg", { srgb: false, repeat: 0.9 }),
    roughnessMap: tex("gravel_stones/Rough.jpg", { srgb: false, repeat: 0.9 }),
    normalScale: new THREE.Vector2(1.6, 1.6),
    color: new THREE.Color(0.92, 0.88, 0.84),
  });
  const ballast = new THREE.Mesh(
    sweep({ s0: S0, s1: S1, step: 2, profile: [[-5.4, -0.62], [-4.05, 0.15], [4.05, 0.15], [5.4, -0.62]] }),
    gravel,
  );
  ballast.receiveShadow = true;
  scene.add(ballast);

  // Caniveau à câbles en béton le long de la voie
  const concrete = new THREE.MeshStandardMaterial({
    map: tex("concrete_floor_worn_001/Diffuse.jpg", { repeat: 0.8 }),
    normalMap: tex("concrete_floor_worn_001/nor_gl.jpg", { srgb: false, repeat: 0.8 }),
    roughness: 0.9,
  });
  for (const lat of [-6.9, 6.9]) {
    const m = new THREE.Mesh(
      sweep({ s0: S0, s1: S1, step: 4, lat, y: -0.62, profile: [[-0.22, 0], [-0.22, 0.28], [0.22, 0.28], [0.22, 0]] }),
      concrete,
    );
    m.receiveShadow = true;
    scene.add(m);
  }

  // Traverses béton (60 cm) et attaches
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
      const jitter = (r() - 0.5) * 0.02;
      sleepers.push({ s, m: matrixAt(new THREE.Matrix4(), s, tl, 0.07, jitter) });
      if (s > -150 && s < 1400) {
        for (const d of [-RAIL_HALF - 0.1, -RAIL_HALF + 0.1, RAIL_HALF - 0.1, RAIL_HALF + 0.1]) {
          clips.push({ s, m: matrixAt(new THREE.Matrix4(), s, tl + d, 0.21) });
        }
      }
    }
  }
  chunked(scene, sleeperGeo, sleeperMat, sleepers, { receive: true, cast: true });
  chunked(scene, clipGeo, clipMat, clips, { chunk: 60 });

  // Rails UIC 60 (profil simplifié, sens horaire) + surface de roulement brillante
  const railProfile = [
    [-0.075, 0], [-0.075, 0.012], [-0.012, 0.03], [-0.0085, 0.045], [-0.0085, 0.115], [-0.036, 0.125],
    [-0.036, 0.162], [-0.03, 0.172], [0.03, 0.172], [0.036, 0.162], [0.036, 0.125], [0.0085, 0.115],
    [0.0085, 0.045], [0.012, 0.03], [0.075, 0.012], [0.075, 0],
  ];
  const rust = new THREE.MeshStandardMaterial({
    map: tex("rusty_metal_02/Diffuse.jpg", { repeat: 2 }),
    color: new THREE.Color(0.75, 0.62, 0.52),
    roughness: 0.75,
    metalness: 0.4,
  });
  const shiny = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.18, metalness: 1.0 });
  for (const tl of [TRACK_LAT, OTHER_LAT]) {
    for (const side of [-1, 1]) {
      const lat = tl + side * RAIL_HALF;
      const rail = new THREE.Mesh(sweep({ s0: S0, s1: S1, step: 2, lat, y: RAIL_BASE_Y, profile: railProfile, closed: true }), rust);
      rail.castShadow = true;
      rail.receiveShadow = true;
      scene.add(rail);
      const top = new THREE.Mesh(sweep({ s0: S0, s1: S1, step: 2, lat, y: RAIL_BASE_Y + 0.1722, profile: [[-0.029, 0], [0.029, 0]] }), shiny);
      scene.add(top);
    }
  }
}

// ------------------------------------------------------------------------------------
// Caténaire 25 kV : poteaux H, consoles, porteur, fil de contact en zigzag, pendules.
export const CONTACT_Y = RAIL_TOP_Y + 5.5;
const SPAN = 54;
const MAST_S0 = -400;

export function contactLat(s, trackLat) {
  const k = Math.floor((s - MAST_S0) / SPAN);
  const u = (s - MAST_S0 - k * SPAN) / SPAN;
  const z0 = k % 2 === 0 ? 0.2 : -0.2;
  return trackLat + z0 + (-2 * z0) * u;
}

function boxBetween(parts, s, p1, p2, t, extraYaw = 0) {
  // Barre entre deux points (lat, y) du plan de profil à l'abscisse s
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const g = new THREE.BoxGeometry(len, t, t);
  g.rotateZ(Math.atan2(p2[1] - p1[1], p2[0] - p1[0]));
  g.translate((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0);
  const f = frame(s);
  g.rotateY(-f.th + extraYaw);
  g.translate(f.x, 0, f.z);
  parts.push(g);
}

function buildCatenary(scene, avoid) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.55, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b3530, roughness: 0.5, metalness: 0.6 });
  const insul = new THREE.MeshStandardMaterial({ color: 0x5a3b2a, roughness: 0.35 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.95 });
  const chunks = new Map();
  const push = (s, key, g) => {
    const k = `${key}:${Math.floor(s / 300)}`;
    if (!chunks.has(k)) chunks.set(k, { key, list: [] });
    chunks.get(k).list.push(g);
  };
  for (let s = MAST_S0; s < 2400; s += SPAN) {
    if (avoid.some((a) => Math.abs(a - s) < 8)) continue;
    for (const [mastLat, tl] of [[-6.1, TRACK_LAT], [6.1, OTHER_LAT]]) {
      const dir = Math.sign(tl - mastLat);
      const parts = [];
      // Poteau H (âme + semelles)
      boxBetween(parts, s, [mastLat, -0.6], [mastLat, 8.4], 0.24);
      boxBetween(parts, s, [mastLat - dir * 0.12, 8.4], [mastLat + dir * 0.12, 8.4], 0.3);
      // Console : tube porteur et bras de rappel
      const zig = contactLat(s, tl);
      boxBetween(parts, s, [mastLat, CONTACT_Y + 1.35], [tl + dir * 0.9, CONTACT_Y + 1.35], 0.07);
      boxBetween(parts, s, [mastLat, CONTACT_Y + 0.25], [zig - dir * 0.05, CONTACT_Y + 0.1], 0.055);
      boxBetween(parts, s, [mastLat, CONTACT_Y + 0.25], [tl + dir * 0.3, CONTACT_Y + 1.35], 0.05);
      boxBetween(parts, s, [zig, CONTACT_Y + 0.02], [zig, CONTACT_Y + 0.18], 0.04);
      push(s, "steel", mergeGeometries(parts));
      const ins = [];
      boxBetween(ins, s, [mastLat + dir * 0.15, CONTACT_Y + 1.35], [mastLat + dir * 0.75, CONTACT_Y + 1.35], 0.13);
      boxBetween(ins, s, [mastLat + dir * 0.15, CONTACT_Y + 0.25], [mastLat + dir * 0.7, CONTACT_Y + 0.23], 0.12);
      push(s, "insul", mergeGeometries(ins));
      const base = new THREE.BoxGeometry(0.9, 0.5, 0.9);
      const f = frame(s);
      base.translate(f.x + f.rx * mastLat, -0.55, f.z + f.rz * mastLat);
      push(s, "concrete", base);
    }
  }
  const mats = { steel, insul, concrete };
  for (const { key, list } of chunks.values()) {
    const m = new THREE.Mesh(mergeGeometries(list), mats[key]);
    m.castShadow = key !== "concrete";
    m.receiveShadow = true;
    scene.add(m);
  }

  // Fils (profil losange fin) : contact, porteur, feeder ; pendules tous les 9 m
  const wire = (r) => [[-r, 0], [0, r], [r, 0], [0, -r]];
  const sag = (s, base, depth) => {
    const u = (((s - MAST_S0) % SPAN) + SPAN) % SPAN / SPAN;
    return base - depth * 4 * u * (1 - u);
  };
  const droppers = [];
  for (const [tl, mastLat] of [[TRACK_LAT, -6.1], [OTHER_LAT, 6.1]]) {
    const add = (g) => {
      const m = new THREE.Mesh(g, dark);
      m.castShadow = true;
      scene.add(m);
    };
    add(sweep({ s0: -400, s1: 2400, step: 3, lat: (s) => contactLat(s, tl), y: CONTACT_Y, profile: wire(0.014), closed: true }));
    add(sweep({ s0: -400, s1: 2400, step: 3, lat: tl, y: (s) => sag(s, CONTACT_Y + 1.35, 0.9), profile: wire(0.012), closed: true }));
    add(sweep({ s0: -400, s1: 2400, step: 3, lat: mastLat, y: (s) => sag(s, 8.3, 0.6), profile: wire(0.016), closed: true }));
    for (let s = MAST_S0 + 4.5; s < 2400; s += 9) {
      if ((((s - MAST_S0) % SPAN) + SPAN) % SPAN < 3) continue;
      const top = sag(s, CONTACT_Y + 1.35, 0.9);
      const h = top - CONTACT_Y;
      const m = new THREE.Matrix4();
      const f = frame(s);
      const lat = (contactLat(s, tl) + tl) / 2;
      m.compose(
        new THREE.Vector3(f.x + f.rx * lat, CONTACT_Y + h / 2, f.z + f.rz * lat),
        new THREE.Quaternion(),
        new THREE.Vector3(1, h, 1),
      );
      droppers.push({ s, m });
    }
  }
  chunked(scene, new THREE.BoxGeometry(0.012, 1, 0.012), dark, droppers, { chunk: 150 });
}

// ------------------------------------------------------------------------------------
// Végétation : vrais modèles glTF près de la voie, imposteurs (panneaux croisés) au loin.
function makeImpostor(renderer, model, size = 512) {
  const box = new THREE.Box3().setFromObject(model);
  const sz = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const w = Math.max(sz.x, sz.z);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, sz.y / 2, -sz.y / 2, 0.01, 100);
  cam.position.set(ctr.x, ctr.y, ctr.z + 20);
  cam.lookAt(ctr);
  const sc = new THREE.Scene();
  sc.add(model);
  sc.add(new THREE.HemisphereLight(0xe8f0ff, 0x4a4030, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.set(ctr.x + 8, ctr.y + 14, ctr.z + 10);
  sc.add(sun);
  const h = Math.round((size * sz.y) / w);
  const rt = new THREE.WebGLRenderTarget(size, h, { samples: 4 });
  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(sc, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  sc.remove(model);
  // Deux plans croisés, base à y = 0
  const a = new THREE.PlaneGeometry(1, sz.y / w);
  a.translate(0, sz.y / w / 2, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  return { texture: rt.texture, geometry: mergeGeometries([a, b]), aspect: sz.y / w, height: sz.y };
}

function prepModel(gltf) {
  const root = gltf.scene;
  root.traverse((o) => {
    if (o.isMesh) {
      o.material.transparent = false;
      o.material.alphaTest = 0.45;
      o.material.depthWrite = true;
      o.castShadow = true;
    }
  });
  return root;
}

/** Aplatis un modèle glTF en couples (géométrie, matériau) pour l'instanciation. */
function flatten(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (o.isMesh) out.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material });
  });
  return out;
}

function buildVegetation(renderer, scene, models) {
  const shrub = prepModel(models.shrub_02);
  const bush = prepModel(models.wild_rooibos_bush);
  const grass = prepModel(models.grass_medium_02);
  const treeImp = makeImpostor(renderer, shrub.clone());
  const bushImp = makeImpostor(renderer, bush.clone(), 256);
  const grassImp = makeImpostor(renderer, grass.clone(), 256);
  const impMat = (imp) =>
    new THREE.MeshLambertMaterial({ map: imp.texture, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false });

  const r = rng(2024);
  const trees = [];
  const addTree = (s, lat, hMin, hMax) => {
    const y = groundHeight(s, lat) - 0.3;
    const hgt = hMin + r() * (hMax - hMin);
    const w = hgt / treeImp.aspect;
    const m = new THREE.Matrix4();
    const f = frame(s);
    m.compose(
      new THREE.Vector3(f.x + f.rx * lat, y, f.z + f.rz * lat),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI),
      new THREE.Vector3(w * (0.85 + r() * 0.3), hgt, w),
    );
    const tint = 0.72 + r() * 0.35;
    trees.push({ s, m, c: new THREE.Color(tint * (0.9 + r() * 0.15), tint, tint * (0.8 + r() * 0.15)) });
  };
  // Haies et arbres en limite de parcelles
  for (let s = -700; s < 2600; s += 7) {
    for (const sign of [-1, 1]) {
      for (let a = 26; a < 1200; a += 9 + r() * 6) {
        const lat = sign * a;
        const fc = fieldCell(s, lat);
        const forest = fbm(s * 0.004 + 9, lat * 0.004 - 3, 3);
        if (forest > 0.22 && a > 60) {
          if (r() < 0.8) addTree(s + (r() - 0.5) * 6, lat + (r() - 0.5) * 6, 9, 17);
        } else if (fc.edge < 3.5 && r() < 0.55) {
          addTree(s + (r() - 0.5) * 3, lat + (r() - 0.5) * 3, 6, 12);
        } else if (r() < 0.004) {
          addTree(s, lat, 8, 15);
        }
      }
    }
  }
  chunked(scene, treeImp.geometry, impMat(treeImp), trees, { chunk: 250 });

  // Buissons réels (glTF) sur les talus proches, imposteurs pour les touffes d'herbe
  const shrubParts = flatten(shrub);
  const bushParts = flatten(bush);
  const nearShrubs = [];
  const nearBushes = [];
  const bushes = [];
  const tufts = [];
  for (let s = -250; s < 1500; s += 3) {
    for (const sign of [-1, 1]) {
      if (r() < 0.16) {
        const lat = sign * (9.5 + r() * 12);
        const m = new THREE.Matrix4().compose(
          P(s, lat, groundHeight(s, lat) - 0.1),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28),
          new THREE.Vector3().setScalar(0.9 + r() * 1.3),
        );
        (r() < 0.5 ? nearShrubs : nearBushes).push({ s, m });
      }
      for (let k = 0; k < 3; k++) {
        const lat = sign * (5.6 + r() * 5);
        const sc = 0.5 + r() * 0.7;
        tufts.push({
          s,
          m: new THREE.Matrix4().compose(
            P(s + r() * 3, lat, groundHeight(s, lat) - 0.05),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 3.14),
            new THREE.Vector3(sc / grassImp.aspect * 0.5, sc * 0.5, sc / grassImp.aspect * 0.5).multiplyScalar(2.2),
          ),
          c: new THREE.Color().setScalar(0.85 + r() * 0.3),
        });
      }
      if (r() < 0.35) {
        const lat = sign * (12 + r() * 60);
        const hgt = 1 + r() * 1.6;
        bushes.push({
          s,
          m: new THREE.Matrix4().compose(
            P(s, lat, groundHeight(s, lat) - 0.1),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 3.14),
            new THREE.Vector3(hgt / bushImp.aspect, hgt, hgt / bushImp.aspect),
          ),
          c: new THREE.Color().setScalar(0.8 + r() * 0.3),
        });
      }
    }
  }
  for (const part of shrubParts) chunked(scene, part.geometry, part.material, nearShrubs, { chunk: 80, cast: true });
  for (const part of bushParts) chunked(scene, part.geometry, part.material, nearBushes, { chunk: 80, cast: true });
  chunked(scene, bushImp.geometry, impMat(bushImp), bushes, { chunk: 120 });
  chunked(scene, grassImp.geometry, impMat(grassImp), tufts, { chunk: 60 });
}

// ------------------------------------------------------------------------------------
function buildHills(scene, horizon) {
  const center = P(900, 0, 0);
  for (const [R, hMin, hMax, top, seed] of [
    [2300, 60, 230, new THREE.Color(0.36, 0.45, 0.42), 1],
    [3300, 160, 480, new THREE.Color(0.52, 0.6, 0.7), 7],
  ]) {
    const n = 360;
    const pos = [];
    const col = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const h = hMin + (hMax - hMin) * (0.5 + 0.5 * fbm(Math.cos(a) * 3 + seed, Math.sin(a) * 3 - seed, 5));
      const x = center.x + Math.cos(a) * R;
      const z = center.z + Math.sin(a) * R;
      pos.push(x, -30, z, x, h, z);
      const low = horizon.clone();
      const hi = top.clone().lerp(horizon, 0.35);
      col.push(low.r, low.g, low.b, hi.r, hi.g, hi.b);
    }
    const idx = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -1;
    scene.add(m);
  }
}

// ------------------------------------------------------------------------------------
function buildDetails(scene) {
  // Poteaux kilométriques (tous les 100 m) et armoire de signalisation près du carré
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.6 });
  const posts = [];
  for (let s = -300; s < 2000; s += 100) posts.push({ s, m: matrixAt(new THREE.Matrix4(), s, -4.7, -0.1) });
  chunked(scene, new THREE.BoxGeometry(0.12, 1.1, 0.12), white, posts, { chunk: 500, cast: true });
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xb4b8b4, roughness: 0.55, metalness: 0.3 }),
  );
  P(812, -8.2, 0.25, cab.position);
  cab.rotation.y = -frame(812).th;
  cab.castShadow = cab.receiveShadow = true;
  scene.add(cab);
}

export function buildWorld(renderer, scene, { models, horizon, signalS }) {
  buildTerrain(scene);
  buildTrackbed(scene);
  buildCatenary(scene, signalS);
  if (!new URLSearchParams(location.search).has("novege")) buildVegetation(renderer, scene, models);
  buildHills(scene, horizon);
  buildDetails(scene);
}
