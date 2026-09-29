#!/usr/bin/env python3
"""Trace une ligne ferroviaire réaliste sur le relief réel (tuiles Terrarium).

1. Chemin de moindre coût (Dijkstra) entre deux points du fond de vallée :
   coût = distance × (1 + pente pénalisée) + hauteur au-dessus du fond local.
2. Lissage : rayon de courbure ≥ R_MIN, profil en long lissé, rampe ≤ 21 ‰ (ligne de montagne).
Sortie : ferro-talents/data/line.json (points tous les 10 m, repère local en mètres :
x = est, z = sud, y = altitude) + métadonnées du MNT.
Usage : python3 ferro-talents/tools/build_line.py
"""
import heapq
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEM = ROOT / "assets" / "dem"
R_MIN = 700.0  # m
GRADE_MAX = 0.021
START_PX = (300, 760)  # (colonne, ligne) dans la mosaïque 768×768 : aval (sud-ouest)
END_PX = (760, 262)  # amont (nord-est)

t = json.loads((DEM / "tiles.json").read_text())
n = t["n"]
H = np.zeros((256 * n, 256 * n))
for i in range(n):
    for j in range(n):
        a = np.asarray(Image.open(DEM / f"{t['z']}_{t['x0'] + i}_{t['y0'] + j}.png").convert("RGB")).astype(float)
        H[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
lat = t["center"][0]
px = 40075016.686 * math.cos(math.radians(lat)) / (2 ** t["z"] * 256)  # m / pixel
N = H.shape[0]

# Fond de vallée local (minimum glissant) pour pénaliser les coteaux
from numpy.lib.stride_tricks import sliding_window_view
pad = 20
Hp = np.pad(H, pad, mode="edge")
floor = sliding_window_view(Hp, (2 * pad + 1, 2 * pad + 1)).min(axis=(2, 3))
above = H - floor

# Dijkstra 8-connexe
cost = np.full(H.shape, np.inf)
prev = -np.ones(H.shape + (2,), dtype=int)
sx, sy = START_PX
ex, ey = END_PX
cost[sy, sx] = 0
pq = [(0.0, sx, sy)]
nb = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
while pq:
    c, x, y = heapq.heappop(pq)
    if c > cost[y, x]:
        continue
    if (x, y) == (ex, ey):
        break
    for dx, dy in nb:
        X, Y = x + dx, y + dy
        if not (0 <= X < N and 0 <= Y < N):
            continue
        d = math.hypot(dx, dy) * px
        slope = abs(H[Y, X] - H[y, x]) / d
        nc = c + d * (1 + 400 * slope * slope) + 6.0 * above[Y, X]
        if nc < cost[Y, X]:
            cost[Y, X] = nc
            prev[Y, X] = (x, y)
            heapq.heappush(pq, (nc, X, Y))
path = []
x, y = ex, ey
while (x, y) != (sx, sy):
    path.append((x, y))
    x, y = prev[y, x]
path.append((sx, sy))
path.reverse()

# Repère local : origine au centre de la mosaïque, x = est, z = sud (m)
P = np.array([[(x - N / 2) * px, (y - N / 2) * px] for x, y in path])


def resample(P, step):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    s = np.arange(0, d[-1], step)
    return np.c_[np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1])]


def smooth(P, win):
    k = np.ones(win) / win
    Q = P.copy()
    for c in range(2):
        padded = np.r_[np.full(win, P[0, c]), P[:, c], np.full(win, P[-1, c])]
        Q[:, c] = np.convolve(padded, k, mode="same")[win:-win]
    Q[0], Q[-1] = P[0], P[-1]
    return Q


def max_curvature(P):
    a, b, c = P[:-2], P[1:-1], P[2:]
    ab = np.hypot(*(b - a).T)
    bc = np.hypot(*(c - b).T)
    ca = np.hypot(*(a - c).T)
    cross = np.abs((b - a)[:, 0] * (c - a)[:, 1] - (b - a)[:, 1] * (c - a)[:, 0])
    return np.max(2 * cross / (ab * bc * ca + 1e-9))


P = resample(P, 10)
win = 15
for it in range(60):
    P = resample(smooth(P, win), 10)
    if 1 / max(max_curvature(P), 1e-9) >= R_MIN:
        break
    win = min(win + 4, 80)
# Le départ imposé descend un coteau raide : on ne garde que le fond de vallée.
TRIM_START = 3200  # m
P = P[TRIM_START // 10:]
rmin = 1 / max_curvature(P)


def dem_at(x, z):
    fx = x / px + N / 2
    fz = z / px + N / 2
    i = np.clip(np.floor(fx).astype(int), 0, N - 2)
    j = np.clip(np.floor(fz).astype(int), 0, N - 2)
    u = fx - i
    v = fz - j
    return (H[j, i] * (1 - u) * (1 - v) + H[j, i + 1] * u * (1 - v) + H[j + 1, i] * (1 - u) * v + H[j + 1, i + 1] * u * v)


ground = dem_at(P[:, 0], P[:, 1])
# Profil en long : lissage fort puis limitation de rampe
y = ground.copy()
k = 61
for _ in range(3):
    y = np.convolve(np.r_[np.full(k, y[0]), y, np.full(k, y[-1])], np.ones(k) / k, mode="same")[k:-k]
for _ in range(200):
    g = np.diff(y) / 10
    if np.max(np.abs(g)) <= GRADE_MAX + 1e-6:
        break
    for i in range(1, len(y)):
        y[i] = np.clip(y[i], y[i - 1] - GRADE_MAX * 10, y[i - 1] + GRADE_MAX * 10)
    for i in range(len(y) - 2, -1, -1):
        y[i] = np.clip(y[i], y[i + 1] - GRADE_MAX * 10, y[i + 1] + GRADE_MAX * 10)

length = 10 * (len(P) - 1)
out = {
    "_doc": "Ligne générée par tools/build_line.py sur le relief réel de la vallée de la Bruche (Vosges).",
    "step": 10,
    "length": length,
    "points": [[round(float(a), 2), round(float(b), 2), round(float(c), 2)] for (a, b), c in zip(P, y)],
    "dem": {"tiles": t, "pixel": px, "size": N},
    "stats": {
        "rayon_min_m": round(float(rmin)),
        "rampe_max_pm": round(float(np.max(np.abs(np.diff(y)))) / 10 * 1000, 1),
        "remblai_max_m": round(float(np.max(y - ground)), 1),
        "deblai_max_m": round(float(np.max(ground - y)), 1),
        "altitude": [round(float(y.min())), round(float(y.max()))],
    },
}
(ROOT / "data" / "line.json").write_text(json.dumps(out))
print(json.dumps(out["stats"], ensure_ascii=False), f"longueur {length / 1000:.2f} km")
