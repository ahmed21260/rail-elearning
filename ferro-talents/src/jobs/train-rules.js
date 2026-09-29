// Règles du métier conducteur de train (ligne de la vallée de la Bruche) : signaux, logique d'ouverture, règles, conseils, score.
// Règles simplifiées à but pédagogique (voir mention dans l'interface).
import { STATION } from "../world/depot.js";

export const LIMIT_LINE = 120; // km/h : ligne de montagne
export const LIMIT_STATION = 60;
export const STATION_ZONE = 4950; // début de la limitation gare
/** Limitation temporaire de vitesse (chantier) : panneaux TIV à distance, R de reprise. */
export const TIV = { from: 820, to: 1020, limit: 40 };
export const TRAIN_START = 150;

// ~1,1 km entre chaque avertissement et son signal d'arrêt : distance de freinage réaliste.
export const SIGNALS = [
  { id: "A1", s: 1500, type: "avert", label: "A 15", guards: "C1" },
  { id: "C1", s: 2600, type: "carre", label: "C 26" },
  { id: "A2", s: 3250, type: "avert", label: "A 32", guards: "S2" },
  { id: "S2", s: 4350, type: "sema", label: "S 43" },
  { id: "A3", s: 4470, type: "avert", label: "A 44", guards: "C3" },
  { id: "C3", s: 5570, type: "carre", label: "C 55" },
];

export const TYPE_NAME = { avert: "Avertissement", carre: "Carré", sema: "Sémaphore" };

const kmh = (v) => v * 3.6;
const DECEL_CURVE = 0.55; // m/s² : courbe de contrôle de vitesse vers un signal fermé

