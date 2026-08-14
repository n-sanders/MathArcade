/* Galaxy Maze — space explorer multiplication maze */
(function () {
  const GAME_ID = "maze";
  const RANKS = ["C", "B", "A", "S"];
  const RANK_FLAVOR = { C: "scout", B: "navigator", A: "captain", S: "admiral" };
  const FACTOR_MAX = { C: 5, B: 8, A: 10, S: 12 };
  const DISTRACTORS = { C: 2, B: 2, A: 3, S: 3 };

  // ------------------------------------------------------------- DOM ----
  const stage = document.getElementById("stage");
  const starfieldEl = document.getElementById("starfield");
  const lanesSvg = document.getElementById("lanes");
  const nodesEl = document.getElementById("nodes");
  const fxEl = document.getElementById("fx-layer");
  const shipEl = document.getElementById("ship");
  const flashEl = document.getElementById("flash");
  const scoreEl = document.getElementById("score");
  const jumpEl = document.getElementById("jump");
  const rankLabel = document.getElementById("rank-label");
  const overlayExtra = document.getElementById("overlay-extra");
  const navLabel = document.getElementById("nav-label");
  const navProblem = document.getElementById("nav-problem");
  const navMsg = document.getElementById("nav-msg");
  const overlay = document.getElementById("overlay");
  const overlayCard = document.getElementById("overlay-card");
  const startBtn = document.getElementById("start-btn");

  // ----------------------------------------------------------- state ----
  let rank = "C";
  let score = 0;
  let stepIndex = 0;       // how many jumps completed
  let totalJumps = 0;      // length of solution walk
  let nodes = [];          // { name, x, y, size, color, sol }
  let adj = [];            // Array<Set<number>>
  let edges = [];          // [a, b] pairs
  let laneEls = new Map(); // "a-b" -> <line>
  let nodeEls = [];        // star node divs
  let walk = [];           // node indices, walk[0] = Sol
  let problems = [];       // { a, b, correct } per jump
  let scanned = new Set(); // node indices already scanned
  let state = "idle";      // idle | choosing | flying | scanning | over

  const SOL = 0;
  const NODE_COUNT = 16;
  const ASPECT = 1.55; // horizontal stretch factor for distance calc

  const STAR_NAMES = [
    "Proxima", "Alpha Centauri", "Sirius", "Vega", "Tau Ceti", "Barnard",
    "Wolf 359", "Eps Eridani", "TRAPPIST-1", "Kepler-442", "Altair",
    "Ross 128", "Gliese 581", "Luyten", "Lalande", "Procyon", "Fomalhaut",
    "Arcturus", "Pollux", "Capella"
  ];
  const STAR_COLORS = ["#ffffff", "#bfd8ff", "#ffd166", "#ffb37a", "#ff7b6b", "#c4b5fd", "#9bd8ff"];

  // ----------------------------------------------------------- utils ----
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function edgeKey(a, b) {
    return a < b ? a + "-" + b : b + "-" + a;
  }

  function nodeDist(i, j) {
    const dx = (nodes[i].x - nodes[j].x) * ASPECT;
    const dy = nodes[i].y - nodes[j].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function nextRank(r) {
    const i = RANKS.indexOf(r);
    return RANKS[Math.min(RANKS.length - 1, i + 1)];
  }

  function rankLevel() {
    return RANKS.indexOf(rank) + 1;
  }

  function rankFromProgress(progress) {
    let stats = {};
    if (progress && progress.statsJson) {
      try { stats = JSON.parse(progress.statsJson); } catch (_) { stats = {}; }
    }
    return RANKS.includes(stats.rank) ? stats.rank : "C";
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

  function paintStartOverlay() {
    if (!overlayExtra) return;
    overlayExtra.innerHTML = `
      <p class="sub">Current rank <span class="rank-badge rank-${rank}">${rank}</span></p>
      ${rankLegendHtml()}`;
  }

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // =================================================================
  // AUDIO — procedural Web Audio soundtrack + SFX
  // =================================================================
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  const BPM = 104;
  const STEP_DUR = 60 / BPM / 4; // 16th note
  // 4-bar loop: Am — F — C — G  (space adventure vibes)
  const BASS_NOTES = [45, 41, 48, 43]; // A2 F2 C3 G2
  const CHORDS = [
    [57, 60, 64, 69], // A C E A
    [53, 57, 60, 65], // F A C F
    [52, 55, 60, 64], // E G C E
    [55, 59, 62, 67]  // G B D G
  ];
  const ARP_PATTERN = [0, 1, 2, 3, 2, 3, 1, 2];

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
      musicGain = audio.createGain();
      musicGain.gain.value = 0.75;
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

  function scheduleMusicStep(step, t) {
    const bar = Math.floor(step / 16) % 4;
    const pos = step % 16;
    const chordTones = CHORDS[bar];

    // Bass pulse on quarter notes
    if (pos % 4 === 0) {
      const octaveUp = pos === 12 && Math.random() < 0.5;
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(BASS_NOTES[bar] + (octaveUp ? 12 : 0)),
        t, dur: 0.3, gain: 0.32, attack: 0.012, filter: 420
      });
    }

    // Sparkling arpeggio on 8th notes, with a soft echo
    if (pos % 2 === 0) {
      const idx = ARP_PATTERN[(pos / 2) % ARP_PATTERN.length];
      const midi = chordTones[idx] + 12;
      tone(musicGain, { type: "sine", freq: midiToFreq(midi), t, dur: 0.22, gain: 0.085, attack: 0.008 });
      tone(musicGain, { type: "sine", freq: midiToFreq(midi), t: t + STEP_DUR * 3, dur: 0.2, gain: 0.032, attack: 0.008 });
    }

    // Soft pad swell at each bar
    if (pos === 0) {
      const barLen = STEP_DUR * 16;
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(chordTones[0]),
        t, dur: barLen, gain: 0.035, attack: 0.5, filter: 650
      });
      tone(musicGain, {
        type: "sawtooth", freq: midiToFreq(chordTones[2]) * 1.003,
        t, dur: barLen, gain: 0.03, attack: 0.55, filter: 650
      });
    }

    // Ticking hi-hat on offbeats for momentum
    if (pos % 4 === 2) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.05);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 6500;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t);
    }
  }

  function musicScheduler() {
    if (!audio) return;
    while (nextNoteTime < audio.currentTime + 0.28) {
      scheduleMusicStep(musicStep, nextNoteTime);
      nextNoteTime += STEP_DUR;
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!ensureAudio() || musicTimer) return;
    musicStep = 0;
    nextNoteTime = audio.currentTime + 0.06;
    musicTimer = setInterval(musicScheduler, 90);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  // --- SFX ---------------------------------------------------------------
  function playRocket() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    // Whooshing exhaust: noise through a rising-then-falling lowpass
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(1.2);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(350, t);
    f.frequency.exponentialRampToValueAtTime(3800, t + 0.45);
    f.frequency.exponentialRampToValueAtTime(420, t + 1.15);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
    // Engine rumble dropping in pitch
    tone(sfxGain, { type: "sine", freq: 140, freqEnd: 34, t, dur: 0.95, gain: 0.45, attack: 0.04 });
    tone(sfxGain, { type: "sawtooth", freq: 90, freqEnd: 28, t, dur: 0.8, gain: 0.12, attack: 0.04, filter: 300 });
  }

  function playPop() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sine", freq: 520, freqEnd: 1040, t, dur: 0.14, gain: 0.3 });
    tone(sfxGain, { type: "triangle", freq: 1560, t: t + 0.06, dur: 0.12, gain: 0.15 });
  }

  function playWrong() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "square", freq: 165, freqEnd: 110, t, dur: 0.22, gain: 0.18, filter: 900 });
    tone(sfxGain, { type: "square", freq: 145, freqEnd: 95, t: t + 0.16, dur: 0.26, gain: 0.16, filter: 800 });
  }

  function playScan() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    // Rising sweep then sonar pings with fading echoes
    tone(sfxGain, { type: "triangle", freq: 280, freqEnd: 1250, t, dur: 0.5, gain: 0.09 });
    for (let i = 0; i < 3; i++) {
      tone(sfxGain, { type: "sine", freq: 990, t: t + 0.35 + i * 0.34, dur: 0.28, gain: 0.16 * Math.pow(0.55, i) });
    }
  }

  function playFanfare() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    const notes = [64, 67, 71, 76]; // E G B E — triumphant climb
    notes.forEach((n, i) => {
      tone(sfxGain, { type: "triangle", freq: midiToFreq(n), t: t + i * 0.17, dur: 0.4, gain: 0.24 });
      tone(sfxGain, { type: "sine", freq: midiToFreq(n + 12), t: t + i * 0.17, dur: 0.35, gain: 0.1 });
    });
    // Final shining chord
    [76, 79, 83, 88].forEach((n) => {
      tone(sfxGain, { type: "triangle", freq: midiToFreq(n), t: t + 0.75, dur: 1.4, gain: 0.13, attack: 0.05 });
    });
    tone(sfxGain, { type: "sine", freq: midiToFreq(40), t: t + 0.75, dur: 1.3, gain: 0.25, attack: 0.05 });
  }

  function playRankUp() {
    if (!ensureAudio() || !sfxGain) return;
    const t = audio.currentTime;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.09, dur: 0.28, gain: 0.2 });
    });
  }

  // =================================================================
  // STARFIELD BACKDROP
  // =================================================================
  function initStarfield() {
    starfieldEl.innerHTML = "";
    for (let i = 0; i < 130; i++) {
      const s = document.createElement("div");
      s.className = "bg-star";
      const size = 0.8 + Math.random() * 1.8;
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      s.style.animationDuration = 2 + Math.random() * 4 + "s";
      s.style.animationDelay = -Math.random() * 5 + "s";
      starfieldEl.appendChild(s);
    }
  }

  // =================================================================
  // MAP GENERATION — star network with Sol in the middle
  // =================================================================
  function generateMap() {
    nodes = [{ name: "Sol", x: 0.5, y: 0.46, size: 1.35, color: "#ffd166", sol: true }];
    const names = shuffle(STAR_NAMES.slice());
    let threshold = 0.21;
    let attempts = 0;
    while (nodes.length < NODE_COUNT && attempts < 6000) {
      attempts += 1;
      if (attempts % 600 === 0) threshold *= 0.93;
      const cand = { x: 0.06 + Math.random() * 0.88, y: 0.1 + Math.random() * 0.72 };
      let ok = true;
      for (const n of nodes) {
        const dx = (n.x - cand.x) * ASPECT;
        const dy = n.y - cand.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) { ok = false; break; }
      }
      if (!ok) continue;
      nodes.push({
        name: names[nodes.length - 1],
        x: cand.x,
        y: cand.y,
        size: 0.75 + Math.random() * 0.5,
        color: choice(STAR_COLORS),
        sol: false
      });
    }
    buildEdges();
    ensureConnected();
  }

  function buildEdges() {
    edges = [];
    adj = nodes.map(() => new Set());
    const have = new Set();

    function connect(a, b) {
      if (a === b) return false;
      const k = edgeKey(a, b);
      if (have.has(k)) return false;
      have.add(k);
      edges.push([a, b]);
      adj[a].add(b);
      adj[b].add(a);
      return true;
    }

    // Neighbor lists sorted by distance
    const order = nodes.map((_, i) =>
      nodes.map((_, j) => j)
        .filter((j) => j !== i)
        .sort((p, q) => nodeDist(i, p) - nodeDist(i, q))
    );

    // Pass 1: everyone links to their 2 nearest stars
    for (let i = 0; i < nodes.length; i++) {
      for (const j of order[i].slice(0, 2)) connect(i, j);
    }

    // Pass 2: raise every node to at least 3 exits, preferring targets under 4
    for (let i = 0; i < nodes.length; i++) {
      for (const j of order[i]) {
        if (adj[i].size >= 3) break;
        if (adj[j].size < 4) connect(i, j);
      }
      // Last resort: nearest stars regardless of their degree
      let k = 0;
      while (adj[i].size < 3 && k < order[i].length) connect(i, order[i][k++]);
    }
  }

  function ensureConnected() {
    for (;;) {
      const seen = new Set([SOL]);
      const queue = [SOL];
      while (queue.length) {
        const cur = queue.pop();
        for (const nb of adj[cur]) {
          if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
        }
      }
      if (seen.size === nodes.length) return;
      // Bridge the closest pair between the connected part and the rest
      let best = null;
      for (let i = 0; i < nodes.length; i++) {
        if (!seen.has(i)) continue;
        for (let j = 0; j < nodes.length; j++) {
          if (seen.has(j)) continue;
          const d = nodeDist(i, j);
          if (!best || d < best.d) best = { a: i, b: j, d };
        }
      }
      edges.push([best.a, best.b]);
      adj[best.a].add(best.b);
      adj[best.b].add(best.a);
    }
  }

  // Random walk from Sol, 10-15 jumps, loops allowed; the final star must be
  // one we have not scanned earlier in the walk (and not Sol itself).
  function buildWalk() {
    let fallback = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const len = randInt(10, 15);
      const w = [SOL];
      let prev = -1;
      for (let s = 0; s < len; s++) {
        const cur = w[w.length - 1];
        let opts = [...adj[cur]].filter((n) => n !== prev);
        if (!opts.length) opts = [...adj[cur]];
        const unvisited = opts.filter((n) => !w.includes(n));
        let next;
        if (s === len - 1 && unvisited.length) {
          next = choice(unvisited);
        } else if (unvisited.length && Math.random() < 0.65) {
          next = choice(unvisited);
        } else {
          next = choice(opts);
        }
        prev = cur;
        w.push(next);
      }
      const end = w[w.length - 1];
      if (end !== SOL) {
        fallback = w;
        if (w.indexOf(end) === w.length - 1) return w; // end star is brand new
      }
    }
    return fallback;
  }

  function factorMax() {
    return FACTOR_MAX[rank] || 5;
  }

  function buildProblems() {
    problems = [];
    const maxF = factorMax();
    for (let i = 0; i < totalJumps; i++) {
      const a = randInt(2, maxF);
      const b = randInt(2, maxF);
      problems.push({ a, b, correct: a * b });
    }
  }

  function makeDistractors(a, b, count) {
    const correct = a * b;
    const pool = shuffle([
      (a + 1) * b, a * (b + 1), (a - 1) * b, a * (b - 1),
      correct + a, correct - b, correct + b, correct - a,
      correct + randInt(2, 9), correct - randInt(2, 9)
    ]);
    const out = [];
    const used = new Set([correct]);
    for (const v of pool) {
      if (out.length >= count) break;
      if (v > 0 && !used.has(v)) { used.add(v); out.push(v); }
    }
    while (out.length < count) {
      const v = correct + randInt(-15, 15);
      if (v > 0 && !used.has(v)) { used.add(v); out.push(v); }
    }
    return out;
  }

  // =================================================================
  // RENDERING
  // =================================================================
  function renderMap() {
    // Lanes
    lanesSvg.innerHTML = "";
    laneEls.clear();
    for (const [a, b] of edges) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", nodes[a].x * 100 + "%");
      line.setAttribute("y1", nodes[a].y * 100 + "%");
      line.setAttribute("x2", nodes[b].x * 100 + "%");
      line.setAttribute("y2", nodes[b].y * 100 + "%");
      line.setAttribute("class", "lane");
      lanesSvg.appendChild(line);
      laneEls.set(edgeKey(a, b), line);
    }
    // Star nodes
    nodesEl.innerHTML = "";
    nodeEls = [];
    nodes.forEach((n, i) => {
      const el = document.createElement("div");
      el.className = "star-node";
      el.style.left = n.x * 100 + "%";
      el.style.top = n.y * 100 + "%";
      el.style.setProperty("--clr", n.color);
      el.style.setProperty("--size", Math.round(13 * n.size) + "px");
      el.innerHTML = `
        <div class="ring"></div>
        <div class="core"></div>
        <div class="star-name">${n.sol ? "☉ Sol" : n.name}</div>`;
      el.addEventListener("click", () => onNodeClick(i));
      nodesEl.appendChild(el);
      nodeEls.push(el);
    });
  }

  function clearChoiceUi() {
    nodeEls.forEach((el) => {
      el.classList.remove("selectable", "current");
      const chip = el.querySelector(".answer-chip");
      if (chip) chip.remove();
    });
  }

  function placeShipAt(i) {
    shipEl.classList.remove("hidden");
    shipEl.style.left = nodes[i].x * 100 + "%";
    shipEl.style.top = nodes[i].y * 100 + "%";
  }

  function updateHud() {
    scoreEl.textContent = score;
    jumpEl.textContent = totalJumps ? `${stepIndex}/${totalJumps}` : "–";
    if (rankLabel) {
      rankLabel.textContent = rank;
      rankLabel.className = "val rank-" + rank;
    }
  }

  function setMsg(text, cls) {
    navMsg.textContent = text;
    navMsg.className = "nav-msg" + (cls ? " " + cls : "");
  }

  // =================================================================
  // JUICE
  // =================================================================
  function shake(big) {
    const cls = big ? "shake-big" : "shake";
    stage.classList.remove("shake", "shake-big");
    void stage.offsetWidth; // restart animation
    stage.classList.add(cls);
    setTimeout(() => stage.classList.remove(cls), big ? 850 : 500);
  }

  function flash(good) {
    flashEl.classList.toggle("good", !!good);
    flashEl.classList.add("show");
    setTimeout(() => flashEl.classList.remove("show"), 120);
  }

  function burstParticles(x, y, colors, count) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = x * 100 + "%";
      p.style.top = y * 100 + "%";
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 70;
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      p.style.setProperty("--clr", choice(colors));
      fxEl.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  }

  function scorePop(x, y, text) {
    const el = document.createElement("div");
    el.className = "score-pop";
    el.textContent = text;
    el.style.left = x * 100 + "%";
    el.style.top = (y * 100 - 3) + "%";
    fxEl.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function trailDot(xPct, yPct) {
    const d = document.createElement("div");
    d.className = "trail-dot";
    d.style.left = xPct + "%";
    d.style.top = yPct + "%";
    fxEl.appendChild(d);
    d.addEventListener("animationend", () => d.remove());
  }

  function spawnScanRings(x, y) {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const r = document.createElement("div");
        r.className = "scan-ring";
        r.style.left = x * 100 + "%";
        r.style.top = y * 100 + "%";
        fxEl.appendChild(r);
        r.addEventListener("animationend", () => r.remove());
      }, i * 380);
    }
  }

  // =================================================================
  // GAMEPLAY
  // =================================================================
  function presentProblem() {
    const cur = walk[stepIndex];
    const next = walk[stepIndex + 1];
    const prob = problems[stepIndex];

    clearChoiceUi();
    nodeEls[cur].classList.add("current");

    const neighbors = [...adj[cur]];
    const others = shuffle(neighbors.filter((n) => n !== next));
    const maxD = Math.min(DISTRACTORS[rank] || 2, others.length);
    const shown = [next, ...others.slice(0, maxD)];
    const distractors = makeDistractors(prob.a, prob.b, maxD);
    let d = 0;
    shuffle(shown).forEach((nb, i) => {
      const value = nb === next ? prob.correct : distractors[d++];
      const el = nodeEls[nb];
      el.classList.add("selectable");
      el.dataset.answer = value;
      const chip = document.createElement("div");
      chip.className = "answer-chip" + (nodes[nb].y < 0.16 ? " below" : "");
      chip.textContent = value;
      chip.style.animationDelay = i * 0.07 + "s";
      el.appendChild(chip);
    });

    navLabel.textContent = `Jump ${stepIndex + 1} of ${totalJumps} · destination lock required`;
    navProblem.textContent = `${prob.a} × ${prob.b} = ?`;
    navProblem.classList.remove("zoom");
    void navProblem.offsetWidth;
    navProblem.classList.add("zoom");
    setMsg("Pick the star showing the correct product!", "info");
    state = "choosing";
  }

  function onNodeClick(i) {
    if (state !== "choosing") return;
    const cur = walk[stepIndex];
    if (!adj[cur].has(i)) return;
    if (!nodeEls[i] || !nodeEls[i].classList.contains("selectable")) return;
    if (i === walk[stepIndex + 1]) {
      correctPick(i);
    } else {
      wrongPick(i);
    }
  }

  function correctPick(dest) {
    state = "flying";
    const cur = walk[stepIndex];
    const pts = 15 + rankLevel() * 8;
    score += pts;
    updateHud();

    playPop();
    playRocket();
    flash(true);
    shake(false);

    const el = nodeEls[dest];
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    burstParticles(nodes[dest].x, nodes[dest].y, ["#22d3ee", "#4ade80", "#ffd166", "#ffffff"], 16);
    scorePop(nodes[dest].x, nodes[dest].y, "+" + pts);

    // Light up the traveled lane
    const lane = laneEls.get(edgeKey(cur, dest));
    if (lane) lane.classList.add("visited");

    clearChoiceUi();
    navLabel.textContent = "Hyperspace jump in progress";
    navProblem.textContent = "🚀 JUMPING…";
    setMsg(`Course locked: ${nodes[dest].name}!`, "good");

    flyShip(cur, dest, () => arrive(dest));
  }

  function wrongPick(i) {
    score = Math.max(0, score - 5);
    updateHud();
    playWrong();
    flash(false);
    shake(false);
    const chip = nodeEls[i].querySelector(".answer-chip");
    if (chip) {
      chip.classList.remove("chip-bad");
      void chip.offsetWidth;
      chip.classList.add("chip-bad");
    }
    setMsg(`Course rejected — ${nodeEls[i].dataset.answer} is not the product. Try again!`, "bad");
  }

  function flyShip(from, to, done) {
    const x0 = nodes[from].x, y0 = nodes[from].y;
    const x1 = nodes[to].x, y1 = nodes[to].y;
    const angle = Math.atan2((y1 - y0), (x1 - x0) * ASPECT) * 180 / Math.PI;
    shipEl.style.setProperty("--rot", (angle + 45) + "deg");
    shipEl.classList.remove("idle-bob");

    const dur = 550 + nodeDist(from, to) * 2600;
    const start = performance.now();
    let lastTrail = 0;

    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
      const px = (x0 + (x1 - x0) * e) * 100;
      const py = (y0 + (y1 - y0) * e) * 100;
      shipEl.style.left = px + "%";
      shipEl.style.top = py + "%";
      if (now - lastTrail > 26) {
        trailDot(px, py);
        lastTrail = now;
      }
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        shipEl.style.setProperty("--rot", "0deg");
        shipEl.classList.add("idle-bob");
        done();
      }
    }
    requestAnimationFrame(frame);
  }

  function arrive(dest) {
    stepIndex += 1;
    updateHud();
    state = "scanning";
    const star = nodes[dest];
    navLabel.textContent = `Orbit established · ${star.name}`;
    navProblem.textContent = "📡 SCANNING FOR LIFE…";
    setMsg("Bio-scanner sweeping the system…", "info");
    playScan();
    spawnScanRings(star.x, star.y);

    setTimeout(() => {
      if (stepIndex >= totalJumps) {
        victory(dest);
        return;
      }
      if (scanned.has(dest)) {
        setMsg(`${star.name} again — already scanned! The signal moved on…`, "info");
      } else {
        scanned.add(dest);
        setMsg(`No life signs at ${star.name}. The trail continues…`, "info");
      }
      presentProblem();
    }, 1500);
  }

  async function victory(dest) {
    state = "over";
    const star = nodes[dest];
    const bonus = 50 + rankLevel() * 12;
    score += bonus;
    stopMusic();
    playFanfare();
    shake(true);
    flash(true);

    const el = nodeEls[dest];
    el.querySelector(".core").textContent = "🪐";
    el.classList.add("discovered");
    burstParticles(star.x, star.y, ["#4ade80", "#22d3ee", "#ffd166", "#a855f7", "#ffffff"], 46);
    scorePop(star.x, star.y, "+" + bonus + " LIFE FOUND!");

    navLabel.textContent = `Orbit established · ${star.name}`;
    navProblem.textContent = "🌱 LIFE DETECTED!";
    setMsg("Incredible — the signal was real!", "good");
    updateHud();

    const oldRank = rank;
    const nr = nextRank(rank);
    const rankedUp = nr !== rank;
    if (rankedUp) {
      rank = nr;
      playRankUp();
    }
    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, rankLevel(), {
        rank,
        lastWon: true,
        jumps: totalJumps
      });
    } catch (err) {
      console.error(err);
    }

    setTimeout(() => {
      overlayCard.innerHTML = `
        <span class="big-emoji">🪐</span>
        <h2>${rankedUp ? "Rank Up!" : "Life discovered!"}</h2>
        <p>Your scanners found a living world orbiting <strong>${star.name}</strong> —
           welcome to planet <strong>${star.name} b</strong>! 🌱👽</p>
        ${rankedUp ? `<div class="rank-up-banner">RANK UP! ${oldRank} → ${rank}</div>` : ""}
        <div class="end-stats">
          <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
          <div class="end-stat"><span class="lbl">Jumps</span><span class="num">${totalJumps}</span></div>
          <div class="end-stat"><span class="lbl">Rank</span><span class="num rank-${rank}">${rank}</span></div>
        </div>
        ${rankLegendHtml()}
        <button class="btn-primary" id="again-btn">🚀 New mission</button>`;
      overlay.classList.remove("hidden");
      document.getElementById("again-btn").addEventListener("click", startGame);
    }, 2200);
  }

  async function startGame() {
    startBtn && (startBtn.disabled = true);
    ensureAudio();
    try {
      await MathArcade.ensurePlayer();
      const progress = await MathArcade.loadProgress(GAME_ID);
      rank = rankFromProgress(progress);
    } catch (err) {
      console.error(err);
      rank = rank || "C";
    }

    score = 0;
    stepIndex = 0;
    scanned = new Set([SOL]);

    generateMap();
    walk = buildWalk();
    totalJumps = walk.length - 1;
    buildProblems();
    renderMap();
    placeShipAt(SOL);
    shipEl.classList.add("idle-bob");
    updateHud();

    overlay.classList.add("hidden");
    startMusic();
    setMsg(`Departing Sol — the signal is ${totalJumps} jumps out…`, "info");
    presentProblem();
  }

  initStarfield();
  startBtn.addEventListener("click", startGame);
  (async () => {
    try {
      await MathArcade.ensurePlayer();
      rank = rankFromProgress(await MathArcade.loadProgress(GAME_ID));
    } catch (_) { /* start at C */ }
    updateHud();
    paintStartOverlay();
  })();
})();
