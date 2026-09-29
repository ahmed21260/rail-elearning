// Relief réel (MNT Terrarium) + terrassements de la plateforme + sol texturé par occupation.
import * as THREE from "three";
import { LINE, lineLength, frame, trackY, project, noise2, fbm, smooth } from "./line.js";
import { tex } from "../core/assets.js";

let H = null; // Float32Array N×N
let N = 0;
let PX = 1;
const pads = []; // plateformes aplanies (dépôt, gare) en repère ligne

export async function loadDEM(base) {
  const t = LINE.dem.tiles;
  N = LINE.dem.size;
  PX = LINE.dem.pixel;
  H = new Float32Array(N * N);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d", { willReadFrequently: true });
  const jobs = [];
  for (let i = 0; i < t.n; i++) {
    for (let j = 0; j < t.n; j++) {
      jobs.push(
        new Promise((ok, ko) => {
          const img = new Image();
          img.onload = () => {
            g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, 256, 256).data;
            for (let y = 0; y < 256; y++) {
              for (let x = 0; x < 256; x++) {
                const k = (y * 256 + x) * 4;
                H[(j * 256 + y) * N + i * 256 + x] = d[k] * 256 + d[k + 1] + d[k + 2] / 256 - 32768;
              }
            }
            ok();
          };
          img.onerror = ko;
          img.src = `${base}/${t.z}_${t.x0 + i}_${t.y0 + j}.png`;
        }),
      );
      // Décodage séquentiel : un seul canvas partagé
      await jobs[jobs.length - 1];
    }
  }
}

export const worldHalf = () => (N * PX) / 2;

