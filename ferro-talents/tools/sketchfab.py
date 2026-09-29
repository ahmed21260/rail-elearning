#!/usr/bin/env python3
"""Recherche et téléchargement de modèles Sketchfab (licences CC0 / CC-BY uniquement).

Le jeton n'est JAMAIS écrit dans le dépôt : il est lu dans la variable SKETCHFAB_TOKEN.

  SKETCHFAB_TOKEN=... python3 ferro-talents/tools/sketchfab.py search "spruce tree" [--max-faces 30000]
  SKETCHFAB_TOKEN=... python3 ferro-talents/tools/sketchfab.py fetch        # télécharge ferro-talents/sketchfab.json

sketchfab.json : [{ "name": "spruce", "uid": "…", "role": "…" }] ; les crédits (auteur, licence) sont
récupérés depuis l'API et ajoutés à assets/SKETCHFAB.md.
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

FT = Path(__file__).resolve().parents[1]
API = "https://api.sketchfab.com/v3"
OK_LICENSES = {"cc0", "by"}  # CC0 et CC-BY : utilisables dans un jeu diffusé, avec crédit pour BY


def req(path, auth=True):
    url = path if path.startswith("http") else f"{API}{path}"
    r = urllib.request.Request(url)
    if auth and "api.sketchfab.com" in url:
        r.add_header("Authorization", f"Token {os.environ['SKETCHFAB_TOKEN']}")
    with urllib.request.urlopen(r, timeout=120) as f:
        return f.read()


def search(q, max_faces=60000, count=24):
    out = []
    for lic in sorted(OK_LICENSES):
        p = urllib.parse.urlencode({"type": "models", "q": q, "downloadable": "true", "license": lic, "max_face_count": max_faces, "sort_by": "-likeCount", "count": count})
        for m in json.loads(req(f"/search?{p}"))["results"]:
            glb = (m.get("archives") or {}).get("glb") or {}
            out.append({
                "uid": m["uid"], "name": m["name"], "author": m["user"]["username"], "license": lic,
                "faces": m.get("faceCount"), "glbMB": round((glb.get("size") or 0) / 1e6, 1),
                "tex": glb.get("textureMaxResolution"), "likes": m.get("likeCount"), "url": m["viewerUrl"],
            })
    return sorted(out, key=lambda m: -(m["likes"] or 0))


def optimize(src, dst):
    """Textures en WebP 1024 px, nettoyage ; pièces et hiérarchie conservées (articulations).
    Nécessite gltf-transform (npm i -g @gltf-transform/cli) ou GLTF_TRANSFORM=chemin."""
    import shutil
    import subprocess
    gt = os.environ.get("GLTF_TRANSFORM") or shutil.which("gltf-transform")
    if not gt:
        shutil.copy(src, dst)
        return
    # Matériaux « specular-glossiness » (non lus par three.js) → metal-roughness
    head = src.read_bytes()[:200000]
    if b"KHR_materials_pbrSpecularGlossiness" in head:
        mr = src.with_suffix(".mr.glb")
        subprocess.run([gt, "metalrough", str(src), str(mr)], check=True, capture_output=True)
        shutil.move(mr, src)
    subprocess.run([gt, "optimize", str(src), str(dst), "--compress", "false", "--join", "false", "--instance", "false",
                    "--palette", "false", "--flatten", "false", "--simplify", "false",
                    "--texture-compress", "webp", "--texture-size", "1024"], check=True, capture_output=True)


def fetch():
    items = json.loads((FT / "sketchfab.json").read_text())
    dest = FT / "assets" / "models" / "sf"
    dest.mkdir(parents=True, exist_ok=True)
    credits = ["# Modèles Sketchfab", "", "| Modèle | Auteur | Licence | Rôle | Fichier |", "|---|---|---|---|---|"]
    for it in items:
        info = json.loads(req(f"/models/{it['uid']}"))
        lic = (info.get("license") or {}).get("slug") or (info.get("license") or {}).get("label")
        assert lic in OK_LICENSES, f"{it['name']} : licence {lic} refusée"
        f = dest / f"{it['name']}.glb"
        if not f.exists():
            links = json.loads(req(f"/models/{it['uid']}/download"))
            raw = dest / f"{it['name']}.raw.glb"
            raw.write_bytes(req(links["glb"]["url"], auth=False))
            optimize(raw, f)
            raw.unlink()
        print(f"{it['name']:<28} {f.stat().st_size / 1e6:6.1f} Mo  {lic:<4} {info['user']['username']}")
        lab = "CC0 1.0" if lic == "cc0" else "CC BY 4.0"
        credits.append(f"| [{info['name']}]({info['viewerUrl']}) | {info['user']['displayName']} | {lab} | {it['role']} | models/sf/{it['name']}.glb |")
    (FT / "assets" / "SKETCHFAB.md").write_text("\n".join(credits) + "\n")


if __name__ == "__main__":
    if sys.argv[1] == "search":
        mf = int(sys.argv[sys.argv.index("--max-faces") + 1]) if "--max-faces" in sys.argv else 60000
        for m in search(sys.argv[2], mf)[:14]:
            print(f"{m['uid']}  {m['license']:<4} {m['faces'] or 0:>7} tri  {m['glbMB']:>5} Mo  tex {m['tex']}  ♥{m['likes']:<5} {m['name'][:48]} — {m['author']}")
    else:
        fetch()
