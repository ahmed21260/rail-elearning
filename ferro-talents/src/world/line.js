// Ligne réelle (data/line.json) : abscisse curviligne s, repère local (x = est, z = sud, y = altitude).
// Toutes les hauteurs passées à P()/sweep() sont RELATIVES au plan de la plateforme (haut du ballast).
import * as THREE from "three";

const DS = 0.5;
let X, Z, Y, TH, N, LEN;
export let LINE = null;

/** Catmull-Rom centripète simplifiée sur les points bruts (pas 10 m) → tables tous les 0,5 m. */
export function initLine(json) {
  LINE = json;
  const pts = json.points;
  const step = json.step;
  LEN = json.length;
  N = Math.round(LEN / DS) + 1;
  X = new Float64Array(N);
  Z = new Float64Array(N);
  Y = new Float64Array(N);
  TH = new Float64Array(N);
  const cr = (a, b, c, d, u) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  const pt = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let k = 0; k < N; k++) {
    const f = (k * DS) / step;
    const i = Math.min(Math.floor(f), pts.length - 2);
    const u = f - i;
    const [a, b, c, d] = [pt(i - 1), pt(i), pt(i + 1), pt(i + 2)];
    X[k] = cr(a[0], b[0], c[0], d[0], u);
    Z[k] = cr(a[1], b[1], c[1], d[1], u);
    Y[k] = b[2] + (c[2] - b[2]) * u; // profil déjà lissé : interpolation linéaire suffisante
  }
  for (let k = 0; k < N; k++) {
    const a = Math.max(0, k - 1);
    const b = Math.min(N - 1, k + 1);
    TH[k] = Math.atan2(X[b] - X[a], -(Z[b] - Z[a]));
  }
  // Déroulement de l'angle
  for (let k = 1; k < N; k++) {
    while (TH[k] - TH[k - 1] > Math.PI) TH[k] -= 2 * Math.PI;
    while (TH[k] - TH[k - 1] < -Math.PI) TH[k] += 2 * Math.PI;
  }
  buildIndex();
}

export const lineLength = () => LEN;

/** Prolonge la ligne en ligne droite au-delà des extrémités (butoirs, décor). */
export function frame(s) {
  const cs = Math.min(Math.max(s, 0), LEN - 0.001);
  const f = cs / DS;
  const i = Math.min(Math.floor(f), N - 2);
  const u = f - i;
  const th = TH[i] + (TH[i + 1] - TH[i]) * u;
  const fx = Math.sin(th);
  const fz = -Math.cos(th);
  const ext = s - cs;
  return {
    x: X[i] + (X[i + 1] - X[i]) * u + fx * ext,
    z: Z[i] + (Z[i + 1] - Z[i]) * u + fz * ext,
    y: Y[i] + (Y[i + 1] - Y[i]) * u,
    th,
    fx,
    fz,
    rx: Math.cos(th),
    rz: Math.sin(th),
  };
}

export const trackY = (s) => frame(s).y;

/** Rampe en ‰ à l'abscisse s (positive = montée dans le sens des s croissants). */
export function grade(s) {
  return ((trackY(s + 10) - trackY(s - 10)) / 20) * 1000;
}

export function P(s, lat = 0, y = 0, out = new THREE.Vector3()) {
  const f = frame(s);
  return out.set(f.x + f.rx * lat, f.y + y, f.z + f.rz * lat);
}

export function place(obj, s, lat = 0, y = 0, yaw = 0) {
  const f = frame(s);
  obj.position.set(f.x + f.rx * lat, f.y + y, f.z + f.rz * lat);
  obj.rotation.set(0, -f.th + yaw, 0);
  return obj;
}

/** Pose un véhicule ferroviaire en tenant compte du tangage (rampe). */
export function placeOnTrack(obj, s, lat, length, yaw = 0) {
  const a = P(s - length / 2, lat);
  const b = P(s + length / 2, lat);
  obj.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = b.sub(a).normalize();
  if (yaw) dir.negate();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
  return obj;
}

