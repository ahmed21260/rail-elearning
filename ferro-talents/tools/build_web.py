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
def glb_to_folder(glb, out, name):
    """GLB aux textures embarquées → <name>.gltf.json + <name>.bin.b64.txt + textures/*.jpg|png.
    L'hébergeur interdit les URL blob: (CSP) : GLTFLoader ne pourrait pas décoder les images embarquées
    (arbres et maisons blancs). Les images deviennent des fichiers servis normalement, en JPG (opaque)
    ou PNG (transparence), sans extension EXT_texture_webp."""
    import io
    import struct
    from PIL import Image

    b = glb.read_bytes()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bin0 = 20 + jl + 8
    binb = b[bin0:bin0 + struct.unpack("<I", b[20 + jl:24 + jl])[0]]
    views = j.get("bufferViews", [])
    (out / "textures").mkdir(parents=True, exist_ok=True)
    image_views = set()
    for i, im in enumerate(j.get("images", [])):
        if "bufferView" not in im:
            continue
        v = views[im["bufferView"]]
        image_views.add(im["bufferView"])
        data = binb[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
        pic = Image.open(io.BytesIO(data))
        alpha = pic.mode in ("RGBA", "LA", "P") and pic.convert("RGBA").getextrema()[3][0] < 250
        fn = f"img{i}.png" if alpha else f"img{i}.jpg"
        if alpha:
            pic.convert("RGBA").save(out / "textures" / fn, optimize=True)
        else:
            pic.convert("RGB").save(out / "textures" / fn, quality=88)
        j["images"][i] = {"uri": f"textures/{fn}", "mimeType": "image/png" if alpha else "image/jpeg"}
    for t in j.get("textures", []):
        ext = t.get("extensions", {})
        if "EXT_texture_webp" in ext:
            t["source"] = ext.pop("EXT_texture_webp")["source"]
        if not ext:
            t.pop("extensions", None)
    for k in ("extensionsUsed", "extensionsRequired"):
        if k in j:
            j[k] = [e for e in j[k] if e != "EXT_texture_webp"]
            if not j[k]:
                del j[k]
    # Tampon reconstruit sans les images (index des bufferViews renumérotés)
    remap, packed, nb = {}, bytearray(), []
    for i, v in enumerate(views):
        if i in image_views:
            continue
        data = binb[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
        while len(packed) % 4:
            packed.append(0)
        nv = dict(v, byteOffset=len(packed), buffer=0)
        packed += data
        remap[i] = len(nb)
        nb.append(nv)
    j["bufferViews"] = nb
    for a in j.get("accessors", []):
        if "bufferView" in a:
            a["bufferView"] = remap[a["bufferView"]]
        sp = a.get("sparse")
        if sp:
            sp["indices"]["bufferView"] = remap[sp["indices"]["bufferView"]]
            sp["values"]["bufferView"] = remap[sp["values"]["bufferView"]]
    j["buffers"] = [{"byteLength": len(packed)}]
    (out / f"{name}.gltf.json").write_text(json.dumps(j))
    (out / f"{name}.bin.b64.txt").write_text(base64.b64encode(bytes(packed)).decode())


for glb in (A / "models" / "sf").glob("*.glb") if (A / "models" / "sf").exists() else []:
    glb_to_folder(glb, D / "models" / "sf" / glb.stem, glb.stem)
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
