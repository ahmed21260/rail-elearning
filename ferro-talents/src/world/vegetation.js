// Végétation : arbres procéduraux (feuillus + sapins des Vosges) avec vent et LOD,
// herbe dense autour de la caméra, fougères / fleurs / buissons / rochers (Poly Haven).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { tex, chunked, loadImage, BASE } from "../core/assets.js";
import { lineLength, frame, project, rng, fbm, noise2 } from "./line.js";
import { groundHeight, forestMask, fieldAt, dem } from "./terrain.js";

export const wind = { value: 0 };

/** Ajoute le balancement au vent (dépend de la hauteur locale et de la position de l'instance). */
function addWind(mat, { amp = 0.08, freq = 1.6, heightRef = 8, flutter = 0 } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uWind = wind;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      {
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float h = clamp(position.y / ${heightRef.toFixed(1)}, 0.0, 1.0);
        float ph = ip.x * 0.37 + ip.z * 0.23;
        float sway = sin(uWind * ${freq.toFixed(2)} + ph) * 0.6 + sin(uWind * ${(freq * 2.3).toFixed(2)} + ph * 1.7) * 0.25;
        transformed.x += sway * ${amp.toFixed(3)} * h * h * ${heightRef.toFixed(1)};
        transformed.z += cos(uWind * ${(freq * 0.8).toFixed(2)} + ph) * ${(amp * 0.5).toFixed(3)} * h * h * ${heightRef.toFixed(1)};
        ${flutter ? `transformed.y += sin(uWind * 7.0 + position.x * 5.0 + ph) * ${flutter.toFixed(3)} * h;` : ""}
      }`,
    );
  };
  return mat;
}

// ------------------------------------------------------------------------------------
// Textures de feuillage générées depuis l'atlas de feuilles scannées (Poly Haven)
async function leafAtlas() {
  const [diff, alpha] = await Promise.all([
    loadImage(`${BASE}/textures/island_tree_02/leaves_diff.jpg`),
    loadImage(`${BASE}/textures/island_tree_02/leaves_alpha.jpg`),
  ]);
  const W = diff.width;
  const Hh = diff.height;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = Hh;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(alpha, 0, 0);
  const a = g.getImageData(0, 0, W, Hh);
  g.drawImage(diff, 0, 0);
  const d = g.getImageData(0, 0, W, Hh);
  for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = a.data[i];
  g.putImageData(d, 0, 0);
  // Repérage des feuilles (composantes connexes sur une version réduite)
  const S = 128;
  const small = document.createElement("canvas");
  small.width = small.height = S;
  const sg = small.getContext("2d", { willReadFrequently: true });
  sg.drawImage(alpha, 0, 0, S, S);
  const m = sg.getImageData(0, 0, S, S).data;
  const seen = new Uint8Array(S * S);
  const boxes = [];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      if (seen[i] || m[i * 4] < 128) continue;
      let [x0, y0, x1, y1, n] = [x, y, x, y, 0];
      const st = [i];
      seen[i] = 1;
      while (st.length) {
        const k = st.pop();
        const kx = k % S;
        const ky = (k / S) | 0;
        n++;
        [x0, y0, x1, y1] = [Math.min(x0, kx), Math.min(y0, ky), Math.max(x1, kx), Math.max(y1, ky)];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = kx + dx;
          const ny = ky + dy;
          if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
          const j = ny * S + nx;
          if (!seen[j] && m[j * 4] >= 128) {
            seen[j] = 1;
            st.push(j);
          }
        }
      }
      if (n > 25) boxes.push([(x0 / S) * W, (y0 / S) * Hh, ((x1 - x0 + 1) / S) * W, ((y1 - y0 + 1) / S) * Hh]);
    }
  }
  return { canvas: c, boxes };
}

/** Grappe de feuilles : rameaux + ~70 feuilles orientées vers l'extérieur, ombrées vers le centre. */
function clusterTexture(atlas, seed, { size = 512, count = 70, tint = [1, 1, 1] } = {}) {
  const r = rng(seed);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const cx = size / 2;
  g.strokeStyle = "#4a3a2a";
  g.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    g.lineWidth = 3 + r() * 3;
    g.beginPath();
    g.moveTo(cx, cx);
    g.quadraticCurveTo(cx + Math.cos(a + 0.3) * size * 0.2, cx + Math.sin(a + 0.3) * size * 0.2, cx + Math.cos(a) * size * 0.42, cx + Math.sin(a) * size * 0.42);
    g.stroke();
  }
  const leaves = [];
  for (let i = 0; i < count; i++) {
    const rad = Math.sqrt(r()) * size * 0.4;
    const a = r() * Math.PI * 2;
    leaves.push({ x: cx + Math.cos(a) * rad, y: cx + Math.sin(a) * rad, a, rad, b: atlas.boxes[Math.floor(r() * atlas.boxes.length)], s: 0.11 + r() * 0.06, dark: r() });
  }
  leaves.sort((p, q) => p.rad - q.rad); // les feuilles extérieures par-dessus
  for (const L of leaves) {
    const [bx, by, bw, bh] = L.b;
    const h = size * L.s * 1.3;
    const w = (h * bw) / bh;
    g.save();
    g.translate(L.x, L.y);
    g.rotate(L.a + Math.PI / 2 + (r() - 0.5) * 0.9);
    const shade = 0.55 + 0.45 * (L.rad / (size * 0.4)) + (L.dark - 0.5) * 0.2;
    g.filter = `brightness(${shade.toFixed(2)}) saturate(1.1)`;
    g.drawImage(atlas.canvas, bx, by, bw, bh, -w / 2, -h, w, h);
    g.restore();
  }
  if (tint.some((v) => v !== 1)) {
    // Teinte en conservant l'alpha d'origine (sinon la carte devient opaque)
    const keep = document.createElement("canvas");
    keep.width = keep.height = size;
    keep.getContext("2d").drawImage(c, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = `rgb(${tint.map((v) => Math.round(Math.min(v, 1) * 255)).join(",")})`;
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(keep, 0, 0);
    g.globalCompositeOperation = "source-over";
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Rameau de sapin : aiguilles sombres le long d'un axe, dégradé vers la pointe. */
function needleTexture(seed, size = 256) {
  const r = rng(seed);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.strokeStyle = "#3a2c1e";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(size / 2, size);
  g.lineTo(size / 2, size * 0.05);
  g.stroke();
  for (let i = 0; i < 900; i++) {
    const t = r();
    const y = size * (1 - t * 0.95);
    const side = r() < 0.5 ? -1 : 1;
    const len = size * (0.08 + 0.3 * (1 - t) * (0.6 + 0.4 * r()));
    const l = 18 + 28 * (1 - t) + r() * 14;
    g.strokeStyle = `hsl(${120 + r() * 25}, ${35 + r() * 20}%, ${l}%)`;
    g.lineWidth = 1.2 + r();
    g.beginPath();
    g.moveTo(size / 2, y);
    g.lineTo(size / 2 + side * len, y - len * (0.3 + r() * 0.3));
    g.stroke();
  }
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  return tx;
}

// ------------------------------------------------------------------------------------
// Géométries d'arbres
function branch(parts, p0, p1, r0, r1, seg = 7) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * len * 0.8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(p0.x, p0.y, p0.z);
  parts.push(g);
}

function card(cards, center, size, r, up = 0) {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2 + (r() - 0.5) * 1.6 + up);
  g.rotateY(r() * Math.PI * 2);
  g.translate(center.x, center.y, center.z);
  // Normales orientées vers l'extérieur de la couronne : éclairage « volumique »
  const n = g.attributes.normal;
  const out = new THREE.Vector3(center.x, (center.y - 4) * 0.4, center.z).normalize();
  for (let i = 0; i < n.count; i++) n.setXYZ(i, out.x, out.y + 0.5, out.z);
  cards.push(g);
}

function broadleaf(seed) {
  const r = rng(seed);
  const wood = [];
  const cards = [];
  const trunkH = 2.8 + r() * 1.6;
  const top = new THREE.Vector3((r() - 0.5) * 0.4, trunkH, (r() - 0.5) * 0.4);
  branch(wood, new THREE.Vector3(0, -0.3, 0), top, 0.34, 0.24, 9);
  const nMain = 5 + Math.floor(r() * 3);
  for (let i = 0; i < nMain; i++) {
    const a = (i / nMain) * Math.PI * 2 + r() * 0.6;
    const el = 0.5 + r() * 0.6;
    const L = 3 + r() * 2.2;
    const p1 = top.clone().add(new THREE.Vector3(Math.cos(a) * Math.cos(el) * L, Math.sin(el) * L + 0.8, Math.sin(a) * Math.cos(el) * L));
    branch(wood, top, p1, 0.18, 0.08);
    for (let k = 0; k < 3; k++) {
      const u = 0.45 + r() * 0.5;
      const q0 = top.clone().lerp(p1, u);
      const a2 = a + (r() - 0.5) * 2;
      const L2 = 1.2 + r() * 1.4;
      const q1 = q0.clone().add(new THREE.Vector3(Math.cos(a2) * L2, 0.4 + r() * 1.2, Math.sin(a2) * L2));
      branch(wood, q0, q1, 0.07, 0.03, 5);
      for (let c = 0; c < 4; c++) card(cards, q0.clone().lerp(q1, 0.3 + r() * 0.8).add(new THREE.Vector3((r() - 0.5) * 1.4, (r() - 0.3) * 1.2, (r() - 0.5) * 1.4)), 1.9 + r() * 1.1, r);
    }
    for (let c = 0; c < 3; c++) card(cards, p1.clone().add(new THREE.Vector3((r() - 0.5) * 1.5, (r() - 0.5) * 1, (r() - 0.5) * 1.5)), 2.2 + r(), r);
  }
  // Remplissage intérieur de la couronne
  const crownC = top.clone().add(new THREE.Vector3(0, 2.6, 0));
  for (let c = 0; c < 18; c++) {
    const v = new THREE.Vector3(r() - 0.5, (r() - 0.35) * 0.8, r() - 0.5).normalize().multiplyScalar(1.5 + r() * 2.2);
    card(cards, crownC.clone().add(v), 2.4 + r() * 1.2, r);
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(cards), height: crownC.y + 3.5 };
}

function fir(seed) {
  const r = rng(seed);
  const wood = [];
  const cards = [];
  const H = 14 + r() * 8;
  branch(wood, new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, H, 0), 0.32, 0.03, 8);
  const tiers = Math.floor(H / 0.75);
  for (let t = 2; t < tiers; t++) {
    const y = (t / tiers) * H;
    const R = (1 - t / tiers) * (3.2 + r() * 0.6) + 0.35;
    const n = Math.max(3, Math.round(R * 3));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.7 + r() * 0.3;
      const g = new THREE.PlaneGeometry(0.9 + R * 0.25, R * 1.25);
      g.translate(0, R * 0.62, 0);
      g.rotateX(-Math.PI / 2 + 0.55 + r() * 0.2);
      g.rotateY(-a + Math.PI / 2);
      g.translate(0, y, 0);
      const nrm = g.attributes.normal;
      for (let k = 0; k < nrm.count; k++) nrm.setXYZ(k, Math.cos(a) * 0.8, 0.6, Math.sin(a) * 0.8);
      cards.push(g);
    }
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(cards), height: H + 0.5 };
}

// ------------------------------------------------------------------------------------
function makeImpostor(renderer, meshes, height, size = 256) {
  const sc = new THREE.Scene();
  const grp = new THREE.Group();
  for (const m of meshes) grp.add(m.clone());
  sc.add(grp);
  sc.add(new THREE.HemisphereLight(0xeef4ff, 0x4a4030, 2.4));
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.position.set(6, 12, 10);
  sc.add(sun);
  const box = new THREE.Box3().setFromObject(grp);
  const sz = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const w = Math.max(sz.x, sz.z);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, sz.y / 2, -sz.y / 2, 0.01, 200);
  cam.position.set(ctr.x, ctr.y, ctr.z + 60);
  cam.lookAt(ctr);
  const h = Math.round((size * sz.y) / w);
  const rt = new THREE.WebGLRenderTarget(size, h, { samples: 4 });
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const prev = renderer.getRenderTarget();
  const pc = renderer.getClearColor(new THREE.Color());
  const pa = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(sc, cam);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(pc, pa);
  const a = new THREE.PlaneGeometry(w, sz.y);
  a.translate(0, box.min.y + sz.y / 2, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide });
  return { geometry: mergeGeometries([a, b]), material: mat };
}

// ------------------------------------------------------------------------------------
/** Construit toute la végétation. Retourne { update(cameraPos) } pour le LOD et l'herbe. */
/** Fusion tolérante : mêmes attributs et même indexation pour toutes les géométries. */
function mergeSafe(geos) {
  if (geos.length === 1) return geos[0];
  const common = ["position", "normal", "uv"].filter((a) => geos.every((g) => g.attributes[a]));
  const indexed = geos.every((g) => g.index);
  const list = geos.map((g0) => {
    const g = indexed ? g0 : g0.index ? g0.toNonIndexed() : g0;
    for (const a of Object.keys(g.attributes)) if (!common.includes(a)) g.deleteAttribute(a);
    return g;
  });
  return mergeGeometries(list, false);
}

/**
 * Essence à partir d'un modèle glTF : pièces fusionnées par matériau, hauteur normalisée, pied à y = 0,
 * vent ajouté, teinte légère (varie selon l'essence).
 */
function treeFromModel(kind, gltf, height, tint) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const k = height / (box.max.y - box.min.y);
  const c = box.getCenter(new THREE.Vector3());
  const norm = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld));
    for (const a of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const parts = [];
  for (const [mat0, geos] of byMat) {
    const leafy = !!(mat0.alphaTest || mat0.transparent || mat0.alphaMap || /leaf|leav|needle|branch|folia|spruce|pine/i.test(mat0.name));
    const mat = mat0.clone();
    mat.transparent = false;
    if (leafy) {
      mat.alphaTest = THREE.MathUtils.clamp(mat.alphaTest || 0.3, 0.2, 0.4); // seuil du modèle (feuillage dense)
      mat.side = THREE.DoubleSide;
    }
    mat.color.multiply(new THREE.Color(...tint));
    mat.roughness = Math.max(mat.roughness ?? 0.8, 0.75);
    mat.metalness = 0;
    addWind(mat, leafy ? { amp: 0.018, heightRef: height, flutter: 0.03 } : { amp: 0.01, heightRef: height });
    parts.push({ geometry: mergeSafe(geos), material: mat, cast: true });
  }
  return { kind, parts, height };
}

export async function buildVegetation(renderer, scene, { quality, models, trees, isFree }) {
  const atlas = await leafAtlas();
  const barkMat = new THREE.MeshStandardMaterial({
    map: tex("bark_brown_02/Diffuse.jpg"),
    normalMap: tex("bark_brown_02/nor_gl.jpg", { srgb: false }),
    roughness: 0.95,
  });
  addWind(barkMat, { amp: 0.012, heightRef: 10 });
  const leafMats = [0, 1, 2].map((k) =>
    addWind(
      new THREE.MeshStandardMaterial({
        map: clusterTexture(atlas, 100 + k, { tint: [[1, 1, 1], [0.92, 1.0, 0.82], [1.05, 0.98, 0.85]][k] }),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.8,
        emissive: new THREE.Color(0.02, 0.035, 0.0),
      }),
      { amp: 0.02, heightRef: 10, flutter: 0.04 },
    ),
  );
  const needleMat = addWind(new THREE.MeshStandardMaterial({ map: needleTexture(7), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }), { amp: 0.012, heightRef: 18 });

  // Variantes : arbres scannés/modélisés (Sketchfab) si disponibles, sinon arbres procéduraux
  const species = [];
  // Feuillus : hêtre (×2 tailles) et bouleau ; conifères : sapin dense (×2) et épicéa élancé
  const real = { broad: trees?.hetre || trees?.bouleau, fir: trees?.pin || trees?.epicea };
  const variants = (list) => list.filter(([m]) => m);
  if (real.broad) for (const [m, h, t] of variants([[trees.hetre, 19, [1, 1, 1]], [trees.hetre, 15, [0.94, 1.02, 0.9]], [trees.bouleau, 17, [1.02, 1.0, 0.95]]])) species.push(treeFromModel("broad", m, h, t));
  else for (let k = 0; k < 4; k++) {
    const t = broadleaf(31 + k * 17);
    species.push({ kind: "broad", parts: [{ geometry: t.wood, material: barkMat, cast: true }, { geometry: t.leaves, material: leafMats[k % 3], cast: true }], height: t.height });
  }
  if (real.fir) for (const [m, h, t] of variants([[trees.pin, 22, [1, 1, 1]], [trees.pin, 17, [0.9, 0.97, 0.93]], [trees.epicea, 25, [1.02, 1.04, 0.98]]])) species.push(treeFromModel("fir", m, h, t));
  else for (let k = 0; k < 3; k++) {
    const t = fir(211 + k * 13);
    species.push({ kind: "fir", parts: [{ geometry: t.wood, material: barkMat, cast: true }, { geometry: t.leaves, material: needleMat, cast: true }], height: t.height });
  }
  for (const sp of species) sp.imp = makeImpostor(renderer, sp.parts.map((p) => new THREE.Mesh(p.geometry, p.material)), sp.height);
  const broadIdx = species.flatMap((sp, i) => (sp.kind === "broad" ? [i] : []));
  const firIdx = species.flatMap((sp, i) => (sp.kind === "fir" ? [i] : []));

  // Répartition : forêts des coteaux (sapins en altitude), haies de parcelles, arbres isolés
  const r = rng(2024);
  const len = lineLength();
  const items = species.map(() => []);
  const add = (x, z, fir, scale = 1) => {
    const pool = fir ? firIdx : broadIdx;
    const k = pool[Math.floor(r() * pool.length)];
    const y = groundHeight(x, z) - 0.2;
    const s = scale * (0.75 + r() * 0.5);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s * (0.9 + r() * 0.2), s));
    const tint = 0.82 + r() * 0.3;
    items[k].push({ m, c: new THREE.Color(tint * (0.95 + r() * 0.1), tint, tint * (0.9 + r() * 0.1)) });
  };
  const SP = quality === "low" ? 13 : 8.5;
  const REACH = quality === "low" ? 1300 : 2400;
  for (let s = -600; s < len + 600; s += SP) {
    const f = frame(s);
    for (let lat = -REACH; lat < REACH; lat += SP) {
      const x = f.x + f.rx * lat + (r() - 0.5) * SP;
      const z = f.z + f.rz * lat + (r() - 0.5) * SP;
      if (Math.abs(lat) < 14 || !isFree(x, z)) continue;
      const fm = forestMask(x, z);
      if (fm > 0.4 && r() < Math.min(1, fm * 1.5)) {
        const alt = dem(x, z) - f.y;
        add(x, z, r() < 0.25 + 0.6 * Math.min(Math.max(alt / 120, 0), 1), 1);
      } else if (fm < 0.3) {
        const fc = fieldAt(x, z);
        if (fc.edge < 3.5 && r() < 0.35) add(x, z, false, 0.9);
        else if (r() < 0.004) add(x, z, r() < 0.2, 1.1);
      }
    }
  }

  // LOD : par cellule, arbres 3D près de la caméra, imposteurs au loin
  // Arbres réalistes (≈ 7 000 triangles) : cellules plus fines et 3D complète seulement à proximité
  const detailed = !!(real.broad || real.fir);
  const CELL = detailed ? 80 : 160;
  const cells = new Map();
  const near = quality === "low" ? 0 : detailed ? (quality === "ultra" ? 160 : 100) : 230;
  species.forEach((sp, k) => {
    const byCell = new Map();
    for (const it of items[k]) {
      const e = it.m.elements;
      const key = `${Math.floor(e[12] / CELL)},${Math.floor(e[14] / CELL)}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key).push(it);
    }
    for (const [key, list] of byCell) {
      if (!cells.has(key)) {
        const [cx, cz] = key.split(",").map(Number);
        cells.set(key, { center: new THREE.Vector3((cx + 0.5) * CELL, 0, (cz + 0.5) * CELL), full: [], far: [] });
      }
      const cell = cells.get(key);
      const mk = (geo, mat, cast) => {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((it, i) => {
          im.setMatrixAt(i, it.m);
          im.setColorAt(i, it.c);
        });
        im.computeBoundingSphere();
        im.castShadow = cast;
        im.receiveShadow = true;
        scene.add(im);
        return im;
      };
      if (near) for (const p of sp.parts) cell.full.push(mk(p.geometry, p.material, p.cast));
      cell.far.push(mk(sp.imp.geometry, sp.imp.material, false));
      cell.center.y = list[0].m.elements[13];
    }
  });

  // Sous-bois et bords de voie : buissons, fougères, fleurs, rochers, souches (modèles Poly Haven)
  const placeModel = (gltf, count, where, scaleRange = [0.8, 1.4], cast = true) => {
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.material.transparent = false;
        o.material.alphaTest = 0.45;
        parts.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material });
      }
    });
    const list = [];
    for (let i = 0; i < count * 6 && list.length < count; i++) {
      const p = where(r);
      if (!p) continue;
      const sc = scaleRange[0] + r() * (scaleRange[1] - scaleRange[0]);
      list.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(p.x, groundHeight(p.x, p.z) - 0.05, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(sc, sc, sc)) });
    }
    for (const part of parts) chunked(scene, part.geometry, part.material, list, { cell: 120, cast });
  };
  const alongTrack = (a0, a1, s0 = -100, s1 = len + 100) => (rr) => {
    const s = s0 + rr() * (s1 - s0);
    const side = rr() < 0.5 ? -1 : 1;
    const f = frame(s);
    const lat = side * (a0 + rr() * (a1 - a0));
    const x = f.x + f.rx * lat;
    const z = f.z + f.rz * lat;
    return isFree(x, z) ? { x, z } : null;
  };
  const forestEdge = (rr) => {
    const s = -100 + rr() * (len + 200);
    const f = frame(s);
    const lat = (rr() < 0.5 ? -1 : 1) * (20 + rr() * 200);
    const x = f.x + f.rx * lat;
    const z = f.z + f.rz * lat;
    const fm = forestMask(x, z);
    return fm > 0.3 && fm < 0.9 && isFree(x, z) ? { x, z } : null;
  };
  const k = quality === "low" ? 0.35 : 1;
  placeModel(models.shrub_02, Math.round(900 * k), alongTrack(9.5, 30), [0.7, 1.5]);
  placeModel(models.fern_02, Math.round(1400 * k), (rr) => (rr() < 0.5 ? forestEdge(rr) : alongTrack(7.2, 12)(rr)), [0.8, 1.6], false);
  placeModel(models.celandine_01, Math.round(900 * k), alongTrack(9, 26), [1.0, 1.8], false);
  placeModel(models.grass_medium_02, Math.round(2500 * k), alongTrack(5.8, 10), [1.2, 2.2], false);
  placeModel(models.rock_moss_set_01, Math.round(120 * k), forestEdge, [0.6, 1.4]);
  placeModel(models.tree_stump_01, Math.round(60 * k), forestEdge, [0.8, 1.2]);

  // Herbe dense autour de la caméra (tuiles recyclées)
  const grass = quality === "low" ? null : grassField(scene, isFree);

  return {
    update(cam) {
      for (const c of cells.values()) {
        const d = Math.hypot(c.center.x - cam.x, c.center.z - cam.z);
        const full = d < near + CELL * 0.7;
        for (const m of c.full) m.visible = full;
        for (const m of c.far) m.visible = !full;
      }
      grass?.update(cam);
    },
  };
}