export function matrixAt(m, s, lat, y, yaw = 0, sx = 1, sy = 1, sz = 1) {
  const f = frame(s);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -f.th + yaw);
  return m.compose(new THREE.Vector3(f.x + f.rx * lat, f.y + y, f.z + f.rz * lat), q, new THREE.Vector3(sx, sy, sz));
}

/** Balayage d'un profil (lat, y) le long de la ligne (profil dans le sens horaire). */
export function sweep({ s0, s1, step, profile, lat = 0, y = 0, closed = false, uScale = 1, vScale = 1 }) {
  const latFn = typeof lat === "function" ? lat : () => lat;
  const yFn = typeof y === "function" ? y : () => y;
  const edges = [];
  for (let i = 0; i < profile.length - (closed ? 0 : 1); i++) edges.push([profile[i], profile[(i + 1) % profile.length]]);
  const rings = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
  const pos = new Float32Array(rings * edges.length * 6);
  const uv = new Float32Array(rings * edges.length * 4);
  const idx = [];
  const eLen = [0];
  for (const [a, b] of edges) eLen.push(eLen[eLen.length - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  for (let j = 0; j < rings; j++) {
    const s = s0 + ((s1 - s0) * j) / (rings - 1);
    const f = frame(s);
    const L = latFn(s);
    const Yv = f.y + yFn(s);
    edges.forEach(([a, b], e) => {
      [a, b].forEach((p, k) => {
        const vi = (j * edges.length + e) * 2 + k;
        const l = L + p[0];
        pos[vi * 3] = f.x + f.rx * l;
        pos[vi * 3 + 1] = Yv + p[1];
        pos[vi * 3 + 2] = f.z + f.rz * l;
        uv[vi * 2] = eLen[e + k] * uScale;
        uv[vi * 2 + 1] = s * vScale;
      });
    });
  }
  for (let j = 0; j < rings - 1; j++) {
    for (let e = 0; e < edges.length; e++) {
      const a = (j * edges.length + e) * 2;
      const b = ((j + 1) * edges.length + e) * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// --- Projection d'un point monde sur la ligne (index spatial des segments) -----------
const CELL = 50;
let grid;
function buildIndex() {
  grid = new Map();
  for (let k = 0; k < N - 1; k += 4) {
    const key = `${Math.floor(X[k] / CELL)},${Math.floor(Z[k] / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(k);
  }
}

/** Retourne { s, lat, d } du point (x, z) projeté sur la ligne ; d = Infinity au-delà de maxD. */
export function project(x, z, maxD = 200) {
  const r = Math.ceil(maxD / CELL);
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let best = Infinity;
  let bk = -1;
  for (let i = -r; i <= r; i++) {
    for (let j = -r; j <= r; j++) {
      const list = grid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const k of list) {
        const d = (X[k] - x) ** 2 + (Z[k] - z) ** 2;
        if (d < best) [best, bk] = [d, k];
      }
    }
  }
  if (bk < 0) return { s: 0, lat: 0, d: Infinity };
  // Affinage local
  let s = bk * DS;
  for (let it = 0; it < 3; it++) {
    const f = frame(s);
    const along = (x - f.x) * f.fx + (z - f.z) * f.fz;
    s = Math.min(Math.max(s + along, 0), LEN);
  }
  const f = frame(s);
  const lat = (x - f.x) * f.rx + (z - f.z) * f.rz;
  const d = Math.hypot(x - f.x - f.rx * lat, z - f.z - f.rz * lat);
  return { s, lat, d: Math.abs(lat) + d };
}

// --- Aléatoire et bruit déterministes -------------------------------------------------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

export function fbm(x, y, oct = 4) {
  let v = 0;
  let amp = 0.5;
  for (let i = 0; i < oct; i++) {
    v += amp * noise2(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 3.7;
    amp *= 0.5;
  }
  return v;
}

export const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
