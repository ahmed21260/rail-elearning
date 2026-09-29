// Sons synthétisés : roulement, traction électrique, moteur diesel, hydraulique, frein, alarmes.
export function createAudio() {
  let ac = null;
  let n = null;
  let muted = false;

  function noise(ctx, brown) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const w = (seed / 0x7fffffff) * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }
  const chain = (src, ...nodes) => nodes.reduce((a, b) => (a.connect(b), b), src);

  function start() {
    if (ac) return ac.resume();
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
    const loop = (buf) => {
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };
    const brown = noise(ac, true);
    const white = noise(ac, false);
    const mk = (type, f) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.start();
      return o;
    };
    const gain = () => {
      const g = ac.createGain();
      g.gain.value = 0;
      return g;
    };
    const lp = (f) => {
      const b = ac.createBiquadFilter();
      b.type = "lowpass";
      b.frequency.value = f;
      return b;
    };
    const hp = (f) => {
      const b = ac.createBiquadFilter();
      b.type = "highpass";
      b.frequency.value = f;
      return b;
    };
    n = { master };
    n.rumbleF = lp(100);
    n.rumbleG = gain();
    chain(loop(brown), n.rumbleF, n.rumbleG, master);
    n.motor = mk("sawtooth", 50);
    n.motorG = gain();
    chain(n.motor, lp(900), n.motorG, master);
    n.hissG = gain();
    chain(loop(white), hp(2500), n.hissG, master);
    // Diesel : fondamentale + harmonique, modulée par un bruit de combustion
    n.diesel = mk("sawtooth", 28);
    n.diesel2 = mk("square", 56);
    n.dieselF = lp(260);
    n.dieselG = gain();
    chain(n.diesel, n.dieselF, n.dieselG, master);
    n.diesel2.connect(n.dieselF);
    n.hydroG = gain();
    n.hydro = mk("triangle", 180);
    chain(n.hydro, lp(700), n.hydroG, master);
    return ac.resume();
  }

  const T = () => ac.currentTime;
  return {
    start,
    /** Train : v (m/s), traction 0..1, frein 0..1. */
    train(v, traction, brake) {
      if (!n) return;
      const k = Math.min(v / 35, 1);
      n.rumbleF.frequency.setTargetAtTime(60 + 500 * k, T(), 0.2);
      n.rumbleG.gain.setTargetAtTime(v > 0.05 ? 0.05 + 0.35 * k : 0, T(), 0.3);
      n.motor.frequency.setTargetAtTime(40 + v * 11, T(), 0.2);
      n.motorG.gain.setTargetAtTime(traction * 0.035 * (0.4 + k), T(), 0.15);
      n.hissG.gain.setTargetAtTime(v > 0.3 ? brake * 0.05 : 0, T(), 0.1);
    },
    /** Engin diesel : régime 0..1 (0 = arrêté), charge hydraulique 0..1, v (m/s). */
    machine(rpm, hydro, v) {
      if (!n) return;
      const on = rpm > 0 ? 1 : 0;
      n.diesel.frequency.setTargetAtTime(24 + rpm * 30, T(), 0.3);
      n.diesel2.frequency.setTargetAtTime(48 + rpm * 60, T(), 0.3);
      n.dieselF.frequency.setTargetAtTime(180 + rpm * 400, T(), 0.3);
      n.dieselG.gain.setTargetAtTime(on * (0.05 + rpm * 0.06), T(), 0.3);
      n.hydro.frequency.setTargetAtTime(150 + hydro * 120, T(), 0.2);
      n.hydroG.gain.setTargetAtTime(on * hydro * 0.03, T(), 0.15);
      n.rumbleF.frequency.setTargetAtTime(80 + v * 30, T(), 0.2);
      n.rumbleG.gain.setTargetAtTime(v > 0.1 ? 0.04 + v * 0.02 : 0, T(), 0.3);
    },
    silence() {
      if (!n) return;
      for (const g of [n.rumbleG, n.motorG, n.hissG, n.dieselG, n.hydroG]) g.gain.setTargetAtTime(0, T(), 0.2);
    },
    beep(freq = 880, dur = 0.12, vol = 0.12, type = "square") {
      if (!ac || muted) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = freq;
      o.type = type;
      g.gain.setValueAtTime(vol, T());
      g.gain.exponentialRampToValueAtTime(0.0001, T() + dur);
      o.connect(g).connect(n.master);
      o.start();
      o.stop(T() + dur);
    },
    horn(dur = 0.8) {
      if (!ac || muted) return;
      for (const f of [370, 466]) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "sawtooth";
        o.frequency.value = f;
        g.gain.setValueAtTime(0, T());
        g.gain.linearRampToValueAtTime(0.06, T() + 0.05);
        g.gain.setValueAtTime(0.06, T() + dur);
        g.gain.linearRampToValueAtTime(0, T() + dur + 0.1);
        o.connect(g).connect(n.master);
        o.start();
        o.stop(T() + dur + 0.15);
      }
    },
    setMuted(m) {
      muted = m;
      if (n) n.master.gain.value = m ? 0 : 0.9;
    },
    get muted() {
      return muted;
    },
  };
}
