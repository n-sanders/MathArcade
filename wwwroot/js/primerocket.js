/* Prime Factor Rocket — break composite payloads into prime fuel.
 * Guided ranks (C/B) grow a live factor tree with per-click feedback;
 * free ranks (A/S) assemble the full factorization and submit it.
 * 12 payloads = a round; 3 rounds at a rank promotes C→B→A→S.
 * S adds a 25s per-payload timer; 3 failed payloads drop you back to A.
 */
(function () {
  "use strict";

  const GAME_ID = "primerocket";
  const SOUND_KEY = "matharcade_primerocket_sound";
  const RANKS = ["C", "B", "A", "S"];
  const RANK_FLAVOR = { C: "cadet", B: "pilot", A: "captain", S: "star commander" };
  const RANK_MAX_COMPOSITE = { C: 70, B: 140, A: 140, S: 140 };
  const PRIME_BUTTON_LIMIT = { C: 31, B: 67, A: 67, S: 67 };
  const PAYLOADS_PER_ROUND = 12;
  const ROUNDS_TO_PROMOTE = 3;
  const S_NUMBER_TIME_MS = 25000;
  const S_MAX_FAILURES = 3;

  const PRIME_POINTS = 25;
  const COMPLETE_BASE_POINTS = 100;
  const COMPLETE_LENGTH_BONUS = 30;
  const STREAK_BONUS = 25;
  const STREAK_BONUS_CAP = 100;
  const S_TIME_BONUS_PER_SECOND = 5;
  const ROUND_CLEAR_BONUS = 300;

  // [min factor length, max factor length, how many to pick]
  const BANDS = {
    C: [[2, 2, 4], [3, 3, 4], [4, 99, 4]],
    B: [[2, 2, 3], [3, 3, 4], [4, 4, 3], [5, 99, 2]],
    A: [[2, 2, 3], [3, 3, 4], [4, 4, 3], [5, 99, 2]],
    S: [[2, 2, 3], [3, 3, 4], [4, 4, 3], [5, 99, 2]]
  };

  const BURST_COLORS = ["#ffe066", "#ff9f1c", "#ef476f", "#2ec4b6", "#52d68b", "#ffffff"];
  const CELEBRATIONS = [
    "Payload away!",
    "Perfect factorization!",
    "The rocket roars!",
    "Fuel tanks full!",
    "Blast off!",
    "Prime work!",
    "To the stars!"
  ];
  const GUIDED_WRONG = [
    "That prime doesn't divide the remaining number. Try another!",
    "No divide! Pick a prime that splits the amber number.",
    "Not a factor — watch the remaining number and try again.",
    "That one bounces off. Which prime divides it evenly?"
  ];

  // ------------------------------------------------------------------ DOM --
  const stageEl = document.getElementById("stage");
  const effectsEl = document.getElementById("effects");
  const messageEl = document.getElementById("message");
  const timerEl = document.getElementById("timer");
  const timerFillEl = document.getElementById("timer-fill");
  const timerTextEl = document.getElementById("timer-text");
  const rankValueEl = document.getElementById("rank-value");
  const roundValueEl = document.getElementById("round-value");
  const payloadCountEl = document.getElementById("payload-count");
  const strikesChipEl = document.getElementById("strikes-chip");
  const strikesValueEl = document.getElementById("strikes-value");
  const scoreValueEl = document.getElementById("score-value");
  const scoreChipEl = document.getElementById("score-chip");
  const fuelGaugeEl = document.getElementById("fuel-gauge");
  const rocketHolderEl = document.getElementById("rocket-holder");
  const payloadMeterEl = document.getElementById("payload-meter");
  const payloadCardEl = document.getElementById("payload-card");
  const payloadValueEl = document.getElementById("payload-value");
  const payloadRemainingEl = document.getElementById("payload-remaining");
  const payloadRemainingValueEl = document.getElementById("payload-remaining-value");
  const treeAreaEl = document.getElementById("tree-area");
  const treeEdgesEl = document.getElementById("tree-edges");
  const trayAreaEl = document.getElementById("tray-area");
  const trayChipsEl = document.getElementById("tray-chips");
  const clearBtnEl = document.getElementById("clear-btn");
  const submitBtnEl = document.getElementById("submit-btn");
  const primePadEl = document.getElementById("prime-pad");
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

  if (!stageEl || !overlayActionEl || !primePadEl || !rocketHolderEl) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let overlayMode = "start";
  let messageTimer = 0;
  const roundTimers = new Set();

  const state = {
    phase: "intro", // intro | loading | playing | resolving | roundComplete | failed
    rank: "C",
    roundsAtRank: 0,
    payloadIndex: 0,
    failures: 0,
    streak: 0,
    roundScore: 0,
    sessionScore: 0,
    round: [],      // 12 composites for this round
    current: 0,     // composite being factored
    remaining: 0,   // guided ranks: unfactored remainder
    factorCount: 0, // omega(current) — known tree depth from the start
    factors: [],    // accepted primes for the current payload, in click order
    collection: [], // free ranks: primes picked for the current payload
    launchLog: [],  // { value, factors, failed } per payload this round
    roundStartedAt: 0
  };

  let gaugeSegmentEls = [];
  const pipEls = [];

  // -------------------------------------------------------- number theory --
  const MAX_COMPOSITE = 140;
  const spf = new Int32Array(MAX_COMPOSITE + 1);
  for (let i = 2; i <= MAX_COMPOSITE; i += 1) {
    if (spf[i]) continue;
    for (let j = i; j <= MAX_COMPOSITE; j += i) {
      if (!spf[j]) spf[j] = i;
    }
  }

  function isPrime(n) {
    return n >= 2 && n <= MAX_COMPOSITE && spf[n] === n;
  }

  function factorize(n) {
    const out = [];
    let v = n;
    while (v > 1) {
      const p = spf[v];
      out.push(p);
      v /= p;
    }
    return out;
  }

  function isPurePower(n) {
    const factors = factorize(n);
    return factors.every((p) => p === factors[0]);
  }

  function productOf(list) {
    return list.reduce((acc, p) => acc * p, 1);
  }

  const ALL_PRIMES = [];
  for (let n = 2; n <= 67; n += 1) {
    if (isPrime(n)) ALL_PRIMES.push(n);
  }

  // -------------------------------------------------------------- helpers --
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function formatScore(value) {
    if (window.MathArcade && typeof MathArcade.formatScore === "function") {
      return MathArcade.formatScore(value);
    }
    return Number(value || 0).toLocaleString();
  }

  function queueTask(callback, delay) {
    const effectiveDelay = reducedMotion ? Math.min(delay, 90) : delay;
    const id = window.setTimeout(() => {
      roundTimers.delete(id);
      callback();
    }, effectiveDelay);
    roundTimers.add(id);
    return id;
  }

  function clearTasks() {
    roundTimers.forEach((id) => window.clearTimeout(id));
    roundTimers.clear();
  }

  function nextRank(rank) {
    const i = RANKS.indexOf(rank);
    return RANKS[Math.min(RANKS.length - 1, i + 1)];
  }

  function isGuided() {
    return state.rank === "C" || state.rank === "B";
  }

  function stageRect() {
    return stageEl.getBoundingClientRect();
  }

  function shakeEl(el) {
    if (!el) return;
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    queueTask(() => el.classList.remove("shake"), 460);
  }

  // --------------------------------------------------- round generation ---
  function buildRoundComposites(rank) {
    const max = RANK_MAX_COMPOSITE[rank];
    const byLength = new Map();
    for (let n = 4; n <= max; n += 1) {
      if (isPrime(n)) continue;
      const len = factorize(n).length;
      if (!byLength.has(len)) byLength.set(len, []);
      byLength.get(len).push(n);
    }

    const picked = [];
    for (const [lo, hi, count] of BANDS[rank]) {
      const pool = [];
      for (let len = lo; len <= Math.min(hi, 10); len += 1) {
        const list = byLength.get(len);
        if (list) pool.push(...list);
      }
      shuffle(pool);

      // Pure prime powers (16, 32, 64…) are allowed but capped at one per band.
      let pureUsed = 0;
      let taken = 0;
      for (const n of pool) {
        if (taken >= count) break;
        if (picked.includes(n)) continue;
        const pure = isPurePower(n);
        if (pure && pureUsed >= 1) continue;
        if (pure) pureUsed += 1;
        picked.push(n);
        taken += 1;
      }
      // Safety net if a band ever comes up short without relaxing the cap.
      if (taken < count) {
        for (const n of pool) {
          if (taken >= count) break;
          if (picked.includes(n)) continue;
          picked.push(n);
          taken += 1;
        }
      }
    }
    return shuffle(picked);
  }

  // -------------------------------------------------------- HUD & message --
  function updateHud(animateScore) {
    rankValueEl.textContent = state.rank;
    rankValueEl.className = "hud-value rank-" + state.rank;
    roundValueEl.textContent = `${Math.min(state.roundsAtRank + 1, ROUNDS_TO_PROMOTE)} / ${ROUNDS_TO_PROMOTE}`;
    payloadCountEl.textContent = `${Math.min(state.payloadIndex + 1, PAYLOADS_PER_ROUND)} / ${PAYLOADS_PER_ROUND}`;
    scoreValueEl.textContent = formatScore(state.sessionScore);
    strikesChipEl.hidden = state.rank !== "S";
    strikesValueEl.textContent = `${state.failures} / ${S_MAX_FAILURES}`;

    if (animateScore) {
      scoreChipEl.classList.remove("score-bump");
      void scoreChipEl.offsetWidth;
      scoreChipEl.classList.add("score-bump");
    }
  }

  function announce(text, celebrate, duration) {
    window.clearTimeout(messageTimer);
    messageEl.textContent = text;
    messageEl.className = `message show${celebrate ? " celebrate" : ""}`;
    messageTimer = window.setTimeout(() => {
      messageEl.classList.remove("show");
    }, reducedMotion ? 900 : (duration || 1800));
  }

  function hideMessage() {
    window.clearTimeout(messageTimer);
    messageEl.className = "message";
    messageEl.textContent = "";
  }

  // --------------------------------------------------------- payload meter --
  function buildPayloadMeter() {
    payloadMeterEl.replaceChildren();
    pipEls.length = 0;
    for (let i = 0; i < PAYLOADS_PER_ROUND; i += 1) {
      const pip = document.createElement("span");
      pip.className = "pip";
      pip.textContent = "🚀";
      payloadMeterEl.append(pip);
      pipEls.push(pip);
    }
  }

  function updatePayloadMeter() {
    pipEls.forEach((pip, i) => {
      const entry = state.launchLog[i];
      const done = Boolean(entry) && !entry.failed;
      const failed = Boolean(entry) && entry.failed;
      pip.classList.toggle("done", done);
      pip.classList.toggle("failed", failed);
      pip.textContent = failed ? "💥" : "🚀";
      if (entry && i === state.launchLog.length - 1) {
        pip.classList.remove("pop");
        void pip.offsetWidth;
        pip.classList.add("pop");
      }
    });
  }

  // ------------------------------------------------------------ fuel gauge --
  function buildGauge(segments) {
    fuelGaugeEl.replaceChildren();
    gaugeSegmentEls = [];
    for (let i = 0; i < segments; i += 1) {
      const seg = document.createElement("span");
      seg.className = "fuel-segment";
      fuelGaugeEl.append(seg);
      gaugeSegmentEls.push(seg);
    }
  }

  function fillSegment(index) {
    const seg = gaugeSegmentEls[index];
    if (!seg || seg.classList.contains("filled")) return;
    seg.classList.add("filled", "pop");
    playFuelBlip(index);
  }

  // ------------------------------------------------------------ factor tree --
  function renderTree(popNew) {
    treeAreaEl.querySelectorAll(".tree-node").forEach((el) => el.remove());
    treeEdgesEl.replaceChildren();
    if (!state.current) return;

    // Depth is known from the start: N prime factors ⇒ N stem rows, N−1 leaf slots.
    const levelCount = state.factorCount || factorize(state.current).length;
    const chain = [state.current];
    let rest = state.current;
    for (const p of state.factors) {
      rest /= p;
      chain.push(rest);
    }
    const filledStemCount = rest > 1 ? chain.length : Math.max(1, chain.length - 1);
    const filledLeafCount = rest > 1
      ? state.factors.length
      : Math.min(state.factors.length, Math.max(0, levelCount - 1));
    const yFor = (row) => (levelCount <= 1 ? 12 : 9 + (row * 82) / (levelCount - 1));
    const leafX = (splitIndex) => (splitIndex % 2 === 0 ? 33 : 67);
    const newestRow = filledStemCount - 1;

    for (let row = 1; row < levelCount; row += 1) {
      const leaf = document.createElementNS(SVG_NS, "line");
      leaf.setAttribute("x1", "50%");
      leaf.setAttribute("y1", `${yFor(row - 1)}%`);
      leaf.setAttribute("x2", `${leafX(row - 1)}%`);
      leaf.setAttribute("y2", `${yFor(row)}%`);
      if (row > filledLeafCount) leaf.classList.add("pending");
      treeEdgesEl.append(leaf);

      const stem = document.createElementNS(SVG_NS, "line");
      stem.setAttribute("x1", "50%");
      stem.setAttribute("y1", `${yFor(row - 1)}%`);
      stem.setAttribute("x2", "50%");
      stem.setAttribute("y2", `${yFor(row)}%`);
      if (row >= filledStemCount) stem.classList.add("pending");
      treeEdgesEl.append(stem);
    }

    const addNode = (value, row, xPercent, classes) => {
      const node = document.createElement("span");
      node.className = `tree-node ${classes}`;
      if (value != null) node.textContent = String(value);
      node.style.left = `${xPercent}%`;
      node.style.top = `${yFor(row)}%`;
      treeAreaEl.append(node);
      return node;
    };

    for (let row = 0; row < levelCount; row += 1) {
      if (row < filledStemCount) {
        const value = chain[row];
        const isCurrentRemaining = row === newestRow && rest > 1;
        const prime = isPrime(value);
        let classes = prime ? "prime" : "comp";
        if (row === 0) classes += " root";
        if (isCurrentRemaining) classes += prime ? " prime-soon" : " current";
        if (popNew && row === newestRow) classes += " pop";
        addNode(value, row, 50, classes);
      } else {
        addNode(null, row, 50, "ghost");
      }

      if (row > 0) {
        const leafIndex = row - 1;
        if (leafIndex < filledLeafCount) {
          const leafClasses = "prime" + (popNew && row === newestRow ? " pop" : "");
          addNode(state.factors[leafIndex], row, leafX(leafIndex), leafClasses);
        } else {
          addNode(null, row, leafX(leafIndex), "ghost");
        }
      }
    }
  }

  function updateRemainingReadout() {
    if (!isGuided() || !state.current || state.remaining <= 1) {
      payloadRemainingEl.hidden = true;
      payloadRemainingValueEl.textContent = "";
      return;
    }
    payloadRemainingEl.hidden = false;
    payloadRemainingValueEl.textContent = String(state.remaining);
    payloadRemainingEl.childNodes[0].textContent = isPrime(state.remaining)
      ? "Prime left: "
      : "Left: ";
  }

  // -------------------------------------------------------------- free tray --
  function renderTray(popLast) {
    trayChipsEl.replaceChildren();
    trayChipsEl.classList.toggle("empty", state.collection.length === 0);
    state.collection.forEach((p, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tray-chip" + (popLast && index === state.collection.length - 1 ? " pop" : "");
      chip.textContent = String(p);
      chip.setAttribute("aria-label", `Remove prime ${p} from the fuel mix`);
      chip.addEventListener("click", () => removeFromCollection(index));
      trayChipsEl.append(chip);
    });
    submitBtnEl.disabled = state.collection.length === 0 || state.phase !== "playing";
  }

  function addToCollection(p) {
    state.collection.push(p);
    playSelect();
    renderTray(true);
  }

  function removeFromCollection(index) {
    if (state.phase !== "playing") return;
    state.collection.splice(index, 1);
    playSelect();
    renderTray(false);
  }

  function clearCollection() {
    if (state.phase !== "playing" || !state.collection.length) return;
    state.collection = [];
    playSelect();
    renderTray(false);
    announce("Fuel mix cleared. Start again!", false, 1100);
  }

  // ------------------------------------------------------------- prime pad --
  function buildPrimePad() {
    primePadEl.replaceChildren();
    const limit = PRIME_BUTTON_LIMIT[state.rank];
    ALL_PRIMES.filter((p) => p <= limit).forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "prime-btn";
      btn.textContent = String(p);
      btn.setAttribute("aria-label", `Prime ${p}`);
      btn.addEventListener("click", () => onPrimePress(p, btn));
      primePadEl.append(btn);
    });
  }

  function setPadEnabled(enabled) {
    primePadEl.querySelectorAll(".prime-btn").forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  function onPrimePress(p, btn) {
    if (state.phase !== "playing") return;
    ensureAudio();
    if (isGuided()) {
      onGuidedPrime(p, btn);
    } else {
      addToCollection(p);
    }
  }

  // --------------------------------------------------------- guided ranks --
  function onGuidedPrime(p, btn) {
    if (state.remaining % p !== 0) {
      state.streak = 0;
      playWrong();
      shakeEl(btn);
      announce(randomItem(GUIDED_WRONG), false, 1700);
      return;
    }
    acceptGuidedPrime(p);
  }

  function acceptGuidedPrime(p) {
    state.factors.push(p);
    state.remaining /= p;
    fillSegment(state.factors.length - 1);
    state.roundScore += PRIME_POINTS;
    state.sessionScore += PRIME_POINTS;

    if (isPrime(state.remaining)) {
      // The remainder is itself prime: it auto-loads as the final fuel unit.
      state.phase = "resolving";
      setPadEnabled(false);
      renderTree(true);
      updateRemainingReadout();
      updateHud(true);
      const finalPrime = state.remaining;
      queueTask(() => {
        state.factors.push(finalPrime);
        state.remaining = 1;
        state.roundScore += PRIME_POINTS;
        state.sessionScore += PRIME_POINTS;
        fillSegment(state.factors.length - 1);
        playAutoAccept();
        renderTree(true);
        updateRemainingReadout();
        completePayload();
      }, 560);
      return;
    }

    renderTree(true);
    updateRemainingReadout();
    updateHud(true);
  }

  // ----------------------------------------------------------- free ranks --
  function onSubmit() {
    if (state.phase !== "playing" || !state.collection.length) return;
    ensureAudio();
    const product = productOf(state.collection);
    if (product === state.current) {
      resolveSubmitCorrect();
      return;
    }
    if (state.rank === "S") {
      failNumber("wrong");
      return;
    }
    // Rank A: no penalty — keep the chips and report the mismatch.
    playWrong();
    shakeEl(trayChipsEl);
    announce(
      product < state.current
        ? `Those multiply to ${product} — too small for payload ${state.current}. Add or swap primes!`
        : `Those multiply to ${product} — too big for payload ${state.current}. Remove or swap primes!`,
      false,
      2400
    );
  }

  function resolveSubmitCorrect() {
    state.phase = "resolving";
    stopNumberTimer();
    setPadEnabled(false);
    submitBtnEl.disabled = true;
    state.factors = state.collection.slice().sort((a, b) => a - b);
    state.remaining = 1;
    const primePoints = PRIME_POINTS * state.factors.length;
    state.roundScore += primePoints;
    state.sessionScore += primePoints;
    updateHud(true);
    playCorrect(state.streak + 1);
    state.factors.forEach((p, i) => {
      queueTask(() => fillSegment(i), i * 95);
    });
    queueTask(() => completePayload(), state.factors.length * 95 + 240);
  }

  // --------------------------------------------------------- payload flow --
  function presentPayload() {
    state.current = state.round[state.payloadIndex];
    state.remaining = state.current;
    state.factorCount = factorize(state.current).length;
    state.factors = [];
    state.collection = [];
    state.phase = "playing";

    payloadValueEl.textContent = String(state.current);
    payloadCardEl.classList.remove("arrive");
    void payloadCardEl.offsetWidth;
    payloadCardEl.classList.add("arrive");

    buildGauge(state.factorCount);

    if (isGuided()) {
      treeAreaEl.hidden = false;
      trayAreaEl.hidden = true;
      renderTree(false);
    } else {
      treeAreaEl.hidden = true;
      trayAreaEl.hidden = false;
      renderTray(false);
    }

    updateRemainingReadout();
    updateHud(false);
    setPadEnabled(true);
    arriveRocket();

    if (state.rank === "S") {
      startNumberTimer();
    }

    if (state.payloadIndex > 0) {
      announce(
        isGuided()
          ? `Break ${state.current} into prime fuel!`
          : `Which primes multiply to ${state.current}? Load them, then submit!`,
        false,
        1800
      );
    }
  }

  function completePayload() {
    state.phase = "resolving";
    stopNumberTimer();
    state.streak += 1;
    const length = state.factors.length;
    const streakBonus = Math.min((state.streak - 1) * STREAK_BONUS, STREAK_BONUS_CAP);
    const timeBonus = state.rank === "S" ? numberSecondsLeft() * S_TIME_BONUS_PER_SECOND : 0;
    const points = COMPLETE_BASE_POINTS + COMPLETE_LENGTH_BONUS * Math.max(0, length - 2) + streakBonus + timeBonus;
    state.roundScore += points;
    state.sessionScore += points;
    state.launchLog.push({ value: state.current, factors: state.factors.slice(), failed: false });

    updateHud(true);
    updatePayloadMeter();
    hideMessage();
    showFactBanner(`${state.current} = ${state.factors.join(" × ")}`, false);
    launchRocketFx();
    playLaunch();
    spawnSolveEffects(points);
    announce(randomItem(CELEBRATIONS), true, 1500);

    queueTask(() => advancePayload(), 1500);
  }

  function failNumber(reason) {
    if (state.phase !== "playing") return;
    state.phase = "resolving";
    stopNumberTimer();
    setPadEnabled(false);
    submitBtnEl.disabled = true;
    state.failures += 1;
    state.streak = 0;
    const factors = factorize(state.current);
    state.launchLog.push({ value: state.current, factors, failed: true });

    updateHud(false);
    updatePayloadMeter();
    sputterRocketFx();
    playWrong();
    showFactBanner(
      reason === "time"
        ? `Out of time! ${state.current} = ${factors.join(" × ")}`
        : `${state.current} = ${factors.join(" × ")}`,
      true
    );

    if (state.failures >= S_MAX_FAILURES) {
      announce("Three strikes — mission scrubbed!", false, 1800);
      queueTask(() => failRound(), 1800);
    } else {
      announce(
        reason === "time"
          ? `Out of time! Strike ${state.failures} of ${S_MAX_FAILURES}.`
          : `Not quite — strike ${state.failures} of ${S_MAX_FAILURES}.`,
        false,
        1900
      );
      queueTask(() => advancePayload(), 2000);
    }
  }

  function advancePayload() {
    state.payloadIndex += 1;
    if (state.payloadIndex >= PAYLOADS_PER_ROUND) {
      finishRound();
      return;
    }
    presentPayload();
  }

  // ------------------------------------------------------------ rocket fx --
  function launchRocketFx() {
    if (reducedMotion) {
      rocketHolderEl.classList.remove("launching", "arriving", "sputter");
      return;
    }
    rocketHolderEl.classList.remove("arriving", "sputter");
    rocketHolderEl.classList.add("launching");
    stageEl.classList.remove("rumble");
    void stageEl.offsetWidth;
    stageEl.classList.add("rumble");
    queueTask(() => stageEl.classList.remove("rumble"), 660);
    spawnLaunchParticles();
  }

  function arriveRocket() {
    rocketHolderEl.classList.remove("launching", "sputter");
    if (reducedMotion) {
      rocketHolderEl.classList.remove("arriving");
      return;
    }
    rocketHolderEl.classList.remove("arriving");
    void rocketHolderEl.offsetWidth;
    rocketHolderEl.classList.add("arriving");
    queueTask(() => rocketHolderEl.classList.remove("arriving"), 780);
  }

  function sputterRocketFx() {
    if (reducedMotion) return;
    rocketHolderEl.classList.remove("launching", "arriving");
    rocketHolderEl.classList.remove("sputter");
    void rocketHolderEl.offsetWidth;
    rocketHolderEl.classList.add("sputter");
    queueTask(() => rocketHolderEl.classList.remove("sputter"), 560);
  }

  function showFactBanner(text, failed) {
    const banner = document.createElement("span");
    banner.className = "fact-banner" + (failed ? " failed" : "");
    banner.textContent = text;
    effectsEl.append(banner);
    banner.addEventListener("animationend", () => banner.remove(), { once: true });
  }

  // ------------------------------------------------------------- juice fx --
  function spawnParticle(x, y, color, index, options = {}) {
    const particle = document.createElement("span");
    const angle = options.straightDown
      ? Math.PI / 2 + (Math.random() - 0.5) * 0.9
      : Math.random() * Math.PI * 2;
    const distance = randInt(options.minDist || 42, options.maxDist || 118);
    particle.className = "fx-particle";
    particle.style.setProperty("--x", `${x}px`);
    particle.style.setProperty("--y", `${y}px`);
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--rotation", `${randInt(-240, 240)}deg`);
    particle.style.setProperty("--size", `${randInt(6, 15)}px`);
    particle.style.setProperty("--radius", index % 3 === 0 ? "2px" : "50%");
    particle.style.setProperty("--color", color);
    particle.style.setProperty("--delay", `${randInt(0, 90)}ms`);
    particle.style.setProperty("--duration", `${randInt(560, 860)}ms`);
    particle.addEventListener("animationend", () => particle.remove(), { once: true });
    effectsEl.append(particle);
  }

  function spawnSolveEffects(points) {
    const rect = stageRect();
    const cardRect = payloadCardEl.getBoundingClientRect();
    const x = cardRect.left - rect.left + cardRect.width / 2;
    const y = cardRect.top - rect.top + cardRect.height / 2;

    if (!reducedMotion) {
      for (let i = 0; i < 20; i += 1) {
        spawnParticle(x, y, BURST_COLORS[i % BURST_COLORS.length], i);
      }
      stageEl.style.setProperty("--flash-x", `${(x / rect.width) * 100}%`);
      stageEl.style.setProperty("--flash-y", `${(y / rect.height) * 100}%`);
      stageEl.classList.remove("solve-flash");
      void stageEl.offsetWidth;
      stageEl.classList.add("solve-flash");
    }

    const scorePop = document.createElement("span");
    scorePop.className = "score-pop";
    scorePop.textContent = `+${points}`;
    scorePop.style.setProperty("--x", `${x}px`);
    scorePop.style.setProperty("--y", `${y - cardRect.height * 0.3}px`);
    scorePop.addEventListener("animationend", () => scorePop.remove(), { once: true });
    effectsEl.append(scorePop);
  }

  function spawnLaunchParticles() {
    if (reducedMotion) return;
    const rect = stageRect();
    const rocketRect = rocketHolderEl.getBoundingClientRect();
    const x = rocketRect.left - rect.left + rocketRect.width / 2;
    const y = rocketRect.top - rect.top + rocketRect.height * 0.92;
    for (let i = 0; i < 26; i += 1) {
      spawnParticle(x, y, BURST_COLORS[i % BURST_COLORS.length], i, {
        straightDown: true,
        minDist: 30,
        maxDist: 130
      });
    }
  }

  function celebrateRound(label) {
    if (reducedMotion) return;
    for (let index = 0; index < 76; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.setProperty("--left", `${Math.random() * 100}%`);
      piece.style.setProperty("--width", `${randInt(6, 12)}px`);
      piece.style.setProperty("--height", `${randInt(9, 22)}px`);
      piece.style.setProperty("--color", BURST_COLORS[index % BURST_COLORS.length]);
      piece.style.setProperty("--delay", `${randInt(0, 650)}ms`);
      piece.style.setProperty("--fall-time", `${randInt(1700, 3000)}ms`);
      piece.style.setProperty("--drift", `${randInt(-120, 120)}px`);
      piece.style.setProperty("--start-rotation", `${randInt(0, 180)}deg`);
      piece.style.setProperty("--end-rotation", `${randInt(360, 1080)}deg`);
      piece.addEventListener("animationend", () => piece.remove(), { once: true });
      effectsEl.append(piece);
    }

    if (!label) return;
    const ribbon = document.createElement("span");
    ribbon.className = "round-ribbon";
    ribbon.textContent = label;
    ribbon.addEventListener("animationend", () => ribbon.remove(), { once: true });
    effectsEl.append(ribbon);
  }

  function clearEffects() {
    effectsEl.replaceChildren();
    stageEl.classList.remove("solve-flash", "shake", "rumble");
  }

  // --------------------------------------------------------- S-rank timer --
  let numTimerId = 0;
  let numTimerDeadline = 0;
  let numTimerPausedRemaining = -1;
  let lastTickSecond = -1;

  function startNumberTimer() {
    stopNumberTimer();
    timerEl.hidden = false;
    timerEl.classList.remove("urgent");
    numTimerDeadline = performance.now() + S_NUMBER_TIME_MS;
    numTimerPausedRemaining = -1;
    lastTickSecond = -1;
    numTimerId = window.setInterval(updateNumberTimer, 100);
    updateNumberTimer();
  }

  function stopNumberTimer() {
    if (numTimerId) {
      window.clearInterval(numTimerId);
      numTimerId = 0;
    }
  }

  function hideNumberTimer() {
    stopNumberTimer();
    timerEl.hidden = true;
    timerEl.classList.remove("urgent");
  }

  function pauseNumberTimer() {
    if (!numTimerId) return;
    numTimerPausedRemaining = Math.max(0, numTimerDeadline - performance.now());
    stopNumberTimer();
  }

  function resumeNumberTimer() {
    if (numTimerPausedRemaining < 0 || state.rank !== "S") return;
    if (state.phase !== "playing") return;
    numTimerDeadline = performance.now() + numTimerPausedRemaining;
    numTimerPausedRemaining = -1;
    numTimerId = window.setInterval(updateNumberTimer, 100);
  }

  function updateNumberTimer() {
    const remaining = Math.max(0, numTimerDeadline - performance.now());
    const fraction = remaining / S_NUMBER_TIME_MS;
    timerFillEl.style.width = `${fraction * 100}%`;
    const totalSeconds = Math.ceil(remaining / 1000);
    timerTextEl.textContent = String(totalSeconds);

    if (remaining <= 5000) {
      timerEl.classList.add("urgent");
      if (totalSeconds !== lastTickSecond) {
        lastTickSecond = totalSeconds;
        playTick();
      }
    }

    if (remaining <= 0) {
      stopNumberTimer();
      failNumber("time");
    }
  }

  function numberSecondsLeft() {
    if (state.rank !== "S" || !numTimerDeadline) return 0;
    return Math.max(0, Math.ceil((numTimerDeadline - performance.now()) / 1000));
  }

  // ------------------------------------------------------------ round flow --
  function startRound() {
    clearTasks();
    clearEffects();
    hideMessage();

    state.phase = "dealing";
    state.payloadIndex = 0;
    state.failures = 0;
    state.streak = 0;
    state.roundScore = 0;
    state.roundStartedAt = performance.now();
    state.launchLog = [];
    state.round = buildRoundComposites(state.rank);

    rocketHolderEl.classList.remove("launching", "arriving", "sputter");
    buildPayloadMeter();
    updatePayloadMeter();
    buildPrimePad();
    hideOverlay();

    if (state.rank === "S") {
      timerEl.hidden = false;
    } else {
      hideNumberTimer();
    }

    updateHud(false);
    playRoundStart();
    startMusic();
    announce(
      state.rank === "S"
        ? `S rank: ${S_NUMBER_TIME_MS / 1000} seconds per payload — ${S_MAX_FAILURES} strikes scrubs the mission!`
        : isGuided()
          ? "Click primes that divide the amber number. Fuel up and launch!"
          : "Assemble the full prime factorization, then hit Submit!",
      false,
      2300
    );

    queueTask(() => presentPayload(), reducedMotion ? 60 : 420);
  }

  function finishRound() {
    if (state.phase === "roundComplete") return;
    state.phase = "roundComplete";
    hideNumberTimer();
    stopMusic();

    state.roundScore += ROUND_CLEAR_BONUS;
    state.sessionScore += ROUND_CLEAR_BONUS;

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
    playRoundWin();
    if (rankedUp) playRankUp();
    celebrateRound(rankedUp ? `Rank ${state.rank}!` : "Round clear!");

    const snapshot = {
      oldRank,
      rank: state.rank,
      rankedUp,
      roundsAtRank: state.roundsAtRank,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore,
      failures: state.failures,
      seconds: Math.max(1, Math.floor((performance.now() - state.roundStartedAt) / 1000))
    };
    void persistRound(snapshot, true);
    queueTask(() => showRoundComplete(snapshot), 1100);
  }

  function failRound() {
    if (state.phase === "failed") return;
    state.phase = "failed";
    clearTasks();
    hideNumberTimer();
    stopMusic();
    playFail();

    const oldRank = state.rank;
    state.rank = "A";
    state.roundsAtRank = 0;
    updateHud(false);

    const snapshot = {
      oldRank,
      rank: state.rank,
      rankedUp: false,
      failed: true,
      roundsAtRank: 0,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore,
      launched: state.launchLog.filter((e) => !e.failed).length
    };
    void persistRound(snapshot, false);
    queueTask(() => showFailOverlay(snapshot), 1000);
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
      console.warn("Prime Factor Rocket progress could not be saved.", error);
    }
  }

  // -------------------------------------------------------------- overlay --
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

  function launchLogHtml() {
    const rows = state.launchLog
      .map((entry) => {
        const rhs = entry.factors.join(" × ");
        return `<div class="launch-log-row${entry.failed ? " failed" : ""}">` +
          `<span class="ll-value">${entry.value}</span>` +
          `<span class="ll-factors">${entry.failed ? "✗ " : ""}= ${rhs}</span>` +
          `</div>`;
      })
      .join("");
    return `<div class="launch-log" aria-label="Launch log">${rows}</div>`;
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

  function paintStartOverlay() {
    overlayMode = "start";
    overlayKickerEl.textContent = "Prime factorization launchpad";
    overlayTitleEl.textContent = "Prime Factor Rocket!";
    overlayCopyEl.textContent =
      "Every payload is a composite number. Break it into prime factors to fill the fuel tank — when the factorization is complete, the rocket launches! Factor 12 payloads to finish a round.";
    overlayExtraEl.innerHTML = `
      <p>Current rank <span class="rank-badge rank-${state.rank}">${state.rank}</span></p>
      ${roundPipsHtml(state.roundsAtRank)}
      ${rankLegendHtml()}`;
    overlayStatsEl.hidden = true;
    overlayActionEl.textContent = "Start fueling";
    overlayActionEl.disabled = false;
  }

  function showRoundComplete(snapshot) {
    overlayMode = "next";
    overlayKickerEl.textContent = snapshot.rankedUp
      ? "Rank up"
      : `Rank ${state.rank} · round ${snapshot.roundsAtRank} of ${ROUNDS_TO_PROMOTE}`;
    overlayTitleEl.textContent = snapshot.rankedUp ? "Rank Up!" : "All payloads launched!";
    overlayCopyEl.textContent = snapshot.rankedUp
      ? `Outstanding! You cleared ${ROUNDS_TO_PROMOTE} rounds — ${snapshot.oldRank} → ${state.rank}. ${
          state.rank === "B"
            ? "Bigger payloads now, up to 140. Same guided factor tree!"
            : state.rank === "A"
              ? "No more factor tree — assemble the primes yourself and hit Submit!"
              : "The final challenge: 25 seconds per payload. Three strikes scrub the mission!"
        }`
      : state.rank === "S"
        ? "Commander flying! Keep clearing S rounds to hold your rank."
        : `Great flying! Clear ${ROUNDS_TO_PROMOTE - snapshot.roundsAtRank} more round${
            ROUNDS_TO_PROMOTE - snapshot.roundsAtRank === 1 ? "" : "s"
          } to reach rank ${nextRank(state.rank)}.`;
    overlayExtraEl.innerHTML = `
      ${snapshot.rankedUp ? `<div class="rank-up-banner">RANK UP! ${snapshot.oldRank} → ${state.rank}</div>` : ""}
      ${launchLogHtml()}
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
    overlayKickerEl.textContent = "Mission scrubbed";
    overlayTitleEl.textContent = "Three strikes!";
    overlayCopyEl.textContent =
      `You launched ${snapshot.launched} of ${PAYLOADS_PER_ROUND} payloads before the third strike. ` +
      `Back to rank A — clear ${ROUNDS_TO_PROMOTE} rounds there to face the S timer again!`;
    overlayExtraEl.innerHTML = `
      <div class="rank-down-banner">S → A · refuel and return!</div>
      ${launchLogHtml()}
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
    overlayActionEl.textContent = "Fueling up…";
    ensureAudio();
    playButtonSound();

    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        const progress = await MathArcade.loadProgress(GAME_ID);
        applyProgress(progress);
      } catch (error) {
        console.warn("Prime Factor Rocket progress could not be loaded; starting locally.", error);
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

  // ---------------------------------------------------- procedural audio --
  let soundEnabled = readSoundPreference();
  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let nextMusicTime = 0;
  let audioUnavailable = false;
  let noiseBuffer = null;

  // A dreamy space drift: Am — F — C — G.
  const CHORDS = [
    [57, 60, 64, 69],
    [53, 57, 60, 65],
    [48, 52, 55, 60],
    [55, 59, 62, 67]
  ];
  const BASS_NOTES = [33, 29, 24, 31];
  const ARPEGGIO = [0, 2, 1, 3, 2, 1, 0, 2];

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
    } catch (_) {
      // Storage can be unavailable in privacy-restricted contexts.
    }
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
    if (!soundEnabled || audioUnavailable) return null;
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        audioUnavailable = true;
        updateSoundControl();
        return null;
      }
      try {
        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        musicGain = audioContext.createGain();
        sfxGain = audioContext.createGain();
        masterGain.gain.value = 0.82;
        musicGain.gain.value = 0.26;
        sfxGain.gain.value = 0.8;
        musicGain.connect(masterGain);
        sfxGain.connect(masterGain);
        masterGain.connect(audioContext.destination);
      } catch (error) {
        console.warn("Web Audio could not be started.", error);
        audioUnavailable = true;
        updateSoundControl();
        return null;
      }
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {
        // A later user gesture will retry.
      });
    }
    return audioContext;
  }

  function midiToFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function playTone(destination, options) {
    const context = ensureAudio();
    if (!context || !destination) return;
    const start = options.time ?? context.currentTime;
    const duration = options.duration ?? 0.18;
    const attack = options.attack ?? 0.008;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(Math.max(1, options.frequency), start);
    if (options.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, options.endFrequency),
        start + duration
      );
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(options.gain ?? 0.12, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    if (options.filter) {
      const filter = context.createBiquadFilter();
      filter.type = options.filterType || "lowpass";
      filter.frequency.value = options.filter;
      oscillator.connect(filter);
      filter.connect(gain);
    } else {
      oscillator.connect(gain);
    }

    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function musicStepDuration() {
    const bpm = state.rank === "S" ? 118 : 100;
    return 60 / bpm / 4;
  }

  function scheduleMusicStep(step, time) {
    const position = step % 16;
    const bar = Math.floor(step / 16) % CHORDS.length;
    const chord = CHORDS[bar];
    const stepDuration = musicStepDuration();

    if (position % 4 === 0) {
      playTone(musicGain, {
        type: "triangle",
        frequency: midiToFrequency(BASS_NOTES[bar]),
        time,
        duration: 0.34,
        gain: 0.12,
        attack: 0.02,
        filter: 520
      });
    }

    if (position % 2 === 0) {
      const arpeggioNote = chord[ARPEGGIO[(position / 2) % ARPEGGIO.length]] + 12;
      playTone(musicGain, {
        type: "sine",
        frequency: midiToFrequency(arpeggioNote),
        time,
        duration: 0.16,
        gain: 0.055,
        attack: 0.01,
        filter: 2800
      });
    }

    if (position === 0) {
      const barDuration = stepDuration * 15.5;
      [chord[0], chord[1], chord[2]].forEach((note, noteIndex) => {
        playTone(musicGain, {
          type: "sine",
          frequency: midiToFrequency(note),
          time: time + noteIndex * 0.015,
          duration: barDuration,
          gain: 0.024,
          attack: 0.3,
          filter: 1000
        });
      });
    }

    if (position === 10) {
      playTone(musicGain, {
        type: "sine",
        frequency: midiToFrequency(chord[3] + 24),
        time,
        duration: 0.4,
        gain: 0.02,
        attack: 0.05
      });
    }
  }

  function musicScheduler() {
    if (!audioContext || document.hidden) return;
    while (nextMusicTime < audioContext.currentTime + 0.24) {
      scheduleMusicStep(musicStep, nextMusicTime);
      nextMusicTime += musicStepDuration();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!soundEnabled || document.hidden || musicTimer) return;
    const context = ensureAudio();
    if (!context) return;
    musicGain.gain.cancelScheduledValues(context.currentTime);
    musicGain.gain.setTargetAtTime(0.26, context.currentTime, 0.04);
    musicStep = 0;
    nextMusicTime = context.currentTime + 0.06;
    musicTimer = window.setInterval(musicScheduler, 70);
    musicScheduler();
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = 0;
    }
    if (audioContext && musicGain) {
      musicGain.gain.cancelScheduledValues(audioContext.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.04);
    }
  }

  function playSelect() {
    playTone(sfxGain, {
      type: "sine",
      frequency: 520,
      endFrequency: 700,
      duration: 0.06,
      gain: 0.06,
      attack: 0.003
    });
  }

  function playFuelBlip(step) {
    playTone(sfxGain, {
      type: "triangle",
      frequency: 440 * Math.pow(1.12, Math.min(step, 8)),
      endFrequency: 560 * Math.pow(1.12, Math.min(step, 8)),
      duration: 0.1,
      gain: 0.07,
      attack: 0.004,
      filter: 2200
    });
  }

  function playAutoAccept() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [880, 1174.66].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: "sine",
        frequency,
        time: now + index * 0.06,
        duration: 0.18,
        gain: 0.08,
        attack: 0.004
      });
    });
  }

  function playButtonSound() {
    const context = ensureAudio();
    if (!context) return;
    playTone(sfxGain, {
      type: "triangle",
      frequency: 620,
      endFrequency: 830,
      duration: 0.09,
      gain: 0.09
    });
  }

  function playCorrect(streak) {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    const pitchLift = Math.pow(2, Math.min(streak - 1, 8) / 24);
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: index === 2 ? "sine" : "triangle",
        frequency: frequency * pitchLift,
        time: now + index * 0.07,
        duration: 0.24,
        gain: 0.13 - index * 0.015,
        attack: 0.006
      });
    });
  }

  function playWrong() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    playTone(sfxGain, {
      type: "sawtooth",
      frequency: 340,
      endFrequency: 190,
      time: now,
      duration: 0.22,
      gain: 0.07,
      attack: 0.006,
      filter: 900
    });
    playTone(sfxGain, {
      type: "triangle",
      frequency: 160,
      time: now + 0.05,
      duration: 0.18,
      gain: 0.08,
      attack: 0.008
    });
  }

  function playTick() {
    playTone(sfxGain, {
      type: "square",
      frequency: 940,
      duration: 0.035,
      gain: 0.045,
      attack: 0.002,
      filter: 2400
    });
  }

  function getNoiseBuffer(context) {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(context.sampleRate * 1.1);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function playLaunch() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    playTone(sfxGain, {
      type: "sawtooth",
      frequency: 70,
      endFrequency: 230,
      time: now,
      duration: 0.9,
      gain: 0.13,
      attack: 0.06,
      filter: 520
    });

    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer(context);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(3600, now + 0.85);
    filter.Q.value = 1.1;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.17, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    source.start(now);
    source.stop(now + 1.05);
  }

  function playRoundStart() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [392, 523, 659].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: "triangle",
        frequency,
        time: now + index * 0.065,
        duration: 0.16,
        gain: 0.08
      });
    });
  }

  function playRoundWin() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: index < 3 ? "triangle" : "sine",
        frequency,
        time: now + index * 0.105,
        duration: index === 4 ? 0.62 : 0.34,
        gain: index === 4 ? 0.14 : 0.16,
        attack: 0.008
      });
    });
  }

  function playRankUp() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [392, 523, 659, 784, 1046].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: "triangle",
        frequency,
        time: now + index * 0.09,
        duration: 0.28,
        gain: 0.16,
        attack: 0.008
      });
    });
  }

  function playFail() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    [523, 466, 392, 311].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: "triangle",
        frequency,
        time: now + index * 0.16,
        duration: 0.3,
        gain: 0.11,
        attack: 0.01
      });
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
    playButtonSound();
    if (["dealing", "playing", "resolving"].includes(state.phase)) startMusic();
  }

  // --------------------------------------------------- events & bootstrap --
  overlayActionEl.addEventListener("click", () => {
    if (overlayMode === "start") {
      void startSession();
    } else {
      ensureAudio();
      playButtonSound();
      startRound();
    }
  });

  submitBtnEl.addEventListener("click", onSubmit);
  clearBtnEl.addEventListener("click", clearCollection);

  soundToggleEl.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
      pauseNumberTimer();
    } else {
      if (soundEnabled && ["dealing", "playing", "resolving"].includes(state.phase)) startMusic();
      resumeNumberTimer();
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
  buildPayloadMeter();
  buildPrimePad();
  buildGauge(3);
  updateHud(false);

  (async () => {
    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        const progress = await MathArcade.loadProgress(GAME_ID);
        applyProgress(progress);
      } catch (_) { /* start at C */ }
    }
    buildPrimePad();
    updateHud(false);
    paintStartOverlay();
  })();
})();
