#!/usr/bin/env python3
"""Éléments RÉELS du monde (IGN Géoplateforme, Licence Ouverte Etalab 2.0) sur l'emprise du jeu.

- Bâtiments : BD TOPO « batiment » (emprise, hauteur, altitudes de toit, usage) → data/ign_buildings.json
  (polygones en repère monde, hauteur des murs, hauteur de toit, type).
- Arbres : LiDAR HD MNH (hauteur de canopée, WMS-R Lambert-93) → sommets locaux = arbres réels (position,
  hauteur) ; essence d'après BD TOPO « zone_de_vegetation » (feuillus / conifères / mixte) → assets/dem_ign/trees.bin
  (uint16 x, uint16 z en pas de 0,2 m depuis le coin nord-ouest, uint8 hauteur ×4, uint8 essence) + trees.json.

Usage : python3 ferro-talents/tools/build_world_ign.py
"""
import json
import math
import struct
import urllib.parse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from build_line_ign import CACHE, FT, GEO, MAXX, MAXY, MINX, MINY, N13, OUT_DEM, PX13, R, get, world

# --- Lambert-93 (EPSG:2154) ↔ WGS84 (conique conforme sécante, GRS80 ; datum RGF93 ≈ WGS84) ---------
A_, E_ = 6378137.0, 0.0818191910428158
LON0, PHI1, PHI2, PHI0, X0L, Y0L = math.radians(3), math.radians(44), math.radians(49), math.radians(46.5), 700000.0, 6600000.0


def _t(phi):
    return math.tan(math.pi / 4 - phi / 2) / ((1 - E_ * math.sin(phi)) / (1 + E_ * math.sin(phi))) ** (E_ / 2)


def _m(phi):
    return math.cos(phi) / math.sqrt(1 - (E_ * math.sin(phi)) ** 2)


N_ = (math.log(_m(PHI1)) - math.log(_m(PHI2))) / (math.log(_t(PHI1)) - math.log(_t(PHI2)))
F_ = _m(PHI1) / (N_ * _t(PHI1) ** N_)
RHO0 = A_ * F_ * _t(PHI0) ** N_


def to_l93(lon, lat):
    phi = math.radians(lat)
    rho = A_ * F_ * _t(phi) ** N_
    th = N_ * (math.radians(lon) - LON0)
    return X0L + rho * math.sin(th), Y0L + RHO0 - rho * math.cos(th)


def from_l93(x, y):
    dx, dy = x - X0L, RHO0 - (y - Y0L)
    rho = math.copysign(math.hypot(dx, dy), N_)
    th = math.atan2(dx, dy)
    t = (rho / (A_ * F_)) ** (1 / N_)
    phi = math.pi / 2 - 2 * math.atan(t)
    for _ in range(8):
        phi = math.pi / 2 - 2 * math.atan(t * ((1 - E_ * math.sin(phi)) / (1 + E_ * math.sin(phi))) ** (E_ / 2))
    return math.degrees(th / N_ + LON0), math.degrees(phi)


def lonlat_bbox():
    lo1, la1 = math.degrees(MINX / R), math.degrees(2 * math.atan(math.exp(MINY / R)) - math.pi / 2)
    lo2, la2 = math.degrees(MAXX / R), math.degrees(2 * math.atan(math.exp(MAXY / R)) - math.pi / 2)
    return lo1, la1, lo2, la2


def wfs_all(typename):
    f = CACHE / f"{typename.split(':')[1]}.json"
    if f.exists():
        return json.loads(f.read_text())
    lo1, la1, lo2, la2 = lonlat_bbox()
    feats, start = [], 0
    while True:
        u = (f"{GEO}/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES={typename}&SRSNAME=EPSG:4326"
             f"&BBOX={la1},{lo1},{la2},{lo2},urn:ogc:def:crs:EPSG::4326&OUTPUTFORMAT=application/json&COUNT=5000&STARTINDEX={start}")
        page = json.loads(get(u, timeout=300))["features"]
        feats += page
        print(f"{typename} : {len(feats)}")
        if len(page) < 5000:
            break
        start += 5000
    f.write_text(json.dumps({"features": feats}))
    return {"features": feats}


def rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon":
        return [p[0] for p in geom["coordinates"]]
    return []


