/* Feed the Cats — doubles subtraction café.
 * Play the card that is exactly half of the top number to feed a cat.
 * 12 solved problems = a round; 3 rounds at a rank promotes C→B→A→S.
 * A/S sneak in odd-topped distractor problems; S adds a 120-second timer.
 */
(function () {
  "use strict";

  const GAME_ID = "feedthecats";
  const SOUND_KEY = "matharcade_feedthecats_sound";
  const RANKS = ["C", "B", "A", "S"];
  const RANK_FLAVOR = { C: "kitten", B: "house cat", A: "clever cat", S: "cat legend" };
  const RANK_MAX_DOUBLE = { C: 5, B: 10, A: 10, S: 10 };
  const PROBLEMS_PER_ROUND = 12;
  const ROUNDS_TO_PROMOTE = 3;
  const HAND_SIZE = 3;
  const SLOT_COUNT = 3;
  const S_TIME_LIMIT_MS = 120000;
  const DISTRACTOR_CHANCE = 0.45;
  const SOLVE_BASE_POINTS = 100;
  const STREAK_BONUS = 25;
  const STREAK_BONUS_CAP = 100;
  const ROUND_CLEAR_BONUS = 300;
  const DRAG_THRESHOLD = 9;

  const BURST_COLORS = ["#ffd166", "#ff8a3d", "#ff6f91", "#2fb8a6", "#52d68b", "#ffffff"];
  const CELEBRATIONS = [
    "Purr-fect!",
    "That cat is thrilled!",
    "Yum yum — doubles!",
    "Meow-velous math!",
    "Feast time!",
    "What a treat!",
    "Happy kitty!"
  ];
  const WRONG_MESSAGES = [
    "Not quite — the card must be exactly half of the top number.",
    "That cat shakes its head. Try a different card or cat!",
    "Almost! Which number doubles to the top number?",
    "No nibbles. Remember: half + half = the top number."
  ];

  // ------------------------------------------------------------------ DOM --
  const stageEl = document.getElementById("stage");
  const effectsEl = document.getElementById("effects");
  const messageEl = document.getElementById("message");
  const handSlotEls = Array.from(document.querySelectorAll(".hand-slot"));
  const deckEl = document.getElementById("deck");
  const deckCountEl = document.getElementById("deck-count");
  const fishMeterEl = document.getElementById("fish-meter");
  const slotRootEls = Array.from(document.querySelectorAll(".cat-slot"));
  const timerEl = document.getElementById("timer");
  const timerFillEl = document.getElementById("timer-fill");
  const timerTextEl = document.getElementById("timer-text");
  const rankValueEl = document.getElementById("rank-value");
  const roundValueEl = document.getElementById("round-value");
  const fedValueEl = document.getElementById("fed-value");
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
  const catTemplateEl = document.getElementById("cat-template");
  const fedGalleryEl = document.getElementById("fed-gallery");
  const fedGalleryGridEl = document.getElementById("fed-gallery-grid");
  const fedGalleryContinueEl = document.getElementById("fed-gallery-continue");

  if (!stageEl || !overlayActionEl || !catTemplateEl || !fedGalleryEl || !fedGalleryContinueEl || slotRootEls.length !== SLOT_COUNT) return;

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let overlayMode = "start";
  let messageTimer = 0;
  let pendingRoundSnapshot = null;
  const roundTimers = new Set();

  const state = {
    phase: "intro", // intro | loading | playing | resolving | roundComplete | failed
    rank: "C",
    roundsAtRank: 0,
    solved: 0,
    streak: 0,
    roundScore: 0,
    sessionScore: 0,
    problemQueue: [], // half-values of unsolved problems not yet on the board
    deck: [],         // card values still in the draw pile
    hand: [null, null, null],
    selectedHand: -1,
    catSeq: 0,
    roundStartedAt: 0,
    fedCats: [] // cloned SVGs of cats fed this round
  };

  // One record per board slot.
  const slots = slotRootEls.map((root, index) => ({
    index,
    root,
    holder: root.querySelector(".cat-holder"),
    dozeEl: root.querySelector(".doze-bubble"),
    probEl: root.querySelector(".problem"),
    topEl: root.querySelector(".prob-top"),
    blankEl: root.querySelector(".prob-blank"),
    resultEl: root.querySelector(".prob-result"),
    svg: null,
    kind: "empty", // empty | real | distractor | dozing
    top: 0,
    half: 0
  }));

  const handCardEls = [null, null, null];
  const fishEls = [];

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

  function rankLevel() {
    return RANKS.indexOf(state.rank) + 1;
  }

  function stageRect() {
    return stageEl.getBoundingClientRect();
  }

  // ------------------------------------------------------------- cat svgs --
  function hsl(h, s, l) {
    const hue = ((h % 360) + 360) % 360;
    return `hsl(${Math.round(hue)}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%)`;
  }

  const EYE_COLORS = ["#71ad6f", "#8fb660", "#d4a947", "#63b6d3", "#f2d34f", "#91bd75", "#e8a24a", "#7fc9b6"];

  function randomCatPalette() {
    // Fur family: mostly natural cats, sometimes a fantasy-colored one.
    let h;
    let s;
    let l;
    const roll = Math.random();
    if (roll < 0.38) {
      h = randInt(18, 48); s = randInt(45, 75); l = randInt(52, 72); // ginger / brown
    } else if (roll < 0.6) {
      h = randInt(200, 260); s = randInt(8, 20); l = randInt(45, 78); // gray / blue-gray
    } else if (roll < 0.72) {
      h = randInt(35, 50); s = randInt(25, 45); l = randInt(74, 86); // cream
    } else {
      h = randInt(0, 359); s = randInt(45, 72); l = randInt(56, 74); // fantasy
    }

    const collarHue = (h + randInt(120, 240)) % 360;
    const vars = {
      "--cat-fur-base": hsl(h, s, l),
      "--cat-fur-shadow": hsl(h, s + 4, l - 16),
      "--cat-light-fur": hsl(h, Math.max(12, s - 22), Math.min(94, l + 21)),
      "--cat-stripe": hsl(h, s + 10, Math.max(16, l - 30)),
      "--cat-point": hsl(h, s + 6, Math.max(14, l - 32)),
      "--cat-patch-one": hsl(h + randInt(18, 70), clamp(s + randInt(0, 15), 20, 85), clamp(l + randInt(-10, 8), 30, 80)),
      "--cat-patch-two": hsl(h + randInt(150, 220), clamp(s + randInt(-8, 18), 15, 80), clamp(l - randInt(8, 24), 18, 62)),
      "--cat-inner-ear": hsl(randInt(340, 372), randInt(38, 52), randInt(66, 78)),
      "--cat-eye": randomItem(EYE_COLORS),
      "--cat-pupil": "#1d2224",
      "--cat-nose": hsl(randInt(345, 365), randInt(35, 50), randInt(50, 62)),
      "--cat-mouth": hsl(h, 28, 28),
      "--cat-outline": hsl(h, 24, 17),
      "--cat-whisker": hsl(h, 18, 30),
      "--cat-collar": hsl(collarHue, randInt(48, 65), randInt(38, 52)),
      "--cat-collar-light": hsl(collarHue, randInt(48, 65), randInt(62, 74)),
      "--cat-tag": "#f2c84b",
      "--cat-tag-light": "#fff1a3",
      "--cat-ground-shadow": hsl(h, 18, 20)
    };

    // Coat pattern archetype controls the marking layer opacities.
    const pattern = randomItem(["solid", "tabby", "patched", "socks", "pointed", "wild"]);
    const opacities = {
      solid: { patches: 0, stripes: 0.1, socks: 0, blaze: 0, points: 0, tail: 0 },
      tabby: { patches: 0, stripes: 0.95, socks: 0.5, blaze: 0.12, points: 0, tail: 0 },
      patched: { patches: 1, stripes: 0.22, socks: 1, blaze: 0.7, points: 0, tail: 1 },
      socks: { patches: 0, stripes: 0.15, socks: 1, blaze: 1, points: 0, tail: 0 },
      pointed: { patches: 0, stripes: 0.1, socks: 0, blaze: 0, points: 1, tail: 0 },
      wild: { patches: 1, stripes: 0.4, socks: 1, blaze: 0.72, points: 0, tail: 1 }
    }[pattern];

    vars["--cat-patches-opacity"] = String(opacities.patches);
    vars["--cat-stripes-opacity"] = String(opacities.stripes);
    vars["--cat-socks-opacity"] = String(opacities.socks);
    vars["--cat-blaze-opacity"] = String(opacities.blaze);
    vars["--cat-points-opacity"] = String(opacities.points);
    vars["--cat-tail-tip-opacity"] = String(opacities.tail);
    vars["--cat-shadow-opacity"] = "0.16";
    return vars;
  }

  /** Inline a fresh cat into a holder, giving all ids a unique suffix. */
  function spawnCat(slot) {
    state.catSeq += 1;
    const uid = `s${slot.index}g${state.catSeq}`;
    const markup = catTemplateEl.innerHTML.replaceAll("recolorable-cat-", `rc-${uid}-`);
    slot.holder.innerHTML = markup;
    const svg = slot.holder.querySelector("svg");
    if (!svg) return null;
    svg.setAttribute("data-palette", "variables");
    svg.setAttribute("data-expression", "neutral");
    const palette = randomCatPalette();
    Object.keys(palette).forEach((name) => svg.style.setProperty(name, palette[name]));
    slot.svg = svg;
    return svg;
  }

  function setCatExpression(slot, expression) {
    if (slot.svg) slot.svg.setAttribute("data-expression", expression);
  }

  /** Keep a happy clone of the cat that was just fed, for the end-of-round gallery. */
  function snapshotFedCat(slot) {
    if (!slot.svg) return;
    const clone = slot.svg.cloneNode(true);
    clone.classList.remove("nom", "wobble", "doze");
    clone.setAttribute("data-expression", "happy");
    state.fedCats.push(clone);
  }

  function clearSlot(slot) {
    slot.kind = "empty";
    slot.top = 0;
    slot.half = 0;
    slot.svg = null;
    slot.holder.replaceChildren();
    slot.root.querySelectorAll(".fact-banner").forEach((el) => el.remove());
    renderSlotProblem(slot);
  }

  function animateCat(slot, className, duration) {
    if (!slot.svg || reducedMotion) return;
    const svg = slot.svg;
    svg.classList.remove(className);
    void svg.getBoundingClientRect();
    svg.classList.add(className);
    queueTask(() => svg.classList.remove(className), duration);
  }

  // -------------------------------------------------------- HUD & message --
  function updateHud(animateScore) {
    rankValueEl.textContent = state.rank;
    rankValueEl.className = "hud-value rank-" + state.rank;
    roundValueEl.textContent = `${Math.min(state.roundsAtRank + 1, ROUNDS_TO_PROMOTE)} / ${ROUNDS_TO_PROMOTE}`;
    fedValueEl.textContent = `${state.solved} / ${PROBLEMS_PER_ROUND}`;
    scoreValueEl.textContent = formatScore(state.sessionScore);

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
    }, reducedMotion ? 850 : (duration || 1700));
  }

  function hideMessage() {
    window.clearTimeout(messageTimer);
    messageEl.className = "message";
    messageEl.textContent = "";
  }

  // ------------------------------------------------------------ fish meter --
  function buildFishMeter() {
    fishMeterEl.replaceChildren();
    fishEls.length = 0;
    for (let i = 0; i < PROBLEMS_PER_ROUND; i += 1) {
      const fish = document.createElement("span");
      fish.className = "fish";
      fish.textContent = "🐟";
      fishMeterEl.append(fish);
      fishEls.push(fish);
    }
  }

  function updateFishMeter(popIndex) {
    fishEls.forEach((fish, i) => {
      fish.classList.toggle("filled", i < state.solved);
      if (i === popIndex) {
        fish.classList.remove("pop");
        void fish.offsetWidth;
        fish.classList.add("pop");
      }
    });
  }

  function updateDeckCount() {
    deckCountEl.textContent = String(state.deck.length);
    deckEl.classList.toggle("empty", state.deck.length === 0);
  }

  // -------------------------------------------------------- round problems --
  function buildRoundProblems(rank) {
    const max = RANK_MAX_DOUBLE[rank] || 5;
    const base = [];
    for (let n = 1; n <= max; n += 1) base.push(n);
    const values = [];
    while (values.length < PROBLEMS_PER_ROUND) values.push(...shuffle(base.slice()));
    values.length = PROBLEMS_PER_ROUND;
    return shuffle(values);
  }

  function distractorAllowed() {
    return state.rank === "A" || state.rank === "S";
  }

  function makeDistractorTop() {
    // Odd top numbers can never be a doubles fact.
    const maxTop = RANK_MAX_DOUBLE[state.rank] * 2 - 1;
    return 3 + 2 * randInt(0, Math.floor((maxTop - 3) / 2));
  }

  function boardHasDistractor() {
    return slots.some((slot) => slot.kind === "distractor");
  }

  function boardIsSolvable() {
    return slots.some((slot) => slot.kind === "real" && state.hand.includes(slot.half));
  }

  /** Pull the next real problem from the queue, preferring one the hand can answer. */
  function takeNextProblem() {
    if (!state.problemQueue.length) return null;
    if (!boardIsSolvable()) {
      const matchIndex = state.problemQueue.findIndex((n) => state.hand.includes(n));
      if (matchIndex >= 0) return state.problemQueue.splice(matchIndex, 1)[0];
    }
    return state.problemQueue.splice(randInt(0, state.problemQueue.length - 1), 1)[0];
  }

  function renderSlotProblem(slot) {
    const isEmpty = slot.kind === "empty";
    const isDozing = slot.kind === "dozing";
    slot.probEl.style.visibility = (isDozing || isEmpty) ? "hidden" : "visible";
    slot.dozeEl.hidden = !isDozing;
    slot.blankEl.classList.remove("filled");
    slot.resultEl.classList.remove("stamp");
    slot.resultEl.textContent = "";
    slot.blankEl.textContent = "?";
    slot.root.classList.toggle("dozing", isDozing);
    slot.root.classList.toggle("vacant", isEmpty);

    if (isEmpty) {
      slot.probEl.setAttribute("aria-label", `Spot ${slot.index + 1} is empty. That cat already ate.`);
      return;
    }
    if (isDozing) {
      slot.probEl.setAttribute("aria-label", `Cat ${slot.index + 1} is full and napping`);
      return;
    }
    slot.topEl.textContent = String(slot.top);
    slot.probEl.setAttribute(
      "aria-label",
      `Cat ${slot.index + 1}: ${slot.top} minus blank. Play a card into the blank.`
    );
  }

  /** Refill one board slot with a new problem or distractor, or leave it blank. */
  function refillSlot(index, options = {}) {
    const slot = slots[index];
    slot.kind = "empty";
    slot.top = 0;
    slot.half = 0;

    const wantDistractor =
      distractorAllowed() &&
      !boardHasDistractor() &&
      state.problemQueue.length > 0 &&
      Math.random() < DISTRACTOR_CHANCE &&
      options.allowDistractor !== false;

    if (wantDistractor) {
      slot.kind = "distractor";
      slot.top = makeDistractorTop();
    } else {
      const half = takeNextProblem();
      if (half == null) {
        clearSlot(slot);
        return;
      }
      slot.kind = "real";
      slot.half = half;
      slot.top = half * 2;
    }

    spawnCat(slot);
    renderSlotProblem(slot);
  }

  /**
   * Guarantee at least one visible real problem matches a card in hand
   * whenever the remaining problems make that possible.
   */
  function ensureSolvable() {
    if (boardIsSolvable()) return;
    const matchIndex = state.problemQueue.findIndex((n) => state.hand.includes(n));
    if (matchIndex < 0) return;

    let target = slots.findIndex((slot) => slot.kind === "distractor");
    if (target < 0) target = slots.findIndex((slot) => slot.kind === "real");
    if (target < 0) return;

    const slot = slots[target];
    const half = state.problemQueue.splice(matchIndex, 1)[0];
    if (slot.kind === "real") state.problemQueue.push(slot.half);
    slot.kind = "real";
    slot.half = half;
    slot.top = half * 2;
    renderSlotProblem(slot);
  }

  // ------------------------------------------------------------ hand cards --
  function createCardEl(value, handIndex, dealDelay) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "hand-card";
    el.dataset.hand = String(handIndex);
    el.setAttribute("aria-label", `Number card ${value}. Press to pick it up.`);
    el.style.animationDelay = `${reducedMotion ? 0 : dealDelay || 0}ms`;
    el.innerHTML = `<span class="hand-card-value">${value}</span><span class="hand-card-paw" aria-hidden="true">🐾</span>`;
    el.addEventListener("pointerdown", (event) => onCardDown(event, handIndex));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSelectCard(handIndex);
      }
    });
    return el;
  }

  function placeCardEl(handIndex, value, dealDelay) {
    const el = createCardEl(value, handIndex, dealDelay);
    handSlotEls[handIndex].replaceChildren(el);
    handCardEls[handIndex] = el;
    return el;
  }

  function removeCardEl(handIndex) {
    if (handCardEls[handIndex]) {
      handCardEls[handIndex].remove();
      handCardEls[handIndex] = null;
    }
  }

  function clearSelection() {
    if (state.selectedHand >= 0 && handCardEls[state.selectedHand]) {
      handCardEls[state.selectedHand].classList.remove("selected");
    }
    state.selectedHand = -1;
  }

  function toggleSelectCard(handIndex) {
    if (state.phase !== "playing" || state.hand[handIndex] == null) return;
    if (state.selectedHand === handIndex) {
      clearSelection();
      return;
    }
    clearSelection();
    state.selectedHand = handIndex;
    const el = handCardEls[handIndex];
    if (el) el.classList.add("selected");
    playSelect();
    announce("Now tap the cat you want to feed!", false, 1400);
  }

  /** Animate the next deck card flying into an empty hand slot. */
  function drawCard(handIndex) {
    if (!state.deck.length || state.hand[handIndex] != null) return;
    const value = state.deck.shift();
    state.hand[handIndex] = value;
    updateDeckCount();
    playDraw();

    if (reducedMotion) {
      placeCardEl(handIndex, value, 0);
      return;
    }

    const rect = stageRect();
    const deckRect = deckEl.getBoundingClientRect();
    const targetRect = handSlotEls[handIndex].getBoundingClientRect();
    const fly = document.createElement("span");
    fly.className = "fly-card deck-style";
    fly.style.left = `${deckRect.left - rect.left}px`;
    fly.style.top = `${deckRect.top - rect.top}px`;
    fly.style.width = `${deckRect.width}px`;
    fly.style.height = `${deckRect.height}px`;
    effectsEl.append(fly);
    void fly.getBoundingClientRect();
    const dx = targetRect.left + targetRect.width / 2 - (deckRect.left + deckRect.width / 2);
    const dy = targetRect.top + targetRect.height / 2 - (deckRect.top + deckRect.height / 2);
    fly.style.transform = `translate(${dx}px, ${dy}px) rotate(360deg) scale(1.2)`;
    queueTask(() => {
      fly.remove();
      placeCardEl(handIndex, value, 0);
    }, 320);
  }

  // ------------------------------------------------------------- dragging --
  let drag = null; // { handIndex, el, pointerId, startX, startY, moved, slotRects }

  function slotAcceptsCard(slot) {
    return slot.kind === "real" || slot.kind === "distractor";
  }

  function currentSlotRects() {
    return slots.map((slot) => (slotAcceptsCard(slot) ? slot.root.getBoundingClientRect() : null));
  }

  function slotHitTest(clientX, clientY, slotRects) {
    if (!slotRects) return -1;
    for (let i = 0; i < slotRects.length; i += 1) {
      const r = slotRects[i];
      if (r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return i;
      }
    }
    return -1;
  }

  function highlightSlot(index) {
    slots.forEach((slot, i) => {
      slot.probEl.classList.toggle("target", i === index && slotAcceptsCard(slot));
    });
  }

  function onCardDown(event, handIndex) {
    if (state.phase !== "playing" || drag || !event.isPrimary) return;
    if (state.hand[handIndex] == null) return;
    const el = handCardEls[handIndex];
    if (!el) return;

    event.preventDefault();
    drag = {
      handIndex,
      el,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      slotRects: currentSlotRects()
    };
    try {
      el.setPointerCapture(event.pointerId);
    } catch (_) { /* synthetic or already-released pointer */ }
  }

  function onCardMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      drag.el.classList.remove("selected", "returning");
      drag.el.classList.add("dragging");
      if (state.selectedHand === drag.handIndex) state.selectedHand = -1;
      playSelect();
    }
    drag.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${clamp(dx * 0.04, -8, 8)}deg)`;
    highlightSlot(slotHitTest(event.clientX, event.clientY, drag.slotRects));
  }

  function onCardUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { handIndex, el, moved } = drag;
    const isCancel = event.type === "pointercancel";
    const target = (!moved || isCancel)
      ? -1
      : slotHitTest(event.clientX, event.clientY, currentSlotRects());
    drag = null;
    highlightSlot(-1);

    if (!moved) {
      if (!isCancel) toggleSelectCard(handIndex);
      return;
    }

    if (target >= 0 && state.phase === "playing") {
      el.classList.remove("dragging");
      el.style.transform = "";
      playCardOnSlot(handIndex, target);
      return;
    }

    // Glide back home.
    el.classList.remove("dragging");
    el.classList.add("returning");
    el.style.transform = "";
    window.setTimeout(() => el.classList.remove("returning"), 280);
  }

  // ------------------------------------------------------------- gameplay --
  function playCardOnSlot(handIndex, slotIndex) {
    if (state.phase !== "playing") return;
    const value = state.hand[handIndex];
    const slot = slots[slotIndex];
    if (value == null || !slot) return;

    if (!slotAcceptsCard(slot)) {
      if (slot.kind === "empty") {
        announce("That cat already ate! Feed another one.", false, 1300);
      } else {
        announce("That cat is full and fast asleep!", false, 1300);
        animateCat(slot, "wobble", 500);
      }
      return;
    }

    const correct = slot.kind === "real" && value === slot.half;
    if (correct) {
      resolveCorrect(handIndex, slotIndex);
    } else {
      resolveWrong(handIndex, slotIndex);
    }
  }

  function resolveCorrect(handIndex, slotIndex) {
    state.phase = "resolving";
    clearSelection();
    const slot = slots[slotIndex];
    const value = state.hand[handIndex];
    state.hand[handIndex] = null;

    const cardEl = handCardEls[handIndex];
    const rect = stageRect();
    const blankRect = slot.blankEl.getBoundingClientRect();

    // Fly the card from the hand into the blank.
    if (cardEl && !reducedMotion) {
      const cardRect = cardEl.getBoundingClientRect();
      const fly = document.createElement("span");
      fly.className = "fly-card";
      fly.textContent = String(value);
      fly.style.left = `${cardRect.left - rect.left}px`;
      fly.style.top = `${cardRect.top - rect.top}px`;
      fly.style.width = `${cardRect.width}px`;
      fly.style.height = `${cardRect.height}px`;
      fly.style.fontSize = "1.6rem";
      effectsEl.append(fly);
      removeCardEl(handIndex);
      void fly.getBoundingClientRect();
      const dx = blankRect.left + blankRect.width / 2 - (cardRect.left + cardRect.width / 2);
      const dy = blankRect.top + blankRect.height / 2 - (cardRect.top + cardRect.height / 2);
      fly.style.transform = `translate(${dx}px, ${dy}px) scale(0.42)`;
      fly.style.opacity = "0.9";
      queueTask(() => {
        fly.remove();
        landCorrectCard(slot, value, slotIndex, handIndex);
      }, 300);
    } else {
      removeCardEl(handIndex);
      landCorrectCard(slot, value, slotIndex, handIndex);
    }
  }

  function landCorrectCard(slot, value, slotIndex, handIndex) {
    // Complete the fact with excitement: 14 − 7 = 7.
    slot.blankEl.textContent = String(value);
    slot.blankEl.classList.add("filled");
    slot.resultEl.textContent = String(slot.top - value);
    slot.resultEl.classList.add("stamp");

    if (!reducedMotion) {
      const banner = document.createElement("span");
      banner.className = "fact-banner";
      banner.textContent = `${slot.top} − ${value} = ${slot.top - value}!`;
      slot.root.append(banner);
      banner.addEventListener("animationend", () => banner.remove(), { once: true });
    }

    setCatExpression(slot, "happy");
    animateCat(slot, "nom", 680);
    snapshotFedCat(slot);

    state.solved += 1;
    state.streak += 1;
    const bonus = Math.min((state.streak - 1) * STREAK_BONUS, STREAK_BONUS_CAP);
    const points = SOLVE_BASE_POINTS + bonus;
    state.roundScore += points;
    state.sessionScore += points;
    updateHud(true);
    updateFishMeter(state.solved - 1);
    playCorrect(state.streak);
    playMeow();
    spawnSolveEffects(slot, points);
    announce(randomItem(CELEBRATIONS), true, 1400);

    // Draw the replacement card from the deck.
    queueTask(() => drawCard(handIndex), 240);

    if (state.solved >= PROBLEMS_PER_ROUND) {
      hideTimer();
      queueTask(() => dismissLastCatAndFinish(slotIndex), 900);
      return;
    }

    // Cycle the solved slot — and the distractor, if one is on the board.
    const cycleIndices = [slotIndex];
    const distractorIndex = slots.findIndex((s) => s.kind === "distractor");
    if (distractorIndex >= 0) cycleIndices.push(distractorIndex);
    queueTask(() => cycleSlots(cycleIndices), 900);
  }

  function cycleSlots(indices) {
    indices.forEach((i) => {
      slots[i].root.classList.remove("slot-in", "vacant");
      slots[i].root.classList.add("slot-out");
    });
    playCycle();

    queueTask(() => {
      indices.forEach((i) => {
        refillSlot(i);
        slots[i].root.classList.remove("slot-out");
        if (slots[i].kind === "empty") return;
        void slots[i].root.offsetWidth;
        slots[i].root.classList.add("slot-in");
      });
      ensureSolvable();
      queueTask(() => {
        indices.forEach((i) => slots[i].root.classList.remove("slot-in"));
      }, 460);
      state.phase = "playing";
    }, reducedMotion ? 30 : 310);
  }

  function dismissLastCatAndFinish(slotIndex) {
    const slot = slots[slotIndex];
    slot.root.classList.remove("slot-in", "vacant");
    slot.root.classList.add("slot-out");
    playCycle();
    queueTask(() => {
      clearSlot(slot);
      slot.root.classList.remove("slot-out");
      finishRound();
    }, reducedMotion ? 30 : 310);
  }

  function resolveWrong(handIndex, slotIndex) {
    const slot = slots[slotIndex];
    state.streak = 0;
    playWrong();
    announce(randomItem(WRONG_MESSAGES), false, 1900);

    slot.root.classList.remove("slot-shake");
    void slot.root.offsetWidth;
    slot.root.classList.add("slot-shake");
    queueTask(() => slot.root.classList.remove("slot-shake"), 460);
    animateCat(slot, "wobble", 500);

    const cardEl = handCardEls[handIndex];
    if (cardEl) {
      cardEl.classList.remove("shake");
      void cardEl.offsetWidth;
      cardEl.classList.add("shake");
      queueTask(() => cardEl.classList.remove("shake"), 460);
    }
    clearSelection();
  }

  // ------------------------------------------------------------ juice fx --
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

  function spawnSolveEffects(slot, points) {
    if (reducedMotion) return;
    const rect = stageRect();
    const slotRect = slot.root.getBoundingClientRect();
    const x = slotRect.left - rect.left + slotRect.width / 2;
    const y = slotRect.top - rect.top + slotRect.height * 0.55;

    for (let i = 0; i < 22; i += 1) {
      spawnParticle(x, y, BURST_COLORS[i % BURST_COLORS.length], i);
    }

    const scorePop = document.createElement("span");
    scorePop.className = "score-pop";
    scorePop.textContent = `+${points}`;
    scorePop.style.setProperty("--x", `${x}px`);
    scorePop.style.setProperty("--y", `${y - slotRect.height * 0.2}px`);
    scorePop.addEventListener("animationend", () => scorePop.remove(), { once: true });
    effectsEl.append(scorePop);

    stageEl.style.setProperty("--flash-x", `${(x / rect.width) * 100}%`);
    stageEl.style.setProperty("--flash-y", `${(y / rect.height) * 100}%`);
    stageEl.classList.remove("solve-flash");
    void stageEl.offsetWidth;
    stageEl.classList.add("solve-flash");

    stageEl.classList.remove("shake");
    void stageEl.offsetWidth;
    stageEl.classList.add("shake");
    queueTask(() => stageEl.classList.remove("shake"), 380);
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
    stageEl.classList.remove("solve-flash", "shake");
  }

  // -------------------------------------------------------------- S timer --
  let timerId = 0;
  let timerDeadline = 0;
  let timerPausedRemaining = -1;
  let lastTickSecond = -1;

  function startTimer() {
    stopTimer();
    timerEl.hidden = false;
    timerEl.classList.remove("urgent");
    timerDeadline = performance.now() + S_TIME_LIMIT_MS;
    timerPausedRemaining = -1;
    lastTickSecond = -1;
    timerId = window.setInterval(updateTimer, 100);
    updateTimer();
  }

  function stopTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = 0;
    }
  }

  function hideTimer() {
    stopTimer();
    timerEl.hidden = true;
    timerEl.classList.remove("urgent");
  }

  function pauseTimer() {
    if (!timerId) return;
    timerPausedRemaining = Math.max(0, timerDeadline - performance.now());
    stopTimer();
  }

  function resumeTimer() {
    if (timerPausedRemaining < 0 || state.rank !== "S") return;
    if (!["playing", "resolving"].includes(state.phase)) return;
    timerDeadline = performance.now() + timerPausedRemaining;
    timerPausedRemaining = -1;
    timerId = window.setInterval(updateTimer, 100);
  }

  function updateTimer() {
    const remaining = Math.max(0, timerDeadline - performance.now());
    const fraction = remaining / S_TIME_LIMIT_MS;
    timerFillEl.style.width = `${fraction * 100}%`;
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerTextEl.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;

    if (remaining <= 20000) {
      timerEl.classList.add("urgent");
      if (totalSeconds !== lastTickSecond) {
        lastTickSecond = totalSeconds;
        playTick();
      }
    }

    if (remaining <= 0) {
      stopTimer();
      failRound();
    }
  }

  function timerSecondsLeft() {
    if (state.rank !== "S" || !timerDeadline) return 0;
    return Math.max(0, Math.floor((timerDeadline - performance.now()) / 1000));
  }

  // ---------------------------------------------------------- round flow --
  function startRound() {
    clearTasks();
    clearEffects();
    hideMessage();
    clearSelection();
    drag = null;

    state.phase = "dealing";
    state.solved = 0;
    state.streak = 0;
    state.roundScore = 0;
    state.roundStartedAt = performance.now();
    state.fedCats.length = 0;
    pendingRoundSnapshot = null;
    hideFedGallery();

    const problems = buildRoundProblems(state.rank);
    state.problemQueue = problems.slice();
    state.deck = shuffle(problems.slice());

    // Deal the opening hand (state first, visuals staggered).
    state.hand = [null, null, null];
    handSlotEls.forEach((slotEl) => slotEl.replaceChildren());
    for (let i = 0; i < HAND_SIZE; i += 1) {
      const value = state.deck.shift();
      state.hand[i] = value;
      placeCardEl(i, value, i * 130);
    }
    updateDeckCount();
    buildFishMeter();
    updateFishMeter(-1);

    // Fill the board (slot picks prefer problems the hand can answer).
    slots.forEach((slot) => {
      slot.kind = "empty";
      slot.root.classList.remove("slot-out", "slot-in", "dozing", "vacant");
    });
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      refillSlot(i);
      slots[i].root.classList.add("slot-in");
      slots[i].root.style.animationDelay = `${reducedMotion ? 0 : 120 + i * 130}ms`;
    }
    ensureSolvable();
    queueTask(() => {
      slots.forEach((slot) => {
        slot.root.classList.remove("slot-in");
        slot.root.style.animationDelay = "";
      });
    }, 900);

    if (state.rank === "S") {
      startTimer();
    } else {
      hideTimer();
    }

    updateHud(false);
    hideOverlay();
    playRoundStart();
    startMusic();
    announce(
      state.rank === "S"
        ? "S rank: feed all 12 cats before the timer runs out!"
        : "Feed the cats! Play the card that is half of the top number.",
      false,
      2100
    );

    queueTask(() => {
      if (state.phase === "dealing") state.phase = "playing";
    }, reducedMotion ? 60 : 620);
  }

  function finishRound() {
    if (!["playing", "resolving"].includes(state.phase)) return;
    state.phase = "roundComplete";
    clearSelection();

    const secondsLeft = timerSecondsLeft();
    hideTimer();
    stopMusic();

    const timeBonus = state.rank === "S" ? secondsLeft * 5 : 0;
    const bonus = ROUND_CLEAR_BONUS + timeBonus;
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
    playRoundWin();
    if (rankedUp) playRankUp();
    celebrateRound();

    const snapshot = {
      oldRank,
      rank: state.rank,
      rankedUp,
      roundsAtRank: state.roundsAtRank,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore,
      secondsLeft,
      seconds: Math.max(1, Math.floor((performance.now() - state.roundStartedAt) / 1000))
    };
    void persistRound(snapshot, true);
    showFedGallery(snapshot);
  }

  function failRound() {
    if (!["playing", "resolving", "dealing"].includes(state.phase)) return;
    state.phase = "failed";
    clearTasks();
    clearSelection();
    hideTimer();
    stopMusic();
    playFail();

    const oldRank = state.rank;
    state.rank = "A";
    state.roundsAtRank = 0;
    updateHud(false);
    announce("Time's up! The cats fell asleep hungry…", false, 2200);

    const snapshot = {
      oldRank,
      rank: state.rank,
      rankedUp: false,
      failed: true,
      roundsAtRank: 0,
      roundScore: state.roundScore,
      sessionScore: state.sessionScore,
      solved: state.solved
    };
    void persistRound(snapshot, false);
    queueTask(() => showFailOverlay(snapshot), 900);
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
      console.warn("Feed the Cats progress could not be saved.", error);
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

  function showOverlay() {
    overlayEl.classList.remove("hidden");
    overlayEl.setAttribute("aria-hidden", "false");
    queueTask(() => overlayActionEl.focus({ preventScroll: true }), 180);
  }

  function hideOverlay() {
    overlayEl.classList.add("hidden");
    overlayEl.setAttribute("aria-hidden", "true");
  }

  function showFedGallery(snapshot) {
    pendingRoundSnapshot = snapshot;
    hideMessage();
    fedGalleryGridEl.replaceChildren();
    state.fedCats.forEach((svg, index) => {
      const cell = document.createElement("div");
      cell.className = "fed-cat";
      cell.style.animationDelay = `${reducedMotion ? 0 : index * 45}ms`;
      cell.append(svg);
      fedGalleryGridEl.append(cell);
    });
    fedGalleryEl.classList.remove("hidden");
    fedGalleryEl.setAttribute("aria-hidden", "false");
    stageEl.classList.add("gallery-up");
    queueTask(() => fedGalleryContinueEl.focus({ preventScroll: true }), 180);
  }

  function hideFedGallery() {
    fedGalleryEl.classList.add("hidden");
    fedGalleryEl.setAttribute("aria-hidden", "true");
    stageEl.classList.remove("gallery-up");
    fedGalleryGridEl.replaceChildren();
  }

  function paintStartOverlay() {
    overlayMode = "start";
    overlayKickerEl.textContent = "Doubles subtraction café";
    overlayTitleEl.textContent = "Feed the Cats!";
    overlayCopyEl.textContent =
      "Three hungry cats each have a subtraction problem. Play the card that is exactly half of the top number — like 14 − 7 — to feed a cat. Feed 12 cats to finish the round!";
    overlayExtraEl.innerHTML = `
      <p>Current rank <span class="rank-badge rank-${state.rank}">${state.rank}</span></p>
      ${roundPipsHtml(state.roundsAtRank)}
      ${rankLegendHtml()}`;
    overlayStatsEl.hidden = true;
    overlayActionEl.textContent = "Open the café";
    overlayActionEl.disabled = false;
  }

  function showRoundComplete(snapshot) {
    overlayMode = "next";
    overlayKickerEl.textContent = snapshot.rankedUp
      ? "Rank up"
      : `Rank ${state.rank} · round ${snapshot.roundsAtRank} of ${ROUNDS_TO_PROMOTE}`;
    overlayTitleEl.textContent = snapshot.rankedUp ? "Rank Up!" : "All cats fed!";
    overlayCopyEl.textContent = snapshot.rankedUp
      ? `Amazing! You cleared ${ROUNDS_TO_PROMOTE} rounds — ${snapshot.oldRank} → ${state.rank}. ${
          state.rank === "A"
            ? "Watch out: sneaky odd-numbered problems appear now. No card can solve those!"
            : state.rank === "S"
              ? "The final challenge: a 120-second timer. Don't let the cats go hungry!"
              : "Bigger doubles are on the menu now."
        }`
      : state.rank === "S"
        ? "Legendary feeding! Keep clearing S rounds to stay the champion of the café."
        : `Wonderful! Clear ${ROUNDS_TO_PROMOTE - snapshot.roundsAtRank} more round${
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
    overlayKickerEl.textContent = "Time's up";
    overlayTitleEl.textContent = "So close!";
    overlayCopyEl.textContent = `You fed ${snapshot.solved} of ${PROBLEMS_PER_ROUND} cats before the timer ran out. Back to rank A — earn ${ROUNDS_TO_PROMOTE} rounds to face the S timer again!`;
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
    overlayActionEl.textContent = "Setting the tables…";
    ensureAudio();
    playButtonSound();

    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        const progress = await MathArcade.loadProgress(GAME_ID);
        applyProgress(progress);
      } catch (error) {
        console.warn("Feed the Cats progress could not be loaded; starting locally.", error);
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

  // A relaxed café shuffle: F — C — Dm — Bb.
  const CHORDS = [
    [65, 69, 72, 77],
    [60, 64, 67, 72],
    [62, 65, 69, 74],
    [58, 62, 65, 70]
  ];
  const BASS_NOTES = [41, 36, 38, 34];
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
    const bpm = state.rank === "S" ? 126 : 112;
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
        duration: 0.3,
        gain: 0.13,
        attack: 0.015,
        filter: 640
      });
    }

    if (position % 2 === 0) {
      const arpeggioNote = chord[ARPEGGIO[(position / 2) % ARPEGGIO.length]] + 12;
      playTone(musicGain, {
        type: "triangle",
        frequency: midiToFrequency(arpeggioNote),
        time,
        duration: 0.13,
        gain: 0.07,
        attack: 0.004,
        filter: 2600
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
          gain: 0.022,
          attack: 0.22,
          filter: 1100
        });
      });
    }

    if (position === 6 || position === 14) {
      playTone(musicGain, {
        type: "sine",
        frequency: midiToFrequency(chord[3] + 12),
        time,
        duration: 0.2,
        gain: 0.032,
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
      frequency: 500,
      endFrequency: 660,
      duration: 0.06,
      gain: 0.06,
      attack: 0.003
    });
  }

  function playDraw() {
    playTone(sfxGain, {
      type: "sine",
      frequency: 320,
      endFrequency: 760,
      duration: 0.11,
      gain: 0.06,
      attack: 0.004
    });
  }

  function playCycle() {
    playTone(sfxGain, {
      type: "triangle",
      frequency: 700,
      endFrequency: 380,
      duration: 0.14,
      gain: 0.05,
      attack: 0.006,
      filter: 1800
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

  function playMeow() {
    const context = ensureAudio();
    if (!context) return;
    const start = context.currentTime + 0.16;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(520, start);
    oscillator.frequency.exponentialRampToValueAtTime(940, start + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(430, start + 0.28);
    filter.type = "lowpass";
    filter.frequency.value = 1500;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.07, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    oscillator.start(start);
    oscillator.stop(start + 0.34);
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
    playTone(sfxGain, {
      type: "sine",
      frequency: 1568 * pitchLift,
      time: now + 0.18,
      duration: 0.22,
      gain: 0.05,
      attack: 0.004
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

  fedGalleryContinueEl.addEventListener("click", () => {
    if (!pendingRoundSnapshot || state.phase !== "roundComplete") return;
    ensureAudio();
    playButtonSound();
    const snapshot = pendingRoundSnapshot;
    pendingRoundSnapshot = null;
    hideFedGallery();
    showRoundComplete(snapshot);
  });

  soundToggleEl.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled);
  });

  document.addEventListener("pointermove", onCardMove);
  document.addEventListener("pointerup", onCardUp);
  document.addEventListener("pointercancel", onCardUp);

  slots.forEach((slot) => {
    slot.probEl.addEventListener("click", () => {
      if (state.phase !== "playing") return;
      if (state.selectedHand >= 0) {
        playCardOnSlot(state.selectedHand, slot.index);
      } else if (slotAcceptsCard(slot)) {
        announce("Pick a card from your hand first!", false, 1300);
      }
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
      pauseTimer();
    } else {
      if (soundEnabled && ["dealing", "playing", "resolving"].includes(state.phase)) startMusic();
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
  buildFishMeter();
  updateHud(false);

  // Show one welcoming cat per slot behind the start overlay.
  slots.forEach((slot) => {
    spawnCat(slot);
    slot.kind = "dozing";
    renderSlotProblem(slot);
    slot.dozeEl.hidden = true;
  });

  (async () => {
    if (window.MathArcade && typeof MathArcade.loadProgress === "function") {
      try {
        const progress = await MathArcade.loadProgress(GAME_ID);
        applyProgress(progress);
      } catch (_) { /* start at C */ }
    }
    updateHud(false);
    paintStartOverlay();
  })();
})();
