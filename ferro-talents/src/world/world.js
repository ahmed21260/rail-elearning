// Assemblage du monde : relief réel, voie, caténaire, base travaux, végétation, signaux, engins.
import * as THREE from "three";
import { initLine, lineLength, frame, P, fbm } from "./line.js";
import { loadDEM, buildTerrain, dem, worldHalf } from "./terrain.js";
import { buildTrack, TRACK_LAT } from "./track.js";
import { declarePads, buildDepot, isFree, DEPOT, ENRAIL } from "./depot.js";
import { buildVegetation } from "./vegetation.js";
import { buildDecor } from "./decor.js";
import { buildSignal } from "./signal.js";
import { BASE, loadJSON, loadHDR, loadImage, loadModel, texturesReady } from "../core/assets.js";
import { setupSky } from "../core/renderer.js";
import { buildTrain } from "../vehicles/train.js";
import { buildExcavator } from "../vehicles/excavator.js";
import { buildNacelle } from "../vehicles/nacelle.js";
import { buildWorker } from "../vehicles/worker.js";
import { SIGNALS, TIV, TRAIN_START } from "../jobs/train-rules.js";

// Modèles Sketchfab (tools/sketchfab.py, crédits dans assets/SKETCHFAB.md) : optionnels
const SF_DECOR = ["gare_saint_remy", "maison_troyes_8", "maison_troyes_2", "maison_troyes_f1", "maison_angers_1"];

const MODELS = [
  "shrub_02", "grass_medium_02", "fern_02", "celandine_01", "rock_moss_set_01", "tree_stump_01",
  "concrete_road_barrier", "portable_generator", "tool_cart", "metal_toolbox", "wooden_crate_01",
  "industrial_pastic_container", "propane_tank", "street_lamp_01", "wooden_ladder",
];