function grassField(scene, isFree) {
  const TILE = 12;
  const RAD = 3; // tuiles de rayon → 7×7
  const PER = 1100;
  const blade = new THREE.PlaneGeometry(0.06, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const p = blade.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) * (1 - y * 0.85));
    p.setZ(i, y * y * 0.18);
  }
  blade.computeVertexNormals();
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    cols.set([0.16 + y * 0.28, 0.28 + y * 0.36, 0.08 + y * 0.1], i * 3);
  }
  blade.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const mat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), { amp: 0.12, freq: 2.2, heightRef: 0.6 });
  const pool = [];
  const active = new Map();
  const make = (tx, tz) => {
    const im = pool.pop() || new THREE.InstancedMesh(blade, mat, PER);
    const r = rng((tx * 73856093) ^ (tz * 19349663));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let n = 0;
    for (let i = 0; i < PER; i++) {
      const x = (tx + r()) * TILE;
      const z = (tz + r()) * TILE;
      const dens = 0.55 + 0.45 * noise2(x * 0.08, z * 0.08);
      if (r() > dens || !isFree(x, z, true)) continue;
      const h = 0.25 + r() * 0.35;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.02, z), q, new THREE.Vector3(1, h, 1));
      im.setMatrixAt(n++, m);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  let last = "";
  return {
    update(cam) {
      const tx = Math.floor(cam.x / TILE);
      const tz = Math.floor(cam.z / TILE);
      const key = `${tx},${tz}`;
      if (key === last) return;
      last = key;
      const want = new Set();
      for (let i = -RAD; i <= RAD; i++) for (let j = -RAD; j <= RAD; j++) want.add(`${tx + i},${tz + j}`);
      for (const [k, im] of active) {
        if (!want.has(k)) {
          scene.remove(im);
          pool.push(im);
          active.delete(k);
        }
      }
      let built = 0;
      for (const k of want) {
        if (active.has(k) || built > 6) continue;
        const [a, b] = k.split(",").map(Number);
        active.set(k, make(a, b));
        built++;
      }
      if (built > 6) last = ""; // suite au prochain appel (étalement de la charge)
    },
  };
}
