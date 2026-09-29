// Base commune des engins rail-route : conduite sur route (modèle bicyclette), mise sur rail
// (enraillement : galets de guidage abaissés), circulation sur rail contrainte à la voie.
import * as THREE from "three";
import { frame, P, project } from "../world/line.js";
import { groundHeight } from "../world/terrain.js";
import { TRACK_LAT, RAIL_TOP_Y } from "../world/track.js";

export const MAT = {
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.42, metalness: 0.25 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xf07a13, roughness: 0.42, metalness: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf1f3f4, roughness: 0.38, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6, metalness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.85 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 0.12, metalness: 1 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.45 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8261e, roughness: 0.5 }),
  beacon: new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff8800, emissiveIntensity: 0 }),
};

/** Bandes de signalisation rouge et blanc (texture canvas). */
let hazardTex;
export function hazardMat() {
  if (!hazardTex) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d");
    for (let i = -2; i < 10; i++) {
      g.fillStyle = i % 2 ? "#d7261e" : "#f4f4f0";
      g.beginPath();
      g.moveTo(i * 32, 64);
      g.lineTo(i * 32 + 32, 64);
      g.lineTo(i * 32 + 64, 0);
      g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
    hazardTex = new THREE.CanvasTexture(c);
    hazardTex.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.5 });
}

export function box(parent, [w, h, d], [x, y, z], mat, { rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent, r, len, [x, y, z], mat, axis = "x", seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === "x") g.rotateZ(Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function wheel(parent, r, width, pos, twin = false) {
  const g = new THREE.Group();
  const tyre = new THREE.TorusGeometry(r * 0.72, r * 0.28, 12, 28);
  tyre.rotateY(Math.PI / 2);
  for (const dx of twin ? [-width * 0.26, width * 0.26] : [0]) {
    const t = new THREE.Mesh(tyre, MAT.tyre);
    t.scale.set(width * (twin ? 0.9 : 1.8) / (r * 0.56), 1, 1);
    t.position.x = dx;
    t.castShadow = true;
    g.add(t);
  }
  cyl(g, r * 0.5, width * 0.9, [0, 0, 0], MAT.steel, "x");
  g.position.set(...pos);
  parent.add(g);
  return g;
}

/** Vérin hydraulique visuel entre deux objets (points locaux), mis à jour à chaque image. */
export function ram(scene, a, pa, b, pb, r = 0.07) {
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), MAT.dark);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 1, 10), MAT.chrome);
  body.castShadow = rod.castShadow = true;
  scene.add(body, rod);
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return () => {
    a.localToWorld(A.copy(pa));
    b.localToWorld(B.copy(pb));
    const d = B.clone().sub(A);
    const L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize());
    const bl = L * 0.55;
    const rl = L * 0.5;
    body.quaternion.copy(q);
    rod.quaternion.copy(q);
    body.scale.set(1, bl, 1);
    rod.scale.set(1, rl, 1);
    body.position.copy(A).addScaledVector(d, bl / L / 2);
    rod.position.copy(B).addScaledVector(d, -rl / L / 2);
  };
}

/**
 * Engin rail-route générique.
 * opts : { wheelbase, railWheelZ: [avant, arrière], railLift, maxRoad, maxRail }
 */
