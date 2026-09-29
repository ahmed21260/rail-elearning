// Composition 3D : chargement des assets, construction, caméra, interface. Rendu piloté par hf-seek.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { P, frame } from "./path.js";
import { buildWorld, texturesReady, TRACK_LAT, OTHER_LAT, RAIL_TOP_Y } from "./world.js";
import { buildTrain } from "./train.js";
import { buildSignal } from "./signal.js";
import * as story from "./story.js";

const W = 1920;
const H = 1080;
const HDRI = "kloofendal_48d_partly_cloudy_puresky";

const DBG = new URLSearchParams(location.search);
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = !DBG.has("noshadow");
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 8000);
// Anticrénelage FXAA en post-traitement : ~2× plus rapide que le MSAA en rendu logiciel.
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const fxaa = new ShaderPass(FXAAShader);
fxaa.material.uniforms.resolution.value.set(1 / W, 1 / H);
if (!DBG.has("noaa")) composer.addPass(fxaa);
const sun = new THREE.DirectionalLight(0xfff1e0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 900 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3();

let ctx = null; // objets construits
let pendingT = 0;

function loadImage(url) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = url;
  });
}

/** Direction du soleil = pixel le plus lumineux de l'HDRI (au-dessus de l'horizon). */
function findSun(hdr) {
  const { data, width, height } = hdr.image;
  let best = -1;
  let bi = 0;
  let bj = 0;
  for (let j = 0; j < height / 2; j++) {
    for (let i = 0; i < width; i++) {
      const k = (j * width + i) * 4;
      const l = data[k] * 0.2126 + data[k + 1] * 0.7152 + data[k + 2] * 0.0722;
      if (l > best) [best, bi, bj] = [l, i, j];
    }
  }
  const u = (bi + 0.5) / width;
  const v = 1 - (bj + 0.5) / height;
  const phi = (u - 0.5) * 2 * Math.PI;
  const el = (v - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
}

/** Couleur de l'horizon (juste au-dessus de la ligne d'horizon du fond) → brume. */
function horizonColor(img) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, 512, 256);
  const d = g.getImageData(0, 118, 512, 6).data;
  let r = 0;
  let gg = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) [r, gg, b] = [r + d[i], gg + d[i + 1], b + d[i + 2]];
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

async function build() {
  const gltf = new GLTFLoader();
  const hdrLoader = new HDRLoader().setDataType(THREE.FloatType);
  const names = ["shrub_02", "wild_rooibos_bush", "grass_medium_02"];
  const [hdr, bgImg, ...gl] = await Promise.all([
    hdrLoader.loadAsync(`assets/hdri/${HDRI}_2k.hdr`),
    loadImage(`assets/hdri/${HDRI}_bg.jpg`),
    ...names.map((n) => gltf.loadAsync(`assets/models/${n}/${n}.gltf`)),
    document.fonts.load("700 76px Inter"),
  ]);
  const models = Object.fromEntries(names.map((n, i) => [n, gl[i]]));

  // Ciel et éclairage : on tourne l'HDRI pour placer le soleil à droite, légèrement derrière le train.
  const src = findSun(hdr);
  const f = frame(800);
  const want = new THREE.Vector2(0.8 * f.rx - 0.6 * f.fx, 0.8 * f.rz - 0.6 * f.fz);
  const rotY = Math.atan2(want.x, want.y) - Math.atan2(src.x, src.z);
  sunDir.copy(src).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  window.__dbg = { src: src.toArray(), rotY, sunDir: sunDir.toArray(), dataType: hdr.image.data.constructor.name, w: hdr.image.width };
  // Le soleil est rendu par la lumière directionnelle : on l'écrête dans l'HDRI
  // (sinon valeurs hors plage en demi-flottant → NaN dans la carte d'environnement).
  const d = hdr.image.data;
  let maxV = 0;
  for (let i = 0; i < d.length; i++) {
    if (!(d[i] < 40)) d[i] = 40;
    if (d[i] > maxV) maxV = d[i];
  }
  hdr.needsUpdate = true;
  window.__dbg_max = maxV;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.75;
  const bg = new THREE.Texture(bgImg);
  bg.needsUpdate = true;
  bg.mapping = THREE.EquirectangularReflectionMapping;
  bg.colorSpace = THREE.SRGBColorSpace;
  scene.background = bg;
  scene.backgroundRotation.set(0, rotY, 0);
  scene.environmentRotation.set(0, rotY, 0);
  const horizon = horizonColor(bgImg);
  window.__dbg.horizon = horizon.toArray();
  scene.fog = new THREE.FogExp2(horizon, 0.0006);

  buildWorld(renderer, scene, { models, horizon, signalS: [story.SIG.avert, story.SIG.carre] });
  const avert = buildSignal(scene, { s: story.SIG.avert, lat: TRACK_LAT - 2.8, label: "A 600", lamps: {} });
  const carre = buildSignal(scene, { s: story.SIG.carre, lat: TRACK_LAT - 2.8, label: "C 830", lamps: {} });
  const train = buildTrain(scene);
  const other = buildTrain(scene);

  // Repère « point d'arrêt » (visible pendant le plan extérieur au carré)
  const stopLine = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.02, 0.35),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }),
  );
  P(story.SIG.carre - 1.5, TRACK_LAT, RAIL_TOP_Y + 0.02, stopLine.position);
  stopLine.rotation.y = -frame(story.SIG.carre).th;
  scene.add(stopLine);

  await texturesReady();
  renderer.compile(scene, camera);
  ctx = { avert, carre, train, other, stopLine };
  renderAt(pendingT);
}

