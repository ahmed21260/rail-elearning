// Personnage à pied (CesiumMan, CC-BY 4.0) : marche/course animées, gilet haute visibilité.
import * as THREE from "three";

export function buildAvatar(scene, gltf) {
  const root = new THREE.Group();
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;
    }
  });
  // Normalisation : 1,78 m, pieds à y = 0
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y;
  model.scale.setScalar(1.78 / h);
  model.position.y = (-box.min.y * 1.78) / h;
  root.add(model);
  // Gilet haute visibilité (EPI obligatoire sur les emprises ferroviaires)
  const vest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7a00, emissive: 0x331400, roughness: 0.6, side: THREE.DoubleSide }),
  );
  vest.position.y = 1.2;
  vest.scale.set(1.05, 1, 0.72);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.2, side: THREE.DoubleSide }));
  band.position.y = 1.12;
  band.scale.set(1.05, 1, 0.72);
  root.add(vest, band);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  helmet.position.y = 1.7;
  root.add(helmet);
  scene.add(root);

  const mixer = new THREE.AnimationMixer(model);
  const clip = gltf.animations[0];
  const action = clip ? mixer.clipAction(clip) : null;
  action?.play();
  const st = { x: 0, z: 0, yaw: 0, speed: 0 };
  return {
    root,
    st,
    /** move : { fwd, side } dans le repère caméra ; camYaw : direction de la caméra. */
    update(dt, move, camYaw, run, heightAt) {
      const len = Math.hypot(move.fwd, move.side);
      const target = len > 0.05 ? (run ? 5.2 : 1.9) : 0;
      st.speed += (target - st.speed) * Math.min(1, dt * 6);
      if (len > 0.05) {
        const dir = Math.atan2(move.side, move.fwd);
        const want = camYaw - dir;
        let d = ((want - st.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        st.yaw += d * Math.min(1, dt * 10);
      }
      st.x += -Math.sin(st.yaw) * st.speed * dt;
      st.z += -Math.cos(st.yaw) * st.speed * dt;
      root.position.set(st.x, heightAt(st.x, st.z), st.z);
      root.rotation.y = st.yaw + Math.PI; // le modèle regarde vers +Z
      if (action) action.timeScale = st.speed / 1.6;
      mixer.update(dt);
    },
    set visible(v) {
      root.visible = v;
    },
  };
}
