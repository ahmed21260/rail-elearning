#!/usr/bin/env python3
"""Construit simulator/dist/ : version publiable du simulateur (page sans squelette,
three.js via jsdelivr, polices embarquées, uniquement les assets utilisés)."""
import base64
import json
import re
import shutil
from pathlib import Path

SIM = Path(__file__).resolve().parents[1]
DIST = SIM / "dist"
THREE = "https://cdn.jsdelivr.net/npm/three@0.181.2"
USED = [
    "hdri/kloofendal_48d_partly_cloudy_puresky_bg.jpg",
    "textures/Grass004/Color.jpg", "textures/Grass004/NormalGL.jpg",
    "textures/brown_mud_dry/Diffuse.jpg",
    "textures/gravel_stones/Diffuse.jpg", "textures/gravel_stones/nor_gl.jpg", "textures/gravel_stones/Rough.jpg",
    "textures/concrete_floor_worn_001/Diffuse.jpg", "textures/concrete_floor_worn_001/nor_gl.jpg",
    "textures/rusty_metal_02/Diffuse.jpg",
]
MODELS = ["shrub_02", "wild_rooibos_bush", "grass_medium_02"]

shutil.rmtree(DIST, ignore_errors=True)
DIST.mkdir()
for d in ["sim", "engine"]:
    shutil.copytree(SIM / d, DIST / d)
for rel in USED:
    (DIST / "assets" / rel).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(SIM / "assets" / rel, DIST / "assets" / rel)
# Binaires non servis par l'hébergeur : HDR en base64, tampons glTF embarqués (data URI).
hdr = (SIM / "assets" / "hdri" / "kloofendal_48d_partly_cloudy_puresky_2k.hdr").read_bytes()
(DIST / "assets" / "hdri" / "sky.hdr.b64.txt").write_text(base64.b64encode(hdr).decode())
for m in MODELS:
    src = SIM / "assets" / "models" / m
    dst = DIST / "assets" / "models" / m
    shutil.copytree(src / "textures", dst / "textures")
    g = json.loads((src / f"{m}.gltf").read_text())
    assert len(g["buffers"]) == 1
    (dst / f"{m}.bin.b64.txt").write_text(base64.b64encode((src / g["buffers"][0]["uri"]).read_bytes()).decode())
    (dst / f"{m}.gltf.json").write_text(json.dumps(g))

html = (SIM / "index.html").read_text()
head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", html, re.S).group(1)
head = re.sub(r'<meta charset="UTF-8" />\s*', "", head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', "", head)
head = head.replace('"./assets/vendor/three.module.js"', f'"{THREE}/build/three.module.js"')
head = head.replace('"./assets/vendor/addons/"', f'"{THREE}/examples/jsm/"')
for w in ["400", "600", "800"]:
    data = base64.b64encode((SIM / "assets" / "fonts" / f"inter-latin-{w}-normal.woff2").read_bytes()).decode()
    head = head.replace(f'url("assets/fonts/inter-latin-{w}-normal.woff2")', f'url("data:font/woff2;base64,{data}")')
cfg = '<script>window.SIM_ASSETS = { hdr: "assets/hdri/sky.hdr.b64.txt", model: (n) => ({ json: `assets/models/${n}/${n}.gltf.json`, bin: `assets/models/${n}/${n}.bin.b64.txt` }) };</script>'
(DIST / "index.html").write_text(head.strip() + "\n" + cfg + "\n" + body.strip() + "\n")
files = sorted(str(p.relative_to(DIST)) for p in DIST.rglob("*") if p.is_file() and p.name != "index.html")
size = sum((DIST / f).stat().st_size for f in files) // (1 << 20)
print(f"{len(files)} fichiers, {size} Mo")
(DIST / "files.txt").write_text("\n".join(files) + "\n")