// ------------------------------------------------------------------------------------
// Caméras
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function cameraAt(t) {
  const shot = story.shotAt(t);
  const sF = story.trainS(t);
  let fov = 55;
  if (shot === "aerial") {
    const u = t / story.CUTS[0];
    P(130 + 22 * t, lerp(26, 15, ease(u)), lerp(34, 11, ease(u)), camera.position);
    camera.lookAt(P(sF - 18, TRACK_LAT, 2, tmpA));
    fov = 50;
  } else if (shot === "cab") {
    const v = story.trainV(t);
    const amp = 0.01 * (v / 38) + 0.002;
    P(sF - 1.2, TRACK_LAT - 0.45 + amp * 0.6 * Math.sin(t * 17.3), 3.25 + amp * (Math.sin(t * 23.1) + 0.5 * Math.sin(t * 41.7)), camera.position);
    camera.lookAt(P(sF + 150, TRACK_LAT + 0.2, 1.6, tmpA));
    fov = 58;
  } else if (shot === "orbit") {
    const u = ease((t - story.CUTS[1]) / (story.CUTS[2] - story.CUTS[1]));
    const c = story.SIG.carre - 12;
    const a = lerp(0.18, 0.95, u);
    const R = lerp(24, 17, u);
    const f = frame(c);
    const center = P(c, TRACK_LAT - 1.2, 2.6, tmpA);
    camera.position.set(
      center.x - f.fx * Math.cos(a) * R - f.rx * Math.sin(a) * R,
      lerp(3.4, 6.2, u),
      center.z - f.fz * Math.cos(a) * R - f.rz * Math.sin(a) * R,
    );
    camera.lookAt(P(c + 6, TRACK_LAT - 1.6, 3.0, tmpB));
    fov = 48;
  } else {
    const u = ease((t - story.CUTS[3]) / (story.DURATION - story.CUTS[3]));
    P(sF - 34 + 6 * u, lerp(-12, -24, u), lerp(5, 34, u), camera.position);
    camera.lookAt(P(sF - 6, TRACK_LAT, 2, tmpA));
    fov = 52;
  }
  camera.fov = fov;
  camera.updateProjectionMatrix();
  return shot;
}

// ------------------------------------------------------------------------------------
// Interface pédagogique (DOM)
const $ = (id) => document.getElementById(id);
const hud = {
  title: $("title-card"),
  chip: $("chip"),
  chipText: $("chip-text"),
  caption: $("caption"),
  captionText: $("caption-text"),
  cab: $("cab-frame"),
  speed: $("speed-value"),
  arc: $("speed-arc"),
  brake: $("brake"),
  dmi: $("dmi"),
  map: $("map-train"),
  mapC: $("map-c-lamp"),
  next: $("next-signal"),
  calloutA: $("callout-a"),
  calloutC: $("callout-c"),
  calloutCSub: $("callout-c-sub"),
  calloutADist: $("callout-a-dist"),
  calloutCDist: $("callout-c-dist"),
  labels: [$("label-lamps"), $("label-plate"), $("label-stop")],
  recap: $("recap"),
  fade: $("fade"),
};

const win = (t, a, b, f = 0.4) => Math.min(ease((t - a) / f), ease((b - t) / f));
const ARC_LEN = 440;

function project(v) {
  const p = v.clone().project(camera);
  return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, visible: p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
}

function placeCallout(el, anchor, alpha, dx = 0, dy = -150) {
  const p = project(anchor);
  const a = p.visible ? alpha : 0;
  el.style.opacity = a.toFixed(3);
  el.style.transform = `translate(${(p.x + dx).toFixed(1)}px, ${(p.y + dy).toFixed(1)}px)`;
  el.style.setProperty("--lead", `${-dy}px`);
}

