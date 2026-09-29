// Chargement des ressources : textures, glTF, HDR. Fonctionne en local (fichiers bruts) et
// sur un hébergeur qui ne sert pas les binaires (window.FT_ASSETS : HDR et tampons en base64).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

export const BASE = "assets";
const CFG = window.FT_ASSETS || null;
const texLoader = new THREE.TextureLoader();
const pending = [];
const cache = new Map();

/** Texture en répétition, suivie pour savoir quand tout est chargé. */
export function tex(path, { srgb = true, repeat = 1, aniso = 8 } = {}) {
  const key = `${path}|${srgb}|${repeat}`;
  if (cache.has(key)) return cache.get(key);
  let done;
  pending.push(new Promise((ok, ko) => (done = [ok, ko])));
  const t = texLoader.load(`${BASE}/textures/${path}`, () => done[0](), undefined, () => done[1](new Error(path)));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
export const texturesReady = () => Promise.all(pending);

const fetchB64 = async (url) => Uint8Array.from(atob((await (await fetch(url)).text()).trim()), (c) => c.charCodeAt(0)).buffer;

export async function loadHDR(id) {
  const loader = new HDRLoader().setDataType(THREE.FloatType);
  if (!CFG) return loader.loadAsync(`${BASE}/hdri/${id}_2k.hdr`);
  const d = loader.parse(await fetchB64(`${BASE}/hdri/${id}.hdr.b64.txt`));
  const t = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
  Object.assign(t, { flipY: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  t.needsUpdate = true;
  return t;
}

/** Modèle Poly Haven (dossier models/<id>/<id>.gltf) ou fichier .glb direct. */
export async function loadModel(id) {
  const loader = new GLTFLoader();
  if (id.endsWith(".glb")) {
    if (!CFG) return loader.loadAsync(`${BASE}/models/${id}`);
    const bin = await fetchB64(`${BASE}/models/${id}.b64.txt`);
    return new Promise((ok, ko) => loader.parse(bin, `${BASE}/models/`, ok, ko));
  }
  const dir = `${BASE}/models/${id}/`;
  if (!CFG) return loader.loadAsync(`${dir}${id}.gltf`);
  const [json, bin] = await Promise.all([fetch(`${dir}${id}.gltf.json`).then((r) => r.text()), fetchB64(`${dir}${id}.bin.b64.txt`)]);
  loader.register(() => ({ name: "preloaded_buffer", loadBuffer: (i) => (i === 0 ? Promise.resolve(bin) : null) }));
  return new Promise((ok, ko) => loader.parse(json, dir, ok, ko));
}

export function loadImage(url) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(url));
    img.src = url;
  });
}

export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} : ${r.status}`);
  return r.json();
}

/** InstancedMesh découpés en tronçons spatiaux (cellules de `cell` m) : culling efficace. */
export function chunked(parent, geo, mat, items, { cell = 150, cast = false, receive = false } = {}) {
  const groups = new Map();
  for (const it of items) {
    const e = it.m.elements;
    const k = `${Math.floor(e[12] / cell)},${Math.floor(e[14] / cell)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  const out = [];
  for (const list of groups.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.c) im.setColorAt(i, it.c);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast;
    im.receiveShadow = receive;
    parent.add(im);
    out.push(im);
  }
  return out;
}
