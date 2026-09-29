// Agent de la voie à pied : combinaison orange haute visibilité, bandes rétroréfléchissantes,
// casque, chaussures de sécurité. Marche et course animées procéduralement.
import * as THREE from "three";

function limb(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, len, 6, 12);
  g.translate(0, -len / 2 - r, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

export function buildAvatar(scene) {
  const hv = new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.65, emissive: 0x2a0d00 });
  const band = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.25, metalness: 0.7 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1f2a3a, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a78, roughness: 0.6 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35 });

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.98;
  root.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 6, 14), hv);
  torso.position.y = 0.33;
  torso.scale.set(1.1, 1, 0.75);
  torso.castShadow = true;
  body.add(torso);
  for (const y of [0.2, 0.36]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.045, 18, 1, true), band);
    b.position.y = y;
    b.scale.set(1.1, 1, 0.75);
    body.add(b);
  }
  const head = new THREE.Group();
  head.position.y = 0.83;
  body.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin);
  face.scale.set(0.9, 1.05, 0.95);
  face.castShadow = true;
  head.add(face);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
  helmet.position.y = 0.03;
  helmet.castShadow = true;
  head.add(helmet);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.02, 20), white);
  brim.position.set(0, 0.03, -0.02);
  head.add(brim);
  const mk = (x, y, r, len, mat, parent) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const upper = limb(r, len, mat);
    pivot.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -len - 2 * r;
    pivot.add(knee);
    parent.add(pivot);
    return { pivot, knee };
  };
  const arms = [-1, 1].map((sd) => {
    const a = mk(sd * 0.25, 0.58, 0.055, 0.22, hv, body);
    const fore = limb(0.05, 0.2, hv);
    a.knee.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), navy);
    hand.position.y = -0.33;
    a.knee.add(hand);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.035, 12, 1, true), band);
    cuff.position.y = -0.17;
    a.knee.add(cuff);
    return a;
  });
  const legs = [-1, 1].map((sd) => {
    const l = mk(sd * 0.1, 0.05, 0.075, 0.36, hv, body);
    const shin = limb(0.065, 0.34, hv);
    l.knee.add(shin);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.04, 12, 1, true), band);
    b2.position.y = -0.22;
    l.knee.add(b2);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.27), boot);
    foot.position.set(0, -0.5, -0.05);
    foot.castShadow = true;
    l.knee.add(foot);
    return l;
  });
  scene.add(root);

  const st = { x: 0, z: 0, yaw: 0, speed: 0, phase: 0 };
  return {
    root,
    st,
    update(dt, move, camYaw, run, heightAt) {
      const len = Math.hypot(move.fwd, move.side);
      const target = len > 0.05 ? (run ? 5.0 : 1.8) : 0;
      st.speed += (target - st.speed) * Math.min(1, dt * 6);
      if (len > 0.05) {
        const want = camYaw - Math.atan2(move.side, move.fwd);
        const d = ((want - st.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        st.yaw += d * Math.min(1, dt * 10);
      }
      st.x += -Math.sin(st.yaw) * st.speed * dt;
      st.z += -Math.cos(st.yaw) * st.speed * dt;
      root.position.set(st.x, heightAt(st.x, st.z), st.z);
      root.rotation.y = st.yaw;
      // Cycle de marche : amplitude et cadence selon la vitesse
      st.phase += dt * (2.2 + st.speed * 1.6);
      const k = Math.min(st.speed / 1.8, 1.6);
      const s = Math.sin(st.phase);
      legs[0].pivot.rotation.x = s * 0.55 * k;
      legs[1].pivot.rotation.x = -s * 0.55 * k;
      legs[0].knee.rotation.x = -Math.max(0, -Math.cos(st.phase)) * 0.9 * k;
      legs[1].knee.rotation.x = -Math.max(0, Math.cos(st.phase)) * 0.9 * k;
      arms[0].pivot.rotation.x = -s * 0.45 * k;
      arms[1].pivot.rotation.x = s * 0.45 * k;
      arms[0].knee.rotation.x = arms[1].knee.rotation.x = -0.25 - 0.2 * k;
      body.position.y = 0.98 + Math.abs(Math.cos(st.phase)) * 0.04 * k;
      body.rotation.x = -0.05 * k;
      head.rotation.y = 0;
    },
    set visible(v) {
      root.visible = v;
    },
  };
}
