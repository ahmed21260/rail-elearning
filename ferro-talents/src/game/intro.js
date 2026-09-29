// Arrivée immersive : travelling cinématique au-dessus de la vallée jusqu'à la base travaux,
// puis accueil sécurité par le chef de chantier (dialogue, choix des EPI, zone dangereuse).
import * as THREE from "three";
import { P } from "../world/line.js";
import { groundHeight } from "../world/terrain.js";
import { PPE, WELCOME } from "../safety/content.js";

const $ = (id) => document.getElementById(id);

// Plans du travelling : [t (s), position (s, lat, hauteur au-dessus du sol), visée (s, lat, y)]
const SHOTS = [
  [0, [2600, 420, 330], [1400, 0, 0]],
  [5, [1700, 160, 120], [900, -10, 0]],
  [10, [1050, 38, 26], [620, -6, 2]],
  [14, [560, -8, 9], [330, -40, 2]],
  [18.5, [316, -58, 3.2], [296, -48, 1.4]],
];
const CAPTIONS = [
  [0.4, 4.8, "Vallée de la Bruche, Vosges · 7 h 42"],
  [5.2, 9.6, "Une ligne de 5,8 km tracée sur le relief réel"],
  [10.2, 13.8, "Chantier de renouvellement du ballast · voie 2 en circulation"],
  [14.2, 18.3, "Base travaux de Valbruche · ton premier jour"],
];
export const INTRO_LEN = SHOTS[SHOTS.length - 1][0];

function world3(s, lat, h) {
  const p = P(s, lat);
  p.y = groundHeight(p.x, p.z) + h;
  return p;
}

export function createIntro({ world, camera, audio, explore, onDone }) {
  const pos = new THREE.CatmullRomCurve3(SHOTS.map(([, a]) => world3(...a)), false, "centripetal");
  const aim = new THREE.CatmullRomCurve3(SHOTS.map(([, , b]) => world3(...b)), false, "centripetal");
  const times = SHOTS.map(([t]) => t);
  const chef = world.chef;
  const av = world.avatar;
  let phase = "cine"; // cine | talk | done
  let t = 0;
  let line = -1;
  let camFrom = null;
  let camGoal = null;
  const tmp = new THREE.Vector3();

  /** Paramètre de courbe u (0..1) interpolé par morceaux selon les temps des plans, avec lissage. */
  function u(tt) {
    let i = 0;
    while (i < times.length - 2 && tt > times[i + 1]) i++;
    const k = THREE.MathUtils.clamp((tt - times[i]) / (times[i + 1] - times[i]), 0, 1);
    const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    return (i + e) / (times.length - 1);
  }

  function faceEachOther() {
    const dx = chef.st.x - av.st.x;
    const dz = chef.st.z - av.st.z;
    av.st.yaw = Math.atan2(-dx, -dz);
    chef.st.yaw = Math.atan2(dx, dz);
  }

  function shoulderShot() {
    // Par-dessus l'épaule de l'agent, cadré sur le chef
    const a = av.root.position;
    const c = chef.root.position;
    const dir = tmp.subVectors(c, a).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    return { p: a.clone().addScaledVector(dir, -1.6).addScaledVector(side, 0.55).add(new THREE.Vector3(0, 1.75, 0)), l: c.clone().add(new THREE.Vector3(0, 1.45, 0)) };
  }
  function dangerShot() {
    return { p: world3(302, -13.5, 3.2), l: P(318, 0.5, 0) };
  }

  function showLine(i) {
    line = i;
    const L = WELCOME.lines[i];
    $("talk-text").textContent = L.text;
    $("talk-ppe").hidden = !L.ppe;
    $("talk-next").textContent = i === WELCOME.lines.length - 1 ? "Commencer l'exploration" : L.ppe ? "Valider ma tenue" : "Continuer";
    $("talk-feedback").textContent = "";
    if (L.ppe) {
      $("talk-ppe").innerHTML = PPE.map((p) => `<button class="ppe" data-id="${p.id}" aria-pressed="false"><span>${p.icon}</span>${p.label}</button>`).join("");
      for (const b of $("talk-ppe").querySelectorAll(".ppe")) b.addEventListener("click", () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"));
    }
    explore.highlight(L.show === "danger");
    camFrom = { p: camera.position.clone(), l: camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10).add(camera.position) };
    camGoal = L.show === "danger" ? dangerShot() : shoulderShot();
    t = 0;
    if (L.gesture) chef.gesture(L.gesture);
    audio.beep(1200, 0.04, 0.04, "sine");
  }

  function next() {
    const L = WELCOME.lines[line];
    if (L?.ppe) {
      const picked = new Set([...$("talk-ppe").querySelectorAll('.ppe[aria-pressed="true"]')].map((b) => b.dataset.id));
      const wrong = PPE.filter((p) => p.required !== picked.has(p.id));
      for (const b of $("talk-ppe").querySelectorAll(".ppe")) {
        const p = PPE.find((x) => x.id === b.dataset.id);
        b.classList.toggle("bad", p.required !== picked.has(p.id));
      }
      if (wrong.length) {
        $("talk-feedback").textContent = `Pas encore : ${wrong.map((p) => (p.required ? `il manque « ${p.label.toLowerCase()} »` : `« ${p.label.toLowerCase()} » est interdit sur un chantier`)).join(" · ")}.`;
        chef.gesture("headShake");
        audio.beep(440, 0.2);
        return;
      }
      chef.gesture("agree");
    }
    if (line + 1 < WELCOME.lines.length) showLine(line + 1);
    else finish();
  }

  function finish() {
    phase = "done";
    explore.highlight(false);
    $("talk").hidden = true;
    $("cine").hidden = true;
    onDone();
  }

  function startTalk() {
    phase = "talk";
    $("cine").hidden = true;
    $("talk").hidden = false;
    $("talk-name").textContent = WELCOME.speaker;
    $("talk-role").textContent = WELCOME.role;
    faceEachOther();
    showLine(0);
  }

  // Liaisons d'interface (réinitialisées à chaque intro)
  $("talk-next").onclick = next;
  $("cine-skip").onclick = () => (phase === "cine" ? startTalk() : null);
  $("talk-skip").onclick = finish;
  $("cine").hidden = false;
  $("talk").hidden = true;
  $("cine-cap").textContent = "";

  return {
    get phase() {
      return phase;
    },
    skip: () => (phase === "cine" ? startTalk() : finish()),
    next,
    update(dt) {
      t += dt;
      chef.animate(dt, 0);
      av.animate(dt, 0);
      if (phase === "cine") {
        const k = u(Math.min(t, INTRO_LEN));
        camera.position.copy(pos.getPoint(k));
        camera.lookAt(aim.getPoint(k));
        camera.fov = 50;
        const cap = CAPTIONS.find(([a, b]) => t >= a && t <= b);
        const text = cap ? cap[2] : "";
        if ($("cine-cap").textContent !== text) $("cine-cap").textContent = text;
        $("cine-cap").style.opacity = cap ? Math.min(1, (t - cap[0]) * 2, (cap[1] - t) * 2) : 0;
        if (t >= INTRO_LEN) startTalk();
      } else if (phase === "talk") {
        const k = 1 - Math.exp(-t * 2.2);
        camera.position.lerpVectors(camFrom.p, camGoal.p, k);
        camera.lookAt(tmp.lerpVectors(camFrom.l, camGoal.l, k));
        camera.fov = 45;
      }
    },
  };
}
