# La boucle de production : Brief → Création → Audit

On ne demande jamais une vidéo « en direct ». Chaque vidéo passe par une boucle
courte, répétée jusqu'à ce que l'audit valide.

```
  ┌──────────┐     ┌────────────┐     ┌──────────┐
  │ 1. BRIEF │ ──▶ │ 2. CRÉATION│ ──▶ │ 3. AUDIT │ ──┐
  └──────────┘     └────────────┘     └──────────┘   │
        ▲                 ▲                          │ actions
        │                 └──────────────────────────┘
        └── si l'objectif lui-même est à revoir
```

## 1. Brief (le prompt)

`video/<projet>/BRIEF.md` : objectif pédagogique, direction artistique, storyboard
avec **temps clés** (colonne `t`), critères d'acceptation. Il est validé par un
formateur avant toute création.

## 2. Création

1. **Assets d'abord** : on ajoute les assets open source nécessaires dans
   `video/assets-manifest.json`, puis `python3 video/tools/fetch_assets.py`.
   Les fichiers arrivent dans `video/hyperframes/assets/` et les crédits dans
   `assets/ASSETS.md`. Sources autorisées : licence CC0 (Poly Haven, ambientCG).
2. **Construction** plan par plan dans la composition (`index.html` + `scene/`).

## 3. Audit

```bash
bash video/tools/audit.sh            # → video/hyperframes/audit/iter-NN/
```

Le script lance `hyperframes check`, capture chaque temps clé du brief, produit
`contact-sheet.jpg` et une grille `AUDIT.md` (6 critères notés sur 5). On regarde
**chaque image**, on remplit la grille, on liste les actions. Tant qu'un critère est
< 4/5 : retour à l'étape 2. Tout ≥ 4 : rendu final (`npm run render`).

Les audits restent dans le dépôt : c'est l'historique de la qualité.

## Prompt type pour Claude Code

> Lis `video/LOOP.md` et `video/hyperframes/BRIEF.md`. Applique la boucle :
> vérifie les assets, construis, lance `video/tools/audit.sh`, regarde la planche
> contact, remplis `AUDIT.md` honnêtement, corrige, et recommence jusqu'à ce que
> tous les critères soient ≥ 4/5. Ne fais le rendu final qu'ensuite.
