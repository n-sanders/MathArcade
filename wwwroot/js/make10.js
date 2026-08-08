/* Make 10 — Electric Wire edition.
 * Drag the live wire from the base number to the node that completes 10.
 */
(function () {
  "use strict";

  const GAME_ID = "make10";
  const BEST_KEY = "matharcade_make10_best";
  const TARGET_CORRECT = 10;

  // ---------------------------------------------------------------- DOM ----
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const overlay = document.getElementById("overlay");
  const overlayTitle = overlay.querySelector("h2");
  const overlayText = overlay.querySelector("p");
  const overlayStats = document.getElementById("overlay-stats");
  const startBtn = document.getElementById("start-btn");
  const homeBtn = document.getElementById("home-btn");
  const endBtn = document.getElementById("end-btn");
  const scoreEl = document.getElementById("score");
  const circuitEl = document.getElementById("circuit");
  const streakEl = document.getElementById("streak");
  const bestEl = document.getElementById("best");
  const streakChip = document.getElementById("streak-chip");

  // -------------------------------------------------------------- colors ---
  const C = {
    bg: "#070b14",
    cyan: "#22d3ee",
    cyanBright: "#9df6ff",
    blue: "#4f7cff",
    purple: "#a855f7",
    white: "#f0faff",
    red: "#ff4d5e",
    redDim: "#8f2530",
    dim: "#64748b"
  };

  // --------------------------------------------------------------- state ---
  let W = 0, H = 0, dpr = 1;
  let bgCanvas = null; // pre-rendered grid / vignette

  let mode = "idle"; // idle | playing | celebrate | fail | over
  let score = 0;
  let streak = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let roundsPlayed = 0;
  let correctCount = 0;
  let lastBase = -1;
  let baseQueue = []; // session bases; empty = idle attract (random)

  let baseNode = null;   // { value, x, y, r, popT }
  let nodes = [];        // scattered choice nodes
  let snapped = null;    // node the wire tip is magnetically held by
  let lockedNode = null; // node the wire is committed to (celebrate/fail)

  // Wire tip state (spring-ish follow)
  const tip = { x: 0, y: 0, vx: 0, vy: 0 };
  const pointer = { x: 0, y: 0, seen: false };
  let sag = 0, sagV = 0; // spring-smoothed cable sag

  let modeT = 0;         // seconds elapsed in current mode
  let shake = 0;         // screen-shake amplitude (px)
  let particles = [];
  let pulses = [];       // current pulses racing along the wire on success
  let time = 0;
  let lastFrame = performance.now();

  let lastSubmittedScore = 0;
  let scoreSubmitTimer = null;
  let pendingProgressStats = null; // set while end-of-session save is in flight
  let progressSaved = false;
  let sessionPersistPromise = null;

  function scoreToReport() {
    if (score <= 0) return 0;
    return Math.max(0, Math.floor(Math.max(score, best)));
  }

  async function flushScoreReport(options = {}) {
    const value = scoreToReport();
    if (value <= 0 || value <= lastSubmittedScore) return;
    try {
      await MathArcade.submitScore(GAME_ID, value, options);
      lastSubmittedScore = value;
    } catch (err) {
      console.error(err);
    }
  }

  function scheduleScoreReport() {
    if (scoreSubmitTimer) clearTimeout(scoreSubmitTimer);
    scoreSubmitTimer = setTimeout(() => {
      scoreSubmitTimer = null;
      flushScoreReport().catch((err) => console.error(err));
    }, 2000);
  }

  async function backfillIdleBestReport() {
    if (best <= 0 || best <= lastSubmittedScore) return;
    try {
      await MathArcade.ensurePlayer();
      await MathArcade.submitScore(GAME_ID, best);
      lastSubmittedScore = Math.max(lastSubmittedScore, best);
    } catch (err) {
      console.error(err);
    }
  }

  function sessionStatsPayload() {
    return {
      correctCount,
      lastScore: score,
      bestScore: best
    };
  }

  async function persistSessionProgress(options = {}) {
    const stats = pendingProgressStats || sessionStatsPayload();
    pendingProgressStats = stats;
    try {
      await MathArcade.saveProgress(GAME_ID, 1, stats, options);
      progressSaved = true;
      pendingProgressStats = null;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  function persistSession() {
    if (sessionPersistPromise) return sessionPersistPromise;
    sessionPersistPromise = (async () => {
      if (scoreSubmitTimer) {
        clearTimeout(scoreSubmitTimer);
        scoreSubmitTimer = null;
      }
      // Progress unlocks the daily bonus — save it before score sync.
      if (!progressSaved) {
        await persistSessionProgress();
      }
      await flushScoreReport();
    })().finally(() => {
      sessionPersistPromise = null;
    });
    return sessionPersistPromise;
  }

  function flushSessionOnPageHide() {
    stopMusic();
    const needsProgress = !!pendingProgressStats || (mode === "over" && !progressSaved);
    if (needsProgress) {
      const stats = pendingProgressStats || sessionStatsPayload();
      pendingProgressStats = stats;
      MathArcade.saveProgress(GAME_ID, 1, stats, { keepalive: true })
        .then(() => {
          progressSaved = true;
          pendingProgressStats = null;
        })
        .catch((err) => console.error(err));
    }
    if (score <= 0) return;
    const value = scoreToReport();
    if (value <= 0 || value <= lastSubmittedScore) return;
    MathArcade.submitScore(GAME_ID, value, { keepalive: true })
      .then(() => {
        lastSubmittedScore = value;
      })
      .catch((err) => console.error(err));
  }

  // -------------------------------------------------------------- helpers --
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  function elasticOut(t) {
    t = clamp(t, 0, 1);
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  }

  // -------------------------------------------------------------- sizing ---
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderBackground();
    if (baseNode) layoutRound(); // keep nodes on-screen after resize
  }

  function renderBackground() {
    bgCanvas = document.createElement("canvas");
    bgCanvas.width = Math.round(W * dpr);
    bgCanvas.height = Math.round(H * dpr);
    const b = bgCanvas.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    b.fillStyle = C.bg;
    b.fillRect(0, 0, W, H);

    // faint grid
    b.strokeStyle = "rgba(34, 211, 238, 0.045)";
    b.lineWidth = 1;
    const step = 48;
    for (let x = step; x < W; x += step) {
      b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke();
    }
    for (let y = step; y < H; y += step) {
      b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke();
    }

    // soft center glow + vignette
    let g = b.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.7);
    g.addColorStop(0, "rgba(79, 124, 255, 0.07)");
    g.addColorStop(0.55, "rgba(79, 124, 255, 0)");
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);

    g = b.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);
  }

  // --------------------------------------------------------------- audio ---
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let musicHot = false;

  const BPM_NORMAL = 96;
  const BPM_HOT = 118;

  function musicStepDur() {
    return 60 / (musicHot ? BPM_HOT : BPM_NORMAL) / 4;
  }

  // E minor loop — circuit-lab synth pulse (Em — C — G — Am)
  const BASS_NOTES = [40, 36, 43, 45];
  const CHORDS = [
    [52, 55, 59, 64],
    [48, 52, 55, 60],
    [55, 59, 62, 67],
    [57, 60, 64, 69]
  ];
  const ARP_A = [0, 2, 1, 3, 2, 1, 0, 2];
  const ARP_B = [3, 2, 1, 0, 1, 2, 3, 2];

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
      musicGain = audio.createGain();
      musicGain.gain.value = 0.38;
      musicGain.connect(audio.destination);
      sfxGain = audio.createGain();
      sfxGain.gain.value = 0.92;
      sfxGain.connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function noiseBuffer(seconds) {
    const buf = audio.createBuffer(1, Math.max(1, audio.sampleRate * seconds), audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(dest, opts) {
    const t = opts.t !== undefined ? opts.t : audio.currentTime;
    const dur = opts.dur || 0.2;
    const osc = audio.createOscillator();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t + dur);
    }
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.2, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let head = osc;
    if (opts.filter) {
      const f = audio.createBiquadFilter();
      f.type = opts.filterType || "lowpass";
      f.frequency.value = opts.filter;
      osc.connect(f);
      head = f;
    }
    head.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.08);
  }

  function scheduleMusicStep(stepIdx, t) {
    const dur = musicStepDur();
    const bar = Math.floor(stepIdx / 16) % 4;
    const pos = stepIdx % 16;
    const chord = CHORDS[bar];
    const arp = (Math.floor(stepIdx / 32) % 2 === 0) ? ARP_A : ARP_B;
    const boost = musicHot ? 1.22 : 1;
    const arpFilter = musicHot ? 2400 : 1300;

    if (pos % 4 === 0) {
      const jump = pos === 8 && Math.random() < 0.45;
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(BASS_NOTES[bar] + (jump ? 12 : 0)),
        t, dur: 0.26, gain: 0.26 * boost, attack: 0.01, filter: 380
      });
    }

    if (pos % 2 === 0) {
      const midi = chord[arp[(pos / 2) % arp.length]] + 12;
      tone(musicGain, {
        type: "sawtooth",
        freq: midiToFreq(midi),
        t, dur: 0.14, gain: 0.048 * boost, attack: 0.004, filter: arpFilter
      });
      if (pos % 4 === 0) {
        tone(musicGain, {
          type: "sine",
          freq: midiToFreq(midi),
          t: t + dur * 2,
          dur: 0.12,
          gain: 0.022 * boost,
          attack: 0.006,
          filter: 900
        });
      }
    }

    if (pos === 0) {
      const barLen = dur * 16;
      tone(musicGain, {
        type: "sawtooth",
        freq: midiToFreq(chord[0]),
        t, dur: barLen, gain: 0.026, attack: 0.45, filter: 620
      });
      tone(musicGain, {
        type: "sawtooth",
        freq: midiToFreq(chord[2]) * 1.002,
        t, dur: barLen, gain: 0.021, attack: 0.5, filter: 620
      });
    }

    if (pos % 4 === 2 || (musicHot && pos % 2 === 1)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.035);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = musicHot ? 5200 : 6800;
      const g = audio.createGain();
      g.gain.setValueAtTime((musicHot ? 0.055 : 0.034) * boost, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      src.connect(f).connect(g).connect(musicGain);
      src.start(t);
    }

    if (pos % 8 === 4 && Math.random() < 0.35) {
      tone(musicGain, {
        type: "square",
        freq: midiToFreq(76 + (bar % 2) * 2),
        t, dur: 0.06, gain: 0.012 * boost, attack: 0.002, filter: 1800
      });
    }

    if (musicHot && pos % 4 === 0) {
      tone(musicGain, {
        type: "sine",
        freq: 92,
        freqEnd: 38,
        t, dur: 0.16, gain: 0.18, attack: 0.004
      });
    }
  }

  function musicScheduler() {
    if (!audio || document.hidden) return;
    while (nextNoteTime < audio.currentTime + 0.28) {
      scheduleMusicStep(musicStep, nextNoteTime);
      nextNoteTime += musicStepDur();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!ensureAudio() || musicTimer) return;
    musicStep = 0;
    musicHot = false;
    nextNoteTime = audio.currentTime + 0.05;
    musicScheduler();
    musicTimer = setInterval(musicScheduler, 85);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function playZap(streakLevel) {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    const pitchMul = 1 + Math.min(streakLevel, 12) * 0.07;

    // rising electric zap
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(280 * pitchMul, t0);
    osc.frequency.exponentialRampToValueAtTime(920 * pitchMul, t0 + 0.09);
    osc.frequency.exponentialRampToValueAtTime(480 * pitchMul, t0 + 0.28);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(og).connect(sfxGain);
    osc.start(t0); osc.stop(t0 + 0.32);

    // crackle burst
    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer(0.25);
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2400 * pitchMul, t0);
    bp.Q.value = 1.1;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.22, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    noise.connect(bp).connect(ng).connect(sfxGain);
    noise.start(t0); noise.stop(t0 + 0.25);

    // low thump for punch
    const sub = ac.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, t0);
    sub.frequency.exponentialRampToValueAtTime(50, t0 + 0.16);
    const sg = ac.createGain();
    sg.gain.setValueAtTime(0.22, t0);
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    sub.connect(sg).connect(sfxGain);
    sub.start(t0); sub.stop(t0 + 0.2);
  }

  function playFizzle() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;

    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t0);
    osc.frequency.exponentialRampToValueAtTime(58, t0 + 0.38);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.16, t0);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    osc.connect(og).connect(sfxGain);
    osc.start(t0); osc.stop(t0 + 0.42);

    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer(0.35);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 0.3);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.14, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    noise.connect(lp).connect(ng).connect(sfxGain);
    noise.start(t0); noise.stop(t0 + 0.35);
  }

  function playSnapTick() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(1400, t0);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc.connect(g).connect(sfxGain);
    osc.start(t0); osc.stop(t0 + 0.06);
  }

  // ------------------------------------------------------------ particles --
  function spawnSparks(x, y, opts) {
    const o = Object.assign({
      count: 14, speed: 260, spread: Math.PI * 2, angle: 0,
      color: C.cyanBright, gravity: 420, size: 2.4, life: 0.55
    }, opts || {});
    for (let i = 0; i < o.count; i++) {
      const a = o.angle + (Math.random() - 0.5) * o.spread;
      const sp = o.speed * rand(0.35, 1.15);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: o.life * rand(0.6, 1.3),
        maxLife: o.life,
        size: o.size * rand(0.6, 1.4),
        color: o.color,
        gravity: o.gravity
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(0.06, dt); // drag
      p.vy *= Math.pow(0.2, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = "round";
      const trail = 0.03;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * trail, p.y - p.vy * trail);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- round --
  function nodeRadius() {
    return clamp(Math.min(W, H) * 0.055, 26, 52);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildBaseQueue() {
    const first = shuffleInPlace([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const second = shuffleInPlace([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let extra = second[0];
    for (let i = 0; i < second.length; i++) {
      if (second[i] !== first[first.length - 1]) {
        extra = second[i];
        break;
      }
    }
    baseQueue = first.concat(extra);
  }

  function nextBase() {
    if (baseQueue.length) {
      const base = baseQueue.shift();
      lastBase = base;
      return base;
    }
    let base;
    do { base = randInt(1, 9); } while (base === lastBase);
    lastBase = base;
    return base;
  }

  function newRound() {
    roundsPlayed += 1;
    const base = nextBase();
    const answer = 10 - base;

    const values = [answer];
    const pool = [];
    for (let v = 1; v <= 9; v++) if (v !== answer) pool.push(v);
    while (values.length < 6 && pool.length) {
      values.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
    }

    baseNode = { value: base, x: 0, y: 0, r: 0, popT: 1, flashT: 0 };
    nodes = values.map((v, i) => ({
      value: v,
      x: 0, y: 0, r: 0,
      isAnswer: v === answer,
      popT: -i * 0.06,      // staggered pop-in (negative = delay)
      flashT: 0,            // white flash on success
      failT: 0,             // red flash + shake on failure
      hover: 0              // eased highlight when snapped
    }));
    layoutRound();

    snapped = null;
    lockedNode = null;
    pulses = [];
  }

  function layoutRound() {
    const r = nodeRadius();
    baseNode.r = r * 1.35;
    baseNode.x = clamp(W * 0.16, baseNode.r + 12, W);
    baseNode.y = H * 0.5;

    const minX = W * 0.4, maxX = W - r - 20;
    const minY = r + 20, maxY = H - r - 20;
    const minGap = r * 2.6;
    const placed = [];
    for (const n of nodes) {
      n.r = r;
      let ok = false;
      for (let attempt = 0; attempt < 200 && !ok; attempt++) {
        const x = rand(minX, maxX);
        const y = rand(minY, maxY);
        ok = dist(x, y, baseNode.x, baseNode.y) > baseNode.r + minGap;
        for (const q of placed) {
          if (dist(x, y, q.x, q.y) < minGap) { ok = false; break; }
        }
        if (ok) { n.x = x; n.y = y; }
      }
      if (!ok) { // fallback: loose grid slot
        const i = placed.length;
        n.x = lerp(minX, maxX, ((i % 3) + 0.5) / 3);
        n.y = lerp(minY, maxY, (Math.floor(i / 3) + 0.5) / 2);
      }
      placed.push(n);
    }
  }

  // ---------------------------------------------------------------- input --
  function toLocal(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener("pointermove", (e) => {
    const p = toLocal(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.seen = true;
  });

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = toLocal(e);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.seen = true;
  });

  canvas.addEventListener("pointerup", () => {
    if (mode !== "playing") return;
    if (snapped) { commitConnection(snapped); return; }
    // touch fallback: a direct tap on a node connects even if the wire
    // tip hasn't caught up to the finger yet
    for (const n of nodes) {
      if (dist(pointer.x, pointer.y, n.x, n.y) <= n.r) {
        commitConnection(n);
        return;
      }
    }
  });

  window.addEventListener("resize", resize);

  // ------------------------------------------------------------- gameplay --
  function commitConnection(node) {
    lockedNode = node;
    snapped = null;
    tip.x = node.x;
    tip.y = node.y;
    tip.vx = tip.vy = 0;

    if (node.value + baseNode.value === 10) {
      mode = "celebrate";
      modeT = 0;
      streak += 1;
      correctCount += 1;
      score += 10 + Math.min(streak, 10) * 2;
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
        scheduleScoreReport();
      }
      node.flashT = 1;
      baseNode.flashT = 1;
      pulses = [
        { t: 0, speed: 2.6 },
        { t: -0.22, speed: 2.6 },
        { t: -0.44, speed: 2.6 }
      ];
      shake = 9 + Math.min(streak, 8);
      playZap(streak);
      spawnSparks(baseNode.x, baseNode.y, { count: 16, color: C.cyanBright });
      spawnSparks(node.x, node.y, { count: 22, color: C.white, speed: 320 });
    } else {
      mode = "fail";
      modeT = 0;
      streak = 0;
      node.failT = 1;
      shake = 4;
      playFizzle();
      spawnSparks(node.x, node.y, { count: 8, color: C.redDim, speed: 130, life: 0.4 });
    }
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    circuitEl.textContent = mode === "idle" || mode === "over"
      ? "–"
      : `${correctCount}/${TARGET_CORRECT}`;
    streakEl.textContent = streak;
    bestEl.textContent = best;
    streakChip.classList.toggle("hot", streak >= 3);
  }

  async function startGame() {
    ensureAudio();
    score = 0;
    streak = 0;
    correctCount = 0;
    roundsPlayed = 0;
    lastBase = -1;
    pendingProgressStats = null;
    progressSaved = false;
    sessionPersistPromise = null;
    buildBaseQueue();
    homeBtn.classList.add("hidden");
    homeBtn.setAttribute("aria-disabled", "true");
    overlay.classList.add("hidden");
    newRound();
    mode = "playing";
    modeT = 0;
    if (!pointer.seen) {
      pointer.x = W * 0.5;
      pointer.y = H * 0.5;
    }
    tip.x = baseNode.x;
    tip.y = baseNode.y;
    updateHud();
    startMusic();
    try {
      await MathArcade.ensurePlayer();
    } catch (err) {
      console.error(err);
    }
  }

  async function endGame() {
    if (mode === "idle" || mode === "over") return;
    stopMusic();
    mode = "over";
    const finishedAll = correctCount >= TARGET_CORRECT;
    overlayTitle.textContent = finishedAll ? "All circuits lit!" : "Circuit closed!";
    overlayText.textContent = finishedAll
      ? (streak >= 5
        ? "You were on fire. The grid thanks you."
        : "Ten perfect connections. Plug back in?")
      : "Every connection makes you faster. Plug back in?";
    overlayStats.hidden = false;
    overlayStats.textContent = `Score ${score} · Best ${best} · ${correctCount}/${TARGET_CORRECT} circuits`;
    startBtn.textContent = "Play again";
    // Mark progress pending before any await so pagehide/navigation can still save it.
    pendingProgressStats = sessionStatsPayload();
    progressSaved = false;
    homeBtn.classList.remove("hidden");
    homeBtn.setAttribute("aria-disabled", "true");
    overlay.classList.remove("hidden");
    updateHud();
    try {
      await persistSession();
    } catch (err) {
      console.error(err);
    } finally {
      homeBtn.setAttribute("aria-disabled", "false");
    }
  }

  startBtn.addEventListener("click", startGame);
  endBtn.addEventListener("click", endGame);
  homeBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (homeBtn.getAttribute("aria-disabled") === "true") return;
    homeBtn.setAttribute("aria-disabled", "true");
    try {
      await persistSession();
    } catch (err) {
      console.error(err);
    }
    window.location.href = "/";
  });

  // -------------------------------------------------------------- wire -----
  function wireAnchor() {
    // Anchor on the rim of the base node, pointing toward the tip.
    const a = Math.atan2(tip.y - baseNode.y, tip.x - baseNode.x);
    return {
      x: baseNode.x + Math.cos(a) * baseNode.r * 0.92,
      y: baseNode.y + Math.sin(a) * baseNode.r * 0.92
    };
  }

  function wirePointAt(p0, cp, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y
    };
  }

  function updateWire(dt) {
    let tx = pointer.x, ty = pointer.y;

    if (mode === "celebrate" && lockedNode) {
      tx = lockedNode.x; ty = lockedNode.y;
    } else if (mode === "fail" && lockedNode) {
      if (modeT < 0.22) {
        tx = lockedNode.x; ty = lockedNode.y;
      } else if (lockedNode) {
        // recoil kick away from the wrong node, once
        const a = Math.atan2(pointer.y - lockedNode.y, pointer.x - lockedNode.x);
        tip.vx += Math.cos(a) * 900;
        tip.vy += Math.sin(a) * 900 - 250;
        lockedNode = null;
      }
    } else if (mode === "playing") {
      // magnetic attraction
      let nearest = null, nd = Infinity;
      for (const n of nodes) {
        const d = dist(tip.x, tip.y, n.x, n.y);
        if (d < nd) { nd = d; nearest = n; }
      }
      const snapRange = nearest ? nearest.r + 42 : 0;
      const newSnap = nearest && nd < snapRange ? nearest : null;
      if (newSnap && newSnap !== snapped) playSnapTick();
      snapped = newSnap;
      if (snapped) {
        const pull = 1 - clamp(nd / snapRange, 0, 1); // 0..1, stronger when close
        tx = lerp(pointer.x, snapped.x, 0.45 + pull * 0.5);
        ty = lerp(pointer.y, snapped.y, 0.45 + pull * 0.5);
      }
    }

    // critically-damped-ish spring toward target
    const stiff = 180, damp = 16;
    tip.vx += (tx - tip.x) * stiff * dt;
    tip.vy += (ty - tip.y) * stiff * dt;
    tip.vx *= Math.exp(-damp * dt);
    tip.vy *= Math.exp(-damp * dt);
    tip.x += tip.vx * dt;
    tip.y += tip.vy * dt;

    // cable sag springs toward a fraction of the span
    const anchor = wireAnchor();
    const span = dist(anchor.x, anchor.y, tip.x, tip.y);
    const speed = Math.hypot(tip.vx, tip.vy);
    const restSag = clamp(span * 0.22, 12, 130) * clamp(1 - speed / 2200, 0.25, 1);
    sagV += (restSag - sag) * 90 * dt;
    sagV *= Math.exp(-10 * dt);
    sag += sagV * dt;
  }

  function drawWire() {
    const anchor = wireAnchor();
    const p2 = { x: tip.x, y: tip.y };
    const cp = {
      x: (anchor.x + p2.x) / 2 - tip.vx * 0.02,
      y: (anchor.y + p2.y) / 2 + sag
    };

    const connected = mode === "celebrate";
    const failing = mode === "fail" && modeT < 0.22;

    // sample curve with a subtle electric jitter
    const SEG = 26;
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const p = wirePointAt(anchor, cp, p2, t);
      if (i > 0 && i < SEG) {
        const amp = connected ? 2.6 : 1.4;
        p.x += (Math.random() - 0.5) * amp;
        p.y += (Math.random() - 0.5) * amp;
      }
      pts.push(p);
    }

    const strokePath = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const glowColor = failing ? C.red : C.cyan;
    const coreColor = failing ? "#ffd7db" : C.cyanBright;

    // outer glow
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = failing ? "rgba(255, 77, 94, 0.22)" : "rgba(34, 211, 238, 0.22)";
    ctx.lineWidth = 10;
    strokePath();

    // cable body
    ctx.shadowBlur = 8;
    ctx.strokeStyle = failing ? "rgba(255, 77, 94, 0.75)" : "rgba(79, 124, 255, 0.8)";
    ctx.lineWidth = 4.5;
    strokePath();

    // hot core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 1.8;
    strokePath();

    // idle energy pulse drifting along the cable
    if (mode === "playing" || mode === "idle") {
      const t = (time * 0.45) % 1;
      const p = wirePointAt(anchor, cp, p2, t);
      ctx.fillStyle = C.white;
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // success: bright current races base -> node
    for (const pl of pulses) {
      if (pl.t < 0 || pl.t > 1) continue;
      ctx.shadowColor = C.white;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = "rgba(240, 250, 255, 0.95)";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      const tail = Math.max(0, pl.t - 0.1);
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const t = lerp(tail, pl.t, i / steps);
        const p = wirePointAt(anchor, cp, p2, t);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      const head = wirePointAt(anchor, cp, p2, pl.t);
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // free-end plug (only when not locked into a node)
    if (mode === "playing" || mode === "idle" || (mode === "fail" && !failing)) {
      const flicker = 0.75 + Math.random() * 0.25;
      ctx.shadowColor = C.cyan;
      ctx.shadowBlur = 16 * flicker;
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, snapped ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, (snapped ? 13 : 10) * flicker, 0, Math.PI * 2);
      ctx.fill();
      // occasional stray spark at the live tip
      if (Math.random() < 0.12) {
        spawnSparks(tip.x, tip.y, { count: 1, speed: 90, life: 0.25, size: 1.6, gravity: 200 });
      }
    }

    ctx.restore();
  }

  // -------------------------------------------------------------- nodes ----
  function drawNode(n, isBase) {
    const popScale = n.popT >= 1 ? 1 : elasticOut(clamp(n.popT / 0.6, 0, 1));
    if (popScale <= 0.01) return;

    let scale = popScale;
    let ox = 0;

    if (n.flashT > 0) {
      // punchy elastic pop on success
      scale *= 1 + 0.35 * elasticOut(1 - n.flashT) * n.flashT * 2.2;
    }
    if (n.failT > 0) {
      ox = Math.sin(n.failT * 40) * 6 * n.failT; // decaying shake
    }
    if (!isBase && n.hover > 0) {
      scale *= 1 + 0.1 * n.hover;
    }

    const x = n.x + ox, y = n.y, r = n.r * scale;

    ctx.save();

    const failGlow = n.failT > 0;
    const ringColor = isBase ? C.cyan : failGlow ? C.red : C.blue;
    const glowStrength = isBase ? 24 : failGlow ? 22 : 10 + (n.hover || 0) * 16;

    // fill
    const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    if (isBase) {
      g.addColorStop(0, "rgba(34, 211, 238, 0.32)");
      g.addColorStop(1, "rgba(12, 34, 56, 0.95)");
    } else if (failGlow) {
      g.addColorStop(0, `rgba(255, 77, 94, ${0.3 * n.failT})`);
      g.addColorStop(1, "rgba(20, 14, 24, 0.95)");
    } else {
      g.addColorStop(0, `rgba(79, 124, 255, ${0.12 + (n.hover || 0) * 0.2})`);
      g.addColorStop(1, "rgba(10, 16, 32, 0.95)");
    }
    ctx.fillStyle = g;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = glowStrength;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // ring
    ctx.shadowBlur = glowStrength * 0.8;
    ctx.lineWidth = isBase ? 3.5 : 2.5;
    ctx.strokeStyle = failGlow
      ? `rgba(255, 77, 94, ${0.5 + 0.5 * n.failT})`
      : isBase
        ? C.cyan
        : `rgba(120, 160, 255, ${0.55 + (n.hover || 0) * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // number
    ctx.shadowBlur = 0;
    ctx.fillStyle = failGlow ? "#ffccd1" : isBase ? C.white : "#c9dcff";
    ctx.font = `700 ${Math.round(r * 1.05)}px Fredoka, Nunito, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n.value), x, y + r * 0.05);

    // white flash overlay on success
    if (n.flashT > 0.4) {
      ctx.globalAlpha = (n.flashT - 0.4) / 0.6;
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------- loop ---
  function update(dt) {
    time += dt;
    modeT += dt;
    musicHot = streak >= 3 && (mode === "playing" || mode === "celebrate");

    // idle attract mode: wire lazily wanders behind the overlay
    if (mode === "idle" || mode === "over") {
      pointer.x = W * 0.6 + Math.sin(time * 0.6) * W * 0.18;
      pointer.y = H * 0.5 + Math.sin(time * 0.9 + 1.7) * H * 0.24;
    }

    if (baseNode) {
      baseNode.popT = Math.min(baseNode.popT + dt, 1);
      baseNode.flashT = Math.max(baseNode.flashT - dt * 2.2, 0);
      for (const n of nodes) {
        n.popT = Math.min(n.popT + dt * 1.6, 1);
        n.flashT = Math.max(n.flashT - dt * 2.2, 0);
        n.failT = Math.max(n.failT - dt * 2.4, 0);
        const wantHover = snapped === n ? 1 : 0;
        n.hover = lerp(n.hover, wantHover, 1 - Math.exp(-12 * dt));
      }
      updateWire(dt);
    }

    // success pulses race along the wire, shedding sparks
    if (pulses.length) {
      const anchor = wireAnchor();
      const cp = { x: (anchor.x + tip.x) / 2, y: (anchor.y + tip.y) / 2 + sag };
      for (const pl of pulses) {
        const prev = pl.t;
        pl.t += pl.speed * dt;
        if (prev < 1 && pl.t >= 0 && pl.t <= 1 && Math.random() < 0.6) {
          const p = wirePointAt(anchor, cp, { x: tip.x, y: tip.y }, clamp(pl.t, 0, 1));
          spawnSparks(p.x, p.y, { count: 2, speed: 120, life: 0.3, size: 1.6 });
        }
      }
      pulses = pulses.filter((pl) => pl.t <= 1.25);
    }

    if (mode === "celebrate" && modeT >= 0.95) {
      if (correctCount >= TARGET_CORRECT) {
        endGame();
      } else {
        newRound();
        mode = "playing";
        modeT = 0;
      }
    }
    if (mode === "fail" && modeT >= 0.6) {
      mode = "playing";
      modeT = 0;
      lockedNode = null;
    }

    shake = Math.max(shake - dt * 34, 0);
    updateParticles(dt);
  }

  function draw() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, W, H);

    if (baseNode) {
      // hint label above the base
      ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
      ctx.font = "700 15px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${baseNode.value} + ? = 10`, baseNode.x, baseNode.y - baseNode.r - 26);

      drawWire();
      drawNode(baseNode, true);
      for (const n of nodes) drawNode(n, false);
    }

    drawParticles();
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot ---
  resize();
  bestEl.textContent = best;
  // idle attract scene behind the start overlay
  newRound();
  pointer.x = W * 0.62;
  pointer.y = H * 0.45;
  tip.x = baseNode.x;
  tip.y = baseNode.y;
  window.addEventListener("pagehide", flushSessionOnPageHide);

  (async () => {
    try {
      await MathArcade.ensurePlayer();
      const progress = await MathArcade.loadProgress(GAME_ID);
      if (progress && progress.exists) {
        let stats = {};
        if (progress.statsJson) {
          try {
            stats = JSON.parse(progress.statsJson);
          } catch (_) { /* ignore */ }
        }
        // Server best is authoritative once progress exists (incl. admin wipe → 0).
        const serverBest = Number(stats.bestScore || 0);
        best = Number.isFinite(serverBest) ? Math.max(0, Math.floor(serverBest)) : 0;
        localStorage.setItem(BEST_KEY, String(best));
        bestEl.textContent = best;
        lastSubmittedScore = best;
      }
      await backfillIdleBestReport();
    } catch (err) {
      console.error(err);
    }
  })();

  requestAnimationFrame(frame);
})();
