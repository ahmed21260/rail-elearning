# Ferro Talents : spécification (méthode feature-forge, exigences EARS)

Jeu 3D de découverte des métiers du ferroviaire, jouable dans un navigateur (PC et mobile) et intégrable
dans une plateforme e-learning. L'apprenant arrive sur une base travaux et suit un accueil sécurité, puis
essaie trois métiers avec leurs vraies règles de sécurité.

## 1. Utilisateurs et objectifs

| Profil | Objectif | Mesure |
|---|---|---|
| Collégien, lycéen, demandeur d'emploi | Découvrir concrètement un métier | Termine au moins une mission |
| Formateur, conseiller orientation | Montrer les gestes et les règles | Résultat transmis par `postMessage` |
| Recruteur | Repérer l'appétence et le respect des règles | Score, fautes, quiz |

## 2. Exigences fonctionnelles (EARS)

### Arrivée et accueil sécurité
- **E1** Lors de la première exploration, le système doit jouer un travelling cinématique d'environ 18 s
  au-dessus de la vallée jusqu'à la base travaux, avec des sous-titres de contexte.
- **E2** Tant que la cinématique joue, lorsque l'apprenant clique sur « Passer » ou appuie sur Échap, le système doit
  passer directement à l'accueil.
- **E3** Le système doit présenter le chef de chantier sous la forme d'un personnage 3D animé qui
  s'adresse à l'agent, en plan par-dessus l'épaule.
- **E4** Lorsque l'apprenant valide sa tenue, si un EPI obligatoire manque ou si un objet interdit est choisi,
  le système doit refuser la validation, nommer chaque erreur et faire secouer la tête au chef de chantier.
- **E5** Lorsque le dialogue parle de la zone dangereuse, le système doit la mettre en évidence au sol (ruban
  rouge pulsé) et cadrer la voie.
- **E6** Une fois l'accueil terminé, le système doit le mémoriser et ne plus l'imposer (il reste possible de le rejouer depuis le hub).

### Exploration à pied
- **E7** Tant que l'agent se trouve à moins de 1,50 m du rail extérieur d'une voie (hors quai), le système
  doit afficher l'alerte « zone dangereuse » (vignette rouge et bandeau) et compter l'intrusion.
- **E8** Le système doit faire circuler un train sur la voie 2 environ toutes les 70 s. L'annonceur le signale
  à 900 m par radio et par trois coups de sifflet.
- **E9** Si l'agent est dans la zone dangereuse au passage du train, le système doit arrêter l'exploration,
  expliquer l'accident évité et replacer l'agent au point de rassemblement.
- **E10** Lorsque l'agent est à moins de 6 m d'un engin et appuie sur E, le système doit ouvrir le briefing de ce métier.

### Briefing et quiz
- **E11** Le briefing doit comporter trois étapes : la mission, les points sécurité (règle et raison) et le quiz.
- **E12** Tant que le quiz n'a pas obtenu au moins 2 bonnes réponses sur 3, le bouton « Prendre le poste » doit
  rester désactivé.
- **E13** Lorsqu'une réponse est choisie, le système doit montrer immédiatement la bonne réponse et son explication.
- **E14** Si le score est inférieur à 2/3, le système doit relancer le quiz après la correction.

### Métiers (existants, conservés)
- **E15** Conducteur de train : VACMA, courbe KVB, signaux (avertissement, carré, sémaphore), TIV avec panneaux Z et R, arrêt en gare.
- **E16** Pelle rail-route :
  - enraillement au point prévu (tolérances 0,35 m et 4,5°) ;
  - limiteur de hauteur qui porte sur toute la flèche ;
  - contact avec la caténaire = échec ;
  - gabarit de la voie 2 ;
  - annonce de circulation.
- **E17** Lorsque le métier pelle est actif, le système doit afficher une **vue de dessus en 3D** (seconde caméra),
  avec le gabarit de la voie 2 en rouge, qui clignote en cas d'engagement.
- **E18** Nacelle caténaire : stabilisateurs, règle des 3 m, consignation, VAT, MALT, remplacement du pendule.

### Bilan
- **E19** À la fin d'une mission, le système doit afficher les étoiles, le score, les fautes, les leçons, le résultat du quiz
  et la fiche métier, et doit envoyer `ferro-talents-result` au parent.

## 3. Exigences non fonctionnelles
- **N1** 60 images/s visées sur un PC équipé d'un GPU en qualité « Haute », et 30 images/s sur un mobile récent en « Économie ».
- **N2** Publication statique sans serveur (artefact web), sans binaire servi : base64 et GLB assemblé en mémoire.
- **N3** Contenus pédagogiques pilotés par les données (`src/safety/content.js`) et modifiables sans toucher au moteur.
- **N4** Assets gratuits sous licence vérifiée, crédités dans `assets/ASSETS.md` et téléchargeables via le manifeste.
- **N5** Accessibilité :
  - navigation au clavier, focus visible ;
  - `prefers-reduced-motion` respecté ;
  - textes en français clair.

## 4. Critères d'acceptation (automatisés dans `tools/test.mjs`)

| Id | Critère | Test |
|---|---|---|
| A1 | La cinématique démarre, puis le chef parle | `accueil : la cinématique démarre`, `… prend la parole` |
| A2 | Une tenue incomplète est refusée | `accueil : tenue incomplète refusée` |
| A3 | Zone dangereuse : dedans entre les voies, sur le rail et à 4,2 m ; dehors à 4,6 m et à 20 m | `zone dangereuse : 1,50 m du rail extérieur` |
| A4 | L'agent resté dans la zone est « pris » par le train de la voie 2 | `zone dangereuse : agent pris…` |
| A5 | Le quiz débloque le poste à 3/3 | `quiz sécurité : poste débloqué…` |
| A6 | Les trois métiers sont réussis par les pilotes automatiques | `train`, `pelle`, `nacelle` |
| A7 | Aucune erreur JavaScript | `aucune erreur JavaScript` |

## 5. Hors périmètre (prochaines itérations)
- Modèles 3D photoréalistes d'engins (à fournir : jeton API Sketchfab ou fichiers téléchargés, voir `ASSET-SOURCES.md`).
- Version Unreal Engine 5 (voir ADR 0001).
- Multijoueur (formateur et apprenant).
