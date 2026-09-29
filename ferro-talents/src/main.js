// Ferro Talents : orchestration (chargement, hub des métiers, monde ouvert à pied, missions, bilan).
import * as THREE from "three";
import { createRenderer } from "./core/renderer.js";
import { input, joystick } from "./core/input.js";
import { createAudio } from "./core/audio.js";
import { buildWorld } from "./world/world.js";
import { P, frame, project, trackY } from "./world/line.js";
import { groundHeight } from "./world/terrain.js";
import { TRACK_LAT, RAIL_TOP_Y } from "./world/track.js";
import { STATION } from "./world/depot.js";
import { wind } from "./world/vegetation.js";
import { TRAIN_START } from "./jobs/train-rules.js";
import { createTrainJob, TRAIN_JOB } from "./jobs/train.js";
import { createExcavatorJob, EXC_JOB } from "./jobs/excavator.js";
import { createNacelleJob, NAC_JOB } from "./jobs/nacelle.js";
import { stars } from "./jobs/common.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(`ft-${k}`)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`ft-${k}`, JSON.stringify(v));
    } catch {}
  },
};
const coarse = matchMedia("(pointer: coarse)").matches;
const quality = params.get("q") || store.get("quality", coarse ? "low" : "high");
let guided = store.get("guided", true);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 12000);
const core = createRenderer($("gl"), scene, camera);
core.setQuality(quality);
const audio = createAudio();
const JOBS = [
  { def: TRAIN_JOB, make: createTrainJob },
  { def: EXC_JOB, make: createExcavatorJob },
  { def: NAC_JOB, make: createNacelleJob },
];

// ------------------------------------------------------------------------------------
// Interface commune fournie aux métiers
const toasts = $("toasts");
let radioTimer = 0;
const ui = {
  toast(text, kind = "info") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = text;
    toasts.prepend(el);
    while (toasts.children.length > 5) toasts.lastChild.remove();
    setTimeout(() => el.remove(), 5000);
    if (kind === "penalty") audio.beep(440, 0.3);
  },
  tip(t) {
    $("tip").hidden = !t;
    if (t) {
      if ($("tip").textContent !== t.text) $("tip").textContent = t.text;
      $("tip").dataset.tone = t.tone;
    }
  },
  hud(html) {
    $("job-hud").innerHTML = html;
  },
  checklist(steps, idx) {
    $("checklist").hidden = false;
    $("steps").innerHTML = steps.map((s, i) => `<li class="${i < idx ? "ok" : i === idx ? "now" : ""}">${s.label}</li>`).join("");
  },
  radio(from, text) {
    $("radio").hidden = false;
    $("radio").innerHTML = `<b>📻 ${from} :</b> ${text}`;
    radioTimer = 8;
    audio.beep(1800, 0.05, 0.05, "sine");
  },
  actions(list) {
    $("actions").innerHTML = list.map(([k, label, cls]) => `<button class="glass ${cls || ""}" data-key="${k}">${label}</button>`).join("");
    for (const b of $("actions").querySelectorAll("button")) {
      if (b.dataset.key === "e") {
        // Action maintenue (intervention)
        b.addEventListener("pointerdown", () => dispatchEvent(new KeyboardEvent("keydown", { key: "e" })));
        for (const ev of ["pointerup", "pointerleave"]) b.addEventListener(ev, () => dispatchEvent(new KeyboardEvent("keyup", { key: "e" })));
      } else b.addEventListener("click", () => input.press(b.dataset.key));
    }
  },
  joysticks(show) {
    $("joyL").hidden = $("joyR").hidden = !show;
  },
  lever(show, value = 0, label = "") {
    $("lever").hidden = !show;
    if (show) {
      $("lever-thumb").style.top = `${(50 - value * 44).toFixed(1)}%`;
      $("lever-label").textContent = label;
    }
  },
};
joystick($("joyL"), "L");
joystick($("joyR"), "R");
const lever = { set: null, up: false, down: false };
{
  const track = $("lever-track");
  let drag = false;
  const set = (e) => {
    const r = track.getBoundingClientRect();
    let v = Math.max(-1, Math.min(1, (0.5 - (e.clientY - r.top) / r.height) / 0.44));
    if (Math.abs(v) < 0.06) v = 0;
    lever.set = v;
  };
  track.addEventListener("pointerdown", (e) => {
    drag = true;
    track.setPointerCapture(e.pointerId);
    set(e);
  });
  track.addEventListener("pointermove", (e) => drag && set(e));
  track.addEventListener("pointerup", () => (drag = false));
}

