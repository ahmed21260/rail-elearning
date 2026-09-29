#!/usr/bin/env python3
"""Ligne et relief RÉELS (IGN Géoplateforme, Licence Ouverte Etalab 2.0).

- Relief : RGE ALTI (ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES, issu du LiDAR HD) en WMS-R, float 32 bits,
  sur l'emprise Web Mercator du jeu (mosaïque z13 3×3), ré-encodé en tuiles Terrarium 256 px.
- Voie : BD TOPO troncon_de_voie_ferree (voie ferrée principale, axe de la double voie), chaînée puis
  découpée sur 5,76 km se terminant après la gare de Schirmeck – La Broque (repère du jeu : gare à s = 5410 m).

Usage : python3 ferro-talents/tools/build_line_ign.py      → assets/dem_ign/*, data/line.json
"""
import io
import json
import math
import struct
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

FT = Path(__file__).resolve().parents[1]
OUT_DEM = FT / "assets" / "dem_ign"
CACHE = FT / "assets" / "ign"
GEO = "https://data.geopf.fr"
Z, X0, Y0, NT = 13, 4259, 2829, 3  # emprise historique du jeu (inchangée : repère monde identique)
LAT0 = 48.5136
GRID = 3072  # pixels du nouveau MNT (≈ 3,2 m au sol)
LENGTH = 5760
STATION_S = 5410  # milieu du quai dans le jeu (depot.js : STATION 5280–5540)
STATION_LONLAT = (7.21585144, 48.4802562)  # BD TOPO : « Gare de Schirmeck-la Broque »
GRADE_MAX = 0.021

R = 6378137.0
O = math.pi * R
RES13 = 2 * O / (256 * 2 ** Z)
MINX = -O + X0 * 256 * RES13
MAXY = O - Y0 * 256 * RES13
SPAN = NT * 256 * RES13
MAXX, MINY = MINX + SPAN, MAXY - SPAN
N13 = NT * 256
PX13 = 40075016.686 * math.cos(math.radians(LAT0)) / (2 ** Z * 256)  # m au sol / pixel z13 (repère du jeu)


def get(url, timeout=180, tries=6):
    import time
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ferro-talents/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as f:
                return f.read()
        except OSError:
            if k == tries - 1:
                raise
            time.sleep(2 ** k)


def world(lon, lat):
    """lon/lat → repère monde du jeu (x est, z sud, mètres au sol)."""
    X = math.radians(lon) * R
    Y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R
    px = (X - MINX) / RES13
    py = (MAXY - Y) / RES13
    return ((px - N13 / 2) * PX13, (py - N13 / 2) * PX13)


def fetch_dem():
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"rgealti_{GRID}.npy"
    if f.exists():
        return np.load(f)
    H = np.zeros((GRID, GRID), np.float32)
    k = 4
    step = GRID // k
    for j in range(k):
        for i in range(k):
            bx0 = MINX + SPAN * i / k
            by1 = MAXY - SPAN * j / k
            q = dict(SERVICE="WMS", VERSION="1.3.0", REQUEST="GetMap", LAYERS="ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES", STYLES="",
                     CRS="EPSG:3857", BBOX=f"{bx0},{by1 - SPAN / k},{bx0 + SPAN / k},{by1}", WIDTH=step, HEIGHT=step, FORMAT="image/x-bil;bits=32")
            d = get(f"{GEO}/wms-r/wms?" + urllib.parse.urlencode(q))
            assert len(d) == step * step * 4, f"réponse MNT inattendue ({len(d)} octets) : {d[:200]}"
            H[j * step:(j + 1) * step, i * step:(i + 1) * step] = np.frombuffer(d, "<f4").reshape(step, step)
            print(f"MNT {j * k + i + 1}/{k * k}")
    bad = (H < -500) | (H > 5000)
    if bad.any():  # trous éventuels : valeur voisine
        H[bad] = np.median(H[~bad])
    np.save(f, H)
    return H


