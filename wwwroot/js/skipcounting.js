(function () {
  const GAME_ID = "skipcounting";
  const canvas = document.getElementById("race-canvas");
  const ctx = canvas.getContext("2d");
  const promptEl = document.getElementById("prompt");
  const padsEl = document.getElementById("pads");
  const scoreEl = document.getElementById("score");
  const heightEl = document.getElementById("height");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");

  let score = 0;
  let difficulty = 1;
  let playing = false;
  let skipBy = 2;
  let current = 0;
  let next = 2;
  let playerY = 300;
  let lavaY = 400;
  let worldOffset = 0;
  let platforms = [];
  let raf = null;
  let lastTs = 0;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function skipOptions() {
    if (difficulty <= 2) return [2, 5];
    if (difficulty <= 4) return [2, 5, 10];
    if (difficulty <= 6) return [3, 4, 5, 10];
    return [3, 4, 6, 7, 9];
  }

  function lavaSpeed() {
    return 28 + difficulty * 8;
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.floor(rect.width);
    canvas.height = 420;
  }

  function spawnPlatforms() {
    platforms = [];
    for (let i = 0; i < 8; i++) {
      platforms.push({
        x: 40 + (i % 3) * ((canvas.width - 120) / 2),
        y: canvas.height - 80 - i * 70,
        w: 90,
        h: 14
      });
    }
  }

  function showPads() {
    const options = new Set([next]);
    while (options.size < 3) {
      const delta = randInt(1, 3) * skipBy * (Math.random() < 0.5 ? 1 : -1);
      const wrong = next + delta;
      if (wrong > 0 && wrong !== next) options.add(wrong);
    }
    padsEl.innerHTML = "";
    shuffle([...options]).forEach((n) => {
      const btn = document.createElement("button");
      btn.className = "pad";
      btn.textContent = n;
      btn.addEventListener("click", () => jump(n));
      padsEl.appendChild(btn);
    });
    promptEl.textContent = `Counting by ${skipBy}s — after ${current}, next?`;
  }

  function jump(n) {
    if (!playing) return;
    if (n === next) {
      current = next;
      next = current + skipBy;
      playerY -= 70;
      worldOffset += 40;
      score += 10 + difficulty * 2;
      platforms.forEach((p) => { p.y += 55; });
      platforms.push({
        x: randInt(30, Math.max(40, canvas.width - 120)),
        y: Math.min(...platforms.map((p) => p.y)) - 70,
        w: 90,
        h: 14
      });
      platforms = platforms.filter((p) => p.y < canvas.height + 40).slice(-10);
      lavaY += 25;
      updateHud();
      showPads();
    } else {
      lavaY -= 35;
      score = Math.max(0, score - 3);
      updateHud();
    }
  }

  function updateHud() {
    scoreEl.textContent = `Score: ${score}`;
    heightEl.textContent = `Height: ${Math.max(0, Math.floor(worldOffset))}`;
    levelEl.textContent = `Level: ${difficulty}`;
  }

  function draw(ts) {
    if (!playing) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;

    lavaY -= lavaSpeed() * dt;
    playerY += 12 * dt;

    const groundLine = canvas.height - 40;
    if (playerY > groundLine) playerY = groundLine;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // sky already via CSS; draw hills
    ctx.fillStyle = "#5fae6e";
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height);

    platforms.forEach((p) => {
      ctx.fillStyle = "#c47a3a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#8f5a2a";
      ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
    });

    // player
    const px = canvas.width / 2 - 16;
    ctx.fillStyle = "#ff6b4a";
    ctx.fillRect(px, playerY - 36, 32, 36);
    ctx.fillStyle = "#102a32";
    ctx.fillRect(px + 8, playerY - 26, 5, 5);
    ctx.fillRect(px + 19, playerY - 26, 5, 5);

    // lava
    const lavaTop = canvas.height - Math.max(0, lavaY);
    const grad = ctx.createLinearGradient(0, lavaTop, 0, canvas.height);
    grad.addColorStop(0, "#ff9f1c");
    grad.addColorStop(0.4, "#e71d36");
    grad.addColorStop(1, "#8b0000");
    ctx.fillStyle = grad;
    ctx.fillRect(0, lavaTop, canvas.width, canvas.height - lavaTop);

    // lava surface waves
    ctx.fillStyle = "rgba(255, 209, 102, 0.55)";
    for (let i = 0; i < canvas.width; i += 24) {
      const wobble = Math.sin(ts / 180 + i / 30) * 4;
      ctx.beginPath();
      ctx.ellipse(i + 12, lavaTop + wobble, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (playerY + 4 >= lavaTop) {
      endGame(false);
      return;
    }

    if (worldOffset > 400 + difficulty * 80) {
      endGame(true);
      return;
    }

    raf = requestAnimationFrame(draw);
  }

  async function endGame(won) {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    if (won) {
      score += 100;
      difficulty = Math.min(12, difficulty + 1);
    } else {
      difficulty = Math.max(1, difficulty - (score < 30 ? 0 : 0));
      if (score < 40) difficulty = Math.max(1, difficulty);
      else difficulty = Math.min(12, Math.max(1, difficulty));
    }
    // bump difficulty if did well
    if (score >= 120) difficulty = Math.min(12, difficulty + 1);
    else if (score < 40 && difficulty > 1) difficulty -= 1;

    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, difficulty, { skipBy, lastScore: score, won });
    } catch (err) {
      console.error(err);
    }

    overlay.innerHTML = `
      <h2>${won ? "You outran the lava!" : "Lava got you!"}</h2>
      <p>Score: ${score} · Difficulty: ${difficulty}</p>
      <button class="btn btn-primary" id="again-btn">Race again</button>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", startGame);
  }

  async function startGame() {
    await MathArcade.ensurePlayer();
    const progress = await MathArcade.loadProgress(GAME_ID);
    difficulty = progress.difficultyLevel || 1;
    const opts = skipOptions();
    skipBy = opts[randInt(0, opts.length - 1)];
    current = 0;
    next = skipBy;
    score = 0;
    worldOffset = 0;
    playing = true;
    resize();
    spawnPlatforms();
    playerY = canvas.height - 100;
    lavaY = 90;
    overlay.classList.add("hidden");
    updateHud();
    showPads();
    lastTs = performance.now();
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => {
    if (playing) resize();
  });

  startBtn.addEventListener("click", startGame);
})();
