// Simulateur de conduite ferroviaire 3D (three.js) : scène, physique, caméras, commandes, interface.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { P, frame } from "../engine/path.js";
import { buildWorld, texturesReady, TRACK_LAT, OTHER_LAT, STATION, LINE_END } from "../engine/world.js";
import { buildTrain, CAR } from "../engine/train.js";
import { buildSignal } from "../engine/signal.js";
import { createScenario, SIGNALS, TYPE_NAME } from "./scenario.js";
import { createAudio } from "./audio.js";

const $ = (id) => document.getElementById(id);
const HDRI = "kloofendal_48d_partly_cloudy_puresky";
const params = new URLSearchParams(location.search);
const coarse = matchMedia("(pointer: coarse)").matches;
let quality = params.get("q") || (coarse ? "low" : "high");

// ------------------------------------------------------------------------------------
// Rendu
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 8000);
const sun = new THREE.DirectionalLight(0xfff1e0, 3.0);
sun.castShadow = true;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3();

function applyQuality() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "low" ? 1 : 1.75));
  const size = quality === "low" ? 1024 : 4096;
  sun.shadow.mapSize.set(size, size);
  const ext = quality === "low" ? 50 : 90;
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 900 });
  sun.shadow.camera.updateProjectionMatrix();
  if (sun.shadow.map) {
    sun.shadow.map.dispose();
    sun.shadow.map = null;
  }
  resize();
}
function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);

// ------------------------------------------------------------------------------------
// Chargement
const loadBar = $("load-bar");
const loadText = $("load-text");
THREE.DefaultLoadingManager.onProgress = (_url, done, total) => {
  loadBar.style.width = `${Math.round((done / total) * 100)}%`;
  loadText.textContent = `Chargement des ressources… ${done}/${total}`;
};

function loadImage(url) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = url;
  });
}

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
  const phi = ((bi + 0.5) / width - 0.5) * 2 * Math.PI;
  const el = (1 - (bj + 0.5) / height - 0.5) * Math.PI;
  return new THREE.Vector3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
}

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

let world = null;

/** HDR : fichier .hdr, ou .hdr.b64.txt (base64) quand l'hébergeur ne sert pas les binaires. */
const fetchB64 = async (url) => Uint8Array.from(atob((await (await fetch(url)).text()).trim()), (c) => c.charCodeAt(0)).buffer;

async function loadHDR(url) {
  const loader = new HDRLoader().setDataType(THREE.FloatType);
  if (!url.endsWith(".b64.txt")) return loader.loadAsync(url);
  const d = loader.parse(await fetchB64(url)); // décodé en mémoire : aucune requête data:/blob:
  const t = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
  Object.assign(t, { flipY: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, colorSpace: THREE.LinearSRGBColorSpace });
  t.needsUpdate = true;
  return t;
}

/** glTF : fichier .gltf classique, ou { json, bin } avec le tampon en base64 fourni au chargeur. */
async function loadModel(src) {
  const loader = new GLTFLoader();
  if (typeof src === "string") return loader.loadAsync(src);
  const [json, bin] = await Promise.all([fetch(src.json).then((r) => r.json()), fetchB64(src.bin)]);
  // Conteneur GLB assemblé en mémoire : le chargeur ne consulte pas les plugins pour les tampons
  const j = { ...json, buffers: [{ byteLength: bin.byteLength }] };
  const enc = new TextEncoder().encode(JSON.stringify(j));
  const jl = Math.ceil(enc.length / 4) * 4;
  const bl = Math.ceil(bin.byteLength / 4) * 4;
  const glb = new ArrayBuffer(28 + jl + bl);
  const v = new DataView(glb);
  const u8 = new Uint8Array(glb);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, glb.byteLength, true);
  v.setUint32(12, jl, true);
  v.setUint32(16, 0x4e4f534a, true);
  u8.fill(0x20, 20, 20 + jl);
  u8.set(enc, 20);
  v.setUint32(20 + jl, bl, true);
  v.setUint32(24 + jl, 0x004e4942, true);
  u8.set(new Uint8Array(bin), 28 + jl);
  return new Promise((ok, ko) => loader.parse(glb, src.json.slice(0, src.json.lastIndexOf("/") + 1), ok, ko));
}
const ASSET = window.SIM_ASSETS || { hdr: `assets/hdri/${HDRI}_2k.hdr`, model: (n) => `assets/models/${n}/${n}.gltf` };

