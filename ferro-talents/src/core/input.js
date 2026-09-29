// Entrées : clavier + deux manettes virtuelles tactiles (gauche / droite) + boutons d'action.
const keys = new Set();
const pressed = new Set();
const sticks = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
const buttons = new Set();

const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
addEventListener("keydown", (e) => {
  const k = norm(e.key);
  if (!keys.has(k)) pressed.add(k);
  keys.add(k);
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && e.target === document.body) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(norm(e.key)));
addEventListener("blur", () => keys.clear());

export const input = {
  down: (k) => keys.has(k),
  /** Vrai une seule fois par appui. */
  hit(k) {
    if (pressed.has(k) || buttons.has(k)) {
      pressed.delete(k);
      buttons.delete(k);
      return true;
    }
    return false;
  },
  /** Axe clavier (−1..1) complété par la manette tactile. */
  axis(neg, pos, stick, comp) {
    let v = (neg.some((k) => keys.has(k)) ? -1 : 0) + (pos.some((k) => keys.has(k)) ? 1 : 0);
    if (stick) v += sticks[stick][comp];
    return Math.max(-1, Math.min(1, v));
  },
  /** Appui tactile simulé (boutons d'action à l'écran). */
  press(k) {
    buttons.add(k);
  },
  endFrame() {
    pressed.clear();
  },
  sticks,
};

/** Crée une manette virtuelle dans `el` (tactile et souris). */
export function joystick(el, id) {
  const knob = el.querySelector(".knob");
  let active = null;
  const set = (e) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x = (e.clientX - cx) / (r.width / 2);
    let y = (e.clientY - cy) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) [x, y] = [x / l, y / l];
    sticks[id].x = Math.abs(x) < 0.12 ? 0 : x;
    sticks[id].y = Math.abs(y) < 0.12 ? 0 : -y;
    knob.style.transform = `translate(${x * 38}%, ${y * 38}%)`;
  };
  el.addEventListener("pointerdown", (e) => {
    active = e.pointerId;
    el.setPointerCapture(e.pointerId);
    set(e);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => e.pointerId === active && set(e));
  const end = () => {
    active = null;
    sticks[id].x = sticks[id].y = 0;
    knob.style.transform = "";
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
