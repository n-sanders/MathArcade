(function () {
  const GAME_ID = "make10";
  const promptEl = document.getElementById("prompt");
  const choicesEl = document.getElementById("choices");
  const messageEl = document.getElementById("message");
  const scoreEl = document.getElementById("score");
  const streakEl = document.getElementById("streak");
  const levelEl = document.getElementById("level");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start-btn");
  const endBtn = document.getElementById("end-btn");

  let score = 0;
  let streak = 0;
  let difficulty = 1;
  let current = 0;
  let playing = false;
  let correctCount = 0;
  let timerId = null;
  let timeLeft = 0;

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

  function updateHud() {
    scoreEl.textContent = `Score: ${score}`;
    streakEl.textContent = `Streak: ${streak}`;
    levelEl.textContent = `Level: ${difficulty}`;
  }

  function choiceCount() {
    return difficulty >= 4 ? 6 : 4;
  }

  function nextRound() {
    if (!playing) return;
    current = randInt(0, 10);
    const answer = 10 - current;
    const options = new Set([answer]);
    const spread = Math.min(5, 2 + Math.floor(difficulty / 2));
    while (options.size < choiceCount()) {
      const n = randInt(Math.max(0, answer - spread), Math.min(10, answer + spread));
      if (n !== answer || options.size === 0) options.add(n);
      if (options.size < choiceCount()) options.add(randInt(0, 10));
    }
    const list = shuffle([...options]);
    promptEl.textContent = current;
    choicesEl.innerHTML = "";
    list.forEach((n) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.textContent = n;
      btn.addEventListener("click", () => onPick(n));
      choicesEl.appendChild(btn);
    });
    messageEl.textContent = "";
    messageEl.className = "message";

    if (difficulty >= 3) {
      clearTimeout(timerId);
      timeLeft = Math.max(2.5, 6 - difficulty * 0.4);
      timerId = setTimeout(() => {
        if (!playing) return;
        streak = 0;
        messageEl.textContent = "Too slow!";
        messageEl.className = "message bad";
        updateHud();
        setTimeout(nextRound, 500);
      }, timeLeft * 1000);
    }
  }

  function onPick(n) {
    if (!playing) return;
    clearTimeout(timerId);
    const answer = 10 - current;
    if (n === answer) {
      streak += 1;
      correctCount += 1;
      const bonus = Math.min(5, streak);
      score += 10 + bonus * 2 + difficulty;
      messageEl.textContent = streak > 2 ? `Nice! Streak ×${streak}` : "Correct!";
      messageEl.className = "message good";
      if (correctCount > 0 && correctCount % 5 === 0) {
        difficulty = Math.min(10, difficulty + 1);
      }
    } else {
      streak = 0;
      score = Math.max(0, score - 2);
      messageEl.textContent = `Oops — ${current} + ${answer} = 10`;
      messageEl.className = "message bad";
      if (difficulty > 1 && correctCount % 3 === 0) {
        difficulty = Math.max(1, difficulty - 1);
      }
    }
    updateHud();
    setTimeout(nextRound, 450);
  }

  async function startGame() {
    await MathArcade.ensurePlayer();
    const progress = await MathArcade.loadProgress(GAME_ID);
    difficulty = progress.difficultyLevel || 1;
    score = 0;
    streak = 0;
    correctCount = 0;
    playing = true;
    overlay.classList.add("hidden");
    updateHud();
    nextRound();
  }

  async function endRound() {
    if (!playing) return;
    playing = false;
    clearTimeout(timerId);
    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, difficulty, { correctCount, lastScore: score });
    } catch (err) {
      console.error(err);
    }
    overlay.innerHTML = `
      <h2>Round over!</h2>
      <p>Score: ${score} · Level reached: ${difficulty}</p>
      <button class="btn btn-primary" id="again-btn">Play again</button>`;
    overlay.classList.remove("hidden");
    document.getElementById("again-btn").addEventListener("click", startGame);
  }

  startBtn.addEventListener("click", startGame);
  endBtn.addEventListener("click", endRound);
})();