def buildings():
    out = []
    for ft in wfs_all("BDTOPO_V3:batiment")["features"]:
        p = ft["properties"]
        if p.get("etat_de_l_objet") not in (None, "En service"):
            continue
        h = p.get("hauteur") or (3.0 * (p.get("nombre_d_etages") or 2))
        tmin, tmax = p.get("altitude_minimale_toit"), p.get("altitude_maximale_toit")
        roof = max(0.0, min(8.0, (tmax - tmin))) if tmin is not None and tmax is not None else 0.0
        kind = {"Résidentiel": "res", "Agricole": "agr", "Industriel": "ind", "Commercial et services": "com", "Religieux": "rel"}.get(p.get("usage_1") or "", "res")
        if (p.get("nature") or "").startswith("Industriel"):
            kind = "ind"
        for ring in rings(ft["geometry"]):
            pts = [world(c[0], c[1]) for c in ring]
            if len(pts) < 4:
                continue
            area = 0.5 * abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1)))
            if area < 12:
                continue
            wall = max(2.5, h - roof * 0.9)
            out.append({"p": [[round(x, 2), round(z, 2)] for x, z in pts[:-1]], "h": round(wall, 1), "r": round(roof, 1), "k": kind})
    (FT / "data" / "ign_buildings.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"bâtiments : {len(out)}")


VEG = {  # nature BD TOPO → essence dominante (0 feuillus, 1 conifères, 2 mixte)
    "Forêt fermée de feuillus": 0, "Forêt ouverte": 2, "Forêt fermée mixte": 2, "Forêt fermée de conifères": 1,
    "Bois": 2, "Haie": 0, "Lande ligneuse": 0, "Peupleraie": 0, "Verger": 0, "Vigne": 0,
}


def trees(step_m=2.0, win=5, hmin=5.0):
    lo1, la1, lo2, la2 = lonlat_bbox()
    xs, ys = zip(*[to_l93(lo, la) for lo in (lo1, lo2) for la in (la1, la2)])
    bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
    W = int((bx1 - bx0) / step_m)
    Hh = int((by1 - by0) / step_m)
    mnh_f = CACHE / f"mnh_{step_m}.npy"
    if mnh_f.exists():
        M = np.load(mnh_f)
    else:
        M = np.zeros((Hh, W), np.float32)
        k = 6
        tw, th = math.ceil(W / k), math.ceil(Hh / k)
        for j in range(k):
            for i in range(k):
                x0, y1 = bx0 + i * tw * step_m, by1 - j * th * step_m
                q = dict(SERVICE="WMS", VERSION="1.3.0", REQUEST="GetMap", LAYERS="IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93",
                         STYLES="", CRS="EPSG:2154", BBOX=f"{x0},{y1 - th * step_m},{x0 + tw * step_m},{y1}", WIDTH=tw, HEIGHT=th, FORMAT="image/x-bil;bits=32")
                d = get(f"{GEO}/wms-r/wms?" + urllib.parse.urlencode(q), timeout=300)
                assert len(d) == tw * th * 4, f"MNH : réponse inattendue {len(d)} {d[:200]}"
                tile = np.frombuffer(d, "<f4").reshape(th, tw)
                h_, w_ = min(th, Hh - j * th), min(tw, W - i * tw)
                M[j * th:j * th + h_, i * tw:i * tw + w_] = tile[:h_, :w_]
                print(f"MNH {j * k + i + 1}/{k * k}")
        M[(M < 0) | (M > 60)] = 0
        np.save(mnh_f, M)
    # Sommets locaux de canopée (fenêtre win × win pixels) = houppiers individuels
    pad = win // 2
    P = np.pad(M, pad, mode="constant")
    mx = np.zeros_like(M)
    for dy in range(win):
        for dx in range(win):
            np.maximum(mx, P[dy:dy + M.shape[0], dx:dx + M.shape[1]], out=mx)
    jj, ii = np.nonzero((M >= mx) & (M >= hmin))
    hts = M[jj, ii]
    # Essences : zones de végétation BD TOPO rastérisées sur la même grille Lambert-93
    veg = Image.new("L", (W, Hh), 255)
    dr = ImageDraw.Draw(veg)
    for ft in wfs_all("BDTOPO_V3:zone_de_vegetation")["features"]:
        code = VEG.get(ft["properties"].get("nature"), 2)
        for ring in rings(ft["geometry"]):
            poly = []
            for lon, lat in ring:
                x, y = to_l93(lon, lat)
                poly.append(((x - bx0) / step_m, (by1 - y) / step_m))
            if len(poly) > 2:
                dr.polygon(poly, fill=code)
    V = np.array(veg)
    sp = V[jj, ii]
    sp[sp == 255] = 0  # arbre isolé hors zone : feuillu
    # Lambert-93 → lon/lat → repère monde ; conservation dans l'emprise
    half = N13 * PX13 / 2
    recs = []
    for x_, y_, h_, s_ in zip(bx0 + (ii + 0.5) * step_m, by1 - (jj + 0.5) * step_m, hts, sp):
        wx, wz = world(*from_l93(float(x_), float(y_)))
        if -half < wx < half and -half < wz < half:
            recs.append((wx + half, wz + half, h_, s_))
    buf = bytearray()
    for wx, wz, h_, s_ in recs:
        buf += struct.pack("<HHBB", min(65535, int(wx / 0.2)), min(65535, int(wz / 0.2)), min(255, int(h_ * 4)), int(s_))
    OUT_DEM.mkdir(parents=True, exist_ok=True)
    (OUT_DEM / "trees.bin").write_bytes(bytes(buf))
    counts = np.bincount([r[3] for r in recs], minlength=3).tolist()
    meta = {"count": len(recs), "origin": -half, "step": 0.2, "heightScale": 0.25, "species": ["feuillus", "conifères", "mixte"], "bySpecies": counts,
            "source": "IGN LiDAR HD MNH + BD TOPO zone_de_vegetation, Licence Ouverte 2.0"}
    (OUT_DEM / "trees.json").write_text(json.dumps(meta))
    print(f"arbres LiDAR : {len(recs)} {counts}")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    buildings()
    trees()
