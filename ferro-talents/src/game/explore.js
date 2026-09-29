// Exploration à pied : zone dangereuse matérialisée (1,50 m du rail extérieur), circulations réelles
// sur la voie 2 annoncées par l'annonceur, détection de l'agent dans la zone au passage du train.
import * as THREE from "three";
import { sweep, project, lineLength } from "../world/line.js";
import { TRACK_LAT, OTHER_LAT, RAIL_HALF } from "../world/track.js";
import { STATION } from "../world/depot.js";
import { CAR } from "../vehicles/train.js";

export const DANGER = { margin: 1.5, lat: OTHER_LAT + RAIL_HALF + 1.5 }; // |lat| < 4,35 m
export const PASS = { every: 70, first: 30, speed: 27, announce: 900 }; // s, s, m/s (≈ 100 km/h), m

/** Vrai si le point (lat, s) est dans la zone dangereuse (le quai hors bord n'en fait pas partie). */
export function inDanger(q) {
  if (!(q.d < 30) || Math.abs(q.lat) >= DANGER.lat) return false;
  const onPlatform = q.s > STATION.from && q.s < STATION.to && q.lat < TRACK_LAT - RAIL_HALF - 0.9;
  return !onPlatform;
}

export function createExplore({ world, ui, audio }) {
  // Ruban rouge au sol + bordures plus marquées
  const fill = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const edge = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
  const L = DANGER.lat;
  const zone = new THREE.Group();
  const len = lineLength();
  const s0 = 0;
  const s1 = len;
  zone.add(new THREE.Mesh(sweep({ s0, s1, step: 3, profile: [[-L, 0.02], [-4.05, 0.2], [4.05, 0.2], [L, 0.02]] }), fill));
  for (const sd of [-1, 1]) {
    const a = sd * L;
    zone.add(new THREE.Mesh(sweep({ s0, s1, step: 3, profile: [[a - 0.09, 0.04], [a + 0.09, 0.04]] }), edge));
  }
  zone.traverse((o) => (o.renderOrder = 4));
  zone.visible = false;
  world.scene.add(zone);

  const st = { t: 0, next: PASS.first, trainS: null, announced: false, inZone: false, intrusions: 0, caught: false, highlight: 0 };
  const trainLen = 2 * CAR + 1;

  return {
    zone,
    st,
    reset() {
      Object.assign(st, { t: 0, next: PASS.first, trainS: null, announced: false, inZone: false, caught: false, honked: false });
      world.other.visible = false;
    },
    /** Met la zone en évidence (accueil sécurité). */
    highlight(on) {
      st.highlight = on ? 1 : 0;
    },
    update(dt, pos, active) {
      st.t += dt;
      const q = project(pos.x, pos.z, 60);
      const near = q.d < 40;
      zone.visible = st.highlight > 0 || (active && near);
      fill.opacity = st.highlight ? 0.3 + 0.12 * Math.sin(st.t * 5) : st.inZone ? 0.3 : 0.14;
      if (!active) return { q, inZone: false };
      // Circulation sur la voie 2 (sens inverse de la voie 1), centrée sur la position de l'agent
      if (st.trainS === null && st.t > st.next) {
        st.trainS = Math.min(len - 20, Math.max(q.s, 0) + PASS.announce + 400);
        st.announced = false;
      }
      let trainNear = false;
      if (st.trainS !== null) {
        st.trainS -= PASS.speed * dt;
        world.other.visible = true;
        world.other.updateReverse(st.trainS, OTHER_LAT);
        const ds = st.trainS - q.s; // distance du nez à l'agent
        if (!st.announced && ds < PASS.announce) {
          st.announced = true;
          ui.radio("Annonceur", "Circulation voie 2 ! Dégagement immédiat de la zone dangereuse.");
          for (let i = 0; i < 3; i++) setTimeout(() => audio.beep(2600, 0.35, 0.09, "sine"), i * 450);
        }
        trainNear = ds < 450 && ds > -trainLen;
        if (trainNear && st.inZone && !st.honked) {
          st.honked = true;
          audio.horn(1.4);
        }
        if (ds < 6 && ds > -trainLen && st.inZone && Math.abs(q.lat - OTHER_LAT) < 6) st.caught = true;
        if (st.trainS < q.s - trainLen - 800 || st.trainS < 0) {
          st.trainS = null;
          st.honked = false;
          st.next = st.t + PASS.every;
          world.other.visible = false;
        }
      }
      const inZone = inDanger(q);
      if (inZone && !st.inZone) {
        st.intrusions++;
        audio.beep(520, 0.25, 0.12);
      }
      st.inZone = inZone;
      return { q, inZone, trainNear, announced: st.announced && st.trainS !== null };
    },
    exit() {
      world.other.visible = false;
      zone.visible = false;
      st.trainS = null;
    },
  };
}
