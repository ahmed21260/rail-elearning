# Simulateur de conduite 3D — Rail E-Learning

Simulation temps réel dans le navigateur (three.js / WebGL) : l'apprenant **conduit**
un automoteur sur une ligne de 5,2 km et doit respecter la signalisation.

## Lancer

```bash
python3 video/tools/fetch_assets.py --dest simulator/assets   # assets CC0 (une fois)
npx serve simulator            # ou : python3 -m http.server -d simulator 8080
```

Ouvrir `http://localhost:8080`. PC (clavier) ou mobile (commandes tactiles).
`?q=low` force la qualité économique.

## Ce que l'apprenant fait

| Élément | Comportement |
|---|---|
| Manipulateur traction / frein | ↑/Z, ↓/S, N neutre, Espace urgence — ou glisser le curseur (tactile) |
| Avertissement (feu jaune) | Arme le contrôle de vitesse : courbe de freinage affichée (arc orange) |
| Carré C 19 (2 feux rouges) | S'ouvre 3 s après l'arrêt complet devant le signal |
| Sémaphore S 38 (1 feu rouge) | S'ouvre après l'arrêt, **ou plus tôt si l'approche est prudente** (≤ 50 km/h à 300 m) |
| Contrôle de vitesse (type KVB) | Dépassement de la courbe + 15 km/h → freinage d'urgence, −20 points |
| Franchissement d'un signal fermé | Mission échouée, explication |
| Limites 140 / 60 km/h | Survitesse > 10 km/h pendant 2 s → −10 points |
| Gare de Valmont | Arrêt de la tête au repère T (−3 m / +8 m) → mission réussie, bilan |

Modes **guidé** (conseils contextuels) et **examen** (sans conseils). Caméras cabine
(regard libre en glissant), extérieure et libre (orbite). Son synthétisé.
En fin de mission, le résultat est envoyé à la page parente
(`postMessage({ type: "rail-sim-result", status, score, penalties, time })`)
pour l'intégrer à la plateforme (iframe).

## Structure

| Chemin | Rôle |
|---|---|
| `engine/` | Moteur de scène : tracé, voie, caténaire, décor, train, signaux |
| `sim/scenario.js` | Signaux, règles, score, conseils |
| `sim/main.js` | Rendu, physique, caméras, commandes, interface |
| `sim/audio.js` | Sons synthétisés |
| `tools/test.mjs` | Tests : pilote automatique (prudent / imprudent) + captures |

```bash
node simulator/tools/test.mjs [dossier_captures]
```

Support pédagogique simplifié : seuls les référentiels réglementaires en vigueur font foi.
