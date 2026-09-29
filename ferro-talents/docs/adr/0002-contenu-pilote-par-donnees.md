# ADR 0002 : contenus pédagogiques pilotés par les données

- Statut : acceptée

## Contexte
Les formateurs doivent pouvoir adapter les textes sécurité, les quiz et les EPI sans toucher au moteur.

## Décision
- Tout le contenu sécurité vit dans `src/safety/content.js` :
  - `PPE` : les équipements ;
  - `WELCOME` : le dialogue d'accueil ;
  - `SAFETY[metier].cards` et `SAFETY[metier].quiz` ;
  - `ON_FOOT` : les messages d'exploration à pied.
- Les paramètres de gameplay sont des constantes nommées, en tête de module :
  - `DANGER`, `PASS` ;
  - `HEIGHT_LIMIT`, `GAUGE_LAT` ;
  - `SIGNALS`, `TIV`.

## Conséquences
- Un fichier JSON équivalent pourra être chargé plus tard (par exemple depuis un LMS).
- Les tests vérifient les comportements (zone, quiz), pas les textes.
