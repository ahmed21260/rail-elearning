# ADR 0003 : machine à états du jeu

- Statut : acceptée

```
loading → hub ─┬─(1re fois)→ intro(cine → talk) → world
               ├────────────────────────────────→ world ⇄ caught
               └→ brief(mission → sécurité → quiz) → job → debrief → hub | brief | world
world ──(E près d'un engin)→ brief
```

## Décision
- `src/main.js` porte un unique `state`, et la boucle `loop()` distribue le travail selon cet état.
- Chaque sous-système expose `update(dt)` et `exit()` :
  - `game/intro.js` ;
  - `game/explore.js` ;
  - `jobs/*.js`.
- Les transitions sont des fonctions nommées :
  - `showHub` ;
  - `startIntro` ;
  - `enterWorld` ;
  - `showBrief` ;
  - `startJob` ;
  - `endJob`.

## Conséquences
- Les tests pilotent le jeu via `window.__ft` :
  - `startIntro`, `showBrief`, `startJob` ;
  - `explore`, `intro`, `store`.
- Chaque `exit()` doit libérer ce que son module a ajouté à la scène (maillages, vue incrustée, train voie 2).
