# ADR 0004 : vue de dessus en 3D par une seconde caméra (scissor)

- Statut : acceptée

## Contexte
L'ancienne vue de dessus de la pelle était un schéma SVG, jugé peu lisible (« revois la vue du dessus, qu'elle soit mieux en 3D »).

## Décision
- `core.inset = { el, cam }` : après le rendu principal, la scène est rendue une seconde fois dans le rectangle de l'élément HTML.
  - Technique : `setScissor` et `setViewport`.
  - Pas de brouillard.
  - Pas de recalcul des ombres (`shadowMap.autoUpdate = false`).
- Le gabarit de la voie 2 est un maillage sur le calque 1, visible uniquement par cette caméra.

## Conséquences
- Coût : environ 15 % d'une image en plus, limité par le cône étroit de la caméra (culling).
- L'élément HTML ne doit pas avoir de `backdrop-filter`, qui flouterait la vue.
