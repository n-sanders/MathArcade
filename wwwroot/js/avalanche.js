/* Avalanche Run — full-screen skip-counting-DOWN platform hopper.
   The platforms ARE the answers: tap the slab with the next countdown
   number to hop down the mountain before the avalanche buries you. */
(function () {
  const GAME_ID = "avalanche";
  const RANKS = ["C", "B", "A", "S"];
  const RANK_SPEED = { C: 1, B: 1.35, A: 1.75, S: 2.25 };
  const TARGET_MULT = 12;
  const PLAYER_H = 72;

  // ------------------------------------------------------------- DOM ----
  const stage = document.getElementById("stage");
  const world = document.getElementById("world");
  const platformsEl = document.getElementById("platforms");
  const playerEl = document.getElementById("player");
  const avalancheEl = document.getElementById("avalanche");
  const dangerLine = document.getElementById("danger-line");
  const dangerLabel = dangerLine.querySelector(".label");
  const fxEl = document.getElementById("fx-layer");
  const flashEl = document.getElementById("flash");
  const vignette = document.getElementById("vignette");
  const snowEl = document.getElementById("snowfall");
  const chunksEl = document.getElementById("snow-chunks");
  const bgFar = document.getElementById("bg-far");
  const bgMid = document.getElementById("bg-mid");
  const frostMeter = document.getElementById("frost-meter");
  const frostFill = frostMeter.querySelector(".fill");
  const scoreEl = document.getElementById("score");
  const comboChip = document.getElementById("combo-chip");
  const comboEl = document.getElementById("combo");
  const skipLabel = document.getElementById("skip-label");
  const rankLabel = document.getElementById("rank-label");
  const promptRibbon = document.getElementById("prompt-ribbon");
  const promptText = document.getElementById("prompt-text");
  const progressStep = document.getElementById("progress-step");
  const overlay = document.getElementById("overlay");
  const overlayCard = document.getElementById("overlay-card");

  const poseIdle = document.getElementById("pose-idle");
  const poseCrouch = document.getElementById("pose-crouch");
  const poseJump = document.getElementById("pose-jump");
  const poseCelebrate = document.getElementById("pose-celebrate");

  // ----------------------------------------------------------- state ----
  let ranksBySkip = {}; // { "2": "C", ... "10": "S" }
  let skipBy = 2;
  let rank = "C";
  let score = 0;
  let step = 0; // index of the row the player is standing on (0..12)
  let current = 0; // last correct number reached (starts at skipBy*12)
  let combo = 0;
  let playing = false;
  let jumping = false;

  let rows = []; // rows[i] = { y, plats: [{x, w, num, correct, el, dead}] }
  let rowGap = 190;
  let platW = 150;
  let baseY = 0; // world Y of the TOP (start) row
  let playerX = 0;
  let playerY = 0;
  let avalancheY = 0; // world Y of the avalanche front (its lowest edge)
  let cameraY = 0;
  let camStart = 0;
  let stageW = 900;
  let stageH = 600;
  let lastTs = 0;
  let gameRaf = null;
  let jumpRaf = null;
  let trailTimer = null;

  // =================================================================
  // AUDIO — procedural icy soundtrack + SFX
  // =================================================================
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let musicUrgent = false;
  let windSrc = null;
  let windGain = null;

  const BPM_NORMAL = 104;
  const BPM_URGENT = 138;

  function stepDur() {
    return 60 / (musicUrgent ? BPM_URGENT : BPM_NORMAL) / 4;
  }

  // Am — Em — F — G  (cold chase vibes)
  const BASS_NOTES = [45, 40, 41, 43]; // A2 E2 F2 G2
  const CHORDS = [
    [57, 60, 64, 69], // A C E A
    [52, 55, 59, 64], // E G B E
    [53, 57, 60, 65], // F A C F
    [55, 59, 62, 67]  // G B D G
  ];
  const ARP = [3, 1, 2, 0, 2, 1, 3, 2];

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
      musicGain = audio.createGain();
      musicGain.gain.value = 0.7;
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
    const dur = stepDur();
    const bar = Math.floor(stepIdx / 16) % 4;
    const pos = stepIdx % 16;
    const chord = CHORDS[bar];
    const urgencyBoost = musicUrgent ? 1.25 : 1;

    if (pos % 4 === 0) {
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(BASS_NOTES[bar]),
        t, dur: 0.3, gain: 0.28 * urgencyBoost, attack: 0.012, filter: 420
      });
    }

    // icy bell arp — pure sines up high, like ice crystals
    if (pos % 2 === 0) {
      const midi = chord[ARP[(pos / 2) % ARP.length]] + 24;
      tone(musicGain, {
        type: "sine", freq: midiToFreq(midi),
        t, dur: 0.22, gain: 0.075 * urgencyBoost, attack: 0.004
      });
      // faint octave shimmer
      tone(musicGain, {
        type: "triangle", freq: midiToFreq(midi + 12),
        t: t + 0.02, dur: 0.14, gain: 0.02 * urgencyBoost, attack: 0.004
      });
    }

    // slow frozen pad each bar
    if (pos === 0) {
      const barLen = dur * 16;
      tone(musicGain, {
        type: "triangle", freq: midiToFreq(chord[0] + 12),
        t, dur: barLen, gain: 0.03, attack: 0.5, filter: 900
      });
      tone(musicGain, {
        type: "triangle", freq: midiToFreq(chord[2] + 12) * 1.003,
        t, dur: barLen, gain: 0.024, attack: 0.55, filter: 900
      });
    }

    // icy hiss / hat — crisp and glassy
    if (pos % 4 === 2 || (musicUrgent && pos % 2 === 1)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.05);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = musicUrgent ? 6000 : 7500;
      const g = audio.createGain();
      g.gain.setValueAtTime(musicUrgent ? 0.06 : 0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t);
    }

    // rumbling thump on quarters when the avalanche is close
    if (musicUrgent && pos % 4 === 0) {
      tone(musicGain, {
        type: "sine", freq: 80, freqEnd: 30,
        t, dur: 0.2, gain: 0.3, attack: 0.005
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

  function startWind() {
    if (windSrc) return;
    windSrc = audio.createBufferSource();
    windSrc.buffer = noiseBuffer(2.5);
    windSrc.loop = true;
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380;
    windGain = audio.createGain();
    windGain.gain.value = 0.055;
    windSrc.connect(f); f.connect(windGain); windGain.connect(musicGain);
    windSrc.start();
  }

  function stopWind() {
    if (windSrc) {
      try { windSrc.stop(); } catch (_) { /* already stopped */ }
      windSrc = null;
      windGain = null;
    }
  }

  function startMusic() {
    if (!ensureAudio() || musicTimer) return;
    musicStep = 0;
    musicUrgent = false;
    nextNoteTime = audio.currentTime + 0.05;
    startWind();
    musicTimer = setInterval(musicScheduler, 80);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    stopWind();
  }

  function playJump() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sine", freq: 240, freqEnd: 760, t, dur: 0.26, gain: 0.26, attack: 0.01 });
    tone(sfxGain, { type: "triangle", freq: 480, freqEnd: 1050, t: t + 0.04, dur: 0.2, gain: 0.13 });
    // whoosh of cold air
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.25);
    const f = audio.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.2);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playLand() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    // soft snow crunch
    tone(sfxGain, { type: "triangle", freq: 160, freqEnd: 85, t, dur: 0.12, gain: 0.18 });
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.09);
    const f = audio.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1600;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playCorrect(comboLevel) {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    // crystalline chimes climb with the combo — streaks literally sound higher
    const shift = Math.pow(1.0595, Math.min(comboLevel || 0, 8));
    tone(sfxGain, { type: "sine", freq: 587 * shift, t, dur: 0.14, gain: 0.2 });
    tone(sfxGain, { type: "sine", freq: 740 * shift, t: t + 0.08, dur: 0.14, gain: 0.18 });
    tone(sfxGain, { type: "sine", freq: 880 * shift, t: t + 0.16, dur: 0.2, gain: 0.16 });
    tone(sfxGain, { type: "triangle", freq: 1760 * shift, t: t + 0.2, dur: 0.16, gain: 0.06 });
  }

  function playReveal() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "triangle", freq: 420, freqEnd: 720, t, dur: 0.14, gain: 0.08 });
    tone(sfxGain, { type: "sine", freq: 1040, t: t + 0.08, dur: 0.1, gain: 0.06 });
  }

  function playWrong() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "square", freq: 150, freqEnd: 85, t, dur: 0.25, gain: 0.18, filter: 700 });
    tone(sfxGain, { type: "sawtooth", freq: 110, freqEnd: 60, t: t + 0.12, dur: 0.32, gain: 0.13, filter: 500 });
    // avalanche rumble surge
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.55);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(360, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.38, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playWin() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [587, 740, 880, 1174].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.12, dur: 0.35, gain: 0.22 });
    });
    tone(sfxGain, { type: "sine", freq: 1480, t: t + 0.5, dur: 0.55, gain: 0.16 });
  }

  function playLose() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sawtooth", freq: 180, freqEnd: 45, t, dur: 0.8, gain: 0.22, filter: 700 });
    // long avalanche roar
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(1.1);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 1.0);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playClick() {
    if (!ensureAudio()) return;
    tone(sfxGain, { type: "sine", freq: 720, dur: 0.06, gain: 0.12 });
  }

  function playRankUp() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [440, 587, 740, 880, 1174].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.09, dur: 0.28, gain: 0.2 });
    });
  }

  // ----------------------------------------------------------- utils ----
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function defaultRanks() {
    const o = {};
    for (let n = 2; n <= 10; n++) o[String(n)] = "C";
    return o;
  }

  function parseRanks(stats) {
    const base = defaultRanks();
    if (!stats || typeof stats !== "object") return base;
    const src = stats.ranks || stats;
    for (let n = 2; n <= 10; n++) {
      const key = String(n);
      const r = src[key];
      if (RANKS.includes(r)) base[key] = r;
    }
    return base;
  }

  function nextRank(r) {
    const i = RANKS.indexOf(r);
    return RANKS[Math.min(RANKS.length - 1, i + 1)];
  }

  function avalancheSpeedPx() {
    // pixels/second the avalanche front descends, scaled by this number's rank
    return (30 + step * 2.5) * (RANK_SPEED[rank] || 1) * (stageH / 700);
  }

  // ------------------------------------------------------------ juice ----
  function setPose(name) {
    poseIdle.setAttribute("display", name === "idle" ? "inline" : "none");
    poseCrouch.setAttribute("display", name === "crouch" ? "inline" : "none");
    poseJump.setAttribute("display", name === "jump" ? "inline" : "none");
    poseCelebrate.setAttribute("display", name === "celebrate" ? "inline" : "none");
  }

  function shake(big) {
    stage.classList.remove("shake", "shake-big");
    void stage.offsetWidth;
    stage.classList.add(big ? "shake-big" : "shake");
  }

  function flash(kind) {
    flashEl.className = "screen-flash go" + (kind ? " " + kind : "");
    setTimeout(() => { flashEl.className = "screen-flash"; }, 360);
  }

  function spawnSparks(x, y, count) {
    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.className = "spark";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 40 + Math.random() * 80;
      s.style.left = x + "px";
      s.style.top = y + "px";
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist - 30 + "px");
      s.style.background = Math.random() > 0.4 ? "#eaf7ff" : "#9fd8ff";
      fxEl.appendChild(s);
      setTimeout(() => s.remove(), 750);
    }
  }

  function floatText(x, y, text, cls) {
    const el = document.createElement("div");
    el.className = "float-text" + (cls ? " " + cls : "");
    el.textContent = text;
    el.style.left = x + "px";
    el.style.top = y + "px";
    fxEl.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function spawnTrailDot() {
    const d = document.createElement("div");
    d.className = "trail-dot";
    d.style.left = playerX + "px";
    d.style.top = (playerY + PLAYER_H * 0.6) + "px";
    world.appendChild(d);
    setTimeout(() => d.remove(), 520);
  }

  function buildSnowfall() {
    snowEl.innerHTML = "";
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("div");
      s.className = "snowflake";
      s.style.left = Math.random() * 100 + "%";
      s.style.width = s.style.height = 2 + Math.random() * 5 + "px";
      s.style.animationDuration = 5 + Math.random() * 8 + "s";
      s.style.animationDelay = Math.random() * 7 + "s";
      s.style.opacity = 0.35 + Math.random() * 0.5;
      snowEl.appendChild(s);
    }
  }

  function buildChunks() {
    chunksEl.innerHTML = "";
    for (let i = 0; i < 12; i++) {
      const b = document.createElement("div");
      b.className = "snow-chunk";
      const size = 10 + Math.random() * 22;
      b.style.width = b.style.height = size + "px";
      b.style.left = Math.random() * 100 + "%";
      b.style.top = Math.random() * 40 + "%";
      b.style.animationDuration = 1.0 + Math.random() * 1.6 + "s";
      b.style.animationDelay = Math.random() * 2 + "s";
      chunksEl.appendChild(b);
    }
  }

  // ---------------------------------------------------------- layout ----
  function measure() {
    stageW = stage.clientWidth || 900;
    stageH = stage.clientHeight || 600;
    rowGap = clamp(stageH * 0.3, 150, 240);
    platW = clamp(stageW * 0.24, 96, 190);
    baseY = 130; // start row near the TOP — we descend from here
  }

  function rowXs(rowIdx) {
    // three columns spread across the full width, with per-row jitter
    const cols = [0.19, 0.5, 0.81];
    const seed = rowIdx * 2654435761 % 1000 / 1000; // deterministic per row
    return cols.map((c, i) => {
      const jitter = (Math.sin(seed * 12.9898 + i * 78.233) % 1) * 0.045;
      const cx = clamp(c + jitter, 0.12, 0.88) * stageW;
      return clamp(cx - platW / 2, 10, stageW - platW - 10);
    });
  }

  // ---------------------------------------------------- world building ----
  function makeOptions(rowIdx) {
    const correct = skipBy * (TARGET_MULT - rowIdx);
    const pool = [
      correct + skipBy, correct - skipBy,
      correct + 1, correct - 1,
      correct + 2, correct - 2,
      correct + skipBy + 1, correct - skipBy - 1,
      correct + 10
    ].filter((n) => n >= 0 && n !== correct);
    const wrongs = [];
    shuffle(pool);
    for (const n of pool) {
      if (!wrongs.includes(n)) wrongs.push(n);
      if (wrongs.length === 2) break;
    }
    while (wrongs.length < 2) wrongs.push(correct + wrongs.length + 3);
    return shuffle([correct, ...wrongs]);
  }

  function spawnWorld() {
    platformsEl.innerHTML = "";
    rows = [];

    const startNum = skipBy * TARGET_MULT;

    // start pad at the summit — wide and centered, shows the starting number
    const startW = Math.min(220, stageW * 0.5);
    const startX = (stageW - startW) / 2;
    const startEl = document.createElement("div");
    startEl.className = "platform start-pad current";
    startEl.style.width = startW + "px";
    startEl.style.left = startX + "px";
    startEl.style.top = baseY + "px";
    startEl.innerHTML = '<span class="num">' + startNum + "</span>";
    platformsEl.appendChild(startEl);
    rows.push({ y: baseY, plats: [{ x: startX, w: startW, num: startNum, correct: true, el: startEl }] });

    for (let i = 1; i <= TARGET_MULT; i++) {
      const y = baseY + i * rowGap;
      const xs = rowXs(i);
      const nums = makeOptions(i);
      const plats = nums.map((num, k) => {
        const el = document.createElement("div");
        el.className = "platform dormant";
        el.style.width = platW + "px";
        el.style.left = xs[k] + "px";
        el.style.top = y + "px";
        el.innerHTML = '<span class="num">?</span>';
        platformsEl.appendChild(el);
        const plat = { x: xs[k], w: platW, num, correct: num === skipBy * (TARGET_MULT - i), el, dead: false };
        el.addEventListener("click", () => onPlatformTap(i, plat));
        return plat;
      });
      rows.push({ y, plats });
    }

    playerX = startX + startW / 2;
    playerY = baseY - PLAYER_H + 6;
    avalancheY = playerY - stageH * 0.49; // starting cushion above the player
    setPose("idle");
    placePlayer();
    updateCamera(true);
    camStart = cameraY;
    updateAvalancheDom();
  }

  function armRow(i) {
    const row = rows[i];
    if (!row) return;
    row.plats.forEach((p) => {
      if (p.dead) return;
      p.el.classList.remove("dormant");
      p.el.classList.add("armed");
      p.el.querySelector(".num").textContent = String(p.num);
    });
    playReveal();
    promptText.innerHTML = step === 0
      ? `Counting down by <span class="hl">${skipBy}</span>s from <span class="hl">${current}</span> · first hop: <span class="q">?</span>`
      : `Counting down by <span class="hl">${skipBy}</span>s · after <span class="hl">${current}</span> comes <span class="q">?</span>`;
    progressStep.textContent = step + "/" + TARGET_MULT;
    promptRibbon.classList.remove("bump");
    void promptRibbon.offsetWidth;
    promptRibbon.classList.add("bump");
  }

  function disarmRow(i, chosen) {
    const row = rows[i];
    if (!row) return;
    row.plats.forEach((p) => {
      p.el.classList.remove("armed");
      if (p !== chosen && !p.dead) p.el.classList.add("passed");
    });
  }

  // ---------------------------------------------------------- answers ----
  function onPlatformTap(rowIdx, plat) {
    if (!playing || jumping || rowIdx !== step + 1 || plat.dead) return;

    if (plat.correct) {
      combo += 1;
      const bonus = 10 + rowIdx * 2 + (RANK_SPEED[rank] - 1) * 8 + Math.min(combo, 5) * 2;
      score += Math.round(bonus);
      playCorrect(combo);
      leapTo(rowIdx, plat);
    } else {
      plat.dead = true;
      plat.el.classList.add("shatter");
      setTimeout(() => plat.el.remove(), 950);
      combo = 0;
      score = Math.max(0, score - 5);
      avalancheY += 70; // the avalanche surges down!
      shake(false);
      flash("bad");
      playWrong();
      const px = plat.x + plat.w / 2;
      const py = rows[rowIdx].y - cameraY;
      floatText(px, py, "✗ Snow surge!", "bad");
      updateHud();
    }
  }

  function comboShout() {
    if (combo === 3) return "Cool streak!";
    if (combo === 5) return "Frosty!";
    if (combo === 8) return "Sub-zero!";
    if (combo === 12) return "BLIZZARD!!";
    return null;
  }

  function leapTo(rowIdx, plat) {
    jumping = true;
    disarmRow(rowIdx, plat);

    setPose("crouch");
    playerEl.classList.remove("pose-jump", "pose-land");
    playJump();

    const startX = playerX;
    const startY = playerY;
    const endX = plat.x + plat.w / 2;
    const endY = rows[rowIdx].y - PLAYER_H + 6;
    const dur = 520;
    const t0 = performance.now();

    // brief crouch, then launch
    setTimeout(() => {
      setPose("jump");
      playerEl.classList.add("pose-jump");
      flash();
      spawnSparks(startX, startY - cameraY + 50, 12);
      floatText(endX, rows[rowIdx].y - cameraY - 20, String(plat.num), "big");
      trailTimer = setInterval(spawnTrailDot, 45);
    }, 90);

    function anim(now) {
      const u = clamp((now - t0 - 90) / dur, 0, 1);
      if (u <= 0) {
        jumpRaf = requestAnimationFrame(anim);
        return;
      }
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const lift = Math.sin(Math.PI * u) * (60 + rowGap * 0.2);
      playerX = startX + (endX - startX) * ease;
      playerY = startY + (endY - startY) * ease - lift;
      placePlayer();

      if (u < 1) {
        jumpRaf = requestAnimationFrame(anim);
        return;
      }

      jumpRaf = null;
      if (trailTimer) { clearInterval(trailTimer); trailTimer = null; }

      // land!
      playerX = endX;
      playerY = endY;
      placePlayer();
      setPose("idle");
      playerEl.classList.remove("pose-jump");
      playerEl.classList.add("pose-land");
      playLand();
      plat.el.classList.remove("passed");
      plat.el.classList.add("current", "landed");
      spawnSparks(endX, endY - cameraY + PLAYER_H - 10, 8);
      shake(false);

      // mark previous row done
      if (rows[step]) {
        rows[step].plats.forEach((p) => {
          p.el.classList.remove("current");
          if (!p.dead) p.el.classList.add("passed");
        });
      }

      step = rowIdx;
      current = plat.num;
      avalancheY -= 46; // reward: the avalanche eases back a bit
      updateHud();
      jumping = false;

      const shout = comboShout();
      if (shout) floatText(endX, endY - cameraY - 46, shout, "combo");

      if (step >= TARGET_MULT) {
        winRound();
        return;
      }
      armRow(step + 1);
    }

    jumpRaf = requestAnimationFrame(anim);
  }

  // ---------------------------------------------------------- HUD etc ----
  function updateHud() {
    scoreEl.textContent = String(score);
    skipLabel.textContent = String(skipBy);
    rankLabel.textContent = rank;
    rankLabel.className = "val rank-" + rank;
    progressStep.textContent = step + "/" + TARGET_MULT;
    comboEl.textContent = String(combo);
    comboChip.classList.toggle("show", combo >= 2);
  }

  function placePlayer() {
    playerEl.style.left = playerX + "px";
    playerEl.style.top = playerY + "px";
  }

  function updateCamera(instant) {
    // keep the player ~38% down the screen: avalanche above, answer row below
    const targetCam = playerY + PLAYER_H - stageH * 0.38;
    if (instant) cameraY = targetCam;
    else cameraY += (targetCam - cameraY) * 0.12;
    world.style.transform = `translate3d(0, ${-cameraY}px, 0)`;

    // parallax peaks drift up as we descend
    const descended = Math.max(0, cameraY - camStart);
    bgFar.style.transform = `translateY(${-descended * 0.05}px)`;
    bgMid.style.transform = `translateY(${-descended * 0.12}px)`;
  }

  function updateAvalancheDom() {
    const screenFront = avalancheY - cameraY;
    const visualFront = Math.max(screenFront, 46);
    avalancheEl.style.height = (visualFront + 30) + "px";
    dangerLine.style.top = (visualFront + 4) + "px";

    const gap = playerY - avalancheY;
    const frost = clamp(1 - gap / (stageH * 0.75), 0, 1);
    frostFill.style.height = Math.round(frost * 100) + "%";
    frostMeter.classList.toggle("cold", frost > 0.75);
    vignette.classList.toggle("on", playing && frost > 0.62);
    dangerLine.classList.toggle("cold", frost > 0.75);
    musicUrgent = playing && frost > 0.55;

    if (frost > 0.75) dangerLabel.textContent = "CRITICAL · FAIL LINE";
    else if (frost > 0.55) dangerLabel.textContent = "DANGER · FAIL LINE";
    else dangerLabel.textContent = "FAIL LINE";
  }

  // --------------------------------------------------------- game loop ----
  function tick(ts) {
    if (!playing) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    avalancheY += avalancheSpeedPx() * dt * (jumping ? 0.85 : 1);

    if (!jumping && rows[step]) {
      // idle bob
      playerY = rows[step].y - PLAYER_H + 6 + Math.sin(ts / 280) * 1.5;
      placePlayer();
    }

    updateCamera(false);
    updateAvalancheDom();

    // fail check: the avalanche front reaches the player's head
    if (avalancheY >= playerY + 6) {
      endByAvalanche();
      return;
    }

    gameRaf = requestAnimationFrame(tick);
  }

  function stopLoops() {
    if (gameRaf) cancelAnimationFrame(gameRaf);
    if (jumpRaf) cancelAnimationFrame(jumpRaf);
    if (trailTimer) clearInterval(trailTimer);
    gameRaf = null;
    jumpRaf = null;
    trailTimer = null;
  }

  function endByAvalanche() {
    if (!playing) return;
    playing = false;
    jumping = false;
    stopLoops();
    setPose("crouch");
    shake(true);
    flash("bad");
    playLose();
    vignette.classList.remove("on");
    floatText(playerX, playerY - cameraY, "Buried!", "bad");
    setTimeout(() => finishGame(false), 650);
  }

  function winRound() {
    playing = false;
    stopLoops();
    setPose("celebrate");
    flash("win");
    playWin();
    vignette.classList.remove("on");
    // celebration snow-spark storm
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        spawnSparks(
          playerX + randInt(-120, 120),
          playerY - cameraY + randInt(-80, 40),
          14
        );
      }, i * 160);
    }
    floatText(playerX, playerY - cameraY - 40, "MADE IT!", "big");
    setTimeout(() => finishGame(true), 1100);
  }

  async function finishGame(won) {
    playing = false;
    jumping = false;
    stopLoops();
    stopMusic();

    let rankedUp = false;
    const oldRank = rank;
    if (won) {
      score += 80 + Math.round(20 * RANK_SPEED[rank]);
      const nr = nextRank(rank);
      if (nr !== rank) {
        ranksBySkip[String(skipBy)] = nr;
        rank = nr;
        rankedUp = true;
        playRankUp();
      }
    } else if (rank === "S" && step < 4) {
      // soft demotion only from S on a very early fail
      ranksBySkip[String(skipBy)] = "A";
      rank = "A";
    }

    updateHud();

    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, RANKS.indexOf(rank) + 1, {
        ranks: ranksBySkip,
        lastSkipBy: skipBy,
        lastScore: score,
        won,
        lastStep: step
      });
    } catch (err) {
      console.error(err);
    }

    const rankHtml = rankedUp
      ? `<div class="rank-up-banner">RANK UP! ${oldRank} → ${rank} on ×${skipBy}</div>`
      : "";

    overlayCard.innerHTML = `
      <h2>${won ? "You outran the avalanche!" : "Buried in snow!"}</h2>
      <p>${won
        ? `Skip-counted down by ${skipBy}s all the way from ${skipBy * TARGET_MULT} to 0.`
        : `Made it to ${current} counting down by ${skipBy}s. Try again!`}</p>
      ${rankHtml}
      <div class="end-stats">
        <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
        <div class="end-stat"><span class="lbl">Hops</span><span class="num">${step}/${TARGET_MULT}</span></div>
        <div class="end-stat"><span class="lbl">Rank</span><span class="num rank-${rank}">${rank}</span></div>
      </div>
      <button class="btn btn-primary" id="again-btn">Run again</button>
      <br/>
      <button class="btn btn-ghost" id="pick-btn">Pick another number</button>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", () => {
      playClick();
      beginRound(skipBy);
    });
    document.getElementById("pick-btn").addEventListener("click", () => {
      playClick();
      showPicker();
    });
  }

  // ---------------------------------------------------------- screens ----
  function showPicker() {
    stopMusic();
    playing = false;
    stopLoops();

    const buttons = [];
    for (let n = 2; n <= 10; n++) {
      const r = ranksBySkip[String(n)] || "C";
      buttons.push(`
        <button type="button" class="pick-btn" data-n="${n}">
          <span class="n">×${n}</span>
          <span class="rank-badge rank-${r}">${r}</span>
          <span class="sub">down from ${n * TARGET_MULT}</span>
        </button>`);
    }

    overlayCard.innerHTML = `
      <h2>Pick a countdown</h2>
      <p>Each number has its own rank. Higher rank = a faster, angrier avalanche.</p>
      <div class="pick-grid">${buttons.join("")}</div>
      <div class="rank-legend">
        <span><span class="rank-badge rank-C">C</span> flurry</span>
        <span><span class="rank-badge rank-B">B</span> brisk</span>
        <span><span class="rank-badge rank-A">A</span> blizzard</span>
        <span><span class="rank-badge rank-S">S</span> whiteout</span>
      </div>`;
    overlay.classList.remove("hidden");

    overlayCard.querySelectorAll(".pick-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        playClick();
        beginRound(Number(btn.getAttribute("data-n")));
      });
    });
  }

  async function loadRanks() {
    try {
      const progress = await MathArcade.loadProgress(GAME_ID);
      let stats = {};
      if (progress && progress.statsJson) {
        try { stats = JSON.parse(progress.statsJson); } catch (_) { stats = {}; }
      }
      ranksBySkip = parseRanks(stats);
    } catch (_) {
      ranksBySkip = defaultRanks();
    }
  }

  function beginRound(n) {
    ensureAudio();
    startMusic();
    skipBy = n;
    rank = ranksBySkip[String(n)] || "C";
    score = 0;
    step = 0;
    current = n * TARGET_MULT;
    combo = 0;
    jumping = false;
    playing = true;

    measure();
    spawnWorld();
    updateHud();
    overlay.classList.add("hidden");
    armRow(1);
    lastTs = performance.now();
    stopLoops();
    playing = true;
    gameRaf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------- boot ----
  function onResize() {
    const prevGap = playerY - avalancheY;
    measure();
    if (!rows.length) return;

    rows.forEach((row, i) => {
      row.y = baseY + i * rowGap;
      const xs = i === 0 ? null : rowXs(i);
      row.plats.forEach((p, k) => {
        if (i === 0) {
          p.w = Math.min(220, stageW * 0.5);
          p.x = (stageW - p.w) / 2;
        } else {
          p.w = platW;
          p.x = xs[k];
        }
        p.el.style.width = p.w + "px";
        p.el.style.left = p.x + "px";
        p.el.style.top = row.y + "px";
      });
    });

    if (rows[step] && !jumping) {
      const stand = rows[step].plats.find((p) => p.el.classList.contains("current")) || rows[step].plats[0];
      playerX = stand.x + stand.w / 2;
      playerY = rows[step].y - PLAYER_H + 6;
      placePlayer();
      avalancheY = playerY - prevGap; // keep the same danger level
    }
    updateCamera(true);
    updateAvalancheDom();
  }

  // keyboard: 1/2/3 picks the left/middle/right platform of the armed row
  window.addEventListener("keydown", (e) => {
    if (!playing || jumping) return;
    const k = e.key;
    if (k !== "1" && k !== "2" && k !== "3") return;
    const row = rows[step + 1];
    if (!row) return;
    const alive = row.plats.filter((p) => !p.dead).sort((a, b) => a.x - b.x);
    const plat = alive[Number(k) - 1];
    if (plat) onPlatformTap(step + 1, plat);
  });

  window.addEventListener("resize", onResize);

  buildSnowfall();
  buildChunks();
  measure();

  document.getElementById("start-btn").addEventListener("click", async () => {
    playClick();
    await MathArcade.ensurePlayer();
    await loadRanks();
    showPicker();
  });
})();
