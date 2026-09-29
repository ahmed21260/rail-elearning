#!/usr/bin/env python3
"""Construit ferro-talents/dist/ : version publiable sur un hébergeur qui ne sert pas les binaires.
- page sans squelette html/head/body, three.js via jsdelivr, polices embarquées
- HDR, tampons glTF et GLB encodés en base64 (.txt), textures > 1024 px réduites
Usage : python3 ferro-talents/tools/build_web.py
"""
import base64
import json
import re
import shutil
import subprocess
from pathlib import Path

FT = Path(__file__).resolve().parents[1]
DIST = FT / "dist"
THREE = "https://cdn.jsdelivr.net/npm/three@0.181.2"

shutil.rmtree(DIST, ignore_errors=True)
DIST.mkdir()
shutil.copytree(FT / "src", DIST / "src")
shutil.copytree(FT / "data", DIST / "data")
A = FT / "assets"
D = DIST / "assets"
shutil.copytree(A / "dem", D / "dem")
(D / "hdri").mkdir(parents=True)
hid = "kloofendal_48d_partly_cloudy_puresky"
shutil.copy(A / "hdri" / f"{hid}_bg.jpg", D / "hdri" / f"{hid}_bg.jpg")
(D / "hdri" / f"{hid}.hdr.b64.txt").write_text(base64.b64encode((A / "hdri" / f"{hid}_2k.hdr").read_bytes()).decode())


def copy_jpg(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.stat().st_size > 1_500_000:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", "scale='min(1024,iw)':-2", "-q:v", "3", str(dst)], check=True)
    else:
        shutil.copy(src, dst)


for p in (A / "textures").rglob("*.jpg"):
    copy_jpg(p, D / "textures" / p.relative_to(A / "textures"))
for glb in (A / "models" / "sf").glob("*.glb") if (A / "models" / "sf").exists() else []:
    (D / "models" / "sf").mkdir(parents=True, exist_ok=True)
    (D / "models" / "sf" / f"{glb.name}.b64.txt").write_text(base64.b64encode(glb.read_bytes()).decode())
for mdir in (A / "models").iterdir():
    if mdir.name == "sf":
        continue
    if mdir.suffix == ".glb":
        (D / "models").mkdir(parents=True, exist_ok=True)
        (D / "models" / f"{mdir.name}.b64.txt").write_text(base64.b64encode(mdir.read_bytes()).decode())
        continue
    g = json.loads((mdir / f"{mdir.name}.gltf").read_text())
    out = D / "models" / mdir.name
    out.mkdir(parents=True, exist_ok=True)
    for t in (mdir / "textures").glob("*.jpg"):
        copy_jpg(t, out / "textures" / t.name)
    assert len(g["buffers"]) == 1
    (out / f"{mdir.name}.bin.b64.txt").write_text(base64.b64encode((mdir / g["buffers"][0]["uri"]).read_bytes()).decode())
    (out / f"{mdir.name}.gltf.json").write_text(json.dumps(g))
shutil.copy(A / "ASSETS.md", D / "ASSETS.md")
if (A / "SKETCHFAB.md").exists():
    shutil.copy(A / "SKETCHFAB.md", D / "SKETCHFAB.md")

html = (FT / "index.html").read_text()
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
head = re.sub(r'<meta charset="UTF-8" />\s*', "", head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', "", head)
head = head.replace('"./vendor/three/three.module.js"', f'"{THREE}/build/three.module.js"').replace('"./vendor/three/addons/"', f'"{THREE}/examples/jsm/"')
for w in ["400", "600", "800"]:
    data = base64.b64encode((FT / "vendor" / "fonts" / f"inter-latin-{w}-normal.woff2").read_bytes()).decode()
    head = head.replace(f'url("vendor/fonts/inter-latin-{w}-normal.woff2")', f'url("data:font/woff2;base64,{data}")')
(DIST / "index.html").write_text(head.strip() + "\n<script>window.FT_ASSETS = true;</script>\n" + body.strip() + "\n")
files = sorted(str(p.relative_to(DIST)) for p in DIST.rglob("*") if p.is_file() and p.name != "index.html")
size = sum((DIST / f).stat().st_size for f in files)
print(f"{len(files)} fichiers, {size / 2**20:.1f} Mo ; plus gros : {max((DIST / f).stat().st_size for f in files) / 2**20:.1f} Mo")
(DIST / "files.json").write_text(json.dumps(files))