function updateHud(t, shot) {
  const sF = story.trainS(t);
  const v = story.trainV(t);
  const inCab = shot === "cab" ? 1 : 0;

  hud.title.style.opacity = win(t, 0.3, 6.2, 0.6).toFixed(3);
  hud.chip.style.opacity = win(t, 7.0, 43.2, 0.4).toFixed(3);
  hud.chipText.textContent = story.CHAPTERS.filter(([a]) => t >= a).pop()[1];

  const cap = story.CAPTIONS.find(([a, b]) => t >= a - 0.3 && t <= b + 0.3);
  hud.caption.style.opacity = cap ? win(t, cap[0], cap[1], 0.3).toFixed(3) : "0";
  if (cap) hud.captionText.innerHTML = cap[2];
  hud.caption.style.bottom = inCab ? "236px" : "86px";

  hud.cab.style.opacity = String(inCab);
  hud.dmi.style.opacity = String(inCab);
  const kmh = Math.round(v * 3.6);
  hud.speed.textContent = String(kmh);
  hud.arc.style.strokeDashoffset = (ARC_LEN * (1 - Math.min(kmh / 180, 1))).toFixed(1);
  hud.brake.style.opacity = story.braking(t) ? "1" : "0";

  // Schéma de ligne : s ∈ [150, 950] → x ∈ [30, 610]
  const mx = (s) => 30 + ((s - 150) / 800) * 580;
  hud.map.setAttribute("transform", `translate(${mx(Math.min(Math.max(sF, 150), 950)).toFixed(1)} 0)`);
  const open = t >= story.OPEN_T;
  hud.mapC.setAttribute("fill", open ? "#22c55e" : "#ef4444");
  const nextS = sF < story.SIG.avert ? story.SIG.avert : sF < story.SIG.carre ? story.SIG.carre : null;
  hud.next.textContent = nextS
    ? `${nextS === story.SIG.avert ? "Avertissement" : "Carré"} dans ${Math.max(0, Math.round(nextS - sF))} m`
    : "Aucun signal en vue";

  // Étiquettes accrochées aux signaux 3D
  const dA = story.SIG.avert - sF;
  const dC = story.SIG.carre - sF;
  const aAlpha = inCab * (dA > 25 && dA < 480 ? 1 : 0) * win(t, 10.8, 15.6, 0.4);
  placeCallout(hud.calloutA, ctx.avert.anchor("yellow"), aAlpha, 0, -170);
  hud.calloutADist.textContent = `${Math.round(Math.max(dA, 0))} m`;
  const cAlpha = inCab * (dC > 12 ? 1 : 0) * Math.max(win(t, 17.2, 25.2, 0.4), win(t, 33.2, 41.6, 0.4));
  placeCallout(hud.calloutC, ctx.carre.anchor("red"), cAlpha, 0, -170);
  hud.calloutCDist.textContent = `${Math.round(Math.max(dC, 0))} m`;
  hud.calloutCSub.textContent = open ? "Feu vert · voie libre" : "2 feux rouges · arrêt absolu";
  hud.calloutC.classList.toggle("open", open);

  const orbit = shot === "orbit" ? 1 : 0;
  const lab = [
    [ctx.carre.anchor("red2"), win(t, 26.4, 32.4), -330, -120],
    [ctx.carre.anchor("plate"), win(t, 27.6, 32.4), -330, 40],
    [P(story.SIG.carre - 1.5, TRACK_LAT, RAIL_TOP_Y, tmpB), win(t, 28.8, 32.4), 60, -150],
  ];
  lab.forEach(([anchor, a, dx, dy], i) => {
    const p = project(anchor);
    const el = hud.labels[i];
    el.style.opacity = (orbit * a * (p.visible ? 1 : 0)).toFixed(3);
    el.style.left = `${(p.x + dx).toFixed(1)}px`;
    el.style.top = `${(p.y + dy).toFixed(1)}px`;
    el.classList.toggle("left", dx < 0);
    const line = el.querySelector("i");
    line.style.width = `${Math.hypot(dx, dy).toFixed(1)}px`;
    line.style.transform = `rotate(${Math.atan2(-dy, -dx).toFixed(4)}rad)`;
  });
  ctx.stopLine.material.opacity = orbit * 0.85 * win(t, 28.6, 32.6);

  hud.recap.style.opacity = win(t, 43.4, 60, 0.6).toFixed(3);
  const fade = Math.max(...story.CUTS.map((c) => 1 - Math.min(Math.abs(t - c) / 0.32, 1)), 1 - Math.min(t / 0.4, 1));
  hud.fade.style.opacity = fade.toFixed(3);
}

// ------------------------------------------------------------------------------------
function renderAt(t) {
  pendingT = t;
  if (!ctx) return;
  const shot = cameraAt(t);
  const sF = story.trainS(t);
  ctx.train.update(sF, TRACK_LAT);
  ctx.train.visible = shot !== "cab";
  ctx.other.updateReverse(story.otherS(t), OTHER_LAT);
  const asp = story.aspects(t);
  ctx.avert.update(asp.avert, camera.position);
  ctx.carre.update(asp.carre, camera.position);

  // L'ombre suit la zone regardée
  const focus = camera.getWorldDirection(tmpA).multiplyScalar(35).add(camera.position);
  focus.y = 0;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 400);
  sun.target.updateMatrixWorld();

  updateHud(t, shot);
  composer.render();
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["rail-scene"] = build();
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
renderAt(window.__hfThreeTime || 0);
