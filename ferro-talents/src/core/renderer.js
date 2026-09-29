// Moteur de rendu : WebGL2, ombres, post-traitement selon la qualité.
//   low    : pas de post-traitement, ombres 1024, résolution ×1
//   high   : MSAA ×4, bloom léger, ombres 4096
//   ultra  : + occlusion ambiante GTAO
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createRenderer(canvas, scene, camera) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sun = new THREE.DirectionalLight(0xfff1e0, 3.0);
  sun.castShadow = true;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  let composer = null;
  let quality = "high";
  function setQuality(q) {
    quality = q;
    const pr = Math.min(devicePixelRatio, q === "low" ? 1 : 1.5);
    renderer.setPixelRatio(pr);
    const size = q === "low" ? 1024 : q === "ultra" ? 4096 : 3072;
    sun.shadow.mapSize.set(size, size);
    const ext = q === "low" ? 45 : 80;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 1200 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    composer?.dispose();
    composer = null;
    if (q !== "low") {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      if (q === "ultra") {
        const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
        ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.1, samples: 12 });
        ao.blendIntensity = 0.8;
        composer.addPass(ao);
      }
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.92));
      composer.addPass(new OutputPass());
    }
    resize();
  }
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);

  const tmp = new THREE.Vector3();
  const sunDir = new THREE.Vector3(0.5, 0.7, 0.3).normalize();
  return {
    renderer,
    sun,
    sunDir,
    setQuality,
    get quality() {
      return quality;
    },
    render() {
      // L'ombre portée suit la zone regardée
      const focus = camera.getWorldDirection(tmp).multiplyScalar(25).add(camera.position);
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 500);
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
  };
}

/** Ciel HDRI (soleil orienté), environnement, brume assortie à l'horizon. */
export function setupSky(core, scene, hdr, bgImg, wantAzimuth) {
  const { data, width, height } = hdr.image;
  let best = -1;
  let bi = 0;
  let bj = 0;
  for (let j = 0; j < height / 2; j++) {
    for (let i = 0; i < width; i++) {
      const k = (j * width + i) * 4;
      const l = data[k] * 0.2126 + data[k + 1] * 0.7152 + data[k + 2] * 0.0722;
      if (l > best) [best, bi, bj] = [l, i, j];
    }
  }
  const phi = ((bi + 0.5) / width - 0.5) * 2 * Math.PI;
  const el = (1 - (bj + 0.5) / height - 0.5) * Math.PI;
  const src = new THREE.Vector3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
  const rotY = Math.atan2(wantAzimuth.x, wantAzimuth.y) - Math.atan2(src.x, src.z);
  core.sunDir.copy(src).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  for (let i = 0; i < data.length; i++) if (!(data[i] < 40)) data[i] = 40; // soleil = lumière directionnelle
  hdr.needsUpdate = true;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(core.renderer);
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.8;
  const bg = new THREE.Texture(bgImg);
  bg.needsUpdate = true;
  bg.mapping = THREE.EquirectangularReflectionMapping;
  bg.colorSpace = THREE.SRGBColorSpace;
  scene.background = bg;
  scene.backgroundRotation.set(0, rotY, 0);
  scene.environmentRotation.set(0, rotY, 0);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.drawImage(bgImg, 0, 0, 512, 256);
  const d = g.getImageData(0, 118, 512, 6).data;
  let r = 0;
  let gg = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) [r, gg, b] = [r + d[i], gg + d[i + 1], b + d[i + 2]];
  const n = d.length / 4;
  const horizon = new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
  scene.fog = new THREE.FogExp2(horizon, 0.00042);
  return horizon;
}
