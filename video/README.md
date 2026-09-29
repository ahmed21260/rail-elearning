# Atelier vidéo — Rail E-Learning

Outils pour produire les vidéos de formation de la plateforme avec Claude Code.
Le principe vient de l'article « Claude Opus 5.5 Isn't Making Videos » : le modèle
n'invente pas des pixels, il **écrit du code** (HTML + GSAP, ou React) qu'un navigateur
headless rend image par image, puis ffmpeg assemble le MP4.

## Démarrage rapide

```bash
bash video/setup.sh          # prérequis, dépendances, skills Remotion, dépôts de référence
```

Prérequis : Node 22+, ffmpeg, Chrome/Chromium (téléchargé automatiquement sinon).

### HyperFrames (HTML + GSAP) — recommandé

```bash
cd video/hyperframes
npm run check                # lint + runtime + mise en page + contraste
npx hyperframes snapshot . --at 2,7,12   # planche contact pour valider avant le rendu
npm run render               # → out/<nom>.mp4
```

Exemple fourni : `index.html`, vidéo de 24 s « Signalisation ferroviaire » (titre,
Carré, Sémaphore, Avertissement, récapitulatif), rendue en ~35 s.

### Remotion (React + TypeScript)

```bash
cd video/remotion
npm run dev                  # Remotion Studio
npm run still                # image de contrôle (frame 90)
npm run render               # → out/rail-signal.mp4
```

Le composant `RailSignal` est paramétrable ; une vidéo par signal :

```bash
npx remotion render RailSignal out/avertissement.mp4 \
  --props='{"module":"Module 1","name":"L'\''Avertissement","tag":"Signal d'\''annonce","rule":"Annonce un signal d'\''arrêt.","lamps":["off","yellow"]}'
```

Dans un conteneur sans Chrome système, ajoutez
`--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell`.

## Structure

| Chemin | Rôle |
|---|---|
| `video/hyperframes/` | Projet HyperFrames (HTML/GSAP) avec la vidéo exemple ; GSAP embarqué dans `assets/vendor/` |
| `video/remotion/` | Projet Remotion (React) avec le composant `RailSignal` |
| `video/PROMPTS.md` | Charte visuelle, méthode de travail et prompts prêts à copier |
| `video/setup.sh` | Installation en une commande |
| `video/_refs/` | Dépôts de référence clonés par `setup.sh` (ignorés par git) |
| `.claude/skills/` | Skills HyperFrames (versionnés) + skills Remotion (installés par `setup.sh`) |

## Ressources de l'article

| Ressource | Usage |
|---|---|
| [JohnHeibel/PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) | Clip musical complet fait avec Claude : exemple de production de bout en bout |
| [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) | Kit de départ p5.js pour animer un personnage ; lire son `ANIMATION_GUIDE.md` (storyboard → planches contact → rendu) |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Framework HTML + GSAP → MP4 déterministe, pensé pour les agents (utilisé ici) |
| [remotion.dev/docs/ai/skills](https://www.remotion.dev/docs/ai/skills) | Framework React + skills Remotion pour Claude Code (utilisé ici) |
| [guanmo-ai/awesome-ai-motion](https://github.com/guanmo-ai/awesome-ai-motion) | 355 vidéos de référence et 62 prompts publics d'auteurs |
| [athemeroy/awesome-opus-5-5-videos](https://github.com/athemeroy/awesome-opus-5-5-videos) | 168 cas analysés, par domaine et style visuel ; guide des chaînes de production |

La leçon de l'article : « le post dit one shot, le prompt fait 10 000 caractères avec
un bon point de vue, des skills, des exemples et des clés API ». Un bon brief compte
plus que le modèle — d'où `PROMPTS.md`.
