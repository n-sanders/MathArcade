/* Doozer Towers — Fraggle Rock fact family division builder.
 * Ranks C -> B -> A -> S:
 *   C (Apprentice Doozer): ÷2, ÷3, ÷5, ÷10 fact families with × bridge cue, 10 levels, untimed
 *   B (Stick Builder):     ÷2, ÷3, ÷4, ÷5, ÷6, ÷10 fact families (both corners), 12 levels, untimed
 *   A (Bull Doozer):       full 2–10 fact families (heavy 6–9), pure triangle, 14 levels, untimed
 *   S (Master Architect):  full 2–12 fact families + missing divisors + 10s timer, 16 levels
 * Each correct answer adds a level to a triangular radish-stick Doozer tower;
 * any wrong answer (or timeout) triggers a full tower collapse!
 * Finish 2 shifts at a rank to unlock its 100% Rank-Up Test. Missing a test never drops rank.
 */
(function () {
  "use strict";

  const GAME_ID = "doozertowers";
  const SOUND_KEY = "matharcade_doozertowers_sound";
  const LOCAL_SAVE_KEY = "matharcade_doozertowers_save_v1";
  const RANKS = ["C", "B", "A", "S"];
  const ROUNDS_TO_TEST = 2;
  const TRUSS_STREAK = 5;
  const BASE_POINTS = 100;
  const HEIGHT_BONUS = 20;
  const HEIGHT_BONUS_CAP = 120;
  const TRUSS_BONUS = 50;
  const SPEED_BONUS_PER_SEC = 5;
  const CORRECT_HOLD_MS = 950;
  const TRUSS_HOLD_MS = 1400;
  const COLLAPSE_HOLD_MS = 1850;
  const END_HOLD_MS = 1700;

  const CAVERN_W = 460;
  const CAVERN_H = 510;
  const FLOOR_Y = 456;

  const RANK_RULES = {
    C: {
      title: "Apprentice Doozer",
      blurb: "Friendly fact families (÷2, ÷3, ÷5, ÷10) with multiplication bridge cues",
      levels: 10,
      timerMs: null,
      showBridge: true,
      showDivArrow: true,
      bothCorners: false,
      missingDivisorChance: 0,
      meta: "10 levels · untimed",
      heroRole: "worker"
    },
    B: {
      title: "Stick Builder",
      blurb: "Growing families (÷2, ÷3, ÷4, ÷5, ÷6, ÷10) solving both bottom corners",
      levels: 12,
      timerMs: null,
      showBridge: true,
      showDivArrow: false,
      bothCorners: true,
      missingDivisorChance: 0,
      meta: "12 levels · untimed",
      heroRole: "worker"
    },
    A: {
      title: "Bull Doozer",
      blurb: "All 2–10 fact families (focus on 6s, 7s, 8s, 9s) with pure triangles",
      levels: 14,
      timerMs: null,
      showBridge: false,
      showDivArrow: false,
      bothCorners: true,
      missingDivisorChance: 0,
      meta: "14 levels · untimed",
      heroRole: "bulldoozer"
    },
    S: {
      title: "Master Architect",
      blurb: "Full 2–12 fact families, missing divisors, and timed blueprint builds",
      levels: 16,
      timerMs: 10000,
      showBridge: false,
      showDivArrow: false,
      bothCorners: true,
      missingDivisorChance: 0.35,
      meta: "16 levels · timed",
      heroRole: "architect"
    }
  };

  // Authentic classic Fraggle Rock Doozer helmet colors (Muppet Wiki: yellow, red, orange, blue, purple, pink, white)
  const HELMET_PALETTES = [
    { name: "yellow", main: "#f7c948", shade: "#d99b1e", highlight: "#fff0a8" },
    { name: "red", main: "#e85d55", shade: "#b83530", highlight: "#ffb2ad" },
    { name: "blue", main: "#4c93db", shade: "#2964a3", highlight: "#a8d2ff" },
    { name: "orange", main: "#f28c38", shade: "#bf5e15", highlight: "#ffd09e" },
    { name: "purple", main: "#9b6bd4", shade: "#683ea1", highlight: "#dbc2ff" },
    { name: "pink", main: "#ec7ca8", shade: "#ba4776", highlight: "#ffc4dc" },
    { name: "white", main: "#f2f5f7", shade: "#c5cfd6", highlight: "#ffffff" }
  ];

  const BURST_COLORS = ["#c8ff8c", "#65c94d", "#ffd45c", "#f59e0b", "#4fd1c5", "#ffffff"];

  const CELEBRATIONS = [
    "Radish-stick perfection!",
    "Solid triangular truss!",
    "Built to Doozer spec!",
    "Higher and higher!",
    "That joint snapped right in!",
    "Bull Doozer approved!"
  ];

  const TEST_TOOLS_ENABLED = new URLSearchParams(window.location.search).has("test");

  // ------------------------------------------------------------------ DOM --
  const brandBtn = document.getElementById("brand-btn");
  const testRankWrap = document.getElementById("test-rank-wrap");
  const testRankLabel = document.getElementById("test-rank-label");
  const testRankSelect = document.getElementById("test-rank-select");
  const soundToggleEl = document.getElementById("sound-toggle");
  const soundIconEl = document.getElementById("sound-icon");
  const soundLabelEl = document.getElementById("sound-label");

  const viewYard = document.getElementById("view-yard");
  const viewWorkbench = document.getElementById("view-workbench");
  const viewSummary = document.getElementById("view-summary");

  const heroDoozerWrap = document.getElementById("hero-doozer-wrap");
  const homeRankBadge = document.getElementById("home-rank-badge");
  const homeRankTitle = document.getElementById("home-rank-title");
  const homeRankBlurb = document.getElementById("home-rank-blurb");
  const homeRankMeta = document.getElementById("home-rank-meta");
  const homePipsWrap = document.getElementById("home-pips-wrap");
  const btnPlayShift = document.getElementById("btn-play-shift");
  const btnPlayTest = document.getElementById("btn-play-test");
  const homeLockNote = document.getElementById("home-lock-note");
  const rankLadderEl = document.getElementById("rank-ladder");
  const statBestScore = document.getElementById("stat-best-score");
  const statBestTower = document.getElementById("stat-best-tower");
  const statLevelsBuilt = document.getElementById("stat-levels-built");
  const statAccuracy = document.getElementById("stat-accuracy");
  const btnResetProgress = document.getElementById("btn-reset-progress");

  const btnQuitShift = document.getElementById("btn-quit-shift");
  const wbTitle = document.getElementById("wb-title");
  const wbSubtitle = document.getElementById("wb-subtitle");
  const hudQuestion = document.getElementById("hud-question");
  const hudTowerChip = document.getElementById("hud-tower-chip");
  const hudTower = document.getElementById("hud-tower");
  const hudScoreChip = document.getElementById("hud-score-chip");
  const hudScore = document.getElementById("hud-score");
  const hudRank = document.getElementById("hud-rank");

  const blueprintTimerEl = document.getElementById("blueprint-timer");
  const blueprintTimerFill = document.getElementById("blueprint-timer-fill");
  const blueprintTimerText = document.getElementById("blueprint-timer-text");
  const blueprintCardEl = document.getElementById("blueprint-card");
  const orderModeBadge = document.getElementById("order-mode-badge");
  const triangleHolderEl = document.getElementById("triangle-holder");
  const equationLineEl = document.getElementById("equation-line");
  const bridgeHintEl = document.getElementById("bridge-hint");
  const orderFeedback = document.getElementById("order-feedback");
  const keypadKeysEl = document.getElementById("keypad-keys");

  const towerStageEl = document.getElementById("tower-stage");
  const towerMeterText = document.getElementById("tower-meter-text");
  const trussPipsEl = document.getElementById("truss-pips");
  const cavernSceneWrap = document.getElementById("cavern-scene-wrap");
  const stageEffectsEl = document.getElementById("stage-effects");
  const stageOverlayEl = document.getElementById("stage-overlay");

  const sumHeadEl = document.getElementById("sum-head");
  const sumTitleEl = document.getElementById("sum-title");
  const sumSubEl = document.getElementById("sum-sub");
  const sumAccuracyEl = document.getElementById("sum-accuracy");
  const sumRatioEl = document.getElementById("sum-ratio");
  const sumAvgTimeEl = document.getElementById("sum-avg-time");
  const sumTowerEl = document.getElementById("sum-tower");
  const sumBuiltEl = document.getElementById("sum-built");
  const sumScoreEl = document.getElementById("sum-score");
  const sumEventsEl = document.getElementById("sum-events");
  const sumShowcaseWrap = document.getElementById("sum-showcase-wrap");
  const sumShowcaseLabel = document.getElementById("sum-showcase-label");
  const sumShowcaseBox = document.getElementById("sum-showcase-box");
  const sumMissesWrap = document.getElementById("sum-misses-wrap");
  const sumMissesGrid = document.getElementById("sum-misses-grid");
  const btnSumTest = document.getElementById("btn-sum-test");
  const btnSumPlay = document.getElementById("btn-sum-play");
  const btnSumYard = document.getElementById("btn-sum-yard");

  if (!viewYard || !viewWorkbench || !viewSummary || !cavernSceneWrap) return;

  // --------------------------------------------------------------- helpers --
  const SVG_NS = "http://www.w3.org/2000/svg";
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  const timers = new Set();

  function queueTask(fn, ms) {
    const delay = reducedMotion ? Math.min(ms, 80) : ms;
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.add(id);
    return id;
  }

  function clearTasks() {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  }

  function randInt(lo, hi) {
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatScore(n) {
    if (window.MathArcade && typeof MathArcade.formatScore === "function") {
      return MathArcade.formatScore(n);
    }
    return Number(n || 0).toLocaleString();
  }

  function isTopRank(rank) {
    return rank === RANKS[RANKS.length - 1];
  }

  function nextRank(rank) {
    return RANKS[Math.min(RANKS.length - 1, RANKS.indexOf(rank) + 1)];
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => el.setAttribute(k, String(attrs[k])));
    }
    return el;
  }

  // ----------------------------------------------------------- save state --
  function defaultSave() {
    return {
      version: 1,
      rank: "C",
      roundsAtRank: 0,
      testAttempts: 0,
      bestScore: 0,
      stats: {
        shiftsPlayed: 0,
        levelsBuilt: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        bestTower: 0
      }
    };
  }

  function num(val, fallback) {
    return typeof val === "number" && Number.isFinite(val) && val >= 0 ? val : fallback;
  }

  function parseSave(raw) {
    const out = defaultSave();
    if (!raw || typeof raw !== "object") return out;
    out.rank = RANKS.includes(raw.rank) ? raw.rank : "C";
    out.roundsAtRank = Math.min(ROUNDS_TO_TEST, Math.floor(num(raw.roundsAtRank, 0)));
    out.testAttempts = Math.floor(num(raw.testAttempts, 0));
    out.bestScore = Math.floor(num(raw.bestScore, 0));
    if (raw.stats && typeof raw.stats === "object") {
      out.stats = {
        shiftsPlayed: Math.floor(num(raw.stats.shiftsPlayed, 0)),
        levelsBuilt: Math.floor(num(raw.stats.levelsBuilt, 0)),
        totalCorrect: Math.floor(num(raw.stats.totalCorrect, 0)),
        totalAnswered: Math.floor(num(raw.stats.totalAnswered, 0)),
        bestTower: Math.floor(num(raw.stats.bestTower, 0))
      };
    }
    return out;
  }

  function loadLocalSave() {
    try {
      const text = window.localStorage.getItem(LOCAL_SAVE_KEY);
      return text ? parseSave(JSON.parse(text)) : defaultSave();
    } catch (_) {
      return defaultSave();
    }
  }

  function writeLocalSave(save) {
    try {
      window.localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(save));
    } catch (_) { /* ignore storage restrictions */ }
  }

  function canTakeTest(save) {
    return !isTopRank(save.rank) && save.roundsAtRank >= ROUNDS_TO_TEST;
  }

  let saveData = loadLocalSave();
  let rankOverride = null;
  let currentView = "yard"; // yard | workbench | summary

  function activePlayRank() {
    return rankOverride || saveData.rank;
  }

  async function syncSaveToArcade(save, scoreToSubmit) {
    if (!window.MathArcade) return;
    try {
      if (scoreToSubmit > 0 && typeof MathArcade.submitScore === "function") {
        await MathArcade.submitScore(GAME_ID, scoreToSubmit);
      }
      if (typeof MathArcade.saveProgress === "function") {
        await MathArcade.saveProgress(GAME_ID, RANKS.indexOf(save.rank) + 1, {
          rank: save.rank,
          roundsAtRank: save.roundsAtRank,
          testAttempts: save.testAttempts,
          bestScore: save.bestScore,
          stats: save.stats
        });
      }
    } catch (err) {
      console.warn("Doozer Towers: MathArcade sync failed", err);
    }
  }

  async function hydrateFromArcade() {
    if (!window.MathArcade || typeof MathArcade.loadProgress !== "function") return;
    try {
      const row = await MathArcade.loadProgress(GAME_ID);
      if (row && row.exists !== false && row.statsJson) {
        let parsed = null;
        try {
          parsed = typeof row.statsJson === "string" ? JSON.parse(row.statsJson) : row.statsJson;
        } catch (_) {
          parsed = null;
        }
        if (parsed && typeof parsed === "object") {
          saveData = parseSave(parsed);
          writeLocalSave(saveData);
          if (currentView === "yard") renderYard();
        }
      }
    } catch (err) {
      console.warn("Doozer Towers: could not load remote progress", err);
    }
  }

  // ------------------------------------------------ fact family generator --
  function makeQuestionFromFamily(a, b, missingSide, equationMode, isSibling) {
    const product = a * b;
    const answer = missingSide === "right" ? b : a;
    const known = missingSide === "right" ? a : b;
    return {
      factorA: a,
      factorB: b,
      product,
      missingSide, // "right" | "left"
      equationMode, // "quotient" | "missingDivisor"
      known,
      answer,
      familyKey: `${Math.min(a, b)}x${Math.max(a, b)}`,
      isSibling: Boolean(isSibling)
    };
  }

  function candidatePairsForRank(rank) {
    const pairs = [];
    if (rank === "C") {
      // Friendly divisors 2, 3, 5, 10 with quotients 2..10
      const divisors = [2, 3, 5, 10];
      divisors.forEach((d) => {
        for (let q = 2; q <= 10; q += 1) {
          pairs.push([d, q]);
        }
      });
      return pairs;
    }
    if (rank === "B") {
      // Growing families 2, 3, 4, 5, 6, 10 — double-weight 3, 4, 6
      const primary = [3, 4, 6];
      const secondary = [2, 5, 10];
      primary.forEach((d) => {
        for (let q = 2; q <= 10; q += 1) {
          pairs.push([d, q]);
          pairs.push([d, q]);
        }
      });
      secondary.forEach((d) => {
        for (let q = 3; q <= 10; q += 1) {
          pairs.push([d, q]);
        }
      });
      return pairs;
    }
    if (rank === "A") {
      // Full 2..10 families, heavily weighted on 6, 7, 8, 9
      for (let a = 6; a <= 9; a += 1) {
        for (let b = 3; b <= 10; b += 1) {
          pairs.push([a, b]);
          pairs.push([a, b]);
        }
      }
      for (let a = 3; a <= 5; a += 1) {
        for (let b = 4; b <= 10; b += 1) {
          pairs.push([a, b]);
        }
      }
      return pairs;
    }
    // Rank S: full 2..12 families with strong focus on 6..12 including 11s & 12s
    for (let a = 6; a <= 12; a += 1) {
      for (let b = 4; b <= 12; b += 1) {
        if (a === 10 && b <= 6) continue;
        pairs.push([a, b]);
        if (a >= 7 || b >= 11) pairs.push([a, b]);
      }
    }
    return pairs;
  }

  function buildShiftQuestions(rank) {
    const rules = RANK_RULES[rank];
    const total = rules.levels;
    const pool = shuffle(candidatePairsForRank(rank));
    const usedFamilyKeys = new Set();
    const chosenFamilies = [];

    // Decide how many sibling pairs (two division facts from the same fact family) to include
    const siblingPairCount = rank === "C" ? 2 : rank === "B" ? 3 : 4;

    for (let i = 0; i < pool.length && chosenFamilies.length < total; i += 1) {
      const [a, b] = pool[i];
      const key = `${Math.min(a, b)}x${Math.max(a, b)}`;
      if (usedFamilyKeys.has(key)) continue;
      usedFamilyKeys.add(key);
      chosenFamilies.push([a, b]);
    }

    const firstHalf = [];
    const secondHalf = [];
    let pairsMade = 0;

    for (let i = 0; i < chosenFamilies.length; i += 1) {
      if (firstHalf.length + secondHalf.length >= total) break;
      const [rawA, rawB] = chosenFamilies[i];
      const canPair = rawA !== rawB && pairsMade < siblingPairCount && (firstHalf.length + secondHalf.length + 2 <= total);

      // For Rank C, keep the friendly divisor (2, 3, 5, 10) on the left when single, or both when paired if both are friendly
      const friendlySet = new Set([2, 3, 5, 10]);
      const validCSibling = rank !== "C" || (friendlySet.has(rawA) && friendlySet.has(rawB));

      if (canPair && validCSibling) {
        pairsMade += 1;
        const eqMode1 = Math.random() < rules.missingDivisorChance ? "missingDivisor" : "quotient";
        const eqMode2 = Math.random() < rules.missingDivisorChance ? "missingDivisor" : "quotient";
        if (rules.bothCorners) {
          // Same triangle orientation (rawA left, rawB right), first hides right, sibling hides left!
          firstHalf.push(makeQuestionFromFamily(rawA, rawB, "right", eqMode1, false));
          secondHalf.push(makeQuestionFromFamily(rawA, rawB, "left", eqMode2, true));
        } else {
          // Rank C always hides right corner, so flip bottom corners for sibling!
          firstHalf.push(makeQuestionFromFamily(rawA, rawB, "right", "quotient", false));
          secondHalf.push(makeQuestionFromFamily(rawB, rawA, "right", "quotient", true));
        }
      } else {
        const missingSide = rules.bothCorners && Math.random() < 0.5 ? "left" : "right";
        const eqMode = Math.random() < rules.missingDivisorChance ? "missingDivisor" : "quotient";
        // Ensure Rank C puts the friendly divisor on the left
        let a = rawA;
        let b = rawB;
        if (rank === "C" && !friendlySet.has(a) && friendlySet.has(b)) {
          [a, b] = [b, a];
        }
        const q = makeQuestionFromFamily(a, b, missingSide, eqMode, false);
        if (firstHalf.length <= secondHalf.length) {
          firstHalf.push(q);
        } else {
          secondHalf.push(q);
        }
      }
    }

    // Interleave shuffled halves so sibling facts from the same family appear several blueprints apart
    const deckA = shuffle(firstHalf);
    const deckB = shuffle(secondHalf);
    const result = [];
    // Put first ~half from deckA, then weave deckB so every sibling comes AFTER its partner
    const split = Math.ceil(deckA.length * 0.65);
    result.push(...deckA.slice(0, split));
    const tail = shuffle([...deckA.slice(split), ...deckB]);
    result.push(...tail);

    // Ensure no two identical questions back-to-back and mark sibling flag accurately based on appearance order
    const seenFamily = new Set();
    result.forEach((q) => {
      q.isSibling = seenFamily.has(q.familyKey);
      seenFamily.add(q.familyKey);
    });

    return result.slice(0, total);
  }

  // -------------------------------------- Authentic Fraggle Rock Doozer SVG --
  /**
   * Draws an authentic classic Jim Henson Fraggle Rock Doozer:
   * - Plump minty-green body (no overalls/shirt — bare green belly) + small stubby tail-nub
   * - Criss-cross tan tool harness, waist tool belt with wrench, coiled rope & tiny silver calculator
   * - Chunky tan cuffed work gloves & big sturdy tan/yellow-trimmed construction boots
   * - Spherical green head, close-set Muppet eyes, iconic big bulbous round green nose, hair tufts
   * - Two cute short pink antennae poking up through notches in the oversized hard hat
   * - Authentic hard hat colors + headlamp (worker), Bull Doozer rank disk (bulldoozer), or drafting visor (architect)
   */
  function buildDoozerGroup(opts = {}) {
    const {
      x = 0,
      y = 0,
      scale = 1,
      flip = false,
      helmet = HELMET_PALETTES[0],
      role = "worker", // worker | bulldoozer | architect
      expression = "neutral", // neutral | happy | whoa
      pose = "holdStick", // holdStick | cheer | whoa | blueprint
      mustache = false,
      hairColor = "#a84a2a"
    } = opts;

    const sx = flip ? -scale : scale;
    const g = svgEl("g", {
      transform: `translate(${x}, ${y}) scale(${sx}, ${scale})`,
      class: "doozer-character"
    });

    const skin = "#88cc82";
    const skinShade = "#66ab62";
    const skinLight = "#b2e6ab";
    const outline = "#294227";
    const leather = "#d6b888";
    const leatherDark = "#997646";
    const bootTrim = "#f4d462";

    // Subtle ground shadow (when standing)
    if (!opts.noShadow) {
      g.append(svgEl("ellipse", { cx: 0, cy: 2, rx: 24, ry: 5.5, fill: "rgba(35, 22, 12, 0.28)" }));
    }

    // Small stubby green Doozer tail-nub peeking out at back
    g.append(
      svgEl("path", {
        d: "M17 -26 C26 -29 29 -22 23 -17 C19 -15 16 -17 15 -20 Z",
        fill: skinShade,
        stroke: outline,
        "stroke-width": 2.4,
        "stroke-linejoin": "round"
      })
    );

    // Big sturdy Doozer construction boots (chunky & stable)
    const drawBoot = (cx, dir) => {
      const bg = svgEl("g");
      // Short green leg into boot
      bg.append(svgEl("rect", { x: cx - 7, y: -23, width: 14, height: 11, rx: 5, fill: skin, stroke: outline, "stroke-width": 2.2 }));
      // Yellow ankle collar trim
      bg.append(svgEl("rect", { x: cx - 8.5, y: -15, width: 17, height: 4.5, rx: 2, fill: bootTrim, stroke: outline, "stroke-width": 1.8 }));
      // Chunky tan boot body
      const d = dir < 0
        ? `M${cx - 8} -11 L${cx + 8} -11 L${cx + 9} -2 L${cx - 14} -2 C${cx - 16} -2 ${cx - 16} -8 ${cx - 10} -10 Z`
        : `M${cx - 8} -11 L${cx + 8} -11 L${cx + 10} -10 C${cx + 16} -8 ${cx + 16} -2 ${cx + 14} -2 L${cx - 9} -2 Z`;
      bg.append(svgEl("path", { d, fill: leather, stroke: outline, "stroke-width": 2.3, "stroke-linejoin": "round" }));
      // Thick treaded sole
      const sx1 = dir < 0 ? cx - 15 : cx - 9;
      bg.append(svgEl("rect", { x: sx1, y: -3.2, width: 24, height: 4.2, rx: 2, fill: "#694e2c", stroke: outline, "stroke-width": 1.8 }));
      return bg;
    };
    g.append(drawBoot(-10, -1), drawBoot(10, 1));

    // Plump bare minty-green Doozer torso (classic Doozers wear NO shirt/overalls!)
    g.append(
      svgEl("path", {
        d: "M-17 -54 C-22 -42 -22 -24 -13 -19 C-5 -15 5 -15 13 -19 C22 -24 22 -42 17 -54 C12 -60 -12 -60 -17 -54 Z",
        fill: skin,
        stroke: outline,
        "stroke-width": 2.6
      }),
      // Side shading & belly highlight
      svgEl("path", {
        d: "M10 -53 C18 -42 19 -26 11 -20 C16 -27 16 -41 8 -52 Z",
        fill: skinShade,
        opacity: 0.65
      }),
      svgEl("ellipse", { cx: -5, cy: -38, rx: 6, ry: 10, fill: skinLight, opacity: 0.5 })
    );

    // Authentic Criss-Cross Tan Chest Harness & Waist Tool Belt (like Flange Doozer)
    g.append(
      svgEl("path", { d: "M-13 -54 L13 -27", stroke: leather, "stroke-width": 5.5, "stroke-linecap": "round" }),
      svgEl("path", { d: "M-13 -54 L13 -27", stroke: leatherDark, "stroke-width": 1.2, "stroke-dasharray": "3 3" }),
      svgEl("path", { d: "M13 -54 L-13 -27", stroke: leather, "stroke-width": 5.5, "stroke-linecap": "round" }),
      svgEl("path", { d: "M13 -54 L-13 -27", stroke: leatherDark, "stroke-width": 1.2, "stroke-dasharray": "3 3" }),
      // Center harness clasp
      svgEl("circle", { cx: 0, cy: -40.5, r: 4, fill: "#e6b83e", stroke: outline, "stroke-width": 1.6 }),
      // Sturdy waist tool belt
      svgEl("rect", { x: -19.5, y: -30, width: 39, height: 7.5, rx: 3.5, fill: "#bd9762", stroke: outline, "stroke-width": 2.1 }),
      // Brass belt buckle
      svgEl("rect", { x: -5, y: -31, width: 10, height: 9.5, rx: 2.5, fill: "#f2c94c", stroke: outline, "stroke-width": 1.8 }),
      // Left hip: miniature coiled rope loop
      svgEl("ellipse", { cx: -16, cy: -22, rx: 4.2, ry: 5.2, fill: "none", stroke: "#ead4a4", "stroke-width": 2.4 }),
      svgEl("ellipse", { cx: -16, cy: -22, rx: 4.2, ry: 5.2, fill: "none", stroke: leatherDark, "stroke-width": 0.9 }),
      // Right hip: tiny silver pocket calculator / tool pouch (canonical Flange detail!)
      svgEl("rect", { x: 11, y: -27, width: 8.5, height: 10, rx: 2, fill: "#d7e0e6", stroke: outline, "stroke-width": 1.6 }),
      svgEl("rect", { x: 12.6, y: -25.4, width: 5.3, height: 2.6, rx: 0.6, fill: "#48685c" })
    );

    // Arms, chunky cuffed work gloves, and props by pose
    if (pose === "cheer") {
      // Both arms raised high in triumph!
      g.append(
        svgEl("path", { d: "M-16 -49 C-27 -56 -32 -68 -29 -78", fill: "none", stroke: skin, "stroke-width": 9, "stroke-linecap": "round" }),
        svgEl("path", { d: "M-16 -49 C-27 -56 -32 -68 -29 -78", fill: "none", stroke: outline, "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.35 }),
        svgEl("path", { d: "M16 -49 C27 -56 32 -68 29 -78", fill: "none", stroke: skin, "stroke-width": 9, "stroke-linecap": "round" }),
        // Left & right chunky cuffed work gloves
        svgEl("circle", { cx: -29, cy: -80, r: 7.2, fill: leather, stroke: outline, "stroke-width": 2.1 }),
        svgEl("rect", { x: -34, y: -74, width: 10, height: 4, rx: 1.5, fill: bootTrim, stroke: outline, "stroke-width": 1.5, transform: "rotate(-18 -29 -72)" }),
        svgEl("circle", { cx: 29, cy: -80, r: 7.2, fill: leather, stroke: outline, "stroke-width": 2.1 }),
        svgEl("rect", { x: 24, y: -74, width: 10, height: 4, rx: 1.5, fill: bootTrim, stroke: outline, "stroke-width": 1.5, transform: "rotate(18 29 -72)" })
      );
    } else if (pose === "whoa") {
      // Arms flung out wide in startled "Whoa!" balance
      g.append(
        svgEl("path", { d: "M-16 -48 C-28 -50 -36 -58 -38 -64", fill: "none", stroke: skin, "stroke-width": 8.5, "stroke-linecap": "round" }),
        svgEl("path", { d: "M16 -48 C28 -50 36 -58 38 -64", fill: "none", stroke: skin, "stroke-width": 8.5, "stroke-linecap": "round" }),
        svgEl("circle", { cx: -39, cy: -66, r: 7, fill: leather, stroke: outline, "stroke-width": 2.1 }),
        svgEl("circle", { cx: 39, cy: -66, r: 7, fill: leather, stroke: outline, "stroke-width": 2.1 })
      );
    } else if (pose === "blueprint") {
      // Hero Doozer holding a glowing translucent radish Doozer stick in one hand & rolled blueprint in the other!
      g.append(
        // Left arm holding rolled blueprint
        svgEl("path", { d: "M-16 -48 C-26 -45 -30 -39 -28 -35", fill: "none", stroke: skin, "stroke-width": 8.5, "stroke-linecap": "round" }),
        svgEl("rect", { x: -42, y: -42, width: 22, height: 7.5, rx: 3.5, fill: "#bfe3ff", stroke: "#2b5b8c", "stroke-width": 1.8, transform: "rotate(-26 -30 -38)" }),
        svgEl("circle", { cx: -28, cy: -35, r: 6.8, fill: leather, stroke: outline, "stroke-width": 2 }),
        // Right arm holding a glowing translucent green-yellow Doozer stick!
        svgEl("path", { d: "M16 -48 C26 -48 31 -56 32 -63", fill: "none", stroke: skin, "stroke-width": 8.5, "stroke-linecap": "round" }),
        svgEl("line", { x1: 20, y1: -36, x2: 46, y2: -94, stroke: "#59c947", "stroke-width": 7, "stroke-linecap": "round", opacity: 0.9 }),
        svgEl("line", { x1: 20, y1: -36, x2: 46, y2: -94, stroke: "#e7ffb5", "stroke-width": 2.6, "stroke-linecap": "round" }),
        svgEl("circle", { cx: 46, cy: -94, r: 3.5, fill: "#d8ff96", stroke: "#2f7d32", "stroke-width": 1.4 }),
        svgEl("circle", { cx: 32, cy: -63, r: 7, fill: leather, stroke: outline, "stroke-width": 2.1 })
      );
    } else {
      // Default worker pose: holding a glowing translucent radish Doozer stick ready to build!
      g.append(
        svgEl("path", { d: "M-16 -48 C-25 -43 -27 -35 -23 -32", fill: "none", stroke: skin, "stroke-width": 8.5, "stroke-linecap": "round" }),
        svgEl("circle", { cx: -23, cy: -32, r: 6.6, fill: leather, stroke: outline, "stroke-width": 2 }),
        svgEl("path", { d: "M16 -48 C26 -47 30 -55 31 -61", fill: "none", stroke: skin, "stroke-width": 8.5, "stroke-linecap": "round" }),
        // Glowing translucent radish Doozer stick
        svgEl("line", { x1: 23, y1: -39, x2: 43, y2: -87, stroke: "#59c947", "stroke-width": 6.4, "stroke-linecap": "round", opacity: 0.92 }),
        svgEl("line", { x1: 23, y1: -39, x2: 43, y2: -87, stroke: "#ecffc2", "stroke-width": 2.2, "stroke-linecap": "round" }),
        svgEl("circle", { cx: 31, cy: -61, r: 6.8, fill: leather, stroke: outline, "stroke-width": 2 })
      );
    }

    // Large spherical green Doozer head
    g.append(
      // Little tufts of reddish/brown hair peeking from beneath helmet sides (authentic Cotterpin/Flange look)
      svgEl("path", {
        d: "M-27 -78 C-32 -74 -31 -67 -24 -66 C-26 -71 -25 -75 -22 -78 Z",
        fill: hairColor,
        stroke: outline,
        "stroke-width": 1.6
      }),
      svgEl("path", {
        d: "M27 -78 C32 -74 31 -67 24 -66 C26 -71 25 -75 22 -78 Z",
        fill: hairColor,
        stroke: outline,
        "stroke-width": 1.6
      }),
      // Spherical mint-green head
      svgEl("circle", { cx: 0, cy: -74, r: 24.5, fill: skin, stroke: outline, "stroke-width": 2.6 }),
      // Subtle cheek highlight & lower shadow
      svgEl("path", { d: "M14 -92 A24 24 0 0 1 11 -52 A22 22 0 0 0 14 -92 Z", fill: skinShade, opacity: 0.48 }),
      svgEl("ellipse", { cx: -12, cy: -66, rx: 4.5, ry: 2.6, fill: "#69b065", opacity: 0.45 }),
      svgEl("ellipse", { cx: 12, cy: -66, rx: 4.5, ry: 2.6, fill: "#69b065", opacity: 0.45 })
    );

    // Expressive Muppet Eyes (close-set, bright & open right above the bulbous nose)
    if (expression === "happy") {
      g.append(
        svgEl("ellipse", { cx: -7.5, cy: -80.5, rx: 5.4, ry: 5.8, fill: "#fff", stroke: outline, "stroke-width": 2 }),
        svgEl("ellipse", { cx: 7.5, cy: -80.5, rx: 5.4, ry: 5.8, fill: "#fff", stroke: outline, "stroke-width": 2 }),
        svgEl("circle", { cx: -6.8, cy: -80.5, r: 2.5, fill: "#1a1f1c" }),
        svgEl("circle", { cx: 6.8, cy: -80.5, r: 2.5, fill: "#1a1f1c" }),
        svgEl("circle", { cx: -8, cy: -82.4, r: 1.25, fill: "#fff" }),
        svgEl("circle", { cx: 5.6, cy: -82.4, r: 1.25, fill: "#fff" }),
        // Warm rosy-lime happy cheek crinkles
        svgEl("ellipse", { cx: -14, cy: -67, rx: 4.5, ry: 2.4, fill: "#69b065", opacity: 0.65 }),
        svgEl("ellipse", { cx: 14, cy: -67, rx: 4.5, ry: 2.4, fill: "#69b065", opacity: 0.65 })
      );
    } else if (expression === "whoa") {
      g.append(
        svgEl("circle", { cx: -7.5, cy: -80, r: 6, fill: "#fff", stroke: outline, "stroke-width": 2 }),
        svgEl("circle", { cx: 7.5, cy: -80, r: 6, fill: "#fff", stroke: outline, "stroke-width": 2 }),
        svgEl("circle", { cx: -7.5, cy: -79.5, r: 2.4, fill: "#1a1f1c" }),
        svgEl("circle", { cx: 7.5, cy: -79.5, r: 2.4, fill: "#1a1f1c" })
      );
    } else {
      g.append(
        svgEl("ellipse", { cx: -7.2, cy: -80, rx: 5.2, ry: 5.6, fill: "#fff", stroke: outline, "stroke-width": 2 }),
        svgEl("ellipse", { cx: 7.2, cy: -80, rx: 5.2, ry: 5.6, fill: "#fff", stroke: outline, "stroke-width": 2 }),
        svgEl("circle", { cx: -6.4, cy: -79.5, r: 2.5, fill: "#1a1f1c" }),
        svgEl("circle", { cx: 6.4, cy: -79.5, r: 2.5, fill: "#1a1f1c" }),
        svgEl("circle", { cx: -7.7, cy: -81.4, r: 1.2, fill: "#fff" }),
        svgEl("circle", { cx: 5.1, cy: -81.4, r: 1.2, fill: "#fff" })
      );
    }

    // Mouth (below the nose)
    if (expression === "whoa") {
      g.append(
        svgEl("ellipse", { cx: 0, cy: -58, rx: 4.8, ry: 5.8, fill: "#52252a", stroke: outline, "stroke-width": 2 })
      );
    } else if (expression === "happy") {
      g.append(
        svgEl("path", { d: "M-11 -62 Q0 -50 11 -62 Z", fill: "#52252a", stroke: outline, "stroke-width": 2, "stroke-linejoin": "round" }),
        svgEl("path", { d: "M-5 -57 Q0 -54 5 -57", fill: "none", stroke: "#ea7f8c", "stroke-width": 2.4, "stroke-linecap": "round" })
      );
    } else {
      g.append(
        svgEl("path", { d: "M-10 -61 Q0 -54 10 -61", fill: "none", stroke: outline, "stroke-width": 2.4, "stroke-linecap": "round" })
      );
    }

    // Optional Flange-style bushy mustache under the bulbous nose
    if (mustache) {
      g.append(
        svgEl("path", {
          d: "M-12 -64 C-8 -69 -2 -68 0 -65 C2 -68 8 -69 12 -64 C9 -60 4 -61 0 -63 C-4 -61 -9 -60 -12 -64 Z",
          fill: hairColor,
          stroke: outline,
          "stroke-width": 1.6
        })
      );
    }

    // Iconic bulbous round Muppet Doozer nose (sits prominently between/below eyes!)
    g.append(
      svgEl("ellipse", { cx: 0, cy: -71, rx: 9.2, ry: 7.4, fill: "#95d98e", stroke: outline, "stroke-width": 2.2 }),
      svgEl("ellipse", { cx: -2.6, cy: -73.5, rx: 3.1, ry: 1.8, fill: "#d2f7cc", opacity: 0.78 })
    );

    // Oversized Doozer Construction Helmet (Hard Hat) + Pink Antennae poking through notches!
    const tilt = expression === "whoa" ? "rotate(-9 0 -92)" : "";
    const hatG = svgEl("g", tilt ? { transform: tilt } : null);

    // Helmet dome
    hatG.append(
      svgEl("path", {
        d: "M-27 -84 C-27 -109 -15 -118 0 -118 C15 -118 27 -109 27 -84 Z",
        fill: helmet.main,
        stroke: outline,
        "stroke-width": 2.6,
        "stroke-linejoin": "round"
      }),
      // Center construction ridge
      svgEl("path", {
        d: "M-5 -117 C-5 -121 5 -121 5 -117 L4 -86 L-4 -86 Z",
        fill: helmet.highlight,
        stroke: outline,
        "stroke-width": 2
      }),
      // Curved side shadow on dome
      svgEl("path", {
        d: "M12 -114 C22 -108 26 -97 26 -84 L17 -84 C17 -96 15 -106 10 -113 Z",
        fill: helmet.shade,
        opacity: 0.45
      }),
      // Wide curved front brim
      svgEl("path", {
        d: "M-31 -84 C-20 -79 20 -79 31 -84 C32 -88 26 -90 0 -90 C-26 -90 -32 -88 -31 -84 Z",
        fill: helmet.shade,
        stroke: outline,
        "stroke-width": 2.4,
        "stroke-linejoin": "round"
      }),
      svgEl("path", {
        d: "M-27 -86 C-15 -82 15 -82 27 -86",
        fill: "none",
        stroke: helmet.highlight,
        "stroke-width": 2,
        "stroke-linecap": "round"
      })
    );

    // Canonical Two Pink/Coral Antennae emerging upward through notches at front of helmet!
    hatG.append(
      svgEl("path", { d: "M-9 -108 C-11 -117 -13 -122 -16 -125", fill: "none", stroke: "#f08fa0", "stroke-width": 3.2, "stroke-linecap": "round" }),
      svgEl("circle", { cx: -16.5, cy: -125.5, r: 3, fill: "#ffb8c5", stroke: "#9e485a", "stroke-width": 1.4 }),
      svgEl("path", { d: "M9 -108 C11 -117 13 -122 16 -125", fill: "none", stroke: "#f08fa0", "stroke-width": 3.2, "stroke-linecap": "round" }),
      svgEl("circle", { cx: 16.5, cy: -125.5, r: 3, fill: "#ffb8c5", stroke: "#9e485a", "stroke-width": 1.4 })
    );

    // Role-specific canonical Fraggle Rock headgear badge
    if (role === "bulldoozer") {
      // Canonical Bull Doozer Rank Disk on front of helmet (like Flange & Wingnut!)
      hatG.append(
        svgEl("circle", { cx: 0, cy: -102, r: 9.5, fill: "#fff7d6", stroke: "#9c6008", "stroke-width": 2.4 }),
        svgEl("circle", { cx: 0, cy: -102, r: 5.5, fill: "#f59e0b", stroke: "#9c6008", "stroke-width": 1.5 }),
        svgEl("circle", { cx: 0, cy: -102, r: 2.2, fill: "#fff" })
      );
    } else if (role === "architect") {
      // Architect / Cotterpin translucent green-cyan drafting visor + glowing lamp!
      hatG.append(
        svgEl("path", {
          d: "M-24 -84 C-12 -74 12 -74 24 -84 L20 -89 C10 -83 -10 -83 -20 -89 Z",
          fill: "rgba(95, 224, 194, 0.56)",
          stroke: "#11695e",
          "stroke-width": 1.8
        }),
        svgEl("circle", { cx: 0, cy: -101, r: 6.5, fill: "#fff8c4", stroke: outline, "stroke-width": 2 }),
        svgEl("circle", { cx: 0, cy: -101, r: 3.5, fill: "#ffd45c" })
      );
    } else {
      // Standard Doozer worker glowing mining headlamp
      hatG.append(
        svgEl("circle", { cx: 0, cy: -101, r: 6.2, fill: "#fff7c2", stroke: outline, "stroke-width": 2 }),
        svgEl("circle", { cx: 0, cy: -101, r: 3.3, fill: "#ffd45c" })
      );
    }

    g.append(hatG);
    return g;
  }

  function renderHeroDoozer() {
    const playRank = activePlayRank();
    const role = RANK_RULES[playRank].heroRole;
    const helmet = playRank === "S"
      ? HELMET_PALETTES[6]
      : playRank === "A"
        ? HELMET_PALETTES[0]
        : playRank === "B"
          ? HELMET_PALETTES[2]
          : HELMET_PALETTES[0];

    const svg = svgEl("svg", {
      viewBox: "-66 -140 132 154",
      role: "img",
      "aria-label": "A Doozer construction worker holding a glowing radish-stick"
    });
    svg.append(
      buildDoozerGroup({
        x: -4,
        y: 6,
        scale: 1.02,
        helmet,
        role,
        expression: "happy",
        pose: "blueprint",
        mustache: role === "bulldoozer"
      })
    );
    heroDoozerWrap.replaceChildren(svg);
  }

  // ------------------------------------------- Fact Family Triangle SVG --
  function buildFactTriangleSvg(options) {
    const {
      product,
      factorA,
      factorB,
      missingSide, // "left" | "right" | null (null = complete!)
      typedText,
      revealState, // null | "right" | "wrong"
      showDivArrow,
      mini
    } = options;

    const svg = svgEl("svg", {
      viewBox: mini ? "0 0 120 106" : "0 0 280 216",
      class: "triangle-svg",
      role: "img",
      "aria-label": missingSide
        ? `Fact family triangle with product ${product} and factor ${missingSide === "right" ? factorA : factorB}`
        : `Completed fact family triangle: ${product}, ${factorA}, and ${factorB}`
    });

    if (mini) {
      // Compact triangle for Summary misses review
      const top = [60, 22];
      const left = [24, 84];
      const right = [96, 84];

      svg.append(
        svgEl("polygon", {
          points: `${top[0]},${top[1]} ${right[0]},${right[1]} ${left[0]},${left[1]}`,
          fill: "rgba(182, 245, 122, 0.25)",
          stroke: "#4db847",
          "stroke-width": 5,
          "stroke-linejoin": "round"
        }),
        svgEl("polygon", {
          points: `${top[0]},${top[1]} ${right[0]},${right[1]} ${left[0]},${left[1]}`,
          fill: "none",
          stroke: "#dcffaa",
          "stroke-width": 1.8,
          "stroke-linejoin": "round"
        })
      );

      const drawMiniNode = (cx, cy, val, isTop) => {
        svg.append(
          svgEl("circle", {
            cx,
            cy,
            r: 16,
            fill: isTop ? "#fff0be" : "#ffffff",
            stroke: isTop ? "#d97706" : "#2f7d32",
            "stroke-width": 2.6
          })
        );
        const t = svgEl("text", {
          x: cx,
          y: cy + 5,
          "text-anchor": "middle",
          "font-family": "Fredoka, Nunito, sans-serif",
          "font-size": 14,
          "font-weight": 700,
          fill: "#38281c"
        });
        t.textContent = String(val);
        svg.append(t);
      };

      drawMiniNode(top[0], top[1], product, true);
      drawMiniNode(left[0], left[1], factorA, false);
      drawMiniNode(right[0], right[1], factorB, false);

      const sym = svgEl("text", {
        x: 60,
        y: 66,
        "text-anchor": "middle",
        "font-family": "Fredoka, Nunito, sans-serif",
        "font-size": 12,
        "font-weight": 700,
        fill: "#2f7d32"
      });
      sym.textContent = "× ÷";
      svg.append(sym);
      return svg;
    }

    // Full interactive Fact Family Triangle made of luminous Doozer sticks
    const top = [140, 38];
    const left = [46, 174];
    const right = [234, 174];

    // Inner glow fill
    const fillTone = revealState === "right"
      ? "rgba(86, 224, 140, 0.24)"
      : revealState === "wrong"
        ? "rgba(232, 93, 104, 0.16)"
        : "rgba(182, 245, 122, 0.2)";

    const beamOuter = revealState === "wrong" ? "#e06270" : "#44b342";
    const beamCore = revealState === "wrong" ? "#ffc8ce" : "#e3ffad";

    svg.append(
      svgEl("polygon", {
        points: `${top[0]},${top[1]} ${right[0]},${right[1]} ${left[0]},${left[1]}`,
        fill: fillTone
      })
    );

    // Three translucent Doozer-stick beams
    const edges = [
      [top, left],
      [top, right],
      [left, right]
    ];
    edges.forEach(([p1, p2]) => {
      svg.append(
        svgEl("line", {
          x1: p1[0],
          y1: p1[1],
          x2: p2[0],
          y2: p2[1],
          stroke: "rgba(35, 92, 35, 0.24)",
          "stroke-width": 14,
          "stroke-linecap": "round"
        }),
        svgEl("line", {
          x1: p1[0],
          y1: p1[1],
          x2: p2[0],
          y2: p2[1],
          stroke: beamOuter,
          "stroke-width": 10.5,
          "stroke-linecap": "round"
        }),
        svgEl("line", {
          x1: p1[0],
          y1: p1[1],
          x2: p2[0],
          y2: p2[1],
          stroke: beamCore,
          "stroke-width": 4,
          "stroke-linecap": "round",
          opacity: 0.9
        })
      );
    });

    // Optional Rank C ÷ cue along the left edge
    if (showDivArrow && missingSide === "right") {
      const badge = svgEl("g");
      badge.append(
        svgEl("circle", { cx: 88, cy: 106, r: 14, fill: "#fff7e0", stroke: "#d97706", "stroke-width": 2.4 })
      );
      const t = svgEl("text", {
        x: 88,
        y: 112,
        "text-anchor": "middle",
        "font-family": "Fredoka, Nunito, sans-serif",
        "font-size": 19,
        "font-weight": 700,
        fill: "#a85106"
      });
      t.textContent = "÷";
      badge.append(t);
      svg.append(badge);
    }

    // Center × / ÷ medallion
    svg.append(
      svgEl("circle", { cx: 140, cy: 126, r: 24, fill: "rgba(255,255,255,0.94)", stroke: "#cce8b8", "stroke-width": 2.6 })
    );
    const medText = svgEl("text", {
      x: 140,
      y: 134,
      "text-anchor": "middle",
      "font-family": "Fredoka, Nunito, sans-serif",
      "font-size": 21,
      "font-weight": 700,
      fill: "#2f7d32"
    });
    medText.textContent = "× ÷";
    svg.append(medText);

    // Helper to draw each vertex node
    const drawCorner = (cx, cy, label, kind) => {
      const isTarget = kind === "target";
      const isTop = kind === "top";

      let fill = "#ffffff";
      let stroke = "#2f7d32";
      let textColor = "#38281c";
      let dash = null;

      if (isTop) {
        fill = "#fff0be";
        stroke = "#d97706";
        textColor = "#7c3b04";
      } else if (isTarget) {
        if (revealState === "right") {
          fill = "#dcf8ec";
          stroke = "#20936b";
          textColor = "#0e6348";
        } else if (revealState === "wrong") {
          fill = "#ffe4e8";
          stroke = "#d93f56";
          textColor = "#b42338";
        } else {
          fill = "#fff8db";
          stroke = "#d97706";
          textColor = typedText ? "#38281c" : "#c06608";
          dash = "6 4";
        }
      }

      if (isTarget && !revealState) {
        svg.append(
          svgEl("circle", {
            cx,
            cy,
            r: 34,
            fill: "rgba(245, 158, 11, 0.16)"
          })
        );
      }

      const circleAttrs = {
        cx,
        cy,
        r: isTop ? 30 : 28,
        fill,
        stroke,
        "stroke-width": 4
      };
      if (dash) circleAttrs["stroke-dasharray"] = dash;
      svg.append(svgEl("circle", circleAttrs));

      const txt = svgEl("text", {
        x: cx,
        y: cy + 9,
        "text-anchor": "middle",
        "font-family": "Fredoka, Nunito, sans-serif",
        "font-size": String(label).length >= 3 ? 23 : 27,
        "font-weight": 700,
        fill: textColor
      });
      txt.textContent = String(label);
      svg.append(txt);
    };

    const leftText = missingSide === "left"
      ? (revealState ? String(factorA) : (typedText || "?"))
      : String(factorA);
    const rightText = missingSide === "right"
      ? (revealState ? String(factorB) : (typedText || "?"))
      : String(factorB);

    drawCorner(top[0], top[1], product, "top");
    drawCorner(left[0], left[1], leftText, missingSide === "left" ? "target" : "known");
    drawCorner(right[0], right[1], rightText, missingSide === "right" ? "target" : "known");

    return svg;
  }

  // ----------------------------------- Triangular Doozer Tower Geometry --
  /**
   * Computes exact geometry for an H-level triangular truss Doozer tower:
   * Row 0 (top apex) has 1 upright triangle △
   * Row 1 has 2 upright triangles (plus 1 inverted bracing triangle) △▽△
   * ...
   * Row H-1 (base) has H upright triangles!
   * Every successful answer adds 1 more level, smoothly growing taller and more grand.
   */
  function computeTowerGeometry(levels, baseW = CAVERN_W, floorY = FLOOR_Y, maxHeight = 300, maxBaseW = 342) {
    if (levels <= 0) {
      return { levels: 0, sticks: [], nodes: [], apex: { x: baseW / 2, y: floorY }, baseLeft: baseW / 2, baseRight: baseW / 2, bayW: 58, bayH: 48 };
    }

    // Smoothly size bay width so 1..4 levels grow rapidly in height, then higher levels fit grandly up to 16
    const maxBayByHeight = maxHeight / (levels * 0.84);
    const maxBayByWidth = maxBaseW / levels;
    const capBay = levels <= 2 ? 62 : levels === 3 ? 58 : levels === 4 ? 54 : 50;
    const bayW = Math.min(capBay, maxBayByHeight, maxBayByWidth);
    const bayH = bayW * 0.84;

    const cx = baseW / 2;
    const totalH = levels * bayH;
    const apexY = floorY - totalH;

    const sticks = [];
    const nodeMap = new Map();
    const addNode = (x, y, row) => {
      const key = `${Math.round(x * 10)}_${Math.round(y * 10)}`;
      if (!nodeMap.has(key)) nodeMap.set(key, { x, y, row });
    };

    for (let r = 0; r < levels; r += 1) {
      // r = 0 is apex row (1 triangle), r = levels - 1 is base row (levels triangles)
      const count = r + 1;
      const topY = apexY + r * bayH;
      const botY = topY + bayH;
      const rowLeftX = cx - (count * bayW) / 2;
      const isNewest = r === 0; // Apex lifts up as new level snaps in!

      // Bottom horizontal beam segments for this row
      for (let i = 0; i < count; i += 1) {
        const x1 = rowLeftX + i * bayW;
        const x2 = x1 + bayW;
        sticks.push({ x1, y1: botY, x2, y2: botY, row: r, kind: "horiz", isNewest });
        addNode(x1, botY, r);
        addNode(x2, botY, r);
      }

      // Diagonal upright triangle sides
      for (let i = 0; i < count; i += 1) {
        const bxL = rowLeftX + i * bayW;
        const bxR = bxL + bayW;
        const tx = bxL + bayW / 2;
        sticks.push({ x1: bxL, y1: botY, x2: tx, y2: topY, row: r, kind: "diag", isNewest });
        sticks.push({ x1: bxR, y1: botY, x2: tx, y2: topY, row: r, kind: "diag", isNewest });
        addNode(tx, topY, r);
      }
    }

    return {
      levels,
      sticks,
      nodes: Array.from(nodeMap.values()),
      apex: { x: cx, y: apexY },
      baseLeft: cx - (levels * bayW) / 2,
      baseRight: cx + (levels * bayW) / 2,
      bayW,
      bayH
    };
  }

  // ----------------------------------------- Cavern & Tower SVG Renderer --
  let cavernSvg = null;
  let towerLayerEl = null;
  let debrisLayerEl = null;
  let crewLayerEl = null;
  let elevationLayerEl = null;
  let collapseRaf = 0;

  function stopCollapseAnim() {
    if (collapseRaf) {
      window.cancelAnimationFrame(collapseRaf);
      collapseRaf = 0;
    }
  }

  function buildCavernBackdrop(svg, w, h, floorY, compact) {
    const defs = svgEl("defs");

    const glowGrad = svgEl("radialGradient", { id: compact ? "cavernGlowMini" : "cavernGlow", cx: "50%", cy: "22%", r: "65%" });
    glowGrad.append(
      svgEl("stop", { offset: "0%", "stop-color": "#fff4cc", "stop-opacity": "0.52" }),
      svgEl("stop", { offset: "55%", "stop-color": "#f6c97a", "stop-opacity": "0.14" }),
      svgEl("stop", { offset: "100%", "stop-color": "#4f3422", "stop-opacity": "0" })
    );
    defs.append(glowGrad);

    const floorGrad = svgEl("linearGradient", { id: compact ? "rockFloorMini" : "rockFloor", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
    floorGrad.append(
      svgEl("stop", { offset: "0%", "stop-color": "#c99562" }),
      svgEl("stop", { offset: "24%", "stop-color": "#9c6b43" }),
      svgEl("stop", { offset: "100%", "stop-color": "#694329" })
    );
    defs.append(floorGrad);
    svg.append(defs);

    // Warm sunlit shaft inside Fraggle Rock cavern
    svg.append(svgEl("rect", { x: 0, y: 0, width: w, height: h, fill: `url(#${compact ? "cavernGlowMini" : "cavernGlow"})` }));

    // Distant rocky Fraggle Rock cave arches
    svg.append(
      svgEl("path", {
        d: `M0 0 L${w} 0 L${w} ${floorY} L${w - 34} ${floorY} C${w - 28} ${floorY * 0.45} ${w * 0.78} 38 ${w * 0.5} 34 C${w * 0.22} 38 28 ${floorY * 0.45} 34 ${floorY} L0 ${floorY} Z`,
        fill: "#4a3120",
        opacity: 0.44
      }),
      // Stalactite & warm cave rock outcrops
      svgEl("path", {
        d: `M0 0 L108 0 C96 28 74 44 58 64 C46 42 22 60 0 88 Z`,
        fill: "#3e281a",
        opacity: 0.55
      }),
      svgEl("path", {
        d: `M${w} 0 L${w - 114} 0 C${w - 94} 24 ${w - 72} 42 ${w - 56} 62 C${w - 42} 38 ${w - 20} 58 ${w} 84 Z`,
        fill: "#3e281a",
        opacity: 0.55
      })
    );

    // Glowing Fraggle Rock crystal clusters tucked on the side rock ledges
    const drawCrystal = (cx, cy, s, color) => {
      const cg = svgEl("g", { transform: `translate(${cx}, ${cy}) scale(${s})`, opacity: 0.85 });
      cg.append(
        svgEl("polygon", { points: "0,-24 8,-6 4,0 -6,0 -9,-9", fill: color, stroke: "#fff", "stroke-width": 0.9, "stroke-opacity": 0.6 }),
        svgEl("polygon", { points: "10,-16 16,-3 12,0 5,0 6,-8", fill: color, opacity: 0.82 })
      );
      return cg;
    };
    svg.append(
      drawCrystal(26, floorY - 2, 0.95, "#7be3d2"),
      drawCrystal(w - 34, floorY - 2, 0.9, "#ffd670")
    );

    // Sturdy rocky cavern floor & construction pad
    svg.append(
      svgEl("rect", { x: 0, y: floorY, width: w, height: h - floorY, fill: `url(#${compact ? "rockFloorMini" : "rockFloor"})` }),
      svgEl("path", {
        d: `M0 ${floorY} Q${w * 0.25} ${floorY - 6} ${w * 0.5} ${floorY - 3} T${w} ${floorY} L${w} ${floorY + 12} L0 ${floorY + 12} Z`,
        fill: "#d7a674"
      }),
      // Flat leveled Doozer construction pad in center
      svgEl("rect", {
        x: w / 2 - 178,
        y: floorY - 4,
        width: 356,
        height: 11,
        rx: 5.5,
        fill: "#7c5838",
        stroke: "#4c321d",
        "stroke-width": 2
      }),
      // Small Doozer caution cones flanking the pad
      svgEl("polygon", { points: `${w / 2 - 172},${floorY - 4} ${w / 2 - 164},${floorY - 20} ${w / 2 - 156},${floorY - 4}`, fill: "#f59e0b", stroke: "#7a3b06", "stroke-width": 1.6 }),
      svgEl("line", { x1: w / 2 - 168, y1: floorY - 11, x2: w / 2 - 160, y2: floorY - 11, stroke: "#fff", "stroke-width": 2.4 }),
      svgEl("polygon", { points: `${w / 2 + 156},${floorY - 4} ${w / 2 + 164},${floorY - 20} ${w / 2 + 172},${floorY - 4}`, fill: "#f59e0b", stroke: "#7a3b06", "stroke-width": 1.6 }),
      svgEl("line", { x1: w / 2 + 160, y1: floorY - 11, x2: w / 2 + 168, y2: floorY - 11, stroke: "#fff", "stroke-width": 2.4 })
    );
  }

  function initCavernScene() {
    stopCollapseAnim();
    cavernSvg = svgEl("svg", {
      viewBox: `0 0 ${CAVERN_W} ${CAVERN_H}`,
      class: "cavern-svg",
      preserveAspectRatio: "xMidYMax slice",
      role: "img",
      "aria-label": "Fraggle Rock cavern with triangular Doozer tower"
    });

    buildCavernBackdrop(cavernSvg, CAVERN_W, CAVERN_H, FLOOR_Y, false);

    elevationLayerEl = svgEl("g", { class: "elevation-layer" });
    towerLayerEl = svgEl("g", { class: "tower-layer" });
    debrisLayerEl = svgEl("g", { class: "debris-layer" });
    crewLayerEl = svgEl("g", { class: "crew-layer" });

    cavernSvg.append(elevationLayerEl, towerLayerEl, debrisLayerEl, crewLayerEl);
    cavernSceneWrap.replaceChildren(cavernSvg);
  }

  function appendTowerSticksToGroup(targetGroup, geom, animateNew, rank) {
    const strokeOuter = geom.levels >= 12 ? 5.2 : geom.levels >= 8 ? 6.4 : 7.8;
    const strokeCore = strokeOuter * 0.38;
    const nodeR = geom.levels >= 12 ? 2.6 : geom.levels >= 8 ? 3.2 : 4;

    // Subtle translucent crystal sheen fill inside the triangular silhouette
    if (geom.levels > 0) {
      targetGroup.append(
        svgEl("polygon", {
          points: `${geom.apex.x},${geom.apex.y} ${geom.baseRight},${FLOOR_Y - 4} ${geom.baseLeft},${FLOOR_Y - 4}`,
          fill: "rgba(182, 245, 122, 0.14)"
        })
      );
    }

    const oldGroup = svgEl("g");
    const newGroup = svgEl("g", animateNew ? { class: "tower-level-new" } : null);

    geom.sticks.forEach((s) => {
      const container = (animateNew && s.isNewest) ? newGroup : oldGroup;
      // Glowing translucent radish-crystal Doozer stick (3-layer glass-rod sheen!)
      container.append(
        svgEl("line", {
          x1: s.x1,
          y1: s.y1,
          x2: s.x2,
          y2: s.y2,
          class: "doozer-stick",
          stroke: "rgba(31, 96, 36, 0.45)",
          "stroke-width": strokeOuter + 2
        }),
        svgEl("line", {
          x1: s.x1,
          y1: s.y1,
          x2: s.x2,
          y2: s.y2,
          class: "doozer-stick",
          stroke: s.row === 0 && geom.levels >= 5 ? "#92ee58" : "#64d44c",
          "stroke-width": strokeOuter
        }),
        svgEl("line", {
          x1: s.x1,
          y1: s.y1,
          x2: s.x2,
          y2: s.y2,
          class: "doozer-stick",
          stroke: "#ecffc2",
          "stroke-width": strokeCore,
          opacity: 0.9
        })
      );
    });

    // Connector nodes at every truss vertex
    geom.nodes.forEach((n) => {
      const container = (animateNew && n.row === 0) ? newGroup : oldGroup;
      container.append(
        svgEl("circle", {
          cx: n.x,
          cy: n.y,
          r: nodeR,
          fill: "#e5ff9c",
          stroke: "#2d7830",
          "stroke-width": 1.3
        })
      );
    });

    // Crowning radish-star finial once the tower reaches 5+ levels!
    if (geom.levels >= TRUSS_STREAK) {
      const finialColor = rank === "S" ? "#ffd45c" : "#c8ff8c";
      newGroup.append(
        svgEl("line", { x1: geom.apex.x, y1: geom.apex.y, x2: geom.apex.x, y2: geom.apex.y - 16, stroke: finialColor, "stroke-width": 3, "stroke-linecap": "round" }),
        svgEl("polygon", {
          points: `${geom.apex.x},${geom.apex.y - 24} ${geom.apex.x + 14},${geom.apex.y - 18} ${geom.apex.x},${geom.apex.y - 12}`,
          fill: "#f59e0b",
          stroke: "#fff",
          "stroke-width": 1.2
        })
      );
    }

    targetGroup.append(oldGroup, newGroup);
  }

  function renderTowerAndCrew(height, options = {}) {
    if (!towerLayerEl || !crewLayerEl || !elevationLayerEl) return;
    const { animateNew = false, mood = "neutral", rank = "C" } = options;

    debrisLayerEl.replaceChildren();
    towerLayerEl.replaceChildren();
    crewLayerEl.replaceChildren();
    elevationLayerEl.replaceChildren();

    const geom = computeTowerGeometry(height, CAVERN_W, FLOOR_Y - 4);
    if (shift) shift.lastGeom = geom;

    // Blueprint height marker line on the right side
    if (height > 0) {
      const markerX = Math.min(CAVERN_W - 22, geom.baseRight + 24);
      elevationLayerEl.append(
        svgEl("line", {
          x1: geom.apex.x + 12,
          y1: geom.apex.y,
          x2: markerX,
          y2: geom.apex.y,
          stroke: "rgba(255, 240, 179, 0.55)",
          "stroke-width": 1.6,
          "stroke-dasharray": "4 4"
        }),
        svgEl("rect", {
          x: markerX - 24,
          y: geom.apex.y - 12,
          width: 44,
          height: 20,
          rx: 10,
          fill: "rgba(38, 24, 15, 0.72)",
          stroke: "#c8ff8c",
          "stroke-width": 1.4
        })
      );
      const lbl = svgEl("text", {
        x: markerX - 2,
        y: geom.apex.y + 2,
        "text-anchor": "middle",
        "font-family": "Fredoka, Nunito, sans-serif",
        "font-size": 11.5,
        "font-weight": 700,
        fill: "#d6ff9e"
      });
      lbl.textContent = `Lv ${height}`;
      elevationLayerEl.append(lbl);
    }

    appendTowerSticksToGroup(towerLayerEl, geom, animateNew, rank);

    // Position our authentic Doozer construction crew!
    const crewPose = mood === "happy" ? "cheer" : mood === "whoa" ? "whoa" : "holdStick";
    const leadRole = RANK_RULES[rank].heroRole;
    const baseLeftX = height > 0 ? Math.max(58, geom.baseLeft - 32) : CAVERN_W / 2 - 54;
    const baseRightX = height > 0 ? Math.min(CAVERN_W - 58, geom.baseRight + 32) : CAVERN_W / 2 + 54;

    // Lead Doozer on the left of the tower pad
    crewLayerEl.append(
      buildDoozerGroup({
        x: baseLeftX,
        y: FLOOR_Y - 2,
        scale: 0.62,
        helmet: HELMET_PALETTES[0],
        role: leadRole,
        expression: mood,
        pose: crewPose,
        mustache: leadRole === "bulldoozer"
      })
    );

    // Partner Doozer on the right of the tower pad (flipped facing tower)
    crewLayerEl.append(
      buildDoozerGroup({
        x: baseRightX,
        y: FLOOR_Y - 2,
        scale: 0.6,
        flip: true,
        helmet: HELMET_PALETTES[1],
        role: "worker",
        expression: mood,
        pose: mood === "neutral" ? "blueprint" : crewPose,
        hairColor: "#75351e"
      })
    );

    // Add perched miniature Doozer builders climbing the triangular scaffolding as it grows!
    if (height >= 2) {
      const perchRow = Math.max(0, Math.floor(height / 2) - 1);
      const rowCount = perchRow + 1;
      const perchY = geom.apex.y + (perchRow + 1) * geom.bayH;
      const perchX = CAVERN_W / 2 - (rowCount * geom.bayW) / 2 + geom.bayW * 0.25;
      crewLayerEl.append(
        buildDoozerGroup({
          x: perchX,
          y: perchY,
          scale: Math.max(0.32, Math.min(0.46, geom.bayW / 95)),
          helmet: HELMET_PALETTES[2],
          role: "worker",
          expression: mood,
          pose: crewPose,
          noShadow: true
        })
      );
    }

    if (height >= 5) {
      const highRow = Math.max(0, Math.min(height - 2, 1));
      const rowCount = highRow + 1;
      const perchY = geom.apex.y + (highRow + 1) * geom.bayH;
      const perchX = CAVERN_W / 2 + (rowCount * geom.bayW) / 2 - geom.bayW * 0.25;
      crewLayerEl.append(
        buildDoozerGroup({
          x: perchX,
          y: perchY,
          scale: Math.max(0.3, Math.min(0.42, geom.bayW / 98)),
          flip: true,
          helmet: HELMET_PALETTES[3],
          role: "bulldoozer",
          expression: mood,
          pose: crewPose,
          mustache: true,
          noShadow: true
        })
      );
    }

    if (height >= 9) {
      crewLayerEl.append(
        buildDoozerGroup({
          x: geom.apex.x,
          y: geom.apex.y + 1,
          scale: 0.34,
          helmet: HELMET_PALETTES[4],
          role: "architect",
          expression: mood,
          pose: "cheer",
          noShadow: true
        })
      );
    }
  }

  /**
   * Dramatic, comical, physics-driven collapse of the triangular Doozer tower!
   * Every Doozer stick snaps free, spins under gravity, bounces off the cavern floor,
   * and clatters into a heap while the Doozers leap safely with "Whoa!" expressions.
   */
  function triggerTowerCollapse(previousGeom, rank) {
    stopCollapseAnim();
    if (!towerLayerEl || !debrisLayerEl || !crewLayerEl || !elevationLayerEl) return;

    towerLayerEl.replaceChildren();
    elevationLayerEl.replaceChildren();
    debrisLayerEl.replaceChildren();

    // Startled Doozers safely on the cavern floor
    crewLayerEl.replaceChildren();
    const leadRole = RANK_RULES[rank].heroRole;
    crewLayerEl.append(
      buildDoozerGroup({
        x: 68,
        y: FLOOR_Y - 2,
        scale: 0.62,
        helmet: HELMET_PALETTES[0],
        role: leadRole,
        expression: "whoa",
        pose: "whoa",
        mustache: leadRole === "bulldoozer"
      }),
      buildDoozerGroup({
        x: CAVERN_W - 68,
        y: FLOOR_Y - 2,
        scale: 0.6,
        flip: true,
        helmet: HELMET_PALETTES[1],
        role: "worker",
        expression: "whoa",
        pose: "whoa",
        hairColor: "#75351e"
      })
    );

    // If tower had height 0, collapse a few starter sticks in the middle so a miss ALWAYS collapses!
    let sticks = (previousGeom && previousGeom.sticks && previousGeom.sticks.length)
      ? previousGeom.sticks
      : [
          { x1: CAVERN_W / 2 - 28, y1: FLOOR_Y - 12, x2: CAVERN_W / 2 + 28, y2: FLOOR_Y - 12 },
          { x1: CAVERN_W / 2 - 28, y1: FLOOR_Y - 12, x2: CAVERN_W / 2, y2: FLOOR_Y - 56 },
          { x1: CAVERN_W / 2 + 28, y1: FLOOR_Y - 12, x2: CAVERN_W / 2, y2: FLOOR_Y - 56 },
          { x1: CAVERN_W / 2 - 14, y1: FLOOR_Y - 34, x2: CAVERN_W / 2 + 14, y2: FLOOR_Y - 34 }
        ];

    // Cap animated debris sticks for ultra-smooth 60fps even from a 15-level tower
    if (sticks.length > 72) {
      const step = Math.ceil(sticks.length / 72);
      sticks = sticks.filter((_, idx) => idx % step === 0);
    }

    // Spawn falling stick bodies
    const pieces = sticks.map((s) => {
      const mx = (s.x1 + s.x2) / 2;
      const my = (s.y1 + s.y2) / 2;
      const len = Math.max(16, Math.hypot(s.x2 - s.x1, s.y2 - s.y1));
      const angleDeg = (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;

      const pg = svgEl("g");
      pg.append(
        svgEl("line", {
          x1: -len / 2,
          y1: 0,
          x2: len / 2,
          y2: 0,
          stroke: "#59cc49",
          "stroke-width": 6,
          "stroke-linecap": "round"
        }),
        svgEl("line", {
          x1: -len / 2,
          y1: 0,
          x2: len / 2,
          y2: 0,
          stroke: "#ecffc2",
          "stroke-width": 2.2,
          "stroke-linecap": "round"
        })
      );
      debrisLayerEl.append(pg);

      const outward = (mx - CAVERN_W / 2) * 1.45 + (Math.random() - 0.5) * 180;
      return {
        el: pg,
        x: mx,
        y: my,
        vx: outward,
        vy: -55 - Math.random() * 140,
        angle: angleDeg,
        va: (Math.random() - 0.5) * 520,
        restY: FLOOR_Y - 5 - Math.random() * 10,
        bounces: 0
      };
    });

    // Radish-dust clouds at impact zone
    for (let i = 0; i < 6; i += 1) {
      const puff = svgEl("circle", {
        cx: CAVERN_W / 2 + randInt(-95, 95),
        cy: FLOOR_Y - randInt(8, 36),
        r: randInt(12, 24),
        fill: "rgba(232, 255, 198, 0.36)"
      });
      debrisLayerEl.append(puff);
    }

    if (reducedMotion) {
      pieces.forEach((p) => {
        p.el.setAttribute("transform", `translate(${p.x + p.vx * 0.2}, ${p.restY}) rotate(${p.angle + 25})`);
      });
      return;
    }

    const gravity = 1150;
    let lastTime = performance.now();
    const startTime = lastTime;

    const step = (now) => {
      const dt = Math.min(0.036, (now - lastTime) / 1000);
      lastTime = now;

      let moving = false;
      pieces.forEach((p) => {
        if (p.bounces < 3) {
          p.vy += gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += p.va * dt;

          // Keep sticks inside cavern walls
          if (p.x < 32) {
            p.x = 32;
            p.vx = Math.abs(p.vx) * 0.5;
          } else if (p.x > CAVERN_W - 32) {
            p.x = CAVERN_W - 32;
            p.vx = -Math.abs(p.vx) * 0.5;
          }

          if (p.y >= p.restY) {
            p.y = p.restY;
            p.vy = -Math.abs(p.vy) * 0.34;
            p.vx *= 0.62;
            p.va *= 0.55;
            p.bounces += 1;
            if (Math.abs(p.vy) < 42) p.bounces = 3;
          }
          moving = true;
        }
        p.el.setAttribute("transform", `translate(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
      });

      if (moving && now - startTime < 1600) {
        collapseRaf = window.requestAnimationFrame(step);
      } else {
        collapseRaf = 0;
      }
    };

    collapseRaf = window.requestAnimationFrame(step);
  }

  function buildShowcaseTowerSvg(peakHeight, rank) {
    const w = 440;
    const h = 230;
    const fy = 204;
    const svg = svgEl("svg", {
      viewBox: `0 0 ${w} ${h}`,
      preserveAspectRatio: "xMidYMax slice",
      role: "img",
      "aria-label": `Tallest triangular Doozer tower: ${peakHeight} levels`
    });

    buildCavernBackdrop(svg, w, h, fy, true);
    const geom = computeTowerGeometry(peakHeight, w, fy - 4, 152, 240);
    const tg = svgEl("g");
    appendTowerSticksToGroup(tg, geom, false, rank);
    svg.append(tg);

    const leadRole = RANK_RULES[rank].heroRole;
    svg.append(
      buildDoozerGroup({
        x: Math.max(54, geom.baseLeft - 32),
        y: fy - 2,
        scale: 0.46,
        helmet: HELMET_PALETTES[0],
        role: leadRole,
        expression: "happy",
        pose: "cheer",
        mustache: leadRole === "bulldoozer"
      }),
      buildDoozerGroup({
        x: Math.min(w - 54, geom.baseRight + 32),
        y: fy - 2,
        scale: 0.45,
        flip: true,
        helmet: HELMET_PALETTES[2],
        role: "worker",
        expression: "happy",
        pose: "cheer"
      })
    );
    return svg;
  }

  // ------------------------------------------------------- procedural audio --
  let soundEnabled = readSoundPref();
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let nextMusicTime = 0;

  // Cheerful Fraggle-Rock-inspired industrious groove: G — D — Em — C
  const MUSIC_CHORDS = [
    [67, 71, 74, 79],
    [62, 66, 69, 74],
    [64, 67, 71, 76],
    [60, 64, 67, 72]
  ];
  const MUSIC_PATTERN = [0, 2, 1, 3, 2, 0, 1, 2];

  function midiHz(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function readSoundPref() {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "off";
    } catch (_) {
      return true;
    }
  }

  function writeSoundPref() {
    try {
      window.localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
    } catch (_) { /* ignore */ }
  }

  function updateSoundUi() {
    soundToggleEl.setAttribute("aria-pressed", String(soundEnabled));
    soundToggleEl.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    soundIconEl.textContent = soundEnabled ? "♪" : "×";
    soundLabelEl.textContent = soundEnabled ? "Sound on" : "Sound off";
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioCtx = new Ctx();
        masterGain = audioCtx.createGain();
        musicGain = audioCtx.createGain();
        sfxGain = audioCtx.createGain();
        masterGain.gain.value = 0.8;
        musicGain.gain.value = 0.21;
        sfxGain.gain.value = 0.86;
        musicGain.connect(masterGain);
        sfxGain.connect(masterGain);
        masterGain.connect(audioCtx.destination);
      } catch (_) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function tone(opts, dest) {
    const ctx = ensureAudio();
    const target = dest || sfxGain;
    if (!ctx || !target) return;
    const start = opts.time ?? ctx.currentTime;
    const dur = opts.duration ?? 0.14;
    const attack = opts.attack ?? 0.005;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(Math.max(20, opts.freq), start);
    if (opts.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), start + dur);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(opts.gain ?? 0.12, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(target);
    osc.start(start);
    osc.stop(start + dur + 0.04);
  }

  function scheduleMusicStep(step, time) {
    const pos = step % 8;
    const bar = Math.floor(step / 8) % MUSIC_CHORDS.length;
    const chord = MUSIC_CHORDS[bar];

    // Playful tiny Doozer hammer tap on offbeats
    if (pos % 2 === 1) {
      tone({
        type: "triangle",
        freq: pos === 3 || pos === 7 ? 1240 : 960,
        time,
        duration: 0.025,
        gain: 0.026,
        attack: 0.002
      }, musicGain);
    }

    // Bouncy marimba arpeggio
    const note = chord[MUSIC_PATTERN[pos]];
    tone({
      type: "sine",
      freq: midiHz(note + 12),
      time,
      duration: 0.16,
      gain: 0.052,
      attack: 0.005
    }, musicGain);

    if (pos === 0 || pos === 4) {
      tone({
        type: "triangle",
        freq: midiHz(chord[0] - 12),
        time,
        duration: 0.28,
        gain: 0.072,
        attack: 0.01
      }, musicGain);
    }
  }

  function musicStepDur() {
    const bpm = shift && shift.rank === "S" ? 122 : 104;
    return 60 / bpm / 2;
  }

  function musicScheduler() {
    if (!audioCtx || document.hidden) return;
    while (nextMusicTime < audioCtx.currentTime + 0.25) {
      scheduleMusicStep(musicStep, nextMusicTime);
      nextMusicTime += musicStepDur();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!soundEnabled || document.hidden || musicTimer) return;
    const ctx = ensureAudio();
    if (!ctx || !musicGain) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.21, ctx.currentTime, 0.04);
    musicStep = 0;
    nextMusicTime = ctx.currentTime + 0.08;
    musicTimer = window.setInterval(musicScheduler, 80);
    musicScheduler();
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = 0;
    }
    if (audioCtx && musicGain) {
      musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.04);
    }
  }

  const sfx = {
    click() {
      tone({ type: "triangle", freq: 580, endFreq: 760, duration: 0.06, gain: 0.08 });
    },
    tick() {
      tone({ type: "triangle", freq: 940, endFreq: 660, duration: 0.032, gain: 0.06, attack: 0.002 });
    },
    urgentTick() {
      tone({ type: "square", freq: 920, duration: 0.035, gain: 0.05, attack: 0.002 });
    },
    beep() {
      tone({ type: "triangle", freq: 523.25, duration: 0.09, gain: 0.09 });
    },
    go() {
      tone({ type: "triangle", freq: 783.99, endFreq: 1046.5, duration: 0.18, gain: 0.12 });
    },
    buildLevel(height) {
      // Crystalline radish-stick snap + rising build chime
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const lift = Math.pow(2, Math.min(height - 1, 10) / 24);
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone({ type: i === 2 ? "sine" : "triangle", freq: f * lift, time: now + i * 0.055, duration: 0.22, gain: 0.12 });
      });
      tone({ type: "sine", freq: 1568 * lift, time: now + 0.14, duration: 0.18, gain: 0.055 });
    },
    masterTruss() {
      // Bright Doozer celebration whistle/bell fanfare!
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
        tone({ type: "sine", freq: f, time: now + i * 0.1, duration: i === 3 ? 0.55 : 0.26, gain: 0.14 });
        tone({ type: "triangle", freq: f * 2, time: now + i * 0.1, duration: 0.18, gain: 0.05 });
      });
    },
    collapse(height) {
      // Crack + cascading radish-stick crystal/wood clatter + gentle comical thud!
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Initial snap crack
      tone({ type: "sawtooth", freq: 340, endFreq: 130, time: now, duration: 0.16, gain: 0.08 });
      // Clattering sticks (more clatters for taller towers!)
      const clatters = Math.min(12, Math.max(5, height + 3));
      for (let i = 0; i < clatters; i += 1) {
        const t = now + 0.09 + i * 0.052 + Math.random() * 0.025;
        const f = 920 - i * 48 + (Math.random() - 0.5) * 260;
        tone({
          type: i % 2 === 0 ? "triangle" : "sine",
          freq: Math.max(220, f),
          endFreq: Math.max(150, f * 0.72),
          time: t,
          duration: 0.085,
          gain: 0.075 * (1 - i / (clatters + 5)),
          attack: 0.002
        });
      }
      // Comical soft bottom thud
      tone({ type: "triangle", freq: 145, endFreq: 72, time: now + 0.24, duration: 0.24, gain: 0.11 });
    },
    win() {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        tone({ type: i < 3 ? "triangle" : "sine", freq: f, time: now + i * 0.095, duration: i === 4 ? 0.52 : 0.28, gain: 0.14 });
      });
    },
    lose() {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      [440, 392, 330].forEach((f, i) => {
        tone({ type: "triangle", freq: f, time: now + i * 0.13, duration: 0.24, gain: 0.1 });
      });
    }
  };

  // ----------------------------------------------------------- view switch --
  function showView(name) {
    currentView = name;
    viewYard.hidden = name !== "yard";
    viewWorkbench.hidden = name !== "workbench";
    viewSummary.hidden = name !== "summary";
  }

  // ------------------------------------------------------------ yard UI --
  function renderYard() {
    const playRank = activePlayRank();
    const rules = RANK_RULES[playRank];
    const top = isTopRank(saveData.rank);
    const testReady = canTakeTest(saveData) && playRank === saveData.rank;

    renderHeroDoozer();

    homeRankBadge.textContent = playRank;
    homeRankBadge.className = `rank-badge lg rank-${playRank}`;
    homeRankTitle.textContent = rules.title;
    homeRankBlurb.textContent = rules.blurb;
    homeRankMeta.textContent = rules.meta;

    homePipsWrap.hidden = top;
    homePipsWrap.setAttribute("aria-label", `${saveData.roundsAtRank} of ${ROUNDS_TO_TEST} shifts done`);
    homePipsWrap.querySelectorAll(".pip").forEach((pip, idx) => {
      pip.classList.toggle("on", idx < saveData.roundsAtRank);
    });

    btnPlayTest.hidden = top;
    btnPlayTest.disabled = !testReady;

    if (playRank !== saveData.rank) {
      homeLockNote.textContent = "Test rank is on — shifts played here are not saved.";
    } else if (top) {
      homeLockNote.textContent = "Top rank reached! Build epic timed 16-level Doozer spires for a high score.";
    } else if (testReady) {
      homeLockNote.textContent = "Build a 100% collapse-free tower on the test to rank up. Missing never drops your rank!";
    } else {
      const left = ROUNDS_TO_TEST - saveData.roundsAtRank;
      homeLockNote.textContent = `Finish ${left} more shift${left === 1 ? "" : "s"} to unlock the rank-up test.`;
    }

    // Render 4-rank ladder
    rankLadderEl.replaceChildren();
    const savedIdx = RANKS.indexOf(saveData.rank);
    RANKS.forEach((r, idx) => {
      const rr = RANK_RULES[r];
      const step = document.createElement("div");
      step.className = `card ladder-step${idx <= savedIdx ? " reached" : ""}${r === saveData.rank ? " current" : ""}`;
      step.innerHTML =
        `<div class="ladder-head">` +
          `<span class="rank-badge rank-${r}">${r}</span>` +
          `<h3>${rr.title}</h3>` +
        `</div>` +
        `<p>${rr.blurb}</p>` +
        `<span class="meta">${rr.meta}</span>`;
      rankLadderEl.append(step);
    });

    // Lifetime stats
    statBestScore.textContent = formatScore(saveData.bestScore);
    statBestTower.textContent = String(saveData.stats.bestTower);
    statLevelsBuilt.textContent = formatScore(saveData.stats.levelsBuilt);
    const acc = saveData.stats.totalAnswered > 0
      ? `${Math.round((saveData.stats.totalCorrect / saveData.stats.totalAnswered) * 100)}%`
      : "-";
    statAccuracy.textContent = acc;
  }

  // --------------------------------------------------------- shift engine --
  let shift = null;
  let timerRaf = 0;
  let lastUrgentSec = -1;

  function stopBlueprintTimer() {
    if (timerRaf) {
      window.cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }
  }

  function startShift(mode) {
    clearTasks();
    stopBlueprintTimer();
    stopCollapseAnim();
    ensureAudio();
    sfx.click();

    const rank = activePlayRank();
    const isTestRun = rankOverride !== null;
    const questions = buildShiftQuestions(rank);

    shift = {
      rank,
      mode, // "shift" | "test"
      testRun: isTestRun,
      phase: "countdown", // countdown | playing | feedback | done
      questions,
      index: 0,
      score: 0,
      towerHeight: 0,
      peakTower: 0,
      trussCount: 0,
      correct: 0,
      answered: 0,
      collapses: 0,
      totalMs: 0,
      questionStart: 0,
      timeLimitMs: RANK_RULES[rank].timerMs,
      typedDigits: "",
      lastGeom: null,
      misses: [] // { question, givenText }
    };

    viewWorkbench.classList.toggle("mode-test", mode === "test");
    wbTitle.textContent = mode === "test" ? `Rank ${rank} Rank-Up Test` : `Rank ${rank} Shift`;
    wbSubtitle.textContent = mode === "test"
      ? "Zero collapses needed — one fall ends the test (no rank lost)"
      : "Each right answer adds a level · one slip collapses the triangular tower!";

    hudRank.textContent = rank;
    hudRank.className = `rank-badge rank-${rank}`;
    stageEffectsEl.replaceChildren();
    initCavernScene();
    renderTowerAndCrew(0, { mood: "neutral", rank });
    updateTrussPips();
    updateWorkbenchHud(false);

    showView("workbench");
    mountCurrentQuestion();
    runCountdown(3);
  }

  function runCountdown(n) {
    if (!shift) return;
    if (n <= 0) {
      stageOverlayEl.hidden = false;
      stageOverlayEl.className = "stage-overlay countdown";
      stageOverlayEl.textContent = "Build!";
      sfx.go();
      queueTask(() => {
        if (!shift) return;
        stageOverlayEl.hidden = true;
        shift.phase = "playing";
        shift.questionStart = performance.now();
        setInputsDisabled(false);
        startBlueprintTimerIfNeeded();
        startMusic();
      }, 420);
      return;
    }

    setInputsDisabled(true);
    stageOverlayEl.hidden = false;
    stageOverlayEl.className = "stage-overlay countdown";
    stageOverlayEl.textContent = String(n);
    void stageOverlayEl.offsetWidth;
    sfx.beep();
    queueTask(() => runCountdown(n - 1), 600);
  }

  function updateWorkbenchHud(bumpScore) {
    if (!shift) return;
    const shownIdx = Math.min(shift.index + 1, shift.questions.length);
    hudQuestion.textContent = `${shownIdx} / ${shift.questions.length}`;
    hudTower.textContent = String(shift.towerHeight);
    hudScore.textContent = formatScore(shift.score);
    hudTowerChip.classList.toggle("hot", shift.towerHeight >= TRUSS_STREAK);
    towerMeterText.textContent = `Level ${shift.towerHeight} · Peak ${shift.peakTower}`;

    if (bumpScore) {
      hudScoreChip.classList.remove("score-bump");
      void hudScoreChip.offsetWidth;
      hudScoreChip.classList.add("score-bump");
    }
  }

  function updateTrussPips() {
    const filled = shift ? shift.trussCount : 0;
    trussPipsEl.querySelectorAll("span").forEach((pip, idx) => {
      pip.classList.toggle("on", idx < filled);
    });
  }

  function setInputsDisabled(disabled) {
    keypadKeysEl.querySelectorAll("button").forEach((b) => { b.disabled = disabled; });
  }

  function renderEquationLine(q, typedText, revealState) {
    const val = revealState ? String(q.answer) : (typedText || "?");
    const cls = revealState === "right"
      ? "equation-blank filled"
      : revealState === "wrong"
        ? "equation-blank reveal"
        : "equation-blank";

    if (q.equationMode === "missingDivisor") {
      equationLineEl.innerHTML = `${q.product} ÷ <span class="${cls}">${val}</span> = ${q.known}`;
    } else {
      equationLineEl.innerHTML = `${q.product} ÷ ${q.known} = <span class="${cls}">${val}</span>`;
    }
  }

  function renderBlueprintVisuals(revealState) {
    if (!shift) return;
    const q = shift.questions[shift.index];
    if (!q) return;
    const rules = RANK_RULES[shift.rank];

    const svg = buildFactTriangleSvg({
      product: q.product,
      factorA: q.factorA,
      factorB: q.factorB,
      missingSide: q.missingSide,
      typedText: shift.typedDigits,
      revealState,
      showDivArrow: rules.showDivArrow,
      mini: false
    });
    triangleHolderEl.replaceChildren(svg);
    renderEquationLine(q, shift.typedDigits, revealState);
  }

  function mountCurrentQuestion() {
    if (!shift) return;
    const q = shift.questions[shift.index];
    if (!q) return;
    const rules = RANK_RULES[shift.rank];

    shift.typedDigits = "";
    lastUrgentSec = -1;

    blueprintCardEl.classList.remove("is-wrong", "is-right");
    orderFeedback.hidden = true;
    orderFeedback.className = "order-feedback";
    orderFeedback.textContent = "";

    if (q.equationMode === "missingDivisor") {
      orderModeBadge.textContent = "Missing Divisor Blueprint";
      orderModeBadge.className = "mode-pill is-divisor";
    } else if (q.isSibling) {
      orderModeBadge.textContent = "Fact Family Twin!";
      orderModeBadge.className = "mode-pill is-sibling";
    } else {
      orderModeBadge.textContent = "Fact Family Triangle";
      orderModeBadge.className = "mode-pill";
    }

    if (rules.showBridge) {
      bridgeHintEl.hidden = false;
      bridgeHintEl.textContent = q.missingSide === "right"
        ? `Think: ${q.known} × ? = ${q.product}`
        : `Think: ? × ${q.known} = ${q.product}`;
    } else {
      bridgeHintEl.hidden = true;
    }

    if (shift.timeLimitMs) {
      blueprintTimerEl.hidden = false;
      blueprintTimerEl.classList.remove("low");
      blueprintTimerFill.style.width = "100%";
      blueprintTimerText.textContent = `${Math.ceil(shift.timeLimitMs / 1000)}s`;
    } else {
      blueprintTimerEl.hidden = true;
    }

    renderBlueprintVisuals(null);
    updateWorkbenchHud(false);
  }

  // ------------------------------------------------------- Rank S timer --
  function startBlueprintTimerIfNeeded() {
    stopBlueprintTimer();
    if (!shift || !shift.timeLimitMs || shift.phase !== "playing") return;

    const loop = () => {
      if (!shift || shift.phase !== "playing" || !shift.timeLimitMs) return;
      const elapsed = performance.now() - shift.questionStart;
      const remaining = Math.max(0, shift.timeLimitMs - elapsed);
      const frac = remaining / shift.timeLimitMs;
      blueprintTimerFill.style.width = `${frac * 100}%`;
      const secs = Math.ceil(remaining / 1000);
      blueprintTimerText.textContent = `${secs}s`;

      if (remaining <= 3500) {
        blueprintTimerEl.classList.add("low");
        if (secs !== lastUrgentSec && secs > 0) {
          lastUrgentSec = secs;
          sfx.urgentTick();
        }
      }

      if (remaining <= 0) {
        stopBlueprintTimer();
        evaluateAnswer(null, true);
        return;
      }
      timerRaf = window.requestAnimationFrame(loop);
    };
    timerRaf = window.requestAnimationFrame(loop);
  }

  // ------------------------------------------------------- keypad logic --
  function pressKeypad(key) {
    if (!shift || shift.phase !== "playing") return;
    ensureAudio();

    if (key === "clear") {
      shift.typedDigits = "";
      sfx.tick();
      renderBlueprintVisuals(null);
      orderFeedback.hidden = true;
      return;
    }
    if (key === "back") {
      shift.typedDigits = shift.typedDigits.slice(0, -1);
      sfx.tick();
      renderBlueprintVisuals(null);
      orderFeedback.hidden = true;
      return;
    }
    if (key === "enter") {
      if (!shift.typedDigits) {
        orderFeedback.hidden = false;
        orderFeedback.textContent = "Type the missing number first!";
        blueprintCardEl.classList.remove("is-wrong");
        void blueprintCardEl.offsetWidth;
        blueprintCardEl.classList.add("is-wrong");
        sfx.tick();
        return;
      }
      evaluateAnswer(Number(shift.typedDigits), false);
      return;
    }
    if (/^[0-9]$/.test(key)) {
      if (shift.typedDigits.length < 2) {
        // Avoid pointless leading zero like "06"
        if (shift.typedDigits === "0") {
          shift.typedDigits = key;
        } else {
          shift.typedDigits += key;
        }
        sfx.tick();
        renderBlueprintVisuals(null);
        orderFeedback.hidden = true;
      }
    }
  }

  // --------------------------------------------------- answer evaluation --
  function evaluateAnswer(givenValue, timedOut) {
    if (!shift || shift.phase !== "playing") return;
    stopBlueprintTimer();
    shift.phase = "feedback";
    setInputsDisabled(true);

    const q = shift.questions[shift.index];
    const elapsedMs = Math.max(0, performance.now() - shift.questionStart);
    shift.answered += 1;
    shift.totalMs += elapsedMs;

    const isCorrect = !timedOut && givenValue === q.answer;
    const familyText = `${q.factorA} × ${q.factorB} = ${q.product} · ${q.product} ÷ ${q.known} = ${q.answer}`;

    if (isCorrect) {
      shift.correct += 1;
      shift.towerHeight += 1;
      shift.peakTower = Math.max(shift.peakTower, shift.towerHeight);
      shift.trussCount += 1;

      const heightBonus = Math.min((shift.towerHeight - 1) * HEIGHT_BONUS, HEIGHT_BONUS_CAP);
      let points = BASE_POINTS + heightBonus;
      if (shift.timeLimitMs) {
        const secsLeft = Math.max(0, Math.floor((shift.timeLimitMs - elapsedMs) / 1000));
        points += secsLeft * SPEED_BONUS_PER_SEC;
      }

      const triggeredTruss = shift.trussCount >= TRUSS_STREAK;
      if (triggeredTruss) {
        points += TRUSS_BONUS;
      }

      shift.score += points;
      updateTrussPips();
      updateWorkbenchHud(true);

      blueprintCardEl.classList.add("is-right");
      renderBlueprintVisuals("right");
      orderFeedback.hidden = false;
      orderFeedback.className = "order-feedback good";
      orderFeedback.textContent = triggeredTruss
        ? `Master Truss! ${familyText} (+${points})`
        : q.isSibling
          ? `Fact family twin! ${familyText}`
          : `${randomItem(CELEBRATIONS)} ${q.factorA} × ${q.factorB} = ${q.product}`;

      renderTowerAndCrew(shift.towerHeight, {
        animateNew: true,
        mood: "happy",
        rank: shift.rank
      });

      spawnBuildEffects(points, q, triggeredTruss);
      if (triggeredTruss) {
        sfx.masterTruss();
      } else {
        sfx.buildLevel(shift.towerHeight);
      }

      queueTask(() => {
        if (!shift) return;
        if (triggeredTruss) {
          shift.trussCount = 0;
          updateTrussPips();
        }
        advanceShift(true);
      }, triggeredTruss ? TRUSS_HOLD_MS : CORRECT_HOLD_MS);
    } else {
      const collapsedFrom = shift.towerHeight;
      const previousGeom = shift.lastGeom;

      shift.collapses += 1;
      shift.towerHeight = 0;
      shift.trussCount = 0;
      updateTrussPips();
      updateWorkbenchHud(false);

      const givenText = timedOut
        ? "Out of time"
        : givenValue == null
          ? "No answer"
          : String(givenValue);
      shift.misses.push({ question: q, givenText });

      blueprintCardEl.classList.add("is-wrong");
      renderBlueprintVisuals("wrong");
      orderFeedback.hidden = false;
      orderFeedback.className = "order-feedback";
      orderFeedback.textContent = timedOut
        ? `Time's up! ${familyText}`
        : `Timber! ${familyText}`;

      // Collapse the triangular Doozer tower!
      triggerTowerCollapse(previousGeom, shift.rank);
      spawnCollapseEffects(collapsedFrom);
      sfx.collapse(collapsedFrom);

      queueTask(() => {
        if (!shift) return;
        advanceShift(false);
      }, COLLAPSE_HOLD_MS);
    }
  }

  function advanceShift(lastWasCorrect) {
    if (!shift) return;
    // Rank-up test ends immediately on first tower collapse
    if (shift.mode === "test" && !lastWasCorrect) {
      completeShift(false);
      return;
    }

    shift.index += 1;
    if (shift.index >= shift.questions.length) {
      completeShift(true);
      return;
    }

    shift.phase = "playing";
    // Reset Doozers to eager neutral building pose (preserving current tower height — 0 after collapse!)
    renderTowerAndCrew(shift.towerHeight, { mood: "neutral", rank: shift.rank });
    mountCurrentQuestion();
    shift.questionStart = performance.now();
    setInputsDisabled(false);
    startBlueprintTimerIfNeeded();
  }

  function completeShift(passed) {
    if (!shift) return;
    stopBlueprintTimer();
    stopMusic();
    shift.phase = "done";
    setInputsDisabled(true);

    const isTest = shift.mode === "test";
    stageOverlayEl.hidden = false;
    stageOverlayEl.className = `stage-overlay end-banner ${passed ? "good" : "bad"}`;
    stageOverlayEl.textContent = isTest
      ? (passed ? "Tower Approved!" : "Tower Collapsed")
      : "Shift Complete!";

    if (passed) {
      sfx.win();
      spawnConfetti(58);
    } else {
      sfx.lose();
    }

    const result = {
      rank: shift.rank,
      mode: shift.mode,
      passed,
      testRun: shift.testRun,
      correct: shift.correct,
      answered: shift.answered,
      accuracy: shift.answered > 0 ? shift.correct / shift.answered : 0,
      avgMs: shift.answered > 0 ? shift.totalMs / shift.answered : 0,
      peakTower: shift.peakTower,
      collapses: shift.collapses,
      score: shift.score,
      misses: shift.misses.slice()
    };

    const events = result.testRun ? [] : applyResultToSave(result);

    queueTask(() => {
      stageOverlayEl.hidden = true;
      renderSummary(result, events);
      showView("summary");
    }, END_HOLD_MS);
  }

  function applyResultToSave(result) {
    const events = [];
    const next = parseSave(saveData);

    next.stats.shiftsPlayed += (result.mode === "shift" && result.passed) ? 1 : 0;
    next.stats.levelsBuilt += result.correct;
    next.stats.totalCorrect += result.correct;
    next.stats.totalAnswered += result.answered;
    next.stats.bestTower = Math.max(next.stats.bestTower, result.peakTower);

    if (result.score > saveData.bestScore) {
      next.bestScore = result.score;
      if (saveData.bestScore > 0) {
        events.push({ type: "newBest", score: result.score });
      }
    }

    if (result.rank === saveData.rank) {
      if (result.mode === "shift") {
        if (result.passed && !isTopRank(saveData.rank) && saveData.roundsAtRank < ROUNDS_TO_TEST) {
          next.roundsAtRank = saveData.roundsAtRank + 1;
          events.push({ type: "roundLogged", count: next.roundsAtRank, needed: ROUNDS_TO_TEST });
          if (next.roundsAtRank === ROUNDS_TO_TEST) {
            events.push({ type: "testUnlocked", rank: saveData.rank });
          }
        }
      } else if (result.mode === "test" && canTakeTest(saveData)) {
        next.testAttempts = saveData.testAttempts + 1;
        if (result.passed) {
          next.rank = nextRank(saveData.rank);
          next.roundsAtRank = 0;
          events.push({ type: "rankUp", from: saveData.rank, to: next.rank });
        } else {
          events.push({ type: "testFailed", rank: saveData.rank });
        }
      }
    }

    saveData = next;
    writeLocalSave(saveData);
    void syncSaveToArcade(saveData, result.score);
    return events;
  }

  // ------------------------------------------------------------- juice fx --
  function spawnBuildEffects(points, q, isMasterTruss) {
    if (reducedMotion) return;
    const rect = towerStageEl.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height * 0.44;

    for (let i = 0; i < (isMasterTruss ? 28 : 16); i += 1) {
      const p = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const dist = randInt(44, isMasterTruss ? 150 : 108);
      p.className = "fx-particle";
      p.style.setProperty("--x", `${cx}px`);
      p.style.setProperty("--y", `${cy}px`);
      p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      p.style.setProperty("--rotation", `${randInt(-220, 220)}deg`);
      p.style.setProperty("--size", `${randInt(7, 14)}px`);
      p.style.setProperty("--radius", i % 3 === 0 ? "3px" : "50%");
      p.style.setProperty("--color", BURST_COLORS[i % BURST_COLORS.length]);
      p.style.setProperty("--delay", `${randInt(0, 70)}ms`);
      p.style.setProperty("--duration", `${randInt(540, 820)}ms`);
      p.addEventListener("animationend", () => p.remove(), { once: true });
      stageEffectsEl.append(p);
    }

    const pop = document.createElement("span");
    pop.className = "score-pop";
    pop.textContent = `+${points}`;
    pop.addEventListener("animationend", () => pop.remove(), { once: true });
    stageEffectsEl.append(pop);

    const stamp = document.createElement("span");
    stamp.className = "fact-stamp";
    stamp.textContent = `${q.product} ÷ ${q.known} = ${q.answer}!`;
    stamp.addEventListener("animationend", () => stamp.remove(), { once: true });
    stageEffectsEl.append(stamp);

    towerStageEl.classList.remove("solve-flash");
    void towerStageEl.offsetWidth;
    towerStageEl.classList.add("solve-flash");

    if (isMasterTruss) {
      const banner = document.createElement("span");
      banner.className = "fact-stamp truss-bonus";
      banner.textContent = "Master Truss! +50";
      banner.addEventListener("animationend", () => banner.remove(), { once: true });
      stageEffectsEl.append(banner);
      spawnConfetti(40);
    }
  }

  function spawnCollapseEffects(collapsedFrom) {
    if (reducedMotion) return;
    towerStageEl.classList.remove("stage-shake");
    void towerStageEl.offsetWidth;
    towerStageEl.classList.add("stage-shake");

    const banner = document.createElement("span");
    banner.className = "fact-stamp collapse-banner";
    banner.textContent = collapsedFrom > 0
      ? `Tower Collapse! (${collapsedFrom} ${collapsedFrom === 1 ? "level" : "levels"} fell)`
      : "Stick Snapped! Rebuild!";
    banner.addEventListener("animationend", () => banner.remove(), { once: true });
    stageEffectsEl.append(banner);
  }

  function spawnConfetti(count) {
    if (reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.style.setProperty("--left", `${Math.random() * 100}%`);
      piece.style.setProperty("--width", `${randInt(7, 12)}px`);
      piece.style.setProperty("--height", `${randInt(10, 18)}px`);
      piece.style.setProperty("--color", BURST_COLORS[i % BURST_COLORS.length]);
      piece.style.setProperty("--delay", `${randInt(0, 480)}ms`);
      piece.style.setProperty("--fall-time", `${randInt(1350, 2300)}ms`);
      piece.style.setProperty("--drift", `${randInt(-100, 100)}px`);
      piece.style.setProperty("--spin", `${randInt(360, 960)}deg`);
      piece.addEventListener("animationend", () => piece.remove(), { once: true });
      stageEffectsEl.append(piece);
    }
  }

  // ----------------------------------------------------------- summary UI --
  function renderSummary(result, events) {
    let title = "Shift Complete!";
    let sub = "Doozers love rebuilding almost as much as building — great work!";
    let good = true;

    if (result.mode === "test") {
      if (result.passed) {
        title = "Flawless Spire!";
        sub = `Zero collapses — your ${result.peakTower}-level Rank ${result.rank} tower passed inspection!`;
      } else {
        title = "Tower Collapsed";
        sub = `Reached ${result.peakTower} ${result.peakTower === 1 ? "level" : "levels"} before the slip — no rank lost!`;
        good = false;
      }
    } else if (result.accuracy === 1) {
      title = "Unstoppable Spire!";
      sub = `All ${result.peakTower} triangular levels stood tall without a single collapse!`;
    } else if (result.accuracy >= 0.8) {
      title = "Solid Engineering!";
      sub = "The Fraggles are already eyeing those tasty radish sticks.";
    }

    sumHeadEl.classList.toggle("bad", !good);
    sumTitleEl.textContent = title;
    sumSubEl.textContent = sub;

    sumAccuracyEl.textContent = `${Math.round(result.accuracy * 100)}%`;
    sumRatioEl.textContent = `${result.correct}/${result.answered}`;
    sumAvgTimeEl.textContent = `${(result.avgMs / 1000).toFixed(1)}s`;
    sumTowerEl.textContent = String(result.peakTower);
    sumBuiltEl.textContent = String(result.correct);
    sumScoreEl.textContent = formatScore(result.score);

    // Events list
    sumEventsEl.replaceChildren();
    const lines = [];
    if (result.testRun) {
      lines.push({ text: "Test rank is on, so this shift was not saved.", tone: "" });
    }
    events.forEach((ev) => {
      if (ev.type === "roundLogged") {
        lines.push({ text: `Shift ${ev.count}/${ev.needed} logged at Rank ${result.rank}.`, tone: "" });
      } else if (ev.type === "testUnlocked") {
        lines.push({ text: "Rank-up test unlocked! Build a 100% collapse-free tower to advance.", tone: "good" });
      } else if (ev.type === "rankUp") {
        lines.push({ text: `RANK UP! ${ev.from} → ${ev.to} (${RANK_RULES[ev.to].title})`, tone: "rank-up" });
      } else if (ev.type === "testFailed") {
        lines.push({ text: "Test missed — no rank lost. Fresh radish sticks are ready whenever you want to retry!", tone: "bad" });
      } else if (ev.type === "newBest") {
        lines.push({ text: `New best score: ${formatScore(ev.score)}!`, tone: "good" });
      }
    });
    sumEventsEl.hidden = lines.length === 0;
    lines.forEach((line) => {
      const li = document.createElement("li");
      if (line.tone) li.className = line.tone;
      li.textContent = line.text;
      sumEventsEl.append(li);
    });

    if (events.some((e) => e.type === "rankUp")) {
      sfx.masterTruss();
    }

    // Showcase of the tallest triangular tower built this shift
    sumShowcaseWrap.hidden = result.peakTower <= 0;
    if (result.peakTower > 0) {
      sumShowcaseLabel.textContent = `Tallest triangular Doozer tower this shift — ${result.peakTower} ${result.peakTower === 1 ? "level" : "levels"} high`;
      sumShowcaseBox.replaceChildren(buildShowcaseTowerSvg(result.peakTower, result.rank));
    }

    // Missed fact families review
    sumMissesGrid.replaceChildren();
    sumMissesWrap.hidden = result.misses.length === 0;
    result.misses.forEach((m) => {
      const q = m.question;
      const card = document.createElement("div");
      card.className = "miss-item";

      const thumb = document.createElement("div");
      thumb.className = "miss-tri";
      thumb.append(
        buildFactTriangleSvg({
          product: q.product,
          factorA: q.factorA,
          factorB: q.factorB,
          missingSide: null,
          mini: true
        })
      );

      const info = document.createElement("div");
      info.className = "miss-info";
      const factEl = document.createElement("div");
      factEl.className = "miss-fact";
      factEl.textContent = `${q.product} ÷ ${q.known} = ${q.answer}`;
      const noteEl = document.createElement("div");
      noteEl.className = "miss-note";
      noteEl.textContent = `${q.factorA} × ${q.factorB} = ${q.product} · You: ${m.givenText}`;
      info.append(factEl, noteEl);

      card.append(thumb, info);
      sumMissesGrid.append(card);
    });

    // Action buttons
    const rankedUp = events.some((e) => e.type === "rankUp");
    const showTest = !result.testRun && canTakeTest(saveData);
    btnSumTest.hidden = !showTest;
    btnSumTest.textContent = result.mode === "test" && !result.passed ? "Retry Rank-Up Test" : "Take Rank-Up Test";
    btnSumPlay.textContent = rankedUp ? `Start Rank ${saveData.rank} Shift` : "Build Another Tower";
  }

  function goToYard() {
    clearTasks();
    stopBlueprintTimer();
    stopCollapseAnim();
    stopMusic();
    shift = null;
    renderYard();
    showView("yard");
  }

  // ------------------------------------------------------- event bindings --
  brandBtn.addEventListener("click", () => {
    sfx.click();
    goToYard();
  });

  btnPlayShift.addEventListener("click", () => startShift("shift"));
  btnPlayTest.addEventListener("click", () => startShift("test"));
  btnQuitShift.addEventListener("click", () => {
    sfx.click();
    goToYard();
  });

  btnSumTest.addEventListener("click", () => startShift("test"));
  btnSumPlay.addEventListener("click", () => startShift("shift"));
  btnSumYard.addEventListener("click", () => {
    sfx.click();
    goToYard();
  });

  btnResetProgress.addEventListener("click", () => {
    if (!window.confirm("Reset all Doozer Towers progress?")) return;
    saveData = defaultSave();
    writeLocalSave(saveData);
    void syncSaveToArcade(saveData, 0);
    renderYard();
  });

  soundToggleEl.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    writeSoundPref();
    updateSoundUi();
    if (!soundEnabled) {
      stopMusic();
      return;
    }
    ensureAudio();
    sfx.click();
    if (currentView === "workbench" && shift && (shift.phase === "playing" || shift.phase === "feedback")) {
      startMusic();
    }
  });

  if (TEST_TOOLS_ENABLED) {
    testRankWrap.hidden = false;
    testRankSelect.addEventListener("change", () => {
      rankOverride = RANKS.includes(testRankSelect.value) ? testRankSelect.value : null;
      testRankWrap.classList.toggle("active", rankOverride !== null);
      testRankLabel.textContent = rankOverride ? `TEST RANK ${rankOverride}` : "Test rank";
      if (currentView === "yard") renderYard();
    });
  }

  keypadKeysEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-key]");
    if (!btn) return;
    pressKeypad(btn.dataset.key);
  });

  window.addEventListener("keydown", (event) => {
    if (currentView !== "workbench" || !shift || shift.phase !== "playing") return;
    if (event.key === "Enter") {
      event.preventDefault();
      pressKeypad("enter");
    } else if (event.key === "Backspace") {
      event.preventDefault();
      pressKeypad("back");
    } else if (event.key === "Escape") {
      pressKeypad("clear");
    } else if (/^[0-9]$/.test(event.key)) {
      pressKeypad(event.key);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
      if (shift && shift.timeLimitMs && shift.phase === "playing") {
        stopBlueprintTimer();
        shift.pausedElapsed = performance.now() - shift.questionStart;
      }
    } else {
      if (soundEnabled && currentView === "workbench" && shift && (shift.phase === "playing" || shift.phase === "feedback")) {
        startMusic();
      }
      if (shift && shift.timeLimitMs && shift.phase === "playing" && typeof shift.pausedElapsed === "number") {
        shift.questionStart = performance.now() - shift.pausedElapsed;
        delete shift.pausedElapsed;
        startBlueprintTimerIfNeeded();
      }
    }
  });

  window.addEventListener("pagehide", stopMusic);

  const handleReducedMotion = (ev) => { reducedMotion = ev.matches; };
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", handleReducedMotion);
  }

  // ------------------------------------------------------------- bootstrap --
  updateSoundUi();
  renderYard();
  showView("yard");
  void hydrateFromArcade();
})();
