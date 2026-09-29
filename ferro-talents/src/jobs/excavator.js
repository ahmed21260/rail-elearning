// Métier : conducteur·rice d'engins rail-route (pelle). Enraillement, circulation, chantier de dégarnissage,
// limiteur de hauteur sous caténaire, gabarit de la voie contiguë en circulation.
import * as THREE from "three";
import { P, frame, project, trackY, sweep } from "../world/line.js";
import { TRACK_LAT, OTHER_LAT, RAIL_TOP_Y, CONTACT_Y, contactLat, messengerY } from "../world/track.js";
import { ENRAIL, WORKSITE } from "../world/depot.js";
import { groundHeight } from "../world/terrain.js";
import { createMission } from "./common.js";

export const EXC_JOB = {
  id: "pelle",
  title: "Conducteur·rice de pelle rail-route",
  vehicle: "Pelle rail-route sur pneus, galets de guidage",
  pitch: "Enraille ta pelle, rejoins le chantier et dégarnis le ballast pollué sans jamais engager le gabarit de la voie voisine, restée en circulation.",
  brief: [
    "Démarre le moteur (M) et conduis la pelle jusqu'au point d'enraillement (rampe jaune).",
    "Aligne-toi sur la voie 1 puis enraille (V) : les galets de guidage descendent sur les rails.",
    "Circule sur rail jusqu'au chantier balisé : 20 km/h maximum, 10 km/h dans la zone.",
    "Serre le frein de parc (B) et passe en mode travail (T).",
    "Retire le ballast pollué des 4 repères et vide chaque godet dans la benne verte.",
    "La voie 2 reste en circulation : ne franchis jamais son gabarit avec la flèche ou le contrepoids.",
    "Termine en position transport (godet replié, flèche basse), frein desserré.",
  ],
  keys: "Translation : ↑↓ avancer/reculer · ←→ direction · Travail (T) : A/D rotation · W/S balancier · I/K flèche · J/L godet · M moteur · V enrailler · B frein de parc · C caméra",
  skills: ["Conduite d'engins de précision", "Lecture d'un plan de chantier", "Règles de sécurité ferroviaire (gabarit, caténaire)", "Travail en équipe avec l'agent de protection"],
  access: "Formation de conducteur d'engins de travaux publics complétée par une qualification rail-route (conduite sur voie ferrée, sécurité du personnel) propre à l'entreprise ferroviaire.",
};

const HEIGHT_LIMIT = 5.0; // m au-dessus du rail : limiteur réglé sous le fil de contact (≈ 5,9 m)
const GAUGE_LAT = OTHER_LAT - 1.7; // bord du gabarit de la voie 2 (repère ligne)