// ------------------------------------------------------------------------------------
// Caméra : regard libre (cabine) ou orbite (extérieur), glisser pour tourner, molette pour zoomer
const rig = {
  look: { yaw: 0, pitch: 0 },
  o: { yaw: 0.6, pitch: 0.35, dist: 14 },
  drag: null,
  orbit(target) {
    const o = this.o;
    camera.position.set(
      target.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist,
      target.y + Math.sin(o.pitch) * o.dist,
      target.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist,
    );
    const gy = groundHeight(camera.position.x, camera.position.z) + 1;
    if (camera.position.y < gy) camera.position.y = gy;
    camera.lookAt(target);
  },
};
$("gl").addEventListener("pointerdown", (e) => {
  rig.drag = { x: e.clientX, y: e.clientY, look: { ...rig.look }, o: { ...rig.o } };
});
addEventListener("pointermove", (e) => {
  if (!rig.drag) return;
  const dx = e.clientX - rig.drag.x;
  const dy = e.clientY - rig.drag.y;
  rig.look.yaw = Math.max(-1.3, Math.min(1.3, rig.drag.look.yaw - dx * 0.004));
  rig.look.pitch = Math.max(-0.6, Math.min(0.5, rig.drag.look.pitch - dy * 0.003));
  rig.o.yaw = rig.drag.o.yaw - dx * 0.005;
  rig.o.pitch = Math.max(0.05, Math.min(1.35, rig.drag.o.pitch + dy * 0.004));
});
addEventListener("pointerup", () => (rig.drag = null));
$("gl").addEventListener("wheel", (e) => (rig.o.dist = Math.max(3, Math.min(120, rig.o.dist * (1 + Math.sign(e.deltaY) * 0.1)))), { passive: true });

// ------------------------------------------------------------------------------------
let world = null;
let state = "loading"; // loading | hub | brief | world | job | debrief
let job = null;
let jobEntry = null;
let endTimer = 0;

/** Hauteur de marche : ballast, quai, sinon terrain. */
function walkHeight(x, z) {
  const p = project(x, z, 30);
  const a = Math.abs(p.lat);
  const ty = trackY(Math.min(Math.max(p.s, 0), 99999));
  const edge = TRACK_LAT - 1.65;
  if (p.d < 30 && p.s > STATION.from && p.s < STATION.to && p.lat < edge && p.lat > edge - 5.5) return ty + RAIL_TOP_Y + 0.55;
  if (p.d < 30 && a < 4.05) return ty + 0.15;
  if (p.d < 30 && a < 5.4) return ty + 0.15 - ((a - 4.05) / 1.35) * 0.77;
  return groundHeight(x, z);
}

function vehicleSpots() {
  return [
    { job: JOBS[0], pos: P(TRAIN_START - 2, TRACK_LAT - 1.9, 0) },
    { job: JOBS[1], pos: world.exc.root.position.clone() },
    { job: JOBS[2], pos: world.nac.root.position.clone() },
  ];
}

