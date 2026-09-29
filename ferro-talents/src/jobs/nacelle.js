// Métier : opérateur·rice de nacelle rail-route caténaire. Calage, consignation, VAT, mise à la terre,
// remplacement d'un pendule, restitution. Distance de sécurité de 3 m à la caténaire sous tension.
import * as THREE from "three";
import { P, frame, project, trackY } from "../world/line.js";
import { TRACK_LAT, CONTACT_Y, contactLat, messengerY } from "../world/track.js";
import { ENRAIL, NACELLE_TASK } from "../world/depot.js";
import { createMission } from "./common.js";

export const NAC_JOB = {
  id: "nacelle",
  title: "Opérateur·rice nacelle caténaire",
  vehicle: "Nacelle rail-route à panier isolé",
  pitch: "Remplace un pendule de la caténaire 25 kV en respectant la procédure de consignation : aucune approche à moins de 3 m tant que la ligne n'est pas mise à la terre.",
  brief: [
    "Démarre (M), rejoins le point d'enraillement et enraille (V).",
    "Circule sur la voie 1 jusqu'au pendule signalé (support 1-018) et arrête-toi à sa hauteur.",
    "Serre le frein (B) et cale l'engin : stabilisateurs sortis (X).",
    "Demande la consignation de la caténaire voie 1 au régulateur (R) et attends l'accord.",
    "Vérifie l'absence de tension (U), puis pose les perches de mise à la terre (G).",
    "Monte le panier jusqu'au pendule et remplace-le (maintiens E).",
    "Redescends en position transport, lève les perches (G), restitue la ligne (R), rentre les stabilisateurs (X).",
  ],
  keys: "Translation : ↑↓ · ←→ · Travail : A/D rotation · W/S bras inférieur · I/K bras supérieur · E intervenir · M moteur · V enrailler · B frein · X stabilisateurs · R radio · U VAT · G mise à la terre · C caméra",
  skills: ["Rigueur dans l'application des procédures électriques", "Travail en hauteur", "Connaissance des installations caténaire", "Communication avec le régulateur"],
  access: "Formation d'électricien (CAP à BTS) complétée par des habilitations électriques ferroviaires et une autorisation de conduite de nacelle rail-route délivrée par l'employeur.",
};

const SAFE = 3.0; // m : distance minimale à une pièce sous tension (25 kV)

