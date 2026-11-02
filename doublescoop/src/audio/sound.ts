// All sound is synthesized with Web Audio so the app ships with zero audio assets.

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
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

function noise(duration: number, volume: number, cutoff: number, delay = 0) {
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
  src.start(ac.currentTime + delay);
}

export const sfx = {
  /** Soft "plop" as a scoop lands; pitch climbs with the stack height. */
  scoop(height: number) {
    const base = 360 + height * 70;
    tone(base * 1.8, 0.12, 'sine', 0.12, base * 0.7);
    noise(0.06, 0.08, 1200, 0.1);
  },
  coneDone() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.09, undefined, i * 0.09));
    [2093, 2637, 3136].forEach((f, i) => tone(f, 0.12, 'sine', 0.04, undefined, 0.5 + i * 0.06));
  },
  topple() {
    tone(520, 0.45, 'triangle', 0.08, 140);
    noise(0.25, 0.25, 700, 0.35);
    tone(110, 0.2, 'sine', 0.12, 60, 0.35);
  },
  beep() {
    tone(660, 0.14, 'sine', 0.1);
  },
  go() {
    tone(988, 0.3, 'sine', 0.12);
    tone(1319, 0.3, 'sine', 0.08, undefined, 0.08);
  },
  tick() {
    tone(1500, 0.03, 'square', 0.025);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, 'triangle', 0.1, undefined, i * 0.12));
  },
  lose() {
    [440, 370, 294].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, undefined, i * 0.18));
  },
  click() {
    tone(1200, 0.04, 'square', 0.03);
  },
};
