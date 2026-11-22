/* Clock Shop — analog clock reading & setting workshop.
 * Ranks C -> B -> A -> S:
 *   C (Apprentice): hours & half-hours (:00, :30), 10 clocks, untimed
 *   B (Clockmaker): quarter-hours + worded basics, 12 clocks, untimed
 *   A (Master Horologist): 5-minute marks + near-hour wording, 14 clocks, untimed
 *   S (Grand Timekeeper): 1-minute precision + elapsed time + per-clock timer, 16 clocks
 * Finish 2 shifts at a rank to unlock its 100% Rank-Up Test. Missing a test never drops rank.
 */
(function () {
  "use strict";

  const GAME_ID = "clockshop";
  const SOUND_KEY = "matharcade_clockshop_sound";
  const LOCAL_SAVE_KEY = "matharcade_clockshop_save_v1";
  const RANKS = ["C", "B", "A", "S"];
  const ROUNDS_TO_TEST = 2;
  const CHIME_STREAK = 5;
  const BASE_POINTS = 100;
  const STREAK_BONUS = 20;
  const STREAK_BONUS_CAP = 100;
  const CHIME_BONUS = 50;
  const SPEED_BONUS_PER_SEC = 5;
  const CORRECT_HOLD_MS = 950;
  const CHIME_HOLD_MS = 1450;
  const WRONG_HOLD_MS = 1750;
  const END_HOLD_MS = 1700;

  const RANK_RULES = {
    C: {
      title: "Apprentice",
      blurb: "Hours and half-hours (:00 and :30) with helpful hand colors",
      clocks: 10,
      snapMin: 30,
      minSteps: [-30, 30],
      readTimerMs: null,
      setTimerMs: null,
      showOuterMinutes: true,
      colorHands: true,
      tickMode: "quarter",
      minimalChance: 0,
      wordedChance: 0,
      elapsedChance: 0,
      meta: "10 clocks · untimed"
    },
    B: {
      title: "Clockmaker",
      blurb: "Quarter-hours (:15, :30, :45) plus worded times like quarter past",
      clocks: 12,
      snapMin: 15,
      minSteps: [-15, 15],
      readTimerMs: null,
      setTimerMs: null,
      showOuterMinutes: false,
      colorHands: true,
      tickMode: "five",
      minimalChance: 0,
      wordedChance: 0.5,
      elapsedChance: 0,
      meta: "12 clocks · untimed"
    },
    A: {
      title: "Master Horologist",
      blurb: "All 5-minute marks, tricky near-hour hands, and classic dials",
      clocks: 14,
      snapMin: 5,
      minSteps: [-5, 5],
      readTimerMs: null,
      setTimerMs: null,
      showOuterMinutes: false,
      colorHands: false,
      tickMode: "minute",
      minimalChance: 0,
      wordedChance: 0.5,
      elapsedChance: 0,
      meta: "14 clocks · untimed"
    },
    S: {
      title: "Grand Timekeeper",
      blurb: "Exact 1-minute precision, elapsed time orders, and timed shifts",
      clocks: 16,
      snapMin: 1,
      minSteps: [-5, -1, 1, 5],
      readTimerMs: 15000,
      setTimerMs: 22000,
      showOuterMinutes: false,
      colorHands: false,
      tickMode: "minute",
      minimalChance: 0.45,
      wordedChance: 0.35,
      elapsedChance: 0.22,
      meta: "16 clocks · timed"
    }
  };

  const CLOCK_STYLES = [
    { id: "brass", rim: "#d97706", rimDark: "#9a4408", face: "#fffdf7", accent: "#ffd875", shape: "pocket" },
    { id: "mint", rim: "#2ea89c", rimDark: "#146e65", face: "#fbfffd", accent: "#b9efe8", shape: "wall" },
    { id: "coral", rim: "#eb6478", rimDark: "#b53349", face: "#fffbfb", accent: "#ffd0d8", shape: "alarm" },
    { id: "sky", rim: "#4b8fda", rimDark: "#2a609e", face: "#fafdff", accent: "#c7e2ff", shape: "wall" },
    { id: "lilac", rim: "#8b6bd6", rimDark: "#5b3fa3", face: "#fdfbff", accent: "#e2d4ff", shape: "pocket" },
    { id: "walnut", rim: "#9d6235", rimDark: "#633818", face: "#fffaf0", accent: "#ecc89b", shape: "alarm" }
  ];

  const BURST_COLORS = ["#ffd875", "#f59e0b", "#2ea89c", "#eb6478", "#8b6bd6", "#ffffff"];

  const TEST_TOOLS_ENABLED = new URLSearchParams(window.location.search).has("test");

  // ------------------------------------------------------------------ DOM --
  const brandBtn = document.getElementById("brand-btn");
  const testRankWrap = document.getElementById("test-rank-wrap");
  const testRankLabel = document.getElementById("test-rank-label");
  const testRankSelect = document.getElementById("test-rank-select");
  const soundToggleEl = document.getElementById("sound-toggle");
  const soundIconEl = document.getElementById("sound-icon");
  const soundLabelEl = document.getElementById("sound-label");

  const viewShopfront = document.getElementById("view-shopfront");
  const viewWorkbench = document.getElementById("view-workbench");
  const viewSummary = document.getElementById("view-summary");

  const heroClockWrap = document.getElementById("hero-clock-wrap");
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
  const statBestStreak = document.getElementById("stat-best-streak");
  const statClocksFixed = document.getElementById("stat-clocks-fixed");
  const statAccuracy = document.getElementById("stat-accuracy");
  const btnResetProgress = document.getElementById("btn-reset-progress");

  const btnQuitShift = document.getElementById("btn-quit-shift");
  const wbTitle = document.getElementById("wb-title");
  const wbSubtitle = document.getElementById("wb-subtitle");
  const hudClock = document.getElementById("hud-clock");
  const hudScoreChip = document.getElementById("hud-score-chip");
  const hudScore = document.getElementById("hud-score");
  const hudStreakChip = document.getElementById("hud-streak-chip");
  const hudStreak = document.getElementById("hud-streak");
  const hudRank = document.getElementById("hud-rank");

  const clockTimerEl = document.getElementById("clock-timer");
  const clockTimerFill = document.getElementById("clock-timer-fill");
  const clockTimerText = document.getElementById("clock-timer-text");
  const orderTicketEl = document.getElementById("order-ticket");
  const orderModeBadge = document.getElementById("order-mode-badge");
  const orderPrompt = document.getElementById("order-prompt");
  const orderSub = document.getElementById("order-sub");
  const orderFeedback = document.getElementById("order-feedback");

  const readControlsEl = document.getElementById("read-controls");
  const readDisplayEl = document.getElementById("read-display");
  const quick30Btn = document.getElementById("quick-30");
  const keypadKeysEl = document.getElementById("keypad-keys");

  const setControlsEl = document.getElementById("set-controls");
  const handLegendEl = document.getElementById("hand-legend");
  const minuteSteppersEl = document.getElementById("minute-steppers");
  const btnCheckClock = document.getElementById("btn-check-clock");

  const clockStageEl = document.getElementById("clock-stage");
  const repairedRowEl = document.getElementById("repaired-row");
  const chimePipsEl = document.getElementById("chime-pips");
  const clockHolderEl = document.getElementById("clock-holder");
  const stageEffectsEl = document.getElementById("stage-effects");
  const stageOverlayEl = document.getElementById("stage-overlay");

  const sumHeadEl = document.getElementById("sum-head");
  const sumTitleEl = document.getElementById("sum-title");
  const sumSubEl = document.getElementById("sum-sub");
  const sumAccuracyEl = document.getElementById("sum-accuracy");
  const sumRatioEl = document.getElementById("sum-ratio");
  const sumAvgTimeEl = document.getElementById("sum-avg-time");
  const sumStreakEl = document.getElementById("sum-streak");
  const sumFixedEl = document.getElementById("sum-fixed");
  const sumScoreEl = document.getElementById("sum-score");
  const sumEventsEl = document.getElementById("sum-events");
  const sumShowcaseWrap = document.getElementById("sum-showcase-wrap");
  const sumShowcaseGrid = document.getElementById("sum-showcase-grid");
  const sumMissesWrap = document.getElementById("sum-misses-wrap");
  const sumMissesGrid = document.getElementById("sum-misses-grid");
  const btnSumTest = document.getElementById("btn-sum-test");
  const btnSumPlay = document.getElementById("btn-sum-play");
  const btnSumShop = document.getElementById("btn-sum-shop");

  if (!viewShopfront || !viewWorkbench || !viewSummary || !clockHolderEl) return;

  // --------------------------------------------------------------- helpers --
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

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
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

  // ----------------------------------------------------------- clock math --
  function wrapMinutes(total) {
    return ((Math.round(total) % 720) + 720) % 720;
  }

  function toHourMinute(total) {
    const m = wrapMinutes(total);
    const h24 = Math.floor(m / 60);
    return { hour: h24 === 0 ? 12 : h24, minute: m % 60 };
  }

  function fromHourMinute(hour, minute) {
    return wrapMinutes((hour % 12) * 60 + minute);
  }

  function formatDigital(total) {
    const { hour, minute } = toHourMinute(total);
    return `${hour}:${String(minute).padStart(2, "0")}`;
  }

  const WORD_MINUTES_PAST = {
    5: "five past",
    10: "ten past",
    15: "quarter past",
    20: "twenty past",
    25: "twenty-five past",
    30: "half past"
  };

  const WORD_MINUTES_TO = {
    35: "twenty-five to",
    40: "twenty to",
    45: "quarter to",
    50: "ten to",
    55: "five to"
  };

  function formatWorded(total) {
    const { hour, minute } = toHourMinute(total);
    if (minute === 0) return `${hour} o'clock`;
    if (WORD_MINUTES_PAST[minute]) return `${WORD_MINUTES_PAST[minute]} ${hour}`;
    if (WORD_MINUTES_TO[minute]) {
      const nextHour = (hour % 12) + 1;
      return `${WORD_MINUTES_TO[minute]} ${nextHour}`;
    }
    return formatDigital(total);
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
        clocksFixed: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        bestStreak: 0
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
        clocksFixed: Math.floor(num(raw.stats.clocksFixed, 0)),
        totalCorrect: Math.floor(num(raw.stats.totalCorrect, 0)),
        totalAnswered: Math.floor(num(raw.stats.totalAnswered, 0)),
        bestStreak: Math.floor(num(raw.stats.bestStreak, 0))
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
  let currentView = "shopfront"; // shopfront | workbench | summary

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
      console.warn("Clock Shop: MathArcade sync failed", err);
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
          if (currentView === "shopfront") renderShopfront();
        }
      }
    } catch (err) {
      console.warn("Clock Shop: could not load remote progress", err);
    }
  }

  // ---------------------------------------------------- question generator --
  function pickMinutesForRank(rank, forceNearHour) {
    if (rank === "C") {
      return Math.random() < 0.5 ? 0 : 30;
    }
    if (rank === "B") {
      if (Math.random() < 0.72) return Math.random() < 0.5 ? 15 : 45;
      return Math.random() < 0.5 ? 0 : 30;
    }
    if (rank === "A") {
      if (forceNearHour) return randomItem([45, 50, 55]);
      return randInt(0, 11) * 5;
    }
    // Rank S: bias strongly toward non-5-minute marks for real 1-minute precision
    if (Math.random() < 0.8) {
      let m = randInt(1, 59);
      if (m % 5 === 0) m = (m + randInt(1, 4)) % 60;
      return m;
    }
    return randInt(0, 59);
  }

  function pickStartTimeForSet(targetTotal, snapMin) {
    const step = Math.max(snapMin, 15);
    const totalSteps = Math.floor(720 / step);
    let candidate = targetTotal;
    for (let tries = 0; tries < 20; tries += 1) {
      candidate = wrapMinutes(randInt(0, totalSteps - 1) * step);
      const diff = Math.min(Math.abs(candidate - targetTotal), 720 - Math.abs(candidate - targetTotal));
      if (diff >= 60) return candidate;
    }
    return wrapMinutes(targetTotal + 180);
  }

  function buildShiftQuestions(rank) {
    const rules = RANK_RULES[rank];
    const count = rules.clocks;
    const kinds = [];

    // Mix Read and Set evenly (and Elapsed Set on Rank S)
    const elapsedCount = rules.elapsedChance > 0 ? Math.max(2, Math.round(count * rules.elapsedChance)) : 0;
    const readCount = Math.floor((count - elapsedCount) / 2) + (rank === "S" ? 1 : 0);
    const setCount = count - elapsedCount - readCount;

    for (let i = 0; i < readCount; i += 1) kinds.push("read");
    for (let i = 0; i < setCount; i += 1) kinds.push("set");
    for (let i = 0; i < elapsedCount; i += 1) kinds.push("elapsed");

    const shuffledKinds = shuffle(kinds);
    const usedTargets = new Set();
    const questions = [];

    // Ensure at least 30% near-hour clocks at Rank A
    const nearHourTarget = rank === "A" ? Math.ceil(count * 0.35) : 0;
    let nearHourAssigned = 0;

    shuffledKinds.forEach((kind, index) => {
      const style = CLOCK_STYLES[(index + randInt(0, CLOCK_STYLES.length - 1)) % CLOCK_STYLES.length];
      const minimalFace = Math.random() < rules.minimalChance;
      const forceNearHour = rank === "A" && nearHourAssigned < nearHourTarget && (index % 2 === 0 || count - index <= nearHourTarget - nearHourAssigned);

      if (kind === "elapsed") {
        const baseHour = randInt(1, 12);
        const baseMin = pickMinutesForRank("S", false);
        const baseTotal = fromHourMinute(baseHour, baseMin);
        const offsetMag = randomItem([5, 10, 15, 20, 25, 30]);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const target = wrapMinutes(baseTotal + dir * offsetMag);
        const dirWord = dir > 0 ? "after" : "before";
        questions.push({
          kind: "set",
          subKind: "elapsed",
          target,
          start: baseTotal,
          prompt: `${offsetMag} min ${dirWord} ${formatDigital(baseTotal)}`,
          subPrompt: "Clock starts at the given time — wind it to the new time!",
          style,
          minimalFace
        });
        return;
      }

      let target = 0;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const h = randInt(1, 12);
        const m = pickMinutesForRank(rank, forceNearHour);
        target = fromHourMinute(h, m);
        if (!usedTargets.has(target)) break;
      }
      usedTargets.add(target);
      if (toHourMinute(target).minute >= 45) nearHourAssigned += 1;

      if (kind === "read") {
        questions.push({
          kind: "read",
          subKind: "read",
          target,
          start: target,
          prompt: "What time is it?",
          subPrompt: "Type the time on the keypad or keyboard",
          style,
          minimalFace
        });
      } else {
        const canWord = (toHourMinute(target).minute % 5 === 0) && Math.random() < rules.wordedChance;
        const promptText = canWord ? formatWorded(target) : formatDigital(target);
        questions.push({
          kind: "set",
          subKind: canWord ? "worded" : "digital",
          target,
          start: pickStartTimeForSet(target, rules.snapMin),
          prompt: promptText,
          subPrompt: "Drag the hands or tap the step buttons to set the clock",
          style,
          minimalFace
        });
      }
    });

    return questions;
  }

  // --------------------------------------------------------- SVG renderer --
  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => el.setAttribute(k, String(attrs[k])));
    }
    return el;
  }

  function buildClockSvg(options) {
    const {
      totalMinutes,
      style,
      colorHands,
      showOuterMinutes,
      tickMode,
      minimalFace,
      interactive,
      mini
    } = options;

    const svg = svgEl("svg", {
      viewBox: "0 0 300 300",
      class: `clock-svg${interactive ? " interactive" : ""}`,
      role: "img",
      "aria-label": interactive ? "Interactive analog clock" : `Analog clock showing ${formatDigital(totalMinutes)}`
    });

    // Decorative clock body accents (behind main bezel)
    if (!mini) {
      if (style.shape === "alarm") {
        // Two cute top bells + feet
        const leftFoot = svgEl("line", { x1: 86, y1: 256, x2: 70, y2: 280, stroke: style.rimDark, "stroke-width": 12, "stroke-linecap": "round" });
        const rightFoot = svgEl("line", { x1: 214, y1: 256, x2: 230, y2: 280, stroke: style.rimDark, "stroke-width": 12, "stroke-linecap": "round" });
        const bellLeft = svgEl("circle", { cx: 74, cy: 62, r: 30, fill: style.rim, stroke: style.rimDark, "stroke-width": 6 });
        const bellRight = svgEl("circle", { cx: 226, cy: 62, r: 30, fill: style.rim, stroke: style.rimDark, "stroke-width": 6 });
        const striker = svgEl("path", { d: "M138 22 L162 22", stroke: style.rimDark, "stroke-width": 7, "stroke-linecap": "round" });
        const stem = svgEl("line", { x1: 150, y1: 22, x2: 150, y2: 42, stroke: style.rimDark, "stroke-width": 6 });
        svg.append(leftFoot, rightFoot, bellLeft, bellRight, stem, striker);
      } else if (style.shape === "pocket") {
        // Brass crown + ring at top
        const ring = svgEl("circle", { cx: 150, cy: 20, r: 14, fill: "none", stroke: style.rimDark, "stroke-width": 6 });
        const crown = svgEl("rect", { x: 138, y: 26, width: 24, height: 16, rx: 6, fill: style.rim, stroke: style.rimDark, "stroke-width": 4 });
        svg.append(ring, crown);
      }
    }

    // Main outer bezel & face
    const outerR = mini ? 132 : 122;
    const innerR = mini ? 110 : 108;
    svg.append(
      svgEl("circle", { cx: 150, cy: 150, r: outerR, fill: style.rim, stroke: style.rimDark, "stroke-width": mini ? 12 : 7 }),
      svgEl("circle", { cx: 150, cy: 150, r: innerR, fill: style.face, stroke: style.accent, "stroke-width": mini ? 6 : 5 })
    );

    // Subtle glossy face arc
    if (!mini) {
      svg.append(
        svgEl("path", {
          d: "M74 112 A90 90 0 0 1 226 112",
          fill: "none",
          stroke: "rgba(255,255,255,0.65)",
          "stroke-width": 8,
          "stroke-linecap": "round"
        })
      );
    }

    // Tick marks
    const tickCount = mini ? 12 : tickMode === "minute" ? 60 : 12;
    for (let i = 0; i < tickCount; i += 1) {
      const isFive = tickCount === 60 ? i % 5 === 0 : true;
      const isQuarter = tickCount === 60 ? i % 15 === 0 : i % 3 === 0;
      const deg = (360 / tickCount) * i;
      const rad = ((deg - 90) * Math.PI) / 180;
      const rOuter = innerR - (mini ? 8 : 4);
      let len = mini ? 12 : 5;
      let width = mini ? 5 : 2;
      let color = "rgba(63, 42, 29, 0.35)";

      if (isQuarter) {
        len = mini ? 18 : 10;
        width = mini ? 8 : 4;
        color = "#3f2a1d";
      } else if (isFive) {
        len = mini ? 12 : 8;
        width = mini ? 5 : 2.8;
        color = "#5f4330";
      }

      if (!mini && minimalFace && isFive && !isQuarter) {
        len = 14;
        width = 4.2;
        color = "#3f2a1d";
      }

      svg.append(
        svgEl("line", {
          x1: 150 + Math.cos(rad) * (rOuter - len),
          y1: 150 + Math.sin(rad) * (rOuter - len),
          x2: 150 + Math.cos(rad) * rOuter,
          y2: 150 + Math.sin(rad) * rOuter,
          stroke: color,
          "stroke-width": width,
          "stroke-linecap": "round"
        })
      );
    }

    // Numerals
    if (!mini) {
      const numR = 74;
      for (let h = 1; h <= 12; h += 1) {
        if (minimalFace && h % 3 !== 0) continue;
        const rad = ((h * 30 - 90) * Math.PI) / 180;
        const x = 150 + Math.cos(rad) * numR;
        const y = 150 + Math.sin(rad) * numR;
        const txt = svgEl("text", {
          x,
          y: y + 7,
          "text-anchor": "middle",
          "font-family": "Fredoka, Nunito, sans-serif",
          "font-size": minimalFace ? 23 : 20,
          "font-weight": 700,
          fill: "#3f2a1d"
        });
        txt.textContent = String(h);
        svg.append(txt);
      }

      // Rank C helper cues (:00 at top, :30 at bottom)
      if (showOuterMinutes) {
        const topHint = svgEl("text", {
          x: 150,
          y: 39,
          "text-anchor": "middle",
          "font-family": "Fredoka, Nunito, sans-serif",
          "font-size": 12.5,
          "font-weight": 700,
          fill: "#ffffff"
        });
        topHint.textContent = ":00";
        const botHint = svgEl("text", {
          x: 150,
          y: 269,
          "text-anchor": "middle",
          "font-family": "Fredoka, Nunito, sans-serif",
          "font-size": 12.5,
          "font-weight": 700,
          fill: "#ffffff"
        });
        botHint.textContent = ":30";
        svg.append(topHint, botHint);
      }
    }

    // Hands group
    const hourColor = colorHands ? "#eb6478" : "#3f2a1d";
    const minColor = colorHands ? "#167c72" : "#5c3c24";

    const hourGroup = svgEl("g", { class: "hand-hour-group", "data-hand": "hour" });
    hourGroup.append(
      svgEl("line", {
        x1: 150,
        y1: 162,
        x2: 150,
        y2: mini ? 96 : 94,
        stroke: hourColor,
        "stroke-width": mini ? 13 : 10,
        "stroke-linecap": "round"
      })
    );
    if (interactive) {
      hourGroup.append(
        svgEl("line", { x1: 150, y1: 150, x2: 150, y2: 88, class: "clock-hand-hit", "data-hand": "hour" }),
        svgEl("circle", { cx: 150, cy: 96, r: 6.5, fill: "#fff", stroke: hourColor, "stroke-width": 3, "data-hand": "hour" })
      );
    }

    const minGroup = svgEl("g", { class: "hand-minute-group", "data-hand": "minute" });
    minGroup.append(
      svgEl("line", {
        x1: 150,
        y1: 166,
        x2: 150,
        y2: mini ? 64 : 62,
        stroke: minColor,
        "stroke-width": mini ? 9 : 6.8,
        "stroke-linecap": "round"
      })
    );
    if (interactive) {
      minGroup.append(
        svgEl("line", { x1: 150, y1: 150, x2: 150, y2: 56, class: "clock-hand-hit", "data-hand": "minute" }),
        svgEl("circle", { cx: 150, cy: 64, r: 6.5, fill: "#fff", stroke: minColor, "stroke-width": 3, "data-hand": "minute" })
      );
    }

    const cap = svgEl("circle", { cx: 150, cy: 150, r: mini ? 11 : 9, fill: style.rimDark, stroke: "#fff", "stroke-width": mini ? 3 : 2.5 });
    svg.append(hourGroup, minGroup, cap);

    updateClockHands(svg, totalMinutes);
    return svg;
  }

  function updateClockHands(svg, totalMinutes) {
    if (!svg) return;
    const { hour, minute } = toHourMinute(totalMinutes);
    const minAngle = minute * 6;
    const hourAngle = ((hour % 12) + minute / 60) * 30;
    const hourGroup = svg.querySelector(".hand-hour-group");
    const minGroup = svg.querySelector(".hand-minute-group");
    if (hourGroup) hourGroup.setAttribute("transform", `rotate(${hourAngle} 150 150)`);
    if (minGroup) minGroup.setAttribute("transform", `rotate(${minAngle} 150 150)`);
  }

  // ------------------------------------------------------ hero live clock --
  let heroClockSvg = null;
  function initHeroClock() {
    const now = new Date();
    const mins = fromHourMinute(now.getHours() % 12 || 12, now.getMinutes());
    heroClockSvg = buildClockSvg({
      totalMinutes: mins,
      style: CLOCK_STYLES[0],
      colorHands: true,
      showOuterMinutes: false,
      tickMode: "minute",
      minimalFace: false,
      interactive: false,
      mini: false
    });
    heroClockWrap.replaceChildren(heroClockSvg);
  }

  window.setInterval(() => {
    if (!heroClockSvg || currentView !== "shopfront") return;
    const now = new Date();
    updateClockHands(heroClockSvg, fromHourMinute(now.getHours() % 12 || 12, now.getMinutes()));
  }, 15000);

  // ------------------------------------------------------- procedural sfx --
  let soundEnabled = readSoundPref();
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let nextMusicTime = 0;

  // Warm clockwork marimba chords: C — G — Am — F
  const MUSIC_CHORDS = [
    [60, 64, 67, 72],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [53, 57, 60, 65]
  ];
  const MUSIC_PATTERN = [0, 2, 1, 3, 2, 1, 0, 2];

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
        musicGain.gain.value = 0.22;
        sfxGain.gain.value = 0.85;
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

    // Gentle wooden tick-tock pulse on every beat
    tone({
      type: "triangle",
      freq: pos % 2 === 0 ? 1100 : 880,
      time,
      duration: 0.025,
      gain: 0.028,
      attack: 0.002
    }, musicGain);

    // Warm marimba arpeggio
    const note = chord[MUSIC_PATTERN[pos]];
    tone({
      type: "sine",
      freq: midiHz(note + 12),
      time,
      duration: 0.18,
      gain: 0.055,
      attack: 0.005
    }, musicGain);

    if (pos === 0) {
      tone({
        type: "triangle",
        freq: midiHz(chord[0] - 12),
        time,
        duration: 0.36,
        gain: 0.07,
        attack: 0.01
      }, musicGain);
    }
  }

  function musicStepDur() {
    const bpm = shift && shift.rank === "S" ? 116 : 96;
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
    musicGain.gain.setTargetAtTime(0.22, ctx.currentTime, 0.04);
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
      tone({ type: "triangle", freq: 560, endFreq: 740, duration: 0.06, gain: 0.08 });
    },
    tick() {
      tone({ type: "triangle", freq: 980, endFreq: 620, duration: 0.032, gain: 0.06, attack: 0.002 });
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
    correct(streak) {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const lift = Math.pow(2, Math.min(streak - 1, 7) / 24);
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone({ type: i === 2 ? "sine" : "triangle", freq: f * lift, time: now + i * 0.06, duration: 0.22, gain: 0.12 });
      });
    },
    grandChime() {
      // Bright Westminster-inspired 4-bell chime
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      [659.25, 523.25, 587.33, 392.0, 783.99].forEach((f, i) => {
        tone({ type: "sine", freq: f, time: now + i * 0.14, duration: i === 4 ? 0.55 : 0.34, gain: 0.14 });
        tone({ type: "triangle", freq: f * 2, time: now + i * 0.14, duration: 0.2, gain: 0.05 });
      });
    },
    wrong() {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      tone({ type: "sawtooth", freq: 300, endFreq: 180, time: now, duration: 0.22, gain: 0.07 });
      tone({ type: "triangle", freq: 165, time: now + 0.06, duration: 0.18, gain: 0.08 });
    },
    win() {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ type: "triangle", freq: f, time: now + i * 0.1, duration: i === 3 ? 0.5 : 0.28, gain: 0.14 });
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
    viewShopfront.hidden = name !== "shopfront";
    viewWorkbench.hidden = name !== "workbench";
    viewSummary.hidden = name !== "summary";
  }

  // -------------------------------------------------------- shopfront UI --
  function renderShopfront() {
    const playRank = activePlayRank();
    const rules = RANK_RULES[playRank];
    const top = isTopRank(saveData.rank);
    const testReady = canTakeTest(saveData) && playRank === saveData.rank;

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
      homeLockNote.textContent = "Top rank reached! Chase a new high score on timed shifts.";
    } else if (testReady) {
      homeLockNote.textContent = "Score 100% on the test to rank up. Missing never drops your rank!";
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
    statBestStreak.textContent = String(saveData.stats.bestStreak);
    statClocksFixed.textContent = formatScore(saveData.stats.clocksFixed);
    const acc = saveData.stats.totalAnswered > 0
      ? `${Math.round((saveData.stats.totalCorrect / saveData.stats.totalAnswered) * 100)}%`
      : "-";
    statAccuracy.textContent = acc;
  }

  // --------------------------------------------------------- shift engine --
  let shift = null;
  let timerRaf = 0;
  let lastUrgentSec = -1;
  let dragState = null;

  function stopClockTimer() {
    if (timerRaf) {
      window.cancelAnimationFrame(timerRaf);
      timerRaf = 0;
    }
  }

  function startShift(mode) {
    clearTasks();
    stopClockTimer();
    dragState = null;
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
      streak: 0,
      chimeCount: 0,
      bestStreak: 0,
      correct: 0,
      answered: 0,
      totalMs: 0,
      questionStart: 0,
      timeLimitMs: null,
      readDigits: "",
      dialMinutes: 0,
      activeSvg: null,
      repaired: [], // { style, target }
      misses: []    // { question, givenText }
    };

    viewWorkbench.classList.toggle("mode-test", mode === "test");
    wbTitle.textContent = mode === "test" ? `Rank ${rank} Rank-Up Test` : `Rank ${rank} Shift`;
    wbSubtitle.textContent = mode === "test"
      ? "100% accuracy needed — one slip ends the test (no rank lost)"
      : "Read & set each clock · five in a row rings a Grand Chime!";

    hudRank.textContent = rank;
    hudRank.className = `rank-badge rank-${rank}`;
    repairedRowEl.innerHTML = `<span class="repaired-empty">none yet</span>`;
    stageEffectsEl.replaceChildren();
    updateChimePips();
    updateWorkbenchHud(false);
    configureStepButtons(rank);
    quick30Btn.hidden = rank !== "C" && rank !== "B";
    handLegendEl.hidden = !RANK_RULES[rank].colorHands;

    showView("workbench");
    mountCurrentQuestion(false);
    runCountdown(3);
  }

  function configureStepButtons(rank) {
    const steps = RANK_RULES[rank].minSteps;
    minuteSteppersEl.replaceChildren();
    const label = document.createElement("span");
    label.className = "stepper-row-label";
    label.textContent = "Minute";
    minuteSteppersEl.append(label);
    steps.forEach((delta) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "step-btn min-btn";
      btn.dataset.stepMin = String(delta);
      btn.textContent = `${delta > 0 ? "+" : "−"}${Math.abs(delta)}m`;
      minuteSteppersEl.append(btn);
    });
  }

  function runCountdown(n) {
    if (!shift) return;
    if (n <= 0) {
      stageOverlayEl.hidden = false;
      stageOverlayEl.className = "stage-overlay countdown";
      stageOverlayEl.textContent = "Open!";
      sfx.go();
      queueTask(() => {
        if (!shift) return;
        stageOverlayEl.hidden = true;
        shift.phase = "playing";
        shift.questionStart = performance.now();
        setInputsDisabled(false);
        startClockTimerIfNeeded();
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
    queueTask(() => runCountdown(n - 1), 620);
  }

  function updateWorkbenchHud(bumpScore) {
    if (!shift) return;
    const shownIdx = Math.min(shift.index + 1, shift.questions.length);
    hudClock.textContent = `${shownIdx} / ${shift.questions.length}`;
    hudScore.textContent = formatScore(shift.score);
    hudStreak.textContent = String(shift.streak);
    hudStreakChip.classList.toggle("hot", shift.streak >= CHIME_STREAK);

    if (bumpScore) {
      hudScoreChip.classList.remove("score-bump");
      void hudScoreChip.offsetWidth;
      hudScoreChip.classList.add("score-bump");
    }
  }

  function updateChimePips() {
    const filled = shift ? shift.chimeCount : 0;
    chimePipsEl.querySelectorAll("span").forEach((dot, idx) => {
      dot.classList.toggle("on", idx < filled);
    });
  }

  function setInputsDisabled(disabled) {
    keypadKeysEl.querySelectorAll("button").forEach((b) => { b.disabled = disabled; });
    readControlsEl.querySelectorAll(".quick-key").forEach((b) => { b.disabled = disabled; });
    setControlsEl.querySelectorAll("button").forEach((b) => { b.disabled = disabled; });
  }

  function mountCurrentQuestion(animateIn) {
    if (!shift) return;
    const q = shift.questions[shift.index];
    if (!q) return;
    const rules = RANK_RULES[shift.rank];

    shift.readDigits = "";
    shift.dialMinutes = q.start;
    shift.timeLimitMs = q.kind === "read" ? rules.readTimerMs : rules.setTimerMs;
    lastUrgentSec = -1;

    // Order ticket
    orderTicketEl.classList.remove("is-wrong", "is-right");
    orderFeedback.hidden = true;
    orderFeedback.className = "order-feedback";
    orderFeedback.textContent = "";

    if (q.kind === "read") {
      orderModeBadge.textContent = "Read the Clock";
      orderModeBadge.className = "mode-pill mode-read";
    } else if (q.subKind === "elapsed") {
      orderModeBadge.textContent = "Elapsed Time";
      orderModeBadge.className = "mode-pill mode-elapsed";
    } else {
      orderModeBadge.textContent = "Set the Clock";
      orderModeBadge.className = "mode-pill mode-set";
    }
    orderPrompt.textContent = q.prompt;
    orderSub.textContent = q.subPrompt;

    // Swap controls
    readControlsEl.hidden = q.kind !== "read";
    setControlsEl.hidden = q.kind !== "set";
    renderReadDisplay(null);

    // Timer bar
    if (shift.timeLimitMs) {
      clockTimerEl.hidden = false;
      clockTimerEl.classList.remove("low");
      clockTimerFill.style.width = "100%";
      clockTimerText.textContent = `${Math.ceil(shift.timeLimitMs / 1000)}s`;
    } else {
      clockTimerEl.hidden = true;
    }

    // Build SVG clock
    const svg = buildClockSvg({
      totalMinutes: q.start,
      style: q.style,
      colorHands: rules.colorHands,
      showOuterMinutes: rules.showOuterMinutes,
      tickMode: rules.tickMode,
      minimalFace: q.minimalFace,
      interactive: q.kind === "set",
      mini: false
    });
    shift.activeSvg = svg;
    clockHolderEl.replaceChildren(svg);
    clockHolderEl.classList.remove("clock-correct", "clock-wrong", "slide-in");
    if (animateIn) {
      void clockHolderEl.offsetWidth;
      clockHolderEl.classList.add("slide-in");
    }

    if (q.kind === "set") {
      svg.addEventListener("pointerdown", onClockPointerDown);
    }

    updateWorkbenchHud(false);
  }

  // ------------------------------------------------------- Rank S timer --
  function startClockTimerIfNeeded() {
    stopClockTimer();
    if (!shift || !shift.timeLimitMs || shift.phase !== "playing") return;

    const loop = () => {
      if (!shift || shift.phase !== "playing" || !shift.timeLimitMs) return;
      const elapsed = performance.now() - shift.questionStart;
      const remaining = Math.max(0, shift.timeLimitMs - elapsed);
      const frac = remaining / shift.timeLimitMs;
      clockTimerFill.style.width = `${frac * 100}%`;
      const secs = Math.ceil(remaining / 1000);
      clockTimerText.textContent = `${secs}s`;

      if (remaining <= 4000) {
        clockTimerEl.classList.add("low");
        if (secs !== lastUrgentSec && secs > 0) {
          lastUrgentSec = secs;
          sfx.urgentTick();
        }
      }

      if (remaining <= 0) {
        stopClockTimer();
        evaluateAnswer(null, true);
        return;
      }
      timerRaf = window.requestAnimationFrame(loop);
    };
    timerRaf = window.requestAnimationFrame(loop);
  }

  // ---------------------------------------------------- Read keypad logic --
  function formatTypedDigits(digits) {
    if (!digits) return `<span class="placeholder">_ : __</span>`;
    if (digits.length === 1) return `${digits} : <span class="placeholder">__</span>`;
    if (digits.length === 2) {
      const two = Number(digits);
      if (two >= 10 && two <= 12) return `${digits} : <span class="placeholder">__</span>`;
      return `${digits[0]} : ${digits[1]}<span class="placeholder">_</span>`;
    }
    if (digits.length === 3) return `${digits[0]} : ${digits.slice(1)}`;
    return `${digits.slice(0, 2)} : ${digits.slice(2)}`;
  }

  function renderReadDisplay(revealMode) {
    readDisplayEl.classList.remove("is-solved", "is-reveal");
    if (revealMode && shift) {
      const q = shift.questions[shift.index];
      const { hour, minute } = toHourMinute(q.target);
      readDisplayEl.textContent = `${hour} : ${String(minute).padStart(2, "0")}`;
      readDisplayEl.classList.add(revealMode === "solved" ? "is-solved" : "is-reveal");
      return;
    }
    readDisplayEl.innerHTML = formatTypedDigits(shift ? shift.readDigits : "");
  }

  function parseReadDigits(digits) {
    if (digits.length < 3 || digits.length > 4) {
      return { ok: false, hint: "Type hour and minutes (like 430, or tap :00)" };
    }
    const hourStr = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2);
    const minStr = digits.slice(-2);
    const hour = Number(hourStr);
    const minute = Number(minStr);
    if (hour < 1 || hour > 12) {
      return { ok: false, hint: "Hours go from 1 to 12." };
    }
    if (minute < 0 || minute > 59) {
      return { ok: false, hint: "Minutes go from 00 to 59." };
    }
    return { ok: true, total: fromHourMinute(hour, minute) };
  }

  function pressKeypad(key) {
    if (!shift || shift.phase !== "playing") return;
    const q = shift.questions[shift.index];
    if (!q || q.kind !== "read") return;

    ensureAudio();
    if (key === "clear") {
      shift.readDigits = "";
      sfx.tick();
      renderReadDisplay(null);
      orderFeedback.hidden = true;
      return;
    }
    if (key === "back") {
      shift.readDigits = shift.readDigits.slice(0, -1);
      sfx.tick();
      renderReadDisplay(null);
      orderFeedback.hidden = true;
      return;
    }
    if (key === "00" || key === "30") {
      const hourVal = Number(shift.readDigits);
      if ((shift.readDigits.length === 1 && hourVal >= 1 && hourVal <= 9) ||
          (shift.readDigits.length === 2 && hourVal >= 10 && hourVal <= 12)) {
        shift.readDigits += key;
        sfx.tick();
        renderReadDisplay(null);
        orderFeedback.hidden = true;
      } else {
        orderFeedback.hidden = false;
        orderFeedback.textContent = "Type the hour (1-12) first, then tap :" + key;
      }
      return;
    }
    if (key === "enter") {
      const parsed = parseReadDigits(shift.readDigits);
      if (!parsed.ok) {
        orderFeedback.hidden = false;
        orderFeedback.textContent = parsed.hint;
        orderTicketEl.classList.remove("is-wrong");
        void orderTicketEl.offsetWidth;
        orderTicketEl.classList.add("is-wrong");
        sfx.tick();
        return;
      }
      evaluateAnswer(parsed.total, false);
      return;
    }
    if (/^[0-9]$/.test(key)) {
      if (shift.readDigits.length < 4) {
        shift.readDigits += key;
        sfx.tick();
        renderReadDisplay(null);
        orderFeedback.hidden = true;
      }
    }
  }

  // ------------------------------------------------ Set drag & step logic --
  function pointerAngleDeg(svg, clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    const dist = Math.hypot(dx, dy) * (300 / Math.max(1, rect.width));
    return { deg, dist };
  }

  function signedAngleDelta(fromDeg, toDeg) {
    let diff = toDeg - fromDeg;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  }

  function applyDialMinutes(newTotal, playTick) {
    if (!shift || !shift.activeSvg) return;
    const wrapped = wrapMinutes(newTotal);
    if (wrapped !== shift.dialMinutes) {
      shift.dialMinutes = wrapped;
      updateClockHands(shift.activeSvg, wrapped);
      if (playTick) sfx.tick();
    }
  }

  function onClockPointerDown(event) {
    if (!shift || shift.phase !== "playing" || !event.isPrimary) return;
    const q = shift.questions[shift.index];
    if (!q || q.kind !== "set" || !shift.activeSvg) return;

    event.preventDefault();
    ensureAudio();
    const svg = shift.activeSvg;
    const { deg, dist } = pointerAngleDeg(svg, event.clientX, event.clientY);
    const snap = RANK_RULES[shift.rank].snapMin;

    let hand = event.target && event.target.getAttribute ? event.target.getAttribute("data-hand") : null;
    if (hand !== "hour" && hand !== "minute") {
      const { hour, minute } = toHourMinute(shift.dialMinutes);
      const minAng = minute * 6;
      const hrAng = ((hour % 12) + minute / 60) * 30;
      const dMin = Math.abs(signedAngleDelta(minAng, deg));
      const dHr = Math.abs(signedAngleDelta(hrAng, deg));
      hand = dist < 66 && dHr < dMin ? "hour" : "minute";

      // If player tapped directly on the rim, jump minute hand cleanly within the current hour
      if (hand === "minute") {
        const curHourStart = Math.floor(shift.dialMinutes / 60) * 60;
        const tappedMin = (Math.round((deg / 6) / snap) * snap) % 60;
        applyDialMinutes(curHourStart + tappedMin, true);
      }
    }

    dragState = {
      pointerId: event.pointerId,
      svg,
      hand,
      lastDeg: deg,
      rawMinutes: shift.dialMinutes,
      snap
    };
    svg.classList.add("dragging");
    try {
      svg.setPointerCapture(event.pointerId);
    } catch (_) { /* ignore */ }
  }

  function onClockPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId || !shift || shift.phase !== "playing") return;
    const { deg } = pointerAngleDeg(dragState.svg, event.clientX, event.clientY);

    if (dragState.hand === "minute") {
      const deltaDeg = signedAngleDelta(dragState.lastDeg, deg);
      dragState.lastDeg = deg;
      dragState.rawMinutes += deltaDeg / 6;
      const snapped = Math.round(dragState.rawMinutes / dragState.snap) * dragState.snap;
      applyDialMinutes(snapped, true);
    } else {
      const curMin = shift.dialMinutes % 60;
      const rawHour = Math.round((deg - curMin * 0.5) / 30);
      const wrappedHour = ((rawHour % 12) + 12) % 12;
      applyDialMinutes(wrappedHour * 60 + curMin, true);
      dragState.rawMinutes = shift.dialMinutes;
    }
  }

  function onClockPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    dragState.svg.classList.remove("dragging");
    dragState = null;
  }

  function stepDial(deltaMinutes) {
    if (!shift || shift.phase !== "playing") return;
    const q = shift.questions[shift.index];
    if (!q || q.kind !== "set") return;
    ensureAudio();
    applyDialMinutes(shift.dialMinutes + deltaMinutes, true);
  }

  // --------------------------------------------------- answer evaluation --
  function evaluateAnswer(givenMinutes, timedOut) {
    if (!shift || shift.phase !== "playing") return;
    stopClockTimer();
    dragState = null;
    shift.phase = "feedback";
    setInputsDisabled(true);

    const q = shift.questions[shift.index];
    const elapsedMs = Math.max(0, performance.now() - shift.questionStart);
    shift.answered += 1;
    shift.totalMs += elapsedMs;

    const isCorrect = !timedOut && givenMinutes === q.target;

    if (isCorrect) {
      shift.correct += 1;
      shift.streak += 1;
      shift.bestStreak = Math.max(shift.bestStreak, shift.streak);
      shift.chimeCount += 1;

      const streakBonus = Math.min((shift.streak - 1) * STREAK_BONUS, STREAK_BONUS_CAP);
      let points = BASE_POINTS + streakBonus;
      if (shift.timeLimitMs) {
        const secsLeft = Math.max(0, Math.floor((shift.timeLimitMs - elapsedMs) / 1000));
        points += secsLeft * SPEED_BONUS_PER_SEC;
      }

      const triggeredChime = shift.chimeCount >= CHIME_STREAK;
      if (triggeredChime) {
        points += CHIME_BONUS;
      }

      shift.score += points;
      shift.repaired.push({ style: q.style, target: q.target });
      addRepairedMiniClock(q.style, q.target);
      updateChimePips();
      updateWorkbenchHud(true);

      orderTicketEl.classList.add("is-right");
      orderFeedback.hidden = false;
      orderFeedback.className = "order-feedback good";
      orderFeedback.textContent = triggeredChime
        ? `Grand Chime! ${formatDigital(q.target)} (+${points})`
        : `Right on time! ${formatDigital(q.target)}`;
      if (q.kind === "read") renderReadDisplay("solved");

      clockHolderEl.classList.add("clock-correct");
      spawnSolveEffects(points, triggeredChime);
      if (triggeredChime) {
        sfx.grandChime();
      } else {
        sfx.correct(shift.streak);
      }

      queueTask(() => {
        if (!shift) return;
        if (triggeredChime) {
          shift.chimeCount = 0;
          updateChimePips();
        }
        advanceShift(true);
      }, triggeredChime ? CHIME_HOLD_MS : CORRECT_HOLD_MS);
    } else {
      shift.streak = 0;
      shift.chimeCount = 0;
      updateChimePips();
      updateWorkbenchHud(false);

      const givenText = timedOut
        ? "Out of time"
        : givenMinutes == null
          ? "No answer"
          : formatDigital(givenMinutes);
      shift.misses.push({ question: q, givenText });

      orderTicketEl.classList.add("is-wrong");
      orderFeedback.hidden = false;
      orderFeedback.className = "order-feedback";
      orderFeedback.textContent = timedOut
        ? `Out of time! It was ${formatDigital(q.target)}`
        : `Not quite — correct time is ${formatDigital(q.target)}`;

      if (q.kind === "read") {
        renderReadDisplay("reveal");
      } else {
        // Show the true hand positions so the student learns from the slip
        updateClockHands(shift.activeSvg, q.target);
      }

      clockHolderEl.classList.add("clock-wrong");
      sfx.wrong();

      queueTask(() => {
        if (!shift) return;
        advanceShift(false);
      }, WRONG_HOLD_MS);
    }
  }

  function advanceShift(lastWasCorrect) {
    if (!shift) return;
    // Rank-up test ends immediately on first miss
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
    mountCurrentQuestion(true);
    shift.questionStart = performance.now();
    setInputsDisabled(false);
    startClockTimerIfNeeded();
  }

  function completeShift(passed) {
    if (!shift) return;
    stopClockTimer();
    stopMusic();
    shift.phase = "done";
    setInputsDisabled(true);

    const isTest = shift.mode === "test";
    stageOverlayEl.hidden = false;
    stageOverlayEl.className = `stage-overlay end-banner ${passed ? "good" : "bad"}`;
    stageOverlayEl.textContent = isTest
      ? (passed ? "Test Passed!" : "Test Missed")
      : "Shift Complete!";

    if (passed) {
      sfx.win();
      spawnConfetti(55);
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
      bestStreak: shift.bestStreak,
      score: shift.score,
      repaired: shift.repaired.slice(),
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
    next.stats.clocksFixed += result.correct;
    next.stats.totalCorrect += result.correct;
    next.stats.totalAnswered += result.answered;
    next.stats.bestStreak = Math.max(next.stats.bestStreak, result.bestStreak);

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
  function addRepairedMiniClock(style, target) {
    const empty = repairedRowEl.querySelector(".repaired-empty");
    if (empty) empty.remove();
    const wrap = document.createElement("span");
    wrap.className = "mini-repaired-clock";
    wrap.title = formatDigital(target);
    wrap.append(
      buildClockSvg({
        totalMinutes: target,
        style,
        colorHands: true,
        showOuterMinutes: false,
        tickMode: "quarter",
        minimalFace: false,
        interactive: false,
        mini: true
      })
    );
    repairedRowEl.append(wrap);
  }

  function spawnSolveEffects(points, isGrandChime) {
    if (reducedMotion) return;
    const stageRect = clockStageEl.getBoundingClientRect();
    const cx = stageRect.width / 2;
    const cy = stageRect.height * 0.48;

    for (let i = 0; i < (isGrandChime ? 28 : 16); i += 1) {
      const p = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const dist = randInt(48, isGrandChime ? 150 : 110);
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

    clockStageEl.classList.remove("solve-flash");
    void clockStageEl.offsetWidth;
    clockStageEl.classList.add("solve-flash");

    if (isGrandChime) {
      const banner = document.createElement("span");
      banner.className = "chime-banner";
      banner.textContent = "Grand Chime! +50";
      banner.addEventListener("animationend", () => banner.remove(), { once: true });
      stageEffectsEl.append(banner);
      spawnConfetti(42);
    }
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
    let sub = "Steady hands keep every clock on time.";
    let good = true;

    if (result.mode === "test") {
      if (result.passed) {
        title = "Perfect Inspection!";
        sub = `Every clock passed in Rank ${result.rank}.`;
      } else {
        title = "Test Missed";
        sub = `Fixed ${result.correct} before the first slip.`;
        good = false;
      }
    } else if (result.accuracy === 1) {
      title = "Flawless Shift!";
      sub = "Right on the dot — not a single tick off.";
    } else if (result.accuracy >= 0.85) {
      title = "Timely Work!";
      sub = "Your customers left smiling.";
    }

    sumHeadEl.classList.toggle("bad", !good);
    sumTitleEl.textContent = title;
    sumSubEl.textContent = sub;

    sumAccuracyEl.textContent = `${Math.round(result.accuracy * 100)}%`;
    sumRatioEl.textContent = `${result.correct}/${result.answered}`;
    sumAvgTimeEl.textContent = `${(result.avgMs / 1000).toFixed(1)}s`;
    sumStreakEl.textContent = String(result.bestStreak);
    sumFixedEl.textContent = String(result.correct);
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
        lines.push({ text: "Rank-up test unlocked! Score 100% to reach the next rank.", tone: "good" });
      } else if (ev.type === "rankUp") {
        lines.push({ text: `RANK UP! ${ev.from} → ${ev.to} (${RANK_RULES[ev.to].title})`, tone: "rank-up" });
      } else if (ev.type === "testFailed") {
        lines.push({ text: "Test missed — no rank lost. Try the test again whenever you're ready!", tone: "bad" });
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
      sfx.grandChime();
    }

    // Repaired showcase gallery
    sumShowcaseGrid.replaceChildren();
    sumShowcaseWrap.hidden = result.repaired.length === 0;
    result.repaired.forEach((item, i) => {
      const cell = document.createElement("div");
      cell.className = "showcase-clock";
      cell.style.animationDelay = `${reducedMotion ? 0 : i * 40}ms`;
      cell.title = formatDigital(item.target);
      cell.append(
        buildClockSvg({
          totalMinutes: item.target,
          style: item.style,
          colorHands: true,
          showOuterMinutes: false,
          tickMode: "five",
          minimalFace: false,
          interactive: false,
          mini: true
        })
      );
      sumShowcaseGrid.append(cell);
    });

    // Misses review
    sumMissesGrid.replaceChildren();
    sumMissesWrap.hidden = result.misses.length === 0;
    result.misses.forEach((m) => {
      const q = m.question;
      const card = document.createElement("div");
      card.className = "miss-item";

      const thumb = document.createElement("div");
      thumb.className = "miss-thumb";
      thumb.append(
        buildClockSvg({
          totalMinutes: q.target,
          style: q.style,
          colorHands: true,
          showOuterMinutes: false,
          tickMode: "minute",
          minimalFace: false,
          interactive: false,
          mini: true
        })
      );

      const info = document.createElement("div");
      info.className = "miss-info";
      const timeEl = document.createElement("div");
      timeEl.className = "miss-time";
      timeEl.textContent = formatDigital(q.target);
      const noteEl = document.createElement("div");
      noteEl.className = "miss-note";
      const promptDesc = q.kind === "read" ? "Read clock" : q.prompt;
      noteEl.textContent = `${promptDesc} · You: ${m.givenText}`;
      info.append(timeEl, noteEl);

      card.append(thumb, info);
      sumMissesGrid.append(card);
    });

    // Action buttons
    const rankedUp = events.some((e) => e.type === "rankUp");
    const showTest = !result.testRun && canTakeTest(saveData);
    btnSumTest.hidden = !showTest;
    btnSumTest.textContent = result.mode === "test" && !result.passed ? "Retry Rank-Up Test" : "Take Rank-Up Test";
    btnSumPlay.textContent = rankedUp ? `Start Rank ${saveData.rank} Shift` : "Play Another Shift";
  }

  function goToShopfront() {
    clearTasks();
    stopClockTimer();
    stopMusic();
    dragState = null;
    shift = null;
    renderShopfront();
    showView("shopfront");
  }

  // ------------------------------------------------------- event bindings --
  brandBtn.addEventListener("click", () => {
    sfx.click();
    goToShopfront();
  });

  btnPlayShift.addEventListener("click", () => startShift("shift"));
  btnPlayTest.addEventListener("click", () => startShift("test"));
  btnQuitShift.addEventListener("click", () => {
    sfx.click();
    goToShopfront();
  });

  btnSumTest.addEventListener("click", () => startShift("test"));
  btnSumPlay.addEventListener("click", () => startShift("shift"));
  btnSumShop.addEventListener("click", () => {
    sfx.click();
    goToShopfront();
  });

  btnResetProgress.addEventListener("click", () => {
    if (!window.confirm("Reset all Clock Shop progress?")) return;
    saveData = defaultSave();
    writeLocalSave(saveData);
    void syncSaveToArcade(saveData, 0);
    renderShopfront();
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
      if (currentView === "shopfront") renderShopfront();
    });
  }

  keypadKeysEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-key]");
    if (!btn) return;
    pressKeypad(btn.dataset.key);
  });

  readControlsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-quick]");
    if (!btn) return;
    pressKeypad(btn.dataset.quick);
  });

  setControlsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-step-min]");
    if (!btn) return;
    stepDial(Number(btn.dataset.stepMin));
  });

  btnCheckClock.addEventListener("click", () => {
    if (!shift || shift.phase !== "playing") return;
    const q = shift.questions[shift.index];
    if (!q || q.kind !== "set") return;
    evaluateAnswer(shift.dialMinutes, false);
  });

  document.addEventListener("pointermove", onClockPointerMove);
  document.addEventListener("pointerup", onClockPointerUp);
  document.addEventListener("pointercancel", onClockPointerUp);

  window.addEventListener("keydown", (event) => {
    if (currentView !== "workbench" || !shift || shift.phase !== "playing") return;
    const q = shift.questions[shift.index];
    if (!q) return;

    if (q.kind === "read") {
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
      return;
    }

    if (q.kind === "set") {
      const snap = RANK_RULES[shift.rank].snapMin;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepDial(snap);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepDial(-snap);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        stepDial(60);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        stepDial(-60);
      } else if (event.key === "Enter") {
        event.preventDefault();
        evaluateAnswer(shift.dialMinutes, false);
      }
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopMusic();
      if (shift && shift.timeLimitMs && shift.phase === "playing") {
        stopClockTimer();
        shift.pausedElapsed = performance.now() - shift.questionStart;
      }
    } else {
      if (soundEnabled && currentView === "workbench" && shift && (shift.phase === "playing" || shift.phase === "feedback")) {
        startMusic();
      }
      if (shift && shift.timeLimitMs && shift.phase === "playing" && typeof shift.pausedElapsed === "number") {
        shift.questionStart = performance.now() - shift.pausedElapsed;
        delete shift.pausedElapsed;
        startClockTimerIfNeeded();
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
  initHeroClock();
  renderShopfront();
  showView("shopfront");
  void hydrateFromArcade();
})();
