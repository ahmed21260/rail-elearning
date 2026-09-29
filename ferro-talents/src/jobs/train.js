// Métier : conducteur·rice de train. Préparation de l'engin, VACMA, KVB, signalisation, arrêt en gare.
import * as THREE from "three";
import { P, frame, grade } from "../world/line.js";
import { TRACK_LAT, OTHER_LAT } from "../world/track.js";
import { createScenario, SIGNALS, TYPE_NAME, TIV, TRAIN_START } from "./train-rules.js";
import { createMission } from "./common.js";
import { STATION } from "../world/depot.js";

export const TRAIN_JOB = {
  id: "train",
  title: "Conducteur·rice de train",
  vehicle: "Automoteur électrique 25 kV",
  pitch: "Prépare ton engin, respecte chaque signal et amène tes voyageurs à l'heure et en sécurité jusqu'à Valbruche.",
  brief: [
    "Prépare l'engin : batterie, pantographe, disjoncteur (manipulateur au neutre).",
    "Pendant la marche, appuie régulièrement sur la VACMA (touche V) : sinon freinage d'urgence.",
    "Feu jaune = avertissement : prépare l'arrêt. Le contrôle de vitesse (KVB) surveille ta courbe de freinage.",
    "Chantier au km 0,8 : limitation temporaire à 40 km/h entre les panneaux Z et R.",
    "Arrête la tête du train au repère T de la gare de Valbruche.",
  ],
  keys: "↑/Z traction · ↓/S frein · N neutre · Espace urgence · V VACMA · H klaxon · L phares · B batterie · P pantographe · D disjoncteur · C caméra",
  skills: ["Connaissance de la signalisation et de la réglementation", "Vigilance et concentration", "Gestion de la conduite (freinage, horaires)", "Sens des responsabilités (sécurité des voyageurs)"],
  access: "Formation de conducteur de train (licence européenne + attestation propre à l'entreprise et à la ligne). Accessible avec ou sans diplôme selon les entreprises, après tests de sélection et visite médicale.",
};

