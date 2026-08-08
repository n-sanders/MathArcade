/* MathArcade score admin — magic-word gated leaderboard tools */
(function () {
  const ADMIN_KEY_STORAGE = "matharcade_admin_key";
  const LOCAL_BEST_KEYS = {
    make10: ["matharcade_make10_best"],
    calendar: ["matharcade_calendar_best"]
  };

  const gatePanel = document.getElementById("gate-panel");
  const adminPanel = document.getElementById("admin-panel");
  const gateForm = document.getElementById("gate-form");
  const magicInput = document.getElementById("magic-word");
  const gateStatus = document.getElementById("gate-status");
  const adminStatus = document.getElementById("admin-status");
  const gameSelect = document.getElementById("game-select");
  const wipeBtn = document.getElementById("wipe-btn");
  const scoresBody = document.getElementById("scores-body");

  let adminKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";

  function showStatus(el, message, isError) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("error", !!isError);
  }

  function clearLocalBestKeys(gameId) {
    const keys = LOCAL_BEST_KEYS[gameId] || [];
    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) { /* ignore */ }
    });
  }

  async function adminApi(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
        ...(options.headers || {})
      }
    });

    let body = null;
    try {
      body = await res.json();
    } catch (_) {
      body = null;
    }

    if (!res.ok) {
      const message = (body && body.error) || res.statusText || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    return body;
  }

  function fillGames() {
    const games = (MathArcade.GAMES || []).slice().sort((a, b) => a.title.localeCompare(b.title));
    gameSelect.innerHTML = games
      .map((g) => `<option value="${escapeAttr(g.id)}">${escapeHtml(g.title)}</option>`)
      .join("");

    const preferred = games.find((g) => g.id === "bonus") || games[0];
    if (preferred) gameSelect.value = preferred.id;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function formatWhen(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  async function loadScores() {
    const gameId = gameSelect.value;
    if (!gameId) return;

    scoresBody.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;
    showStatus(adminStatus, "");

    try {
      const rows = await adminApi(`/api/admin/scores/${encodeURIComponent(gameId)}`);
      if (!rows || !rows.length) {
        scoresBody.innerHTML = `<tr><td class="empty" colspan="4">No scores for this game.</td></tr>`;
        return;
      }

      scoresBody.innerHTML = rows
        .map(
          (row) => `
          <tr data-score-id="${escapeAttr(row.id)}">
            <td>${escapeHtml(row.playerName)}</td>
            <td>${escapeHtml(MathArcade.formatScore(row.score))}</td>
            <td>${escapeHtml(formatWhen(row.achievedAt))}</td>
            <td>
              <button type="button" data-delete="${escapeAttr(row.id)}">Delete</button>
            </td>
          </tr>`
        )
        .join("");
    } catch (err) {
      if (err.status === 401) {
        lockAdmin(err.message || "Invalid magic word.");
        return;
      }
      scoresBody.innerHTML = `<tr><td class="empty" colspan="4">Could not load scores.</td></tr>`;
      showStatus(adminStatus, err.message || "Could not load scores.", true);
    }
  }

  function unlockAdmin(key) {
    adminKey = key;
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    gatePanel.hidden = true;
    adminPanel.hidden = false;
    showStatus(gateStatus, "");
    fillGames();
    loadScores();
  }

  function lockAdmin(message) {
    adminKey = "";
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    adminPanel.hidden = true;
    gatePanel.hidden = false;
    magicInput.value = "";
    showStatus(gateStatus, message || "", !!message);
    queueMicrotask(() => magicInput.focus({ preventScroll: true }));
  }

  gateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = magicInput.value;
    if (!key.trim()) {
      showStatus(gateStatus, "Enter the magic word.", true);
      return;
    }

    adminKey = key;
    try {
      // Probe with a cheap admin list call (any known game id).
      const probeId = (MathArcade.GAMES && MathArcade.GAMES[0] && MathArcade.GAMES[0].id) || "make10";
      await adminApi(`/api/admin/scores/${encodeURIComponent(probeId)}`);
      unlockAdmin(key);
    } catch (err) {
      adminKey = "";
      showStatus(gateStatus, err.message || "Could not unlock.", true);
    }
  });

  gameSelect.addEventListener("change", () => {
    loadScores();
  });

  wipeBtn.addEventListener("click", async () => {
    const gameId = gameSelect.value;
    const title =
      (MathArcade.GAMES || []).find((g) => g.id === gameId)?.title || gameId;
    if (!confirm(`Wipe the entire leaderboard for ${title}?\n\nThis also clears personal bestScore progress for that game.`)) {
      return;
    }

    wipeBtn.disabled = true;
    try {
      const result = await adminApi(`/api/admin/scores/${encodeURIComponent(gameId)}`, {
        method: "DELETE"
      });
      clearLocalBestKeys(gameId);
      showStatus(
        adminStatus,
        `Wiped ${result.deletedScores || 0} score(s); cleared ${result.clearedBests || 0} personal best(s).`
      );
      await loadScores();
    } catch (err) {
      if (err.status === 401) {
        lockAdmin(err.message || "Invalid magic word.");
        return;
      }
      showStatus(adminStatus, err.message || "Wipe failed.", true);
    } finally {
      wipeBtn.disabled = false;
    }
  });

  scoresBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-delete]");
    if (!btn) return;

    const scoreId = btn.getAttribute("data-delete");
    const gameId = gameSelect.value;
    const row = btn.closest("tr");
    const playerName = row?.children?.[0]?.textContent || "this player";
    if (!confirm(`Delete ${playerName}'s score for this game?`)) return;

    btn.disabled = true;
    try {
      await adminApi(`/api/admin/scores/${encodeURIComponent(gameId)}/${encodeURIComponent(scoreId)}`, {
        method: "DELETE"
      });
      clearLocalBestKeys(gameId);
      showStatus(adminStatus, `Deleted score for ${playerName}.`);
      await loadScores();
    } catch (err) {
      if (err.status === 401) {
        lockAdmin(err.message || "Invalid magic word.");
        return;
      }
      showStatus(adminStatus, err.message || "Delete failed.", true);
      btn.disabled = false;
    }
  });

  if (adminKey) {
    unlockAdmin(adminKey);
  } else {
    queueMicrotask(() => magicInput.focus({ preventScroll: true }));
  }
})();
