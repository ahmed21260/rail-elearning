# Prompts et méthode — vidéos de formation ferroviaire

## Méthode (à imposer à Claude à chaque vidéo)

1. **Brief d'abord.** Public, objectif pédagogique, durée, format (16:9 plateforme,
   9:16 mobile), message unique à retenir.
2. **Storyboard avant le code.** Une ligne par scène : durée, visuel, texte à l'écran,
   mouvement, transition. Valider le storyboard avant d'écrire le moindre HTML.
3. **Construire scène par scène.** Après chaque scène : `npm run check`.
4. **Planche contact avant rendu.** `npx hyperframes snapshot . --at …` sur les temps
   clés ; Claude relit l'image et corrige (texte masqué, contraste, chevauchements).
5. **Seulement ensuite, le rendu complet.** `npm run render`.

## Charte visuelle Rail E-Learning

- Fond `#0b1220`, panneaux `#111a2e`, texte `#f1f5f9`, secondaire `#94a3b8`,
  accent `#38bdf8`.
- Couleurs de signalisation réservées à leur sens : rouge `#ef4444` = arrêt,
  jaune `#facc15` = annonce / ralentissement, vert `#22c55e` = voie libre.
  Ne jamais utiliser ces couleurs de façon décorative.
- Titres 100–130 px gras, corps 40–48 px, jamais moins de 28 px (lecture sur mobile).
- Une idée par scène, 4 à 6 s par scène, texte à l'écran ≤ 12 mots.
- Toujours terminer par un récapitulatif « À retenir » et un renvoi au quiz du module.
- Mention obligatoire en fin de vidéo réglementaire : « Support pédagogique simplifié.
  Seuls les référentiels réglementaires en vigueur font foi. »
- Contenu réglementaire : Claude doit **signaler** toute règle dont il n'est pas sûr
  au lieu de l'inventer ; un formateur valide le texte avant le rendu final.

## Prompts prêts à copier

### Module de formation (HyperFrames)

> Lis `video/PROMPTS.md` et `video/hyperframes/CLAUDE.md`, puis utilise `/hyperframes`.
> Crée une vidéo de 45 s pour le module « Consignes de sécurité à l'approche des voies »,
> public : nouveaux opérateurs. Message à retenir : « Je ne traverse jamais les voies
> hors des passages autorisés. » Donne-moi d'abord le storyboard scène par scène,
> attends ma validation, puis construis, vérifie avec des planches contact et rends le MP4.

### Série paramétrée (Remotion)

> Lis `video/PROMPTS.md`, utilise `/remotion-best-practices`. Dans `video/remotion`,
> ajoute une composition `RailQuizTeaser` (10 s, 1080×1920) qui prend en props une
> question et trois réponses, révèle la bonne réponse à 7 s, et rends-en une par
> question de `frontend/src` si des quiz y sont définis.

### Micro-animation (motion graphics)

> Utilise `/motion-graphics`. Animation de 6 s : un compteur de 0 à 100 % « Module
> terminé » avec le train qui arrive en gare, charte `video/PROMPTS.md`, sortie MP4.

### Personnage mascotte (ClaudeAnimationBase)

> Lis `video/_refs/ClaudeAnimationBase/ANIMATION_GUIDE.md`. Dans une copie de ce kit,
> fais une vidéo de 15 s où le personnage, en gilet orange haute visibilité, s'arrête
> devant un signal rouge, attend, puis repart quand il passe au vert.

## Trouver l'inspiration

- `video/_refs/awesome-ai-motion/` : filtrer la catégorie « 知识讲解 » (explications)
  pour des vidéos pédagogiques et leurs prompts publics.
- `video/_refs/awesome-opus-5-5-videos/docs/visual-effects-fit.md` : choisir la
  chaîne de production selon l'effet voulu.
