/* MathArcade shared client helpers */
(function (global) {
  const TOKEN_KEY = "matharcade_device_token";
  const NAME_KEY = "matharcade_player_name";

  const GAMES = [
    {
      id: "make10",
      title: "Make 10",
      path: "/games/make10.html",
      blurb: "Drag a live electric wire to the number that completes 10!",
      howTo: "A glowing wire is anchored to the base number. Guide its free end to the number that adds with the base to make 10, then click or release to connect. Correct circuits spark and boost your streak; wrong ones fizzle."
    },
    {
      id: "maze",
      title: "Galaxy Maze",
      path: "/games/maze.html",
      blurb: "Pilot a starship from Sol and follow a signal of alien life across a star maze.",
      howTo: "Each hyperspace jump needs a multiplication answer. Pick the neighboring star showing the correct product to launch, scan each system for life, and find the living world 10-15 jumps out."
    },
    {
      id: "skipcounting",
      title: "Lava Leap",
      path: "/games/skipcounting.html",
      blurb: "Skip-count platform to platform and outrun the rising lava!",
      howTo: "Pick a number 2–10, then tap the platform showing the next skip-count number to leap there. Each number has its own rank (C→S) that speeds up the lava. Reach ×12 to escape!"
    },
    {
      id: "avalanche",
      title: "Avalanche Run",
      path: "/games/avalanche.html",
      blurb: "Skip-count down the mountain and outrun the avalanche!",
      howTo: "Pick a number 2–10, then tap the platform showing the next countdown number to hop down from ×12 all the way to 0. Each number has its own rank (C→S) that speeds up the avalanche. Reach 0 to escape!"
    },
    {
      id: "primesearch",
      title: "Prime Search",
      path: "/games/primesearch.html",
      blurb: "Memorize three primes, then hunt them with your flashlight.",
      howTo: "Study the primes, then move your mouse to light the dark number field and click each target."
    },
    {
      id: "calendar",
      title: "Calendar Scramble",
      path: "/games/calendar.html",
      blurb: "The months got scattered! Drag them back into calendar order before the clock drains your points.",
      howTo: "The year stacks up on the left, but some months have been flung across the board. Drag each missing month to its ordinal slot — 1st through 12th. Fast placements earn big points; a wrong slot costs 5 and bounces the month back. Two rounds per stage, with more months missing each stage, all the way up to a fully scrambled year!"
    },
    {
      id: "memorymatch",
      title: "Memory Match Math",
      path: "/games/memorymatch.html",
      blurb: "Match math problems with their answers as the colorful card board grows.",
      howTo: "Flip two cards at a time and pair each expression with its answer. Every match earns points and a celebration. Clear each board to grow from 8 to 24 cards; misses simply flip back with no penalty."
    },
    {
      id: "bonus",
      title: "Daily Bonus",
      path: "/games/bonus.html",
      blurb: "A surprise reward for finishing today's math activities.",
      howTo: "Complete a saved session in each activity today to unlock this bonus. Come back tomorrow and do it again!",
      bonus: true
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

  function isProgressFromLocalToday(updatedAt) {
    if (!updatedAt) return false;
    const when = new Date(updatedAt);
    if (Number.isNaN(when.getTime())) return false;
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
    const remaining = Math.max(0, required - completed);
    return {
      unlocked: completed >= required,
      completedIds,
      completed,
      remaining,
      required,
      catalogIds: catalog.map((g) => g.id)
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

  async function saveProgress(gameId, difficultyLevel, stats) {
    await ensurePlayer();
    return api(`/api/progress/${encodeURIComponent(gameId)}`, {
      method: "PUT",
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

  function formatScore(n) {
    return Number(n || 0).toLocaleString();
  }

  global.MathArcade = {
    GAMES,
    DAILY_BONUS_REQUIRED_COUNT,
    getCatalogGames,
    getDailyBonusRequiredCount,
    isProgressFromLocalToday,
    getDailyBonusUnlockStatus,
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
    formatScore
  };
})(window);
