// Tests Ferro Talents : chargement, captures (hub, monde, métiers), pilotes automatiques par métier.
// Usage : node ferro-talents/tools/test.mjs [dossier_captures] [--only=train,pelle,nacelle] [--shots-only]
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
const ftRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// DIST=1 : teste la version publiable (dist/), CDN three.js redirigé vers la copie locale
const root = process.env.DIST ? path.join(ftRoot, "dist") : ftRoot;
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const only = (args.find((a) => a.startsWith("--only="))?.slice(7) || "accueil,train,pelle,nacelle").split(",");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".gltf": "model/gltf+json", ".glb": "model/gltf-binary" };
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
if (process.env.DIST) {
  await page.route("https://cdn.jsdelivr.net/npm/three@0.181.2/**", (route) => {
    const u = new URL(route.request().url()).pathname.replace("/npm/three@0.181.2/", "");
    const f = path.join(ftRoot, "vendor/three", u.replace(/^build\//, "").replace(/^examples\/jsm\//, "addons/"));
    route.fulfill({ path: f, contentType: "text/javascript" });
  });
}
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.__ft?.world || document.getElementById("load-text")?.textContent.startsWith("Erreur"), null, { timeout: 900000, polling: 1000 });
const loadErr = await page.evaluate(() => (window.__ft.world ? null : document.getElementById("load-text").textContent));
console.log(`chargement : ${((Date.now() - t0) / 1000).toFixed(0)} s ${loadErr || ""}`);
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? "✓" : "✗"} ${msg}`); if (!ok) fail++; };
check(!loadErr, "le monde se charge");
const shot = async (name) => {
  if (!out) return;
  fs.mkdirSync(out, { recursive: true });
  await page.evaluate(() => window.__ft.snapCam());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `${name}.jpg`), type: "jpeg", quality: 85, timeout: 300000 });
};
if (!loadErr) {
  await shot("00-hub");
  // Clic DOM direct : le rendu logiciel est trop lent pour les contrôles de stabilité de Playwright
  const click = (sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
  if (only.includes("accueil")) {
    // Arrivée : cinématique, accueil sécurité (EPI, zone dangereuse), circulation voie 2, quiz
    await page.evaluate(() => { window.__ft.startIntro(); for (let i = 0; i < 80; i++) window.__ft.intro.update(0.1); });
    check(await page.evaluate(() => window.__ft.state === "intro" && window.__ft.intro.phase === "cine"), "accueil : la cinématique démarre");
    await shot("02-cinematique");
    await page.evaluate(() => { for (let i = 0; i < 120; i++) window.__ft.intro?.update(0.1); });
    check(await page.evaluate(() => window.__ft.intro.phase === "talk" && !document.getElementById("talk").hidden), "accueil : le chef de chantier prend la parole");
    await click("#talk-next");
    await click("#talk-next"); // EPI : rien de sélectionné
    check(await page.evaluate(() => document.getElementById("talk-feedback").textContent.includes("manque")), "accueil : tenue incomplète refusée");
    for (const id of ["casque", "hv", "chaussures", "gants", "lunettes"]) await click(`.ppe[data-id="${id}"]`);
    await click("#talk-next");
    check(await page.evaluate(() => window.__ft.explore.st.highlight === 1), "accueil : zone dangereuse mise en évidence");
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__ft.intro.update(0.1); });
    await shot("03-zone-dangereuse");
    while (await page.evaluate(() => window.__ft.state === "intro")) await click("#talk-next");
    check(await page.evaluate(() => window.__ft.state === "world" && window.__ft.store.get("welcomed")), "accueil : exploration libre après l'accueil");
    const zone = await page.evaluate(() => {
      const F = window.__ft, P = window.__ftP, av = F.world.avatar;
      const at = (s, lat) => { const p = P(s, lat); Object.assign(av.st, { x: p.x, z: p.z }); av.place(() => 0); return F.explore.update(0.05, av.root.position, true).inZone; };
      const r = { between: at(600, 0), rail: at(600, -2.1), edge: at(600, -4.2), out: at(600, -4.6), far: at(600, -20) };
      at(600, 2.1);
      F.explore.st.next = F.explore.st.t;
      for (let i = 0; i < 4000 && !F.explore.st.caught; i++) F.explore.update(0.05, av.root.position, true);
      r.caught = F.explore.st.caught;
      return r;
    });
    console.log("zone dangereuse :", JSON.stringify(zone));
    check(zone.between && zone.rail && zone.edge && !zone.out && !zone.far, "zone dangereuse : 1,50 m du rail extérieur");
    check(zone.caught, "zone dangereuse : agent pris au passage du train sur la voie 2");
    await page.waitForFunction(() => window.__ft.state === "caught", null, { timeout: 60000 });
    await shot("04-accident-evite");
    await click("#caught-ok");
    const quiz = await page.evaluate(async () => {
      const F = window.__ft; F.showBrief("pelle");
      document.querySelector('#brief-nav [data-tab="2"]').click();
      const before = document.getElementById("brief-go").disabled;
      for (const [i, k] of [[0, 1], [1, 1], [2, 1]]) document.querySelector(`.quiz-q[data-i="${i}"] [data-k="${k}"]`).click();
      return { before, after: document.getElementById("brief-go").disabled, saved: F.store.get("quiz", {}).pelle };
    });
    check(quiz.before && !quiz.after && quiz.saved === 3, `quiz sécurité : poste débloqué après 3/3 (${JSON.stringify(quiz)})`);
    await shot("05-quiz");
  } else await page.evaluate(() => window.__ft.store.set("welcomed", true));
  await page.evaluate(() => window.__ft.enterWorld());
  await shot("01-monde-a-pied");
  // Pas de simulation temporelle : on appelle update() du métier en accéléré, touches simulées
  const run = (id, fnSrc, steps = 20000) =>
    page.evaluate(
      ({ id, fnSrc, steps }) => {
        const F = window.__ft;
        try {
        F.startJob(id);
        const J = F.job;
        const drive = new Function("J", "key", "tick", fnSrc);
        const held = new Set();
        const key = (k, down) => {
          if (down && !held.has(k)) { held.add(k); dispatchEvent(new KeyboardEvent("keydown", { key: k })); }
          if (!down && held.has(k)) { held.delete(k); dispatchEvent(new KeyboardEvent("keyup", { key: k })); }
        };
        const tap = (k) => { dispatchEvent(new KeyboardEvent("keydown", { key: k })); J.update(0.05); dispatchEvent(new KeyboardEvent("keyup", { key: k })); F.input.endFrame(); };
        let i = 0;
        for (; i < steps && J.mission.st.status === "running"; i++) {
          drive(J, { hold: key, tap }, i);
          J.update(0.05);
          F.input.endFrame();
        }
        for (const k of held) key(k, false);
        const m = J.mission.st;
        return { dbg: J.debugInfo?.(), target: J._target, status: m.status, score: m.score, step: J.mission.current?.id || "fin", penalties: m.penalties.map((p) => p.text), fail: m.failReason, t: Math.round(m.t) };
        } catch (e) { return { status: "exception", error: e.stack }; }
      },
      { id, fnSrc, steps },
    );

  if (only.includes("train")) {
    const r = await run("train", `
      const t = J.debug.t, sc = J.debug.sc;
      if (tick === 0) { key.tap("b"); key.tap("p"); }
      if (tick === 100) key.tap("d");
      if (tick % 400 === 0) key.tap("v");
      if (tick < 100) return;
      let target = (sc.speedLimit(t.s) - 5) / 3.6;
      const lim2 = (s0, v0) => Math.sqrt(v0 * v0 + 2 * 0.45 * Math.max(s0 - t.s - 30, 0));
      target = Math.min(target, lim2(820, 35 / 3.6), lim2(4950, 55 / 3.6));
      const n = sc.nextSignal(t.s);
      if (n && sc.closed(n.id)) target = Math.min(target, Math.sqrt(2 * 0.45 * Math.max(n.s - t.s - 25, 0)));
      const off = 5520 - t.s;
      if (t.s > 5000) target = Math.min(target, Math.sqrt(2 * 0.45 * Math.max(off - 1, 0)) + (off > 1 ? 0.6 : 0));
      if (tick > 100 && tick < 260 && t.v * 3.6 > 12) target = 0; // essai de freinage
      let lever = Math.max(-1, Math.min(1, (target - t.v) * 0.8));
      if (n && sc.closed(n.id) && n.s - t.s < 40 && t.v < 1) lever = -1;
      t.lever = lever;`, 40000);
    console.log("train :", JSON.stringify(r));
    check(r.status === "success", "conducteur de train : mission réussie par le pilote prudent");
    check(r.score >= 85, `conducteur de train : score ≥ 85 (${r.score})`);
    await page.evaluate(() => { window.__ft.startJob("train"); const t = window.__ft.job.debug.t; t.s = 1200; t.v = 25; t.batt = true; t.pantoUp = true; t.panto = 1; t.kv = 25; t.dj = true; });
    await shot("10-train-cabine");
    await page.evaluate(() => { window.__ft.input.press("c"); });
    await shot("11-train-exterieur");
  }
  if (only.includes("look")) {
    // Vues de contrôle du rendu (audit visuel)
    const views = [
      ["40-base", () => { const F = window.__ft; F.enterWorld(); F.rig.o = { yaw: 2.2, pitch: 0.18, dist: 9 }; }],
      ["41-foret", () => { const F = window.__ft; F.startJob("train"); const t = F.job.debug.t; t.s = 2300; F.job.camMode = "cab"; }],
      ["42-pelle", () => { const F = window.__ft; F.startJob("pelle"); F.job.camMode = "follow"; }],
      ["43-nacelle", () => { const F = window.__ft; F.startJob("nacelle"); F.job.camMode = "orbit"; F.rig.o = { yaw: 3.6, pitch: 0.25, dist: 16 }; }],
    ];
    for (const [name, fn] of views) {
      await page.evaluate(`(${fn.toString()})()`);
      await page.evaluate(() => window.__ft.job?.update(0.05));
      await shot(name);
    }
  }
  if (only.includes("reach")) {
    const r = await page.evaluate(() => {
      const F = window.__ft; F.startJob("pelle"); const { rr, ex } = F.job.debug;
      rr.mode = "rail"; rr.s = 930.5; rr.dir = 1; rr.guide = 1; rr.update(0, { throttle: 0, steer: 0 });
      const P = window.__ftP; const spot = P(928.5, -4.9, -0.1); const skip = window.__ftSkip();
      const j = ex.joints; let best = { d: 1e9 }, bestS = { d: 1e9 };
      for (let sw = -Math.PI; sw < Math.PI; sw += 0.1) for (let b = -0.55; b <= 1.15; b += 0.1) for (let st = -2.55; st <= -0.45; st += 0.1) {
        Object.assign(j, { swing: sw, boom: b, stick: st, bucket: 0.5 }); ex.pose(j); const t = ex.tip();
        const d = t.distanceTo(spot); if (d < best.d) best = { d, sw, b, st, tip: t.toArray().map((v) => +v.toFixed(2)) };
        const d2 = t.distanceTo(skip); if (d2 < bestS.d) bestS = { d: d2, sw, b, st };
      }
      Object.assign(j, { swing: 0, boom: 0.35, stick: -2.1, bucket: 0.9 }); ex.pose(j);
      return { spot: spot.toArray().map((v) => +v.toFixed(2)), root: ex.root.position.toArray().map((v) => +v.toFixed(2)), rest: ex.tip().toArray().map((v) => +v.toFixed(2)), best, bestS };
    });
    console.log(JSON.stringify(r));
  }
  if (only.includes("pelle")) {
    const r = await run("pelle", `
      const { st, rr, ex } = J.debug;
      const P = window.__ftP;
      if (tick === 0) key.tap("m");
      if (!J._tp) {
        // Téléporte l'engin aligné sur la rampe (le test de conduite route est manuel)
        const f = window.__ftFrame(440);
        const p = P(440, -2.1);
        rr.setRoad(p.x, p.z, -f.th);
        J._tp = true;
        return;
      }
      if (J.mission.is("enrail")) { if (rr.mode === "road") key.tap("v"); return; }
      if (J.mission.is("chantier")) { const s = rr.s; key.hold(s < 929 ? "ArrowUp" : "ArrowDown", Math.abs(s - 930.5) > 1 && rr.kmh < 9); if (Math.abs(s - 930.5) <= 1) { key.hold("ArrowUp", false); key.hold("ArrowDown", false); } return; }
      key.hold("ArrowUp", false); key.hold("ArrowDown", false);
      if (J.mission.is("frein")) { if (!rr.brake) key.tap("b"); else key.tap("t"); return; }
      if (J.mission.is("degarnir")) {
        // Cinématique inverse : pose cible par recherche, puis commande articulation par articulation
        const spots = [925, 928.5, 932, 935.5].filter((s) => !st.dug.has(s));
        const goal = st.trainS !== null ? "clear" : st.loaded ? "skip" : "dig";
        const j = ex.joints;
        if (J._goal !== goal + spots.length) {
          J._goal = goal + spots.length;
          const tgt = goal === "dig" ? P(spots[0], -4.9, -0.05) : goal === "skip" ? window.__ftSkip() : P(rr.s, -5, 3.5);
          const save = { ...j }; let best = { d: 1e9 };
          for (let sw = -0.2; sw < 3.2; sw += 0.06) for (let b = -0.55; b <= 1.15; b += 0.06) for (let stk = -2.55; stk <= -0.45; stk += 0.06) {
            Object.assign(j, { swing: sw, boom: b, stick: stk }); ex.pose(j);
            if (Math.max(...ex.probes().map(window.__ftH)) > 4.9) continue; // respecte le limiteur de hauteur
            const d = ex.tip().distanceTo(tgt);
            if (d < best.d) best = { d, swing: sw, boom: b, stick: stk };
          }
          Object.assign(j, save); ex.pose(j);
          J._target = best;
        }
        const T = J._target; const e = 0.03;
        key.hold("a", T.swing > j.swing + e); key.hold("d", T.swing < j.swing - e);
        key.hold("i", T.boom > j.boom + e); key.hold("k", T.boom < j.boom - e);
        key.hold("s", T.stick > j.stick + e); key.hold("w", T.stick < j.stick - e);
        const arrived = Math.abs(T.swing - j.swing) < 0.06 && Math.abs(T.boom - j.boom) < 0.06 && Math.abs(T.stick - j.stick) < 0.06;
        key.hold("j", goal === "dig" ? arrived : goal !== "skip" && j.bucket < 0.8);
        key.hold("l", goal === "skip" ? arrived : goal === "dig" && !arrived && j.bucket > 0.3);
        return;
      }
      for (const k of ["a", "d", "w", "s", "i", "k", "j", "l"]) key.hold(k, false);
      if (J.mission.is("transport")) {
        key.hold("j", ex.joints.bucket < 0.7); key.hold("k", ex.joints.boom > 0.4); key.hold("w", ex.joints.stick > -1.95);
        key.hold("a", ex.joints.swing < -0.05); key.hold("d", ex.joints.swing > 0.05);
        if (ex.joints.bucket >= 0.7 && ex.joints.boom <= 0.4 && ex.joints.stick <= -1.95 && Math.abs(ex.joints.swing) < 0.06 && J.debugInfo().top < 3.1 && rr.brake) { key.tap("t"); key.tap("b"); }
        if (J.debugInfo().top > 3.1) { key.hold("k", true); }
      }`, 30000);
    console.log("pelle :", JSON.stringify(r));
    check(r.status === "success", "conducteur de pelle : mission réussie (enraillement, chantier, 4 godets)");
    await shot("20-pelle");
  }
  if (only.includes("nacelle")) {
    const r = await run("nacelle", `
      const { st, rr, nc } = J.debug;
      const P = window.__ftP;
      if (tick === 0) key.tap("m");
      if (!J._tp) { const f = window.__ftFrame(440); const p = P(440, -2.1); rr.setRoad(p.x, p.z, -f.th); J._tp = true; return; }
      const is = (id) => J.mission.is(id);
      if (is("enrail")) { if (rr.mode === "road") key.tap("v"); return; }
      if (is("position")) { const d = 744.5 - rr.s; key.hold("ArrowUp", d > 1.5 && rr.kmh < (d > 40 ? 18 : 4)); key.hold("ArrowDown", d < -1.5); return; }
      key.hold("ArrowUp", false); key.hold("ArrowDown", false);
      if (is("calage")) { if (!rr.brake) key.tap("b"); else if (!st.stabDir && st.stab < 1) key.tap("x"); return; }
      if (is("consign")) { if (J._radio !== 1) { key.tap("r"); J._radio = 1; } return; }
      if (is("vat")) { key.tap("u"); return; }
      if (is("malt")) { key.tap("g"); return; }
      const j = nc.joints;
      const go = (tgt, keys) => {
        const f0 = nc.workPoint().distanceTo(tgt); const best = { k: null, d: f0 };
        for (const k of ["slew", "lower", "upper"]) for (const dv of [-0.02, 0.02]) {
          const save = j[k]; j[k] += dv; nc.move(0, {}); const d = nc.workPoint().distanceTo(tgt); j[k] = save; nc.move(0, {});
          if (d < best.d) { best.k = k; best.dv = dv; best.d = d; }
        }
        const map = { slew: ["d", "a"], lower: ["s", "w"], upper: ["k", "i"] };
        for (const [k, [neg, pos]] of Object.entries(map)) { const c = best.k === k ? Math.sign(best.dv) : 0; key.hold(pos, c > 0); key.hold(neg, c < 0); }
        return f0;
      };
      if (is("pendule")) {
        const tgt = window.__ftDropper();
        if (!J._T) {
          const save = { ...j }; let best = { d: 1e9 };
          for (let sl = -3.1; sl < 3.1; sl += 0.05) for (let lo = 0.02; lo <= 1.35; lo += 0.04) for (let up = -3.05; up <= 0.35; up += 0.04) {
            Object.assign(j, { slew: sl, lower: lo, upper: up }); nc.move(0, {}); const d = nc.workPoint().distanceTo(tgt);
            if (d < best.d) best = { d, slew: sl, lower: lo, upper: up };
          }
          Object.assign(j, save); nc.move(0, {}); J._T = best;
        }
        const T = J._T; const e = 0.02;
        key.hold("a", T.slew > j.slew + e); key.hold("d", T.slew < j.slew - e);
        key.hold("w", T.lower > j.lower + e); key.hold("s", T.lower < j.lower - e);
        key.hold("i", T.upper > j.upper + e); key.hold("k", T.upper < j.upper - e);
        key.hold("e", nc.workPoint().distanceTo(tgt) < 1.5);
        return;
      }
      key.hold("e", false);
      if (is("descente")) {
        key.hold("k", j.upper > -3.0); key.hold("s", j.lower > 0.05); key.hold("w", false); key.hold("i", false);
        key.hold("a", j.slew < -0.03); key.hold("d", j.slew > 0.03);
        if (j.lower <= 0.05 && j.upper <= -3.0) { j.lower = 0.02; j.upper = -3.05; j.slew = 0; nc.move(0, {}); }
        return;
      }
      for (const k of ["a", "d", "w", "s", "i", "k"]) key.hold(k, false);
      if (is("levee")) { key.tap("g"); return; }
      if (is("restit")) { if (J._radio !== 2) { key.tap("r"); J._radio = 2; } return; }
      if (is("rangement")) { if (st.stab > 0 && !st.stabDir) key.tap("x"); else if (st.stab <= 0 && rr.brake) key.tap("b"); }`, 30000);
    console.log("nacelle :", JSON.stringify(r));
    check(r.status === "success", "opérateur nacelle : mission réussie (consignation, VAT, MALT, pendule, restitution)");
    // Faute volontaire : monter vers la caténaire sans consignation
    const bad = await run("nacelle", `
      const { st, rr, nc } = J.debug;
      if (tick === 0) { key.tap("m"); const P = window.__ftP; const f = window.__ftFrame(440); const p = P(440, -2.1); rr.setRoad(p.x, p.z, -f.th); }
      if (tick === 1) { key.tap("v"); }
      if (rr.mode !== "rail") return;
      if (!J._moved) { rr.s = 744.5; J._moved = true; }
      if (!rr.brake) { key.tap("b"); return; }
      if (st.stab < 1) { if (!st.stabDir) key.tap("x"); return; }
      key.hold("w", true); key.hold("i", true);
      if (tick > 3000) J.mission.fail("timeout");`, 4000);
    console.log("nacelle (faute) :", JSON.stringify(bad));
    check(bad.penalties.some((p) => p.includes("3 m")) || (bad.fail || "").includes("Électrisation"), "approche < 3 m d'une caténaire sous tension : bloquée et sanctionnée");
    await shot("30-nacelle");
  }
  const fps = await page.evaluate(() => window.__fps);
  console.log(`images/s (rendu logiciel, sans GPU) : ${fps?.toFixed(2)}`);
}
check(errors.length === 0, `aucune erreur JavaScript${errors.length ? " : " + [...new Set(errors)].slice(0, 6).join(" | ") : ""}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