export function createScenario({ guided }) {
  const sig = Object.fromEntries(SIGNALS.map((d) => [d.id, { ...d, open: false, openAt: null, stoppedFor: 0, passed: false }]));
  const st = {
    guided,
    score: 100,
    penalties: [],
    events: [],
    status: "running", // running | failed | success
    failReason: null,
    armed: new Set(), // contrôles de vitesse armés (avertissement franchi)
    overspeedFor: 0,
    overspeedPenalized: new Set(),
    kvbTrips: 0,
    emergency: false,
    stationStopFor: 0,
    t: 0,
    maxKmh: 0,
  };

  const penalize = (code, pts, text) => {
    st.score = Math.max(0, st.score - pts);
    st.penalties.push({ code, pts, text, t: st.t });
    st.events.push({ kind: "penalty", text: `−${pts} · ${text}` });
  };

  /** Aspect courant d'un signal → intensités des feux. */
  function lamps(id) {
    const s = sig[id];
    if (s.type === "avert") return sig[s.guards].open ? { green: 1 } : { yellow: 1 };
    if (s.type === "carre") return s.open ? { green: 1 } : { red: 1, red2: 1 };
    return s.open ? { green: 1 } : { red: 1 };
  }
  const closed = (id) => sig[id].type !== "avert" && !sig[id].open;

  function aspectText(id) {
    const s = sig[id];
    if (s.type === "avert") return sig[s.guards].open ? "Feu vert · voie libre" : "Feu jaune · arrêt annoncé";
    if (!s.open) return s.type === "carre" ? "2 feux rouges · arrêt absolu" : "Feu rouge · arrêt";
    return "Feu vert · voie libre";
  }

  function nextSignal(sF) {
    return SIGNALS.find((d) => d.s > sF - 0.5) || null;
  }

  /** Vitesse autorisée par la courbe de contrôle (m/s), ou null si aucun contrôle armé. */
  function curveLimit(sF) {
    let lim = null;
    for (const id of st.armed) {
      if (!closed(id)) continue;
      const d = sig[id].s - sF - 5;
      const v = Math.sqrt(2 * DECEL_CURVE * Math.max(d, 0)) + 10 / 3.6;
      lim = lim === null ? v : Math.min(lim, v);
    }
    return lim;
  }

  const speedLimit = (sF) => (sF > STATION_ZONE ? LIMIT_STATION : sF > TIV.from && sF - 50 < TIV.to ? TIV.limit : LIMIT_LINE);

  /** Avance la logique d'un pas. Retourne { emergency } imposé par les règles. */
  function update(dt, sPrev, sF, v) {
    if (st.status !== "running") return;
    st.t += dt;
    st.maxKmh = Math.max(st.maxKmh, kmh(v));

    for (const d of SIGNALS) {
      const s = sig[d.id];
      // Franchissement
      if (!s.passed && sPrev < d.s && sF >= d.s) {
        s.passed = true;
        if (d.type === "avert") {
          if (!sig[d.guards].open) st.armed.add(d.guards);
          st.events.push({ kind: "info", text: `${TYPE_NAME[d.type]} ${d.label} franchi : ${aspectText(d.id).split(" · ")[0].toLowerCase()}` });
        } else if (!s.open) {
          st.status = "failed";
          st.failReason = `Franchissement du ${TYPE_NAME[d.type].toLowerCase()} ${d.label} fermé. Un signal d'arrêt fermé ne se franchit jamais sans autorisation.`;
          st.score = 0;
          st.emergency = true;
          return;
        } else {
          st.armed.delete(d.id);
        }
      }
      // Ouverture des signaux d'arrêt
      if (d.type === "avert" || s.open) continue;
      const dist = d.s - sF;
      if (v < 0.05 && dist > 0 && dist < 150) s.stoppedFor += dt;
      else s.stoppedFor = 0;
      if (s.openAt === null) {
        if (d.id === "C1" && s.stoppedFor > 3) s.openAt = st.t + 1.5;
        if (d.id === "S2") {
          if (s.stoppedFor > 4) s.openAt = st.t + 1.5;
          // Récompense l'anticipation : canton libéré si l'approche est prudente
          else if (st.armed.has("S2") && dist < 300 && kmh(v) <= 50) s.openAt = st.t + 3;
        }
      }
      if (s.openAt !== null && st.t >= s.openAt) {
        s.open = true;
        st.armed.delete(d.id);
        st.events.push({ kind: "good", text: `${TYPE_NAME[d.type]} ${d.label} ouvert : voie libre` });
      }
    }

    // Contrôle de vitesse (type KVB) vers les signaux fermés
    const lim = curveLimit(sF);
    if (lim !== null && v > lim + 15 / 3.6 && !st.emergency) {
      st.emergency = true;
      st.kvbTrips++;
      penalize("kvb", 20, "Contrôle de vitesse : freinage d'urgence déclenché");
    }

    // Vitesse limite de ligne
    const L = speedLimit(sF);
    if (kmh(v) > L + 10) st.overspeedFor += dt;
    else st.overspeedFor = 0;
    const zone = sF > STATION_ZONE ? "gare" : sF > TIV.from && sF - 50 < TIV.to ? "tiv" : "ligne";
    if (st.overspeedFor > 2 && !st.overspeedPenalized.has(zone)) {
      st.overspeedPenalized.add(zone);
      penalize("overspeed", 10, `Survitesse (limite ${L} km/h)`);
    }

    // Arrêt en gare au repère T
    const off = STATION.stopMark - sF;
    if (v < 0.05 && off > -3 && off < 8) st.stationStopFor += dt;
    else st.stationStopFor = 0;
    if (st.stationStopFor > 2) {
      st.status = "success";
      st.events.push({ kind: "good", text: "Arrêt en gare réussi au repère" });
    }
    if (st.emergency && v < 0.05 && st.status === "running") st.emergency = false;
  }

  /** Conseil contextuel (mode guidé). */
  function tip(sF, v, lever) {
    if (!st.guided || st.status !== "running") return null;
    const k = kmh(v);
    const n = nextSignal(sF);
    const d = n ? n.s - sF : Infinity;
    if (st.emergency) return { tone: "red", text: "Freinage d'urgence en cours. Attendez l'arrêt complet, puis remettez le manipulateur au neutre." };
    if (sF < TRAIN_START + 20 && k < 5) return { tone: "blue", text: "Poussez le manipulateur vers l'avant (↑ ou bouton TRACTION) pour démarrer." };
    const lim = curveLimit(sF);
    if (lim !== null && v > lim) return { tone: "orange", text: "Trop vite pour vous arrêter avant le signal : freinez davantage (↓)." };
    if (n && closed(n.id) && d < 160 && k < 1) {
      return { tone: "red", text: `Arrêté devant le ${TYPE_NAME[n.type].toLowerCase()} fermé : attendez son ouverture.` };
    }
    if (n && closed(n.id) && d < 400) return { tone: "red", text: `${TYPE_NAME[n.type]} fermé à ${Math.round(d)} m : arrêtez-vous avant le signal.` };
    if (n && n.type === "avert" && !sig[n.guards].open && d < 500) {
      return { tone: "yellow", text: "Feu jaune en vue : un signal d'arrêt suit. Préparez-vous à freiner." };
    }
    if (st.armed.size && [...st.armed].some(closed)) return { tone: "yellow", text: "Avertissement franchi : réduisez la vitesse, arrêt au prochain signal." };
    const offStop = STATION.stopMark - sF;
    if (sF > STATION.from - 350 && offStop > 8) {
      if (k < 1 && sF > STATION.from) return { tone: "blue", text: `Avancez jusqu'au repère T (encore ${Math.round(offStop)} m).` };
      return { tone: "blue", text: `Gare de Valbruche : arrêtez la tête du train au repère T (${Math.round(offStop)} m).` };
    }
    const toTiv = TIV.from - sF;
    if (toTiv > 0 && toTiv < 700 && k > TIV.limit + 3) return { tone: "orange", text: `Limitation temporaire ${TIV.limit} km/h (chantier) dans ${Math.round(toTiv)} m : ralentissez.` };
    if (sF > TIV.from && sF - 50 < TIV.to && k > TIV.limit + 3) return { tone: "orange", text: `Zone de chantier : ${TIV.limit} km/h maximum jusqu'au panneau de reprise.` };
    const toZone = STATION_ZONE - sF;
    if (toZone > 0 && toZone < 900 && k > LIMIT_STATION + 3) return { tone: "orange", text: `Limitation ${LIMIT_STATION} km/h dans ${Math.round(toZone)} m : ralentissez dès maintenant.` };
    if (k > speedLimit(sF) + 3) return { tone: "orange", text: `Limite ${speedLimit(sF)} km/h : réduisez la vitesse.` };
    if (n && sig[n.id].open && d < 300 && k < 20) return { tone: "green", text: "Voie libre : reprenez la marche (↑)." };
    if (k < speedLimit(sF) - 30 && lever <= 0.05) return { tone: "blue", text: `Voie libre : accélérez jusqu'à ${speedLimit(sF)} km/h maximum.` };
    return null;
  }

  return { st, sig, lamps, aspectText, nextSignal, curveLimit, speedLimit, closed, update, tip };
}