def write_terrarium(H):
    OUT_DEM.mkdir(parents=True, exist_ok=True)
    n = GRID // 256
    v = H.astype(np.float64) + 32768
    r = np.floor(v / 256)
    g = np.floor(v - r * 256)
    b = np.floor((v - r * 256 - g) * 256)
    rgb = np.stack([r, g, b], -1).clip(0, 255).astype(np.uint8)
    for j in range(n):
        for i in range(n):
            Image.fromarray(rgb[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256]).save(OUT_DEM / f"ign_{i}_{j}.png", optimize=True)
    tiles = {"z": "ign", "x0": 0, "y0": 0, "n": n, "center": [LAT0, 7.241], "source": "IGN RGE ALTI (LiDAR HD), Licence Ouverte 2.0"}
    (OUT_DEM / "tiles.json").write_text(json.dumps(tiles))
    return tiles


def fetch_rail():
    f = CACHE / "troncon_de_voie_ferree.json"
    if not f.exists():
        lo1, la1 = math.degrees(MINX / R), math.degrees(2 * math.atan(math.exp(MINY / R)) - math.pi / 2)
        lo2, la2 = math.degrees(MAXX / R), math.degrees(2 * math.atan(math.exp(MAXY / R)) - math.pi / 2)
        u = (f"{GEO}/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:troncon_de_voie_ferree"
             f"&SRSNAME=EPSG:4326&BBOX={la1},{lo1},{la2},{lo2},urn:ogc:def:crs:EPSG::4326&OUTPUTFORMAT=application/json&COUNT=1000")
        f.write_bytes(get(u))
    return json.loads(f.read_text())


def chain_main_line(g):
    segs = []
    for ft in g["features"]:
        if ft["properties"]["nature"] != "Voie ferrée principale":
            continue
        cs = ft["geometry"]["coordinates"]
        parts = cs if ft["geometry"]["type"] == "MultiLineString" else [cs]
        for p in parts:
            segs.append([world(c[0], c[1]) for c in p])
    # Chaînage glouton par extrémités les plus proches, à partir du segment le plus au nord-est
    segs.sort(key=lambda s: -(s[0][0] - s[0][1]))
    line = list(segs.pop(0))
    while segs:
        best = None
        for idx, s in enumerate(segs):
            for rev in (False, True):
                a = s[-1] if rev else s[0]
                for at_end in (True, False):
                    e = line[-1] if at_end else line[0]
                    d = math.dist(a, e)
                    if best is None or d < best[0]:
                        best = (d, idx, rev, at_end)
        d, idx, rev, at_end = best
        if d > 60:
            break
        s = segs.pop(idx)
        s = s[::-1] if rev else s
        line = line + s if at_end else s[::-1] + line
    return np.array(line)


def curvature(P):
    a, b, c = P[:-2], P[1:-1], P[2:]
    cross = np.abs((b - a)[:, 0] * (c - a)[:, 1] - (b - a)[:, 1] * (c - a)[:, 0])
    return 2 * cross / (np.hypot(*(b - a).T) * np.hypot(*(c - b).T) * np.hypot(*(a - c).T) + 1e-9)


def resample(P, step):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    s = np.arange(0, d[-1], step)
    return np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])], d[-1]


def fetch_ortho(z=15):
    """Orthophoto IGN (HR.ORTHOIMAGERY.ORTHOPHOTOS, WMTS PM) sur l'emprise, assemblée en une image."""
    out = OUT_DEM / "ortho.jpg"
    if out.exists():
        return
    f = 2 ** (z - Z)
    n = NT * f
    img = Image.new("RGB", (n * 256, n * 256))
    for j in range(n):
        for i in range(n):
            u = (f"{GEO}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=HR.ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal"
                 f"&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={Y0 * f + j}&TILECOL={X0 * f + i}&FORMAT=image/jpeg")
            tf = CACHE / "ortho" / f"{z}_{i}_{j}.jpg"
            if not tf.exists():
                tf.parent.mkdir(parents=True, exist_ok=True)
                tf.write_bytes(get(u))
            img.paste(Image.open(tf).convert("RGB"), (i * 256, j * 256))
        print(f"ortho ligne {j + 1}/{n}")
    OUT_DEM.mkdir(parents=True, exist_ok=True)
    img.save(out, quality=86, optimize=True)


