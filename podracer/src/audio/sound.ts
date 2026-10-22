// All sound is synthesized with Web Audio so the app ships with zero audio assets.

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let muted = false;
let engine: { oscs: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;

function audio(): Ctx | null {
  if (muted) return null;
  if (!ctx) {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (value) stopEngine();
}

function tone(freq: number, duration: number, type: OscillatorType, volume: number, slideTo?: number, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration: number, volume: number, cutoff: number) {
  const ac = audio();
  if (!ac) return;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duration), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  src.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

export const sfx = {
  correct() {
    tone(620, 0.08, 'square', 0.05, 930);
    tone(930, 0.12, 'square', 0.04, 1400, 0.07);
  },
  wrong() {
    noise(0.25, 0.25, 900);
    tone(140, 0.3, 'sawtooth', 0.08, 60);
  },
  beep() {
    tone(440, 0.18, 'sine', 0.12);
  },
  go() {
    tone(880, 0.45, 'sine', 0.14);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, undefined, i * 0.12));
  },
  lose() {
    [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, undefined, i * 0.18));
  },
  crash() {
    noise(0.9, 0.4, 600);
    tone(90, 0.8, 'sawtooth', 0.1, 30);
  },
  click() {
    tone(1200, 0.04, 'square', 0.03);
  },
};

export function startEngine(): void {
  const ac = audio();
  if (!ac || engine) return;
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  gain.gain.value = 0.0001;
  gain.gain.exponentialRampToValueAtTime(0.035, ac.currentTime + 0.6);
  const oscs = [55, 56.7, 110.4].map((f) => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(filter);
    o.start();
    return o;
  });
  filter.connect(gain).connect(ac.destination);
  engine = { oscs, gain, filter };
}

/** 0 = idle growl, 1 = full throttle whine. */
export function setEngineIntensity(level: number): void {
  if (!engine || !ctx) return;
  const x = Math.max(0, Math.min(1, level));
  const t = ctx.currentTime;
  const base = 55 + x * 45;
  engine.oscs[0].frequency.setTargetAtTime(base, t, 0.2);
  engine.oscs[1].frequency.setTargetAtTime(base * 1.03, t, 0.2);
  engine.oscs[2].frequency.setTargetAtTime(base * 2.01, t, 0.2);
  engine.filter.frequency.setTargetAtTime(380 + x * 700, t, 0.2);
}

export function stopEngine(): void {
  if (!engine || !ctx) {
    engine = null;
    return;
  }
  const { oscs, gain } = engine;
  const t = ctx.currentTime;
  gain.gain.setTargetAtTime(0.0001, t, 0.15);
  oscs.forEach((o) => o.stop(t + 0.6));
  engine = null;
}