async function build() {
  applyQuality();
  const gltf = new GLTFLoader();
  const names = ["shrub_02", "wild_rooibos_bush", "grass_medium_02"];
  const [hdr, bgImg, ...gl] = await Promise.all([
    loadHDR(ASSET.hdr),
    loadImage(`assets/hdri/${HDRI}_bg.jpg`),
    ...names.map((n) => loadModel(ASSET.model(n))),
    document.fonts.load("800 120px Inter"),
  ]);
  const models = Object.fromEntries(names.map((n, i) => [n, gl[i]]));

  const src = findSun(hdr);
  const f = frame(1900);
  const want = new THREE.Vector2(0.8 * f.rx - 0.6 * f.fx, 0.8 * f.rz - 0.6 * f.fz);
  const rotY = Math.atan2(want.x, want.y) - Math.atan2(src.x, src.z);
  sunDir.copy(src).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const d = hdr.image.data;
  for (let i = 0; i < d.length; i++) if (!(d[i] < 40)) d[i] = 40; // soleil = lumière directionnelle
  hdr.needsUpdate = true;
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
  scene.fog = new THREE.FogExp2(horizon, 0.0006);

  buildWorld(renderer, scene, { models, horizon, signalS: SIGNALS.map((s) => s.s), quality });
  const signals = Object.fromEntries(
    SIGNALS.map((s) => [s.id, { api: buildSignal(scene, { s: s.s, lat: TRACK_LAT - 2.8, label: s.label, lamps: {} }), lit: {} }]),
  );
  const train = buildTrain(scene);
  const other = buildTrain(scene);
  await texturesReady();
  loadText.textContent = "Préparation de la scène…";
  renderer.compile(scene, camera);
  world = { signals, train, other };
}

// ------------------------------------------------------------------------------------
// Simulation
const audio = createAudio();
let sc = null;
const sim = { s: 0, v: 0, lever: 0, t: 0, paused: true, started: false, otherS: null, userEmergency: false };
const keys = new Set();

function reset(guided) {
  sc = createScenario({ guided });
  Object.assign(sim, { s: 0, v: 0, lever: 0, t: 0, paused: false, started: true, otherS: null, userEmergency: false });
  $("end").hidden = true;
  $("hud").hidden = false;
  toasts.innerHTML = "";
  lastEvents = 0;
}

function physics(dt) {
  const up = keys.has("ArrowUp") || keys.has("z") || keys.has("w") || touch.up;
  const down = keys.has("ArrowDown") || keys.has("s") || touch.down;
  if (up) sim.lever = Math.min(1, sim.lever + dt * 0.9);
  if (down) sim.lever = Math.max(-1, sim.lever - dt * 0.9);

  const emergency = sc.st.emergency || sim.userEmergency;
  let a;
  if (emergency) a = -1.5;
  else if (sim.lever > 0) a = sim.lever * 0.85 * Math.max(0, 1 - sim.v / 46);
  else a = sim.lever * 1.05;
  if (sim.v > 0) a -= 0.004 + 0.00004 * sim.v * sim.v;
  const sPrev = sim.s;
  sim.v = Math.max(0, sim.v + a * dt);
  sim.s = Math.min(sim.s + sim.v * dt, LINE_END + 15);
  if (sim.s >= LINE_END + 15) sim.v = 0;
  if (sim.userEmergency && sim.v < 0.05 && sim.lever <= -0.99) sim.userEmergency = false;
  sc.update(dt, sPrev, sim.s, sim.v);
  if (sc.st.emergency) sim.lever = Math.min(sim.lever, 0);

  // Train croiseur sur l'autre voie, lancé au passage du point 250
  if (sim.otherS === null && sim.s > 250) sim.otherS = sim.s + 1500;
  if (sim.otherS !== null) sim.otherS -= 40 * dt;
  sim.t += dt;
}

