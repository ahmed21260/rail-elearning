# ADR 0001 : moteur web three.js plutôt qu'Unreal Engine

- Statut : acceptée
- Date : 2026-09-29

## Contexte
Il faut un rendu 3D réaliste pour un jeu de découverte des métiers. Le jeu doit pouvoir s'intégrer dans une
plateforme e-learning, s'ouvrir d'un clic sur PC comme sur mobile, et se tester automatiquement.

## Options
| Option | Pour | Contre |
|---|---|---|
| **three.js (WebGL2)** | Lien web direct, intégrable en iframe, mobile, testable sans GPU (Playwright), assets glTF | Rendu moins poussé qu'UE5 (pas de Lumen ni de Nanite) |
| Unreal Engine 5 + Pixel Streaming | Rendu photoréaliste, Megascans gratuits | Serveur GPU payant par joueur, pas de mode hors ligne, lourd à tester |
| Unreal Engine 5 en exécutable | Rendu maximal | Installation de plusieurs Go, pas de mobile ni d'iframe, compilation Windows |
| Unity WebGL | Éditeur visuel | Build lourd (> 30 Mo), mobile fragile |

## Décision
On garde three.js. On pousse le réalisme au maximum dans ce cadre :
- ciel HDRI ;
- relief réel ;
- textures PBR ;
- GTAO et bloom ;
- végétation instanciée avec LOD ;
- personnages squelettés.

La logique métier (règles, missions, contenus sécurité) reste indépendante du rendu, pour un portage
Unreal éventuel.

## Conséquences
- Les règles et les contenus (`src/jobs`, `src/safety`) pourront être réutilisés tels quels dans une version UE5.
- Il faut des assets au format glTF/GLB (Sketchfab, Poly Haven, Mixamo exportent ce format).
