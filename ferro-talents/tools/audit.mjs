// Audit technique Ferro Talents : saturation (couleurs et charge GPU), fuites mémoire, espaces colorimétriques.
// Usage : Q=high node ferro-talents/tools/audit.mjs [dossier_captures]
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pw = require("/opt/node22/lib/node_modules/playwright");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
    res.end(d);
  });
}).listen(0);
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--js-flags=--expose-gc"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(`http://localhost:${server.address().port}/index.html?q=${process.env.Q || "high"}`);
await page.waitForFunction(() => window.__ft?.world, null, { timeout: 900000, polling: 1000 });
await page.evaluate(() => window.__ft.store.set("welcomed", true));

let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) fail++; };

// Statistiques GPU d'une image (renderer.info) + mémoire
const frameStats = () => page.evaluate(() => {
  const F = window.__ft; const r = F.core.renderer;
  r.info.autoReset = false; r.info.reset(); F.core.render(); r.info.autoReset = true;
  const i = r.info;
  return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, texs: i.memory.textures, progs: i.programs.length, heapMB: Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6) };
});

// Saturation des couleurs mesurée sur l'image rendue (canvas WebGL, zone 3D uniquement)
const colorStats = (label) => page.evaluate(async (label) => {
  const F = window.__ft; F.snapCam(); F.core.render();
  const src = document.getElementById("gl");
  const c = document.createElement("canvas"); c.width = 320; c.height = 180;
  const g = c.getContext("2d"); g.drawImage(src, 0, 0, 320, 180);
  const d = g.getImageData(0, 0, 320, 180).data;
  let sat = 0, hi = 0, clip = 0, lum = 0, n = 0;
  for (let k = 0; k < d.length; k += 4) {
    const r = d[k] / 255, gg = d[k + 1] / 255, b = d[k + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const s = mx > 0 ? (mx - mn) / mx : 0;
    sat += s; if (s > 0.75 && mx > 0.35) hi++; if (mx > 0.99) clip++;
    lum += 0.2126 * r + 0.7152 * gg + 0.0722 * b; n++;
  }
  return { label, sat: +(sat / n).toFixed(3), fortementSatures: +((hi / n) * 100).toFixed(1), brules: +((clip / n) * 100).toFixed(1), luminance: +(lum / n).toFixed(3) };
}, label);

// Textures couleur sans sRGB, cartes de données en sRGB, matériaux avec NaN
const colorSpaceAudit = () => page.evaluate(() => {
  const issues = new Set();
  const colorSlots = ["map", "emissiveMap"];
  const dataSlots = ["normalMap", "roughnessMap", "metalnessMap", "aoMap", "displacementMap", "alphaMap", "bumpMap"];
  window.__ft.world.scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const s of colorSlots) if (m[s] && m[s].colorSpace !== "srgb") issues.add(`${s} non sRGB : ${m.name || m.type} (${o.name || o.type})`);
      for (const s of dataSlots) if (m[s] && m[s].colorSpace === "srgb") issues.add(`${s} en sRGB : ${m.name || m.type} (${o.name || o.type})`);
      if (m.color && [m.color.r, m.color.g, m.color.b].some((v) => !Number.isFinite(v))) issues.add(`couleur NaN : ${m.name}`);
      if (m.emissive && m.emissiveIntensity > 4 && !/beacon|lamp|head/i.test(m.name)) issues.add(`émissif très fort (${m.emissiveIntensity}) : ${m.name || m.type}`);
    }
  });
  return [...issues];
});

const shot = async (name) => {
  if (!out) return;
  fs.mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: "jpeg", quality: 85, timeout: 300000 });
};

// 1. Charge GPU et couleurs par vue
const views = {
  hub: () => window.__ft.showHub(),
  monde: () => { const F = window.__ft; F.enterWorld(); F.rig.o = { yaw: 2.2, pitch: 0.18, dist: 9 }; },
  train: () => { const F = window.__ft; F.startJob("train"); F.job.debug.t.s = 2300; F.job.camMode = "cab"; },
  pelle: () => { const F = window.__ft; F.startJob("pelle"); F.job.camMode = "follow"; },
  nacelle: () => { const F = window.__ft; F.startJob("nacelle"); F.job.camMode = "orbit"; },
};
const table = [];
for (const [name, fn] of Object.entries(views)) {
  await page.evaluate(`(${fn.toString()})()`);
  await page.evaluate(() => window.__ft.job?.update(0.05));
  const fs_ = await frameStats();
  const cs = await colorStats(name);
  table.push({ vue: name, ...fs_, ...cs });
  await shot(`audit-${name}`);
}
console.table(table);
for (const r of table) {
  check(r.calls < 2500, `${r.vue} : appels de dessin ${r.calls} < 2500`);
  check(r.sat < 0.42, `${r.vue} : saturation moyenne ${r.sat} < 0,42`);
  check(r.fortementSatures < 12, `${r.vue} : pixels très saturés ${r.fortementSatures} % < 12 %`);
  check(r.brules < 3, `${r.vue} : pixels brûlés ${r.brules} % < 3 %`);
}

// 2. Espaces colorimétriques
const cs = await colorSpaceAudit();
for (const i of cs.slice(0, 20)) console.log("  ·", i);
check(cs.length === 0, `espaces colorimétriques cohérents (${cs.length} anomalie(s))`);

// 3. Fuites : 6 cycles entrée/sortie de chaque métier + intro
const before = await page.evaluate(() => { window.__ft.showHub(); const r = window.__ft.core.renderer; window.__ft.core.render(); return { geos: r.info.memory.geometries, texs: r.info.memory.textures, children: window.__ft.world.scene.children.length }; });
for (let c = 0; c < 6; c++) {
  await page.evaluate(() => {
    const F = window.__ft;
    for (const id of ["train", "pelle", "nacelle"]) { F.startJob(id); for (let i = 0; i < 5; i++) F.job.update(0.05); F.core.render(); F.job.mission.fail("audit"); F.endJob(); }
    F.startIntro(); F.intro.skip(); F.intro.skip();
    F.showHub(); F.core.render();
  });
}
const after = await page.evaluate(() => { const r = window.__ft.core.renderer; window.__ft.core.render(); return { geos: r.info.memory.geometries, texs: r.info.memory.textures, children: window.__ft.world.scene.children.length }; });
console.log("fuites avant/après 6 cycles :", JSON.stringify(before), JSON.stringify(after));
check(after.children <= before.children, `pas d'objets orphelins dans la scène (${before.children} → ${after.children})`);
check(after.geos - before.geos < 20, `géométries stables (${before.geos} → ${after.geos})`);
check(after.texs - before.texs < 5, `textures stables (${before.texs} → ${after.texs})`);

const real = errors.filter((e) => !/GPU stall|ReadPixels|Automatic fallback/i.test(e));
for (const e of real.slice(0, 10)) console.log("  !", e);
check(real.length === 0, `aucune erreur ni avertissement console (${real.length})`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
