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
      id: "primesearch",
      title: "Prime Search",
      path: "/games/primesearch.html",
      blurb: "Memorize three primes, then hunt them with your flashlight.",
      howTo: "Study the primes, then move your mouse to light the dark number field and click each target."
    },
    {
      id: "memorymatch",
      title: "Memory Match Math",
      path: "/games/memorymatch.html",
      blurb: "Match math problems with their answers in a classic memory game.",
      howTo: "Flip two cards at a time. Pair each expression with its correct answer. Fewer moves means a higher score."
    }
  ];

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
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
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

  async function ensurePlayer(preferredName) {
    const deviceToken = getOrCreateDeviceToken();
    let name = (preferredName || getPlayerName() || "").trim();
    if (!name) {
      name = (prompt("What should we call you, explorer?", "Player") || "Player").trim() || "Player";
    }
    if (name.length > 64) name = name.slice(0, 64);
    setPlayerName(name);
    return api("/api/players", {
      method: "POST",
      body: JSON.stringify({ name, deviceToken })
    });
  }

  async function submitScore(gameId, score) {
    await ensurePlayer();
    return api("/api/scores", {
      method: "POST",
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
    getOrCreateDeviceToken,
    getPlayerName,
    setPlayerName,
    api,
    ensurePlayer,
    submitScore,
    loadProgress,
    saveProgress,
    loadTopScores,
    formatScore
  };
})(window);
