#!/usr/bin/env python3
"""Télécharge les assets open source (Poly Haven et ambientCG, CC0) listés dans video/assets-manifest.json.

Usage : python3 video/tools/fetch_assets.py [--force] [--dest <dossier assets>]
Sortie (défaut) : video/hyperframes/assets/{hdri,textures,models}/ + ASSETS.md
Simulateur     : --dest simulator/assets
"""
import json
import io
import subprocess
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

VIDEO = Path(__file__).resolve().parents[1]
ASSETS = (Path(sys.argv[sys.argv.index("--dest") + 1]).resolve() if "--dest" in sys.argv else VIDEO / "hyperframes" / "assets")
API = "https://api.polyhaven.com"
UA = {"User-Agent": "rail-elearning-video/1.0"}
FORCE = "--force" in sys.argv


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def fetch(url):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                return r.read()
        except OSError:
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)


def download(url, dest: Path):
    if dest.exists() and not FORCE:
        return "cache"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(fetch(url))
    tmp.rename(dest)
    return f"{dest.stat().st_size // 1024} KB"


def credit(asset_id):
    info = get_json(f"{API}/info/{asset_id}")
    return info.get("name", asset_id), ", ".join(info.get("authors", {}).keys())


def main():
    mpath = Path(sys.argv[sys.argv.index("--manifest") + 1]).resolve() if "--manifest" in sys.argv else VIDEO / "assets-manifest.json"
    manifest = json.loads(mpath.read_text())
    ledger = []

    for h in manifest.get("hdri", []):
        files = get_json(f"{API}/files/{h['id']}")
        dest = ASSETS / "hdri" / f"{h['id']}_{h['res']}.hdr"
        print(f"hdri    {h['id']:<40} {download(files['hdri'][h['res']]['hdr']['url'], dest)}")
        bg = ASSETS / "hdri" / f"{h['id']}_bg.jpg"
        if not bg.exists() or FORCE:
            raw = ASSETS / "hdri" / f"{h['id']}_tonemapped_full.jpg"
            download(files["tonemapped"]["url"], raw)
            w = h.get("tonemapped_max_width", 6144)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-vf", f"scale='min({w},iw)':-2", "-q:v", "3", str(bg)], check=True)
            raw.unlink()
        print(f"hdri    {h['id'] + ' (fond jpg)':<40} ok")
        ledger.append((h["id"], "HDRI", h["role"], [dest.name, bg.name]))

    for t in manifest.get("textures", []) + manifest.get("texture_extras", []):
        files = get_json(f"{API}/files/{t['id']}")
        names = []
        for m in t["maps"]:
            dest = ASSETS / "textures" / t["id"] / f"{m}.jpg"
            print(f"texture {t['id'] + '/' + m:<40} {download(files[m][t['res']]['jpg']['url'], dest)}")
            names.append(f"{t['id']}/{m}.jpg")
        ledger.append((t["id"], "Texture", t["role"], names))

    for mdl in manifest.get("models", []):
        files = get_json(f"{API}/files/{mdl['id']}")
        g = files["gltf"][mdl["res"]]["gltf"]
        root = ASSETS / "models" / mdl["id"]
        download(g["url"], root / f"{mdl['id']}.gltf")
        for rel, inc in g["include"].items():
            download(inc["url"], root / rel)
        print(f"model   {mdl['id']:<40} ok")
        ledger.append((mdl["id"], "Modèle glTF", mdl["role"], [f"{mdl['id']}/{mdl['id']}.gltf"]))

    for a in manifest.get("ambientcg", []):
        root = ASSETS / "textures" / a["id"]
        names = [f"{a['id']}/{m}.jpg" for m in a["maps"]]
        if FORCE or not all((ASSETS / "textures" / n).exists() for n in names):
            z = zipfile.ZipFile(io.BytesIO(fetch(f"https://ambientcg.com/get?file={a['id']}_{a['res']}-JPG.zip")))
            root.mkdir(parents=True, exist_ok=True)
            for m in a["maps"]:
                (root / f"{m}.jpg").write_bytes(z.read(f"{a['id']}_{a['res']}-JPG_{m}.jpg"))
        print(f"texture {a['id'] + ' (ambientCG)':<40} ok")
        ledger.append((a["id"], "Texture (ambientCG)", a["role"], names))

    extra_lines = []
    for d in manifest.get("direct", []):
        print(f"direct  {d['id']:<40} {download(d['url'], ASSETS / d['dest'])}")
        extra_lines.append(f"| [{d['id']}]({d['source']}) | {d['license']} | {d['author']} | {d['role']} | {d['dest']} |")

    dem = manifest.get("dem")
    if dem:
        import math
        lat, lon = dem["center"]
        z = dem["zoom"]
        n = 2 ** z
        cx = int((lon + 180) / 360 * n)
        cy = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
        r = dem["radius_tiles"]
        for x in range(cx - r, cx + r + 1):
            for y in range(cy - r, cy + r + 1):
                download(dem["url"].format(z=z, x=x, y=y), ASSETS / "dem" / f"{z}_{x}_{y}.png")
        (ASSETS / "dem" / "tiles.json").write_text(json.dumps({"z": z, "x0": cx - r, "y0": cy - r, "n": 2 * r + 1, "center": dem["center"]}))
        print(f"dem     {(2*r+1)**2} tuiles z{z} autour de {lat}, {lon}")
        extra_lines.append("| [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) | Données ouvertes (voir attributions AWS / Mapzen) | SRTM, Copernicus et autres sources publiques | Relief réel | dem/*.png |")

    lines = [
        "# Crédits des assets",
        "",
        "Fichier généré par `video/tools/fetch_assets.py` — ne pas éditer à la main.",
        "Tous les assets ci-dessous proviennent de [Poly Haven](https://polyhaven.com) et [ambientCG](https://ambientcg.com) sous licence **CC0** (domaine public) :",
        "usage commercial libre, attribution non obligatoire mais faite ici.",
        "",
        "| Asset | Type | Auteur(s) | Rôle | Fichiers |",
        "|---|---|---|---|---|",
    ]
    for asset_id, kind, role, names in ledger:
        if "ambientCG" in kind:
            lines.append(f"| [{asset_id}](https://ambientcg.com/view?id={asset_id}) | {kind} | Lennart Demes (ambientCG) | {role} | {', '.join(names)} |")
            continue
        name, authors = credit(asset_id)
        lines.append(f"| [{name}](https://polyhaven.com/a/{asset_id}) | {kind} | {authors} | {role} | {', '.join(names)} |")
    if extra_lines:
        lines += ["", "## Autres sources gratuites", "", "| Asset | Licence | Auteur | Rôle | Fichiers |", "|---|---|---|---|---|", *extra_lines]
    lines += ["", "Code tiers embarqué : three.js (MIT, `vendor/THREE_LICENSE`), GSAP (licence standard GreenSock), police Inter (SIL OFL 1.1)."]
    (ASSETS / "ASSETS.md").write_text("\n".join(lines) + "\n")
    print(f"\nCrédits écrits dans {ASSETS / 'ASSETS.md'}")


if __name__ == "__main__":
    main()