export class RoadRail {
  constructor(root, opts) {
    this.root = root;
    this.o = opts;
    this.mode = "road"; // road | enrailing | rail | derailing
    this.x = 0;
    this.z = 0;
    this.yaw = 0; // 0 = orienté vers -Z
    this.v = 0;
    this.steer = 0;
    this.s = 0;
    this.guide = 0; // 0 relevés, 1 abaissés
    this.brake = false;
    this.guideArms = [];
  }
  setRoad(x, z, yaw) {
    this.mode = "road";
    Object.assign(this, { x, z, yaw, v: 0, guide: 0 });
  }
  /** Position de l'engin par rapport à la voie 1 (pour l'aide à l'enraillement). */
  railAlignment() {
    const p = project(this.x, this.z, 30);
    const f = frame(p.s);
    const trackYaw = -f.th;
    let dyaw = ((this.yaw - trackYaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const reversed = Math.abs(dyaw) > Math.PI / 2;
    if (reversed) dyaw = dyaw > 0 ? dyaw - Math.PI : dyaw + Math.PI;
    return { s: p.s, lateral: p.lat - TRACK_LAT, yawErr: dyaw, reversed, d: p.d };
  }
  canEnrail(zone) {
    const a = this.railAlignment();
    return this.mode === "road" && Math.abs(this.v) < 0.1 && a.s > zone.s - zone.half && a.s < zone.s + zone.half && Math.abs(a.lateral) < 0.35 && Math.abs(a.yawErr) < 0.08;
  }
  startEnrail() {
    const a = this.railAlignment();
    this.mode = "enrailing";
    this.s = a.s;
    this.dir = a.reversed ? -1 : 1;
  }
  startDerail() {
    if (this.mode === "rail" && Math.abs(this.v) < 0.1) this.mode = "derailing";
  }
  /** input : { throttle -1..1, steer -1..1 } ; dt en s. */
  update(dt, input) {
    const o = this.o;
    if (this.mode === "enrailing") {
      this.guide = Math.min(1, this.guide + dt * 0.35);
      if (this.guide >= 1) this.mode = "rail";
    } else if (this.mode === "derailing") {
      this.guide = Math.max(0, this.guide - dt * 0.35);
      if (this.guide <= 0) {
        const f = frame(this.s);
        const p = P(this.s, TRACK_LAT);
        this.setRoad(p.x, p.z, -f.th + (this.dir < 0 ? Math.PI : 0));
      }
    }
    const max = this.mode === "rail" ? o.maxRail : o.maxRoad;
    const canMove = (this.mode === "road" || this.mode === "rail") && !this.brake;
    const target = canMove ? input.throttle * max : 0;
    const acc = Math.abs(target) > Math.abs(this.v) ? 0.9 : 2.2;
    this.v += Math.max(-acc * dt, Math.min(acc * dt, target - this.v));
    if (this.brake) this.v *= Math.exp(-dt * 4);
    if (this.mode === "road") {
      this.steer += (input.steer * 0.55 - this.steer) * Math.min(1, dt * 3);
      this.yaw += (this.v / o.wheelbase) * Math.tan(this.steer) * dt;
      this.x += -Math.sin(this.yaw) * this.v * dt;
      this.z += -Math.cos(this.yaw) * this.v * dt;
      const y = groundHeight(this.x, this.z);
      this.root.position.set(this.x, y + o.rideHeight, this.z);
      this.root.rotation.set(0, this.yaw, 0);
    } else {
      this.s += this.v * this.dir * dt;
      const lift = o.railLift * this.guide;
      const L = o.wheelbase;
      const a = P(this.s - (L / 2) * this.dir, TRACK_LAT, RAIL_TOP_Y + o.rideHeight + lift);
      const b = P(this.s + (L / 2) * this.dir, TRACK_LAT, RAIL_TOP_Y + o.rideHeight + lift);
      if (this.mode !== "rail") {
        // Transition : interpolation de la hauteur route → rail
        const g = groundHeight(this.x, this.z) + o.rideHeight;
        const k = this.guide;
        a.y = g + (a.y - g) * k;
        b.y = g + (b.y - g) * k;
      }
      this.root.position.copy(a).add(b).multiplyScalar(0.5);
      this.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), b.sub(a).normalize());
      const e = new THREE.Euler().setFromQuaternion(this.root.quaternion, "YXZ");
      this.yaw = e.y;
      this.x = this.root.position.x;
      this.z = this.root.position.z;
    }
    for (const arm of this.guideArms) arm(this.guide);
  }
  get kmh() {
    return Math.abs(this.v) * 3.6;
  }
}
