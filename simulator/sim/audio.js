// Ambiance sonore synthétisée (aucun fichier) : roulement, moteur de traction, sifflement de frein, bips.
export function createAudio() {
  let ac = null;
  let nodes = null;
  let muted = false;

  function noiseBuffer(ctx, brown) {
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
    const rumble = loop(noiseBuffer(ac, true));
    const rumbleF = ac.createBiquadFilter();
    rumbleF.type = "lowpass";
    const rumbleG = ac.createGain();
    rumble.connect(rumbleF).connect(rumbleG).connect(master);

    const motor = ac.createOscillator();
    motor.type = "sawtooth";
    const motorF = ac.createBiquadFilter();
    motorF.type = "lowpass";
    motorF.frequency.value = 900;
    const motorG = ac.createGain();
    motorG.gain.value = 0;
    motor.connect(motorF).connect(motorG).connect(master);
    motor.start();

    const hiss = loop(noiseBuffer(ac, false));
    const hissF = ac.createBiquadFilter();
    hissF.type = "highpass";
    hissF.frequency.value = 2500;
    const hissG = ac.createGain();
    hissG.gain.value = 0;
    hiss.connect(hissF).connect(hissG).connect(master);

    nodes = { master, rumbleF, rumbleG, motor, motorG, hissG };
    return ac.resume();
  }

  function update(v, lever, emergency) {
    if (!nodes) return;
    const t = ac.currentTime;
    const k = Math.min(v / 40, 1);
    nodes.rumbleF.frequency.setTargetAtTime(60 + 500 * k, t, 0.2);
    nodes.rumbleG.gain.setTargetAtTime(v > 0.05 ? 0.05 + 0.35 * k : 0, t, 0.3);
    nodes.motor.frequency.setTargetAtTime(40 + v * 11, t, 0.2);
    nodes.motorG.gain.setTargetAtTime(Math.max(lever, 0) * 0.035 * (0.4 + k), t, 0.15);
    const brake = emergency ? 1 : Math.max(-lever, 0);
    nodes.hissG.gain.setTargetAtTime(v > 0.3 ? brake * 0.05 : 0, t, 0.1);
  }

  function beep(freq = 880, dur = 0.12, vol = 0.12) {
    if (!ac || muted) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = freq;
    o.type = "square";
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g).connect(nodes.master);
    o.start();
    o.stop(ac.currentTime + dur);
  }

  function setMuted(m) {
    muted = m;
    if (nodes) nodes.master.gain.value = m ? 0 : 0.9;
  }

  return { start, update, beep, setMuted, get muted() { return muted; } };
}
