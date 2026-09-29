# Ferro Talents

Jeu 3D de découverte des métiers du ferroviaire, dans le navigateur (three.js / WebGL).
Monde ouvert sur le **relief réel de la vallée de la Bruche** (Vosges) : on explore la
base travaux à pied, on monte dans un engin et on pratique le métier avec ses procédures.

## Lancer

```bash
python3 video/tools/fetch_assets.py --manifest ferro-talents/assets-manifest.json --dest ferro-talents/assets
python3 -m http.server -d ferro-talents 8080     # puis http://localhost:8080
```

Qualité : `?q=low` (mobile), `?q=high`, `?q=ultra` (occlusion ambiante).
Version web publiable : `python3 ferro-talents/tools/build_web.py` → `ferro-talents/dist/`.

## Parcours

1. **Arrivée immersive** : un travelling cinématique survole la vallée jusqu'à la base travaux.
2. **Accueil sécurité** avec Karim, le chef de chantier (personnage 3D animé). Il se déroule en trois temps :
   - choix des EPI obligatoires ;
   - présentation de la zone dangereuse, matérialisée au sol : 1,50 m du rail extérieur ;
   - règles de traversée et rôle de l'annonceur.
3. **Exploration à pied** :
   - un train passe réellement sur la voie 2 environ toutes les 70 s, annoncé à la radio et au sifflet ;
   - rester dans la zone dangereuse au passage du train arrête la partie et donne une explication.
4. **Briefing en trois étapes** avant chaque métier : la mission, les points sécurité (la règle et sa raison), puis un quiz. Il faut 2 bonnes réponses sur 3 pour prendre le poste.
5. **Bilan** : étoiles, fautes, leçons, quiz et fiche métier.

## Documentation

- `docs/SPEC.md` : exigences EARS et critères d'acceptation.
- `docs/adr/` : décisions d'architecture (moteur web, contenus pilotés par les données, machine à états, vue 3D incrustée).
- `docs/ASSET-SOURCES.md` : où trouver des assets gratuits (Fab/Megascans, Sketchfab, Mixamo, etc.) et comment me les transmettre.
- `src/safety/content.js` : tous les textes sécurité, EPI et quiz, modifiables sans toucher au moteur.

## Métiers

| Métier | Procédure et règles simulées |
|---|---|
| Conducteur·rice de train | Batterie → pantographe (25 kV) → disjoncteur (manipulateur au neutre), essai de freinage, VACMA toutes les 55 s, KVB après avertissement, limitation temporaire 40 km/h (panneaux Z / R), signaux A / C / S, arrêt au repère T, effet des rampes |
| Pelle rail-route | Moteur, enraillement au point prévu (aide d'alignement 0,35 m / 4,5°), 20 km/h sur rail et 10 km/h au chantier, frein de parc + mode travail, commandes ISO (2 manettes), limiteur de hauteur 5 m, gabarit de la voie 2 en circulation (annonce radio de l'agent de protection, collision = échec), contact caténaire = échec, 4 godets dans la benne, **vue de dessus 3D** avec gabarit rouge |
| Nacelle caténaire | Enraillement, arrêt au droit du support, frein + stabilisateurs (verrouillage des bras), consignation par radio, VAT, mise à la terre (perches), distance de 3 m bloquante, remplacement du pendule, restitution refusée si perches posées |

## Monde

- `tools/build_line.py` : tracé de la ligne par chemin de moindre coût sur le MNT
  (Terrarium AWS), lissé : rayon ≥ 1 800 m, rampe ≤ 18 ‰, remblais ≤ 4 m, déblais ≤ 8 m.
- Terrassements automatiques (talus 3/2, fossés), sol par occupation (prairies, champs,
  forêts de coteau), arbres procéduraux (écorce + feuilles scannées) avec vent et LOD,
  herbe dense, props Poly Haven.

## Tests

```bash
node ferro-talents/tools/test.mjs [captures] [--only=accueil,train,pelle,nacelle,look]
```

Pilotes automatiques (cinématique inverse pour les engins) : les trois missions réussissent
à 100/100 ; l'approche d'une caténaire sous tension est bloquée et sanctionnée.

Le résultat de chaque mission est envoyé à la page parente :
`postMessage({ type: "ferro-talents-result", job, status, score, penalties, time })`.

Simulation pédagogique simplifiée : seuls les référentiels réglementaires font foi.
Crédits des assets : `assets/ASSETS.md`.