/** Altitude brute du MNT (bilinéaire). */
export function dem(x, z) {
  const fx = Math.min(Math.max(x / PX + N / 2, 0), N - 1.001);
  const fz = Math.min(Math.max(z / PX + N / 2, 0), N - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const u = fx - i;
  const v = fz - j;
  const a = H[j * N + i];
  const b = H[j * N + i + 1];
  const c = H[(j + 1) * N + i];
  const d = H[(j + 1) * N + i + 1];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Ajoute une plateforme aplanie : s ∈ [s0, s1], lat ∈ [l0, l1], hauteur relative y. */
export function addPad(pad) {
  pads.push(pad);
}

const SLOPE = 0.66; // talus 3/2

/** Hauteur du sol au point (s, lat) exprimée en repère ligne. */
export function groundAt(s, lat) {
  const f = frame(s);
  const x = f.x + f.rx * lat;
  const z = f.z + f.rz * lat;
  return groundFromTrack(s, lat, dem(x, z));
}

function groundFromTrack(s, lat, raw) {
  const bed = trackY(Math.min(Math.max(s, 0), lineLength())) - 0.62;
  const a = Math.abs(lat);
  let g;
  if (a < 6.6) g = bed;
  else if (a < 8.6) g = bed - 0.5 * Math.exp(-(((a - 7.6) / 0.7) ** 2));
  else g = Math.min(Math.max(raw, bed - (a - 8.6) * SLOPE), bed + (a - 8.6) * SLOPE);
  for (const p of pads) {
    const ds = Math.max(p.s0 - s, 0, s - p.s1);
    const dl = Math.max(p.l0 - lat, 0, lat - p.l1);
    const d = Math.hypot(ds, dl);
    const py = bed + 0.62 + p.y;
    if (d === 0) return py;
    g = Math.min(Math.max(g, py - d * SLOPE), py + d * SLOPE);
  }
  return g;
}

/** Hauteur du sol en coordonnées monde. */
export function groundHeight(x, z) {
  const raw = dem(x, z);
  const p = project(x, z, 130);
  if (p.d > 125) return raw;
  return groundFromTrack(p.s, p.lat, raw);
}

/** Pente locale du MNT (m/m). */
export function demSlope(x, z) {
  const e = PX;
  return Math.hypot(dem(x + e, z) - dem(x - e, z), dem(x, z + e) - dem(x, z - e)) / (2 * e);
}

/** Masque de forêt : coteaux pentus et hauteurs, lisières irrégulières. */
export function forestMask(x, z) {
  const p = project(x, z, 60);
  if (p.d < 28) return 0;
  const alt = dem(x, z) - trackY(Math.min(Math.max(p.s, 0), lineLength()));
  const m = smooth(0.12, 0.26, demSlope(x, z) + 0.08 * fbm(x * 0.004, z * 0.004)) + smooth(25, 60, alt) + 0.35 * fbm(x * 0.003 + 7, z * 0.003 - 2) - 0.15;
  return Math.min(Math.max(m, 0), 1);
}

// Parcelles agricoles du fond de vallée
const FIELD = 150;
export function fieldAt(x, z) {
  const cx = Math.floor(x / FIELD + noise2(z * 0.003, 3) * 0.4);
  const cz = Math.floor(z / (FIELD * 0.7) + noise2(x * 0.003, 9) * 0.4);
  const h = (noise2(cx * 1.37 + 0.5, cz * 2.11) + 1) / 2;
  const fx = (x / FIELD + noise2(z * 0.003, 3) * 0.4) % 1;
  const fz = (z / (FIELD * 0.7) + noise2(x * 0.003, 9) * 0.4) % 1;
  const edge = Math.min(Math.abs(fx), 1 - Math.abs(fx), Math.abs(fz), 1 - Math.abs(fz)) * FIELD * 0.7;
  return { type: Math.floor(h * 4.999), edge };
}

const FIELD_TINT = [
  [1.0, 1.0, 1.0],
  [1.7, 1.38, 0.55],
  [1.0, 0.95, 0.9],
  [0.85, 1.12, 0.78],
  [1.45, 1.25, 0.75],
];
const FIELD_MUD = [0, 0.12, 1, 0, 0.55];

/** Attributs de sol : teinte + mélange (terre, sous-bois, gravier). */
function soil(x, z, lat, onStrip) {
  const a = Math.abs(lat);
  const tint = [1, 1, 1];
  let mud = 0;
  let forest = 0;
  let gravel = 0;
  if (onStrip && a < 6.6) gravel = 0.85;
  else if (onStrip && a < 9) tint.splice(0, 3, 0.85, 0.98, 0.78);
  else {
    forest = forestMask(x, z);
    if (forest < 0.5 && a > 18) {
      const f = fieldAt(x, z);
      if (f.edge > 4) {
        tint.splice(0, 3, ...FIELD_TINT[f.type]);
        mud = FIELD_MUD[f.type];
      }
    }
  }
  const n = 0.9 + 0.12 * noise2(x * 0.05, z * 0.05);
  return { tint: tint.map((v) => v * n), mud: mud * (1 - forest), forest, gravel };
}

function terrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    map: tex("Grass004/Color.jpg"),
    normalMap: tex("Grass004/NormalGL.jpg", { srgb: false }),
    normalScale: new THREE.Vector2(0.8, 0.8),
    vertexColors: true,
    roughness: 0.95,
  });
  const maps = {
    mudMap: tex("brown_mud_dry/Diffuse.jpg"),
    forestMap: tex("forest_leaves_02/Diffuse.jpg"),
    gravelMap: tex("gravel_road/Diffuse.jpg"),
  };
  mat.onBeforeCompile = (sh) => {
    for (const [k, v] of Object.entries(maps)) sh.uniforms[k] = { value: v };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvSplat = splat;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D mudMap, forestMap, gravelMap;\nvarying vec3 vSplat;")
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 grassC = texture2D( map, vMapUv );
          // Variation à grande échelle : casse la répétition de la texture
          vec4 macro = texture2D( map, vMapUv * 0.071 );
          grassC.rgb *= 0.75 + 0.5 * macro.g / max( grassC.g, 0.05 ) * 0.5;
          vec4 mudC = texture2D( mudMap, vMapUv * 0.7 );
          vec4 forC = texture2D( forestMap, vMapUv * 0.9 );
          vec4 grvC = texture2D( gravelMap, vMapUv * 1.2 );
          float n = grassC.g - 0.3;
          float km = smoothstep( 0.0, 1.0, vSplat.x + n * 0.6 * vSplat.x * ( 1.0 - vSplat.x ) * 4.0 );
          float kf = smoothstep( 0.2, 0.8, vSplat.y + n * 0.5 );
          float kg = smoothstep( 0.2, 0.8, vSplat.z + n * 0.4 );
          vec4 c = mix( grassC, mudC, km );
          c = mix( c, forC * 0.9, kf );
          c = mix( c, grvC, kg );
          diffuseColor *= c;
        #endif`,
      );
  };
  return mat;
}

