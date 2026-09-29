#!/usr/bin/env bash
# Prépare l'atelier vidéo : dépendances, skills Claude Code et dépôts de référence.
# Usage : bash video/setup.sh            (depuis la racine du repo)
#         bash video/setup.sh --no-refs  (sans cloner les dépôts de référence)
set -euo pipefail

VIDEO_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$VIDEO_DIR/.." && pwd)"
REFS_DIR="$VIDEO_DIR/_refs"
CLONE_REFS=1
[[ "${1:-}" == "--no-refs" ]] && CLONE_REFS=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "1. Vérification des prérequis"
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if (( NODE_MAJOR >= 22 )); then ok "Node $(node -v)"; else warn "Node $(node -v) : HyperFrames demande Node 22+"; fi
else
  warn "Node.js absent : installez Node 22+ (https://nodejs.org)"
fi
if command -v ffmpeg >/dev/null; then ok "ffmpeg"; else warn "ffmpeg absent : sudo apt install ffmpeg  |  brew install ffmpeg  |  winget install ffmpeg"; fi
if command -v google-chrome >/dev/null || command -v chromium >/dev/null || [[ -d /opt/pw-browsers ]] || [[ -d "/Applications/Google Chrome.app" ]]; then
  ok "Chrome / Chromium"
else
  warn "Chrome introuvable : HyperFrames et Remotion en téléchargent un au premier rendu"
fi

echo "2. Projet Remotion (React)"
(cd "$VIDEO_DIR/remotion" && npm install --no-audit --no-fund --silent) && ok "dépendances installées"

echo "3. Skills Claude Code"
# Les skills HyperFrames sont déjà versionnés dans .claude/skills/.
# Les skills Remotion sont installés au niveau projet (non versionnés, voir .gitignore).
if [[ ! -d "$ROOT_DIR/.claude/skills/remotion-best-practices" ]]; then
  TMP=$(mktemp -d)
  git clone -q --depth 1 https://github.com/remotion-dev/skills.git "$TMP/remotion-skills"
  cp -r "$TMP/remotion-skills/skills/"* "$ROOT_DIR/.claude/skills/"
  rm -rf "$TMP"
  ok "skills Remotion installés dans .claude/skills/"
else
  ok "skills Remotion déjà présents"
fi
ok "skills HyperFrames présents (mise à jour : npx hyperframes skills update)"

if (( CLONE_REFS )); then
  echo "4. Dépôts de référence (lecture seule, dans video/_refs/)"
  mkdir -p "$REFS_DIR"
  for repo in \
    JohnHeibel/ClaudeAnimationBase \
    JohnHeibel/PDoomVideo \
    heygen-com/hyperframes \
    guanmo-ai/awesome-ai-motion \
    athemeroy/awesome-opus-5-5-videos; do
    name="${repo#*/}"
    if [[ -d "$REFS_DIR/$name/.git" ]]; then
      git -C "$REFS_DIR/$name" pull -q --ff-only && ok "$repo (mis à jour)"
    else
      git clone -q --depth 1 "https://github.com/$repo.git" "$REFS_DIR/$name" && ok "$repo"
    fi
  done
fi

echo
echo "Prêt. Ouvrez Claude Code à la racine du repo et lisez video/PROMPTS.md pour les prompts."
