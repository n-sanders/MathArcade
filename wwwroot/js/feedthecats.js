/* Feed the Cats — doubles subtraction. Play a half-value card into a cat's blank.
 * C/B: every problem is a real double. A/S add odd-number distractors.
 * Three rounds of 12 reals rank up. S has a 120s timer; failing drops to A.
 */
(function () {
  "use strict";

  const GAME_ID = "feedthecats";
  const BEST_KEY = "matharcade_feedthecats_best";

  const RANKS = ["C", "B", "A", "S"];
  const ROUNDS_PER_RUN = 3;
  const REALS_PER_ROUND = 12;
  const HAND_SIZE = 3;
  const STATION_COUNT = 3;
  const S_ROUND_SECONDS = 120;
  const POINTS_PER_REAL = 10;
  const CELEBRATE_MS = 700;
  const DRAG_THRESHOLD = 12;

  const PALETTES = ["calico", "ginger-tabby", "tuxedo", "gray-tabby", "siamese", "fantasy"];
  const REAL_TOPS = {
    C: [2, 4, 6, 8, 10],
    B: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    A: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    S: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
  };
  const DISTRACTOR_TOPS = [3, 5, 7, 9, 11, 13, 15, 17, 19];
  const RANK_FLAVOR = {
    C: "doubles 1–5",
    B: "doubles 1–10",
    A: "plus odd decoys",
    S: "timed decoys"
  };

  const BURST_COLORS = ["#f2c84b", "#e78438", "#72c4d3", "#fff7ea", "#f0809c", "#84d7cc"];

  const stage = document.getElementById("stage");
  const handEl = document.getElementById("hand");
  const stationsRoot = document.getElementById("stations");
  const effectsEl = document.getElementById("effects");
  const overlay = document.getElementById("overlay");
  const overlayTitle = overlay.querySelector("h2");
  const overlayText = document.getElementById("overlay-text");
  const overlayExtra = document.getElementById("overlay-extra");
  const startBtn = document.getElementById("start-btn");
  const endBtn = document.getElementById("end-btn");
  const scoreEl = document.getElementById("score");
  const rankLabel = document.getElementById("rank-label");
  const roundEl = document.getElementById("round");
  const fedEl = document.getElementById("fed");
  const timerEl = document.getElementById("timer");
  const timerChip = document.getElementById("timer-chip");
  const bestEl = document.getElementById("best");
  const catTemplate = document.getElementById("cat-template");
  const dragGhost = document.getElementById("drag-ghost");

  let mode = "idle"; // idle | playing | resolving | intermission | over
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let rank = "C";
  let roundIndex = 0;
  let solved = 0;
  let timedOut = false;
  let nextProblemId = 1;

  let remaining = [];
  let deck = [];
  let hand = [];
  let stations = [];
  let selectedCardId = null;
  let drag = null;
  let roundTasks = [];

  let roundSeconds = 0;
  let timeLeft = 0;
  let timerStart = 0;
  let timerRaf = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextRank(r) {
    const i = RANKS.indexOf(r);
    return RANKS[Math.min(RANKS.length - 1, i + 1)];
  }

  function parseRank(stats) {
    if (!stats || typeof stats !== "object") return "C";
    return RANKS.includes(stats.rank) ? stats.rank : "C";
  }

  function hasDistractors() {
    return rank === "A" || rank === "S";
  }

  function queueTask(fn, ms) {
    roundTasks.push(window.setTimeout(fn, ms));
  }

  function clearTasks() {
    roundTasks.forEach((id) => window.clearTimeout(id));
    roundTasks = [];
  }

  // ---------------------------------------------------------------- audio ---
  let audio = null;
  let sfxGain = null;

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
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
    const peak = opts.gain || 0.12;
    const attack = opts.attack || 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (opts.filter) {
      const f = audio.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.filter;
      osc.connect(f).connect(g).connect(dest);
    } else {
      osc.connect(g).connect(dest);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playPickup() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    tone(sfxGain, { type: "sine", freq: 520, freqEnd: 680, t: ac.currentTime, dur: 0.08, gain: 0.09, attack: 0.005 });
  }

  function playCorrect() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    tone(sfxGain, { type: "triangle", freq: 660, t: t0, dur: 0.14, gain: 0.16, attack: 0.005, filter: 3200 });
    tone(sfxGain, { type: "triangle", freq: 880, t: t0 + 0.07, dur: 0.22, gain: 0.16, attack: 0.005, filter: 3600 });
    tone(sfxGain, { type: "sine", freq: 150, freqEnd: 60, t: t0, dur: 0.13, gain: 0.16, attack: 0.004 });
  }

  function playWrong() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    tone(sfxGain, { type: "triangle", freq: 240, freqEnd: 62, t: t0, dur: 0.34, gain: 0.15, attack: 0.005 });
  }

  function playFanfare() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(sfxGain, { type: "triangle", freq, t: t0 + i * 0.09, dur: 0.3, gain: 0.14, attack: 0.006, filter: 3400 });
    });
  }

  function playVictory() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5].forEach((freq, i) => {
      tone(sfxGain, { type: "triangle", freq, t: t0 + i * 0.13, dur: 0.34, gain: 0.15, attack: 0.006, filter: 3600 });
    });
  }

  function playRankUp() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    const t0 = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      tone(sfxGain, { type: "triangle", freq, t: t0 + i * 0.11, dur: 0.4, gain: 0.16, attack: 0.006, filter: 3800 });
    });
  }

  function playTimeout() {
    const ac = ensureAudio();
    if (!ac || !sfxGain) return;
    tone(sfxGain, { type: "sawtooth", freq: 180, freqEnd: 70, t: ac.currentTime, dur: 0.55, gain: 0.12, attack: 0.01, filter: 900 });
  }

  // ----------------------------------------------------------- generation --
  function makeRealProblems(letter, count) {
    const tops = REAL_TOPS[letter] || REAL_TOPS.C;
    const problems = [];
    const bag = shuffle(tops.slice());
    while (problems.length < count) {
      const top = bag.length ? bag.pop() : tops[randInt(0, tops.length - 1)];
      problems.push({ id: nextProblemId++, top, half: top / 2 });
    }
    return shuffle(problems);
  }

  function makeDeck(problems) {
    return shuffle(problems.map((p) => p.half));
  }

  function dealHand() {
    hand = [];
    while (hand.length < HAND_SIZE && deck.length) {
      hand.push({ id: "c" + nextProblemId++, value: deck.shift() });
    }
  }

  function drawCardReplacing(cardId) {
    hand = hand.filter((c) => c.id !== cardId);
    if (deck.length) hand.push({ id: "c" + nextProblemId++, value: deck.shift() });
  }

  function handValues() {
    return hand.map((c) => c.value);
  }

  function pickPalette(avoid) {
    const free = PALETTES.filter((p) => !avoid.includes(p));
    const pool = free.length ? free : PALETTES;
    return pool[randInt(0, pool.length - 1)];
  }

  function cloneCatSvg(suffix) {
    const source = catTemplate.content.querySelector("svg.recolorable-cat");
    const svg = source.cloneNode(true);
    const prefix = "recolorable-cat-";
    svg.querySelectorAll("[id]").forEach((el) => {
      if (el.id.indexOf(prefix) === 0) el.id = el.id + "-" + suffix;
    });
    svg.querySelectorAll("[href]").forEach((el) => {
      const href = el.getAttribute("href");
      if (href && href.indexOf("#" + prefix) === 0) {
        el.setAttribute("href", href + "-" + suffix);
      }
    });
    svg.querySelectorAll("[clip-path]").forEach((el) => {
      const clip = el.getAttribute("clip-path");
      if (!clip) return;
      el.setAttribute("clip-path", clip.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}-${suffix})`));
    });
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }

  function pickReals(count, pool, values, keptReals) {
    const picked = [];
    const available = pool.slice();
    const boardWillHave = keptReals.slice();
    const alreadyMatch = boardWillHave.some((p) => values.includes(p.half));
    const canMatch = available.some((p) => values.includes(p.half));
    if (!alreadyMatch && canMatch && count > 0) {
      const idx = available.findIndex((p) => values.includes(p.half));
      picked.push(available.splice(idx, 1)[0]);
    }
    shuffle(available);
    while (picked.length < count && available.length) {
      picked.push(available.shift());
    }
    return picked;
  }

  function pickDistractorTop() {
    const used = stations
      .filter((s) => s && s.kind !== "idle" && s.top != null)
      .map((s) => s.top);
    const pool = DISTRACTOR_TOPS.filter((n) => !used.includes(n));
    const pickFrom = pool.length ? pool : DISTRACTOR_TOPS;
    return pickFrom[randInt(0, pickFrom.length - 1)];
  }

  function offBoardRemaining(excludeSlotIndexes) {
    const skip = new Set(excludeSlotIndexes || []);
    const onBoardIds = new Set(
      stations
        .filter((s, i) => s && s.kind === "real" && s.problem && !skip.has(i))
        .map((s) => s.problem.id)
    );
    return remaining.filter((p) => !onBoardIds.has(p.id));
  }

  function layoutSpec(keptReals, offBoardCount) {
    const totalUnsolved = keptReals.length + offBoardCount;
    if (!hasDistractors()) {
      const reals = Math.min(STATION_COUNT, totalUnsolved);
      return { reals, distractors: 0, idle: STATION_COUNT - reals };
    }
    if (totalUnsolved >= 2) return { reals: 2, distractors: 1, idle: 0 };
    if (totalUnsolved === 1) return { reals: 1, distractors: 1, idle: 1 };
    return { reals: 0, distractors: 0, idle: STATION_COUNT };
  }

  function fillSlots(indexes) {
    const kept = stations
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => s && !indexes.includes(i));
    const keptReals = kept.filter(({ s }) => s.kind === "real").map(({ s }) => s.problem);
    const pool = offBoardRemaining(indexes);
    const spec = layoutSpec(keptReals, pool.length);
    const realsNeeded = Math.max(0, spec.reals - keptReals.length);
    const hasKeptDistractor = kept.some(({ s }) => s.kind === "distractor");
    const distractorsNeeded = hasKeptDistractor ? 0 : spec.distractors;
    const chosenReals = pickReals(realsNeeded, pool, handValues(), keptReals);

    const jobs = [];
    chosenReals.forEach((problem) => jobs.push({ kind: "real", problem }));
    for (let i = 0; i < distractorsNeeded; i++) jobs.push({ kind: "distractor" });
    while (jobs.length < indexes.length) jobs.push({ kind: "idle" });
    shuffle(jobs);

    const avoid = stations
      .filter((s, i) => s && s.palette && !indexes.includes(i))
      .map((s) => s.palette);
    indexes.forEach((slotIndex, n) => {
      const job = jobs[n] || { kind: "idle" };
      const palette = pickPalette(avoid);
      avoid.push(palette);
      applyStation(slotIndex, job, palette);
    });
  }

  function applyStation(index, job, palette) {
    const station = stations[index];
    station.kind = job.kind;
    station.problem = job.problem || null;
    station.top = job.kind === "real" ? job.problem.top : job.kind === "distractor" ? pickDistractorTop() : null;
    station.palette = palette;
    station.el.classList.toggle("idle", job.kind === "idle");
    station.el.classList.toggle("distractor", job.kind === "distractor");
    station.el.classList.remove("solved", "shake", "hot");
    station.svg.setAttribute("data-palette", palette);
    station.svg.setAttribute("data-expression", "neutral");
    renderFact(station);
  }

  function renderFact(station) {
    const { factEl, kind, top } = station;
    if (kind === "idle") {
      factEl.hidden = true;
      return;
    }
    factEl.hidden = false;
    factEl.classList.remove("complete");
    factEl.querySelector(".fact-top").textContent = String(top);
    const blank = factEl.querySelector(".fact-blank");
    blank.textContent = "";
    blank.dataset.filled = "0";
    factEl.querySelector(".fact-diff").textContent = "";
    factEl.querySelector(".fact-diff").hidden = true;
  }

  function completeFact(station, value) {
    const factEl = station.factEl;
    factEl.classList.add("complete");
    const blank = factEl.querySelector(".fact-blank");
    blank.textContent = String(value);
    blank.dataset.filled = "1";
    const diff = factEl.querySelector(".fact-diff");
    diff.textContent = String(station.top - value);
    diff.hidden = false;
    station.svg.setAttribute("data-expression", "happy");
  }

  // ---------------------------------------------------------------- HUD ----
  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
    fedEl.textContent = solved + "/" + REALS_PER_ROUND;
    roundEl.textContent = mode === "idle" ? "–" : (roundIndex + 1) + "/" + ROUNDS_PER_RUN;
    rankLabel.textContent = rank;
    rankLabel.className = "val rank-" + rank;
    const timed = rank === "S" && (mode === "playing" || mode === "resolving");
    timerChip.hidden = rank !== "S";
    timerEl.textContent = rank === "S" ? formatTime(timeLeft || (timed ? timeLeft : S_ROUND_SECONDS)) : "–";
    timerChip.classList.toggle("timer-warn", timed && timeLeft <= 30 && timeLeft > 10);
    timerChip.classList.toggle("timer-critical", timed && timeLeft <= 10);
  }

  function syncBest() {
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  // -------------------------------------------------------------- timer ----
  function stopTimer() {
    if (timerRaf) {
      cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }
    timerChip.classList.remove("timer-warn", "timer-critical");
  }

  function tickTimer(now) {
    if (rank !== "S" || (mode !== "playing" && mode !== "resolving")) return;
    timeLeft = Math.max(0, roundSeconds - (now - timerStart) / 1000);
    updateHud();
    if (timeLeft <= 0) {
      timedOut = true;
      playTimeout();
      finishGame(false);
      return;
    }
    timerRaf = requestAnimationFrame(tickTimer);
  }

  function startTimer() {
    stopTimer();
    if (rank !== "S") {
      timeLeft = 0;
      updateHud();
      return;
    }
    roundSeconds = S_ROUND_SECONDS;
    timeLeft = roundSeconds;
    timerStart = performance.now();
    updateHud();
    timerRaf = requestAnimationFrame(tickTimer);
  }

  // ------------------------------------------------------------- effects ---
  function burst(x, y) {
    const rect = stage.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("span");
      p.className = "fx-particle";
      p.style.left = (x - rect.left) + "px";
      p.style.top = (y - rect.top) + "px";
      p.style.background = BURST_COLORS[i % BURST_COLORS.length];
      const angle = rand(0, Math.PI * 2);
      const dist = rand(24, 90);
      p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      effectsEl.appendChild(p);
      window.setTimeout(() => p.remove(), 700);
    }
  }

  function confettiRain(count) {
    const rect = stage.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "confetti";
      p.style.left = rand(0, rect.width) + "px";
      p.style.background = BURST_COLORS[i % BURST_COLORS.length];
      p.style.setProperty("--drift", rand(-40, 40) + "px");
      p.style.setProperty("--start-rotation", rand(-20, 20) + "deg");
      p.style.setProperty("--end-rotation", rand(80, 280) + "deg");
      p.style.animationDelay = rand(0, 0.4) + "s";
      effectsEl.appendChild(p);
      window.setTimeout(() => p.remove(), 1800);
    }
  }

  function showRibbon(title, sub) {
    const ribbon = document.createElement("div");
    ribbon.className = "ribbon";
    ribbon.innerHTML = `<strong>${title}</strong><span>${sub}</span>`;
    stage.appendChild(ribbon);
    window.setTimeout(() => ribbon.remove(), 1600);
  }

  // -------------------------------------------------------------- board ----
  function buildStations() {
    stationsRoot.innerHTML = "";
    stations = [];
    for (let i = 0; i < STATION_COUNT; i++) {
      const el = document.createElement("div");
      el.className = "station";
      el.dataset.slot = String(i);
      const catWrap = document.createElement("div");
      catWrap.className = "cat-wrap";
      const svg = cloneCatSvg(String(i));
      catWrap.appendChild(svg);
      const factEl = document.createElement("div");
      factEl.className = "fact";
      factEl.innerHTML = `
        <div class="fact-top">0</div>
        <div class="fact-row">
          <span class="minus" aria-hidden="true">−</span>
          <button type="button" class="fact-blank" aria-label="Play a number here"></button>
        </div>
        <div class="fact-rule" aria-hidden="true"></div>
        <div class="fact-diff" hidden></div>`;
      el.appendChild(catWrap);
      el.appendChild(factEl);
      stationsRoot.appendChild(el);
      const blank = factEl.querySelector(".fact-blank");
      blank.addEventListener("click", (e) => {
        e.stopPropagation();
        onBlankActivate(i);
      });
      el.addEventListener("click", () => onBlankActivate(i));
      stations.push({
        index: i,
        el,
        svg,
        factEl,
        kind: "idle",
        problem: null,
        top: null,
        palette: null
      });
    }
    const avoid = [];
    stations.forEach((station) => {
      const palette = pickPalette(avoid);
      avoid.push(palette);
      station.palette = palette;
      station.el.classList.add("idle");
      station.factEl.hidden = true;
      station.svg.setAttribute("data-palette", palette);
      station.svg.setAttribute("data-expression", "neutral");
    });
  }

  function renderHand() {
    handEl.innerHTML = "";
    hand.forEach((card) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card" + (selectedCardId === card.id ? " selected" : "");
      btn.dataset.cardId = card.id;
      btn.textContent = String(card.value);
      btn.setAttribute("aria-label", "Number " + card.value);
      btn.addEventListener("pointerdown", (e) => onCardDown(e, card, btn));
      btn.addEventListener("pointermove", onCardMove);
      btn.addEventListener("pointerup", onCardUp);
      btn.addEventListener("pointercancel", onCardUp);
      handEl.appendChild(btn);
    });
    stage.classList.toggle("picking", !!selectedCardId);
  }

  function selectCard(card) {
    selectedCardId = card ? card.id : null;
    renderHand();
  }

  function cardById(id) {
    return hand.find((c) => c.id === id) || null;
  }

  function stationFromPoint(x, y) {
    for (const station of stations) {
      if (station.kind === "idle") continue;
      const blank = station.factEl.querySelector(".fact-blank");
      const r = blank.getBoundingClientRect();
      const pad = 28;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        return station;
      }
      const sr = station.el.getBoundingClientRect();
      if (x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom) return station;
    }
    return null;
  }

  function highlightStation(target) {
    stations.forEach((s) => s.el.classList.toggle("hot", s === target && s.kind !== "idle"));
  }

  function onCardDown(e, card, btn) {
    if (mode !== "playing" || !e.isPrimary) return;
    ensureAudio();
    const clickingHeld = selectedCardId === card.id;
    drag = {
      card,
      btn,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      wasHeld: clickingHeld
    };
    try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    if (!clickingHeld) playPickup();
  }

  function onCardMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.moved = true;
      selectedCardId = null;
      drag.btn.classList.add("dragging");
      dragGhost.hidden = false;
      dragGhost.textContent = String(drag.card.value);
    }
    dragGhost.style.left = e.clientX + "px";
    dragGhost.style.top = e.clientY + "px";
    highlightStation(stationFromPoint(e.clientX, e.clientY));
  }

  function onCardUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { card, btn, moved, wasHeld } = drag;
    drag = null;
    dragGhost.hidden = true;
    btn.classList.remove("dragging");
    highlightStation(null);

    if (e.type === "pointercancel") {
      selectCard(null);
      return;
    }
    if (!moved) {
      if (wasHeld) selectCard(null);
      else selectCard(card);
      return;
    }
    if (mode !== "playing") {
      selectCard(null);
      return;
    }
    const target = stationFromPoint(e.clientX, e.clientY);
    if (target) tryPlay(card, target);
    else selectCard(null);
  }

  function onBlankActivate(index) {
    if (mode !== "playing" || !selectedCardId) return;
    const station = stations[index];
    if (!station || station.kind === "idle") return;
    const card = cardById(selectedCardId);
    if (!card) return;
    tryPlay(card, station);
  }

  function tryPlay(card, station) {
    if (mode !== "playing") return;
    const correct = station.kind === "real" && station.problem && card.value === station.problem.half;
    if (!correct) {
      station.el.classList.remove("shake");
      void station.el.offsetWidth;
      station.el.classList.add("shake");
      playWrong();
      selectCard(null);
      return;
    }

    mode = "resolving";
    selectCard(null);
    completeFact(station, card.value);
    remaining = remaining.filter((p) => p.id !== station.problem.id);
    solved += 1;
    score += POINTS_PER_REAL;
    syncBest();
    drawCardReplacing(card.id);
    renderHand();
    updateHud();
    playCorrect();
    const r = station.el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * 0.4);

    const replaceIndexes = [station.index];
    stations.forEach((s) => {
      if (s.kind === "distractor" && !replaceIndexes.includes(s.index)) replaceIndexes.push(s.index);
    });

    queueTask(() => {
      if (mode !== "resolving") return;
      if (solved >= REALS_PER_ROUND) {
        roundComplete();
        return;
      }
      fillSlots(replaceIndexes);
      mode = "playing";
      updateHud();
    }, CELEBRATE_MS);
  }

  function buildRound() {
    clearTasks();
    solved = 0;
    selectedCardId = null;
    remaining = makeRealProblems(rank, REALS_PER_ROUND);
    deck = makeDeck(remaining);
    dealHand();
    stations.forEach((s) => {
      s.kind = "idle";
      s.problem = null;
      s.top = null;
      s.palette = null;
    });
    fillSlots([0, 1, 2]);
    renderHand();
    startTimer();
    updateHud();
  }

  function roundComplete() {
    mode = "intermission";
    stopTimer();
    const timeBonus = rank === "S" ? Math.max(0, Math.floor(timeLeft)) : 0;
    if (timeBonus) score += timeBonus;
    syncBest();
    updateHud();
    playFanfare();
    confettiRain(48);

    const finishedRound = roundIndex + 1;
    const isLast = finishedRound >= ROUNDS_PER_RUN;
    const timeBit = timeBonus > 0 ? ` · +${timeBonus} time` : "";

    if (isLast) {
      showRibbon("RUN COMPLETE!", `The cats are full!${timeBit}`);
      queueTask(() => victory(), 1500);
      return;
    }

    showRibbon(`Round ${finishedRound} clear!`, `12 doubles fed${timeBit}`);
    queueTask(() => {
      roundIndex += 1;
      buildRound();
      mode = "playing";
    }, 1700);
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
    overlayTitle.textContent = "FEED THE CATS";
    overlayText.textContent =
      "The missing number is half of the top — 14 − 7 because 7 + 7 = 14. Select a card, then play it into a blank (or drag it). Feed 12 real doubles to clear a round; three rounds rank you up. At A and S, skip cats with odd tops — they are never doubles.";
    overlayExtra.innerHTML = `
      <p class="stat-line">Current rank <span class="rank-badge rank-${rank}">${rank}</span></p>
      ${rankLegendHtml()}`;
    startBtn.textContent = "Feed the cats";
    overlay.classList.remove("hidden");
  }

  async function startGame() {
    ensureAudio();
    clearTasks();
    stopTimer();
    score = 0;
    roundIndex = 0;
    timedOut = false;
    selectedCardId = null;
    overlay.classList.add("hidden");
    overlayExtra.innerHTML = "";
    buildRound();
    mode = "playing";
    updateHud();
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
    mode = "over";
    selectCard(null);
    dragGhost.hidden = true;

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
      confettiRain(90);
      overlayTitle.textContent = rankedUp ? "Rank Up!" : "Cats Fed!";
      overlayText.textContent = rankedUp
        ? "Three rounds of doubles — the cats promoted you!"
        : "Twelve doubles each round, three rounds straight. The cats are purring.";
    } else {
      if (rank === "S") rank = "A";
      overlayTitle.textContent = timedOut ? "Time's up!" : "Dinner's over";
      overlayText.textContent = timedOut
        ? "The 120 seconds ran out before every cat was fed. Back to A rank — try again!"
        : "The cats will be hungry again whenever you're ready.";
    }

    updateHud();
    const rankHtml = rankedUp
      ? `<div class="rank-up-banner">RANK UP! ${oldRank} → ${rank}</div>`
      : "";
    overlayExtra.innerHTML = `
      ${rankHtml}
      <div class="end-stats">
        <div class="end-stat"><span class="lbl">Score</span><span class="num">${score}</span></div>
        <div class="end-stat"><span class="lbl">Round</span><span class="num">${Math.min(roundIndex + 1, ROUNDS_PER_RUN)}/${ROUNDS_PER_RUN}</span></div>
        <div class="end-stat"><span class="lbl">Rank</span><span class="num rank-${rank}">${rank}</span></div>
      </div>
      ${rankLegendHtml()}`;
    startBtn.textContent = "Play again";
    overlay.classList.remove("hidden");

    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, RANKS.indexOf(rank) + 1, {
        rank,
        lastScore: score,
        bestScore: best,
        fed: solved,
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
      if (progress && progress.exists && Number.isFinite(Number(stats.bestScore))) {
        best = Math.max(0, Math.floor(Number(stats.bestScore)));
        localStorage.setItem(BEST_KEY, String(best));
      }
    } catch (_) {
      rank = "C";
    }
  }

  startBtn.addEventListener("click", startGame);
  endBtn.addEventListener("click", () => {
    timedOut = false;
    finishGame(false);
  });

  window.addEventListener("pagehide", () => {
    stopTimer();
    clearTasks();
  });

  buildStations();
  bestEl.textContent = best;
  updateHud();
  loadRank().then(() => {
    updateHud();
    showStartOverlay();
  });
})();