function fillAttrs(pos, count, sampler) {
  const col = new Float32Array(count * 3);
  const spl = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3];
    const z = pos[v * 3 + 2];
    const { tint, mud, forest, gravel } = sampler(x, z, v);
    col.set(tint, v * 3);
    spl.set([mud, forest, gravel], v * 3);
    uv.set([x / 3.5, z / 3.5], v * 2);
  }
  return { col, spl, uv };
}

/** Bande fine le long de la ligne (±90 m) + grande grille du MNT autour. */
export function buildTerrain(scene, quality) {
  const mat = terrainMaterial();
  const len = lineLength();
  // Bande
  const side = [];
  for (let l = 5.2; l < 30; l += 1) side.push(l);
  for (let l = 30; l <= 92; l += 4) side.push(l);
  const lats = [...side.map((l) => -l).reverse(), -2, 2, ...side];
  const ss = [];
  for (let s = -300; s <= len + 300; s += 4) ss.push(s);
  const W = lats.length;
  const pos = new Float32Array(ss.length * W * 3);
  const meta = [];
  let v = 0;
  for (const s of ss) {
    const f = frame(s);
    for (const lat of lats) {
      const x = f.x + f.rx * lat;
      const z = f.z + f.rz * lat;
      pos.set([x, groundFromTrack(s, lat, dem(x, z)), z], v * 3);
      meta.push(lat);
      v++;
    }
  }
  const strip = new THREE.BufferGeometry();
  strip.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const a1 = fillAttrs(pos, v, (x, z, k) => soil(x, z, meta[k], true));
  strip.setAttribute("color", new THREE.BufferAttribute(a1.col, 3));
  strip.setAttribute("splat", new THREE.BufferAttribute(a1.spl, 3));
  strip.setAttribute("uv", new THREE.BufferAttribute(a1.uv, 2));
  const idx = [];
  for (let j = 0; j < ss.length - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      const b = (j + 1) * W + i;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  strip.setIndex(idx);
  strip.computeVertexNormals();
  const m1 = new THREE.Mesh(strip, mat);
  m1.receiveShadow = true;
  scene.add(m1);

  // Grande grille (MNT) ; abaissée sous la bande pour éviter les chevauchements
  const stride = quality === "low" ? 2 : 1;
  const G = Math.floor((N - 1) / stride) + 1;
  const gpos = new Float32Array(G * G * 3);
  const lats2 = new Float32Array(G * G);
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const x = (i * stride - N / 2) * PX;
      const z = (j * stride - N / 2) * PX;
      const p = project(x, z, 100);
      let y = H[Math.min(j * stride, N - 1) * N + Math.min(i * stride, N - 1)];
      if (p.d < 86 && p.s > -250 && p.s < len + 250) y -= 6;
      lats2[j * G + i] = p.d < 1e9 ? p.lat : 999;
      gpos.set([x, y, z], (j * G + i) * 3);
    }
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute("position", new THREE.BufferAttribute(gpos, 3));
  const a2 = fillAttrs(gpos, G * G, (x, z, k) => soil(x, z, Math.max(Math.abs(lats2[k]), 95), false));
  grid.setAttribute("color", new THREE.BufferAttribute(a2.col, 3));
  grid.setAttribute("splat", new THREE.BufferAttribute(a2.spl, 3));
  grid.setAttribute("uv", new THREE.BufferAttribute(a2.uv, 2));
  const gidx = new Uint32Array((G - 1) * (G - 1) * 6);
  let q = 0;
  for (let j = 0; j < G - 1; j++) {
    for (let i = 0; i < G - 1; i++) {
      const a = j * G + i;
      const b = (j + 1) * G + i;
      gidx.set([a, b, a + 1, a + 1, b, b + 1], q);
      q += 6;
    }
  }
  grid.setIndex(new THREE.BufferAttribute(gidx, 1));
  grid.computeVertexNormals();
  const m2 = new THREE.Mesh(grid, mat);
  m2.receiveShadow = true;
  scene.add(m2);
  return { strip: m1, grid: m2 };
}