function resetVehicles() {
  const park = (rr, s, lat) => {
    const p = P(s, lat);
    rr.setRoad(p.x, p.z, -frame(s).th);
    rr.brake = false;
    rr.update(0, { throttle: 0, steer: 0 });
  };
  park(world.exc.rr, 322, -30);
  Object.assign(world.exc.joints, { swing: 0, boom: 0.35, stick: -2.1, bucket: 0.9 });
  world.exc.pose(world.exc.joints);
  world.exc.load.visible = false;
  world.exc.update();
  park(world.nac.rr, 348, -30);
  Object.assign(world.nac.joints, { slew: 0, lower: 0.02, upper: -3.05 });
  world.nac.setStab(0);
  world.nac.move(0, {});
  world.nac.update();
  world.train.update(TRAIN_START, TRACK_LAT);
  world.train.visible = true;
}

function showHub() {
  state = "hub";
  for (const id of ["brief", "debrief", "loading"]) $(id).hidden = true;
  $("hub").hidden = false;
  $("hud").hidden = true;
  const best = store.get("best", {});
  $("cards").innerHTML =
    `<div class="card explore"><div class="tag">Monde ouvert</div><h2>Explorer la base travaux</h2><p class="grow">Promène-toi dans la vallée, rencontre les engins et choisis ton métier en montant à bord.</p><button class="primary" data-explore>Explorer à pied</button></div>` +
    JOBS.map(
      ({ def }) => `<div class="card"><div class="tag">${def.vehicle}</div><h2>${def.title}</h2><p class="grow">${def.pitch}</p><div class="stars">${"★".repeat(best[def.id] || 0)}${"☆".repeat(3 - (best[def.id] || 0))}</div><button class="primary" data-job="${def.id}">Essayer ce métier</button></div>`,
    ).join("");
  for (const b of $("cards").querySelectorAll("[data-job]")) b.addEventListener("click", () => showBrief(JOBS.find((j) => j.def.id === b.dataset.job)));
  $("cards").querySelector("[data-explore]").addEventListener("click", () => enterWorld());
}

function showBrief(entry) {
  state = "brief";
  jobEntry = entry;
  $("hub").hidden = true;
  $("brief").hidden = false;
  $("brief-kicker").textContent = `Mission · ${entry.def.vehicle}`;
  $("brief-title").textContent = entry.def.title;
  $("brief-pitch").textContent = entry.def.pitch;
  $("brief-steps").innerHTML = entry.def.brief.map((b) => `<li>${b}</li>`).join("");
  $("brief-keys").textContent = entry.def.keys;
}

function enterWorld(near) {
  audio.start();
  state = "world";
  for (const id of ["hub", "brief", "debrief"]) $(id).hidden = true;
  $("hud").hidden = false;
  $("score-chip").hidden = true;
  $("checklist").hidden = true;
  ui.hud("");
  ui.actions([["e", "Interagir"]]);
  ui.joysticks(coarse);
  ui.lever(false);
  ui.tip({ tone: "blue", text: "Déplace-toi (ZQSD / flèches, Maj pour courir), fais glisser pour tourner la vue. Approche-toi d'un engin et appuie sur E." });
  setTimeout(() => state === "world" && ui.tip(null), 9000);
  world.avatar.visible = true;
  if (near) {
    const st = world.avatar.st;
    st.x = near.x + 4;
    st.z = near.z + 4;
  }
  rig.o = { yaw: world.avatar.st.yaw + Math.PI, pitch: 0.3, dist: 6 };
  $("cam-btn").textContent = "Caméra : 3e personne";
}

function startJob(entry) {
  audio.start();
  resetVehicles();
  $("brief").hidden = true;
  $("hud").hidden = false;
  $("score-chip").hidden = false;
  $("prompt").hidden = true;
  world.avatar.visible = false;
  ui.lever(false);
  ui.joysticks(false);
  job = entry.make({ world, ui, input, audio, camera, guided, lever });
  job.camMode = job.cams[0];
  rig.look = { yaw: 0, pitch: 0 };
  rig.o = { yaw: 0.8, pitch: 0.35, dist: 16 };
  $("cam-btn").textContent = `Caméra : ${camName(job.camMode)}`;
  jobEntry = entry;
  state = "job";
  endTimer = 0;
}

