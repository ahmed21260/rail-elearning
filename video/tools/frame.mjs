// Rendu rapide d'images isolées pour le débogage (hors boucle d'audit officielle).
// Usage : node video/tools/frame.mjs <projet> <sortie_dir> t1 [t2 ...]
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let pw;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try { pw = require(p); break; } catch {}
}
const [proj, outDir, ...times] = process.argv.slice(2);
const root = path.resolve(proj);
fs.mkdirSync(outDir, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".hdr": "application/octet-stream", ".bin": "application/octet-stream", ".gltf": "model/gltf+json" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
    res.end(d);
  });
}).listen(0);
const port = server.address().port;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("response", (r) => { if (r.status() >= 400) console.log("[http]", r.status(), r.url()); });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(`[${m.type()}]`, m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.addInitScript(() => { window.__timelines = {}; });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/index.html${process.env.Q ? "?" + process.env.Q : ""}`);
await page.waitForFunction(() => window.__hf?.buildReady && Promise.all(Object.values(window.__hf.buildReady)).then(() => (window.__built = true)) && window.__built, null, { timeout: 300000, polling: 500 });
console.log(`build ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log("dbg", JSON.stringify(await page.evaluate(() => window.__dbg || null)));
for (const t of times) {
  const t1 = Date.now();
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent("hf-seek", { detail: { time: t } })), Number(t));
  await page.screenshot({ path: path.join(outDir, `t${String(t).padStart(5, "0")}.jpg`), quality: 85, type: "jpeg" });
  console.log(`t=${t} ${((Date.now() - t1) / 1000).toFixed(2)} s`);
}
await browser.close();
server.close();
