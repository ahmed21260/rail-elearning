// Scénario : cinématique du train, plans caméra, sous-titres. Tout dépend du temps t (s).
export const DURATION = 48;
export const SIG = { avert: 600, carre: 830 };
export const OPEN_T = 35.2; // ouverture du carré
const V0 = 38; // m/s ≈ 137 km/h
const BRAKE_T0 = 17;
const BRAKE_DUR = 8;
const DEP_T = 37;
const ACC = 1.2;
const S_BRAKE = V0 * BRAKE_T0;
export const S_STOP = S_BRAKE + (V0 * BRAKE_DUR) / 2; // 798 m, 32 m avant le carré

export function trainS(t) {
  if (t <= BRAKE_T0) return V0 * t;
  if (t <= BRAKE_T0 + BRAKE_DUR) {
    const u = t - BRAKE_T0;
    return S_BRAKE + V0 * u - (V0 / (2 * BRAKE_DUR)) * u * u;
  }
  if (t <= DEP_T) return S_STOP;
  const u = t - DEP_T;
  return S_STOP + 0.5 * ACC * u * u;
}

export function trainV(t) {
  if (t <= BRAKE_T0) return V0;
  if (t <= BRAKE_T0 + BRAKE_DUR) return V0 * (1 - (t - BRAKE_T0) / BRAKE_DUR);
  if (t <= DEP_T) return 0;
  return ACC * (t - DEP_T);
}

export const braking = (t) => t > BRAKE_T0 && t < BRAKE_T0 + BRAKE_DUR;

/** Train croiseur sur l'autre voie (sens inverse). */
export const otherS = (t) => 760 - 42 * t;

export const CUTS = [6.8, 25.4, 32.8, 43];
export function shotAt(t) {
  if (t < CUTS[0]) return "aerial";
  if (t < CUTS[1]) return "cab";
  if (t < CUTS[2]) return "orbit";
  if (t < CUTS[3]) return "cab";
  return "crane";
}

export const CHAPTERS = [
  [0, "Module 1 · Signalisation"],
  [6.8, "1 · En ligne"],
  [11.2, "2 · Avertissement"],
  [17, "3 · Freinage"],
  [25.4, "4 · Arrêt au carré"],
  [35.2, "5 · Voie libre"],
  [43, "À retenir"],
];

export const CAPTIONS = [
  [7.4, 11.0, "Vue cabine, 137 km/h. Surveillez les signaux, <b>à gauche de la voie</b>."],
  [11.4, 16.6, "<b class=y>Feu jaune</b> : l'avertissement annonce un signal d'arrêt plus loin."],
  [17.0, 25.0, "Freinez pour pouvoir <b>vous arrêter avant</b> le prochain signal."],
  [25.9, 32.5, "<b class=r>Carré fermé</b> : arrêt absolu. Ne jamais le franchir sans autorisation."],
  [33.3, 35.1, "Arrêté devant le carré : attendre l'ouverture du signal…"],
  [35.4, 40.8, "<b class=g>Feu vert</b> : voie libre, le train peut repartir."],
];

// Aspects des signaux (0 = éteint, 1 = allumé)
export function aspects(t) {
  const open = Math.min(Math.max((t - OPEN_T) / 0.25, 0), 1);
  return {
    avert: { yellow: 1 },
    carre: { red: 1 - open, red2: 1 - open, green: open },
  };
}
