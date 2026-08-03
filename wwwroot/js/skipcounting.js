/* Lava Leap — full-screen skip-counting platform jumper.
   The platforms ARE the answers: tap the slab with the next skip-count
   number to leap there before the rising lava catches you. */
(function () {
  const GAME_ID = "skipcounting";
  const RANKS = ["C", "B", "A", "S"];
  const RANK_SPEED = { C: 1, B: 1.35, A: 1.75, S: 2.25 };
  const TARGET_MULT = 12;
  const PLAYER_H = 72;

  // ------------------------------------------------------------- DOM ----
  const stage = document.getElementById("stage");
  const world = document.getElementById("world");
  const platformsEl = document.getElementById("platforms");
  const playerEl = document.getElementById("player");
  const lavaEl = document.getElementById("lava");
  const dangerLine = document.getElementById("danger-line");
  const dangerLabel = dangerLine.querySelector(".label");
  const fxEl = document.getElementById("fx-layer");
  const flashEl = document.getElementById("flash");
  const vignette = document.getElementById("vignette");
  const embersEl = document.getElementById("embers");
  const bubblesEl = document.getElementById("lava-bubbles");
  const bgFar = document.getElementById("bg-far");
  const bgMid = document.getElementById("bg-mid");
  const heatMeter = document.getElementById("heat-meter");
  const heatFill = heatMeter.querySelector(".fill");
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
  let current = 0; // last correct number reached
  let combo = 0;
  let playing = false;
  let jumping = false;

  let rows = []; // rows[i] = { y, plats: [{x, w, num, correct, el, dead}] }
  let rowGap = 190;
  let platW = 150;
  let baseY = 0;
  let playerX = 0;
  let playerY = 0;
  let lavaY = 0; // world Y of the lava surface
  let cameraY = 0;
  let camStart = 0;
  let stageW = 900;
  let stageH = 600;
  let lastTs = 0;
  let gameRaf = null;
  let jumpRaf = null;
  let trailTimer = null;

  // =================================================================
  // AUDIO — procedural volcanic soundtrack + SFX
  // =================================================================
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let musicUrgent = false;

  const BPM_NORMAL = 112;
  const BPM_URGENT = 140;

  function stepDur() {
    return 60 / (musicUrgent ? BPM_URGENT : BPM_NORMAL) / 4;
  }

  // Dm — Bb — F — C  (hot chase vibes)
  const BASS_NOTES = [38, 34, 41, 36]; // D2 Bb1 F2 C2
  const CHORDS = [
    [50, 53, 57, 62], // D F A D
    [46, 50, 53, 58], // Bb D F Bb
    [53, 57, 60, 65], // F A C F
    [48, 52, 55, 60]  // C E G C
  ];
  const ARP = [0, 2, 1, 3, 2, 1, 0, 2];

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
        t, dur: 0.28, gain: 0.3 * urgencyBoost, attack: 0.01, filter: 480
      });
    }

    if (pos % 2 === 0) {
      const midi = chord[ARP[(pos / 2) % ARP.length]] + 12;
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(midi),
        t, dur: 0.16, gain: 0.055 * urgencyBoost, attack: 0.005, filter: musicUrgent ? 2200 : 1400
      });
    }

    if (pos === 0) {
      const barLen = dur * 16;
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(chord[0]),
        t, dur: barLen, gain: 0.028, attack: 0.4, filter: 700
      });
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(chord[2]) * 1.002,
        t, dur: barLen, gain: 0.022, attack: 0.45, filter: 700
      });
    }

    // lava hiss / hat
    if (pos % 4 === 2 || (musicUrgent && pos % 2 === 1)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.04);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = musicUrgent ? 4500 : 6000;
      const g = audio.createGain();
      g.gain.setValueAtTime(musicUrgent ? 0.07 : 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t);
    }

    // kick thump on quarters when urgent
    if (musicUrgent && pos % 4 === 0) {
      tone(musicGain, {
        type: "sine", freq: 90, freqEnd: 35,
        t, dur: 0.18, gain: 0.28, attack: 0.005
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
    musicUrgent = false;
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
    tone(sfxGain, { type: "sine", freq: 220, freqEnd: 720, t, dur: 0.28, gain: 0.28, attack: 0.01 });
    tone(sfxGain, { type: "triangle", freq: 440, freqEnd: 980, t: t + 0.04, dur: 0.22, gain: 0.14 });
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.25);
    const f = audio.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.2);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playLand() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "triangle", freq: 180, freqEnd: 90, t, dur: 0.12, gain: 0.22 });
    tone(sfxGain, { type: "sine", freq: 520, t: t + 0.04, dur: 0.1, gain: 0.12 });
  }

  function playCorrect(comboLevel) {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    // pitch climbs with the combo — streaks literally sound higher
    const shift = Math.pow(1.0595, Math.min(comboLevel || 0, 8));
    tone(sfxGain, { type: "sine", freq: 523 * shift, t, dur: 0.12, gain: 0.2 });
    tone(sfxGain, { type: "sine", freq: 659 * shift, t: t + 0.08, dur: 0.12, gain: 0.18 });
    tone(sfxGain, { type: "sine", freq: 784 * shift, t: t + 0.16, dur: 0.18, gain: 0.16 });
  }

  function playReveal() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "triangle", freq: 340, freqEnd: 620, t, dur: 0.14, gain: 0.09 });
    tone(sfxGain, { type: "sine", freq: 880, t: t + 0.08, dur: 0.1, gain: 0.07 });
  }

  function playWrong() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "square", freq: 160, freqEnd: 90, t, dur: 0.25, gain: 0.2, filter: 800 });
    tone(sfxGain, { type: "sawtooth", freq: 120, freqEnd: 70, t: t + 0.12, dur: 0.3, gain: 0.14, filter: 600 });
    // lava surge rumble
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.45);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 280;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playWin() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.12, dur: 0.35, gain: 0.22 });
    });
    tone(sfxGain, { type: "sine", freq: 1318, t: t + 0.5, dur: 0.55, gain: 0.18 });
  }

  function playLose() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sawtooth", freq: 200, freqEnd: 55, t, dur: 0.7, gain: 0.25, filter: 900 });
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.9);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 0.85);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playClick() {
    if (!ensureAudio()) return;
    tone(sfxGain, { type: "sine", freq: 660, dur: 0.06, gain: 0.12 });
  }

  function playRankUp() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
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

  function lavaSpeedPx() {
    // pixels/second the lava surface rises, scaled by this number's rank
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
      s.style.background = Math.random() > 0.4 ? "#ffd166" : "#ff6b1a";
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

  function buildEmbers() {
    embersEl.innerHTML = "";
    for (let i = 0; i < 22; i++) {
      const e = document.createElement("div");
      e.className = "ember";
      e.style.left = Math.random() * 100 + "%";
      e.style.width = e.style.height = 2 + Math.random() * 5 + "px";
      e.style.animationDuration = 4 + Math.random() * 7 + "s";
      e.style.animationDelay = Math.random() * 6 + "s";
      e.style.background = Math.random() > 0.5 ? "#ffd166" : "#ff8a1a";
      embersEl.appendChild(e);
    }
  }

  function buildBubbles() {
    bubblesEl.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const b = document.createElement("div");
      b.className = "lava-bubble";
      const size = 8 + Math.random() * 18;
      b.style.width = b.style.height = size + "px";
      b.style.left = Math.random() * 100 + "%";
      b.style.bottom = Math.random() * 40 + "%";
      b.style.animationDuration = 1.2 + Math.random() * 1.8 + "s";
      b.style.animationDelay = Math.random() * 2 + "s";
      bubblesEl.appendChild(b);
    }
  }

  // ---------------------------------------------------------- layout ----
  function measure() {
    stageW = stage.clientWidth || 900;
    stageH = stage.clientHeight || 600;
    rowGap = clamp(stageH * 0.3, 150, 240);
    platW = clamp(stageW * 0.24, 96, 190);
    baseY = stageH - 130;
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
    const correct = skipBy * rowIdx;
    const pool = [
      correct + skipBy, correct - skipBy,
      correct + 1, correct - 1,
      correct + 2, correct - 2,
      correct + skipBy + 1, correct - skipBy - 1,
      correct + 10
    ].filter((n) => n > 0 && n !== correct);
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

    // start pad — wide and centered
    const startW = Math.min(220, stageW * 0.5);
    const startX = (stageW - startW) / 2;
    const startEl = document.createElement("div");
    startEl.className = "platform start-pad current";
    startEl.style.width = startW + "px";
    startEl.style.left = startX + "px";
    startEl.style.top = baseY + "px";
    startEl.innerHTML = '<span class="num">START</span>';
    platformsEl.appendChild(startEl);
    rows.push({ y: baseY, plats: [{ x: startX, w: startW, num: 0, correct: true, el: startEl }] });

    for (let i = 1; i <= TARGET_MULT; i++) {
      const y = baseY - i * rowGap;
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
        const plat = { x: xs[k], w: platW, num, correct: num === skipBy * i, el, dead: false };
        el.addEventListener("click", () => onPlatformTap(i, plat));
        return plat;
      });
      rows.push({ y, plats });
    }

    playerX = startX + startW / 2;
    playerY = baseY - PLAYER_H + 6;
    lavaY = stageH + 170; // starting cushion below the viewport
    setPose("idle");
    placePlayer();
    updateCamera(true);
    camStart = cameraY;
    updateLavaDom();
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
    promptText.innerHTML = current === 0
      ? `Counting by <span class="hl">${skipBy}</span>s · first jump: <span class="q">?</span>`
      : `Counting by <span class="hl">${skipBy}</span>s · after <span class="hl">${current}</span> comes <span class="q">?</span>`;
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
      plat.el.classList.add("crumble");
      setTimeout(() => plat.el.remove(), 950);
      combo = 0;
      score = Math.max(0, score - 5);
      lavaY -= 70; // lava surges up!
      shake(false);
      flash("bad");
      playWrong();
      const px = plat.x + plat.w / 2;
      const py = rows[rowIdx].y - cameraY;
      floatText(px, py, "✗ Lava surge!", "bad");
      updateHud();
    }
  }

  function comboShout() {
    if (combo === 3) return "Nice streak!";
    if (combo === 5) return "Blazing!";
    if (combo === 8) return "On fire!";
    if (combo === 12) return "INFERNO!!";
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
      floatText(endX, rows[rowIdx].y - cameraY - 20, "+" + plat.num, "big");
      trailTimer = setInterval(spawnTrailDot, 45);
    }, 90);

    function anim(now) {
      const u = clamp((now - t0 - 90) / dur, 0, 1);
      if (u <= 0) {
        jumpRaf = requestAnimationFrame(anim);
        return;
      }
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const lift = Math.sin(Math.PI * u) * (80 + rowGap * 0.35);
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
      lavaY += 46; // reward: lava eases back a bit
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
    // keep the player ~62% down the screen: answer row above, lava below
    const targetCam = playerY + PLAYER_H - stageH * 0.62;
    if (instant) cameraY = targetCam;
    else cameraY += (targetCam - cameraY) * 0.12;
    world.style.transform = `translate3d(0, ${-cameraY}px, 0)`;

    // parallax mountains drift down as we climb
    const climbed = Math.max(0, camStart - cameraY);
    bgFar.style.transform = `translateY(${climbed * 0.05}px)`;
    bgMid.style.transform = `translateY(${climbed * 0.12}px)`;
  }

  function updateLavaDom() {
    const screenLavaTop = lavaY - cameraY;
    const visualTop = Math.min(screenLavaTop, stageH - 46);
    lavaEl.style.height = (stageH - visualTop + 30) + "px";
    dangerLine.style.top = (visualTop - 4) + "px";

    const gap = lavaY - (playerY + PLAYER_H);
    const heat = clamp(1 - gap / (stageH * 0.75), 0, 1);
    heatFill.style.height = Math.round(heat * 100) + "%";
    heatMeter.classList.toggle("hot", heat > 0.75);
    vignette.classList.toggle("on", playing && heat > 0.62);
    dangerLine.classList.toggle("hot", heat > 0.75);
    musicUrgent = playing && heat > 0.55;

    if (heat > 0.75) dangerLabel.textContent = "CRITICAL · FAIL LINE";
    else if (heat > 0.55) dangerLabel.textContent = "DANGER · FAIL LINE";
    else dangerLabel.textContent = "FAIL LINE";
  }

  // --------------------------------------------------------- game loop ----
  function tick(ts) {
    if (!playing) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    lavaY -= lavaSpeedPx() * dt * (jumping ? 0.85 : 1);

    if (!jumping && rows[step]) {
      // idle bob
      playerY = rows[step].y - PLAYER_H + 6 + Math.sin(ts / 280) * 1.5;
      placePlayer();
    }

    updateCamera(false);
    updateLavaDom();

    // fail check: feet at or below the lava surface
    if (playerY + PLAYER_H - 6 >= lavaY) {
      endByLava();
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

  function endByLava() {
    if (!playing) return;
    playing = false;
    jumping = false;
    stopLoops();
    setPose("crouch");
    shake(true);
    flash("bad");
    playLose();
    vignette.classList.remove("on");
    floatText(playerX, playerY - cameraY, "Burned!", "bad");
    setTimeout(() => finishGame(false), 650);
  }

  function winRound() {
    playing = false;
    stopLoops();
    setPose("celebrate");
    flash("win");
    playWin();
    vignette.classList.remove("on");
    // celebration spark storm
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
      <h2>${won ? "You outran the lava!" : "The lava got you!"}</h2>
      <p>${won
        ? `Skip-counted by ${skipBy}s all the way to ${skipBy * TARGET_MULT}.`
        : `Made it to ${current} counting by ${skipBy}s. Try again!`}</p>
      ${rankHtml}
      <div class="end-stats">
        <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
        <div class="end-stat"><span class="lbl">Jumps</span><span class="num">${step}/${TARGET_MULT}</span></div>
        <div class="end-stat"><span class="lbl">Rank</span><span class="num rank-${rank}">${rank}</span></div>
      </div>
      <button class="btn btn-primary" id="again-btn">Leap again</button>
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
          <span class="sub">up to ${n * TARGET_MULT}</span>
        </button>`);
    }

    overlayCard.innerHTML = `
      <h2>Pick a skip</h2>
      <p>Each number has its own rank. Higher rank = hotter, faster lava.</p>
      <div class="pick-grid">${buttons.join("")}</div>
      <div class="rank-legend">
        <span><span class="rank-badge rank-C">C</span> chill</span>
        <span><span class="rank-badge rank-B">B</span> brisk</span>
        <span><span class="rank-badge rank-A">A</span> blazing</span>
        <span><span class="rank-badge rank-S">S</span> inferno</span>
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
    current = 0;
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
    const prevGap = lavaY - (playerY + PLAYER_H);
    measure();
    if (!rows.length) return;

    rows.forEach((row, i) => {
      row.y = baseY - i * rowGap;
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
      lavaY = playerY + PLAYER_H + prevGap; // keep the same danger level
    }
    updateCamera(true);
    updateLavaDom();
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

  buildEmbers();
  buildBubbles();
  measure();

  document.getElementById("start-btn").addEventListener("click", async () => {
    playClick();
    await MathArcade.ensurePlayer();
    await loadRanks();
    showPicker();
  });
})();