function plate(text, bg, fg, w = 256, h = 256) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#111";
  g.fillRect(0, 0, w, h);
  g.fillStyle = bg;
  g.fillRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg;
  g.font = `800 ${Math.round(h * 0.55)}px Inter, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function trackSign(scene, s, text, bg, fg) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c9196, metalness: 0.7, roughness: 0.5 });
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), steel);
  pole.position.y = 1.3;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({ map: plate(text, bg, fg) }));
  face.position.set(0, 2.5, 0.03);
  g.add(pole, face);
  g.traverse((o) => (o.castShadow = true));
  const f = frame(s);
  g.position.copy(P(s, TRACK_LAT - 3.1, 0));
  g.rotation.y = -f.th;
  scene.add(g);
}

function buildHorizon(scene, horizon) {
  const R = worldHalf() * 1.12;
  const n = 360;
  const pos = [];
  const col = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const edge = dem(Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88);
    const h = edge + 120 + 260 * (0.5 + 0.5 * fbm(Math.cos(a) * 3, Math.sin(a) * 3, 5));
    pos.push(x, edge - 200, z, x, h, z);
    const lo = new THREE.Color(0.2, 0.3, 0.22).lerp(horizon, 0.7);
    const hi = new THREE.Color(0.16, 0.24, 0.2).lerp(horizon, 0.35);
    col.push(lo.r, lo.g, lo.b, hi.r, hi.g, hi.b);
  }
  const idx = [];
  for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })));
}

/** progress(texte, 0..1) pour l'écran de chargement. */
export async function buildWorld(core, scene, quality, progress = () => {}) {
  progress("Tracé de la ligne et relief réel…", 0.05);
  initLine(await loadJSON("data/line.json"));
  await loadDEM(`${BASE}/dem`);
  const sfDecor = Promise.all(SF_DECOR.map((n) => loadModel(`sf/${n}.glb`).catch((e) => (console.warn("[FT] modèle ignoré :", e.message), null))));
  const [hdr, bgImg, workerGltf, excGltf, epicea, hetre, pin, bouleau, ...mods] = await Promise.all([
    loadHDR("kloofendal_48d_partly_cloudy_puresky"),
    loadImage(`${BASE}/hdri/kloofendal_48d_partly_cloudy_puresky_bg.jpg`),
    loadModel("worker.glb"),
    loadModel("sf/pelle_atek.glb").catch((e) => (console.warn("[FT] modèle ignoré :", e.message), null)), // pelle réaliste (Sketchfab), sinon version procédurale
    loadModel("sf/epicea.glb").catch((e) => (console.warn("[FT] modèle ignoré :", e.message), null)), // arbres réalistes (Sketchfab), sinon arbres procéduraux
    loadModel("sf/hetre.glb").catch((e) => (console.warn("[FT] modèle ignoré :", e.message), null)),
    loadModel("sf/pin.glb").catch((e) => (console.warn("[FT] modèle ignoré :", e.message), null)),
    loadModel("sf/bouleau.glb").catch((e) => (console.warn("[FT] modèle ignoré :", e.message), null)),
    ...MODELS.map((m) => loadModel(m)),
    document.fonts.load("800 120px Inter"),
  ]);
  const models = Object.fromEntries(MODELS.map((m, i) => [m, mods[i]]));
  const sfd = await sfDecor;

  progress("Ciel et lumière…", 0.2);
  const f = frame(lineLength() / 2);
  const horizon = setupSky(core, scene, hdr, bgImg, new THREE.Vector2(0.8 * f.rx - 0.6 * f.fx, 0.8 * f.rz - 0.6 * f.fz));
  buildHorizon(scene, horizon);

  progress("Terrassements et terrain…", 0.3);
  declarePads();
  buildTerrain(scene, quality);
  progress("Voie et caténaire…", 0.45);
  const skipMasts = [
    (s, lat) => lat < 0 && SIGNALS.some((d) => Math.abs(d.s - s) < 8),
    (s, lat) => lat < 0 && Math.abs(s - ENRAIL.s) < ENRAIL.half + 2,
  ];
  const cat = buildTrack(scene, { quality, skipMasts });
  progress("Base travaux et gare…", 0.55);
  const depot = buildDepot(scene, models);
  const decor = buildDecor(scene, Object.fromEntries(SF_DECOR.map((n, i) => [n, sfd[i]])));
  trackSign(scene, TIV.from - 700, `${TIV.limit / 10}`, "#ffc21a", "#111"); // annonce (chiffre des dizaines)
  trackSign(scene, TIV.from, "Z", "#ffc21a", "#111");
  trackSign(scene, TIV.to + 50, "R", "#ffc21a", "#111");

  progress("Forêts, prairies et haies…", 0.65);
  const veg = await buildVegetation(core.renderer, scene, { quality, models, trees: { epicea, hetre, pin, bouleau }, isFree });

  progress("Signaux et engins…", 0.85);
  const signals = Object.fromEntries(SIGNALS.map((d) => [d.id, { api: buildSignal(scene, { s: d.s, lat: TRACK_LAT - 2.8, label: d.label, lamps: {} }), lit: {} }]));
  const train = buildTrain(scene);
  train.update(TRAIN_START, TRACK_LAT);
  train.panto = 0;
  train.lights = false;
  const other = buildTrain(scene);
  other.visible = false;
  const exc = buildExcavator(scene, excGltf);
  const nac = buildNacelle(scene);
  const park = (rr, s, lat) => {
    const p = P(s, lat);
    rr.setRoad(p.x, p.z, -frame(s).th);
  };
  park(exc.rr, 322, -30);
  park(nac.rr, 348, -30);
  exc.rr.update(0, { throttle: 0, steer: 0 });
  nac.rr.update(0, { throttle: 0, steer: 0 });
  // Personnages 3D : l'agent joué et le chef de chantier (point de rassemblement de la base)
  const avatar = buildWorker(scene, workerGltf, "agent");
  const chef = buildWorker(scene, workerGltf, "chef");
  const spawn = P(290, -52);
  Object.assign(avatar.st, { x: spawn.x, z: spawn.z, yaw: -frame(290).th - Math.PI / 2 });
  const cp = P(296, -48);
  Object.assign(chef.st, { x: cp.x, z: cp.z, yaw: Math.atan2(cp.x - spawn.x, cp.z - spawn.z) });

  await texturesReady();
  progress("Compilation des shaders…", 0.95);
  core.renderer.compile(scene, new THREE.PerspectiveCamera());
  return { models, cat, depot, decor, veg, signals, train, other, exc, nac, avatar, chef, spawn, DEPOT };
}
