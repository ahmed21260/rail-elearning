// Signal lumineux à cible (panneau noir, liseré blanc, feux à visières, plaque d'identification).
// Disposition des feux simplifiée à but pédagogique.
import * as THREE from "three";
import { place } from "./path.js";

const COLORS = { yellow: 0xffb000, red: 0xff2a1a, green: 0x19ff7a };
const LAMPS = {
  yellow: [0.17, 0.62],
  red: [0.17, 0.18],
  red2: [-0.2, 0.18],
  green: [0.17, -0.26],
};

let glowTexture;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.75)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.18)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function plateTexture(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f4ef";
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = "#111";
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 150);
  g.fillStyle = "#111";
  g.font = "700 76px Inter, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSignal(scene, { s, lat, label, lamps }) {
  const root = new THREE.Group();
  const galv = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.5, metalness: 0.7 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xa19e96, roughness: 0.95 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const PANEL_Y = 4.6;
  add(new THREE.BoxGeometry(0.8, 0.55, 0.8), concrete, 0, -0.35, 0);
  add(new THREE.CylinderGeometry(0.085, 0.1, PANEL_Y + 0.4, 14), galv, 0, (PANEL_Y + 0.4) / 2 - 0.1, -0.05);
  // Échelle d'accès
  for (const x of [-0.2, 0.2]) add(new THREE.BoxGeometry(0.03, PANEL_Y - 0.9, 0.03), galv, x, (PANEL_Y - 0.9) / 2 + 0.2, -0.22);
  for (let y = 0.5; y < PANEL_Y - 0.8; y += 0.3) add(new THREE.BoxGeometry(0.4, 0.025, 0.025), galv, 0, y, -0.22);
  // Cible : liseré blanc puis fond noir
  add(new THREE.BoxGeometry(0.98, 1.72, 0.06), white, 0, PANEL_Y, 0.02);
  add(new THREE.BoxGeometry(0.88, 1.62, 0.08), black, 0, PANEL_Y, 0.04);
  // Plaque d'identification
  const plate = add(new THREE.PlaneGeometry(0.46, 0.29), new THREE.MeshStandardMaterial({ map: plateTexture(label), roughness: 0.6 }), 0, PANEL_Y - 1.1, 0.02);
  plate.castShadow = false;

  const lampState = {};
  const visorGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.24, 18, 1, true, -Math.PI / 2, Math.PI);
  visorGeo.rotateX(Math.PI / 2);
  for (const [name, [x, y]] of Object.entries(LAMPS)) {
    const color = COLORS[name === "red2" ? "red" : name];
    add(new THREE.CircleGeometry(0.15, 24), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 }), x, PANEL_Y + y, 0.085);
    const lens = add(
      new THREE.CircleGeometry(0.105, 24),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: color, emissiveIntensity: 0, roughness: 0.15 }),
      x,
      PANEL_Y + y,
      0.09,
    );
    const visor = add(visorGeo, black, x, PANEL_Y + y + 0.005, 0.2);
    visor.material = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, side: THREE.DoubleSide, roughness: 0.6 });
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
    );
    glow.position.set(x, PANEL_Y + y, 0.3);
    root.add(glow);
    lampState[name] = { lens, glow };
  }
  // Face avant (+Z local) tournée vers le train qui arrive.
  place(root, s, lat);
  scene.add(root);

  const world = new THREE.Vector3();
  const api = {
    root,
    s,
    lat,
    /** Point monde d'un feu ou du panneau (pour les étiquettes). */
    anchor(name = "panel", out = new THREE.Vector3()) {
      const p = name === "plate" ? [0, PANEL_Y - 1.1] : name === "panel" ? [0, PANEL_Y] : LAMPS[name];
      root.updateMatrixWorld();
      return out.set(p[0], name === "panel" || name === "plate" ? p[1] : PANEL_Y + p[1], 0.1).applyMatrix4(root.matrixWorld);
    },
    /** lit : { yellow: 0..1, red: 0..1, ... } ; cameraPos pour dimensionner le halo. */
    update(lit, cameraPos) {
      for (const [name, st] of Object.entries(lampState)) {
        const k = lit[name] || 0;
        st.lens.material.emissiveIntensity = 7 * k;
        st.lens.material.color.setScalar(0.04 + 0.5 * k);
        st.glow.getWorldPosition(world);
        const d = world.distanceTo(cameraPos);
        const size = 0.55 + d * 0.016;
        st.glow.scale.set(size, size, 1);
        st.glow.material.opacity = 0.9 * k;
      }
    },
  };
  api.update(lamps, new THREE.Vector3());
  return api;
}
