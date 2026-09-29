// Bâti RÉEL : emprises BD TOPO (IGN, Licence Ouverte 2.0) extrudées à leur hauteur réelle, toits à deux pans
// dans l'axe du bâtiment (hauteur de toit réelle = altitude max − min du toit), croupe pour les formes complexes,
// toits plats pour les grands bâtiments industriels. Façades enduites à fenêtres, bardage pour l'industrie.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { groundHeight } from "./terrain.js";
import { blockers, isFree } from "./depot.js";

const FLOOR = 3.0; // m par niveau (motif de façade)
const PLASTER = [0xefe6d6, 0xe8dcc4, 0xf3efe6, 0xe6d2b5, 0xdcc8ae, 0xeadbd0, 0xd9cdb8]; // enduits vosgiens
const ROOFS = [0x8a4a32, 0x7a3f2c, 0x9a5a3d, 0x5b5a5c, 0x6a4636]; // tuiles terre cuite, ardoise

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Façade : un module de 3 m × 3 m avec une fenêtre à volets (texture blanche teintée par couleur de sommet). */
function facadeTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#f4f1ea";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    const x = w * 0.34, y = h * 0.22, ww = w * 0.32, hh = h * 0.5;
    g.fillStyle = "#6d6a64";
    g.fillRect(x - 6, y - 6, ww + 12, hh + 12); // encadrement
    g.fillStyle = "#23303a";
    g.fillRect(x, y, ww, hh);
    g.fillStyle = "rgba(170,200,220,0.35)";
    g.fillRect(x + 4, y + 4, ww / 2 - 6, hh / 2 - 6);
    g.fillStyle = "#e9e5dc";
    g.fillRect(x + ww / 2 - 2, y, 4, hh);
    g.fillRect(x, y + hh / 2 - 2, ww, 4);
    g.fillStyle = "#5c7a6a"; // volets
    g.fillRect(x - 6 - ww * 0.45, y - 4, ww * 0.42, hh + 8);
    g.fillRect(x + ww + 10, y - 4, ww * 0.42, hh + 8);
    g.fillStyle = "rgba(0,0,0,0.18)"; // soubassement
    g.fillRect(0, h * 0.96, w, h * 0.04);
  });
}

function roofTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#b8b3ad";
    g.fillRect(0, 0, w, h);
    const rows = 16;
    for (let r = 0; r < rows; r++) {
      const y = (r / rows) * h;
      for (let c = 0; c < 12; c++) {
        const x = ((c + (r % 2) * 0.5) / 12) * w;
        const v = 180 + Math.random() * 60;
        g.fillStyle = `rgb(${v},${v * 0.96},${v * 0.92})`;
        g.fillRect(x, y, w / 12 - 2, h / rows - 3);
      }
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(0, y + h / rows - 3, w, 3);
    }
  });
}

function signedArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/** Rectangle orienté minimal (sur les directions des arêtes) : centre, axes, demi-longueurs. */
function obb(p) {
  let best = null;
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i];
    const [x2, z2] = p[(i + 1) % p.length];
    const l = Math.hypot(x2 - x1, z2 - z1);
    if (l < 0.5) continue;
    const ux = (x2 - x1) / l, uz = (z2 - z1) / l;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of p) {
      const a = x * ux + z * uz, b = -x * uz + z * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) best = { area, ux, uz, a0, a1, b0, b1 };
  }
  if (!best) return null;
  const { ux, uz, a0, a1, b0, b1 } = best;
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  return { cx: ca * ux - cb * uz, cz: ca * uz + cb * ux, ux, uz, ha: (a1 - a0) / 2, hb: (b1 - b0) / 2, area: best.area };
}

