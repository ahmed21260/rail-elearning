#!/usr/bin/env bash
# Étape AUDIT de la boucle : check automatique + images clés + planche contact + grille à remplir.
# Usage : bash video/tools/audit.sh [projet=video/hyperframes] [iteration=auto]
set -euo pipefail
PROJ="$(cd "${1:-$(dirname "$0")/../hyperframes}" && pwd)"
AUDITS="$PROJ/audit"
mkdir -p "$AUDITS"
ITER="${2:-$(printf 'iter-%02d' $(( $(ls -d "$AUDITS"/iter-* 2>/dev/null | wc -l) + 1 )))}"
OUT="$AUDITS/$ITER"
mkdir -p "$OUT"
KEYS=$(grep -oP '^\| *\K[0-9.]+(?= *s *\|)' "$PROJ/BRIEF.md" | paste -sd, -)
[[ -z "$KEYS" ]] && { echo "Aucun temps clé trouvé dans BRIEF.md (colonne « t »)"; exit 1; }
HF="npx --yes hyperframes@0.8.91"
[[ -d /opt/pw-browsers ]] && export CHROME_PATH="${CHROME_PATH:-/opt/pw-browsers/chromium}"

echo "▶ check"
(cd "$PROJ" && $HF check > "$OUT/check.log" 2>&1) && CHECK="OK" || CHECK="ÉCHEC"
grep -E "error\(s\)|✗" "$OUT/check.log" | head -40 || true

echo "▶ images clés : $KEYS"
(cd "$PROJ" && $HF snapshot . --at "$KEYS" --no-end --timeout 120000 -o "$OUT/frames" > "$OUT/snapshot.log" 2>&1)
ffmpeg -v error -y -i "$OUT/frames/contact-sheet.jpg" -vf "scale='min(2400,iw)':-2" -q:v 4 "$OUT/contact-sheet.jpg"

cat > "$OUT/AUDIT.md" <<MD
# Audit $ITER — $(date -u +%Y-%m-%d)

- Check automatique : **$CHECK** (détail : \`check.log\`)
- Images clés : $KEYS s → \`contact-sheet.jpg\`, \`frames/\`

## Grille (note /5 et constat, à remplir après avoir regardé chaque image)

| Critère | Note | Constat | Action pour l'itération suivante |
|---|---|---|---|
| Réalisme du décor (voie, ballast, caténaire, paysage, lumière) |  |  |  |
| Exactitude ferroviaire (aspects des signaux, position, gabarit) |  |  |  |
| Clarté pédagogique (un message par plan, lisible en 3 s) |  |  |  |
| Lisibilité de l'interface (contraste, taille, pas de chevauchement) |  |  |  |
| Mouvement et rythme (caméra, vitesse cohérente, transitions) |  |  |  |
| Technique (check, temps de rendu, artefacts) |  |  |  |

## Décision

- [ ] Itérer (actions ci-dessus)  - [ ] Valider → rendu final
MD
echo "▶ audit prêt : $OUT/AUDIT.md"
