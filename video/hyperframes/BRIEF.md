# BRIEF — « Lire la signalisation : Avertissement → Carré → Voie libre »

> Étape 1 de la boucle (voir `../LOOP.md`). Ce fichier est le prompt de référence :
> toute création et tout audit se jugent par rapport à lui.

## Objectif pédagogique

Un nouvel opérateur doit comprendre **en situation réelle** la chaîne logique :
feu jaune (avertissement) ⇒ je freine ⇒ carré fermé (2 feux rouges) ⇒ arrêt absolu
avant le signal ⇒ le signal s'ouvre (vert) ⇒ je repars.

- Public : opérateurs en formation initiale. Durée : 48 s. Format 1920×1080, 30 i/s.
- Un seul message par plan. Texte à l'écran ≤ 14 mots par sous-titre.

## Direction artistique

- **Réaliste, pas illustratif** : scène 3D temps réel (three.js), éclairage par HDRI
  de ciel réel, textures PBR photographiques (ballast, herbe, béton, acier rouillé).
- Double voie électrifiée en rase campagne : ballast, traverses béton tous les 60 cm,
  rails UIC 60 à écartement 1 435 mm, attaches, caténaire (poteaux, consoles, fil de
  contact en zigzag), fossés, champs, haies, collines, lumière d'après-midi.
- Circulation à gauche (réseau français) ; signaux implantés à gauche de la voie.
- Train automoteur moderne générique (aucune marque réelle), pantographe levé.
- Interface « cockpit pédagogique » sobre : verre sombre, police Inter, couleurs de
  signalisation réservées à leur sens (rouge arrêt, jaune annonce, vert voie libre).

## Storyboard et images clés d'audit

| t | Plan | Caméra | Message à l'écran |
|---|---|---|---|
| 3 s | Ouverture aérienne : le train file dans la campagne | drone, descend vers le train | Titre « Lire la signalisation » |
| 9 s | Vue cabine, 137 km/h | cabine, légère vibration | « Surveillez les signaux à gauche de la voie. » |
| 13.5 s | L'avertissement apparaît : feu jaune | cabine, étiquette accrochée au signal | « Feu jaune : un signal d'arrêt est annoncé plus loin. » |
| 20 s | Freinage, le carré est en vue | cabine, compteur qui descend | « Freinez pour pouvoir vous arrêter avant le signal. » |
| 28 s | Train arrêté devant le carré fermé | orbite extérieure autour du signal | « Carré : arrêt absolu. Ne jamais le franchir sans autorisation. » |
| 36.5 s | Le carré s'ouvre : feu vert | cabine | « Feu vert : voie libre, le train peut repartir. » |
| 41 s | Redémarrage, passage du signal | cabine | compteur qui remonte |
| 46 s | Récapitulatif | grue qui s'élève | 3 cartes « À retenir » + mention réglementaire |

## Critères d'acceptation (utilisés par l'audit)

1. Aucune image ne doit ressembler à un schéma 2D : profondeur, ombres, brume, textures.
2. Les aspects des signaux sont corrects à chaque instant (jaune / 2 rouges / vert).
3. Le train s'arrête **avant** le carré ; il ne le franchit qu'après l'ouverture.
4. La vitesse affichée correspond au mouvement (137 km/h → 0 → reprise).
5. Tout texte : contraste ≥ 4.5:1, ≥ 28 px, jamais masqué par la 3D.
6. `hyperframes check` sans erreur.
7. Mention finale : « Support pédagogique simplifié, distances raccourcies. Seuls les
   référentiels réglementaires en vigueur font foi. »
