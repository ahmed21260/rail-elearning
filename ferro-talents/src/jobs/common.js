// Cadre commun des métiers : procédure (liste d'étapes), score, fautes, fin de mission.
export function createMission(ui, steps) {
  const st = {
    score: 100,
    penalties: [],
    status: "running", // running | success | failed
    failReason: null,
    t: 0,
    step: 0,
    once: new Set(),
  };
  const api = {
    st,
    steps,
    get current() {
      return steps[st.step];
    },
    /** Valide l'étape courante si son id correspond. */
    done(id) {
      if (steps[st.step]?.id !== id) return false;
      steps[st.step].ok = true;
      st.step++;
      ui.toast(`✔ ${steps[st.step - 1].label}`, "good");
      ui.checklist(steps, st.step);
      if (st.step >= steps.length) api.success();
      return true;
    },
    is(id) {
      return steps[st.step]?.id === id;
    },
    passed(id) {
      return steps.findIndex((s) => s.id === id) < st.step;
    },
    penalize(code, pts, text, { once = true } = {}) {
      if (st.status !== "running" || (once && st.once.has(code))) return;
      st.once.add(code);
      st.score = Math.max(0, st.score - pts);
      st.penalties.push({ pts, text });
      ui.toast(`−${pts} · ${text}`, "penalty");
    },
    fail(reason) {
      if (st.status !== "running") return;
      st.status = "failed";
      st.failReason = reason;
      st.score = 0;
      ui.toast(reason, "penalty");
    },
    success() {
      if (st.status === "running") st.status = "success";
    },
  };
  ui.checklist(steps, 0);
  return api;
}

export const stars = (st) => (st.status !== "success" ? 0 : st.score >= 90 ? 3 : st.score >= 70 ? 2 : 1);

/** Retire des objets de la scène et libère leurs géométries et matériaux (pas les textures partagées). */
export function disposeAll(scene, ...objs) {
  for (const o of objs) {
    scene.remove(o);
    o.traverse((c) => {
      c.geometry?.dispose();
      for (const m of [c.material].flat()) m?.dispose();
    });
  }
}
