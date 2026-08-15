/* MathArcade shared client helpers */
(function (global) {
  const TOKEN_KEY = "matharcade_device_token";
  const NAME_KEY = "matharcade_player_name";

  const TOPICS = [
    { id: "addition", label: "Addition" },
    { id: "subtraction", label: "Subtraction" },
    { id: "multiplication", label: "Multiplication" },
    { id: "division", label: "Division", comingSoon: true },
    { id: "other", label: "Other" },
    { id: "bonus", label: "Bonus", bonus: true }
  ];

  const GAMES = [
    {
      id: "make10",
      title: "Make 10",
      path: "/games/make10.html",
      topic: "addition",
      axisIndex: 0,
      axisLabel: "Make 10",
      blurb: "Drag a live electric wire to the number that completes 10. Climb C→S voltage ranks!",
      howTo: "A glowing wire is anchored to the base number. Guide its free end to the number that adds with the base to make 10, then click or release to connect. Correct circuits spark and boost your streak; wrong ones fizzle. Complete 10 circuits to rank up (C→B→A→S). Higher ranks pack the field with more decoys, tighten the snap, and add a per-circuit timer at A and S.",
      rankMode: "single"
    },
    {
      id: "skipcounting",
      title: "Lava Leap",
      path: "/games/skipcounting.html",
      topic: "addition",
      axisIndex: 1,
      axisLabel: "Lava Leap",
      blurb: "Skip-count platform to platform and outrun the rising lava!",
      howTo: "Pick a number 2–10, then tap the platform showing the next skip-count number to leap there. Each number has its own rank (C→S) that speeds up the lava. Reach ×12 to escape!",
      rankMode: "perNumber"
    },
    {
      id: "avalanche",
      title: "Avalanche Run",
      path: "/games/avalanche.html",
      topic: "subtraction",
      axisIndex: 0,
      axisLabel: "Avalanche",
      blurb: "Skip-count down the mountain and outrun the avalanche!",
      howTo: "Pick a number 2–10, then tap the platform showing the next countdown number to hop down from ×12 all the way to 0. Each number has its own rank (C→S) that speeds up the avalanche. Reach 0 to escape!",
      rankMode: "perNumber"
    },
    {
      id: "maze",
      title: "Galaxy Maze",
      path: "/games/maze.html",
      topic: "multiplication",
      axisIndex: 0,
      axisLabel: "Galaxy Maze",
      blurb: "Pilot a starship from Sol and follow a signal of alien life. Climb C→S navigation ranks!",
      howTo: "Each hyperspace jump needs a multiplication answer. Pick the neighboring star showing the correct product to launch, scan each system for life, and find the living world 10-15 jumps out. Completing a mission ranks you up (C→B→A→S); higher ranks use bigger factors and more decoy products.",
      rankMode: "single"
    },
    {
      id: "calendar",
      title: "Calendar Scramble",
      path: "/games/calendar.html",
      topic: "other",
      axisIndex: 0,
      axisLabel: "Calendar",
      blurb: "Drag scattered months back into order before the curtain falls. Climb C→S ranks — S starts with a fully empty year!",
      howTo: "The year stacks on the left with some months missing. Drag each missing month to its ordinal slot (1st–12th). Clear three rounds before the falling curtain covers the field to rank up (C→B→A→S). Higher ranks leave fewer months filled in; S starts empty every round. Fast placements score more; wrong slots cost 5.",
      rankMode: "single"
    },
    {
      id: "primesearch",
      title: "Prime Search",
      path: "/games/primesearch.html",
      topic: "other",
      axisIndex: 1,
      axisLabel: "Primes",
      blurb: "Memorize three primes, then hunt them with your flashlight. Climb C→S ranks as the field grows!",
      howTo: "Study the primes, then move your mouse to light the dark number field and click each target. Find all three to rank up (C→B→A→S). Higher ranks use a bigger board and larger numbers. Open Mission targets any time you need a reminder.",
      rankMode: "single"
    },
    {
      id: "memorymatch",
      title: "Memory Match Math",
      path: "/games/memorymatch.html",
      topic: "other",
      axisIndex: 2,
      axisLabel: "Memory",
      blurb: "Match math problems with their answers as the colorful card board grows. Climb C→S ranks!",
      howTo: "Flip two cards at a time and pair each expression with its answer. Every match earns points and a celebration. Clear each board to grow from 8 to 24 cards; misses simply flip back with no penalty. Clear a 24-card board to rank up (C→B→A→S). Higher ranks mix in subtraction and multiplication with bigger numbers.",
      rankMode: "single"
    },
    {
      id: "feedthecats",
      title: "Feed the Cats",
      path: "/games/feedthecats.html",
      topic: "subtraction",
      axisIndex: 1,
      axisLabel: "Doubles",
      blurb: "Feed hungry cats by solving doubles subtraction facts with number cards. Climb C→S ranks!",
      howTo: "Three cats are waiting, each with a subtraction problem missing one number. Play a card from your hand into a blank — it's correct only when the card is exactly half the top number (like 14 − 7). Solve 12 problems to finish a round and clear 3 rounds to rank up (C→B→A→S). A and S ranks sneak in odd-numbered trick problems that no card can solve, and S adds a 120-second timer!",
      rankMode: "single"
    },
    {
      id: "bonus",
      title: "Dino Dash",
      path: "/games/bonus.html",
      topic: "bonus",
      blurb: "Daily bonus: an endless runner — jump the cacti, duck the birds, outlast the speed-up!",
      howTo: "Complete a saved session in each activity today to unlock this bonus, then come back tomorrow and do it again! In the run: Space/↑/tap to jump, ↓ or hold DUCK to slide under birds. The canyon keeps speeding up and your score is simply how long you survive.",
      bonus: true,
      rankMode: "none"
    }
  ];

  /**
   * How many non-bonus catalog games must have a saved session today to unlock the bonus.
   * Set to null to require every catalog math game (default = all of them).
   * Set to a number (e.g. 5) to lower the bar as the catalog grows.
   */
  const DAILY_BONUS_REQUIRED_COUNT = null;

  function getCatalogGames() {
    return GAMES.filter((g) => !g.bonus);
  }

  function getTopic(topicId) {
    return TOPICS.find((t) => t.id === topicId) || null;
  }

  function getRadarTopics() {
    return TOPICS.filter((t) => !t.bonus);
  }

  function getGamesForTopic(topicId) {
    return GAMES.filter((g) => g.topic === topicId);
  }

  function getDailyBonusRequiredCount() {
    const catalogSize = getCatalogGames().length;
    if (DAILY_BONUS_REQUIRED_COUNT == null) return catalogSize;
    return Math.max(1, Math.min(catalogSize, Math.floor(DAILY_BONUS_REQUIRED_COUNT)));
  }

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Server stores UpdatedAt as UTC. SQLite often round-trips DateTime as
   * Unspecified, so JSON may omit the "Z". Treat timezone-less stamps as UTC
   * so evening local play still counts as "today".
   */
  function parseServerTimestamp(updatedAt) {
    if (updatedAt == null || updatedAt === "") return null;
    if (updatedAt instanceof Date) {
      return Number.isNaN(updatedAt.getTime()) ? null : updatedAt;
    }
    const raw = String(updatedAt).trim();
    if (!raw) return null;
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const normalized = hasZone
      ? raw
      : `${raw.replace(" ", "T")}Z`;
    const when = new Date(normalized);
    return Number.isNaN(when.getTime()) ? null : when;
  }

  function isProgressFromLocalToday(updatedAt) {
    const when = parseServerTimestamp(updatedAt);
    if (!when) return false;
    return localDateKey(when) === localDateKey(new Date());
  }

  function getDailyBonusUnlockStatus(progressByGameId = {}) {
    const catalog = getCatalogGames();
    const required = getDailyBonusRequiredCount();
    const completedIds = catalog
      .filter((game) => {
        const progress = progressByGameId[game.id];
        if (!progress || !progress.exists) return false;
        return isProgressFromLocalToday(progress.updatedAt);
      })
      .map((game) => game.id);

    const completed = completedIds.length;
    const remainingGames = catalog.filter((game) => !completedIds.includes(game.id));
    const remaining = Math.max(0, required - completed);
    return {
      unlocked: completed >= required,
      completedIds,
      completed,
      remainingIds: remainingGames.map((g) => g.id),
      remainingTitles: remainingGames.map((g) => g.title),
      remaining,
      required,
      catalogIds: catalog.map((g) => g.id)
    };
  }

  const RANKS = ["C", "B", "A", "S"];
  const PER_NUMBER_MIN = 2;
  const PER_NUMBER_MAX = 10;
  const AXES_PER_TOPIC = 5;
  const EMPTY_AXIS_LABEL = "Coming soon";

  function parseProgressStats(progress) {
    if (!progress || progress.statsJson == null || progress.statsJson === "") return {};
    try {
      const stats = typeof progress.statsJson === "string"
        ? JSON.parse(progress.statsJson)
        : progress.statsJson;
      return stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
    } catch (_) {
      return {};
    }
  }

  function defaultPerNumberRanks() {
    const ranks = {};
    for (let n = PER_NUMBER_MIN; n <= PER_NUMBER_MAX; n++) ranks[String(n)] = "C";
    return ranks;
  }

  function parsePerNumberRanks(stats) {
    const base = defaultPerNumberRanks();
    if (!stats || typeof stats !== "object") return base;
    const src = stats.ranks && typeof stats.ranks === "object" && !Array.isArray(stats.ranks)
      ? stats.ranks
      : stats;
    for (let n = PER_NUMBER_MIN; n <= PER_NUMBER_MAX; n++) {
      const key = String(n);
      const r = src[key];
      if (RANKS.includes(r)) base[key] = r;
    }
    return base;
  }

  /**
   * Lobby rank view of saved progress. Never maps leftover numeric
   * difficultyLevel into B/A/S — missing letters start at C.
   */
  function getGameRankSummary(game, progress) {
    const rankMode = (game && game.rankMode) || "none";
    if (rankMode === "none" || !progress || progress.exists === false) {
      return { played: false, rankMode };
    }

    const stats = parseProgressStats(progress);
    if (rankMode === "perNumber") {
      return {
        played: true,
        rankMode,
        ranks: parsePerNumberRanks(stats)
      };
    }
    if (rankMode === "single") {
      return {
        played: true,
        rankMode,
        rank: RANKS.includes(stats.rank) ? stats.rank : "C"
      };
    }
    return { played: false, rankMode };
  }

  function rankLetterScore(letter) {
    const index = RANKS.indexOf(letter);
    if (index < 0) return 0;
    return (index + 1) / RANKS.length;
  }

  function getTopicAxisSlots(topicId) {
    const slots = Array.from({ length: AXES_PER_TOPIC }, (_, axisIndex) => ({
      axisIndex,
      game: null,
      label: EMPTY_AXIS_LABEL
    }));

    const games = getGamesForTopic(topicId).filter((game) => !game.bonus);
    let extras = 0;
    games.forEach((game) => {
      const axisIndex = Number(game.axisIndex);
      if (!Number.isInteger(axisIndex) || axisIndex < 0 || axisIndex >= AXES_PER_TOPIC) {
        extras += 1;
        console.warn(`MathArcade: ${game.id} has invalid axisIndex ${game.axisIndex} for topic ${topicId}`);
        return;
      }
      if (slots[axisIndex].game) {
        extras += 1;
        console.warn(`MathArcade: ${game.id} reuses axisIndex ${axisIndex} on topic ${topicId}; ignored`);
        return;
      }
      slots[axisIndex] = {
        axisIndex,
        game,
        label: game.axisLabel || game.title
      };
    });
    if (extras > 0) {
      console.warn(`MathArcade: topic ${topicId} has ${extras} game(s) that could not fill a spider axis`);
    }
    return slots;
  }

  function getGameAxisScore(game, progress) {
    if (!game) return 0;
    const summary = getGameRankSummary(game, progress);
    if (!summary.played) return 0;
    if (summary.rankMode === "single") return rankLetterScore(summary.rank);
    if (summary.rankMode === "perNumber") {
      const ranks = summary.ranks || {};
      let sum = 0;
      let count = 0;
      for (let n = PER_NUMBER_MIN; n <= PER_NUMBER_MAX; n++) {
        sum += rankLetterScore(ranks[String(n)]);
        count += 1;
      }
      return count ? sum / count : 0;
    }
    return 0;
  }

  function getGameAxisPercent(game, progress) {
    return Math.round(getGameAxisScore(game, progress) * 100);
  }

  function getTopicAxisScores(topicId, progressByGameId = {}) {
    const slots = getTopicAxisSlots(topicId);
    return {
      labels: slots.map((slot) => slot.label),
      scores: slots.map((slot) => (
        slot.game ? getGameAxisScore(slot.game, progressByGameId[slot.game.id]) : 0
      )),
      placeholders: slots.map((slot) => !slot.game)
    };
  }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getOrCreateDeviceToken() {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = uuid();
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  }

  function getPlayerName() {
    return localStorage.getItem(NAME_KEY) || "";
  }

  function setPlayerName(name) {
    localStorage.setItem(NAME_KEY, name.trim());
  }

  async function api(path, options = {}) {
    const { keepalive, ...rest } = options;
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(rest.headers || {}) },
      keepalive: keepalive === true,
      ...rest
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = await res.json();
        if (body && body.error) message = body.error;
      } catch (_) { /* ignore */ }
      throw new Error(message || `Request failed (${res.status})`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const PLAYER_MODAL_ID = "matharcade-player-modal";
  let playerNamePromptPromise = null;

  function injectPlayerNameModal() {
    if (document.getElementById(PLAYER_MODAL_ID)) return;

    const style = document.createElement("style");
    style.id = "matharcade-player-modal-styles";
    style.textContent = `
      .ma-player-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(11, 61, 74, 0.88);
        font-family: "Nunito", system-ui, sans-serif;
      }
      .ma-player-modal.hidden { display: none; }
      .ma-player-modal__card {
        width: min(22rem, 100%);
        padding: 1.5rem 1.35rem 1.35rem;
        border-radius: 18px;
        background: rgba(232, 247, 244, 0.96);
        box-shadow: 0 18px 40px rgba(8, 40, 48, 0.28);
        color: #102a32;
        text-align: center;
      }
      .ma-player-modal__card h2 {
        margin: 0;
        font-family: "Fredoka", "Nunito", system-ui, sans-serif;
        font-size: 1.65rem;
        line-height: 1.15;
        color: #0b3d4a;
      }
      .ma-player-modal__card p {
        margin: 0.55rem 0 0;
        font-size: 0.95rem;
        line-height: 1.45;
        color: #4a6b74;
      }
      .ma-player-modal__form {
        margin-top: 1.15rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }
      .ma-player-modal__form input {
        width: 100%;
        border: 2px solid rgba(18, 102, 120, 0.2);
        border-radius: 12px;
        padding: 0.65rem 0.85rem;
        font-size: 1rem;
        font-weight: 700;
        color: #102a32;
        background: #fff;
        outline: none;
      }
      .ma-player-modal__form input:focus {
        border-color: #ff6b4a;
      }
      .ma-player-modal__form button {
        border: none;
        border-radius: 999px;
        background: #ff6b4a;
        color: #fff;
        padding: 0.7rem 1rem;
        font-family: "Fredoka", "Nunito", system-ui, sans-serif;
        font-size: 1.05rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 0 #e25538;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .ma-player-modal__form button:hover {
        transform: translateY(-1px);
        box-shadow: 0 7px 0 #e25538;
      }
      .ma-player-modal__form button:active {
        transform: translateY(2px);
        box-shadow: 0 3px 0 #e25538;
      }
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = PLAYER_MODAL_ID;
    modal.className = "ma-player-modal hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "ma-player-modal-title");
    modal.innerHTML = `
      <div class="ma-player-modal__card">
        <h2 id="ma-player-modal-title">Welcome, explorer!</h2>
        <p>What should we call you? Your name appears on leaderboards.</p>
        <form class="ma-player-modal__form" id="ma-player-modal-form">
          <input id="ma-player-modal-input" name="name" maxlength="64" autocomplete="nickname" placeholder="Your name" />
          <button type="submit">Let's play</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function askPlayerName() {
    if (playerNamePromptPromise) return playerNamePromptPromise;

    playerNamePromptPromise = new Promise((resolve) => {
      injectPlayerNameModal();
      const modal = document.getElementById(PLAYER_MODAL_ID);
      const form = document.getElementById("ma-player-modal-form");
      const input = document.getElementById("ma-player-modal-input");

      input.value = "";
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");

      const finish = (name) => {
        form.removeEventListener("submit", onSubmit);
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        playerNamePromptPromise = null;
        resolve(name);
      };

      const onSubmit = (e) => {
        e.preventDefault();
        const name = (input.value.trim() || "Player").slice(0, 64);
        finish(name);
      };

      form.addEventListener("submit", onSubmit);
      queueMicrotask(() => input.focus({ preventScroll: true }));
    });

    return playerNamePromptPromise;
  }

  async function ensurePlayer(preferredName) {
    const deviceToken = getOrCreateDeviceToken();
    let name = (preferredName || getPlayerName() || "").trim();
    if (!name) {
      name = await askPlayerName();
    }
    if (name.length > 64) name = name.slice(0, 64);
    setPlayerName(name);
    return api("/api/players", {
      method: "POST",
      body: JSON.stringify({ name, deviceToken })
    });
  }

  async function submitScore(gameId, score, options = {}) {
    if (!options.keepalive) {
      await ensurePlayer();
    } else if (!getPlayerName()) {
      return null;
    }
    return api("/api/scores", {
      method: "POST",
      keepalive: options.keepalive === true,
      body: JSON.stringify({
        deviceToken: getOrCreateDeviceToken(),
        gameId,
        score: Math.max(0, Math.floor(score))
      })
    });
  }

  async function loadProgress(gameId) {
    await ensurePlayer();
    const token = encodeURIComponent(getOrCreateDeviceToken());
    return api(`/api/progress/${encodeURIComponent(gameId)}?deviceToken=${token}`);
  }

  async function loadAllProgress() {
    await ensurePlayer();
    const token = encodeURIComponent(getOrCreateDeviceToken());
    const rows = await api(`/api/progress?deviceToken=${token}`);
    const byGameId = {};
    (rows || []).forEach((row) => {
      if (!row || !row.gameId) return;
      byGameId[row.gameId] = {
        gameId: row.gameId,
        difficultyLevel: row.difficultyLevel,
        statsJson: row.statsJson,
        updatedAt: row.updatedAt,
        exists: row.exists !== false
      };
    });
    return byGameId;
  }

  async function saveProgress(gameId, difficultyLevel, stats, options = {}) {
    if (!options.keepalive) {
      await ensurePlayer();
    } else if (!getPlayerName()) {
      return null;
    }
    return api(`/api/progress/${encodeURIComponent(gameId)}`, {
      method: "PUT",
      keepalive: options.keepalive === true,
      body: JSON.stringify({
        deviceToken: getOrCreateDeviceToken(),
        difficultyLevel,
        statsJson: typeof stats === "string" ? stats : JSON.stringify(stats || {})
      })
    });
  }

  async function loadTopScores(gameId, limit = 5) {
    return api(`/api/scores/${encodeURIComponent(gameId)}?limit=${limit}`);
  }

  function formatActivityList(titles) {
    if (!titles || !titles.length) return "";
    if (titles.length === 1) return titles[0];
    if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
    return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
  }

  function formatScore(n) {
    return Number(n || 0).toLocaleString();
  }

  global.MathArcade = {
    GAMES,
    TOPICS,
    DAILY_BONUS_REQUIRED_COUNT,
    getCatalogGames,
    getTopic,
    getRadarTopics,
    getGamesForTopic,
    getDailyBonusRequiredCount,
    isProgressFromLocalToday,
    getDailyBonusUnlockStatus,
    formatActivityList,
    getOrCreateDeviceToken,
    getPlayerName,
    setPlayerName,
    api,
    ensurePlayer,
    submitScore,
    loadProgress,
    loadAllProgress,
    saveProgress,
    loadTopScores,
    formatScore,
    parseProgressStats,
    getGameRankSummary,
    rankLetterScore,
    getTopicAxisSlots,
    getGameAxisScore,
    getGameAxisPercent,
    getTopicAxisScores,
    AXES_PER_TOPIC,
    RANKS
  };
})(window);
