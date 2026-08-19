/* Factor Rocket — prime-factorization launch pad.
 * 12 composites = a round; 3 rounds at a rank promotes C→B→A→S.
 * C/B grow a lined factor tree. A/S are free assembly + Submit.
 * S: 25s per number, 3 failed numbers drop the player to A.
 * The Super Heavy outline is the 12-band fuel tank; launch is round-end only.
 */
(function () {
  "use strict";

  const GAME_ID = "factorrocket";
  const SOUND_KEY = "matharcade_factorrocket_sound";
  const RANKS = ["C", "B", "A", "S"];
  const RANK_FLAVOR = { C: "pad trainee", B: "booster", A: "pilot", S: "commander" };
  const PROBLEMS_PER_ROUND = 12;
  const ROUNDS_TO_PROMOTE = 3;
  const S_FAILS_TO_DROP = 3;
  const S_TIME_LIMIT_MS = 25000;
  const SOLVE_BASE_POINTS = 100;
  const FACTOR_BONUS = 15;
  const ROUND_CLEAR_BONUS = 300;
  const MAX_N = { C: 70, B: 140, A: 140, S: 140 };
  const PRIMES_ALL = Object.freeze([
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67
  ]);
  const PRIMES_C = Object.freeze(PRIMES_ALL.filter((prime) => prime <= 31));
  const BANDS_C = [
    { min: 2, max: 2, count: 4 },
    { min: 3, max: 3, count: 4 },
    { min: 4, max: 99, count: 4 }
  ];
  const BANDS_ADV = [
    { min: 2, max: 2, count: 3 },
    { min: 3, max: 3, count: 4 },
    { min: 4, max: 4, count: 3 },
    { min: 5, max: 99, count: 2 }
  ];
  const CELEBRATIONS = [
    "Fuel loaded!",
    "Primes locked in!",
    "Tank rising!",
    "Clean factorization!",
    "Booster fed!",
    "Payload refined!"
  ];
  const WRONG_GUIDED = [
    "That prime does not divide the remaining number.",
    "Not a factor of what is left. Try another prime.",
    "The remaining composite does not accept that prime."
  ];
  const WRONG_FREE = [
    "Those primes do not multiply back to the payload.",
    "Not a complete factorization. Clear a chip and try again.",
    "Product does not match. Rebuild the prime list."
  ];
  const BURST_COLORS = ["#5eead4", "#ffb347", "#ff6b4a", "#93b4ff", "#ffffff"];

  const stageEl = document.getElementById("stage");
  const effectsEl = document.getElementById("effects");
  const messageEl = document.getElementById("message");
  const payloadNumberEl = document.getElementById("payload-number");
  const treePaneEl = document.getElementById("tree-pane");
  const treeCanvasEl = document.getElementById("tree-canvas");
  const treeLinesEl = document.getElementById("tree-lines");
  const collectionPaneEl = document.getElementById("collection-pane");
  const primePadEl = document.getElementById("prime-pad");
  const submitBtnEl = document.getElementById("submit-btn");
  const rocketWrapEl = document.getElementById("rocket-wrap");
  const fuelRectEl = document.getElementById("fuel-rect");
  const timerEl = document.getElementById("timer");
  const timerFillEl = document.getElementById("timer-fill");
  const timerTextEl = document.getElementById("timer-text");
  const rankValueEl = document.getElementById("rank-value");
  const roundValueEl = document.getElementById("round-value");
  const payloadValueEl = document.getElementById("payload-value");
  const failsChipEl = document.getElementById("fails-chip");
  const failsValueEl = document.getElementById("fails-value");
  const scoreValueEl = document.getElementById("score-value");
  const scoreChipEl = document.getElementById("score-chip");
  const overlayEl = document.getElementById("overlay");
  const overlayKickerEl = document.getElementById("overlay-kicker");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayCopyEl = document.getElementById("overlay-copy");
  const overlayExtraEl = document.getElementById("overlay-extra");
  const overlayStatsEl = document.getElementById("overlay-stats");
  const roundPointsEl = document.getElementById("round-points");
  const sessionPointsEl = document.getElementById("session-points");
  const overlayActionEl = document.getElementById("overlay-action");
  const soundToggleEl = document.getElementById("sound-toggle");
  const soundIconEl = document.getElementById("sound-icon");
  const soundLabelEl = document.getElementById("sound-label");

  if (!stageEl || !overlayActionEl || !primePadEl || !fuelRectEl) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let overlayMode = "start";
  let messageTimer = 0;
  const roundTimers = new Set();

  const state = {
    phase: "intro",
    rank: "C",
    roundsAtRank: 0,
    solved: 0,
    failed: 0,
    attempted: 0,
    fueled: 0,
    currentIndex: 0,
    problems: [],
    remaining: 0,
    accepted: [],
    splits: [],
    collection: [],
    roundScore: 0,
    sessionScore: 0,
    roundStartedAt: 0
  };

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function choice(list) {
    return list[randInt(0, list.length - 1)];
  }

  function nextRank(rank) {
    const index = RANKS.indexOf(rank);
    return RANKS[Math.min(RANKS.length - 1, index + 1)];
  }

  function isGuidedRank(rank) {
    return rank === "C" || rank === "B";
  }

  function availablePrimes(rank) {
    return rank === "C" ? PRIMES_C : PRIMES_ALL;
  }

  function formatScore(value) {
    if (window.MathArcade && typeof MathArcade.formatScore === "function") {
      return MathArcade.formatScore(value);
    }
    return String(value);
  }

  function isPrime(value) {
    if (!Number.isInteger(value) || value < 2) return false;
    if (value === 2) return true;
    if (value % 2 === 0) return false;
    for (let factor = 3; factor * factor <= value; factor += 2) {
      if (value % factor === 0) return false;
    }
    return true;
  }

  function primeFactors(value) {
    const factors = [];
    let remaining = value;
    for (let i = 0; i < PRIMES_ALL.length && remaining > 1; i += 1) {
      const prime = PRIMES_ALL[i];
      while (remaining % prime === 0) {
        factors.push(prime);
        remaining /= prime;
      }
    }
    if (remaining > 1) factors.push(remaining);
    return factors;
  }

  function isPurePower(factors) {
    return factors.length >= 2 && factors.every((factor) => factor === factors[0]);
  }

  function product(values) {
    return values.reduce((total, value) => total * value, 1);
  }

  function buildPool(maxN) {
    const pool = [];
    for (let n = 4; n <= maxN; n += 1) {
      if (isPrime(n)) continue;
      const factors = primeFactors(n);
      if (factors.length < 2) continue;
      pool.push({
        n,
        factors,
        length: factors.length,
        pure: isPurePower(factors)
      });
    }
    return pool;
  }

  function sampleBand(candidates, used, count) {
    const mixed = shuffle(candidates.filter((item) => !item.pure && !used.has(item.n)));
    const pures = shuffle(candidates.filter((item) => item.pure && !used.has(item.n)));
    const picked = [];
    while (picked.length < count && mixed.length) {
      picked.push(mixed.pop());
    }
    while (picked.length < count && pures.length) {
      picked.push(pures.pop());
    }
    if (pures.length && picked.length && !picked.some((item) => item.pure) && Math.random() < 0.45) {
      picked[picked.length - 1] = pures.pop();
    }
    picked.forEach((item) => used.add(item.n));
    return picked;
  }

  function buildRoundProblems(rank) {
    const pool = buildPool(MAX_N[rank] || 70);
    const bands = rank === "C" ? BANDS_C : BANDS_ADV;
    const used = new Set();
    const picked = [];
    bands.forEach((band) => {
      const candidates = pool.filter((item) => item.length >= band.min && item.length <= band.max);
      picked.push(...sampleBand(candidates, used, band.count));
    });
    while (picked.length < PROBLEMS_PER_ROUND) {
      const leftover = shuffle(pool.filter((item) => !used.has(item.n)));
      if (!leftover.length) break;
      const extra = leftover[0];
      used.add(extra.n);
      picked.push(extra);
    }
    return shuffle(picked).slice(0, PROBLEMS_PER_ROUND);
  }

  function queueTask(fn, delay) {
    const id = window.setTimeout(() => {
      roundTimers.delete(id);
      fn();
    }, delay);
    roundTimers.add(id);
    return id;
  }

  function clearTasks() {
    roundTimers.forEach((id) => window.clearTimeout(id));
    roundTimers.clear();
  }

  function announce(text, celebrate, duration) {
    messageEl.textContent = text;
    messageEl.className = `message show${celebrate ? " celebrate" : ""}`;
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
      messageEl.classList.remove("show");
    }, reducedMotion ? 850 : (duration || 1700));
  }

  function hideMessage() {
    window.clearTimeout(messageTimer);
    messageEl.classList.remove("show");
  }

  function updateHud(bumpScore) {
    rankValueEl.textContent = state.rank;
    rankValueEl.className = `hud-value rank-${state.rank}`;
    roundValueEl.textContent = `${Math.min(state.roundsAtRank + 1, ROUNDS_TO_PROMOTE)} / ${ROUNDS_TO_PROMOTE}`;
    payloadValueEl.textContent = `${state.solved} / ${PROBLEMS_PER_ROUND}`;
    failsValueEl.textContent = `${state.failed} / ${S_FAILS_TO_DROP}`;
    failsChipEl.hidden = state.rank !== "S";
    scoreValueEl.textContent = formatScore(state.sessionScore);
    if (bumpScore) {
      scoreChipEl.classList.remove("score-bump");
      void scoreChipEl.offsetWidth;
      scoreChipEl.classList.add("score-bump");
    }
  }

  function setFuelLevel(bands) {
    const tank = 640;
    const filled = clamp(bands, 0, PROBLEMS_PER_ROUND) / PROBLEMS_PER_ROUND;
    const height = tank * filled;
    fuelRectEl.setAttribute("y", String(tank - height));
    fuelRectEl.setAttribute("height", String(height));
  }

  function currentProblem() {
    return state.problems[state.currentIndex] || null;
  }

  function renderPrimePad() {
    const primes = availablePrimes(state.rank);
    primePadEl.replaceChildren();
    primes.forEach((prime) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "prime-btn";
      button.dataset.prime = String(prime);
      button.textContent = String(prime);
      button.addEventListener("click", () => onPrimeClick(prime, button));
      primePadEl.append(button);
    });
  }

  function clearTree() {
    treeCanvasEl.querySelectorAll(".tree-node").forEach((node) => node.remove());
    treeLinesEl.replaceChildren();
    treeCanvasEl.style.height = "";
    treeCanvasEl.style.minWidth = "";
  }

  function renderTree(animateLast) {
    clearTree();
    if (!isGuidedRank(state.rank)) return;
    const problem = currentProblem();
    if (!problem) return;

    const paneW = Math.max(treePaneEl.clientWidth || 360, 280);
    const depth = state.splits.length;
    const vGap = Math.max(58, Math.min(82, 76 - depth * 3));
    const h0 = Math.max(46, Math.min(88, paneW * 0.2));
    const top = 36;
    const positions = { root: { x: paneW * 0.4, y: top } };

    state.splits.forEach((_, index) => {
      const parent = index === 0 ? positions.root : positions[`r${index - 1}`];
      const spread = h0 * Math.pow(0.86, index);
      positions[`p${index}`] = { x: parent.x - spread, y: parent.y + vGap };
      positions[`r${index}`] = { x: parent.x + spread, y: parent.y + vGap };
    });

    let minX = positions.root.x;
    let maxX = positions.root.x;
    let maxY = positions.root.y;
    Object.values(positions).forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });

    const pad = 48;
    const shiftX = minX < pad ? pad - minX : 0;
    const width = Math.max(paneW, maxX + shiftX + pad);
    const height = maxY + 56;
    treeCanvasEl.style.minWidth = `${width}px`;
    treeCanvasEl.style.height = `${height}px`;
    treeLinesEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    treeLinesEl.setAttribute("width", String(width));
    treeLinesEl.setAttribute("height", String(height));

    Object.keys(positions).forEach((key) => {
      positions[key] = { x: positions[key].x + shiftX, y: positions[key].y };
    });

    function addNode(id, value, kind, point, arriving) {
      const node = document.createElement("div");
      node.className = `tree-node ${kind}${arriving ? " arrive" : ""}`;
      node.dataset.id = id;
      node.textContent = String(value);
      node.style.left = `${point.x}px`;
      node.style.top = `${point.y}px`;
      treeCanvasEl.append(node);
    }

    function addEdge(from, to) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${from.x} ${from.y + 16} L ${to.x} ${to.y - 18}`);
      treeLinesEl.append(path);
    }

    addNode("root", problem.n, "root", positions.root, false);
    state.splits.forEach((split, index) => {
      const parent = index === 0 ? positions.root : positions[`r${index - 1}`];
      const arriving = Boolean(animateLast) && index === state.splits.length - 1;
      addEdge(parent, positions[`p${index}`]);
      addEdge(parent, positions[`r${index}`]);
      addNode(`p${index}`, split.prime, "prime", positions[`p${index}`], arriving);
      addNode(
        `r${index}`,
        split.remaining,
        split.remainingIsPrime ? "prime" : "composite",
        positions[`r${index}`],
        arriving
      );
    });
    treePaneEl.scrollTop = treePaneEl.scrollHeight;
    treePaneEl.scrollLeft = Math.max(0, (width - treePaneEl.clientWidth) / 2);
  }

  function renderCollection() {
    collectionPaneEl.replaceChildren();
    if (!state.collection.length) {
      const empty = document.createElement("p");
      empty.className = "collection-empty";
      empty.textContent = "Tap primes to assemble the factorization.";
      collectionPaneEl.append(empty);
      return;
    }
    state.collection.forEach((prime, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "factor-chip";
      chip.textContent = String(prime);
      chip.setAttribute("aria-label", `Remove prime ${prime}`);
      chip.addEventListener("click", () => {
        if (state.phase !== "playing") return;
        state.collection.splice(index, 1);
        playClick();
        renderCollection();
      });
      collectionPaneEl.append(chip);
    });
  }

  function showPayloadModes() {
    const guided = isGuidedRank(state.rank);
    treePaneEl.hidden = !guided;
    collectionPaneEl.hidden = guided;
    submitBtnEl.hidden = guided;
  }

  function beginPayload() {
    const problem = currentProblem();
    if (!problem) return;
    state.phase = "playing";
    state.remaining = problem.n;
    state.accepted = [];
    state.splits = [];
    state.collection = [];
    payloadNumberEl.textContent = String(problem.n);
    showPayloadModes();
    if (isGuidedRank(state.rank)) {
      renderTree(false);
    } else {
      clearTree();
      renderCollection();
    }
    if (state.rank === "S") startTimer();
    else hideTimer();
    updateHud(false);
  }

  function spawnSolveEffects(points) {
    const rect = payloadNumberEl.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - stageRect.left;
    const y = rect.top + rect.height / 2 - stageRect.top;
    for (let i = 0; i < 16; i += 1) {
      const particle = document.createElement("span");
      particle.className = "hit-particle";
      const angle = (Math.PI * 2 * i) / 16;
      const dist = 36 + Math.random() * 48;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.background = choice(BURST_COLORS);
      particle.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      particle.addEventListener("animationend", () => particle.remove(), { once: true });
      effectsEl.append(particle);
    }
    const pop = document.createElement("span");
    pop.className = "score-pop";
    pop.textContent = `+${points}`;
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
    pop.addEventListener("animationend", () => pop.remove(), { once: true });
    effectsEl.append(pop);
  }

  function completePayload() {
    if (state.phase !== "playing" && state.phase !== "resolving") return;
    state.phase = "resolving";
    hideTimer();
    const problem = currentProblem();
    const points = SOLVE_BASE_POINTS + problem.factors.length * FACTOR_BONUS;
    state.solved += 1;
    state.attempted += 1;
    state.fueled += 1;
    state.roundScore += points;
    state.sessionScore += points;
    setFuelLevel(state.fueled);
    updateHud(true);
    spawnSolveEffects(points);
    playFuelLoad();
    announce(choice(CELEBRATIONS), true, 1200);
    queueTask(() => advanceOrFinish(), reducedMotion ? 180 : 620);
  }

  function failPayload(reason) {
    if (state.phase !== "playing") return;
    state.phase = "resolving";
    hideTimer();
    state.failed += 1;
    state.attempted += 1;
    updateHud(false);
    playReject();
    stageEl.classList.remove("shake");
    void stageEl.offsetWidth;
    stageEl.classList.add("shake");
    announce(reason, false, 1500);
    if (state.failed >= S_FAILS_TO_DROP) {
      queueTask(() => failRound(), reducedMotion ? 200 : 700);
      return;
    }
    queueTask(() => advanceOrFinish(), reducedMotion ? 180 : 620);
  }

  function advanceOrFinish() {
    if (state.attempted >= PROBLEMS_PER_ROUND) {
      finishRound();
      return;
    }
    state.currentIndex += 1;
    rocketWrapEl.classList.remove("launching");
    beginPayload();
  }

  function onPrimeClick(prime, button) {
    if (state.phase !== "playing") return;
    playClick();
    if (isGuidedRank(state.rank)) {
      acceptGuidedPrime(prime, button);
      return;
    }
    state.collection.push(prime);
    renderCollection();
  }

  function acceptGuidedPrime(prime, button) {
    if (state.remaining % prime !== 0) {
      button.classList.remove("shake");
      void button.offsetWidth;
      button.classList.add("shake");
      playReject();
      announce(choice(WRONG_GUIDED), false, 1300);
      return;
    }

    if (state.remaining === prime) {
      state.accepted.push(prime);
      if (state.splits.length) {
        state.splits[state.splits.length - 1].remainingIsPrime = true;
      }
      renderTree(true);
      playAccept();
      completePayload();
      return;
    }

    state.remaining /= prime;
    state.accepted.push(prime);
    const remainingIsPrime = isPrime(state.remaining);
    state.splits.push({
      prime,
      remaining: state.remaining,
      remainingIsPrime
    });
    renderTree(true);
    playAccept();

    if (remainingIsPrime) {
      state.accepted.push(state.remaining);
      state.phase = "resolving";
      queueTask(() => completePayload(), reducedMotion ? 80 : 220);
    }
  }

  function onSubmit() {
    if (state.phase !== "playing" || isGuidedRank(state.rank)) return;
    const problem = currentProblem();
    if (!problem) return;
    if (product(state.collection) === problem.n && state.collection.length > 0) {
      completePayload();
      return;
    }
    playReject();
    stageEl.classList.remove("shake");
    void stageEl.offsetWidth;
    stageEl.classList.add("shake");
    if (state.rank === "S") {
      failPayload(choice(WRONG_FREE));
      return;
    }
    state.collection = [];
    renderCollection();
    announce(choice(WRONG_FREE), false, 1500);
  }

  let timerId = 0;
  let timerDeadline = 0;
  let timerPausedRemaining = -1;

  function startTimer() {
    hideTimer();
    timerEl.hidden = false;
    timerEl.classList.remove("urgent");
    timerDeadline = performance.now() + S_TIME_LIMIT_MS;
    timerPausedRemaining = -1;
    timerId = window.setInterval(updateTimer, 100);
    updateTimer();
  }

  function hideTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = 0;
    }
    timerEl.hidden = true;
    timerEl.classList.remove("urgent");
    timerPausedRemaining = -1;
  }

  function pauseTimer() {
    if (!timerId) return;
    timerPausedRemaining = Math.max(0, timerDeadline - performance.now());
    window.clearInterval(timerId);
    timerId = 0;
  }

  function resumeTimer() {
    if (timerPausedRemaining < 0 || state.rank !== "S" || state.phase !== "playing") return;
    timerDeadline = performance.now() + timerPausedRemaining;
    timerPausedRemaining = -1;
    timerId = window.setInterval(updateTimer, 100);
  }

  function updateTimer() {
    const remaining = Math.max(0, timerDeadline - performance.now());
    const fraction = remaining / S_TIME_LIMIT_MS;
    timerFillEl.style.width = `${fraction * 100}%`;
    const seconds = Math.ceil(remaining / 1000);
    timerTextEl.textContent = `0:${String(seconds).padStart(2, "0")}`;
    if (fraction <= 0.25) timerEl.classList.add("urgent");
    else timerEl.classList.remove("urgent");
    if (remaining <= 0) {
      hideTimer();
      failPayload("Time's up — that payload is scrapped.");
    }
  }

  function startRound() {
    clearTasks();
    hideOverlay();
    hideMessage();
    rocketWrapEl.classList.remove("launching");
    state.phase = "playing";
    state.solved = 0;
    state.failed = 0;
    state.attempted = 0;
    state.fueled = 0;
    state.currentIndex = 0;
    state.roundScore = 0;
    state.problems = buildRoundProblems(state.rank);
    state.roundStartedAt = performance.now();
    setFuelLevel(0);
    renderPrimePad();
    showPayloadModes();
    updateHud(false);
    startMusic();
    beginPayload();
    announce(
      state.rank === "S"
        ? "Commander rank: 25 seconds per payload. Three misses abort the launch."
        : isGuidedRank(state.rank)
          ? "Tap primes that divide the remaining number. The tree will grow."
          : "Assemble every prime, then submit the full factorization.",
      false,
      2200
    );
  }

  function finishRound() {
    if (!["playing", "resolving"].includes(state.phase)) return;
    state.phase = "launching";
    hideTimer();
    stopMusic();
    const bonus = ROUND_CLEAR_BONUS;
    state.roundScore += bonus;
    state.sessionScore += bonus;

    const oldRank = state.rank;
    let rankedUp = false;
    state.roundsAtRank += 1;
    if (state.roundsAtRank >= ROUNDS_TO_PROMOTE) {
      if (state.rank !== "S") {
        state.rank = nextRank(state.rank);
        rankedUp = true;
      }
      state.roundsAtRank = 0;
    }

    updateHud(true);
    playLaunch();
    if (rankedUp) playRankUp();
    rocketWrapEl.classList.add("launching");

    const snapshot = {
      oldRank,
      rank: state.rank,
      rankedUp,
      failed: false,
      roundsAtRank: state.roundsAtRank,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore,
      solved: state.solved,
      misses: state.failed
    };
    void persistRound(snapshot, true);
    queueTask(() => {
      state.phase = "roundComplete";
      showRoundComplete(snapshot);
    }, reducedMotion ? 280 : 1250);
  }

  function failRound() {
    if (!["playing", "resolving"].includes(state.phase)) return;
    state.phase = "failed";
    clearTasks();
    hideTimer();
    stopMusic();
    playFail();
    const oldRank = state.rank;
    state.rank = "A";
    state.roundsAtRank = 0;
    updateHud(false);
    announce("Three misses — launch abort. Back to rank A.", false, 2200);
    const snapshot = {
      oldRank,
      rank: state.rank,
      rankedUp: false,
      failed: true,
      roundsAtRank: 0,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore,
      solved: state.solved,
      misses: state.failed
    };
    void persistRound(snapshot, false);
    queueTask(() => showFailOverlay(snapshot), reducedMotion ? 220 : 900);
  }

  async function persistRound(snapshot, won) {
    if (!window.MathArcade) return;
    try {
      await MathArcade.submitScore(GAME_ID, snapshot.roundScore);
      await MathArcade.saveProgress(GAME_ID, RANKS.indexOf(snapshot.rank) + 1, {
        rank: snapshot.rank,
        roundsAtRank: snapshot.roundsAtRank,
        won,
        lastRoundScore: snapshot.roundScore,
        sessionScore: snapshot.sessionScore,
        rankedUp: Boolean(snapshot.rankedUp)
      });
    } catch (error) {
      console.warn("Factor Rocket could not save progress.", error);
    }
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

  function roundPipsHtml(done) {
    let pips = "";
    for (let i = 0; i < ROUNDS_TO_PROMOTE; i += 1) {
      pips += `<span class="round-pip${i < done ? " done" : ""}"></span>`;
    }
    return `<div class="round-pips" aria-label="${done} of ${ROUNDS_TO_PROMOTE} rounds toward the next rank">${pips}</div>`;
  }

  function showOverlay() {
    overlayEl.classList.remove("hidden");
    overlayEl.setAttribute("aria-hidden", "false");
    queueTask(() => overlayActionEl.focus({ preventScroll: true }), 180);
  }

  function hideOverlay() {
    overlayEl.classList.add("hidden");
    overlayEl.setAttribute("aria-hidden", "true");
  }

  function howToForRank(rank) {
    if (rank === "S") {
      return "Free assembly with a 25-second timer on every payload. Submit the complete prime list. A wrong submit or a timeout scraps that number. Three misses abort the launch and drop you to rank A.";
    }
    if (rank === "A") {
      return "No factor tree. Collect every prime, then press Submit. A wrong list just clears so you can try the same payload again.";
    }
    return "Tap a prime that divides the remaining number. A factor tree grows under the payload — primes sit in circles, remaining composites stay amber. When the leftover is itself prime, it is accepted automatically.";
  }

  function paintStartOverlay() {
    overlayMode = "start";
    overlayKickerEl.textContent = "Prime factorization pad";
    overlayTitleEl.textContent = "Factor Rocket";
    overlayCopyEl.textContent = `Fuel the Super Heavy stack by factoring 12 composites. Three successful rounds promote you. ${howToForRank(state.rank)}`;
    overlayExtraEl.innerHTML = `
      <p>Current rank <span class="rank-badge rank-${state.rank}">${state.rank}</span></p>
      ${roundPipsHtml(state.roundsAtRank)}
      ${rankLegendHtml()}`;
    overlayStatsEl.hidden = true;
    overlayActionEl.textContent = "Start launch prep";
    overlayActionEl.disabled = false;
  }

  function showRoundComplete(snapshot) {
    overlayMode = "next";
    overlayKickerEl.textContent = snapshot.rankedUp
      ? "Rank up"
      : `Rank ${state.rank} · round ${snapshot.roundsAtRank} of ${ROUNDS_TO_PROMOTE}`;
    overlayTitleEl.textContent = snapshot.rankedUp ? "Rank Up!" : "Liftoff!";
    overlayCopyEl.textContent = snapshot.rankedUp
      ? `You cleared ${ROUNDS_TO_PROMOTE} rounds — ${snapshot.oldRank} → ${state.rank}. ${howToForRank(state.rank)}`
      : state.rank === "S"
        ? `Commander flight complete${snapshot.misses ? ` with ${snapshot.misses} miss${snapshot.misses === 1 ? "" : "es"}` : ""}. Keep clearing S rounds to hold the pad.`
        : `Stack fueled! Clear ${ROUNDS_TO_PROMOTE - snapshot.roundsAtRank} more round${
            ROUNDS_TO_PROMOTE - snapshot.roundsAtRank === 1 ? "" : "s"
          } to reach rank ${nextRank(state.rank)}.`;
    overlayExtraEl.innerHTML = `
      ${snapshot.rankedUp ? `<div class="rank-up-banner">RANK UP! ${snapshot.oldRank} → ${state.rank}</div>` : ""}
      ${roundPipsHtml(snapshot.roundsAtRank)}
      ${rankLegendHtml()}`;
    roundPointsEl.textContent = `+${formatScore(snapshot.roundScore)}`;
    sessionPointsEl.textContent = formatScore(snapshot.sessionScore);
    overlayStatsEl.hidden = false;
    overlayActionEl.textContent = "Next round";
    overlayActionEl.disabled = false;
    showOverlay();
  }

  function showFailOverlay(snapshot) {
    overlayMode = "next";
    overlayKickerEl.textContent = "Launch abort";
    overlayTitleEl.textContent = "Back to rank A";
    overlayCopyEl.textContent = `You refined ${snapshot.solved} of ${PROBLEMS_PER_ROUND} payloads before three misses. Earn ${ROUNDS_TO_PROMOTE} rounds at A to face the S timer again.`;
    overlayExtraEl.innerHTML = `
      <div class="rank-down-banner">S → A · you'll be back!</div>
      ${rankLegendHtml()}`;
    roundPointsEl.textContent = `+${formatScore(snapshot.roundScore)}`;
    sessionPointsEl.textContent = formatScore(snapshot.sessionScore);
    overlayStatsEl.hidden = false;
    overlayActionEl.textContent = "Try again at rank A";
    overlayActionEl.disabled = false;
    showOverlay();
  }

  async function startSession() {
    if (state.phase === "loading") return;
    state.phase = "loading";
    overlayActionEl.disabled = true;
    overlayActionEl.textContent = "Fueling…";
    ensureAudio();
    playClick();
    if (window.MathArcade && typeof MathArcade.ensurePlayer === "function") {
      try { await MathArcade.ensurePlayer(); } catch (_) { /* local play is fine */ }
    }
    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        applyProgress(await MathArcade.loadProgress(GAME_ID));
      } catch (error) {
        console.warn("Factor Rocket progress could not be loaded; starting locally.", error);
      }
    }
    state.sessionScore = 0;
    overlayActionEl.disabled = false;
    startRound();
  }

  function applyProgress(progress) {
    let stats = {};
    if (progress && progress.statsJson) {
      try { stats = JSON.parse(progress.statsJson); } catch (_) { stats = {}; }
    }
    state.rank = RANKS.includes(stats.rank) ? stats.rank : "C";
    const rounds = Number(stats.roundsAtRank);
    state.roundsAtRank = Number.isInteger(rounds)
      ? clamp(rounds, 0, ROUNDS_TO_PROMOTE - 1)
      : 0;
  }

  let soundEnabled = readSoundPreference();
  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let nextMusicTime = 0;
  let audioUnavailable = false;
  let noiseCache = null;

  const DRONE_VOICINGS = [
    [45, 52, 57],
    [48, 55, 60],
    [41, 48, 53],
    [50, 57, 62]
  ];

  function readSoundPreference() {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "off";
    } catch (_) {
      return true;
    }
  }

  function storeSoundPreference() {
    try {
      window.localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    } catch (_) { /* privacy mode */ }
  }

  function updateSoundControl() {
    soundToggleEl.setAttribute("aria-pressed", String(soundEnabled));
    soundToggleEl.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    soundIconEl.textContent = soundEnabled ? "♪" : "×";
    soundLabelEl.textContent = soundEnabled ? "Sound on" : "Sound off";
    if (audioUnavailable) {
      soundToggleEl.title = "Web Audio is not supported in this browser";
      soundToggleEl.disabled = true;
    }
  }

  function ensureAudio() {
    if (audioUnavailable) return null;
    if (audioContext) return audioContext;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      audioUnavailable = true;
      updateSoundControl();
      return null;
    }
    audioContext = new Context();
    masterGain = audioContext.createGain();
    musicGain = audioContext.createGain();
    sfxGain = audioContext.createGain();
    masterGain.gain.value = soundEnabled ? 0.82 : 0.0001;
    musicGain.gain.value = 0.34;
    sfxGain.gain.value = 0.7;
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audioContext.destination);
    return audioContext;
  }

  function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function noiseBuffer(seconds) {
    const context = ensureAudio();
    if (!context) return null;
    if (noiseCache && noiseCache.length >= context.sampleRate * seconds) return noiseCache;
    const length = Math.ceil(context.sampleRate * Math.max(seconds, 1.4));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseCache = buffer;
    return buffer;
  }

  function playTone(dest, options) {
    const context = ensureAudio();
    if (!context || !soundEnabled) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(options.freq, options.t);
    if (options.freqEnd) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.freqEnd), options.t + options.dur);
    }
    filter.type = "lowpass";
    filter.frequency.value = options.filter || 1800;
    const attack = options.attack || 0.01;
    gain.gain.setValueAtTime(0.0001, options.t);
    gain.gain.linearRampToValueAtTime(options.gain, options.t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.t + options.dur);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    oscillator.start(options.t);
    oscillator.stop(options.t + options.dur + 0.05);
  }

  function musicStepDuration() {
    const bpm = state.rank === "S" ? 72 : 58;
    return 60 / bpm / 2;
  }

  function scheduleMusicStep(step, time) {
    const context = ensureAudio();
    if (!context) return;
    const voicing = DRONE_VOICINGS[Math.floor(step / 16) % DRONE_VOICINGS.length];
    const position = step % 16;

    if (position === 0) {
      const bar = musicStepDuration() * 15.4;
      voicing.forEach((note, index) => {
        playTone(musicGain, {
          type: index === 0 ? "sine" : "triangle",
          freq: midiToFreq(note),
          t: time + index * 0.03,
          dur: bar,
          gain: index === 0 ? 0.045 : 0.028,
          attack: 0.85,
          filter: 520 + index * 80
        });
      });
      const air = context.createBufferSource();
      air.buffer = noiseBuffer(1.2);
      const high = context.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 2400;
      const airGain = context.createGain();
      airGain.gain.setValueAtTime(0.0001, time);
      airGain.gain.linearRampToValueAtTime(0.018, time + 0.4);
      airGain.gain.exponentialRampToValueAtTime(0.0001, time + bar);
      air.connect(high);
      high.connect(airGain);
      airGain.connect(musicGain);
      air.start(time);
      air.stop(time + bar);
    }

    if (position === 0) {
      playTone(musicGain, {
        type: "sine",
        freq: midiToFreq(voicing[0] - 12),
        t: time,
        dur: 0.42,
        gain: 0.05,
        attack: 0.04,
        filter: 280
      });
    }

    if (position === 10 && step % 32 < 16) {
      playTone(musicGain, {
        type: "sine",
        freq: midiToFreq(voicing[2] + 24),
        t: time,
        dur: 0.55,
        gain: 0.03,
        attack: 0.01,
        filter: 3200
      });
    }
  }

  function musicScheduler() {
    if (!audioContext || document.hidden) return;
    while (nextMusicTime < audioContext.currentTime + 0.28) {
      scheduleMusicStep(musicStep, nextMusicTime);
      nextMusicTime += musicStepDuration();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!soundEnabled || document.hidden || musicTimer) return;
    const context = ensureAudio();
    if (!context) return;
    if (context.state === "suspended") context.resume();
    musicGain.gain.cancelScheduledValues(context.currentTime);
    musicGain.gain.setTargetAtTime(0.34, context.currentTime, 0.05);
    musicStep = 0;
    nextMusicTime = context.currentTime + 0.08;
    musicTimer = window.setInterval(musicScheduler, 90);
    musicScheduler();
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
    if (audioContext && musicGain) {
      musicGain.gain.cancelScheduledValues(audioContext.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.08);
    }
  }

  function playClick() {
    const context = ensureAudio();
    if (!context) return;
    playTone(sfxGain, { type: "sine", freq: 620, t: context.currentTime, dur: 0.07, gain: 0.12, attack: 0.004, filter: 1800 });
  }

  function playAccept() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    playTone(sfxGain, { type: "sine", freq: 520, freqEnd: 780, t: now, dur: 0.16, gain: 0.16, attack: 0.008 });
    playTone(sfxGain, { type: "triangle", freq: 780, freqEnd: 1040, t: now + 0.05, dur: 0.14, gain: 0.1, attack: 0.008 });
  }

  function playReject() {
    const context = ensureAudio();
    if (!context) return;
    playTone(sfxGain, { type: "triangle", freq: 180, freqEnd: 110, t: context.currentTime, dur: 0.2, gain: 0.16, filter: 700 });
  }

  function playFuelLoad() {
    const context = ensureAudio();
    if (!context) return;
    playTone(sfxGain, { type: "sine", freq: 180, freqEnd: 360, t: context.currentTime, dur: 0.32, gain: 0.18, attack: 0.02, filter: 900 });
  }

  function playLaunch() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    const src = context.createBufferSource();
    src.buffer = noiseBuffer(1.3);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(3600, now + 0.5);
    filter.frequency.exponentialRampToValueAtTime(400, now + 1.2);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    src.start(now);
    playTone(sfxGain, { type: "sine", freq: 140, freqEnd: 36, t: now, dur: 1.05, gain: 0.36, attack: 0.05, filter: 400 });
    playTone(sfxGain, { type: "sawtooth", freq: 90, freqEnd: 30, t: now, dur: 0.85, gain: 0.1, attack: 0.05, filter: 280 });
  }

  function playRankUp() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [523, 659, 784, 1046].forEach((freq, index) => {
      playTone(sfxGain, { type: "sine", freq, t: now + index * 0.09, dur: 0.28, gain: 0.14, attack: 0.01 });
    });
  }

  function playFail() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [392, 349, 294, 220].forEach((freq, index) => {
      playTone(sfxGain, { type: "triangle", freq, t: now + index * 0.14, dur: 0.26, gain: 0.12, attack: 0.01, filter: 800 });
    });
  }

  function setSoundEnabled(enabled) {
    soundEnabled = enabled;
    storeSoundPreference();
    updateSoundControl();
    if (!soundEnabled) {
      stopMusic();
      if (audioContext && masterGain) {
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.025);
      }
      return;
    }
    const context = ensureAudio();
    if (!context) return;
    masterGain.gain.cancelScheduledValues(context.currentTime);
    masterGain.gain.setTargetAtTime(0.82, context.currentTime, 0.025);
    playClick();
    if (["playing", "resolving", "launching"].includes(state.phase)) startMusic();
  }

  overlayActionEl.addEventListener("click", () => {
    if (overlayMode === "start") {
      void startSession();
    } else {
      ensureAudio();
      playClick();
      startRound();
    }
  });

  submitBtnEl.addEventListener("click", onSubmit);

  soundToggleEl.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled);
  });

  window.addEventListener("resize", () => {
    if (isGuidedRank(state.rank) && ["playing", "resolving"].includes(state.phase)) {
      renderTree(false);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
      pauseTimer();
    } else {
      if (soundEnabled && ["playing", "resolving"].includes(state.phase)) startMusic();
      resumeTimer();
    }
  });

  window.addEventListener("pagehide", stopMusic);

  const handleReducedMotionChange = (event) => {
    reducedMotion = event.matches;
  };
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(handleReducedMotionChange);
  }

  updateSoundControl();
  setFuelLevel(0);
  updateHud(false);

  (async () => {
    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        applyProgress(await MathArcade.loadProgress(GAME_ID));
      } catch (_) { /* start at C */ }
    }
    updateHud(false);
    paintStartOverlay();
  })();
})();
