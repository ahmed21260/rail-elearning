// Tracé de la ligne et outils géométriques communs.
// Repère : Y vers le haut. Abscisse curviligne s (m) le long de l'axe de la plateforme
// (entre les deux voies). lat > 0 = à droite dans le sens de marche du train.
import * as THREE from "three";

export const S_MIN = -1600;
export const S_MAX = 7200;
const DS = 0.5;

// Courbure : grands rayons de ligne rapide (R = 2 500 m).
function curvature(s) {
  if (s > 350 && s < 1150) return -1 / 2800;
  if (s > 2250 && s < 3050) return 1 / 2600;
  if (s > 4050 && s < 4400) return -1 / 3000;
  return 0;
}

const N = Math.round((S_MAX - S_MIN) / DS) + 1;
const X = new Float64Array(N);
const Z = new Float64Array(N);
const TH = new Float64Array(N);
{
  const i0 = Math.round(-S_MIN / DS);
  for (let i = i0 + 1; i < N; i++) {
    const s = S_MIN + i * DS;
    TH[i] = TH[i - 1] + curvature(s - DS / 2) * DS;
    const th = (TH[i] + TH[i - 1]) / 2;
    X[i] = X[i - 1] + Math.sin(th) * DS;
    Z[i] = Z[i - 1] - Math.cos(th) * DS;
  }
  for (let i = i0 - 1; i >= 0; i--) {
    X[i] = X[i + 1];
    Z[i] = Z[i + 1] + DS;
  }
}

export function frame(s) {
  const f = Math.min(Math.max((s - S_MIN) / DS, 0), N - 1.0001);
  const i = Math.floor(f);
  const u = f - i;
  const th = TH[i] + (TH[i + 1] - TH[i]) * u;
  return {
    x: X[i] + (X[i + 1] - X[i]) * u,
    z: Z[i] + (Z[i + 1] - Z[i]) * u,
    th,
    fx: Math.sin(th),
    fz: -Math.cos(th),
    rx: Math.cos(th),
    rz: Math.sin(th),
  };
}

/** Point monde à l'abscisse s, décalage latéral lat, hauteur y. */
export function P(s, lat = 0, y = 0, out = new THREE.Vector3()) {
  const f = frame(s);
  return out.set(f.x + f.rx * lat, y, f.z + f.rz * lat);
}

/** Pose un objet sur la ligne, orienté dans le sens de marche (avant local = -Z). */
export function place(obj, s, lat = 0, y = 0, yaw = 0) {
  const f = frame(s);
  obj.position.set(f.x + f.rx * lat, y, f.z + f.rz * lat);
  obj.rotation.set(0, -f.th + yaw, 0);
  return obj;
}

export function matrixAt(m, s, lat, y, yaw = 0, sx = 1, sy = 1, sz = 1) {
  const f = frame(s);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -f.th + yaw);
  return m.compose(new THREE.Vector3(f.x + f.rx * lat, y, f.z + f.rz * lat), q, new THREE.Vector3(sx, sy, sz));
}

/**
 * Balayage d'un profil 2D (lat, y) le long de la ligne.
 * Profil ordonné dans le sens horaire (vu dans le sens de marche) → normales vers l'extérieur.
 * Chaque arête a ses propres sommets : arêtes vives dans le profil, lissage le long de s.
 */
export function sweep({ s0, s1, step, profile, lat = 0, y = 0, closed = false, uScale = 1, vScale = 1 }) {
  const latFn = typeof lat === "function" ? lat : () => lat;
  const yFn = typeof y === "function" ? y : () => y;
  const edges = [];
  for (let i = 0; i < profile.length - (closed ? 0 : 1); i++) edges.push([profile[i], profile[(i + 1) % profile.length]]);
  const rings = Math.max(2, Math.ceil((s1 - s0) / step) + 1);
  const pos = new Float32Array(rings * edges.length * 2 * 3);
  const uv = new Float32Array(rings * edges.length * 2 * 2);
  const idx = [];
  const eLen = [0];
  for (const [a, b] of edges) eLen.push(eLen[eLen.length - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  for (let j = 0; j < rings; j++) {
    const s = s0 + ((s1 - s0) * j) / (rings - 1);
    const f = frame(s);
    const L = latFn(s);
    const Y = yFn(s);
    edges.forEach(([a, b], e) => {
      [a, b].forEach((p, k) => {
        const vi = (j * edges.length + e) * 2 + k;
        const l = L + p[0];
        pos[vi * 3] = f.x + f.rx * l;
        pos[vi * 3 + 1] = Y + p[1];
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