export function buildBuildings(scene, data, quality) {
  if (!data?.length) return { count: 0 };
  const wallRes = new THREE.MeshStandardMaterial({ map: facadeTexture(), vertexColors: true, roughness: 0.92 });
  const wallInd = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTexture(), vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
  const flatMat = new THREE.MeshStandardMaterial({ color: 0x6a6763, roughness: 0.95 });
  const CELL = 400;
  const buckets = new Map(); // cellule → { res:[], ind:[], roof:[], flat:[] }
  const bucket = (x, z) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!buckets.has(k)) buckets.set(k, { res: [], ind: [], roof: [], flat: [] });
    return buckets.get(k);
  };
  const col = new THREE.Color();
  let count = 0;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (const b of data) {
    let p = b.p;
    if (p.length < 3) continue;
    // Le bâti réel ne doit pas envahir la voie, la base travaux, la gare du jeu ni les emprises déjà posées
    if (!p.every(([x, z]) => isFree(x, z, true))) continue;
    // Normale d'un mur = arête × verticale : il faut l'ordre horaire dans le plan (x, z) pour qu'elle pointe dehors
    if (signedArea(p) > 0) p = [...p].reverse();
    const ind = b.k === "ind" || b.k === "com" || b.k === "agr";
    const ys = p.map(([x, z]) => groundHeight(x, z));
    const base = Math.min(...ys) - 0.4;
    const top = Math.max(...ys) + b.h;
    const cx = p.reduce((a, q) => a + q[0], 0) / p.length;
    const cz = p.reduce((a, q) => a + q[1], 0) / p.length;
    const bk = bucket(cx, cz);
    col.setHex(ind ? [0x9aa1a6, 0xb5b0a4, 0x8c9a8e, 0xa8a39b][count % 4] : PLASTER[Math.floor(rnd() * PLASTER.length)]);
    // Murs
    const pos = [], uv = [], cl = [], idx = [];
    let run = 0;
    for (let i = 0; i < p.length; i++) {
      const [x1, z1] = p[i];
      const [x2, z2] = p[(i + 1) % p.length];
      const l = Math.hypot(x2 - x1, z2 - z1);
      const v0 = pos.length / 3;
      pos.push(x1, base, z1, x2, base, z2, x2, top, z2, x1, top, z1);
      const u0 = run / FLOOR, u1 = (run + l) / FLOOR, vt = (top - base) / FLOOR;
      uv.push(u0, 0, u1, 0, u1, vt, u0, vt);
      for (let k = 0; k < 4; k++) cl.push(col.r, col.g, col.b);
      idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
      run += l;
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    wg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    wg.setAttribute("color", new THREE.Float32BufferAttribute(cl, 3));
    wg.setIndex(idx);
    wg.computeVertexNormals();
    (ind ? bk.ind : bk.res).push(wg);
    // Toit
    const o = obb(p);
    col.setHex(ROOFS[Math.floor(rnd() * ROOFS.length)]);
    if (b.r > 0.6 && o && o.area < 1500) {
      const rh = Math.min(b.r, Math.min(o.ha, o.hb) * 1.2);
      const ov = 0.4; // débord de toit
      const along = o.ha >= o.hb; // faîtage selon le grand axe
      const [ax, az] = along ? [o.ux, o.uz] : [-o.uz, o.ux];
      const [bx, bz] = along ? [-o.uz, o.ux] : [o.ux, o.uz];
      const A = (along ? o.ha : o.hb) + ov, B = (along ? o.hb : o.ha) + ov;
      const P3 = (a, bb, y) => [o.cx + ax * a + bx * bb, y, o.cz + az * a + bz * bb];
      const eave = top - 0.15;
      const q = [P3(-A, -B, eave), P3(A, -B, eave), P3(A, B, eave), P3(-A, B, eave), P3(-A, 0, eave + rh), P3(A, 0, eave + rh)];
      const rp = [], ru = [], rc = [], ri = [];
      const quad = (a, b2, c, d, uw, vh) => {
        const v0 = rp.length / 3;
        rp.push(...a, ...b2, ...c, ...d);
        ru.push(0, 0, uw, 0, uw, vh, 0, vh);
        for (let k = 0; k < 4; k++) rc.push(col.r, col.g, col.b);
        ri.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
      };
      const slope = Math.hypot(B, rh) / 2.5;
      quad(q[0], q[1], q[5], q[4], (2 * A) / 2.5, slope); // pan 1
      quad(q[2], q[3], q[4], q[5], (2 * A) / 2.5, slope); // pan 2
      const tri = (a, b2, c) => {
        const v0 = rp.length / 3;
        rp.push(...a, ...b2, ...c);
        ru.push(0, 0, 1, 0, 0.5, 0.5);
        for (let k = 0; k < 3; k++) rc.push(col.r, col.g, col.b);
        ri.push(v0, v0 + 1, v0 + 2);
      };
      tri(q[3], q[0], q[4]); // pignons
      tri(q[1], q[2], q[5]);
      const rg = new THREE.BufferGeometry();
      rg.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3));
      rg.setAttribute("uv", new THREE.Float32BufferAttribute(ru, 2));
      rg.setAttribute("color", new THREE.Float32BufferAttribute(rc, 3));
      rg.setIndex(ri);
      rg.computeVertexNormals();
      bk.roof.push(rg);
    } else {
      // Toit plat (industrie, grands volumes) : dalle légèrement au-dessus des murs
      const shape = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z)));
      const fg = new THREE.ShapeGeometry(shape);
      fg.rotateX(-Math.PI / 2);
      fg.translate(0, top + 0.05, 0);
      bk.flat.push(fg);
    }
    blockers.push({ x: cx, z: cz, r: Math.sqrt(Math.max(o?.area || 20, 20)) * 0.75 + 1.5 });
    count++;
  }
  const meshes = [];
  for (const bk of buckets.values()) {
    for (const [list, mat] of [[bk.res, wallRes], [bk.ind, wallInd], [bk.roof, roofMat], [bk.flat, flatMat]]) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
        for (const a of Object.keys(g.attributes)) if (!["position", "normal", "uv", "color"].includes(a)) g.deleteAttribute(a);
        if (!g.attributes.color) g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
        if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        return g;
      })), mat);
      m.castShadow = quality !== "low";
      m.receiveShadow = true;
      scene.add(m);
      meshes.push(m);
    }
  }
  return { count, meshes: meshes.length };
}
