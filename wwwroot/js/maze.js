(function () {
  const GAME_ID = "maze";
  const problemEl = document.getElementById("problem");
  const branchesEl = document.getElementById("branches");
  const messageEl = document.getElementById("message");
  const scoreEl = document.getElementById("score");
  const roomEl = document.getElementById("room");
  const levelEl = document.getElementById("level");
  const pathLabel = document.getElementById("path-label");
  const mapEl = document.getElementById("map");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");

  let score = 0;
  let difficulty = 1;
  let roomIndex = 0;
  let totalRooms = 6;
  let rooms = [];
  let playing = false;

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

  function factorMax() {
    if (difficulty <= 2) return 5;
    if (difficulty <= 4) return 8;
    if (difficulty <= 6) return 10;
    return 12;
  }

  function buildMaze() {
    totalRooms = 5 + Math.min(4, Math.floor(difficulty / 2));
    rooms = [];
    const maxF = factorMax();
    for (let i = 0; i < totalRooms; i++) {
      const a = randInt(2, maxF);
      const b = randInt(2, maxF);
      const correct = a * b;
      const answers = new Set([correct]);
      while (answers.size < (difficulty >= 5 ? 3 : 2)) {
        const wrong = correct + randInt(-maxF, maxF) * randInt(1, 3);
        if (wrong > 0 && wrong !== correct) answers.add(wrong);
      }
      rooms.push({ a, b, correct, choices: shuffle([...answers]) });
    }
  }

  function renderMap() {
    mapEl.innerHTML = "";
    for (let i = 0; i < totalRooms; i++) {
      const dot = document.createElement("div");
      dot.className = "maze-dot";
      if (i < roomIndex) dot.classList.add("done");
      if (i === roomIndex) dot.classList.add("current");
      mapEl.appendChild(dot);
    }
  }

  function showRoom() {
    const room = rooms[roomIndex];
    problemEl.textContent = `${room.a} × ${room.b}`;
    pathLabel.textContent = `Room ${roomIndex + 1} of ${totalRooms}`;
    roomEl.textContent = `Room: ${roomIndex + 1}/${totalRooms}`;
    levelEl.textContent = `Level: ${difficulty}`;
    scoreEl.textContent = `Score: ${score}`;
    messageEl.textContent = "";
    messageEl.className = "message";
    renderMap();
    branchesEl.innerHTML = "";
    room.choices.forEach((n) => {
      const btn = document.createElement("button");
      btn.className = "branch";
      btn.textContent = n;
      btn.addEventListener("click", () => pick(n));
      branchesEl.appendChild(btn);
    });
  }

  async function pick(n) {
    if (!playing) return;
    const room = rooms[roomIndex];
    if (n === room.correct) {
      score += 15 + difficulty * 3;
      messageEl.textContent = "Door unlocked!";
      messageEl.className = "message good";
      roomIndex += 1;
      if (roomIndex >= totalRooms) {
        await finish(true);
        return;
      }
      setTimeout(showRoom, 400);
    } else {
      score = Math.max(0, score - 5);
      messageEl.textContent = `Wrong — ${room.a} × ${room.b} = ${room.correct}`;
      messageEl.className = "message bad";
      scoreEl.textContent = `Score: ${score}`;
      setTimeout(() => {
        if (playing) showRoom();
      }, 700);
    }
  }

  async function finish(won) {
    playing = false;
    if (won) {
      difficulty = Math.min(12, difficulty + 1);
      score += 50 + difficulty * 5;
    } else {
      difficulty = Math.max(1, difficulty - 1);
    }
    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, difficulty, { lastWon: won, rooms: totalRooms });
    } catch (err) {
      console.error(err);
    }
    overlay.innerHTML = `
      <h2>${won ? "You escaped!" : "Maze paused"}</h2>
      <p>Score: ${score} · Next difficulty: ${difficulty}</p>
      <button class="btn btn-primary" id="again-btn">Try again</button>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", startGame);
  }

  async function startGame() {
    await MathArcade.ensurePlayer();
    const progress = await MathArcade.loadProgress(GAME_ID);
    difficulty = progress.difficultyLevel || 1;
    score = 0;
    roomIndex = 0;
    playing = true;
    buildMaze();
    overlay.classList.add("hidden");
    showRoom();
  }

  startBtn.addEventListener("click", startGame);
})();
