(function () {
  "use strict";

  const GAME_ID = "memorymatch";
  const SOUND_KEY = "matharcade_memorymatch_sound";
  const ROUND_CARD_COUNTS = [8, 12, 16, 20, 24];
  const RANKS = ["C", "B", "A", "S"];
  const RANK_FLAVOR = { C: "spark", B: "flicker", A: "flare", S: "nova" };
  const RANK_SCALE = { C: 1, B: 5, A: 8, S: 12 };
  const MATCH_BASE_POINTS = 100;
  const PAIR_HUES = [333, 267, 202, 42, 155, 18, 290, 184, 72, 230, 348, 125];
  const BURST_COLORS = ["#ffd84d", "#ff5ea8", "#7c4dff", "#37d8e6", "#52d68b", "#ff7b6b"];
  const CELEBRATIONS = [
    "Brilliant match!",
    "You found it!",
    "Math magic!",
    "Perfect pair!",
    "Memory power!",
    "Fantastic!",
    "Nice connection!"
  ];

  const stageEl = document.getElementById("stage");
  const boardWrapEl = document.getElementById("board-wrap");
  const boardEl = document.getElementById("board");
  const effectsEl = document.getElementById("effects");
  const messageEl = document.getElementById("message");
  const roundValueEl = document.getElementById("round-value");
  const pairsValueEl = document.getElementById("pairs-value");
  const scoreValueEl = document.getElementById("score-value");
  const scoreChipEl = document.getElementById("score-chip");
  const familyValueEl = document.getElementById("family-value");
  const rankValueEl = document.getElementById("rank-value");
  const overlayExtraEl = document.getElementById("overlay-extra");
  const overlayEl = document.getElementById("overlay");
  const overlayKickerEl = document.getElementById("overlay-kicker");
  const overlayTitleEl = document.getElementById("overlay-title");
  const overlayCopyEl = document.getElementById("overlay-copy");
  const overlayStatsEl = document.getElementById("overlay-stats");
  const roundPointsEl = document.getElementById("round-points");
  const sessionPointsEl = document.getElementById("session-points");
  const overlayActionEl = document.getElementById("overlay-action");
  const soundToggleEl = document.getElementById("sound-toggle");
  const soundIconEl = document.getElementById("sound-icon");
  const soundLabelEl = document.getElementById("sound-label");

  if (!stageEl || !boardEl || !overlayActionEl) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let overlayMode = "start";
  let messageTimer = 0;
  let resizeFrame = 0;
  const roundTimers = new Set();

  const state = {
    phase: "intro",
    round: 1,
    difficulty: 1,
    rank: "C",
    family: "add",
    pairCount: 4,
    matchedPairs: 0,
    attempts: 0,
    sessionScore: 0,
    roundScore: 0,
    cards: [],
    flipped: [],
    columns: 4,
    roundStartedAt: 0
  };

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

  function queueRoundTask(callback, delay) {
    const effectiveDelay = reducedMotion ? Math.min(delay, 90) : delay;
    const id = window.setTimeout(() => {
      roundTimers.delete(id);
      callback();
    }, effectiveDelay);
    roundTimers.add(id);
    return id;
  }

  function clearRoundTasks() {
    roundTimers.forEach((id) => window.clearTimeout(id));
    roundTimers.clear();
  }

  function cardCountForRound(round) {
    return ROUND_CARD_COUNTS[Math.min(Math.max(1, round) - 1, ROUND_CARD_COUNTS.length - 1)];
  }

  function nextRank(r) {
    const i = RANKS.indexOf(r);
    return RANKS[Math.min(RANKS.length - 1, i + 1)];
  }

  function rankLevel() {
    return RANKS.indexOf(state.rank) + 1;
  }

  function rankScale() {
    return RANK_SCALE[state.rank] || 1;
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
    if (!overlayExtraEl) return;
    overlayExtraEl.innerHTML = `
      <p>Current rank <span class="rank-badge rank-${state.rank}">${state.rank}</span></p>
      ${rankLegendHtml()}`;
  }

  function familyLabel(family) {
    return {
      add: "Addition",
      sub: "Subtraction",
      mul: "Multiplication",
      mixed: "Mixed"
    }[family] || "Math";
  }

  function chooseFamily() {
    if (state.rank === "C") return "add";
    if (state.rank === "B") return Math.random() < 0.5 ? "add" : "sub";
    if (state.rank === "A") return Math.random() < 0.5 ? "mul" : "add";
    const roll = Math.random();
    if (roll < 0.5) return "mul";
    if (roll < 0.78) return "sub";
    return "add";
  }

  function makeFact(family) {
    const scale = rankScale();
    if (family === "add") {
      const a = randInt(1, 9 + scale);
      const b = randInt(1, 9 + scale);
      return {
        expression: `${a} + ${b}`,
        answer: String(a + b),
        key: `a:${Math.min(a, b)}+${Math.max(a, b)}`
      };
    }

    if (family === "sub") {
      const a = randInt(5, 12 + scale);
      const b = randInt(1, a);
      return {
        expression: `${a} − ${b}`,
        answer: String(a - b),
        key: `s:${a}-${b}`
      };
    }

    const maxFactor = { C: 5, B: 9, A: 10, S: 12 }[state.rank] || 5;
    const a = randInt(2, maxFactor);
    const b = randInt(2, maxFactor);
    return {
      expression: `${a} × ${b}`,
      answer: String(a * b),
      key: `m:${Math.min(a, b)}x${Math.max(a, b)}`
    };
  }

  function makePairs(pairCount) {
    state.family = chooseFamily();
    const pairCards = [];
    const usedExpressions = new Set();
    const usedAnswers = new Set();
    let attempts = 0;

    while (pairCards.length / 2 < pairCount && attempts < 5000) {
      attempts += 1;
      const fact = makeFact(state.family);
      if (usedExpressions.has(fact.key) || usedAnswers.has(fact.answer)) continue;

      usedExpressions.add(fact.key);
      usedAnswers.add(fact.answer);
      const pairIndex = pairCards.length / 2;
      const pairId = `r${state.round}-p${pairIndex}`;
      const hue = PAIR_HUES[pairIndex % PAIR_HUES.length];
      pairCards.push(
        {
          id: `${pairId}-problem`,
          text: fact.expression,
          pairId,
          pairIndex,
          hue,
          kind: "problem",
          matched: false
        },
        {
          id: `${pairId}-answer`,
          text: fact.answer,
          pairId,
          pairIndex,
          hue,
          kind: "answer",
          matched: false
        }
      );
    }

    // This is only a safety net for unusually collision-heavy random deals.
    let fallback = 0;
    while (pairCards.length / 2 < pairCount) {
      fallback += 1;
      let a = 12 + rankScale() + fallback;
      const b = 1 + (fallback % 8);
      while (usedAnswers.has(String(a + b))) a += 1;
      const answer = String(a + b);
      usedAnswers.add(answer);
      const pairIndex = pairCards.length / 2;
      const pairId = `r${state.round}-p${pairIndex}`;
      const hue = PAIR_HUES[pairIndex % PAIR_HUES.length];
      pairCards.push(
        {
          id: `${pairId}-problem`,
          text: `${a} + ${b}`,
          pairId,
          pairIndex,
          hue,
          kind: "problem",
          matched: false
        },
        {
          id: `${pairId}-answer`,
          text: answer,
          pairId,
          pairIndex,
          hue,
          kind: "answer",
          matched: false
        }
      );
      state.family = "mixed";
    }

    familyValueEl.textContent = familyLabel(state.family);
    return shuffle(pairCards);
  }

  function hiddenCardLabel(index) {
    return `Card ${index + 1} of ${state.cards.length}, hidden`;
  }

  function revealedCardLabel(index) {
    const card = state.cards[index];
    return `Card ${index + 1}, ${card.kind}: ${card.text}`;
  }

  function matchedCardLabel(index) {
    const card = state.cards[index];
    return `Matched ${card.kind}: ${card.text}`;
  }

  function updateHud(animateScore) {
    roundValueEl.textContent = String(state.round);
    pairsValueEl.textContent = `${state.matchedPairs} / ${state.pairCount}`;
    scoreValueEl.textContent = formatScore(state.sessionScore);
    familyValueEl.textContent = familyLabel(state.family);
    if (rankValueEl) {
      rankValueEl.textContent = state.rank;
      rankValueEl.className = "hud-value rank-" + state.rank;
    }

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
    }, reducedMotion ? 850 : (duration || 1650));
  }

  function hideMessage() {
    window.clearTimeout(messageTimer);
    messageEl.className = "message";
    messageEl.textContent = "";
  }

  function requestGridLayout() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(layoutGrid);
  }

  function layoutGrid() {
    const total = state.cards.length || cardCountForRound(state.round);
    if (!total) return;

    const wrapStyle = window.getComputedStyle(boardWrapEl);
    const horizontalPadding = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight);
    const verticalPadding = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom);
    const availableWidth = Math.max(120, boardWrapEl.clientWidth - horizontalPadding);
    const availableHeight = Math.max(120, boardWrapEl.clientHeight - verticalPadding);
    const gap = Math.round(clamp(Math.min(availableWidth, availableHeight) * 0.016, 5, 16));
    const stageRatio = availableWidth / availableHeight;
    let best = null;

    for (let columns = 1; columns <= total; columns += 1) {
      if (total % columns !== 0) continue;
      const rows = total / columns;
      const widthPerCard = (availableWidth - gap * (columns - 1)) / columns;
      const heightPerCard = (availableHeight - gap * (rows - 1)) / rows;
      const size = Math.floor(Math.min(widthPerCard, heightPerCard));
      const shapeDifference = Math.abs(Math.log((columns / rows) / stageRatio));
      const score = size * (1 - Math.min(0.1, shapeDifference * 0.025));
      if (!best || score > best.score) best = { columns, rows, size, score };
    }

    if (!best) return;
    state.columns = best.columns;
    document.documentElement.style.setProperty("--card-size", `${Math.max(34, best.size)}px`);
    document.documentElement.style.setProperty("--grid-gap", `${gap}px`);
    boardEl.style.setProperty("--cols", String(best.columns));
    boardEl.style.setProperty("--rows", String(best.rows));
  }

  function renderCards() {
    const fragment = document.createDocumentFragment();

    state.cards.forEach((card, index) => {
      const button = document.createElement("button");
      const inner = document.createElement("span");
      const back = document.createElement("span");
      const mark = document.createElement("span");
      const sparkle = document.createElement("span");
      const front = document.createElement("span");
      const kind = document.createElement("span");
      const value = document.createElement("span");

      button.className = "card";
      button.type = "button";
      button.dataset.index = String(index);
      button.setAttribute("aria-label", hiddenCardLabel(index));
      button.style.setProperty("--pair-hue", String(card.hue));
      button.style.setProperty("--deal-delay", `${reducedMotion ? 0 : Math.min(index * 34, 430)}ms`);
      button.style.setProperty("--deal-tilt", `${randInt(-7, 7)}deg`);
      button.style.setProperty("--hover-tilt", `${randInt(-2, 2)}deg`);

      inner.className = "card-inner";
      back.className = "card-face card-back";
      back.setAttribute("aria-hidden", "false");
      mark.className = "card-mark";
      mark.textContent = "?";
      sparkle.className = "card-spark";
      sparkle.textContent = "✦";
      back.append(mark, sparkle);

      front.className = "card-face card-front";
      front.setAttribute("aria-hidden", "true");
      kind.className = "card-kind";
      kind.textContent = card.kind;
      value.className = "card-value";
      value.textContent = card.text;
      front.append(kind, value);
      inner.append(back, front);
      button.append(inner);

      button.addEventListener("click", () => flipCard(index));
      button.addEventListener("keydown", handleCardKeydown);
      fragment.append(button);
    });

    boardEl.replaceChildren(fragment);
    boardEl.setAttribute(
      "aria-label",
      `Round ${state.round} memory board with ${state.pairCount} pairs`
    );
    requestGridLayout();
  }

  function cardElement(index) {
    return boardEl.children[index] || null;
  }

  function focusFirstAvailableCard() {
    const first = state.cards.findIndex((card) => !card.matched);
    if (first >= 0) {
      const element = cardElement(first);
      if (element) element.focus({ preventScroll: true });
    }
  }

  function handleCardKeydown(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const indices = state.cards
        .map((card, cardIndex) => ({ card, cardIndex }))
        .filter((entry) => !entry.card.matched);
      const target = event.key === "Home" ? indices[0] : indices[indices.length - 1];
      if (target) cardElement(target.cardIndex)?.focus({ preventScroll: true });
      return;
    }

    const directions = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0]
    };
    const direction = directions[event.key];
    if (!direction) return;

    event.preventDefault();
    const rows = state.cards.length / state.columns;
    let row = Math.floor(index / state.columns);
    let column = index % state.columns;

    while (true) {
      row += direction[0];
      column += direction[1];
      if (row < 0 || row >= rows || column < 0 || column >= state.columns) return;
      const nextIndex = row * state.columns + column;
      if (!state.cards[nextIndex].matched) {
        cardElement(nextIndex)?.focus({ preventScroll: true });
        return;
      }
    }
  }

  function clearEffects() {
    effectsEl.replaceChildren();
    stageEl.classList.remove("match-flash");
    boardEl.classList.remove("celebrating");
  }

  function spawnParticle(x, y, color, index) {
    const particle = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = randInt(42, 118);
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

  function spawnMatchEffects(indices, points) {
    if (reducedMotion) return;
    const stageRect = stageEl.getBoundingClientRect();
    const centers = [];

    indices.forEach((index) => {
      const element = cardElement(index);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const x = rect.left - stageRect.left + rect.width / 2;
      const y = rect.top - stageRect.top + rect.height / 2;
      centers.push({ x, y });
      for (let particleIndex = 0; particleIndex < 18; particleIndex += 1) {
        spawnParticle(x, y, BURST_COLORS[particleIndex % BURST_COLORS.length], particleIndex);
      }
    });

    if (centers.length === 2) {
      const x = (centers[0].x + centers[1].x) / 2;
      const y = (centers[0].y + centers[1].y) / 2;
      const scorePop = document.createElement("span");
      scorePop.className = "score-pop";
      scorePop.textContent = `+${points}`;
      scorePop.style.setProperty("--x", `${x}px`);
      scorePop.style.setProperty("--y", `${y}px`);
      scorePop.addEventListener("animationend", () => scorePop.remove(), { once: true });
      effectsEl.append(scorePop);

      stageEl.style.setProperty("--flash-x", `${(x / stageRect.width) * 100}%`);
      stageEl.style.setProperty("--flash-y", `${(y / stageRect.height) * 100}%`);
      stageEl.classList.remove("match-flash");
      void stageEl.offsetWidth;
      stageEl.classList.add("match-flash");
    }
  }

  function celebrateRound() {
    boardEl.classList.add("celebrating");
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

    const ribbon = document.createElement("span");
    ribbon.className = "round-ribbon";
    ribbon.textContent = `Round ${state.round} cleared!`;
    ribbon.addEventListener("animationend", () => ribbon.remove(), { once: true });
    effectsEl.append(ribbon);
  }

  function showOverlay() {
    overlayEl.classList.remove("hidden");
    overlayEl.setAttribute("aria-hidden", "false");
    queueRoundTask(() => overlayActionEl.focus({ preventScroll: true }), 180);
  }

  function hideOverlay() {
    overlayEl.classList.add("hidden");
    overlayEl.setAttribute("aria-hidden", "true");
  }

  function matchPointsForRound() {
    return MATCH_BASE_POINTS + Math.min(state.round - 1, ROUND_CARD_COUNTS.length - 1) * 10;
  }

  function roundClearBonus() {
    return 200 + state.pairCount * 25;
  }

  function setCardFaceVisibility(element, revealed) {
    const back = element.querySelector(".card-back");
    const front = element.querySelector(".card-front");
    if (back) back.setAttribute("aria-hidden", revealed ? "true" : "false");
    if (front) front.setAttribute("aria-hidden", revealed ? "false" : "true");
  }

  function flipCard(index) {
    if (state.phase !== "playing" || state.flipped.length >= 2) return;
    const card = state.cards[index];
    const element = cardElement(index);
    if (!card || !element || card.matched || element.classList.contains("flipped")) return;

    element.classList.add("flipped");
    setCardFaceVisibility(element, true);
    element.setAttribute("aria-label", revealedCardLabel(index));
    state.flipped.push(index);
    playFlip();

    if (state.flipped.length < 2) return;

    state.phase = "resolving";
    state.attempts += 1;
    const [firstIndex, secondIndex] = state.flipped;
    const first = state.cards[firstIndex];
    const second = state.cards[secondIndex];

    if (first.pairId === second.pairId) {
      queueRoundTask(resolveMatch, 400);
    } else {
      queueRoundTask(resolveMiss, 820);
    }
  }

  function resolveMatch() {
    const indices = state.flipped.slice();
    if (indices.length !== 2) return;
    const shouldMoveFocus = indices.some((index) => cardElement(index) === document.activeElement);

    indices.forEach((index) => {
      const card = state.cards[index];
      const element = cardElement(index);
      card.matched = true;
      if (element) {
        element.classList.add("matched");
        element.disabled = true;
        element.setAttribute("aria-label", matchedCardLabel(index));
      }
    });

    state.matchedPairs += 1;
    const points = matchPointsForRound();
    state.roundScore += points;
    state.sessionScore += points;
    state.flipped = [];
    updateHud(true);
    playMatch(state.matchedPairs);
    spawnMatchEffects(indices, points);
    announce(randomItem(CELEBRATIONS), true, 1450);

    boardEl.classList.remove("celebrating");
    void boardEl.offsetWidth;
    boardEl.classList.add("celebrating");
    queueRoundTask(() => boardEl.classList.remove("celebrating"), 650);

    if (state.matchedPairs >= state.pairCount) {
      state.phase = "roundComplete";
      queueRoundTask(finishRound, 720);
    } else {
      state.phase = "playing";
      queueRoundTask(() => {
        if (shouldMoveFocus || !document.activeElement || document.activeElement.disabled) {
          focusFirstAvailableCard();
        }
      }, 30);
    }
  }

  function resolveMiss() {
    state.flipped.forEach((index) => {
      const element = cardElement(index);
      if (element) {
        element.classList.remove("flipped");
        element.setAttribute("aria-label", hiddenCardLabel(index));
        setCardFaceVisibility(element, false);
      }
    });
    state.flipped = [];
    state.phase = "playing";
    announce("Keep looking — those cards are ready to try again.", false, 1350);
  }

  function finishRound() {
    if (state.phase !== "roundComplete") return;

    const seconds = Math.max(1, Math.floor((performance.now() - state.roundStartedAt) / 1000));
    const bonus = roundClearBonus();
    state.roundScore += bonus;
    state.sessionScore += bonus;
    const atMaxBoard = state.cards.length === ROUND_CARD_COUNTS[ROUND_CARD_COUNTS.length - 1];
    const oldRank = state.rank;
    let rankedUp = false;
    if (atMaxBoard) {
      const nr = nextRank(state.rank);
      if (nr !== state.rank) {
        state.rank = nr;
        rankedUp = true;
      }
    }
    state.difficulty = rankLevel();
    updateHud(true);
    stopMusic();
    playRoundWin();
    if (rankedUp) playRankUp();
    celebrateRound();
    announce(`Board cleared! +${bonus} celebration bonus!`, true, 1800);

    const snapshot = {
      round: state.round,
      cardCount: state.cards.length,
      pairCount: state.pairCount,
      attempts: state.attempts,
      seconds,
      family: state.family,
      difficulty: state.difficulty,
      rank: state.rank,
      rankedUp,
      oldRank,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore
    };
    void persistCompletedRound(snapshot);
    queueRoundTask(() => showRoundComplete(snapshot), 900);
  }

  function showRoundComplete(snapshot) {
    const nextCardCount = cardCountForRound(state.round + 1);
    const atMaximum = state.cards.length === ROUND_CARD_COUNTS[ROUND_CARD_COUNTS.length - 1];
    overlayMode = "next";
    overlayKickerEl.textContent = snapshot.rankedUp ? "Rank up" : `Round ${state.round} complete`;
    overlayTitleEl.textContent = snapshot.rankedUp ? "Rank Up!" : "Board cleared!";
    overlayCopyEl.textContent = snapshot.rankedUp
      ? `The math grew with you — ${snapshot.oldRank} → ${state.rank}. The board stays at 24 cards.`
      : atMaximum
        ? "You reached 24-card party mode! The board stays big while fresh math keeps coming."
        : `Wonderful work! The next round grows to ${nextCardCount} colorful cards.`;
    if (overlayExtraEl) {
      overlayExtraEl.innerHTML = snapshot.rankedUp
        ? `<div class="rank-up-banner">RANK UP! ${snapshot.oldRank} → ${state.rank}</div>${rankLegendHtml()}`
        : rankLegendHtml();
    }
    roundPointsEl.textContent = `+${formatScore(snapshot.roundScore)}`;
    sessionPointsEl.textContent = formatScore(snapshot.sessionScore);
    overlayStatsEl.hidden = false;
    overlayActionEl.textContent = atMaximum
      ? "Play another 24-card round"
      : `Next round · ${nextCardCount} cards`;
    overlayActionEl.disabled = false;
    showOverlay();
  }

  async function persistCompletedRound(snapshot) {
    if (!window.MathArcade) return;
    try {
      await MathArcade.submitScore(GAME_ID, snapshot.roundScore);
      await MathArcade.saveProgress(GAME_ID, snapshot.difficulty, {
        rank: snapshot.rank,
        round: snapshot.round,
        cardCount: snapshot.cardCount,
        pairCount: snapshot.pairCount,
        attempts: snapshot.attempts,
        seconds: snapshot.seconds,
        family: snapshot.family,
        roundScore: snapshot.roundScore,
        sessionScore: snapshot.sessionScore
      });
    } catch (error) {
      console.warn("Memory Match progress could not be saved.", error);
    }
  }

  function startRound() {
    clearRoundTasks();
    clearEffects();
    hideMessage();

    state.phase = "dealing";
    state.pairCount = cardCountForRound(state.round) / 2;
    state.matchedPairs = 0;
    state.attempts = 0;
    state.roundScore = 0;
    state.flipped = [];
    state.cards = makePairs(state.pairCount);
    state.roundStartedAt = performance.now();

    renderCards();
    updateHud(false);
    hideOverlay();
    playRoundStart();
    startMusic();
    announce(`Round ${state.round}: find all ${state.pairCount} pairs!`, false, 1500);

    const dealTime = reducedMotion ? 80 : Math.min(state.cards.length * 34, 430) + 430;
    queueRoundTask(() => {
      state.phase = "playing";
      focusFirstAvailableCard();
    }, dealTime);
  }

  async function startSession() {
    if (state.phase === "loading") return;
    state.phase = "loading";
    overlayActionEl.disabled = true;
    overlayActionEl.textContent = "Getting ready…";
    overlayCopyEl.textContent = "Warming up the cards and your math soundtrack.";
    ensureAudio();
    playButtonSound();

    let rank = "C";
    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        const progress = await MathArcade.loadProgress(GAME_ID);
        rank = rankFromProgress(progress);
      } catch (error) {
        console.warn("Memory Match progress could not be loaded; starting locally.", error);
      }
    }

    state.round = 1;
    state.rank = RANKS.includes(rank) ? rank : "C";
    state.difficulty = rankLevel();
    state.sessionScore = 0;
    overlayActionEl.disabled = false;
    startRound();
  }

  function nextRound() {
    ensureAudio();
    playButtonSound();
    state.round += 1;
    startRound();
  }

  // Procedural Web Audio ---------------------------------------------------
  let soundEnabled = readSoundPreference();
  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let nextMusicTime = 0;
  let audioUnavailable = false;

  const CHORDS = [
    [60, 64, 67, 72], // C
    [67, 71, 74, 79], // G
    [69, 72, 76, 81], // Am
    [65, 69, 72, 77]  // F
  ];
  const BASS_NOTES = [48, 43, 45, 41];
  const ARPEGGIO = [0, 2, 1, 3, 1, 2, 0, 2];

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
        musicGain.gain.value = 0.28;
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
    const bpm = 108 + Math.min(state.round - 1, 4) * 3;
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
        duration: 0.32,
        gain: 0.14,
        attack: 0.015,
        filter: 700
      });
    }

    if (position % 2 === 0) {
      const arpeggioNote = chord[ARPEGGIO[(position / 2) % ARPEGGIO.length]] + 12;
      playTone(musicGain, {
        type: "triangle",
        frequency: midiToFrequency(arpeggioNote),
        time,
        duration: 0.14,
        gain: 0.075,
        attack: 0.004,
        filter: 2800
      });
    }

    if (position === 0) {
      const barDuration = stepDuration * 15.5;
      [chord[0], chord[1], chord[2]].forEach((note, noteIndex) => {
        playTone(musicGain, {
          type: "sine",
          frequency: midiToFrequency(note),
          time: time + noteIndex * 0.012,
          duration: barDuration,
          gain: 0.024,
          attack: 0.22,
          filter: 1200
        });
      });
    }

    if (position === 6 || position === 14) {
      playTone(musicGain, {
        type: "sine",
        frequency: midiToFrequency(chord[3] + 12),
        time,
        duration: 0.22,
        gain: 0.035,
        attack: 0.006
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
    musicGain.gain.setTargetAtTime(0.28, context.currentTime, 0.04);
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

  function playFlip() {
    const context = ensureAudio();
    if (!context) return;
    playTone(sfxGain, {
      type: "sine",
      frequency: 510,
      endFrequency: 790,
      duration: 0.075,
      gain: 0.075,
      attack: 0.003
    });
  }

  function playButtonSound() {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    playTone(sfxGain, {
      type: "triangle",
      frequency: 620,
      endFrequency: 830,
      time: now,
      duration: 0.09,
      gain: 0.09
    });
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

  function playMatch(matchNumber) {
    const context = ensureAudio();
    if (!context) return;
    const now = context.currentTime;
    const pitchLift = Math.pow(2, Math.min(matchNumber - 1, 8) / 24);
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      playTone(sfxGain, {
        type: index === 2 ? "sine" : "triangle",
        frequency: frequency * pitchLift,
        time: now + index * 0.075,
        duration: 0.25,
        gain: 0.13 - index * 0.015,
        attack: 0.006
      });
    });
    playTone(sfxGain, {
      type: "sine",
      frequency: 1568 * pitchLift,
      time: now + 0.19,
      duration: 0.22,
      gain: 0.055,
      attack: 0.004
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

  // Events and initial state -----------------------------------------------
  overlayActionEl.addEventListener("click", () => {
    if (overlayMode === "start") {
      void startSession();
    } else {
      nextRound();
    }
  });

  soundToggleEl.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled);
  });

  window.addEventListener("resize", requestGridLayout, { passive: true });
  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(requestGridLayout);
    resizeObserver.observe(boardWrapEl);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
    } else if (soundEnabled && ["dealing", "playing", "resolving"].includes(state.phase)) {
      startMusic();
    }
  });

  window.addEventListener("pagehide", stopMusic);

  const handleReducedMotionChange = (event) => {
    reducedMotion = event.matches;
    requestGridLayout();
  };
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(handleReducedMotionChange);
  }

  updateSoundControl();
  updateHud(false);
  requestGridLayout();
  (async () => {
    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        const progress = await MathArcade.loadProgress(GAME_ID);
        state.rank = rankFromProgress(progress);
        state.difficulty = rankLevel();
      } catch (_) { /* start at C */ }
    }
    updateHud(false);
    paintStartOverlay();
  })();
})();