// ------------------------------------------------------------------------------------
// Caméras
let camMode = "cab";
const CAM_LABEL = { cab: "Cabine", chase: "Extérieur", orbit: "Libre" };
const orbit = new OrbitControls(camera, canvas);
orbit.enabled = false;
orbit.enableDamping = true;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.minDistance = 6;
orbit.maxDistance = 250;
const look = { yaw: 0, pitch: 0, drag: null };
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const lastTarget = new THREE.Vector3();

function setCam(mode) {
  camMode = mode;
  $("cam-btn").textContent = `Caméra : ${CAM_LABEL[mode]}`;
  $("cab-frame").hidden = mode !== "cab";
  orbit.enabled = mode === "orbit";
  if (mode === "chase") camera.position.copy(P(sim.s - 42, TRACK_LAT - 10, 9));
  if (mode === "orbit") {
    const target = P(sim.s - 12, TRACK_LAT, 2);
    camera.position.copy(P(sim.s + 8, TRACK_LAT - 22, 9));
    orbit.target.copy(target);
    lastTarget.copy(target);
  }
}

function updateCamera(dt) {
  if (camMode === "cab") {
    const k = Math.min(sim.v / 38, 1);
    const amp = 0.008 * k + 0.0015;
    const t = sim.t;
    P(sim.s - 1.2, TRACK_LAT - 0.45 + amp * 0.6 * Math.sin(t * 17.3), 3.25 + amp * (Math.sin(t * 23.1) + 0.5 * Math.sin(t * 41.7)), camera.position);
    const f = frame(sim.s + 60);
    const ahead = P(sim.s + 150, TRACK_LAT + 0.2, 1.6, tmp);
    const dir = ahead.sub(camera.position).normalize();
    if (!look.drag) {
      look.yaw *= Math.exp(-dt * 1.2);
      look.pitch *= Math.exp(-dt * 1.2);
    }
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), look.yaw);
    dir.y += look.pitch;
    camera.lookAt(tmp2.copy(camera.position).add(dir));
    camera.fov = 60;
    void f;
  } else if (camMode === "chase") {
    camera.position.lerp(P(sim.s - 42, TRACK_LAT - 10, 9), 1 - Math.exp(-dt * 3));
    camera.lookAt(P(sim.s + 10, TRACK_LAT, 2, tmp));
    camera.fov = 55;
  } else {
    const target = P(sim.s - 12, TRACK_LAT, 2, tmp);
    camera.position.add(tmp2.copy(target).sub(lastTarget));
    orbit.target.copy(target);
    lastTarget.copy(target);
    orbit.update();
    camera.fov = 55;
  }
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------------------------
// Interface
const toasts = $("toasts");
let lastEvents = 0;
const DIAL = { cx: 110, cy: 110, r: 88, a0: (225 * Math.PI) / 180, span: (270 * Math.PI) / 180, max: 180 };
const dialPt = (kmh, r = DIAL.r) => {
  const a = DIAL.a0 - (Math.min(kmh, DIAL.max) / DIAL.max) * DIAL.span;
  return [DIAL.cx + Math.cos(a) * r, DIAL.cy - Math.sin(a) * r];
};
function arcPath(k0, k1, r = DIAL.r) {
  const [x0, y0] = dialPt(k0, r);
  const [x1, y1] = dialPt(k1, r);
  const large = ((k1 - k0) / DIAL.max) * 270 > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
{
  // Graduations du cadran
  const g = $("dial-ticks");
  let html = "";
  for (let k = 0; k <= 180; k += 10) {
    const [x0, y0] = dialPt(k, k % 20 === 0 ? 74 : 79);
    const [x1, y1] = dialPt(k, 86);
    html += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" />`;
    if (k % 40 === 0) {
      const [tx, ty] = dialPt(k, 60);
      html += `<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}">${k}</text>`;
    }
  }
  g.innerHTML = html;
  $("dial-bg").setAttribute("d", arcPath(0, 180));
}
const mapX = (s) => 16 + (Math.min(Math.max(s, 0), LINE_END) / LINE_END) * 568;
{
  const g = $("map-signals");
  g.innerHTML = SIGNALS.map((d) => `<g transform="translate(${mapX(d.s).toFixed(1)} 0)"><line y1="30" y2="12" /><circle id="map-${d.id}" cy="10" r="7" /></g>`).join("") +
    `<rect x="${mapX(STATION.from).toFixed(1)}" y="34" width="${(mapX(STATION.to) - mapX(STATION.from)).toFixed(1)}" height="8" rx="2" fill="#8aa0b8" />`;
}
const COLOR = { red: "#ff4d3d", yellow: "#ffc21a", green: "#2ee57a" };
const aspectColor = (lit) => (lit.red ? COLOR.red : lit.yellow ? COLOR.yellow : COLOR.green);

function updateHud() {
  const kmh = sim.v * 3.6;
  $("speed").textContent = Math.round(kmh);
  $("dial-v").setAttribute("d", kmh > 0.5 ? arcPath(0, kmh) : "M 0 0");
  const lim = sc.speedLimit(sim.s);
  const [lx0, ly0] = dialPt(lim, 70);
  const [lx1, ly1] = dialPt(lim, 98);
  $("dial-lim").setAttribute("d", `M ${lx0} ${ly0} L ${lx1} ${ly1}`);
  const curve = sc.curveLimit(sim.s);
  const tgt = $("dial-curve");
  if (curve !== null && curve * 3.6 < lim) {
    tgt.setAttribute("d", arcPath(Math.max(curve * 3.6, 0), lim, 97));
    tgt.style.opacity = "1";
  } else tgt.style.opacity = "0";
  $("limit").textContent = `${lim}`;
  const over = curve !== null && sim.v > curve;
  $("speed").classList.toggle("warn", over || kmh > lim + 3);

  // Manipulateur
  const lv = sim.lever;
  $("lever-thumb").style.top = `${(50 - lv * 44).toFixed(1)}%`;
  const emergency = sc.st.emergency || sim.userEmergency;
  $("lever-label").textContent = emergency ? "URGENCE" : lv > 0.02 ? `Traction ${Math.round(lv * 100)} %` : lv < -0.02 ? `Freinage ${Math.round(-lv * 100)} %` : "Neutre";
  $("lever-label").className = emergency ? "red" : lv > 0.02 ? "blue" : lv < -0.02 ? "yellow" : "";

  // Prochain signal
  const n = sc.nextSignal(sim.s);
  if (n) {
    const lit = sc.lamps(n.id);
    $("next-name").textContent = `${TYPE_NAME[n.type]} ${n.label}`;
    $("next-dist").textContent = `${Math.max(0, Math.round(n.s - sim.s))} m`;
    $("next-aspect").textContent = sc.aspectText(n.id);
    $("next-dot").style.background = aspectColor(lit);
    $("next-dot").classList.toggle("double", !!lit.red2);
  }
  for (const d of SIGNALS) $(`map-${d.id}`).setAttribute("fill", aspectColor(sc.lamps(d.id)));
  $("map-train").setAttribute("transform", `translate(${mapX(sim.s).toFixed(1)} 0)`);

  // Score, chrono, conseil
  $("score").textContent = sc.st.score;
  const t = Math.floor(sim.t);
  $("time").textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  const tip = sc.tip(sim.s, sim.v, sim.lever);
  const tipEl = $("tip");
  tipEl.hidden = !tip;
  if (tip) {
    tipEl.textContent = tip.text;
    tipEl.dataset.tone = tip.tone;
  }
  // Évènements → notifications
  while (lastEvents < sc.st.events.length) {
    const e = sc.st.events[lastEvents++];
    const el = document.createElement("div");
    el.className = `toast ${e.kind}`;
    el.textContent = e.text;
    toasts.prepend(el);
    setTimeout(() => el.remove(), 5000);
    audio.beep(e.kind === "penalty" ? 440 : 1046, e.kind === "penalty" ? 0.35 : 0.12);
  }
}

let beepT = 0;
function alarms(dt) {
  const curve = sc.curveLimit(sim.s);
  beepT -= dt;
  if (curve !== null && sim.v > curve && beepT <= 0 && sc.st.status === "running") {
    audio.beep(1400, 0.08, 0.08);
    beepT = 0.5;
  }
}

function showEnd() {
  const st = sc.st;
  const ok = st.status === "success";
  $("hud").hidden = true;
  $("end").hidden = false;
  $("end-title").textContent = ok ? "Mission réussie" : "Mission échouée";
  $("end-title").className = ok ? "green" : "red";
  const stars = ok ? (st.score >= 90 ? 3 : st.score >= 70 ? 2 : 1) : 0;
  $("end-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("end-score").textContent = `${st.score} / 100`;
  $("end-reason").textContent = ok
    ? `Arrêt au repère de la gare de Valmont en ${$("time").textContent}. Vitesse maximale : ${Math.round(st.maxKmh)} km/h.`
    : st.failReason;
  const list = $("end-list");
  list.innerHTML = st.penalties.length
    ? st.penalties.map((p) => `<li><b>−${p.pts}</b> ${p.text}</li>`).join("")
    : "<li class=ok>Aucune faute : signaux respectés, vitesses maîtrisées.</li>";
  const lessons = [
    ["Avertissement", "Feu jaune : un signal d'arrêt suit, je freine pour pouvoir m'arrêter."],
    ["Carré", "2 feux rouges : arrêt absolu avant le signal, jamais franchi sans autorisation."],
    ["Sémaphore", "1 feu rouge : arrêt avant le signal, le canton suivant est occupé."],
    ["Contrôle de vitesse", "Après un avertissement, la vitesse est surveillée jusqu'au signal d'arrêt."],
  ];
  $("end-lessons").innerHTML = lessons.map(([a, b]) => `<li><b>${a}</b> — ${b}</li>`).join("");
  try {
    const best = JSON.parse(localStorage.getItem("rail-sim-best") || "null");
    if (ok && (!best || st.score > best.score)) localStorage.setItem("rail-sim-best", JSON.stringify({ score: st.score, time: sim.t }));
  } catch {}
  window.parent?.postMessage({ type: "rail-sim-result", status: st.status, score: st.score, penalties: st.penalties, time: sim.t }, "*");
}

// ------------------------------------------------------------------------------------
// Boucle
let last = performance.now();
let ended = false;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!world) return;
  if (sim.started && !sim.paused && sc.st.status === "running") {
    // Sous-pas pour une logique stable
    const n = Math.ceil(dt / 0.02);
    for (let i = 0; i < n; i++) physics(dt / n);
    alarms(dt);
  }
  if (sim.started && sc.st.status !== "running" && !ended) {
    ended = true;
    setTimeout(showEnd, 1600);
  }
  const running = sim.started && !sim.paused;
  audio.update(running ? sim.v : 0, running ? sim.lever : 0, running && (sc?.st.emergency || sim.userEmergency));

  // Train, signaux
  world.train.update(sim.s, TRACK_LAT);
  world.train.visible = camMode !== "cab";
  if (sim.otherS !== null && sim.otherS > -500) world.other.updateReverse(sim.otherS, OTHER_LAT);
  world.other.visible = sim.otherS !== null && sim.otherS > -500;
  for (const d of SIGNALS) {
    const target = sc ? sc.lamps(d.id) : d.type === "avert" ? { yellow: 1 } : d.type === "carre" ? { red: 1, red2: 1 } : { red: 1 };
    const w = world.signals[d.id];
    for (const k of ["yellow", "red", "red2", "green"]) {
      const cur = w.lit[k] || 0;
      w.lit[k] = cur + ((target[k] || 0) - cur) * Math.min(1, dt * 8);
    }
    w.api.update(w.lit, camera.position);
  }
  updateCamera(dt);
  const focus = camera.getWorldDirection(tmp).multiplyScalar(camMode === "cab" ? 45 : 20).add(camera.position);
  focus.y = 0;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(sunDir, 400);
  if (sc) updateHud();
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------------------------
// Commandes
const touch = { up: false, down: false };
addEventListener("keydown", (e) => {
  if (e.repeat && !["ArrowUp", "ArrowDown"].includes(e.key)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys.add(k);
  if (!sim.started) return;
  if (k === " ") {
    sim.userEmergency = true;
    sim.lever = -1;
    e.preventDefault();
  }
  if (k === "n") sim.lever = 0;
  if (k === "c") cycleCam();
  if (k === "p" || k === "Escape") togglePause();
  if (["ArrowUp", "ArrowDown"].includes(k)) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener("blur", () => keys.clear());

const hold = (id, key) => {
  const el = $(id);
  const on = (v) => (e) => {
    e.preventDefault();
    touch[key] = v;
    el.classList.toggle("active", v);
  };
  el.addEventListener("pointerdown", on(true));
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(ev, on(false));
};
hold("btn-up", "up");
hold("btn-down", "down");
$("btn-neutral").addEventListener("click", () => (sim.lever = 0));
$("btn-emergency").addEventListener("click", () => {
  sim.userEmergency = true;
  sim.lever = -1;
});

// Manipulateur tactile : glisser le curseur
{
  const track = $("lever-track");
  let dragging = false;
  const set = (e) => {
    const r = track.getBoundingClientRect();
    const u = (e.clientY - r.top) / r.height;
    let v = Math.max(-1, Math.min(1, (0.5 - u) / 0.44));
    if (Math.abs(v) < 0.06) v = 0;
    sim.lever = v;
  };
  track.addEventListener("pointerdown", (e) => {
    dragging = true;
    track.setPointerCapture(e.pointerId);
    set(e);
  });
  track.addEventListener("pointermove", (e) => dragging && set(e));
  track.addEventListener("pointerup", () => (dragging = false));
}

// Regard libre en cabine
canvas.addEventListener("pointerdown", (e) => {
  if (camMode === "cab") look.drag = { x: e.clientX, y: e.clientY, yaw: look.yaw, pitch: look.pitch };
});
addEventListener("pointermove", (e) => {
  if (!look.drag) return;
  look.yaw = Math.max(-1.1, Math.min(1.1, look.drag.yaw - (e.clientX - look.drag.x) * 0.004));
  look.pitch = Math.max(-0.4, Math.min(0.3, look.drag.pitch - (e.clientY - look.drag.y) * 0.003));
});
addEventListener("pointerup", () => (look.drag = null));

const cams = ["cab", "chase", "orbit"];
function cycleCam() {
  setCam(cams[(cams.indexOf(camMode) + 1) % cams.length]);
}
$("cam-btn").addEventListener("click", cycleCam);
function togglePause() {
  if (!sim.started || sc.st.status !== "running") return;
  sim.paused = !sim.paused;
  $("pause").hidden = !sim.paused;
}
$("pause-btn").addEventListener("click", togglePause);
$("resume").addEventListener("click", togglePause);
$("sound-btn").addEventListener("click", () => {
  audio.setMuted(!audio.muted);
  $("sound-btn").textContent = audio.muted ? "Son : coupé" : "Son : activé";
});

function begin(guided) {
  audio.start();
  $("start").hidden = true;
  $("pause").hidden = true;
  ended = false;
  reset(guided);
  $("mode-name").textContent = guided ? "Mode guidé" : "Mode examen";
  setCam("cab");
}
$("go-guided").addEventListener("click", () => begin(true));
$("go-exam").addEventListener("click", () => begin(false));
$("retry").addEventListener("click", () => begin(sc.st.guided));
$("restart").addEventListener("click", () => begin(sc.st.guided));
$("menu").addEventListener("click", () => {
  $("end").hidden = true;
  $("hud").hidden = true;
  $("start").hidden = false;
  sim.started = false;
});
for (const b of document.querySelectorAll("[data-q]")) {
  b.classList.toggle("on", b.dataset.q === quality);
  b.addEventListener("click", () => {
    quality = b.dataset.q;
    for (const o of document.querySelectorAll("[data-q]")) o.classList.toggle("on", o === b);
    applyQuality();
  });
}

// Démarrage : scène de présentation (vue extérieure) derrière le menu
build()
  .then(() => {
    $("loading").hidden = true;
    $("start").hidden = false;
    camMode = "chase";
    camera.position.copy(P(-40, TRACK_LAT - 10, 9));
  })
  .catch((err) => {
    loadText.textContent = `Erreur de chargement : ${err.message}`;
    console.error(err);
  });
requestAnimationFrame(loop);
// Points d'entrée pour les tests automatisés (tools/test.mjs)
window.__sim = {
  sim,
  get sc() {
    return sc;
  },
  get ready() {
    return !!world;
  },
  setCam,
  begin,
  step(dt, lever) {
    sim.lever = lever;
    physics(dt);
  },
  pause(p) {
    sim.paused = p;
  },
};
