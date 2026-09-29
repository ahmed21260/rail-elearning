// Personnage 3D squeletté (mannequin Mixamo « Xbot », animations idle/walk/run) habillé en agent de la
// voie : tenue haute visibilité, bandes rétroréfléchissantes, gants, chaussures de sécurité, casque.
// La tenue est peinte dans le shader à partir de la position en pose de liaison (T-pose, mètres).
import * as THREE from "three";
import { clone as skClone } from "three/addons/utils/SkeletonUtils.js";

export const OUTFITS = {
  agent: { suit: 0xff5a0a, legs: 0xff5a0a, band: 0xdfe4e8, helmet: 0xf4f4f0, glove: 0x2a2f36 },
  chef: { suit: 0xffd21a, legs: 0x1f2a3a, band: 0xdfe4e8, helmet: 0xf4f4f0, glove: 0x6b4a2b },
};

function outfitMaterial(src, o, joints) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uSuit: { value: new THREE.Color(o.suit) },
      uLegs: { value: new THREE.Color(o.legs) },
      uBand: { value: new THREE.Color(o.band) },
      uGlove: { value: new THREE.Color(o.glove) },
      // THREE.Color(hex) convertit sRGB → linéaire : aucune couleur en dur dans le shader
      uSkin: { value: new THREE.Color(o.skin ?? 0xb98a6e) },
      uBoot: { value: new THREE.Color(0x1c1c1e) },
    });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBind;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBind = position;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBind;\nuniform vec3 uSuit, uLegs, uBand, uGlove, uSkin, uBoot;")
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `vec3 b = vBind; float h = b.y; float ax = abs(b.x);
        vec3 col = h < 0.07 ? uBoot : (h < 0.95 ? uLegs : (h < 1.56 ? uSuit : uSkin));
        if (h > 1.30 && ax > 0.68) col = uGlove;                       // gants
        float band = 0.0;
        band += step(abs(h - 0.30), 0.022) + step(abs(h - 0.40), 0.022);  // jambes
        band += step(abs(h - 1.02), 0.02) + step(abs(h - 1.10), 0.02);   // taille
        if (ax < 0.22) band += step(abs(h - 1.30), 0.02);                 // poitrine
        if (h > 1.30 && ax > 0.40 && ax < 0.68) band += step(abs(ax - 0.60), 0.018); // manches
        if (band > 0.0 && h > 0.07 && h < 1.56) col = uBand;
        ${joints ? "col *= 0.82;" : ""}
        vec4 diffuseColor = vec4( col, opacity );`,
      );
    m.userData.shader = sh;
  };
  m.customProgramCacheKey = () => `worker-${o.suit}-${o.legs}-${joints}`;
  src.dispose?.();
  return m;
}

/** Crée un personnage à partir du glTF chargé. Même interface que l'ancien avatar procédural. */
export function buildWorker(scene, gltf, outfit = "agent") {
  const o = OUTFITS[outfit];
  const root = new THREE.Group();
  const model = skClone(gltf.scene);
  model.traverse((c) => {
    if (!c.isSkinnedMesh) return;
    c.material = outfitMaterial(c.material, o, c.material.name?.includes("Joints"));
    c.castShadow = true;
    c.frustumCulled = false;
  });
  root.add(model);
  // Casque de chantier fixé sur l'os de la tête
  const head = model.getObjectByName("mixamorigHead") || model.getObjectByName("mixamorig:Head");
  const hm = new THREE.MeshStandardMaterial({ color: o.helmet, roughness: 0.3 });
  const helmet = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm);
  shell.scale.set(1, 0.9, 1.12);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.012, 28), hm);
  brim.scale.z = 1.18;
  brim.position.z = 0.02;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.26), hm);
  ridge.position.y = 0.118;
  helmet.add(shell, brim, ridge);
  helmet.traverse((c) => (c.castShadow = true));
  helmet.position.set(0, 0.105, 0.012);
  if (head) {
    // l'os est à l'échelle 1/100 de l'armature : on compense
    const s = 1 / head.getWorldScale(new THREE.Vector3()).x || 100;
    helmet.scale.setScalar(s);
    helmet.position.multiplyScalar(s);
    head.add(helmet);
  }
  scene.add(root);

  const mixer = new THREE.AnimationMixer(model);
  const clip = (n) => gltf.animations.find((a) => a.name === n);
  const act = Object.fromEntries(["idle", "walk", "run", "agree", "headShake"].filter(clip).map((n) => [n, mixer.clipAction(clip(n))]));
  for (const a of Object.values(act)) a.play().setEffectiveWeight(0);
  act.idle.setEffectiveWeight(1);
  let gesture = null;

  const st = { x: 0, z: 0, yaw: 0, speed: 0 };
  const api = {
    root,
    st,
    mixer,
    /** Geste ponctuel (« agree », « headShake ») mélangé par-dessus l'idle. */
    gesture(name) {
      if (!act[name]) return;
      gesture = { a: act[name], t: 0, d: act[name].getClip().duration };
      gesture.a.reset().setEffectiveWeight(1).play();
    },
    /** Joue les animations sans déplacement (PNJ). */
    animate(dt, speed = 0) {
      const wWalk = THREE.MathUtils.clamp(speed / 1.8, 0, 1) * (1 - THREE.MathUtils.clamp((speed - 1.8) / 2.5, 0, 1));
      const wRun = THREE.MathUtils.clamp((speed - 1.8) / 2.5, 0, 1);
      let wIdle = 1 - wWalk - wRun;
      if (gesture) {
        gesture.t += dt;
        const k = Math.min(1, gesture.t / 0.3, (gesture.d - gesture.t) / 0.3);
        gesture.a.setEffectiveWeight(Math.max(0, k));
        wIdle *= 1 - Math.max(0, k);
        if (gesture.t >= gesture.d) {
          gesture.a.setEffectiveWeight(0);
          gesture = null;
        }
      }
      act.idle.setEffectiveWeight(Math.max(0, wIdle));
      act.walk.setEffectiveWeight(wWalk);
      act.run.setEffectiveWeight(wRun);
      // cadence proportionnelle à la vitesse (walk ≈ 1,5 m/s, run ≈ 4,5 m/s dans les clips)
      act.walk.timeScale = speed > 0.1 ? THREE.MathUtils.clamp(speed / 1.5, 0.6, 1.6) : 1;
      act.run.timeScale = speed > 2 ? THREE.MathUtils.clamp(speed / 4.5, 0.7, 1.4) : 1;
      mixer.update(dt);
    },
    update(dt, move, camYaw, run, heightAt) {
      const len = Math.hypot(move.fwd, move.side);
      const target = len > 0.05 ? (run ? 4.6 : 1.7) * Math.min(1, len) : 0;
      st.speed += (target - st.speed) * Math.min(1, dt * 6);
      if (len > 0.05) {
        const want = camYaw - Math.atan2(move.side, move.fwd);
        const d = ((want - st.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        st.yaw += d * Math.min(1, dt * 10);
      }
      st.x += -Math.sin(st.yaw) * st.speed * dt;
      st.z += -Math.cos(st.yaw) * st.speed * dt;
      api.place(heightAt);
      api.animate(dt, st.speed);
    },
    place(heightAt) {
      root.position.set(st.x, heightAt(st.x, st.z), st.z);
      root.rotation.y = st.yaw + Math.PI; // le modèle regarde vers +Z
    },
    set visible(v) {
      root.visible = v;
    },
    get visible() {
      return root.visible;
    },
  };
  return api;
}
