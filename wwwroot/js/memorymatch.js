(function () {
  const GAME_ID = "memorymatch";
  const boardEl = document.getElementById("board");
  const familyEl = document.getElementById("family");
  const messageEl = document.getElementById("message");
  const scoreEl = document.getElementById("score");
  const movesEl = document.getElementById("moves");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");

  let score = 0;
  let difficulty = 1;
  let moves = 0;
  let cards = [];
  let flipped = [];
  let matched = 0;
  let lock = false;
  let playing = false;
  let pairCount = 4;
  let family = "add";
  let startedAt = 0;

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

  function chooseFamily() {
    if (difficulty <= 2) return "add";
    if (difficulty <= 4) return Math.random() < 0.5 ? "add" : "sub";
    if (difficulty <= 6) return Math.random() < 0.5 ? "mul" : "add";
    return Math.random() < 0.6 ? "mul" : "sub";
  }

  function familyLabel(f) {
    return { add: "Addition", sub: "Subtraction", mul: "Multiplication" }[f] || f;
  }

  function makePairs() {
    pairCount = difficulty <= 2 ? 4 : difficulty <= 5 ? 6 : 8;
    family = chooseFamily();
    familyEl.textContent = `Fact family: ${familyLabel(family)}`;
    const pairs = [];
    const used = new Set();
    while (pairs.length < pairCount) {
      let expr, answer, key;
      if (family === "add") {
        const a = randInt(1, 9 + difficulty);
        const b = randInt(1, 9 + difficulty);
        expr = `${a} + ${b}`;
        answer = String(a + b);
        key = `a:${a}+${b}`;
      } else if (family === "sub") {
        const a = randInt(5, 12 + difficulty);
        const b = randInt(1, a);
        expr = `${a} − ${b}`;
        answer = String(a - b);
        key = `s:${a}-${b}`;
      } else {
        const maxF = Math.min(12, 4 + difficulty);
        const a = randInt(2, maxF);
        const b = randInt(2, maxF);
        expr = `${a} × ${b}`;
        answer = String(a * b);
        key = `m:${a}x${b}`;
      }
      if (used.has(key) || used.has(answer)) continue;
      used.add(key);
      used.add(answer);
      const id = `p${pairs.length}`;
      pairs.push(
        { id, text: expr, pairId: id, kind: "expr" },
        { id: id + "a", text: answer, pairId: id, kind: "ans" }
      );
    }
    return shuffle(pairs);
  }

  function colsFor() {
    return pairCount <= 4 ? 4 : pairCount <= 6 ? 4 : 4;
  }

  function render() {
    boardEl.style.setProperty("--cols", String(colsFor()));
    boardEl.innerHTML = "";
    cards.forEach((card, index) => {
      const btn = document.createElement("button");
      btn.className = "card";
      btn.type = "button";
      btn.dataset.index = String(index);
      btn.innerHTML = `
        <div class="card-inner">
          <div class="face back">?</div>
          <div class="face front">${card.text}</div>
        </div>`;
      btn.addEventListener("click", () => flip(index));
      boardEl.appendChild(btn);
    });
  }

  function updateHud() {
    scoreEl.textContent = `Score: ${score}`;
    movesEl.textContent = `Moves: ${moves}`;
    levelEl.textContent = `Level: ${difficulty}`;
  }

  function flip(index) {
    if (!playing || lock) return;
    const card = cards[index];
    const el = boardEl.children[index];
    if (!el || el.classList.contains("flipped") || el.classList.contains("matched")) return;
    if (flipped.length >= 2) return;

    el.classList.add("flipped");
    flipped.push({ index, card });

    if (flipped.length === 2) {
      moves += 1;
      updateHud();
      const [a, b] = flipped;
      if (a.card.pairId === b.card.pairId && a.index !== b.index) {
        lock = true;
        setTimeout(() => {
          boardEl.children[a.index].classList.add("matched");
          boardEl.children[b.index].classList.add("matched");
          matched += 1;
          score += 25 + difficulty * 3;
          flipped = [];
          lock = false;
          updateHud();
          messageEl.textContent = "Match!";
          messageEl.className = "message good";
          if (matched >= pairCount) finish();
        }, 350);
      } else {
        lock = true;
        setTimeout(() => {
          boardEl.children[a.index].classList.remove("flipped");
          boardEl.children[b.index].classList.remove("flipped");
          flipped = [];
          lock = false;
          score = Math.max(0, score - 2);
          updateHud();
          messageEl.textContent = "Try again";
          messageEl.className = "message bad";
        }, 700);
      }
    }
  }

  async function finish() {
    playing = false;
    const seconds = Math.max(1, Math.floor((performance.now() - startedAt) / 1000));
    const moveBonus = Math.max(0, pairCount * 3 - moves) * 8;
    const timeBonus = Math.max(0, 120 - seconds) * 2;
    score += moveBonus + timeBonus;

    if (moves <= pairCount + 2) difficulty = Math.min(12, difficulty + 1);
    else if (moves > pairCount * 3 && difficulty > 1) difficulty -= 1;

    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, difficulty, { family, pairCount, moves, seconds });
    } catch (err) {
      console.error(err);
    }

    overlay.innerHTML = `
      <h2>Board cleared!</h2>
      <p>Score: ${score} · Moves: ${moves} · Time: ${seconds}s</p>
      <button class="btn btn-primary" id="again-btn">New deal</button>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", startGame);
  }

  async function startGame() {
    await MathArcade.ensurePlayer();
    const progress = await MathArcade.loadProgress(GAME_ID);
    difficulty = progress.difficultyLevel || 1;
    score = 0;
    moves = 0;
    matched = 0;
    flipped = [];
    lock = false;
    playing = true;
    startedAt = performance.now();
    cards = makePairs();
    overlay.classList.add("hidden");
    messageEl.textContent = "";
    updateHud();
    render();
  }

  startBtn.addEventListener("click", startGame);
})();
