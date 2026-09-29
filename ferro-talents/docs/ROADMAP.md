# Ferro Talents : feuille de route des améliorations

## En cours
- Pelle rail-route réaliste : modèle Sketchfab CC-BY articulé sur la cinématique du jeu. Repeinte en jaune, sans logo, avec galets rail.
- Décor réaliste :
  - épicéas et hêtres ;
  - gare de Valbruche ;
  - maisons du village ;
  - conteneurs de la base travaux.
- Audit technique : saturation des couleurs, charge graphique, fuites mémoire (`tools/audit.mjs`).

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

## Autres pistes
- Personnage Mixamo réaliste (visage, tenue SNCF-like sans logo) à la place du mannequin.
- Nacelle réaliste : chercher un modèle à bras articulés et pièces séparées sur Sketchfab, sinon Blender.
- Sons réels (Freesound CC0) : passage de train, sifflet d'annonceur, hydraulique.
- Mode formateur : suivi des résultats `postMessage` dans le LMS, tableau de bord des fautes.
