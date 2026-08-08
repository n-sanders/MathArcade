/* Calendar Scramble — drag the scattered months back into the ordinal stack.
 * C/B/A/S ranks: short 3-round runs with more months missing at higher ranks.
 * A falling curtain drains the field; clear all three rounds to rank up.
 */
(function () {
  "use strict";

  const GAME_ID = "calendar";
  const BEST_KEY = "matharcade_calendar_best";

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Seasonal tint per month index (Dec/Jan/Feb winter, etc.)
  const TINTS = [
    "#7dd3fc", "#7dd3fc",             // Jan Feb  winter
    "#6ee7a0", "#6ee7a0", "#6ee7a0",  // Mar–May  spring
    "#fde047", "#fde047", "#fde047",  // Jun–Aug  summer
    "#fb923c", "#fb923c", "#fb923c",  // Sep–Nov  autumn
    "#7dd3fc"                          // Dec      winter
  ];

  const RANKS = ["C", "B", "A", "S"];
  const ROUNDS_PER_RUN = 3;
  const MISSING_BY_RANK = {
    C: [3, 4, 5],
    B: [5, 6, 8],
    A: [8, 10, 11],
    S: [12, 12, 12]
  };
  const SEC_PER_MONTH = { C: 5, B: 4, A: 3.25, S: 2.75 };
  const TIME_BUFFER = { C: 10, B: 6, A: 4, S: 2 };
  const RANK_BONUS = { C: 0, B: 10, A: 25, S: 40 };
  const RANK_FLAVOR = {
    C: "learn",
    B: "gaps grow",
    A: "nearly empty",
    S: "full scramble"
  };

  const BURST_COLORS = ["#fde047", "#fbbf24", "#fb923c", "#6ee7a0", "#7dd3fc", "#ffffff"];

  // ---------------------------------------------------------------- DOM ----
  const stage = document.getElementById("stage");
  const stackEl = document.getElementById("stack");
  const fieldEl = document.getElementById("field");
  const timerCurtain = document.getElementById("timer-curtain");
  const tileLayer = document.getElementById("tile-layer");
  const effectsEl = document.getElementById("effects");
  const overlay = document.getElementById("overlay");
  const overlayTitle = overlay.querySelector("h2");
  const overlayText = document.getElementById("overlay-text");
  const overlayExtra = document.getElementById("overlay-extra");
  const overlayStats = document.getElementById("overlay-stats");
  const startBtn = document.getElementById("start-btn");
  const endBtn = document.getElementById("end-btn");
  const scoreEl = document.getElementById("score");
  const scoreChip = document.getElementById("score-chip");
  const rankLabel = document.getElementById("rank-label");
  const roundEl = document.getElementById("round");
  const timerEl = document.getElementById("timer");
  const timerChip = document.getElementById("timer-chip");
  const bestEl = document.getElementById("best");

  // --------------------------------------------------------------- state ---
  let mode = "idle"; // idle | playing | intermission | over
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let streak = 0;
  let rank = "C";
  let roundIndex = 0;       // 0..2 within a run
  let missingCount = 0;
  let roundMistakes = 0;
  let totalMistakes = 0;
  let totalPlaced = 0;
  let placeClock = 0;       // timestamp of round start / last correct placement
  let timedOut = false;

  let roundSeconds = 0;
  let timeLeft = 0;
  let timerStart = 0;
  let timerRaf = 0;

  let slots = [];           // 12 of { idx, rowEl, slotEl, filled, rect }
  let tiles = [];           // active field tiles { el, inner, monthIdx, homeX, homeY }
  let drag = null;          // { tile, dx, dy, pointerId }
  let stageRect = null;
  let roundTasks = [];

  // -------------------------------------------------------------- helpers --
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ordinal(n) {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return n + "th";
  }

  function nextRank(r) {
    const i = RANKS.indexOf(r);
    return RANKS[Math.min(RANKS.length - 1, i + 1)];
  }

  function parseRank(stats) {
    if (!stats || typeof stats !== "object") return "C";
    const r = stats.rank;
    return RANKS.includes(r) ? r : "C";
  }

  function roundTimeLimit(count) {
    return count * (SEC_PER_MONTH[rank] || 4) + (TIME_BUFFER[rank] || 6);
  }

  function queueTask(fn, ms) {
    roundTasks.push(window.setTimeout(fn, ms));
  }

  function clearTasks() {
    roundTasks.forEach((id) => window.clearTimeout(id));
    roundTasks = [];
  }

  // --------------------------------------------------------------- audio ---
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let musicHot = false;

  const BPM_NORMAL = 100;
  const BPM_HOT = 122;

  function musicStepDur() {
    return 60 / (musicHot ? BPM_HOT : BPM_NORMAL) / 4;
  }

  // Bright C major loop — music-box calendar shop (C — G — Am — F)
  const BASS_NOTES = [36, 43, 45, 41];
  const CHORDS = [
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [53, 57, 60, 65]
  ];
  const ARP_A = [0, 2, 1, 3, 2, 1, 0, 2];
  const ARP_B = [3, 1, 2, 0, 2, 1, 3, 2];

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
      musicGain = audio.createGain();
      musicGain.gain.value = 0.34;
      musicGain.connect(audio.destination);
      sfxGain = audio.createGain();
      sfxGain.gain.value = 0.9;
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
    const boost = musicHot ? 1.2 : 1;
    const arpFilter = musicHot ? 2600 : 1500;

    if (pos % 4 === 0) {
      const jump = pos === 8 && Math.random() < 0.4;
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(BASS_NOTES[bar] + (jump ? 12 : 0)),
        t, dur: 0.26, gain: 0.24 * boost, attack: 0.01, filter: 400
      });
    }

    if (pos % 2 === 0) {
      const midi = chord[arp[(pos / 2) % arp.length]] + 12;
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(midi),
        t, dur: 0.16, gain: 0.06 * boost, attack: 0.004, filter: arpFilter
      });
      // music-box echo
      if (pos % 4 === 0) {
        tone(musicGain, {
          type: "sine",
          freq: midiToFreq(midi + 12),
          t: t + dur * 2,
          dur: 0.14,
          gain: 0.022 * boost,
          attack: 0.006,
          filter: 2200
        });
      }
    }

    if (pos === 0) {
      const barLen = dur * 16;
      tone(musicGain, {
        type: "sawtooth",
        freq: midiToFreq(chord[0]),
        t, dur: barLen, gain: 0.02, attack: 0.5, filter: 560
      });
      tone(musicGain, {
        type: "sawtooth",
        freq: midiToFreq(chord[2]) * 1.002,
        t, dur: barLen, gain: 0.017, attack: 0.55, filter: 560
      });
    }

    if (pos % 4 === 2 || (musicHot && pos % 2 === 1)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.03);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = musicHot ? 5600 : 7200;
      const g = audio.createGain();
      g.gain.setValueAtTime((musicHot ? 0.05 : 0.03) * boost, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      src.connect(f).connect(g).connect(musicGain);
      src.start(t);
    }

    if (pos % 8 === 6 && Math.random() < 0.4) {
      tone(musicGain, {
        type: "sine",
        freq: midiToFreq(chord[randInt(0, 3)] + 24),
        t, dur: 0.1, gain: 0.016 * boost, attack: 0.003, filter: 3200
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

  function playPickup() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    tone(sfxGain, { type: "sine", freq: 520, freqEnd: 680, t: t0, dur: 0.08, gain: 0.09, attack: 0.005 });
  }

  function playLock(streakLevel) {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    const mul = 1 + Math.min(streakLevel, 10) * 0.06;

    // two-note rising chime
    tone(sfxGain, { type: "triangle", freq: 660 * mul, t: t0, dur: 0.14, gain: 0.16, attack: 0.005, filter: 3200 });
    tone(sfxGain, { type: "triangle", freq: 880 * mul, t: t0 + 0.07, dur: 0.22, gain: 0.16, attack: 0.005, filter: 3600 });
    tone(sfxGain, { type: "sine", freq: 1320 * mul, t: t0 + 0.1, dur: 0.18, gain: 0.05, attack: 0.004 });

    // soft thump for punch
    tone(sfxGain, { type: "sine", freq: 150, freqEnd: 60, t: t0, dur: 0.13, gain: 0.16, attack: 0.004 });

    // sparkle
    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer(0.12);
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6000;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.06, t0 + 0.06);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    noise.connect(hp).connect(ng).connect(sfxGain);
    noise.start(t0 + 0.06);
  }

  function playWrong() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;

    tone(sfxGain, { type: "triangle", freq: 240, freqEnd: 62, t: t0, dur: 0.34, gain: 0.15, attack: 0.005 });

    const noise = ac.createBufferSource();
    noise.buffer = noiseBuffer(0.28);
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.exponentialRampToValueAtTime(180, t0 + 0.26);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.12, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    noise.connect(lp).connect(ng).connect(sfxGain);
    noise.start(t0);
  }

  function playFanfare() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      tone(sfxGain, { type: "triangle", freq, t: t0 + i * 0.09, dur: 0.3, gain: 0.14, attack: 0.006, filter: 3400 });
    });
    tone(sfxGain, { type: "sine", freq: 130, freqEnd: 65, t: t0, dur: 0.2, gain: 0.14, attack: 0.005 });
  }

  function playVictory() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    melody.forEach((freq, i) => {
      tone(sfxGain, { type: "triangle", freq, t: t0 + i * 0.13, dur: 0.34, gain: 0.15, attack: 0.006, filter: 3600 });
    });
    // closing chord
    [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
      tone(sfxGain, { type: "sawtooth", freq, t: t0 + 0.82, dur: 0.9, gain: 0.05, attack: 0.03, filter: 1800 });
    });
  }

  function playRankUp() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t = ac.currentTime;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.09, dur: 0.28, gain: 0.2 });
    });
  }

  // -------------------------------------------------------------- effects --
  function shakeStage(big) {
    const cls = big ? "shake-big" : "shake";
    stage.classList.remove("shake", "shake-big");
    void stage.offsetWidth;
    stage.classList.add(cls);
  }

  function burstParticles(x, y, colors, count) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const distPx = randInt(36, 110);
      p.className = "fx-particle";
      p.style.setProperty("--x", `${x}px`);
      p.style.setProperty("--y", `${y}px`);
      p.style.setProperty("--dx", `${Math.cos(angle) * distPx}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * distPx - 24}px`);
      p.style.setProperty("--size", `${randInt(4, 9)}px`);
      p.style.setProperty("--color", colors[i % colors.length]);
      p.style.setProperty("--life", `${randInt(550, 900)}ms`);
      p.style.setProperty("--delay", `${randInt(0, 60)}ms`);
      p.addEventListener("animationend", () => p.remove(), { once: true });
      effectsEl.appendChild(p);
    }
  }

  function spawnRing(x, y, color) {
    const ring = document.createElement("span");
    ring.className = "fx-ring";
    ring.style.setProperty("--x", `${x}px`);
    ring.style.setProperty("--y", `${y}px`);
    if (color) ring.style.setProperty("--color", color);
    ring.addEventListener("animationend", () => ring.remove(), { once: true });
    effectsEl.appendChild(ring);
  }

  function scorePop(x, y, text, bad) {
    const el = document.createElement("span");
    el.className = "score-pop" + (bad ? " bad" : "");
    el.textContent = text;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    effectsEl.appendChild(el);
  }

  function confettiRain(count) {
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.setProperty("--left", `${Math.random() * 100}%`);
      piece.style.setProperty("--width", `${randInt(6, 12)}px`);
      piece.style.setProperty("--height", `${randInt(9, 22)}px`);
      piece.style.setProperty("--color", BURST_COLORS[i % BURST_COLORS.length]);
      piece.style.setProperty("--drift", `${randInt(-120, 120)}px`);
      piece.style.setProperty("--start-rotation", `${randInt(0, 360)}deg`);
      piece.style.setProperty("--end-rotation", `${randInt(360, 1080)}deg`);
      piece.style.setProperty("--fall-time", `${randInt(1400, 2600)}ms`);
      piece.style.setProperty("--delay", `${randInt(0, 500)}ms`);
      piece.addEventListener("animationend", () => piece.remove(), { once: true });
      effectsEl.appendChild(piece);
    }
  }

  function showRibbon(title, sub) {
    const el = document.createElement("div");
    el.className = "round-ribbon";
    el.textContent = title;
    if (sub) {
      const small = document.createElement("small");
      small.textContent = sub;
      el.appendChild(small);
    }
    el.addEventListener("animationend", () => el.remove(), { once: true });
    effectsEl.appendChild(el);
  }

  // --------------------------------------------------------------- timer ---
  function stopTimer() {
    if (timerRaf) {
      cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }
  }

  function resetCurtain() {
    timerCurtain.style.height = "0%";
    timerCurtain.classList.remove("visible", "warn", "critical");
  }

  function hideCurtain() {
    stopTimer();
    resetCurtain();
    timerChip.classList.remove("timer-warn", "timer-critical");
    timerEl.textContent = "–";
  }

  function updateTimerVisuals() {
    const fracLeft = roundSeconds > 0 ? timeLeft / roundSeconds : 0;
    const elapsedFrac = 1 - fracLeft;
    timerCurtain.style.height = `${clamp(elapsedFrac * 100, 0, 100)}%`;
    timerCurtain.classList.toggle("warn", fracLeft <= 0.33 && fracLeft > 0.15);
    timerCurtain.classList.toggle("critical", fracLeft <= 0.15);

    const secs = Math.max(0, Math.ceil(timeLeft));
    timerEl.textContent = String(secs);
    timerChip.classList.toggle("timer-warn", secs <= 8 && secs > 5);
    timerChip.classList.toggle("timer-critical", secs <= 5);
  }

  function tickTimer(now) {
    if (mode !== "playing") {
      timerRaf = 0;
      return;
    }
    timeLeft = Math.max(0, roundSeconds - (now - timerStart) / 1000);
    updateTimerVisuals();
    if (timeLeft <= 0) {
      timerRaf = 0;
      failOnTimeout();
      return;
    }
    timerRaf = requestAnimationFrame(tickTimer);
  }

  function startTimer() {
    stopTimer();
    roundSeconds = roundTimeLimit(missingCount);
    timeLeft = roundSeconds;
    timerStart = performance.now();
    timerCurtain.classList.add("visible");
    timerCurtain.classList.remove("warn", "critical");
    updateTimerVisuals();
    timerRaf = requestAnimationFrame(tickTimer);
  }

  function failOnTimeout() {
    if (mode !== "playing") return;
    timedOut = true;
    timeLeft = 0;
    updateTimerVisuals();
    timerCurtain.style.height = "100%";
    timerCurtain.classList.add("critical");
    shakeStage(true);
    finishGame(false);
  }

  // -------------------------------------------------------------- layout ---
  function computeStageRect() {
    stageRect = stage.getBoundingClientRect();
  }

  function refreshSlotRects() {
    computeStageRect();
    for (const s of slots) {
      const r = s.slotEl.getBoundingClientRect();
      s.rect = {
        left: r.left - stageRect.left,
        top: r.top - stageRect.top,
        right: r.right - stageRect.left,
        bottom: r.bottom - stageRect.top,
        cx: r.left - stageRect.left + r.width / 2,
        cy: r.top - stageRect.top + r.height / 2
      };
    }
  }

  function fieldRect() {
    computeStageRect();
    const r = fieldEl.getBoundingClientRect();
    return {
      left: r.left - stageRect.left,
      top: r.top - stageRect.top,
      width: r.width,
      height: r.height
    };
  }

  function makeChip(monthIdx, extraClass) {
    const chip = document.createElement("div");
    chip.className = "chip" + (extraClass ? " " + extraClass : "");
    chip.textContent = MONTHS[monthIdx];
    chip.style.setProperty("--tint", TINTS[monthIdx]);
    return chip;
  }

  // Build the left-hand ordinal stack. missingSet may be null for a full year.
  function renderStack(missingSet) {
    stackEl.innerHTML = "";
    slots = [];
    for (let i = 0; i < 12; i++) {
      const row = document.createElement("div");
      row.className = "slot-row";

      const ord = document.createElement("div");
      ord.className = "ordinal";
      ord.textContent = ordinal(i + 1);
      row.appendChild(ord);

      const slot = document.createElement("div");
      slot.className = "slot";
      const isMissing = missingSet ? missingSet.has(i) : false;
      if (isMissing) {
        slot.classList.add("empty");
      } else {
        slot.appendChild(makeChip(i, "prefilled"));
      }
      row.appendChild(slot);
      stackEl.appendChild(row);

      slots.push({ idx: i, rowEl: row, slotEl: slot, filled: !isMissing, rect: null });
    }
  }

  // Scatter draggable tiles across the right two-thirds using a jittered,
  // shuffled grid so tiles never overlap at any count or screen size.
  function scatterTiles(missing) {
    tileLayer.innerHTML = "";
    tiles = [];

    const fr = fieldRect();

    // Measure tile size from CSS by probing one hidden tile.
    const probe = document.createElement("div");
    probe.className = "tile";
    probe.style.visibility = "hidden";
    probe.style.animation = "none";
    tileLayer.appendChild(probe);
    const tileW = probe.offsetWidth || 128;
    const tileH = probe.offsetHeight || 46;
    probe.remove();

    let cols = Math.max(1, Math.floor(fr.width / (tileW + 16)));
    let rows = Math.ceil(missing.length / cols);
    while (fr.height / rows < tileH + 10 && cols < missing.length) {
      cols += 1;
      rows = Math.ceil(missing.length / cols);
    }
    const cellW = fr.width / cols;
    const cellH = fr.height / rows;

    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push({ r, c });
    }
    shuffle(cells);

    const order = shuffle(missing.slice());
    order.forEach((monthIdx, i) => {
      const cell = cells[i];
      const slackX = Math.max(0, cellW - tileW - 8);
      const slackY = Math.max(0, cellH - tileH - 8);
      const x = fr.left + cell.c * cellW + 4 + rand(0, slackX);
      const y = fr.top + cell.r * cellH + 4 + rand(0, slackY);

      const el = document.createElement("div");
      el.className = "tile";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.setProperty("--pop-delay", `${i * 55}ms`);

      const inner = document.createElement("div");
      inner.className = "tile-inner";
      inner.textContent = MONTHS[monthIdx];
      inner.style.setProperty("--tint", TINTS[monthIdx]);
      inner.style.setProperty("--rot", `${rand(1.5, 4).toFixed(2)}deg`);
      inner.style.setProperty("--wobble-dur", `${rand(2.6, 4).toFixed(2)}s`);
      inner.style.setProperty("--wobble-delay", `${rand(0, 1.6).toFixed(2)}s`);
      el.appendChild(inner);

      const tile = { el, inner, monthIdx, homeX: x, homeY: y };
      el.addEventListener("pointerdown", (e) => onTileDown(e, tile));
      el.addEventListener("pointermove", onTileMove);
      el.addEventListener("pointerup", onTileUp);
      el.addEventListener("pointercancel", onTileUp);

      tileLayer.appendChild(el);
      tiles.push(tile);
    });

    requestAnimationFrame(refreshSlotRects);
  }

  // --------------------------------------------------------------- rounds --
  function buildRound() {
    clearHighlights();
    const schedule = MISSING_BY_RANK[rank] || MISSING_BY_RANK.C;
    missingCount = schedule[roundIndex] || schedule[schedule.length - 1];
    roundMistakes = 0;

    const missing = shuffle([...Array(12).keys()]).slice(0, missingCount);
    renderStack(new Set(missing));
    scatterTiles(missing);

    placeClock = performance.now();
    updateHud();
    startTimer();
  }

  function roundComplete() {
    mode = "intermission";
    stopTimer();
    timerChip.classList.remove("timer-warn", "timer-critical");
    timerCurtain.classList.remove("warn", "critical");

    const perfect = roundMistakes === 0;
    const timeBonus = Math.round(Math.max(0, timeLeft) * 2);
    const bonus = 40 + missingCount * 10 + (RANK_BONUS[rank] || 0) + (perfect ? 25 : 0) + timeBonus;
    score += bonus;
    syncBest();
    updateHud();

    playFanfare();
    confettiRain(64);

    const finishedRound = roundIndex + 1;
    const isLast = finishedRound >= ROUNDS_PER_RUN;
    const timeBit = timeBonus > 0 ? ` · +${timeBonus} time` : "";

    if (isLast) {
      showRibbon("RUN COMPLETE!", `+${bonus} bonus${perfect ? " · PERFECT!" : ""}${timeBit}`);
      queueTask(() => victory(), 1500);
      return;
    }

    const nextMissing = (MISSING_BY_RANK[rank] || MISSING_BY_RANK.C)[finishedRound];
    const sub = `+${bonus} bonus${perfect ? " · PERFECT!" : ""}${timeBit}` +
      (nextMissing ? ` · ${nextMissing} months missing next!` : "");
    showRibbon(`Round ${finishedRound} clear!`, sub);

    queueTask(() => {
      roundIndex += 1;
      buildRound();
      mode = "playing";
    }, 1700);
  }

  // ---------------------------------------------------------------- input --
  function toStage(e) {
    return { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top };
  }

  function findTargetSlot(x, y) {
    const PAD = 10;
    let bestSlot = null;
    let bestDist = Infinity;
    for (const s of slots) {
      if (s.filled || !s.rect) continue;
      const r = s.rect;
      if (x < r.left - PAD || x > r.right + PAD || y < r.top - PAD || y > r.bottom + PAD) continue;
      const d = Math.hypot(x - r.cx, y - r.cy);
      if (d < bestDist) {
        bestDist = d;
        bestSlot = s;
      }
    }
    return bestSlot;
  }

  function clearHighlights() {
    for (const s of slots) {
      s.slotEl.classList.remove("hot");
      s.rowEl.classList.remove("hot");
    }
  }

  function highlightSlot(target) {
    for (const s of slots) {
      const on = s === target;
      s.slotEl.classList.toggle("hot", on);
      s.rowEl.classList.toggle("hot", on);
    }
  }

  function onTileDown(e, tile) {
    if (mode !== "playing" || drag) return;
    computeStageRect();

    // If the tile is mid-return, freeze it where it currently is.
    if (tile.el.classList.contains("returning")) {
      const cs = getComputedStyle(tile.el);
      tile.el.classList.remove("returning");
      tile.el.style.left = cs.left;
      tile.el.style.top = cs.top;
    }

    const p = toStage(e);
    drag = {
      tile,
      pointerId: e.pointerId,
      dx: p.x - parseFloat(tile.el.style.left),
      dy: p.y - parseFloat(tile.el.style.top)
    };
    try {
      tile.el.setPointerCapture(e.pointerId);
    } catch (_) { /* synthetic or already-released pointer */ }
    tile.el.classList.add("dragging");
    playPickup();
  }

  function onTileMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { tile } = drag;
    const p = toStage(e);
    const w = tile.el.offsetWidth;
    const h = tile.el.offsetHeight;
    const x = clamp(p.x - drag.dx, 0, stageRect.width - w);
    const y = clamp(p.y - drag.dy, 0, stageRect.height - h);
    tile.el.style.left = `${x}px`;
    tile.el.style.top = `${y}px`;
    highlightSlot(findTargetSlot(p.x, p.y));
  }

  function onTileUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { tile } = drag;
    drag = null;
    tile.el.classList.remove("dragging");
    clearHighlights();

    if (mode !== "playing") {
      returnHome(tile);
      return;
    }

    const p = toStage(e);
    const target = findTargetSlot(p.x, p.y);
    if (!target) {
      returnHome(tile);
    } else if (target.idx === tile.monthIdx) {
      lockTile(tile, target);
    } else {
      wrongDrop(tile, target);
    }
  }

  function returnHome(tile) {
    tile.el.classList.add("returning");
    tile.el.style.left = `${tile.homeX}px`;
    tile.el.style.top = `${tile.homeY}px`;
    const cleanup = () => tile.el.classList.remove("returning");
    tile.el.addEventListener("transitionend", cleanup, { once: true });
    window.setTimeout(cleanup, 620); // fallback if no transition fires
  }

  // ------------------------------------------------------------- gameplay --
  function lockTile(tile, slot) {
    slot.filled = true;
    slot.slotEl.classList.remove("empty", "hot");
    slot.slotEl.appendChild(makeChip(tile.monthIdx, "locked"));
    slot.rowEl.classList.remove("hot");
    slot.rowEl.classList.add("just-locked");
    window.setTimeout(() => slot.rowEl.classList.remove("just-locked"), 700);

    tile.el.remove();
    tiles = tiles.filter((t) => t !== tile);

    // Speed scoring: timed from the previous correct placement.
    const now = performance.now();
    const elapsed = (now - placeClock) / 1000;
    placeClock = now;
    const pts = Math.max(15, 60 - Math.floor(elapsed * 4)) + RANKS.indexOf(rank) * 8;
    score += pts;
    streak += 1;
    totalPlaced += 1;
    syncBest();

    const tint = TINTS[tile.monthIdx];
    spawnRing(slot.rect.cx, slot.rect.cy, tint);
    burstParticles(slot.rect.cx, slot.rect.cy, [tint, "#ffffff", "#fbbf24"], 16);
    scorePop(slot.rect.cx, slot.rect.cy, `+${pts}`);
    playLock(streak);
    updateHud();

    if (tiles.length === 0) roundComplete();
  }

  function wrongDrop(tile, slot) {
    score = Math.max(0, score - 5);
    streak = 0;
    roundMistakes += 1;
    totalMistakes += 1;

    slot.slotEl.classList.remove("reject");
    void slot.slotEl.offsetWidth;
    slot.slotEl.classList.add("reject");

    shakeStage(false);
    playWrong();
    scorePop(slot.rect.cx, slot.rect.cy, "-5", true);
    returnHome(tile);
    updateHud();
  }

  function syncBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function updateHud() {
    scoreEl.textContent = score;
    rankLabel.textContent = rank;
    rankLabel.className = "val rank-" + rank;
    roundEl.textContent = mode === "idle" || mode === "over"
      ? "–"
      : `${Math.min(roundIndex + 1, ROUNDS_PER_RUN)}/${ROUNDS_PER_RUN}`;
    bestEl.textContent = best;
    scoreChip.classList.toggle("hot", streak >= 3);
    musicHot = streak >= 3 && mode === "playing";
  }

  function rankLegendHtml() {
    return `
      <div class="rank-legend">
        <span><span class="rank-badge rank-C">C</span> ${RANK_FLAVOR.C}</span>
        <span><span class="rank-badge rank-B">B</span> ${RANK_FLAVOR.B}</span>
        <span><span class="rank-badge rank-A">A</span> ${RANK_FLAVOR.A}</span>
        <span><span class="rank-badge rank-S">S</span> ${RANK_FLAVOR.S}</span>
      </div>`;
  }

  function showStartOverlay() {
    overlayTitle.textContent = "CALENDAR SCRAMBLE";
    overlayText.textContent =
      "Drag each missing month to its ordinal slot — 1st through 12th. Clear three rounds before the curtain falls to rank up. Higher ranks leave fewer months filled in.";
    overlayExtra.innerHTML = `
      <p class="stat-line">Current rank <span class="rank-badge rank-${rank}">${rank}</span></p>
      ${rankLegendHtml()}`;
    overlayStats.hidden = true;
    startBtn.textContent = "Fix the year";
    overlay.classList.remove("hidden");
  }

  // ----------------------------------------------------------- game flow ---
  async function startGame() {
    ensureAudio();
    clearTasks();
    stopTimer();
    score = 0;
    streak = 0;
    roundIndex = 0;
    roundMistakes = 0;
    totalMistakes = 0;
    totalPlaced = 0;
    timedOut = false;
    drag = null;
    overlay.classList.add("hidden");
    overlayExtra.innerHTML = "";
    buildRound();
    mode = "playing";
    updateHud();
    startMusic();
    try {
      await MathArcade.ensurePlayer();
    } catch (err) {
      console.error(err);
    }
  }

  function victory() {
    finishGame(true);
  }

  async function finishGame(won) {
    if (mode === "idle" || mode === "over") return;
    clearTasks();
    stopTimer();
    stopMusic();
    mode = "over";
    drag = null;

    let rankedUp = false;
    const oldRank = rank;
    if (won) {
      const nr = nextRank(rank);
      if (nr !== rank) {
        rank = nr;
        rankedUp = true;
        playRankUp();
      }
      playVictory();
      shakeStage(true);
      confettiRain(110);
      overlayTitle.textContent = rankedUp ? "Rank Up!" : "Year Master!";
      overlayText.textContent = totalMistakes === 0
        ? "A flawless calendar — every month found its home on the first try!"
        : "All months back in order for this run. The calendar holds!";
    } else {
      if (rank === "S" && roundIndex === 0) {
        rank = "A";
      }
      overlayTitle.textContent = timedOut ? "Time's up!" : "Calendar closed";
      overlayText.textContent = timedOut
        ? "The curtain covered the year. Try again before it falls!"
        : "The months will scatter again whenever you're ready.";
    }

    hideCurtain();
    updateHud();

    const rankHtml = rankedUp
      ? `<div class="rank-up-banner">RANK UP! ${oldRank} → ${rank}</div>`
      : "";

    overlayExtra.innerHTML = `
      ${rankHtml}
      <div class="end-stats">
        <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
        <div class="end-stat"><span class="lbl">Months</span><span class="num">${totalPlaced}</span></div>
        <div class="end-stat"><span class="lbl">Rank</span><span class="num rank-${rank}">${rank}</span></div>
      </div>
      ${rankLegendHtml()}`;
    overlayStats.hidden = true;
    startBtn.textContent = "Play again";
    overlay.classList.remove("hidden");

    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, RANKS.indexOf(rank) + 1, {
        rank,
        lastScore: score,
        bestScore: best,
        monthsPlaced: totalPlaced,
        mistakes: totalMistakes,
        won
      });
    } catch (err) {
      console.error(err);
    }
  }

  async function loadRank() {
    try {
      const progress = await MathArcade.loadProgress(GAME_ID);
      let stats = {};
      if (progress && progress.statsJson) {
        try { stats = JSON.parse(progress.statsJson); } catch (_) { stats = {}; }
      }
      rank = parseRank(stats);
    } catch (_) {
      rank = "C";
    }
  }

  startBtn.addEventListener("click", startGame);
  endBtn.addEventListener("click", () => {
    timedOut = false;
    finishGame(false);
  });

  window.addEventListener("resize", () => {
    requestAnimationFrame(() => {
      refreshSlotRects();
      // Keep field tiles inside the stage after a resize.
      const fr = fieldRect();
      for (const t of tiles) {
        if (drag && drag.tile === t) continue;
        t.homeX = clamp(t.homeX, fr.left, fr.left + Math.max(0, fr.width - t.el.offsetWidth));
        t.homeY = clamp(t.homeY, fr.top, fr.top + Math.max(0, fr.height - t.el.offsetHeight));
        t.el.style.left = `${t.homeX}px`;
        t.el.style.top = `${t.homeY}px`;
      }
    });
  });

  window.addEventListener("pagehide", () => {
    stopMusic();
    stopTimer();
  });

  // ---------------------------------------------------------------- boot ---
  bestEl.textContent = best;
  renderStack(null); // idle backdrop: the full year, neatly stacked
  computeStageRect();
  updateHud();
  loadRank().then(() => {
    updateHud();
    showStartOverlay();
  });
})();
