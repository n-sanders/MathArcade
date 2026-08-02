(function () {
  const GAME_ID = "primesearch";
  const stage = document.getElementById("stage");
  const previewEl = document.getElementById("preview-targets");
  const fieldEl = document.getElementById("field");
  const flashlight = document.getElementById("flashlight");
  const hint = document.getElementById("hint");
  const memLabel = document.getElementById("mem-label");
  const messageEl = document.getElementById("message");
  const scoreEl = document.getElementById("score");
  const foundEl = document.getElementById("found");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");

  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

  let score = 0;
  let difficulty = 1;
  let targets = [];
  let foundSet = new Set();
  let playing = false;
  let huntStart = 0;
  let memTimer = null;

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

  function isPrime(n) {
    return PRIMES.includes(n);
  }

  function maxNumber() {
    if (difficulty <= 2) return 30;
    if (difficulty <= 4) return 50;
    if (difficulty <= 6) return 70;
    return 97;
  }

  function gridSize() {
    if (difficulty <= 2) return { cols: 5, rows: 4 };
    if (difficulty <= 4) return { cols: 6, rows: 5 };
    if (difficulty <= 6) return { cols: 7, rows: 6 };
    return { cols: 8, rows: 7 };
  }

  function flashlightRadius() {
    return Math.max(55, 110 - difficulty * 6);
  }

  function pickTargets() {
    const pool = PRIMES.filter((p) => p <= maxNumber());
    return shuffle(pool).slice(0, 3);
  }

  function buildField() {
    const { cols, rows } = gridSize();
    stage.style.setProperty("--cols", cols);
    const total = cols * rows;
    const numbers = [...targets];
    while (numbers.length < total) {
      let n = randInt(2, maxNumber());
      if (!targets.includes(n) || Math.random() < 0.15) {
        // prefer composites as distractors
        if (!isPrime(n) || numbers.filter((x) => x === n).length === 0) {
          numbers.push(n);
        }
      }
    }
    // ensure all targets appear at least once
    shuffle(numbers);
    // place each target if missing
    targets.forEach((t, i) => {
      if (!numbers.includes(t)) numbers[i] = t;
    });
    // force unique positions for targets
    const used = new Set();
    targets.forEach((t) => {
      let idx = numbers.indexOf(t);
      if (idx === -1 || used.has(idx)) {
        idx = randInt(0, numbers.length - 1);
        while (used.has(idx)) idx = randInt(0, numbers.length - 1);
        numbers[idx] = t;
      }
      used.add(idx === -1 ? 0 : numbers.indexOf(t));
    });

    fieldEl.innerHTML = "";
    numbers.slice(0, total).forEach((n) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "num-cell";
      cell.textContent = n;
      cell.dataset.n = String(n);
      cell.addEventListener("click", () => onClick(cell, n));
      fieldEl.appendChild(cell);
    });
  }

  function onClick(cell, n) {
    if (!playing) return;
    if (targets.includes(n) && !foundSet.has(n)) {
      foundSet.add(n);
      // mark all cells with that number
      fieldEl.querySelectorAll(`.num-cell[data-n="${n}"]`).forEach((el) => el.classList.add("found"));
      const elapsed = (performance.now() - huntStart) / 1000;
      score += Math.max(20, 80 - Math.floor(elapsed * 2)) + difficulty * 5;
      updateHud();
      messageEl.textContent = `Found ${n}!`;
      messageEl.className = "message good";
      if (foundSet.size >= 3) {
        finish(true);
      }
    } else if (foundSet.has(n)) {
      messageEl.textContent = "Already found!";
      messageEl.className = "message";
    } else {
      score = Math.max(0, score - 5);
      updateHud();
      messageEl.textContent = `${n} is not one of your primes.`;
      messageEl.className = "message bad";
    }
  }

  function updateHud() {
    scoreEl.textContent = `Score: ${score}`;
    foundEl.textContent = `Found: ${foundSet.size}/3`;
    levelEl.textContent = `Level: ${difficulty}`;
  }

  function onMove(e) {
    const rect = stage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const r = flashlightRadius();
    flashlight.style.background = `radial-gradient(circle ${r}px at ${x}% ${y}%, transparent 0%, transparent 35%, rgba(0,0,0,0.82) 55%, rgba(0,0,0,0.95) 100%)`;
  }

  async function finish(won) {
    playing = false;
    stage.classList.add("preview");
    stage.classList.remove("hunting");
    hint.classList.add("hidden");
    if (won) {
      difficulty = Math.min(12, difficulty + 1);
      score += 40;
    } else if (difficulty > 1) {
      difficulty -= 1;
    }
    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, difficulty, { targets, found: [...foundSet] });
    } catch (err) {
      console.error(err);
    }
    overlay.innerHTML = `
      <h2>${won ? "All primes found!" : "Hunt over"}</h2>
      <p>Score: ${score} · Difficulty: ${difficulty}</p>
      <button class="btn btn-primary" id="again-btn">Hunt again</button>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", startGame);
  }

  function beginHunt() {
    memLabel.style.display = "none";
    previewEl.style.display = "none";
    stage.classList.remove("preview");
    hint.classList.remove("hidden");
    hint.textContent = "Find the 3 primes";
    buildField();
    huntStart = performance.now();
    playing = true;
    messageEl.textContent = "Scan the darkness…";
    messageEl.className = "message";
  }

  async function startGame() {
    await MathArcade.ensurePlayer();
    const progress = await MathArcade.loadProgress(GAME_ID);
    difficulty = progress.difficultyLevel || 1;
    score = 0;
    foundSet = new Set();
    targets = pickTargets();
    playing = false;
    clearTimeout(memTimer);
    overlay.classList.add("hidden");
    stage.classList.add("preview");
    memLabel.style.display = "";
    previewEl.style.display = "flex";
    previewEl.innerHTML = targets.map((t) => `<div class="target-chip">${t}</div>`).join("");
    fieldEl.innerHTML = "";
    hint.classList.add("hidden");
    updateHud();
    messageEl.textContent = "Memorize… lights out soon!";
    messageEl.className = "message";
    const memMs = Math.max(1800, 3500 - difficulty * 150);
    memTimer = setTimeout(beginHunt, memMs);
  }

  stage.addEventListener("pointermove", onMove);
  startBtn.addEventListener("click", startGame);
})();