const DIAL = { cx: 110, cy: 110, r: 88, a0: (225 * Math.PI) / 180, span: (270 * Math.PI) / 180 };
const dialPt = (v, max, r = DIAL.r) => {
  const a = DIAL.a0 - (Math.min(Math.max(v, 0), max) / max) * DIAL.span;
  return [DIAL.cx + Math.cos(a) * r, DIAL.cy - Math.sin(a) * r];
};
function arc(v0, v1, max, r = DIAL.r) {
  const [x0, y0] = dialPt(v0, max, r);
  const [x1, y1] = dialPt(v1, max, r);
  const large = ((v1 - v0) / max) * 270 > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
function ticks(max, step, labelEvery, r0 = 74) {
  let h = "";
  for (let k = 0; k <= max + 1e-6; k += step) {
    const [x0, y0] = dialPt(k, max, Math.abs(k % labelEvery) < 1e-6 ? r0 : r0 + 5);
    const [x1, y1] = dialPt(k, max, 86);
    h += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`;
    if (Math.abs(k % labelEvery) < 1e-6) {
      const [tx, ty] = dialPt(k, max, 58);
      h += `<text x="${tx.toFixed(1)}" y="${(ty + 5).toFixed(1)}">${Math.round(k * 10) / 10}</text>`;
    }
  }
  return h;
}
const gauge = (id, label, unit, max, step, lbl) => `
  <div class="gauge glass" id="${id}">
    <svg viewBox="0 0 220 220"><path class="g-bg" d="${arc(0, max, max)}"/><g class="ticks">${ticks(max, step, lbl)}</g>
    <line class="needle" x1="110" y1="110" x2="110" y2="36"/><circle cx="110" cy="110" r="9" class="hub"/></svg>
    <div class="g-val"><b>0</b> ${unit}</div><div class="g-label">${label}</div>
  </div>`;

export function createTrainJob(ctx) {
  const { world, ui, input, audio, camera } = ctx;
  const sc = createScenario({ guided: ctx.guided });
  const m = createMission(ui, [
    { id: "batt", label: "Batterie en service" },
    { id: "panto", label: "Pantographe levé (tension ligne 25 kV)" },
    { id: "dj", label: "Disjoncteur fermé" },
    { id: "depart", label: "Départ : essai de freinage réussi" },
    { id: "gare", label: "Arrêt au repère T en gare de Valbruche" },
  ]);
  const t = { s: TRAIN_START, v: 0, lever: 0, batt: false, panto: 0, pantoUp: false, dj: false, kv: 0, lights: false, urg: false, vacma: 0, vacmaWarn: false, brakeTest: false, otherS: null };
  const train = world.train;

  ui.hud(`
    <div id="cabframe"><svg viewBox="0 0 1920 1080" preserveAspectRatio="none"><path d="M0 0 H1920 V40 Q960 76 0 40 Z" fill="#07090c"/><path d="M0 0 L120 0 L56 930 L0 930 Z" fill="#0b0e12"/><path d="M1920 0 L1800 0 L1864 930 L1920 930 Z" fill="#0b0e12"/><path d="M0 1080 V860 Q960 800 1920 860 V1080 Z" fill="#12161c"/><path d="M0 860 Q960 800 1920 860" stroke="#3a4552" stroke-width="3" fill="none"/></svg></div>
    <div id="desk">
      ${gauge("g-cg", "CG · conduite générale", "bar", 10, 1, 2)}
      ${gauge("g-cf", "CF · cylindres de frein", "bar", 5, 0.5, 1)}
      <div class="gauge glass big" id="g-v">
        <svg viewBox="0 0 220 220"><path class="g-bg" d="${arc(0, 160, 160)}"/><path id="v-curve" class="g-curve" d=""/><path id="v-arc" class="g-arc" d=""/><path id="v-lim" class="g-lim" d=""/><g class="ticks">${ticks(160, 10, 40)}</g></svg>
        <div class="g-speed" id="v-num">0</div><div class="g-unit">km/h</div><div class="g-limit" id="v-limit">120</div>
      </div>
      ${gauge("g-kv", "Tension ligne", "kV", 30, 2.5, 10)}
      ${gauge("g-a", "Courant de traction", "A", 1000, 100, 500)}
      <div id="lamps" class="glass">
        <span data-l="batt">BATT</span><span data-l="panto">PANTO</span><span data-l="dj">DJ</span>
        <span data-l="vacma">VACMA</span><span data-l="kvb">KVB</span><span data-l="urg">URG</span>
      </div>
      <div id="t-next" class="glass"><div id="t-dot"></div><div><b id="t-name">—</b><br><span id="t-asp">—</span></div><b id="t-dist">—</b></div>
      <div id="t-map" class="glass"><svg viewBox="0 0 600 44"><line x1="12" y1="26" x2="588" y2="26" stroke="#5a6878" stroke-width="5" stroke-linecap="round"/><g id="t-sigs"></g><rect id="t-tiv" y="31" height="5" fill="#ffc21a"/><g id="t-train"><rect x="-20" y="20" width="20" height="12" rx="3" fill="#5cc8ff"/></g></svg><div class="legend"><span>Base travaux</span><span id="t-grade">Rampe 0 ‰</span><span>Valbruche</span></div></div>
    </div>`);
  ui.actions([
    ["b", "Batterie"], ["p", "Panto"], ["d", "Disjoncteur"], ["v", "VACMA"], ["h", "Klaxon"], ["l", "Phares"], [" ", "Urgence", "red"],
  ]);
  ui.lever(true);
  const L = 5520;
  const mx = (s) => 12 + (Math.min(Math.max(s, 0), L) / L) * 576;
  document.getElementById("t-sigs").innerHTML = SIGNALS.map((d) => `<g transform="translate(${mx(d.s).toFixed(1)} 0)"><line y1="24" y2="10" stroke="#aab4c0" stroke-width="2"/><circle id="tm-${d.id}" cy="8" r="6"/></g>`).join("");
  const tiv = document.getElementById("t-tiv");
  tiv.setAttribute("x", mx(TIV.from));
  tiv.setAttribute("width", mx(TIV.to) - mx(TIV.from));
  const $ = (id) => document.getElementById(id);
  const setNeedle = (id, v, max) => {
    const [x, y] = dialPt(v, max, 72);
    const el = $(id);
    el.querySelector(".needle").setAttribute("x2", x.toFixed(1));
    el.querySelector(".needle").setAttribute("y2", y.toFixed(1));
    el.querySelector(".g-val b").textContent = max >= 100 ? Math.round(v) : v.toFixed(1);
  };
  const COLOR = { red: "#ff4d3d", yellow: "#ffc21a", green: "#2ee57a" };
  const aspectColor = (lit) => (lit.red ? COLOR.red : lit.yellow ? COLOR.yellow : COLOR.green);
  let lastEvents = 0;
  let camMode = "cab";
  const look = { yaw: 0, pitch: 0 };

  function physics(dt) {
    if (input.down("ArrowUp") || input.down("z") || input.down("w") || ctx.lever.up) t.lever = Math.min(1, t.lever + dt * 0.9);
    if (input.down("ArrowDown") || input.down("s") || ctx.lever.down) t.lever = Math.max(-1, t.lever - dt * 0.9);
    if (ctx.lever.set !== null) {
      t.lever = ctx.lever.set;
      ctx.lever.set = null;
    }
    const power = t.dj && t.kv > 20;
    const emergency = t.urg || sc.st.emergency;
    let a;
    if (emergency) a = -1.4;
    else if (t.lever > 0) a = power ? t.lever * 0.8 * Math.max(0, 1 - t.v / 40) : 0;
    else a = t.lever * 1.0;
    a -= (grade(t.s) / 1000) * 9.81; // effet de la rampe
    if (t.v > 0) a -= 0.004 + 0.00004 * t.v * t.v;
    if (t.v <= 0.01 && t.lever <= 0) a = Math.min(a, 0); // frein de maintien à l'arrêt
    const sPrev = t.s;
    t.v = Math.max(0, t.v + a * dt);
    t.s += t.v * dt;
    if (t.urg && t.v < 0.05 && t.lever <= -0.99) t.urg = false;
    sc.update(dt, sPrev, t.s, t.v);
    if (sc.st.emergency) t.lever = Math.min(t.lever, 0);
    // VACMA : acquittement périodique pendant la marche
    if (t.v > 1) t.vacma += dt;
    if (t.vacma > 50 && !t.vacmaWarn) {
      t.vacmaWarn = true;
      ui.toast("VACMA : appuyez sur la pédale / touche V !", "penalty");
    }
    if (t.vacmaWarn && Math.floor(t.vacma * 4) % 2 === 0) audio.beep(1200, 0.05, 0.06);
    if (t.vacma > 55) {
      t.urg = true;
      t.vacma = 0;
      t.vacmaWarn = false;
      m.penalize("vacma", 15, "VACMA non acquittée : freinage d'urgence", { once: false });
    }
    // Essai de freinage au départ (entre 10 et 30 km/h)
    if (m.is("depart") && t.v * 3.6 > 10 && t.lever < -0.3) t.brakeTest = true;
    if (m.is("depart") && t.brakeTest && t.lever >= 0) m.done("depart");
    if (m.is("depart") && t.v * 3.6 > 32 && !t.brakeTest) m.penalize("essai", 5, "Essai de freinage non réalisé au départ");
    if (t.otherS === null && t.s > 400) t.otherS = t.s + 1400;
    if (t.otherS !== null) t.otherS -= 33 * dt;
  }

  function updateHud() {
    const kmh = t.v * 3.6;
    $("v-num").textContent = Math.round(kmh);
    $("v-arc").setAttribute("d", kmh > 0.5 ? arc(0, kmh, 160) : "M0 0");
    const lim = sc.speedLimit(t.s);
    const [a0, b0] = dialPt(lim, 160, 68);
    const [a1, b1] = dialPt(lim, 160, 98);
    $("v-lim").setAttribute("d", `M ${a0} ${b0} L ${a1} ${b1}`);
    $("v-limit").textContent = lim;
    const curve = sc.curveLimit(t.s);
    $("v-curve").setAttribute("d", curve !== null && curve * 3.6 < lim ? arc(Math.max(curve * 3.6, 0), lim, 160, 97) : "M0 0");
    $("v-num").classList.toggle("warn", (curve !== null && t.v > curve) || kmh > lim + 3);
    const braking = t.urg || sc.st.emergency ? 1 : Math.max(-t.lever, 0);
    const cg = t.batt ? (t.urg || sc.st.emergency ? 0 : 5 - 1.5 * braking) : 0;
    setNeedle("g-cg", cg, 10);
    setNeedle("g-cf", t.batt ? 3.8 * braking : 0, 5);
    setNeedle("g-kv", t.kv, 30);
    setNeedle("g-a", t.dj && t.lever > 0 ? t.lever * 820 * (0.4 + 0.6 * Math.max(0, 1 - t.v / 40)) : 0, 1000);
    const lampState = { batt: t.batt, panto: t.pantoUp && t.panto > 0.99, dj: t.dj, vacma: t.vacmaWarn, kvb: curve !== null, urg: t.urg || sc.st.emergency };
    for (const el of document.querySelectorAll("#lamps span")) el.classList.toggle("on", !!lampState[el.dataset.l]);
    const n = sc.nextSignal(t.s);
    if (n) {
      const lit = sc.lamps(n.id);
      $("t-name").textContent = `${TYPE_NAME[n.type]} ${n.label}`;
      $("t-asp").textContent = sc.aspectText(n.id);
      $("t-dist").textContent = `${Math.max(0, Math.round(n.s - t.s))} m`;
      $("t-dot").style.background = aspectColor(lit);
    }
    for (const d of SIGNALS) $(`tm-${d.id}`).setAttribute("fill", aspectColor(sc.lamps(d.id)));
    $("t-train").setAttribute("transform", `translate(${mx(t.s).toFixed(1)} 0)`);
    $("t-grade").textContent = `Rampe ${Math.round(grade(t.s))} ‰`;
    ui.lever(true, t.lever, t.urg || sc.st.emergency ? "URGENCE" : t.lever > 0.02 ? `Traction ${Math.round(t.lever * 100)} %` : t.lever < -0.02 ? `Freinage ${Math.round(-t.lever * 100)} %` : "Neutre");
    // Conseil : préparation d'abord, puis règles de conduite
    let tip = null;
    if (!t.batt) tip = { tone: "blue", text: "Mets la batterie en service (B)." };
    else if (!t.pantoUp) tip = { tone: "blue", text: "Lève le pantographe (P) pour capter les 25 kV de la caténaire." };
    else if (t.kv < 20) tip = { tone: "blue", text: "Pantographe en montée : attends la tension ligne." };
    else if (!t.dj) tip = { tone: "blue", text: "Ferme le disjoncteur (D), manipulateur au neutre." };
    else if (m.is("depart") && !t.brakeTest && t.v * 3.6 > 10) tip = { tone: "yellow", text: "Essai de freinage : freine brièvement (↓) puis reprends la marche." };
    else if (t.vacmaWarn) tip = { tone: "red", text: "Acquitte la VACMA (V) immédiatement !" };
    else tip = sc.tip(t.s, t.v, t.lever);
    ui.tip(ctx.guided ? tip : null);
    while (lastEvents < sc.st.events.length) {
      const e = sc.st.events[lastEvents++];
      ui.toast(e.text, e.kind);
      audio.beep(e.kind === "penalty" ? 440 : 1046, e.kind === "penalty" ? 0.35 : 0.12);
    }
    const curveLim = sc.curveLimit(t.s);
    if (curveLim !== null && t.v > curveLim && Math.floor(m.st.t * 2) % 2 === 0) audio.beep(1400, 0.05, 0.06);
  }

  const tmp = new THREE.Vector3();
  return {
    def: TRAIN_JOB,
    mission: m,
    debug: { t, sc },
    cams: ["cab", "follow", "orbit"],
    get camMode() {
      return camMode;
    },
    set camMode(v) {
      camMode = v;
      document.getElementById("cabframe").hidden = v !== "cab";
    },
    update(dt) {
      m.st.t += dt;
      if (input.hit("b")) {
        t.batt = !t.batt;
        if (t.batt) m.done("batt");
        else Object.assign(t, { dj: false, pantoUp: false });
      }
      if (input.hit("p")) {
        if (!t.batt) ui.toast("Batterie hors service : pantographe inopérant", "info");
        else {
          t.pantoUp = !t.pantoUp;
          if (!t.pantoUp) t.dj = false;
        }
      }
      if (input.hit("d")) {
        if (t.dj) t.dj = false;
        else if (t.kv < 20) ui.toast("Pas de tension ligne : lève le pantographe", "info");
        else if (Math.abs(t.lever) > 0.05) ui.toast("Fermeture refusée : manipulateur au neutre (N)", "info");
        else {
          t.dj = true;
          m.done("dj");
        }
      }
      if (input.hit("n")) t.lever = 0;
      if (input.hit(" ")) {
        t.urg = true;
        t.lever = -1;
      }
      if (input.hit("v")) {
        t.vacma = 0;
        t.vacmaWarn = false;
        audio.beep(660, 0.05, 0.05);
      }
      if (input.hit("h")) audio.horn();
      if (input.hit("l")) t.lights = !t.lights;
      // Pantographe : montée 3 s, tension établie au contact
      t.panto = Math.max(0, Math.min(1, t.panto + (t.pantoUp ? dt / 3 : -dt / 1.5)));
      t.kv = t.panto > 0.99 ? Math.min(25, t.kv + dt * 40) : 0;
      if (t.kv >= 25 && m.is("panto")) m.done("panto");
      if (!t.kv) t.dj = false;
      if (m.st.status === "running" && sc.st.status === "running") {
        const n = Math.ceil(dt / 0.02);
        for (let i = 0; i < n; i++) physics(dt / n);
      }
      if (sc.st.status === "failed") m.fail(sc.st.failReason);
      if (sc.st.status === "success" && m.st.status === "running") {
        // Fusion des fautes de conduite (signalisation, vitesses) avec celles de la procédure
        m.st.penalties.push(...sc.st.penalties.map((p) => ({ pts: p.pts, text: p.text })));
        m.st.score = Math.max(0, 100 - m.st.penalties.reduce((a, p) => a + p.pts, 0));
        if (m.is("depart")) m.done("depart");
        m.done("gare");
      }
      train.update(t.s, TRACK_LAT);
      train.panto = t.panto;
      train.lights = t.lights;
      train.visible = camMode !== "cab";
      if (t.otherS !== null && t.otherS > -300) {
        world.other.visible = true;
        world.other.updateReverse(t.otherS, OTHER_LAT);
      } else world.other.visible = false;
      for (const d of SIGNALS) {
        const target = sc.lamps(d.id);
        const w = world.signals[d.id];
        for (const k of ["yellow", "red", "red2", "green"]) w.lit[k] = (w.lit[k] || 0) + ((target[k] || 0) - (w.lit[k] || 0)) * Math.min(1, dt * 8);
        w.api.update(w.lit, camera.position);
      }
      audio.train(t.v, t.dj ? Math.max(t.lever, 0) : 0, t.urg || sc.st.emergency ? 1 : Math.max(-t.lever, 0));
      updateHud();
    },
    camera(dt, rig) {
      if (camMode === "cab") {
        const k = Math.min(t.v / 35, 1);
        const amp = 0.008 * k + 0.0015;
        P(t.s - 1.2, TRACK_LAT - 0.45 + amp * 0.6 * Math.sin(m.st.t * 17.3), 3.25 + amp * (Math.sin(m.st.t * 23.1) + 0.5 * Math.sin(m.st.t * 41.7)), camera.position);
        const ahead = P(t.s + 150, TRACK_LAT + 0.2, 1.8, tmp).sub(camera.position).normalize();
        ahead.applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.look.yaw);
        ahead.y += rig.look.pitch;
        camera.lookAt(camera.position.clone().add(ahead));
        camera.fov = 60;
      } else if (camMode === "follow") {
        const want = P(t.s - 45, TRACK_LAT - 10, 9);
        camera.position.lerp(want, 1 - Math.exp(-dt * 3));
        camera.lookAt(P(t.s + 10, TRACK_LAT, 2, tmp));
        camera.fov = 55;
      } else rig.orbit(P(t.s - 12, TRACK_LAT, 2, tmp));
      void look;
    },
    result() {
      return {
        lessons: [
          ["Préparation", "Batterie, pantographe, disjoncteur : la mise en service suit un ordre précis."],
          ["VACMA", "Le dispositif de veille vérifie que le conducteur est vigilant : sans acquittement, freinage d'urgence."],
          ["Avertissement", "Feu jaune : un signal d'arrêt suit, le KVB surveille la courbe de freinage."],
          ["Carré", "2 feux rouges : arrêt absolu, jamais franchi sans autorisation."],
          ["Limitation temporaire", "Panneaux Z et R : vitesse réduite au droit d'un chantier."],
        ],
        extra: `Vitesse maximale : ${Math.round(sc.st.maxKmh)} km/h`,
      };
    },
    exit() {
      train.visible = true;
      world.other.visible = false;
      train.update(TRAIN_START, TRACK_LAT);
      train.panto = 0;
      audio.silence();
      void frame;
      void STATION;
    },
  };
}