const camName = (c) => ({ cab: "Cabine", follow: "Poursuite", orbit: "Libre", basket: "Panier" })[c] || c;

function endJob() {
  const m = job.mission.st;
  const res = job.result();
  const ok = m.status === "success";
  const n = stars(m);
  const best = store.get("best", {});
  if (n > (best[jobEntry.def.id] || 0)) store.set("best", { ...best, [jobEntry.def.id]: n });
  window.parent?.postMessage({ type: "ferro-talents-result", job: jobEntry.def.id, status: m.status, score: m.score, penalties: m.penalties, time: m.t }, "*");
  state = "debrief";
  $("hud").hidden = true;
  $("debrief").hidden = false;
  $("debrief-title").textContent = ok ? "Mission réussie" : "Mission échouée";
  $("debrief-title").className = ok ? "green" : "red";
  $("debrief-stars").textContent = "★".repeat(n) + "☆".repeat(3 - n);
  $("debrief-score").textContent = `${m.score} / 100 · ${Math.floor(m.t / 60)} min ${String(Math.floor(m.t % 60)).padStart(2, "0")} s`;
  $("debrief-reason").textContent = ok ? res.extra || "" : m.failReason;
  $("debrief-faults").innerHTML = m.penalties.length ? m.penalties.map((p) => `<li><b>−${p.pts}</b> ${p.text}</li>`).join("") : `<li class="green">Aucune faute : procédure respectée.</li>`;
  $("debrief-lessons").innerHTML = res.lessons.map(([a, b]) => `<li><b>${a}</b> — ${b}</li>`).join("");
  $("debrief-job").innerHTML = `<b>Compétences :</b> ${jobEntry.def.skills.join(" · ")}<br><b>Accès au métier :</b> ${jobEntry.def.access}`;
  job.exit();
  job = null;
  resetVehicles();
}

$("brief-go").addEventListener("click", () => startJob(jobEntry));
$("brief-back").addEventListener("click", () => (world.avatar.root.visible ? enterWorld() : showHub()));
$("debrief-retry").addEventListener("click", () => showBrief(jobEntry));
$("debrief-world").addEventListener("click", () => enterWorld(vehicleSpots().find((v) => v.job === jobEntry).pos));
$("debrief-hub").addEventListener("click", showHub);
$("menu-btn").addEventListener("click", () => {
  if (job) {
    job.exit();
    job = null;
    resetVehicles();
  }
  audio.silence();
  showHub();
});
$("cam-btn").addEventListener("click", () => input.press("c"));
$("sound-btn").addEventListener("click", () => {
  audio.setMuted(!audio.muted);
  $("sound-btn").textContent = audio.muted ? "Son : coupé" : "Son : activé";
});
$("prompt").addEventListener("click", () => input.press("e"));
for (const b of document.querySelectorAll("[data-q]")) {
  b.classList.toggle("on", b.dataset.q === quality);
  b.addEventListener("click", () => {
    store.set("quality", b.dataset.q);
    location.search = `?q=${b.dataset.q}`;
  });
}
for (const b of document.querySelectorAll("[data-guided]")) {
  b.classList.toggle("on", (b.dataset.guided === "1") === guided);
  b.addEventListener("click", () => {
    guided = b.dataset.guided === "1";
    store.set("guided", guided);
    for (const o of document.querySelectorAll("[data-guided]")) o.classList.toggle("on", o === b);
  });
}