export function createExcavatorJob(ctx) {
  const { world, ui, input, audio, camera } = ctx;
  const ex = world.exc;
  const rr = ex.rr;
  const m = createMission(ui, [
    { id: "moteur", label: "Moteur démarré, tour de l'engin fait" },
    { id: "enrail", label: "Enraillement au point prévu (voie 1)" },
    { id: "chantier", label: "Arrivée au chantier à vitesse réduite" },
    { id: "frein", label: "Frein de parc serré, mode travail" },
    { id: "degarnir", label: "4 godets de ballast pollué vidés dans la benne" },
    { id: "transport", label: "Position transport, frein desserré" },
  ]);
  const st = { engine: false, work: false, loaded: false, dumps: 0, dug: new Set(), limiter: false, gauge: false, trainS: null, announced: false, lastBoomCmd: 0 };
  // Tas de ballast pollué aux repères (petits monticules sombres + marquage orange)
  const mounds = WORKSITE.spots.map((s) => {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 1 }));
    g.scale.set(1.2, 0.5, 1.0);
    g.position.copy(P(s, -4.9, 0.02));
    g.castShadow = g.receiveShadow = true;
    world.scene.add(g);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 24), new THREE.MeshBasicMaterial({ color: 0xff6a00 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.copy(P(s, -4.9, 0.06));
    world.scene.add(mark);
    return { s, g, mark };
  });

  ui.hud(`
    <div id="ex-panel" class="glass">
      <div class="row"><b>Mode</b><span id="ex-mode">Route</span></div>
      <div class="row"><b>Vitesse</b><span id="ex-speed">0 km/h</span></div>
      <div class="row"><b>Point haut</b><span id="ex-h">0,0 m</span></div>
      <div class="row"><b>Distance caténaire</b><span id="ex-cat">—</span></div>
      <div class="row"><b>Rotation</b><span id="ex-swing">0°</span></div>
      <div class="row"><b>Godet</b><span id="ex-load">vide</span></div>
      <div class="row"><b>Benne</b><span id="ex-dumps">0 / 4</span></div>
      <div id="ex-lights"><span data-l="engine">MOTEUR</span><span data-l="brake">FREIN</span><span data-l="rail">RAIL</span><span data-l="limiter">LIMITEUR</span><span data-l="gauge">GABARIT V2</span></div>
    </div>
    <div id="ex-align" class="glass" hidden><b>Aide à l'enraillement</b><div>Décalage <span id="al-lat">—</span></div><div>Angle <span id="al-yaw">—</span></div><div id="al-ok"></div></div>
    <div id="ex-top"><div id="ex-top-view"></div><div class="legend"><span>Vue de dessus 3D</span><span class="red">▮ gabarit voie 2</span></div></div>`);
  ui.actions([["m", "Moteur"], ["v", "Enrailler"], ["b", "Frein"], ["t", "Travail"]]);
  ui.joysticks(true);
  const $ = (id) => document.getElementById(id);
  let camMode = "follow";
  // Vue de dessus 3D : caméra dédiée + gabarit de la voie 2 visible uniquement dans cette vue (calque 1)
  const topCam = new THREE.PerspectiveCamera(38, 1, 1, 400);
  topCam.layers.enable(1);
  const gaugeMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const gaugeGroup = new THREE.Group();
  for (const profile of [[[GAUGE_LAT, 0.45], [OTHER_LAT + 2.2, 0.45]], [[GAUGE_LAT, 0.3], [GAUGE_LAT, 6.2]]]) {
    const g = new THREE.Mesh(sweep({ s0: 300, s1: 1200, step: 4, profile }), gaugeMat);
    g.layers.set(1);
    g.renderOrder = 5;
    gaugeGroup.add(g);
  }
  world.scene.add(gaugeGroup);
  ctx.core.inset = { el: $("ex-top-view"), cam: topCam };
  const tmp = new THREE.Vector3();

  function railPos(p) {
    const q = project(p.x, p.z, 40);
    return { s: q.s, lat: q.lat, y: p.y - trackY(q.s) };
  }

  /** Point le plus haut de l'équipement (flèche, balancier, godet) au-dessus du rail. */
  function topHeight(pose) {
    ex.pose(pose);
    return Math.max(...ex.probes().map((p) => railPos(p).y - RAIL_TOP_Y));
  }

  function clampJoints(next, prev) {
    // Limiteur de hauteur : tout mouvement qui ferait dépasser la limite (ou monter au-delà) est refusé.
    const hPrev = topHeight(prev);
    const hNext = topHeight(next); // pose d'essai : move() réapplique la pose acceptée ensuite
    st.limiter = Math.max(hPrev, hNext) > HEIGHT_LIMIT - 0.15;
    if (hNext > HEIGHT_LIMIT && hNext >= hPrev - 1e-4) {
      if (Math.floor(m.st.t * 3) % 2 === 0) audio.beep(900, 0.06, 0.05);
      st.limitHits = (st.limitHits || 0) + 1;
      return { ...next, boom: prev.boom, stick: prev.stick, bucket: prev.bucket };
    }
    return next;
  }

  /** Distance minimale équipement ↔ fils de la caténaire (fil de contact et porteur, voie 1). */
  function wireClearance() {
    let d = Infinity;
    for (const p of ex.probes()) {
      const q = railPos(p);
      const cl = contactLat(q.s, TRACK_LAT);
      d = Math.min(d, Math.hypot(q.lat - cl, q.y - CONTACT_Y), Math.hypot(q.lat - TRACK_LAT, q.y - messengerY(q.s)));
    }
    return d;
  }

  return {
    def: EXC_JOB,
    mission: m,
    debug: { st, rr, ex },
    debugInfo() {
      const t = railPos(ex.tip());
      return { top: +topHeight(ex.joints).toFixed(2), clr: +wireClearance().toFixed(2), tip: { s: +t.s.toFixed(2), lat: +t.lat.toFixed(2), y: +t.y.toFixed(2) }, joints: Object.fromEntries(Object.entries(ex.joints).map(([k, v]) => [k, +v.toFixed(2)])), loaded: st.loaded, dumps: st.dumps, work: st.work, brake: rr.brake, dug: [...st.dug], limiter: st.limiter };
    },
    cams: ["follow", "cab", "orbit"],
    get camMode() {
      return camMode;
    },
    set camMode(v) {
      camMode = v;
    },
    update(dt) {
      m.st.t += dt;
      if (input.hit("m")) {
        st.engine = !st.engine;
        if (st.engine) m.done("moteur");
      }
      if (input.hit("b")) {
        rr.brake = !rr.brake;
        if (!rr.brake) st.work = false;
      }
      if (input.hit("t")) {
        if (!st.work && !rr.brake) ui.toast("Serre d'abord le frein de parc (B)", "info");
        else st.work = !st.work;
        if (st.work && m.is("frein")) {
          const q = project(rr.x, rr.z, 30);
          if (rr.mode === "rail" && q.s > WORKSITE.s0 - 20 && q.s < WORKSITE.s1 + 20) m.done("frein");
        }
      }
      if (input.hit("v")) {
        if (rr.mode === "rail") rr.startDerail();
        else if (!st.engine) ui.toast("Démarre le moteur (M)", "info");
        else if (rr.canEnrail(ENRAIL)) rr.startEnrail();
        else ui.toast("Enraillement impossible : place l'engin sur la rampe, aligné sur la voie 1, à l'arrêt", "info");
      }
      if (rr.mode === "rail" && m.is("enrail")) m.done("enrail");
      // Commandes
      const drive = { throttle: 0, steer: 0 };
      const cmd = {};
      if (st.engine && !st.work) {
        drive.throttle = input.axis(["ArrowDown", "s"], ["ArrowUp", "w"], "R", "y");
        drive.steer = rr.mode === "road" ? -input.axis(["ArrowLeft", "a"], ["ArrowRight", "d"], "L", "x") : 0;
      }
      if (st.engine && st.work) {
        cmd.swing = -input.axis(["a"], ["d"], "L", "x");
        cmd.stick = -input.axis(["s"], ["w"], "L", "y");
        cmd.boom = input.axis(["k", "ArrowDown"], ["i", "ArrowUp"], "R", "y");
        cmd.bucket = input.axis(["l", "ArrowRight"], ["j", "ArrowLeft"], "R", "x");
        ex.move(dt, cmd, clampJoints);
      }
      rr.update(dt, drive);
      ex.update();
      // Déplacement flèche levée
      const tipRel = railPos(ex.tip());
      const top = topHeight(ex.joints);
      if (Math.abs(rr.v) > 0.5 && top > 3.4) m.penalize("fleche", 10, "Déplacement avec la flèche levée");
      // Contact caténaire : fin de mission (le limiteur doit l'empêcher)
      const clr = wireClearance();
      if (clr < 0.4) m.fail("Contact de l'équipement avec la caténaire : risque d'électrisation et d'arrachement des fils.");
      // Vitesses sur rail
      if (rr.mode === "rail") {
        const q = project(rr.x, rr.z, 30);
        const inSite = q.s > WORKSITE.s0 - 30 && q.s < WORKSITE.s1 + 30;
        if (rr.kmh > 21) m.penalize("vit20", 10, "Survitesse sur rail (20 km/h maximum)");
        if (inSite && rr.kmh > 11) m.penalize("vit10", 10, "Survitesse dans la zone de chantier (10 km/h)");
        if (m.is("chantier") && q.s > WORKSITE.s0 - 10 && q.s < WORKSITE.s1 && rr.kmh < 0.5) m.done("chantier");
      }
      // Gabarit de la voie 2
      const probes = ex.probes().map(railPos);
      st.gauge = probes.some((p) => p.lat > GAUGE_LAT && p.y < 7);
      if (st.gauge) {
        m.penalize("gabarit", 15, "Engagement du gabarit de la voie 2 en circulation");
        if (Math.floor(m.st.t * 4) % 2 === 0) audio.beep(700, 0.08, 0.08);
      }
      // Circulation annoncée sur la voie 2 pendant le dégarnissage
      if (m.is("degarnir") && !st.announced && st.dumps >= 1) {
        st.announced = true;
        ui.radio("Agent de protection", "Annonce : circulation voie 2 dans 20 secondes. Dégagez le gabarit !");
        audio.horn(0.4);
        st.trainS = project(rr.x, rr.z, 30).s - 900;
      }
      if (st.trainS !== null) {
        st.trainS += 40 * dt;
        world.other.visible = true;
        world.other.update(st.trainS, OTHER_LAT);
        const here = project(rr.x, rr.z, 30).s;
        if (st.gauge && Math.abs(st.trainS - here) < 25) m.fail("Collision avec une circulation sur la voie 2 : le gabarit doit être dégagé à l'annonce.");
        if (st.trainS > here + 400) {
          st.trainS = null;
          world.other.visible = false;
          ui.radio("Agent de protection", "Circulation passée, reprise du travail possible.");
        }
      }
      // Dégarnissage : creuser au repère, vider dans la benne
      if (st.work && m.is("degarnir")) {
        const tip = tipRel;
        if (!st.loaded) {
          for (const md of mounds) {
            if (st.dug.has(md.s)) continue;
            if (Math.abs(tip.s - md.s) < 1.6 && Math.abs(tip.lat + 4.9) < 1.2 && tip.y < 0.25 && cmd.bucket > 0.2) {
              st.loaded = true;
              st.dug.add(md.s);
              md.g.scale.y = 0.08;
              md.mark.material.color.set(0x2ee57a);
              ui.toast("Godet plein", "good");
              ex.load.visible = true;
            }
          }
        } else {
          const skip = world.depot.skip;
          const local = skip.worldToLocal(ex.tip().clone());
          if (Math.abs(local.x) < 1.35 && Math.abs(local.z) < 2.2 && local.y > 1.3 && cmd.bucket < -0.2 && ex.joints.bucket < -0.3) {
            st.loaded = false;
            st.dumps++;
            ex.load.visible = false;
            world.depot.skipFill.scale.y = 0.001 + st.dumps * 0.25;
            world.depot.skipFill.position.y = 0.1 + st.dumps * 0.125;
            ui.toast(`Benne : ${st.dumps} / 4`, "good");
            if (st.dumps >= 4) m.done("degarnir");
          } else if (tip.y < 0.4 && Math.abs(tip.lat + 8.4) > 3 && cmd.bucket < -0.2 && Math.abs(tip.s - WORKSITE.skipS) > 3) {
            m.penalize("depot", 5, "Ballast pollué déversé hors de la benne");
          }
        }
      }
      if (m.is("transport") && top < 3.2 && ex.joints.bucket > 0.6 && !rr.brake) m.done("transport");
      // Gyrophare
      ex.beacon.material.emissiveIntensity = st.engine ? (Math.sin(m.st.t * 12) > 0 ? 6 : 0.2) : 0;
      audio.machine(st.engine ? 0.35 + 0.5 * Math.min(1, Math.abs(rr.v) / 5 + Object.values(cmd).reduce((a, v) => a + Math.abs(v || 0), 0) * 0.3) : 0, Object.values(cmd).reduce((a, v) => a + Math.abs(v || 0), 0) / 2, Math.abs(rr.v));
      // Interface
      $("ex-mode").textContent = `${rr.mode === "rail" ? "Rail" : rr.mode === "road" ? "Route" : "Enraillement…"} · ${st.work ? "Travail" : "Translation"}`;
      $("ex-speed").textContent = `${rr.kmh.toFixed(1)} km/h`;
      $("ex-h").textContent = `${top.toFixed(1)} m / ${HEIGHT_LIMIT} m`;
      $("ex-h").className = top > HEIGHT_LIMIT - 0.3 ? "yellow" : "";
      $("ex-cat").textContent = `${clr.toFixed(1)} m`;
      $("ex-cat").className = clr < 1.2 ? "red" : "";
      $("ex-swing").textContent = `${Math.round((ex.joints.swing * 180) / Math.PI)}°`;
      $("ex-load").textContent = st.loaded ? "plein" : "vide";
      $("ex-dumps").textContent = `${st.dumps} / 4`;
      const L = { engine: st.engine, brake: rr.brake, rail: rr.mode === "rail", limiter: st.limiter, gauge: st.gauge };
      for (const el of document.querySelectorAll("#ex-lights span")) el.classList.toggle("on", !!L[el.dataset.l]);
      const al = rr.railAlignment();
      const nearRamp = rr.mode === "road" && al.s > ENRAIL.s - ENRAIL.half - 15 && al.s < ENRAIL.s + ENRAIL.half + 15 && Math.abs(al.lateral) < 12;
      $("ex-align").hidden = !nearRamp;
      if (nearRamp) {
        $("al-lat").textContent = `${al.lateral > 0 ? "→" : "←"} ${Math.abs(al.lateral).toFixed(2)} m`;
        $("al-yaw").textContent = `${((al.yawErr * 180) / Math.PI).toFixed(1)}°`;
        $("al-ok").textContent = rr.canEnrail(ENRAIL) ? "✔ Prêt : appuie sur V" : "Tolérance : 0,35 m et 4,5°";
      }
      // Vue de dessus 3D : axe de la voie vertical à l'écran, engin au centre
      {
        const f = frame(project(rr.x, rr.z, 30).s);
        const c = ex.root.position;
        topCam.position.set(c.x - f.fx * 9, c.y + 30, c.z - f.fz * 9);
        topCam.up.set(f.fx, 0, f.fz);
        topCam.lookAt(c.x + f.fx * 2, c.y, c.z + f.fz * 2);
        gaugeMat.opacity = st.gauge ? 0.6 + 0.3 * Math.sin(m.st.t * 14) : 0.3;
      }
      // Conseils
      let tip = null;
      if (m.is("moteur")) tip = "Démarre le moteur (M).";
      else if (m.is("enrail")) tip = rr.mode === "road" ? "Rejoins la rampe du point d'enraillement et aligne-toi sur la voie 1, puis V." : "Galets en descente…";
      else if (m.is("chantier")) tip = "Circule jusqu'au chantier balisé (cônes) et arrête-toi au droit des repères orange.";
      else if (m.is("frein")) tip = "Serre le frein de parc (B), puis passe en mode travail (T).";
      else if (m.is("degarnir")) tip = st.trainS !== null ? "Circulation annoncée : ramène la flèche côté voie 1, hors du gabarit rouge !" : st.loaded ? "Pivote vers la benne verte (A/D), lève (I) et vide le godet (L)." : "Descends le godet dans un repère orange (I/K, W/S) et referme-le (J) pour charger.";
      else if (m.is("transport")) tip = "Position transport : godet replié (J), flèche basse (K), point haut sous 3,2 m, puis desserre le frein (B).";
      ui.tip(ctx.guided && tip ? { tone: st.gauge ? "red" : "blue", text: tip } : null);
    },
    camera(dt, rig) {
      if (camMode === "cab") {
        camera.position.copy(ex.seat());
        const dir = new THREE.Vector3(0, -0.15, -1).applyQuaternion(ex.upper.getWorldQuaternion(new THREE.Quaternion()));
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.look.yaw);
        dir.y += rig.look.pitch;
        camera.lookAt(tmp.copy(camera.position).add(dir));
        camera.fov = 70;
      } else if (camMode === "follow") {
        const back = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rr.yaw);
        const want = ex.root.position.clone().addScaledVector(back, 12).add(new THREE.Vector3(0, 6.5, 0));
        const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rr.yaw);
        want.addScaledVector(side, -5);
        camera.position.lerp(want, 1 - Math.exp(-dt * 3));
        camera.lookAt(ex.root.position.clone().add(new THREE.Vector3(0, 2, 0)));
        camera.fov = 55;
      } else rig.orbit(ex.root.position.clone().add(new THREE.Vector3(0, 2, 0)));
    },
    result() {
      return {
        lessons: [
          ["Enraillement", "Un engin rail-route se met sur les rails à un point prévu, aligné, à l'arrêt : les galets de guidage descendent."],
          ["Vitesses", "Sur rail : vitesse limitée, encore réduite dans la zone de chantier."],
          ["Caténaire", "Le limiteur de hauteur empêche la flèche d'approcher les fils."],
          ["Gabarit", "La voie contiguë reste souvent en circulation : aucune partie de l'engin ne doit engager son gabarit."],
          ["Protection", "L'agent de protection annonce les circulations : on dégage immédiatement."],
        ],
        extra: `Godets vidés : ${st.dumps} / 4`,
      };
    },
    exit() {
      for (const md of mounds) {
        world.scene.remove(md.g, md.mark);
      }
      world.scene.remove(gaugeGroup);
      ctx.core.inset = null;
      world.other.visible = false;
      world.depot.skipFill.scale.y = 0.001;
      audio.silence();
      void groundHeight;
    },
  };
}
