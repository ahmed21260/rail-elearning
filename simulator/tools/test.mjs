// Tests du simulateur : logique (pilote automatique accéléré) + captures d'écran.
// Usage : node simulator/tools/test.mjs [dossier_captures]
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let pw;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try { pw = require(p); break; } catch {}
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
const types = { ".html": "text/html", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".gltf": "model/gltf+json" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
    res.end(d);
  });
}).listen(0);
const url = `http://localhost:${server.address().port}/index.html?q=${process.env.Q || "low"}`;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text()));
await page.goto(url);
await page.waitForFunction(() => window.__sim?.ready, null, { timeout: 300000, polling: 500 });
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
const fps = await page.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 5 ? requestAnimationFrame(f) : ok(((performance.now() - t0) / 5).toFixed(0))); requestAnimationFrame(f); }));
console.log(`temps moyen par image (rendu logiciel, sans GPU) : ${fps} ms`);
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) fail++; };

// Pilote automatique : vitesse cible = min(limite − 5, courbe de freinage vers le prochain arrêt)
const drive = (policy) => page.evaluate((policy) => {
  const S = window.__sim;
  S.begin(policy !== "reckless");
  S.pause(true);
  const sc = S.sc;
  const log = [];
  for (let i = 0; i < 20000 && sc.st.status === "running"; i++) {
    const s = S.sim.s, v = S.sim.v;
    let target = (sc.speedLimit(s) - 5) / 3.6;
    if (s < 4350) target = Math.min(target, Math.sqrt((55 / 3.6) ** 2 + 2 * 0.45 * Math.max(4350 - s - 30, 0)));
    const n = sc.nextSignal(s);
    if (n && sc.closed(n.id)) target = Math.min(target, Math.sqrt(2 * 0.45 * Math.max(n.s - s - 25, 0)));
    const off = 4920 - s;
    if (s > 4300 && off > -2) target = Math.min(target, Math.sqrt(2 * 0.45 * Math.max(off - 1, 0)) + (off > 1 ? 0.6 : 0));
    let lever = Math.max(-1, Math.min(1, (target - v) * 0.8));
    if (n && sc.closed(n.id) && n.s - s < 40 && v < 1) lever = -1;
    if (policy === "reckless") lever = 1;
    S.step(0.05, lever);
    if (i % 200 === 0) log.push(`${Math.round(s)}m ${Math.round(v * 3.6)}km/h`);
  }
  return { status: sc.st.status, score: sc.st.score, penalties: sc.st.penalties.map((p) => p.text), fail: sc.st.failReason, t: Math.round(S.sim.t), s: Math.round(S.sim.s), kvb: sc.st.kvbTrips, open: Object.fromEntries(Object.entries(sc.sig).map(([k, x]) => [k, x.open])) };
}, policy);

const good = await drive("good");
console.log("conducteur prudent :", JSON.stringify(good));
check(good.status === "success", "le conducteur prudent réussit la mission");
check(good.score >= 90, `score du conducteur prudent ≥ 90 (${good.score})`);
check(good.open.C1 && good.open.S2 && !good.open.C3, "C1 et S2 s'ouvrent, C3 reste fermé");

const bad = await drive("reckless");
console.log("conducteur imprudent :", JSON.stringify(bad));
check(bad.kvb >= 1, "le contrôle de vitesse déclenche le freinage d'urgence");
check(bad.status !== "success", "le conducteur imprudent ne réussit pas");
check(bad.s < 1900 || bad.status === "failed", "il est arrêté avant le carré C 19, ou la mission échoue au franchissement");

if (out) {
  fs.mkdirSync(out, { recursive: true });
  const shot = async (name, s, cam, setup) => {
    await page.evaluate(({ s, cam, setup }) => {
      const S = window.__sim;
      S.begin(true);
      S.pause(true);
      S.sim.s = s;
      S.sim.v = setup?.v ?? 30;
      S.sim.t = setup?.t ?? 60;
      if (setup?.open) S.sc.sig[setup.open].open = true;
      S.setCam(cam);
    }, { s, cam, setup });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(out, `${name}.jpg`), type: "jpeg", quality: 85, timeout: 180000 });
  };
  await shot("01-cabine-avertissement", 560, "cab", {});
  await shot("02-cabine-carre", 1700, "cab", { v: 15 });
  await shot("03-exterieur", 1868, "chase", { v: 0 });
  await shot("04-libre", 1868, "orbit", { v: 0 });
  await shot("05-gare", 4760, "cab", { v: 12, open: "S2" });
  await page.evaluate(() => { document.getElementById("hud").hidden = true; document.getElementById("start").hidden = false; window.__sim.setCam("chase"); });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(out, "00-menu.jpg"), type: "jpeg", quality: 85, timeout: 180000 });
}
check(errors.length === 0, `aucune erreur JavaScript${errors.length ? " : " + errors.join(" | ") : ""}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