// ------------------------------------------------------------------------------------
const clock = new THREE.Clock();
let fpsT = 0;
let frames = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1);
  wind.value += dt;
  if (!world) return;
  radioTimer -= dt;
  if (radioTimer <= 0) $("radio").hidden = true;
  if (input.hit("c")) {
    if (job) {
      job.camMode = job.cams[(job.cams.indexOf(job.camMode) + 1) % job.cams.length];
      rig.look = { yaw: 0, pitch: 0 };
      $("cam-btn").textContent = `Caméra : ${camName(job.camMode)}`;
    }
  }
  if (state === "world") {
    const move = {
      fwd: input.axis(["ArrowDown", "s"], ["ArrowUp", "z", "w"], "L", "y"),
      side: input.axis(["ArrowLeft", "q", "a"], ["ArrowRight", "d"], "L", "x"),
    };
    const av = world.avatar;
    const camYaw = Math.atan2(camera.position.x - av.root.position.x, camera.position.z - av.root.position.z) + Math.PI;
    av.update(dt, move, camYaw, input.down("Shift"), walkHeight);
    if (!rig.drag && Math.hypot(move.fwd, move.side) > 0.1) {
      // La caméra se replace doucement derrière le personnage
      let d = ((av.st.yaw + Math.PI - rig.o.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      rig.o.yaw += d * Math.min(1, dt * 1.5);
    }
    rig.orbit(av.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    camera.fov = 60;
    const spot = vehicleSpots().map((v) => ({ ...v, d: v.pos.distanceTo(av.root.position) })).sort((a, b) => a.d - b.d)[0];
    const near = spot.d < 6;
    $("prompt").hidden = !near;
    if (near) $("prompt").innerHTML = `<kbd>E</kbd> Prendre le poste : <b>${spot.job.def.title}</b>`;
    if (near && input.hit("e")) showBrief(spot.job);
    const q = project(av.st.x, av.st.z, 200);
    $("where").textContent = q.d < 150 ? `Vallée de la Bruche · PK ${(q.s / 1000).toFixed(3)}` : "Vallée de la Bruche";
  } else if (state === "job") {
    job.update(dt);
    job.camera(dt, rig);
    $("score").textContent = job.mission.st.score;
    const q = project(camera.position.x, camera.position.z, 200);
    $("where").textContent = `${job.def.title} · PK ${(Math.max(q.s, 0) / 1000).toFixed(3)}`;
    if (job.mission.st.status !== "running") {
      endTimer += dt;
      if (endTimer > 1.8) endJob();
    }
  } else {
    // Menus : lent travelling au-dessus de la base
    const t = clock.elapsedTime * 0.03;
    rig.o = { yaw: t, pitch: 0.32, dist: 90 };
    rig.orbit(P(380, -30, 4));
  }
  camera.updateProjectionMatrix();
  world.veg.update(camera.position);
  core.render();
  input.endFrame();
  frames++;
  fpsT += dt;
  if (fpsT > 1) {
    window.__fps = frames / fpsT;
    frames = 0;
    fpsT = 0;
  }
}

buildWorld(core, scene, quality, (text, k) => {
  $("load-text").textContent = text;
  $("load-bar").style.width = `${Math.round(k * 100)}%`;
})
  .then((w) => {
    world = { ...w, scene };
    resetVehicles();
    $("loading").hidden = true;
    showHub();
  })
  .catch((e) => {
    $("load-text").textContent = `Erreur de chargement : ${e.message}`;
    console.error(e);
  });
requestAnimationFrame(loop);

// Points d'entrée des tests automatisés (tools/test.mjs)
window.__ftP = P;
window.__ftFrame = frame;
window.__ftH = (p) => p.y - trackY(project(p.x, p.z, 40).s) - RAIL_TOP_Y;
window.__ftSkip = () => world.depot.skip.localToWorld(new THREE.Vector3(0, 2.4, 0));
window.__ftDropper = () => P(744.5, (-2.1 + (-2.1 + 0.2)) / 2, RAIL_TOP_Y + 5.5 + 0.4);
window.__ft = {
  get world() {
    return world;
  },
  get job() {
    return job;
  },
  get state() {
    return state;
  },
  jobs: JOBS,
  startJob: (id) => startJob(JOBS.find((j) => j.def.id === id)),
  snapCam() {
    if (job) for (let i = 0; i < 40; i++) job.camera(0.25, rig);
  },
  enterWorld,
  showHub,
  endJob,
  rig,
  camera,
  input,
  core,
};