export function createNacelleJob(ctx) {
  const { world, ui, input, audio, camera } = ctx;
  const nc = world.nac;
  const rr = nc.rr;
  const task = NACELLE_TASK;
  const m = createMission(ui, [
    { id: "moteur", label: "Moteur démarré" },
    { id: "enrail", label: "Enraillement au point prévu" },
    { id: "position", label: "Arrêt au droit du pendule (support 1-018)" },
    { id: "calage", label: "Frein serré, stabilisateurs sortis" },
    { id: "consign", label: "Consignation caténaire voie 1 accordée" },
    { id: "vat", label: "Vérification d'absence de tension" },
    { id: "malt", label: "Perches de mise à la terre posées" },
    { id: "pendule", label: "Pendule remplacé" },
    { id: "descente", label: "Panier en position transport" },
    { id: "levee", label: "Perches levées" },
    { id: "restit", label: "Ligne restituée au régulateur" },
    { id: "rangement", label: "Stabilisateurs rentrés, frein desserré" },
  ]);
  const st = { engine: false, work: false, stab: 0, stabDir: 0, live: true, consignAt: null, restitAt: null, malt: false, vat: false, repair: 0, replaced: false };
  // Pendule à remplacer : repère lumineux
  const dropper = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff3300, emissiveIntensity: 1.5 }));
  const dS = task.dropperS;
  const dLat = (contactLat(dS, TRACK_LAT) + TRACK_LAT) / 2;
  const dTop = messengerY(dS);
  dropper.scale.y = dTop - CONTACT_Y;
  dropper.position.copy(P(dS, dLat, (dTop + CONTACT_Y) / 2));
  world.scene.add(dropper);
  const dropperPt = P(dS, dLat, CONTACT_Y + 0.4);
  // Perches de mise à la terre (rail → fil de contact), de part et d'autre du chantier
  const poles = [dS - 12, dS + 12].map((s) => {
    const a = P(s, TRACK_LAT - 0.72, 0.36);
    const b = P(s, contactLat(s, TRACK_LAT), CONTACT_Y);
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, a.distanceTo(b), 8), new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5 }));
    g.position.copy(a).add(b).multiplyScalar(0.5);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.visible = false;
    world.scene.add(g);
    return g;
  });

  ui.hud(`
    <div id="ex-panel" class="glass">
      <div class="row"><b>Mode</b><span id="nc-mode">Route</span></div>
      <div class="row"><b>Vitesse</b><span id="nc-speed">0 km/h</span></div>
      <div class="row"><b>Hauteur panier</b><span id="nc-h">0,0 m</span></div>
      <div class="row"><b>Distance caténaire</b><span id="nc-d">—</span></div>
      <div class="row"><b>Caténaire V1</b><span id="nc-live">SOUS TENSION</span></div>
      <div class="row"><b>Pendule</b><span id="nc-task">à remplacer</span></div>
      <div id="ex-lights"><span data-l="engine">MOTEUR</span><span data-l="brake">FREIN</span><span data-l="rail">RAIL</span><span data-l="stab">CALAGE</span><span data-l="malt">MALT</span><span data-l="danger">DANGER 3 m</span></div>
      <div id="nc-progress" hidden><div></div></div>
    </div>
    <div id="ex-align" class="glass" hidden><b>Aide à l'enraillement</b><div>Décalage <span id="al-lat">—</span></div><div>Angle <span id="al-yaw">—</span></div><div id="al-ok"></div></div>`);
  ui.actions([["m", "Moteur"], ["v", "Enrailler"], ["b", "Frein"], ["x", "Stabilisateurs"], ["r", "Radio"], ["u", "VAT"], ["g", "MALT"], ["e", "Intervenir"]]);
  ui.joysticks(true);
  const $ = (id) => document.getElementById(id);
  let camMode = "follow";
  const tmp = new THREE.Vector3();

  function wireDistance(p) {
    const q = project(p.x, p.z, 30);
    const cy = trackY(q.s) + CONTACT_Y;
    const my = trackY(q.s) + messengerY(q.s);
    const cl = contactLat(q.s, TRACK_LAT);
    const dc = Math.hypot(q.lat - cl, p.y - cy);
    const dm = Math.hypot(q.lat - TRACK_LAT, p.y - my);
    const dy = p.y > cy && p.y < my && Math.abs(q.lat - TRACK_LAT) < 0.3 ? 0 : Infinity;
    return Math.min(dc, dm, dy);
  }

  return {
    def: NAC_JOB,
    mission: m,
    debug: { st, rr, nc },
    debugInfo() {
      const wp = nc.workPoint();
      return { d: +wp.distanceTo(dropperPt).toFixed(2), joints: Object.fromEntries(Object.entries(nc.joints).map(([k, v]) => [k, +v.toFixed(2)])), wp: wp.toArray().map((v) => +v.toFixed(1)), drop: dropperPt.toArray().map((v) => +v.toFixed(1)), stab: st.stab, brake: rr.brake, malt: st.malt, live: st.live };
    },
    cams: ["follow", "basket", "orbit", "cab"],
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
        if (rr.brake && st.stab > 0) ui.toast("Rentre les stabilisateurs avant de desserrer le frein", "info");
        else rr.brake = !rr.brake;
      }
      if (input.hit("v")) {
        if (rr.mode === "rail") rr.startDerail();
        else if (!st.engine) ui.toast("Démarre le moteur (M)", "info");
        else if (rr.canEnrail(ENRAIL)) rr.startEnrail();
        else ui.toast("Enraillement impossible : sur la rampe, aligné sur la voie 1, à l'arrêt", "info");
      }
      if (rr.mode === "rail" && m.is("enrail")) m.done("enrail");
      const q = project(rr.x, rr.z, 30);
      if (m.is("position") && rr.mode === "rail" && Math.abs(q.s - dS) < 3 && rr.kmh < 0.3) m.done("position");
      if (input.hit("x")) {
        if (!rr.brake) ui.toast("Serre le frein (B) avant de caler l'engin", "info");
        else if (!nc.isTransport()) ui.toast("Panier hors position transport : redescends avant de rentrer les stabilisateurs", "info");
        else st.stabDir = st.stab > 0.5 ? -1 : 1;
      }
      if (st.stabDir) {
        st.stab = Math.min(1, Math.max(0, st.stab + st.stabDir * dt / 4));
        nc.setStab(st.stab);
        if (st.stab >= 1 || st.stab <= 0) st.stabDir = 0;
      }
      if (st.stab >= 1 && rr.brake && m.is("calage")) m.done("calage");
      // Radio : consignation / restitution
      if (input.hit("r")) {
        if (!st.live && st.restitAt === null && m.passed("pendule")) {
          if (st.malt) {
            ui.radio("Régulateur", "Refus : perches de mise à la terre encore en place. Levez-les avant la restitution.");
            m.penalize("restit-malt", 10, "Demande de restitution avec la mise à la terre posée");
          } else if (!nc.isTransport()) {
            ui.radio("Régulateur", "Refus : confirmez d'abord le dégagement du personnel et de l'engin.");
          } else {
            ui.radio("Vous", "Travaux terminés, personnel et engin dégagés. Je restitue la caténaire voie 1.");
            st.restitAt = m.st.t + 4;
          }
        } else if (st.live && st.consignAt === null && m.passed("calage")) {
          ui.radio("Vous", "Demande de consignation de la caténaire voie 1, entre les supports 1-018 et 1-019, pour remplacement d'un pendule.");
          st.consignAt = m.st.t + 6;
        } else if (st.live && st.consignAt === null) ui.radio("Régulateur", "Calez d'abord votre engin, puis rappelez.");
      }
      if (st.consignAt !== null && m.st.t > st.consignAt && st.live) {
        st.live = false;
        st.consignAt = null;
        ui.radio("Régulateur", "Consignation accordée : caténaire voie 1 hors tension. Avis n° 2718. Procédez à la VAT et à la mise à la terre.");
        m.done("consign");
      }
      if (st.restitAt !== null && m.st.t > st.restitAt) {
        st.live = true;
        st.restitAt = null;
        ui.radio("Régulateur", "Restitution enregistrée : caténaire voie 1 remise sous tension.");
        m.done("restit");
      }
      if (input.hit("u")) {
        if (st.live) {
          ui.toast("VAT : présence de tension ! Ne pas intervenir.", "penalty");
          m.penalize("vat-live", 10, "VAT réalisée sans consignation accordée");
        } else {
          st.vat = true;
          ui.toast("Vérification d'absence de tension : OK", "good");
          m.done("vat");
        }
      }
      if (input.hit("g")) {
        if (!st.malt) {
          if (st.live) m.fail("Pose de perches sur une caténaire sous tension : danger d'électrisation.");
          else if (!st.vat) {
            m.penalize("malt-vat", 20, "Mise à la terre sans vérification d'absence de tension");
            st.malt = true;
          } else st.malt = true;
          if (st.malt && m.is("malt")) m.done("malt");
        } else if (!nc.isTransport()) ui.toast("Redescends le panier avant de lever les perches", "info");
        else {
          st.malt = false;
          if (m.is("levee")) m.done("levee");
        }
        for (const p of poles) p.visible = st.malt;
      }
      // Commandes
      const drive = { throttle: 0, steer: 0 };
      const cmd = {};
      const canBoom = st.stab >= 1 && rr.brake;
      if (st.engine) {
        if (!canBoom) {
          drive.throttle = input.axis(["ArrowDown", "s"], ["ArrowUp", "w"], "R", "y");
          drive.steer = rr.mode === "road" ? -input.axis(["ArrowLeft", "a"], ["ArrowRight", "d"], "L", "x") : 0;
          if (st.stab > 0 && Math.abs(drive.throttle) > 0.1) {
            drive.throttle = 0;
            ui.toast("Engin calé : déplacement impossible", "info");
          }
        } else {
          cmd.slew = -input.axis(["a"], ["d"], "L", "x");
          cmd.lower = input.axis(["s"], ["w"], "L", "y");
          cmd.upper = input.axis(["k", "ArrowDown"], ["i", "ArrowUp"], "R", "y");
        }
      }
      // Distance de sécurité : bloque toute approche < 3 m tant que la caténaire n'est pas à la terre
      const prev = { ...nc.joints };
      nc.move(dt, cmd);
      const wp = nc.workPoint();
      const dist = wireDistance(wp);
      const protectedLine = !st.live && st.malt;
      const raised = !nc.isTransport();
      if (!protectedLine && raised && dist < SAFE) {
        if (dist < 0.6) m.fail("Électrisation : approche d'une caténaire non mise à la terre.");
        m.penalize("3m", 25, "Distance de sécurité de 3 m non respectée (caténaire non protégée)");
        Object.assign(nc.joints, prev);
        nc.move(0, {});
        if (Math.floor(m.st.t * 4) % 2 === 0) audio.beep(1500, 0.06, 0.08);
      }
      rr.update(dt, drive);
      nc.update();
      // Intervention sur le pendule
      const near = wp.distanceTo(dropperPt) < 1.6; // bras + outil depuis le panier
      if (m.is("pendule") && near && input.down("e")) {
        st.repair += dt;
        if (st.repair > 4) {
          st.replaced = true;
          dropper.material.color.set(0xb87333);
          dropper.material.emissiveIntensity = 0;
          m.done("pendule");
          audio.beep(1046, 0.2);
        }
      } else if (!st.replaced) st.repair = Math.max(0, st.repair - dt);
      $("nc-progress").hidden = !(m.is("pendule") && near);
      $("nc-progress").firstElementChild.style.width = `${Math.min(100, (st.repair / 4) * 100)}%`;
      if (m.is("descente") && nc.isTransport()) m.done("descente");
      if (m.is("rangement") && st.stab <= 0 && !rr.brake) m.done("rangement");
      for (const b of nc.beacons) b.material.emissiveIntensity = st.engine ? (Math.sin(m.st.t * 12) > 0 ? 6 : 0.2) : 0;
      const hyd = Object.values(cmd).reduce((a, v) => a + Math.abs(v || 0), 0);
      audio.machine(st.engine ? 0.35 + 0.4 * Math.min(1, Math.abs(rr.v) / 5 + hyd * 0.3) : 0, hyd / 2, Math.abs(rr.v));
      // Interface
      $("nc-mode").textContent = `${rr.mode === "rail" ? "Rail" : rr.mode === "road" ? "Route" : "Enraillement…"} · ${canBoom ? "Travail" : "Translation"}`;
      $("nc-speed").textContent = `${rr.kmh.toFixed(1)} km/h`;
      const bp = nc.basketPos();
      $("nc-h").textContent = `${(bp.y - trackY(project(bp.x, bp.z, 30).s) - 0.36).toFixed(1)} m`;
      $("nc-d").textContent = `${dist.toFixed(1)} m`;
      $("nc-d").className = !protectedLine && raised && dist < SAFE + 1 ? "red" : "";
      $("nc-live").textContent = st.live ? "SOUS TENSION" : st.malt ? "CONSIGNÉE · À LA TERRE" : "CONSIGNÉE";
      $("nc-live").className = st.live ? "red" : st.malt ? "green" : "yellow";
      $("nc-task").textContent = st.replaced ? "remplacé ✔" : "à remplacer";
      const L = { engine: st.engine, brake: rr.brake, rail: rr.mode === "rail", stab: st.stab >= 1, malt: st.malt, danger: !protectedLine && raised && dist < SAFE + 1 };
      for (const el of document.querySelectorAll("#ex-lights span")) el.classList.toggle("on", !!L[el.dataset.l]);
      const al = rr.railAlignment();
      const nearRamp = rr.mode === "road" && al.s > ENRAIL.s - ENRAIL.half - 15 && al.s < ENRAIL.s + ENRAIL.half + 15 && Math.abs(al.lateral) < 12;
      $("ex-align").hidden = !nearRamp;
      if (nearRamp) {
        $("al-lat").textContent = `${al.lateral > 0 ? "→" : "←"} ${Math.abs(al.lateral).toFixed(2)} m`;
        $("al-yaw").textContent = `${((al.yawErr * 180) / Math.PI).toFixed(1)}°`;
        $("al-ok").textContent = rr.canEnrail(ENRAIL) ? "✔ Prêt : appuie sur V" : "Tolérance : 0,35 m et 4,5°";
      }
      const tips = {
        moteur: "Démarre le moteur (M).",
        enrail: "Rejoins la rampe du point d'enraillement, aligne-toi sur la voie 1 et enraille (V).",
        position: `Avance jusqu'au pendule orange (${Math.max(0, Math.round(dS - q.s))} m) et arrête-toi à sa hauteur.`,
        calage: rr.brake ? "Sors les stabilisateurs (X)." : "Serre le frein (B).",
        consign: st.consignAt ? "Attends l'accord du régulateur…" : "Appelle le régulateur (R) pour demander la consignation.",
        vat: "Vérifie l'absence de tension (U).",
        malt: "Pose les perches de mise à la terre (G).",
        pendule: near ? "Maintiens E pour remplacer le pendule." : "Monte le panier jusqu'au pendule orange (W/S, I/K, A/D).",
        descente: "Redescends le panier en position transport (S, K).",
        levee: "Lève les perches de mise à la terre (G).",
        restit: "Restitue la ligne au régulateur (R).",
        rangement: "Rentre les stabilisateurs (X), puis desserre le frein (B).",
      };
      const t = tips[m.current?.id];
      ui.tip(ctx.guided && t ? { tone: !protectedLine && raised && dist < SAFE + 1 ? "red" : "blue", text: t } : null);
      void frame;
    },
    camera(dt, rig) {
      if (camMode === "basket") {
        const bp = nc.basketPos();
        camera.position.copy(bp).add(new THREE.Vector3(0, 1.7, 0));
        const dir = dropperPt.clone().sub(camera.position).normalize();
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.look.yaw);
        dir.y += rig.look.pitch;
        camera.lookAt(tmp.copy(camera.position).add(dir));
        camera.fov = 70;
      } else if (camMode === "cab") {
        nc.root.updateMatrixWorld(true);
        camera.position.copy(nc.cab.localToWorld(new THREE.Vector3(-0.5, 1.6, -0.2)));
        const dir = new THREE.Vector3(0, -0.1, -1).applyQuaternion(nc.root.quaternion);
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rig.look.yaw);
        dir.y += rig.look.pitch;
        camera.lookAt(tmp.copy(camera.position).add(dir));
        camera.fov = 70;
      } else if (camMode === "follow") {
        const back = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rr.yaw);
        const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rr.yaw);
        const want = nc.root.position.clone().addScaledVector(back, 14).addScaledVector(side, -7).add(new THREE.Vector3(0, 7, 0));
        camera.position.lerp(want, 1 - Math.exp(-dt * 3));
        camera.lookAt(nc.basketPos().lerp(nc.root.position, 0.5));
        camera.fov = 55;
      } else rig.orbit(nc.root.position.clone().add(new THREE.Vector3(0, 3, 0)));
    },
    result() {
      return {
        lessons: [
          ["Calage", "Avant toute élévation : frein serré et stabilisateurs sortis."],
          ["Consignation", "La caténaire est mise hors tension par le régulateur, sur demande, avec un numéro d'avis."],
          ["VAT puis MALT", "On vérifie l'absence de tension avant de poser les perches de mise à la terre, jamais l'inverse."],
          ["3 mètres", "Tant que la ligne n'est pas protégée, aucune approche à moins de 3 m d'une pièce sous tension."],
          ["Restitution", "Perches levées, personnel dégagé, puis restitution : la ligne peut être remise sous tension."],
        ],
        extra: st.replaced ? "Pendule remplacé" : "Pendule non remplacé",
      };
    },
    exit() {
      world.scene.remove(dropper, ...poles);
      audio.silence();
    },
  };
}
