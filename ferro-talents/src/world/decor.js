// Décor bâti réaliste (modèles Sketchfab CC-BY) : bâtiment voyageurs de Valbruche (gare Saint-Rémy),
// hameau à colombages en face de la base travaux, village autour de la gare. Chaque objet réserve son emprise
// (pas d'arbres ni d'herbe dedans) et se pose sur le terrain réel.
import * as THREE from "three";
import { frame } from "./line.js";
import { groundHeight } from "./terrain.js";
import { blockers, STATION } from "./depot.js";
import { TRACK_LAT } from "./track.js";

/**
 * Pose un modèle : grand axe parallèle à la voie, hauteur normalisée, pied au point le plus bas du terrain
 * sous l'emprise. Refuse (null) si la pente sous l'emprise dépasse `maxSlope` mètres.
 */
function put(scene, gltf, s, lat, { height, yaw = 0, maxSlope = 2.5, sink = 0.15 } = {}) {
  if (!gltf) return null;
  const o = gltf.scene.clone(true);
  o.updateMatrixWorld(true);
  const b0 = new THREE.Box3().setFromObject(o);
  const sz = b0.getSize(new THREE.Vector3());
  const k = height ? height / sz.y : 1;
  const alongX = sz.x > sz.z; // grand axe du modèle
  const inner = new THREE.Group();
  o.position.sub(b0.getCenter(new THREE.Vector3()).setY(b0.min.y));
  inner.add(o);
  inner.scale.setScalar(k);
  inner.rotation.y = alongX ? Math.PI / 2 : 0;
  const g = new THREE.Group();
  g.add(inner);
  const f = frame(s);
  const x = f.x + f.rx * lat;
  const z = f.z + f.rz * lat;
  // Emprise : échantillonnage du terrain aux coins
  const L = Math.max(sz.x, sz.z) * k * 0.5;
  const Wd = Math.min(sz.x, sz.z) * k * 0.5;
  const th = -f.th + yaw;
  const hs = [];
  for (const a of [-1, 0, 1]) for (const c of [-1, 0, 1]) {
    const lx = c * Wd;
    const lz = a * L;
    hs.push(groundHeight(x + lx * Math.cos(th) + lz * Math.sin(th), z - lx * Math.sin(th) + lz * Math.cos(th)));
  }
  const lo = Math.min(...hs);
  const hi = Math.max(...hs);
  if (hi - lo > maxSlope) return null;
  g.position.set(x, lo - sink, z);
  g.rotation.y = th;
  g.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = c.receiveShadow = true;
      const mats = [c.material].flat();
      for (const m of mats) if (m.transparent && m.opacity > 0.9) m.transparent = false;
    }
  });
  scene.add(g);
  blockers.push({ x, z, r: L + 3 });
  return g;
}

export function buildDecor(scene, sf) {
  const placed = { gare: 0, maisons: 0 };
  // Bâtiment voyageurs derrière le quai (quai : 5,5 m de large à partir de TRACK_LAT − 1,65)
  if (put(scene, sf.gare_saint_remy, STATION.from + 125, TRACK_LAT - 1.65 - 5.5 - 8.5, { height: 11, maxSlope: 6, sink: 0.6 })) placed.gare++;
  const houses = [sf.maison_troyes_8, sf.maison_troyes_2, sf.maison_troyes_f1, sf.maison_angers_1].filter(Boolean);
  const hRand = (i) => ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;
  // Hameau face à la base travaux (vu à l'arrivée), village autour de la gare
  const spots = [
    ...[270, 300, 332, 366, 405].map((s, i) => [s, 34 + hRand(i) * 14]),
    ...[5230, 5262, 5300, 5338, 5376, 5414, 5452, 5490, 5530, 5570].map((s, i) => [s, (i % 2 ? 26 : 44) + hRand(i + 7) * 10]),
    ...[5290, 5470, 5600].map((s, i) => [s, -34 - hRand(i + 21) * 12]),
  ];
  spots.forEach(([s, lat], i) => {
    const m = houses[i % houses.length];
    if (put(scene, m, s, lat, { height: 9 + hRand(i + 3) * 4, yaw: (hRand(i + 11) < 0.5 ? 0 : Math.PI) + (hRand(i + 5) - 0.5) * 0.2 })) placed.maisons++;
  });
  return placed;
}
