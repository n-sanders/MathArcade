/* Dino Dash — the Daily Bonus endless runner.
   A Chrome-dino style sprint: jump the cacti, duck the birds, and hang on
   as the canyon speeds up. Score is pure survival time. */
(function () {
  const GAME_ID = "bonus";

  // Logical stage: simulation runs at a fixed logical height and is scaled
  // to whatever size the canvas actually is, so physics feel identical on
  // every screen.
  const LH = 450;                  // logical stage height
  const GROUND_H = 68;             // ground strip height
  const GROUND_Y = LH - GROUND_H;  // logical y of the ground surface
  const GRAVITY = 2600;            // px/s^2
  const JUMP_V = 880;              // initial jump velocity (upward)
  const FAST_FALL_MULT = 2.3;      // extra gravity while holding duck mid-air
  const BASE_SPEED = 340;          // logical px/s at the start of a run
  const MAX_SPEED = 960;
  const ACCEL = 9.5;               // speed gained per second of survival
  const SCORE_RATE = 10;           // score points per second survived
  const BIRDS_AFTER = 12;          // seconds before birds start appearing
  const DAY_LEN = 32;              // seconds per sky phase (sunset <-> night)
  const BLEND_LEN = 4;             // seconds to blend between phases

  // ------------------------------------------------------------- DOM ----
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const fxEl = document.getElementById("fx-layer");
  const flashEl = document.getElementById("flash");
  const vignette = document.getElementById("vignette");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed-label");
  const scoreChip = document.getElementById("score-chip");
  const overlay = document.getElementById("overlay");
  const overlayCard = document.getElementById("overlay-card");
  const jumpBtn = document.getElementById("btn-jump");
  const duckBtn = document.getElementById("btn-duck");

  // ----------------------------------------------------------- state ----
  let state = "idle"; // idle | running | dying | over
  let elapsed = 0;    // seconds survived this run
  let score = 0;
  let bestScore = 0;
  let runsToday = 0;
  let lastMilestone = 0;
  let speed = BASE_SPEED;
  let worldX = 0;     // total scrolled distance (drives parallax)
  let lastTs = 0;
  let shakeT = 0;
  let shakeMag = 0;
  let hitstopT = 0;
  let deathT = 0;
  let gateResult = null; // { unlocked, completed, required } once checked

  const dino = {
    x: 120,          // logical x of the dino's center
    y: 0,            // feet height above the ground (0 = standing on it)
    vy: 0,
    onGround: true,
    ducking: false,
    duckHeld: false,
    jumpBuffer: 0,   // grace window: jump pressed just before landing
    legT: 0,
    blinkT: 0,
    rot: 0           // death tumble
  };

  let obstacles = [];       // { kind:"cactus"|"bird", x, w, h, ... }
  let particles = [];       // dust & sparks
  let clouds = [];
  let pebbles = [];
  let speedLines = [];
  let stars = [];
  let distSinceSpawn = 0;
  let nextGap = BASE_SPEED * 0.7;

  // canvas metrics
  let dpr = 1, cssW = 0, cssH = 0, scale = 1, LW = 800;

  // =================================================================
  // AUDIO — procedural chiptune soundtrack + SFX (WebAudio, no assets)
  // =================================================================
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  // C — G — Am — F, sunny and driving. Tempo climbs with run speed.
  const BASS_NOTES = [36, 31, 33, 29]; // C2 G1 A1 F1
  const CHORDS = [
    [48, 52, 55, 60], // C E G C
    [47, 50, 55, 59], // B D G B
    [45, 48, 52, 57], // A C E A
    [45, 48, 53, 57]  // A C F A
  ];
  const ARP = [0, 2, 1, 3, 2, 3, 1, 2];

  function speedNorm() {
    return Math.min(1, Math.max(0, (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)));
  }

  function currentBpm() {
    return 118 + speedNorm() * 46;
  }

  function stepDur() {
    return 60 / currentBpm() / 4;
  }

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
      musicGain = audio.createGain();
      musicGain.gain.value = 0.6;
      musicGain.connect(audio.destination);
      sfxGain = audio.createGain();
      sfxGain.gain.value = 0.95;
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
    const bar = Math.floor(stepIdx / 16) % 4;
    const pos = stepIdx % 16;
    const chord = CHORDS[bar];
    const drive = speedNorm();

    // bass on the quarters
    if (pos % 4 === 0) {
      tone(musicGain, {
        type: "triangle", freq: midiToFreq(BASS_NOTES[bar]),
        t, dur: 0.26, gain: 0.3, attack: 0.008, filter: 520
      });
    }

    // square-wave lead arpeggio — pure chiptune
    if (pos % 2 === 0) {
      const midi = chord[ARP[(pos / 2) % ARP.length]] + 12;
      tone(musicGain, {
        type: "square", freq: midiToFreq(midi),
        t, dur: 0.13, gain: 0.045 + drive * 0.02, attack: 0.004,
        filter: 1600 + drive * 1400
      });
    }

    // soft pad once a bar
    if (pos === 0) {
      const barLen = stepDur() * 16;
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(chord[0]),
        t, dur: barLen, gain: 0.022, attack: 0.4, filter: 650
      });
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(chord[2]) * 1.003,
        t, dur: barLen, gain: 0.018, attack: 0.45, filter: 650
      });
    }

    // hats
    if (pos % 4 === 2 || (drive > 0.45 && pos % 2 === 1)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.035);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 6000;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.035 + drive * 0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t);
    }

    // snare backbeat once the run heats up
    if (drive > 0.25 && (pos === 4 || pos === 12)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.09);
      const f = audio.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1900;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t);
    }

    // kick thump on quarters when it's really moving
    if (drive > 0.5 && pos % 4 === 0) {
      tone(musicGain, {
        type: "sine", freq: 95, freqEnd: 36,
        t, dur: 0.16, gain: 0.26, attack: 0.004
      });
    }
  }

  function musicScheduler() {
    if (!audio) return;
    while (nextNoteTime < audio.currentTime + 0.28) {
      scheduleMusicStep(musicStep, nextNoteTime);
      nextNoteTime += stepDur();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!ensureAudio() || musicTimer) return;
    musicStep = 0;
    nextNoteTime = audio.currentTime + 0.05;
    musicTimer = setInterval(musicScheduler, 80);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function playJump() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sine", freq: 260, freqEnd: 760, t, dur: 0.24, gain: 0.26, attack: 0.008 });
    tone(sfxGain, { type: "triangle", freq: 520, freqEnd: 1040, t: t + 0.03, dur: 0.18, gain: 0.12 });
  }

  function playLand() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "triangle", freq: 170, freqEnd: 85, t, dur: 0.1, gain: 0.18 });
  }

  function playDuck() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.14);
    const f = audio.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(280, t + 0.13);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playMilestone() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "square", freq: 988, t, dur: 0.08, gain: 0.1, filter: 3200 });
    tone(sfxGain, { type: "square", freq: 1319, t: t + 0.09, dur: 0.11, gain: 0.1, filter: 3600 });
  }

  function playDie() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "square", freq: 220, freqEnd: 55, t, dur: 0.5, gain: 0.24, filter: 900 });
    tone(sfxGain, { type: "sine", freq: 120, freqEnd: 40, t: t + 0.05, dur: 0.4, gain: 0.22 });
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.6);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 0.55);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playNewBest() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.1, dur: 0.32, gain: 0.2 });
    });
  }

  function playStart() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [523, 659, 784].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.07, dur: 0.16, gain: 0.16 });
    });
  }

  function playClick() {
    if (!ensureAudio()) return;
    tone(sfxGain, { type: "sine", freq: 660, dur: 0.06, gain: 0.12 });
  }

  // ----------------------------------------------------------- utils ----
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function smooth01(u) {
    u = clamp(u, 0, 1);
    return u * u * (3 - 2 * u);
  }

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ------------------------------------------------------ juice (DOM) ----
  function shake(mag, dur) {
    shakeMag = mag;
    shakeT = dur;
  }

  function flash(kind) {
    flashEl.className = "screen-flash go" + (kind ? " " + kind : "");
    setTimeout(() => { flashEl.className = "screen-flash"; }, 360);
  }

  function floatText(lx, ly, text, cls) {
    const el = document.createElement("div");
    el.className = "float-text" + (cls ? " " + cls : "");
    el.textContent = text;
    el.style.left = (lx * scale) + "px";
    el.style.top = (ly * scale) + "px";
    fxEl.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function popScoreChip() {
    scoreChip.classList.remove("pop");
    void scoreChip.offsetWidth;
    scoreChip.classList.add("pop");
  }

  function spawnDust(x, y, count, big) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + randRange(-8, 8),
        y: y + randRange(-4, 2),
        vx: randRange(-90, -20) - (big ? 40 : 0),
        vy: randRange(-110, -30) * (big ? 1.4 : 1),
        r: randRange(2, big ? 6 : 4),
        life: randRange(0.3, 0.6),
        t: 0,
        color: "rgba(224, 188, 148,"
      });
    }
  }

  function spawnCrashBurst(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = randRange(80, 380);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        r: randRange(2.5, 6),
        life: randRange(0.4, 0.85),
        t: 0,
        color: Math.random() > 0.5 ? "rgba(255, 209, 102," : "rgba(255, 94, 125,"
      });
    }
  }

  // ------------------------------------------------------- sky/palette ----
  const SUNSET = {
    skyTop: [59, 29, 94], skyMid: [184, 61, 99], skyLow: [255, 138, 61],
    ridge: [74, 34, 84], dune: [122, 48, 78],
    groundTop: [70, 33, 56], groundDeep: [26, 13, 32],
    groundLine: [255, 209, 102], cloud: [255, 214, 180]
  };
  const NIGHT = {
    skyTop: [8, 10, 40], skyMid: [26, 16, 66], skyLow: [74, 32, 92],
    ridge: [24, 14, 48], dune: [40, 20, 62],
    groundTop: [26, 15, 42], groundDeep: [8, 5, 18],
    groundLine: [126, 240, 200], cloud: [150, 160, 220]
  };

  function nightAmount(t) {
    const c = t % (DAY_LEN * 2);
    if (c < DAY_LEN) return smooth01((c - (DAY_LEN - BLEND_LEN)) / BLEND_LEN);
    return 1 - smooth01((c - (DAY_LEN * 2 - BLEND_LEN)) / BLEND_LEN);
  }

  function mix(a, b, u) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * u),
      Math.round(a[1] + (b[1] - a[1]) * u),
      Math.round(a[2] + (b[2] - a[2]) * u)
    ];
  }

  function rgb(c, alpha) {
    if (alpha === undefined) return `rgb(${c[0]},${c[1]},${c[2]})`;
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  // -------------------------------------------------------- scenery ----
  function buildStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({
        fx: Math.random(),
        fy: Math.random() * 0.55,
        r: randRange(0.6, 1.9),
        tw: randRange(1.5, 5)
      });
    }
  }

  function buildClouds() {
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: randRange(0, LW),
        y: randRange(30, LH * 0.42),
        s: randRange(0.6, 1.3)
      });
    }
  }

  function buildPebbles() {
    pebbles = [];
    for (let i = 0; i < 26; i++) {
      pebbles.push({
        x: randRange(0, LW),
        y: GROUND_Y + randRange(12, GROUND_H - 14),
        w: randRange(4, 16)
      });
    }
  }

  function ridgeH(x, seed) {
    return (
      Math.abs(Math.sin(x * 0.004 + seed)) * 0.55 +
      Math.abs(Math.sin(x * 0.011 + seed * 2.7)) * 0.3 +
      Math.abs(Math.sin(x * 0.023 + seed * 5.1)) * 0.15
    );
  }

  // ------------------------------------------------------- obstacles ----
  function spawnObstacle() {
    const canBird = elapsed > BIRDS_AFTER;
    if (canBird && Math.random() < 0.34) {
      const mustDuck = Math.random() < 0.6;
      obstacles.push({
        kind: "bird",
        x: LW + 90,
        w: 54,
        h: 30,
        bottom: mustDuck ? 52 : 10, // height of the bird's underside above ground
        flap: Math.random() * 6,
        extra: 60 // birds fly a bit faster than the ground scrolls
      });
    } else {
      // cactus cluster: more likely to clump as the run speeds up
      const roll = Math.random() + speedNorm() * 0.35;
      const count = roll > 1.05 ? 3 : roll > 0.72 ? 2 : 1;
      const parts = [];
      let cx = 0;
      for (let i = 0; i < count; i++) {
        const tall = Math.random() < 0.4;
        const w = tall ? 24 : 20;
        const h = tall ? 60 : 42;
        parts.push({ dx: cx, w, h, arms: Math.random() < 0.75 });
        cx += w + 6;
      }
      obstacles.push({
        kind: "cactus",
        x: LW + 90,
        w: cx - 6,
        h: Math.max(...parts.map((p) => p.h)),
        parts,
        extra: 0
      });
    }

    // schedule the next one: always leaves a survivable gap
    const gapTime = randRange(0.85, 1.5) - speedNorm() * 0.12;
    nextGap = Math.max(360, speed * Math.max(0.72, gapTime));
    distSinceSpawn = 0;
  }

  function dinoBox() {
    // forgiving hitboxes: slightly smaller than the drawing
    if (dino.ducking && dino.onGround) {
      return { x: dino.x - 26, y: GROUND_Y - dino.y - 32, w: 52, h: 30 };
    }
    return { x: dino.x - 15, y: GROUND_Y - dino.y - 57, w: 30, h: 55 };
  }

  function obstacleBox(o) {
    if (o.kind === "bird") {
      return { x: o.x + 6, y: GROUND_Y - o.bottom - o.h + 5, w: o.w - 12, h: o.h - 8 };
    }
    return { x: o.x + 3, y: GROUND_Y - o.h + 4, w: o.w - 6, h: o.h - 4 };
  }

  function boxesHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ----------------------------------------------------------- input ----
  function pressJump() {
    if (state !== "running") return;
    if (dino.onGround) {
      dino.vy = JUMP_V;
      dino.onGround = false;
      dino.ducking = false;
      playJump();
      spawnDust(dino.x - 6, GROUND_Y, 7, false);
    } else {
      dino.jumpBuffer = 0.12;
    }
  }

  function pressDuck() {
    dino.duckHeld = true;
    if (state !== "running") return;
    if (dino.onGround) {
      if (!dino.ducking) playDuck();
      dino.ducking = true;
    }
  }

  function releaseDuck() {
    dino.duckHeld = false;
    dino.ducking = false;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (state === "over") { restart(); return; }
      if (e.repeat) return;
      pressJump();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      if (e.repeat) return;
      pressDuck();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown" || e.code === "KeyS") releaseDuck();
  });

  canvas.addEventListener("pointerdown", () => {
    if (state === "running") pressJump();
  });

  jumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pressJump();
  });
  duckBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pressDuck();
  });
  duckBtn.addEventListener("pointerup", releaseDuck);
  duckBtn.addEventListener("pointercancel", releaseDuck);
  duckBtn.addEventListener("pointerleave", releaseDuck);

  // ---------------------------------------------------------- update ----
  function update(dt) {
    // hitstop: the world holds its breath for a beat on impact
    if (hitstopT > 0) {
      hitstopT -= dt;
      return;
    }

    if (shakeT > 0) shakeT -= dt;

    const scroll = state === "running" ? speed
      : state === "idle" || state === "over" ? 40
      : 0;
    worldX += scroll * dt;

    // scenery
    clouds.forEach((c) => {
      c.x -= (scroll * 0.16 + 6) * dt;
      if (c.x < -140) { c.x = LW + randRange(20, 160); c.y = randRange(30, LH * 0.42); }
    });
    pebbles.forEach((p) => {
      p.x -= scroll * dt;
      if (p.x < -20) { p.x = LW + randRange(0, 80); p.y = GROUND_Y + randRange(12, GROUND_H - 14); }
    });

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 700 * dt;
    }

    // speed lines at high velocity
    if (state === "running" && speedNorm() > 0.5 && Math.random() < speedNorm() * 0.5) {
      speedLines.push({ x: LW + 40, y: randRange(20, GROUND_Y - 30), len: randRange(50, 150) });
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      speedLines[i].x -= (speed * 1.7) * dt;
      if (speedLines[i].x + speedLines[i].len < -20) speedLines.splice(i, 1);
    }

    if (state === "running") {
      elapsed += dt;
      speed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * ACCEL);
      score = Math.floor(elapsed * SCORE_RATE);

      // milestone fanfare every 100 points, bigger shout every 500
      const m = Math.floor(score / 100);
      if (m > lastMilestone && score > 0) {
        lastMilestone = m;
        playMilestone();
        popScoreChip();
        if (score > 0 && m % 5 === 0) {
          const shouts = ["TURBO!", "BLAZING!", "UNSTOPPABLE!", "LEGEND!!"];
          floatText(dino.x, GROUND_Y - 120, shouts[Math.min(shouts.length - 1, m / 5 - 1)], "combo");
          flash();
        }
      }

      // dino physics
      if (!dino.onGround) {
        const g = GRAVITY * (dino.duckHeld ? FAST_FALL_MULT : 1);
        dino.y += dino.vy * dt;
        dino.vy -= g * dt;
        if (dino.y <= 0) {
          dino.y = 0;
          dino.vy = 0;
          dino.onGround = true;
          playLand();
          spawnDust(dino.x, GROUND_Y, 8, true);
          if (dino.jumpBuffer > 0) {
            dino.jumpBuffer = 0;
            pressJump();
          } else if (dino.duckHeld) {
            dino.ducking = true;
          }
        }
      }
      if (dino.jumpBuffer > 0) dino.jumpBuffer -= dt;

      // run cycle + blink + trailing dust
      if (dino.onGround) {
        dino.legT += dt * (speed / 34);
        if (Math.random() < dt * 8) spawnDust(dino.x - 16, GROUND_Y, 1, false);
      }
      dino.blinkT += dt;
      if (dino.blinkT > 3.4) dino.blinkT = 0;

      // obstacles — brief lead-in, then keep the canyon busy
      distSinceSpawn += speed * dt;
      if (elapsed > 0.55 && distSinceSpawn >= nextGap) spawnObstacle();

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= (speed + o.extra) * dt;
        if (o.kind === "bird") o.flap += dt * 11;
        if (o.x + o.w < -40) obstacles.splice(i, 1);
      }

      // collision
      const db = dinoBox();
      for (const o of obstacles) {
        if (boxesHit(db, obstacleBox(o))) {
          die();
          break;
        }
      }

      updateHud();
    } else if (state === "dying") {
      deathT += dt;
      dino.y += dino.vy * dt;
      dino.vy -= GRAVITY * dt;
      dino.rot += 6.5 * dt;
      if (deathT > 1.05) finishRun();
    }
  }

  function updateHud() {
    scoreEl.textContent = String(score).padStart(5, "0");
    bestEl.textContent = String(Math.max(bestScore, score)).padStart(5, "0");
    speedEl.textContent = (speed / BASE_SPEED).toFixed(1) + "\u00d7";
  }

  // ---------------------------------------------------------- render ----
  function render(now) {
    const night = nightAmount(state === "idle" ? 0 : elapsed);
    const P = {};
    for (const k of Object.keys(SUNSET)) P[k] = mix(SUNSET[k], NIGHT[k], night);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    let sx = 0, sy = 0;
    if (shakeT > 0) {
      sx = randRange(-1, 1) * shakeMag;
      sy = randRange(-1, 1) * shakeMag;
    }
    ctx.translate(sx * scale, sy * scale);
    ctx.scale(scale, scale);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, rgb(P.skyTop));
    sky.addColorStop(0.55, rgb(P.skyMid));
    sky.addColorStop(1, rgb(P.skyLow));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, LW, GROUND_Y);

    // stars fade in at night
    if (night > 0.02) {
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(now / 1000 * s.tw + s.fx * 20);
        ctx.fillStyle = `rgba(255,255,240,${(night * tw * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.fx * LW, s.fy * GROUND_Y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // sun & moon
    if (night < 0.98) {
      const sunY = LH * 0.3 + night * 120;
      const glow = ctx.createRadialGradient(LW * 0.78, sunY, 6, LW * 0.78, sunY, 90);
      glow.addColorStop(0, `rgba(255,214,120,${0.95 * (1 - night)})`);
      glow.addColorStop(0.4, `rgba(255,150,70,${0.5 * (1 - night)})`);
      glow.addColorStop(1, "rgba(255,150,70,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(LW * 0.78 - 90, sunY - 90, 180, 180);
      ctx.fillStyle = `rgba(255,226,150,${1 - night})`;
      ctx.beginPath();
      ctx.arc(LW * 0.78, sunY, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    if (night > 0.02) {
      const mx = LW * 0.24, my = LH * 0.2;
      ctx.fillStyle = `rgba(230,235,255,${night * 0.95})`;
      ctx.beginPath();
      ctx.arc(mx, my, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(P.skyTop, night);
      ctx.beginPath();
      ctx.arc(mx + 8, my - 5, 17, 0, Math.PI * 2);
      ctx.fill();
    }

    // clouds
    for (const c of clouds) {
      ctx.fillStyle = rgb(P.cloud, 0.22);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 24 * c.s, c.y - 8 * c.s, 16 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 46 * c.s, c.y, 14 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // parallax ridges
    drawRidge(P.ridge, 0.18, 120, 60, 3.1);
    drawRidge(P.dune, 0.42, 58, 34, 7.7);

    // speed lines
    if (speedLines.length) {
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + speedNorm() * 0.14})`;
      ctx.lineWidth = 2;
      for (const l of speedLines) {
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + l.len, l.y);
        ctx.stroke();
      }
    }

    // ground
    const ground = ctx.createLinearGradient(0, GROUND_Y, 0, LH);
    ground.addColorStop(0, rgb(P.groundTop));
    ground.addColorStop(1, rgb(P.groundDeep));
    ctx.fillStyle = ground;
    ctx.fillRect(0, GROUND_Y, LW, GROUND_H);

    ctx.strokeStyle = rgb(P.groundLine, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(LW, GROUND_Y);
    ctx.stroke();

    ctx.fillStyle = rgb(P.groundLine, 0.25);
    for (const p of pebbles) {
      ctx.fillRect(p.x, p.y, p.w, 2.5);
    }

    // obstacles
    for (const o of obstacles) {
      if (o.kind === "cactus") drawCactus(o, night);
      else drawBird(o, night);
    }

    // dust & sparks
    for (const p of particles) {
      const u = 1 - p.t / p.life;
      ctx.fillStyle = p.color + (u * 0.8).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + u * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    drawDino(now);
  }

  function drawRidge(color, par, base, amp, seed) {
    ctx.fillStyle = rgb(color);
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const off = worldX * par;
    for (let x = 0; x <= LW + 24; x += 24) {
      ctx.lineTo(x, GROUND_Y - base - amp * ridgeH(x + off, seed));
    }
    ctx.lineTo(LW, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  function drawCactus(o, night) {
    const body = mix([46, 158, 99], [30, 104, 78], night * 0.6);
    const dark = mix([22, 92, 58], [14, 58, 46], night * 0.6);
    for (const part of o.parts) {
      const x = o.x + part.dx;
      const top = GROUND_Y - part.h;
      ctx.fillStyle = rgb(dark);
      rr(ctx, x - 1.5, top - 1.5, part.w + 3, part.h + 1.5, 8);
      ctx.fill();
      ctx.fillStyle = rgb(body);
      rr(ctx, x, top, part.w, part.h, 7);
      ctx.fill();
      if (part.arms && part.h > 44) {
        ctx.fillStyle = rgb(body);
        rr(ctx, x - 9, top + 12, 10, 18, 5);
        ctx.fill();
        rr(ctx, x + part.w - 1, top + 18, 10, 16, 5);
        ctx.fill();
      }
      // highlight stripe
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      rr(ctx, x + 3, top + 4, 3.5, part.h - 10, 2);
      ctx.fill();
    }
  }

  function drawBird(o, night) {
    const y = GROUND_Y - o.bottom - o.h / 2; // vertical center
    const cx = o.x + o.w / 2;
    const wing = Math.sin(o.flap);
    const body = mix([255, 94, 125], [200, 74, 110], night * 0.5);

    ctx.save();
    ctx.translate(cx, y + Math.sin(o.flap * 0.5) * 3);

    // wings
    ctx.fillStyle = rgb(mix(body, [255, 255, 255], 0.25));
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(2, -2 - 22 * wing, 16, -4 - 26 * wing);
    ctx.quadraticCurveTo(4, 2 - 6 * wing, 6, 2);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.fillStyle = rgb(body);
    ctx.beginPath();
    ctx.ellipse(0, 0, o.w / 2 - 8, o.h / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // tail
    ctx.beginPath();
    ctx.moveTo(o.w / 2 - 10, -2);
    ctx.lineTo(o.w / 2 + 4, -8);
    ctx.lineTo(o.w / 2 + 4, 4);
    ctx.closePath();
    ctx.fill();

    // beak & eye (facing the dino, flying left)
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(-o.w / 2 + 8, -2);
    ctx.lineTo(-o.w / 2 - 4, 2);
    ctx.lineTo(-o.w / 2 + 8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#241226";
    ctx.beginPath();
    ctx.arc(-o.w / 2 + 13, -4, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawDino(now) {
    const feetY = GROUND_Y - dino.y;
    const dead = state === "dying" || state === "over";
    const ducking = dino.ducking && dino.onGround && !dead;
    const airborne = !dino.onGround && !dead;

    ctx.save();
    ctx.translate(dino.x, feetY);
    if (dead) ctx.rotate(dino.rot);

    // squash & stretch
    if (airborne) {
      const st = clamp(Math.abs(dino.vy) / 900, 0, 0.18);
      ctx.scale(1 - st * 0.6, 1 + st);
    }

    // shadow (drawn unscaled-ish, before body transform quirks are fine)
    const MAIN = "#63e6be";
    const DARK = "#128a68";
    const BELLY = "#c9f9e8";

    if (ducking) {
      // ---- duck pose: long and low
      ctx.fillStyle = DARK;
      rr(ctx, -34, -37, 62, 30, 12); ctx.fill();
      ctx.fillStyle = MAIN;
      rr(ctx, -32, -35, 58, 26, 11); ctx.fill();
      // tail up
      ctx.fillStyle = MAIN;
      ctx.beginPath();
      ctx.moveTo(-30, -30);
      ctx.lineTo(-46, -44);
      ctx.lineTo(-26, -18);
      ctx.closePath();
      ctx.fill();
      // head thrust forward
      ctx.fillStyle = DARK;
      rr(ctx, 14, -44, 30, 20, 8); ctx.fill();
      ctx.fillStyle = MAIN;
      rr(ctx, 16, -42, 26, 16, 7); ctx.fill();
      // eye
      drawEye(33, -36, dead);
      // scuttling legs
      const l = Math.sin(dino.legT * 2.2) * 4;
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(-14 + l, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(6 - l, 0); ctx.stroke();
    } else {
      // ---- standing / jumping pose
      // tail
      ctx.fillStyle = MAIN;
      ctx.beginPath();
      ctx.moveTo(-20, -40);
      ctx.lineTo(-42, -56);
      ctx.lineTo(-16, -24);
      ctx.closePath();
      ctx.fill();
      // body
      ctx.fillStyle = DARK;
      rr(ctx, -24, -52, 38, 38, 13); ctx.fill();
      ctx.fillStyle = MAIN;
      rr(ctx, -22, -50, 34, 34, 12); ctx.fill();
      // belly
      ctx.fillStyle = BELLY;
      rr(ctx, -14, -34, 18, 17, 8); ctx.fill();
      // head
      ctx.fillStyle = DARK;
      rr(ctx, -8, -66, 34, 24, 9); ctx.fill();
      ctx.fillStyle = MAIN;
      rr(ctx, -6, -64, 30, 20, 8); ctx.fill();
      // snout notch
      ctx.fillStyle = DARK;
      ctx.fillRect(18, -52, 6, 2.5);
      // eye
      drawEye(12, -56, dead);
      // little arm
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(6, -36);
      ctx.quadraticCurveTo(14, -34, 15, -29);
      ctx.stroke();
      // legs — run cycle on the ground, tucked in the air
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 6;
      if (airborne) {
        ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-16, -6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(8, -8); ctx.stroke();
      } else {
        const l = Math.sin(dino.legT * 2.2);
        ctx.beginPath(); ctx.moveTo(-12, -16); ctx.lineTo(-12 + l * 8, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(2 - l * 8, 0); ctx.stroke();
      }
      // back spikes
      ctx.fillStyle = "#ffd166";
      for (let i = 0; i < 3; i++) {
        const bx = -20 + i * 9;
        ctx.beginPath();
        ctx.moveTo(bx, -50 + (i === 1 ? -2 : 0));
        ctx.lineTo(bx + 4.5, -58 - (i === 1 ? 3 : 0));
        ctx.lineTo(bx + 9, -50 + (i === 1 ? -2 : 0));
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();

    // ground shadow
    if (!dead || dino.y < 200) {
      const sh = clamp(1 - dino.y / 220, 0.25, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.28 * sh})`;
      ctx.beginPath();
      ctx.ellipse(dino.x - 4, GROUND_Y + 5, 26 * sh + 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEye(x, y, dead) {
    if (dead) {
      ctx.strokeStyle = "#241226";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke();
      return;
    }
    const blink = dino.blinkT > 3.25; // brief blink at the end of each cycle
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.strokeStyle = "#241226";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.stroke();
    } else {
      ctx.fillStyle = "#241226";
      ctx.beginPath();
      ctx.arc(x + 1.5, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ------------------------------------------------------- game flow ----
  function die() {
    state = "dying";
    deathT = 0;
    hitstopT = 0.12;
    dino.vy = 520;
    dino.onGround = false;
    dino.ducking = false;
    dino.rot = 0;
    stopMusic();
    playDie();
    shake(9, 0.5);
    flash("bad");
    vignette.classList.add("on");
    spawnCrashBurst(dino.x, GROUND_Y - 40);
    floatText(dino.x, GROUND_Y - 110, "CRASH!", "bad");
    setTimeout(() => vignette.classList.remove("on"), 600);
  }

  async function finishRun() {
    state = "over";
    runsToday += 1;
    const isNewBest = score > bestScore;
    if (isNewBest) bestScore = score;
    updateHud();
    if (isNewBest && score > 0) playNewBest();

    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, 1, {
        bestScore,
        lastScore: score,
        runs: runsToday
      });
    } catch (err) {
      console.error(err);
    }

    const seconds = (elapsed).toFixed(1);
    overlayCard.innerHTML = `
      <h2>${isNewBest && score > 0 ? "New best run!" : "Wipeout!"}</h2>
      <p>You survived <strong>${seconds}s</strong> at up to ${(speed / BASE_SPEED).toFixed(1)}\u00d7 speed.</p>
      ${isNewBest && score > 0 ? '<div class="best-banner">NEW PERSONAL BEST</div>' : ""}
      <div class="end-stats">
        <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
        <div class="end-stat"><span class="lbl">Best</span><span class="num">${bestScore}</span></div>
        <div class="end-stat"><span class="lbl">Time</span><span class="num">${seconds}s</span></div>
      </div>
      <button class="btn btn-primary" id="again-btn">Run again</button>
      <p class="hint-line">or press <strong>Space</strong></p>
      <a class="btn btn-ghost" href="/">Back to arcade</a>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", () => {
      playClick();
      restart();
    });
  }

  function resetRun() {
    elapsed = 0;
    score = 0;
    lastMilestone = 0;
    speed = BASE_SPEED;
    obstacles = [];
    particles = [];
    speedLines = [];
    distSinceSpawn = 0;
    nextGap = BASE_SPEED * 0.7; // first cactus arrives ~0.7s after the lead-in
    deathT = 0;
    hitstopT = 0;
    dino.y = 0;
    dino.vy = 0;
    dino.onGround = true;
    dino.ducking = false;
    dino.jumpBuffer = 0;
    dino.rot = 0;
  }

  function beginRun() {
    resetRun();
    overlay.classList.add("hidden");
    state = "running";
    ensureAudio();
    startMusic();
    playStart();
    flash();
    floatText(dino.x, GROUND_Y - 130, "GO!", "big");
    updateHud();
  }

  function restart() {
    if (state !== "over") return;
    beginRun();
  }

  // --------------------------------------------------- unlock gating ----
  async function checkGate() {
    if (gateResult) return gateResult;
    try {
      const progress = await MathArcade.loadAllProgress();
      const status = MathArcade.getDailyBonusUnlockStatus(progress);
      gateResult = status;
      // seed best score from saved bonus progress
      const row = progress[GAME_ID];
      if (row && row.statsJson) {
        try {
          const stats = JSON.parse(row.statsJson);
          if (Number.isFinite(stats.bestScore)) bestScore = Math.max(bestScore, stats.bestScore);
        } catch (_) { /* ignore */ }
      }
    } catch (_) {
      // if the server is unreachable, fail open so the game still works
      gateResult = { unlocked: true, completed: 0, required: 0 };
    }
    updateHud();
    return gateResult;
  }

  function showLockedCard(status) {
    overlayCard.innerHTML = `
      <h2>Still locked!</h2>
      <p>The Daily Bonus opens after you finish today's math activities.
         You've done <strong>${status.completed} of ${status.required}</strong> so far.</p>
      <a class="btn btn-primary" href="/">Back to activities</a>`;
  }

  function showIntroCard() {
    overlayCard.innerHTML = `
      <h2>Dino Dash</h2>
      <p>Your daily bonus run! Sprint through the canyon —
         <strong>jump</strong> the cacti and <strong>duck</strong> under the birds.
         It only gets faster. Score = how long you survive.</p>
      <div class="controls-row">
        <div class="control"><span class="key">Space / \u2191 / tap</span><span>jump</span></div>
        <div class="control"><span class="key">\u2193 / hold DUCK</span><span>duck</span></div>
      </div>
      <button class="btn btn-primary" id="start-btn">Start running</button>`;
    const startBtn = document.getElementById("start-btn");
    startBtn.addEventListener("click", async () => {
      playClick();
      startBtn.disabled = true;
      startBtn.textContent = "Checking today's progress\u2026";
      const status = await checkGate();
      if (status.unlocked) beginRun();
      else showLockedCard(status);
    });
  }

  // ------------------------------------------------------------- boot ----
  function resize() {
    dpr = window.devicePixelRatio || 1;
    cssW = stage.clientWidth || 800;
    cssH = stage.clientHeight || 450;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    scale = cssH / LH;
    LW = cssW / scale;
    dino.x = clamp(LW * 0.18, 80, 210);
  }

  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    render(ts);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    resize();
    buildPebbles();
  });

  resize();
  buildStars();
  buildClouds();
  buildPebbles();
  showIntroCard();
  updateHud();
  requestAnimationFrame(frame);
})();
