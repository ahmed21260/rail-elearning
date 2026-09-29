# Où trouver des assets gratuits pour améliorer Ferro Talents

Vérifie toujours la licence de chaque modèle avant de l'utiliser : CC0 (libre), CC-BY (créditer),
CC-BY-SA (créditer et partager dans les mêmes conditions), licences « Standard » propres à chaque site.
Le jeu lit le **glTF/GLB**. Pour un fichier FBX ou OBJ, ouvre-le dans Blender puis *Fichier › Exporter › glTF 2.0 (.glb)*.

## Réalistes (photogrammétrie, PBR)

| Site | Contenu | Licence | URL |
|---|---|---|---|
| Fab (Epic Games) | Megascans (sols, rochers, végétation), packs UE gratuits du mois | Gratuit avec un compte Epic, licence Fab Standard | https://www.fab.com/ (filtre « Free ») |
| Quixel Megascans | Désormais intégré à Fab | Idem | https://www.fab.com/sellers/Quixel |
| Poly Haven | HDRI, textures, modèles (déjà utilisé) | CC0 | https://polyhaven.com/ |
| ambientCG | Textures PBR (déjà utilisé) | CC0 | https://ambientcg.com/ |
| Sketchfab | Engins, trains, caténaire, personnages (filtre « Downloadable ») | CC0, CC-BY, CC-BY-SA | https://sketchfab.com/search?features=downloadable&type=models |
| BlenderKit | Modèles et matériaux dans Blender | Royalty Free, CC0 | https://www.blenderkit.com/ |
| CGTrader (gratuits) | Engins de chantier | Royalty Free | https://www.cgtrader.com/free-3d-models |
| TurboSquid (gratuits) | Véhicules | Licence TurboSquid | https://www.turbosquid.com/Search/3D-Models/free |

## Personnages et animations

| Site | Contenu | Licence | URL |
|---|---|---|---|
| Mixamo (Adobe) | Personnages squelettés et centaines d'animations (marche, geste, grimper) | Gratuit avec un compte Adobe, usage libre dans un projet | https://www.mixamo.com/ |
| Ready-made Mixamo glTF | Mannequin utilisé ici (Xbot) | Via les exemples three.js | https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf |
| MakeHuman | Humains réalistes paramétrables, export vers Blender | CC0 pour les exports | https://static.makehumancommunity.org/ |
| Quaternius | Personnages low-poly animés | CC0 | https://quaternius.com/ |
| Kenney | Packs low-poly (véhicules, décors, interface) | CC0 | https://kenney.nl/assets |
| OpenGameArt | Sons, textures, modèles | Variable | https://opengameart.org/ |

## Modèles Sketchfab repérés pour le jeu (à télécharger au format glTF)

| Pour | Modèle | Licence | URL |
|---|---|---|---|
| Pelle réaliste | Hitachi excavator | CC-BY | https://sketchfab.com/3d-models/3dde2c846cc54a4d9fabcc821c9b9caa |
| Pelle réaliste | Hyundai excavator | CC-BY | https://sketchfab.com/3d-models/a805e66f565a412682ac8ce45ab9ac3e |
| Nacelle | Telescopic boom lift | CC-BY | https://sketchfab.com/3d-models/ec5de80117434672912c5c0602f4a294 |
| Locomotive | Metrolink F59PH | CC-BY | https://sketchfab.com/3d-models/be80b30df3294bd2acee4f219b36d378 |
| Voie modulaire | Modular Railway Section (romullus) | CC-BY-SA | https://sketchfab.com/3d-models/abadc2cf19054ac4866f4288557faa98 |

## Pour me les transmettre
1. **Le plus simple : un jeton API Sketchfab.** Dans ton compte : *Settings › Password & API › API Token*.
   Donne-le moi dans la conversation. Je télécharge alors les modèles et je les intègre automatiquement.
   Ensuite, régénère le jeton pour l'invalider.
2. **Sinon :**
   - télécharge chaque modèle au format « glTF » ;
   - dépose les fichiers `.glb` ou `.gltf` dans `ferro-talents/assets/models/` ;
   - commite-les dans une branche.

   Il faut dans ce cas que la règle `.gitignore` qui exclut ce dossier soit levée pour ces fichiers.
3. **Mixamo** (personnage réaliste) :
   - choisis un personnage, par exemple un ouvrier ;
   - télécharge-le en FBX, *With Skin* ;
   - télécharge les animations « Idle », « Walking », « Running », « Talking » et « Nodding » en FBX, *Without Skin* ;
   - convertis le tout en GLB dans Blender.