def main():
    H = fetch_dem()
    fetch_ortho()
    tiles = write_terrarium(H)
    px = PX13 * N13 / GRID
    P, total = resample(chain_main_line(fetch_rail()), 2.0)
    # Sens : de l'aval (nord-est) vers Schirmeck (sud-ouest)
    st = np.array(world(*STATION_LONLAT))
    if np.linalg.norm(P[0] - st) < np.linalg.norm(P[-1] - st):
        P = P[::-1]
    k = int(np.argmin(np.hypot(*(P - st).T)))
    i0 = k - STATION_S // 2
    assert i0 >= 0, f"ligne trop courte en amont de la gare ({k * 2} m < {STATION_S} m)"
    P = P[i0:i0 + LENGTH // 2 + 1]
    # Lissage progressif (raccords polygonaux des tronçons BD TOPO) : rayon ≥ 300 m, écart au tracé réel ≤ 6 m (précision BD TOPO)
    def smooth(P, w):
        Q = P.copy()
        for c in range(2):
            pad = np.r_[np.full(w, P[0, c]), P[:, c], np.full(w, P[-1, c])]
            Q[:, c] = np.convolve(pad, np.ones(w) / w, mode="same")[w:-w]
        return Q

    raw = P.copy()
    best = None
    for w in range(9, 200, 6):
        Q = smooth(raw, w)
        dev = float(np.max(np.hypot(*(Q - raw).T)))
        R10, _ = resample(Q, 10.0)
        rmin = 1 / max(curvature(R10).max(), 1e-9)
        best = (R10, rmin, dev, w)
        if rmin >= 300 or dev > 6.0:
            break
    P, rmin, dev, w = best
    print(f"lissage fenêtre {w * 2} m : rayon min {rmin:.0f} m, écart max au tracé réel {dev:.2f} m")

    def dem_at(x, z):
        fx = np.clip(x / px + GRID / 2, 0, GRID - 1.001)
        fz = np.clip(z / px + GRID / 2, 0, GRID - 1.001)
        i, j = np.floor(fx).astype(int), np.floor(fz).astype(int)
        u, v = fx - i, fz - j
        return H[j, i] * (1 - u) * (1 - v) + H[j, i + 1] * u * (1 - v) + H[j + 1, i] * (1 - u) * v + H[j + 1, i + 1] * u * v

    # Profil en long : le MNT LiDAR contient déjà la plateforme réelle ; minimum local (ponts, bords) puis lissage
    ground = dem_at(P[:, 0], P[:, 1])
    y = np.array([ground[max(0, i - 2):i + 3].min() for i in range(len(ground))])
    kk = 21
    for _ in range(3):
        y = np.convolve(np.r_[np.full(kk, y[0]), y, np.full(kk, y[-1])], np.ones(kk) / kk, mode="same")[kk:-kk]
    for _ in range(200):
        if np.max(np.abs(np.diff(y) / 10)) <= GRADE_MAX + 1e-6:
            break
        for i in range(1, len(y)):
            y[i] = np.clip(y[i], y[i - 1] - GRADE_MAX * 10, y[i - 1] + GRADE_MAX * 10)
    y += 0.6  # dessus du ballast au-dessus de la plateforme

    kap = curvature(P)
    out = {
        "_doc": "Tracé RÉEL : axe de la double voie Strasbourg – Saint-Dié (BD TOPO, IGN) jusqu'à Schirmeck – La Broque ; relief RGE ALTI (LiDAR HD). Licence Ouverte Etalab 2.0.",
        "step": 10,
        "length": int(round((len(P) - 1) * 10)),
        "points": [[round(float(P[i, 0]), 2), round(float(P[i, 1]), 2), round(float(y[i]), 2)] for i in range(len(P))],
        "dem": {"tiles": tiles, "pixel": px, "size": GRID, "base": "dem_ign"},
        "stats": {
            "rayon_min_m": int(1 / max(kap.max(), 1e-9)),
            "rampe_max_pm": round(float(np.max(np.abs(np.diff(y))) / 10 * 1000), 1),
            "remblai_max_m": round(float(np.max(y - 0.6 - ground)), 1),
            "deblai_max_m": round(float(np.max(ground - y + 0.6)), 1),
            "altitude": [int(y.min()), int(y.max())],
            "source": "IGN BD TOPO troncon_de_voie_ferree + RGE ALTI",
        },
    }
    (FT / "data" / "line.json").write_text(json.dumps(out))
    print(json.dumps(out["stats"], ensure_ascii=False), "longueur", out["length"], "m ; MNT", GRID, "px à", round(px, 2), "m")


if __name__ == "__main__":
    main()
