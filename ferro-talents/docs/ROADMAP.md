# Ferro Talents : feuille de route des améliorations

## Fait (cette itération)
- **Pelle rail-route réaliste :** « Atek 4321 » (CC-BY) articulée sur la cinématique du jeu, avec :
  - peinture jaune sans logo ;
  - galets rail ;
  - limiteur de hauteur et gabarit calculés sur sa forme réelle.
- **Forêts réalistes :** sapin, épicéa, hêtre, bouleau. La bascule 3D ↔ imposteur se fait arbre par arbre.
- **Village et gare :** gare Saint-Rémy (vraie gare française), 18 maisons à colombages, avec les matériaux anciens convertis.
- **Caténaire française :** poteaux en treillis galvanisé, consoles tubulaires, isolateurs à ailettes.
- **Saturation GPU corrigée :**
  - 71 M → 11,8 M triangles actifs ;
  - 30 000 → 1 850 objets dessinés.

## En cours
- Validation finale (tests complets, audit), republication.

## Prochaine étape : vues « hologramme » et quiz immersifs
Idée : un rendu comme les visionneuses 3D, avec une transparence cyan façon rayons X, des contours lumineux et des
lignes de balayage. On l'utiliserait pour :
- **Quiz 3D :** la question s'affiche sur un hologramme de l'engin qui tourne lentement. La pièce concernée
  (godet, limiteur, galets, stabilisateurs, pantographe…) s'allume et clignote en couleur.
- **Éclaté pédagogique :** les pièces s'écartent pour montrer comment l'engin est construit. Ça marche déjà avec la pelle Atek, dont les pièces sont séparées.
- **Briefing :** avant la mission, un hologramme montre le chantier vu de dessus, avec :
  - la zone dangereuse ;
  - le gabarit de la voie 2 ;
  - la caténaire en rouge.
- **Bilan :** on rejoue la faute (flèche dans le gabarit, approche à moins de 3 m) en hologramme, au ralenti.

Faisable en three.js sans outil payant : un shader de Fresnel, un rendu additif et des lignes de balayage, appliqués à n'importe quel modèle GLB.

## Plus tard : modèles 3D sur mesure avec Tripo (abonnement)
- Tripo (https://www.tripo3d.ai) génère des modèles à partir de photos ou de rendus : M323F, nacelle rail-route, locotracteur, draisine.
- Limite : Tripo produit un seul bloc. Pour un engin **pilotable**, il faut séparer les pièces (tourelle, flèche, balancier, godet) :
  - dans Blender (voir `ASSET-SOURCES.md`) ;
  - ou en générant chaque pièce séparément.
- Les modèles Tripo conviennent tels quels pour :
  - les hologrammes des quiz ;
  - les engins garés dans le décor ;
  - les objets d'EPI (casque, gilet, VAT, perche de mise à la terre).

## Hébergement Vercel (proposé)
- Servir le jeu en statique sur Vercel (`ferro-talents.vercel.app`) :
  - les binaires (HDR, GLB) sont servis tels quels, sans conversion en base64 ;
  - pas de limite de 16 Mo par fichier ;
  - CDN mondial.
- Plus tard : une fonction serverless pour enregistrer les résultats `ferro-talents-result` (suivi formateur, LMS).
- Il faut un jeton Vercel, créé par le propriétaire du compte (vercel.com/account/tokens), puis supprimé après usage.

## Autres pistes
- Personnage Mixamo réaliste (visage, tenue SNCF-like sans logo) à la place du mannequin.
- Nacelle réaliste : chercher un modèle à bras articulés et pièces séparées sur Sketchfab, sinon Blender.
- Sons réels (Freesound CC0) : passage de train, sifflet d'annonceur, hydraulique.
- Mode formateur : suivi des résultats `postMessage` dans le LMS, tableau de bord des fautes.
