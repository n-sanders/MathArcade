(function () {
  "use strict";

  const GAME_ID = "primesearch";
  const PRIME_POOL_KEY = "matharcade_primesearch_prime_pool";
  const MUTE_KEY = "matharcade_primesearch_muted";
  const TARGET_PRIMES = Object.freeze([2, 3, 5, 7, 11, 13, 17, 19, 23]);
  const VALID_POOL_LENGTHS = new Set([0, 3, 6]);
  const VICTORY_REVEAL_MS = 1650;

  // DOM
  const stage = document.getElementById("stage");
  const fieldEl = document.getElementById("field");
  const memoryCard = document.getElementById("memory-card");
  const memoryTargets = document.getElementById("memory-targets");
  const reminder = document.getElementById("target-reminder");
  const reminderToggle = document.getElementById("reminder-toggle");
  const reminderPanel = document.getElementById("reminder-panel");
  const reminderTargets = document.getElementById("reminder-targets");
  const reminderSummary = document.getElementById("reminder-summary");
  const effectsEl = document.getElementById("effects");
  const successFlash = document.getElementById("success-flash");
  const messageEl = document.getElementById("message");
  const scoreEl = document.getElementById("score");
  const foundEl = document.getElementById("found");
  const levelEl = document.getElementById("level");
  const scoreChip = document.getElementById("score-chip");
  const foundChip = document.getElementById("found-chip");
  const levelChip = document.getElementById("level-chip");
  const soundToggle = document.getElementById("sound-toggle");
  const soundIcon = document.getElementById("sound-icon");
  const soundLabel = document.getElementById("sound-label");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const overlayStats = document.getElementById("overlay-stats");
  const startBtn = document.getElementById("start-btn");

  // Game state
  let phase = "idle";
  let score = 0;
  let difficulty = 1;
  let targets = [];
  let foundSet = new Set();
  let playing = false;
  let huntStart = 0;
  let roundId = 0;
  let sessionPrimePool = null;
  let pendingSave = Promise.resolve();

  // Timers and animation handles
  let memoryTimer = 0;
  let revealTimer = 0;
  let shakeTimer = 0;
  let flashTimer = 0;
  let pointerFrame = 0;
  let queuedPointer = null;

  // Audio state
  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = 0;
  let musicRunning = false;
  let nextMusicTime = 0;
  let musicStep = 0;
  let musicSources = new Set();
  let muted = readStorage(MUTE_KEY) === "true";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function shuffle(values) {
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn(`Prime Search could not read ${key}.`, error);
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Prime Search could not save ${key}.`, error);
    }
  }

  function isPrime(value) {
    if (!Number.isInteger(value) || value < 2) return false;
    if (value === 2) return true;
    if (value % 2 === 0) return false;
    for (let factor = 3; factor * factor <= value; factor += 2) {
      if (value % factor === 0) return false;
    }
    return true;
  }

  function readPrimePool() {
    const raw = readStorage(PRIME_POOL_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;

      const unique = [...new Set(parsed)];
      const isValid = unique.length === parsed.length
        && VALID_POOL_LENGTHS.has(unique.length)
        && unique.every((value) => TARGET_PRIMES.includes(value));

      return isValid ? unique : null;
    } catch (error) {
      console.warn("Prime Search found an invalid saved prime pool.", error);
      return null;
    }
  }

  function drawTargets() {
    let pool = sessionPrimePool ? [...sessionPrimePool] : readPrimePool();

    if (!pool || pool.length < 3) {
      pool = shuffle([...TARGET_PRIMES]);
    } else {
      shuffle(pool);
    }

    const selected = pool.splice(0, 3);
    sessionPrimePool = [...pool];
    writeStorage(PRIME_POOL_KEY, JSON.stringify(pool));
    return selected;
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

  function compositePool(limit) {
    const values = [];
    for (let value = 4; value <= limit; value += 1) {
      if (!isPrime(value)) values.push(value);
    }
    return values;
  }

  function buildField() {
    const { cols, rows } = gridSize();
    const total = cols * rows;
    const distractorCount = total - targets.length;
    const composites = shuffle(compositePool(maxNumber()));

    if (composites.length < distractorCount) {
      throw new Error("Prime Search does not have enough unique composite distractors.");
    }

    const numbers = shuffle([
      ...targets,
      ...composites.slice(0, distractorCount)
    ]);

    stage.style.setProperty("--cols", String(cols));
    stage.style.setProperty("--rows", String(rows));
    fieldEl.replaceChildren();

    numbers.forEach((value) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "num-cell";
      cell.textContent = String(value);
      cell.dataset.n = String(value);
      cell.setAttribute("aria-label", `Number ${value}`);
      cell.addEventListener("click", () => chooseNumber(cell, value));
      fieldEl.appendChild(cell);
    });
  }

  function createTargetChip(value) {
    const chip = document.createElement("div");
    chip.className = "target-chip";
    chip.dataset.target = String(value);
    chip.setAttribute("role", "listitem");
    chip.setAttribute("aria-label", `Prime ${value}, not found`);

    const number = document.createElement("span");
    number.textContent = String(value);

    const check = document.createElement("span");
    check.className = "target-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";

    chip.append(number, check);
    return chip;
  }

  function renderTargetLists() {
    memoryTargets.replaceChildren(...targets.map(createTargetChip));
    reminderTargets.replaceChildren(...targets.map(createTargetChip));
    syncTargetDisplays();
  }

  function syncTargetDisplays(justFound) {
    document.querySelectorAll(".target-chip[data-target]").forEach((chip) => {
      const value = Number(chip.dataset.target);
      const found = foundSet.has(value);
      chip.classList.toggle("found", found);
      chip.setAttribute("aria-label", `Prime ${value}, ${found ? "found" : "not found"}`);

      if (value === justFound) {
        chip.classList.remove("just-found");
        void chip.offsetWidth;
        chip.classList.add("just-found");
        window.setTimeout(() => chip.classList.remove("just-found"), 700);
      }
    });

    reminderSummary.textContent = `${foundSet.size} / ${targets.length || 3} found`;
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    foundEl.textContent = `${foundSet.size}/3`;
    levelEl.textContent = String(difficulty);
    scoreChip.setAttribute("aria-label", `Score ${score}`);
    foundChip.setAttribute("aria-label", `${foundSet.size} of 3 primes found`);
    levelChip.setAttribute("aria-label", `Level ${difficulty}`);
  }

  function setMessage(text, tone) {
    messageEl.textContent = text;
    messageEl.className = `message${tone ? ` ${tone}` : ""}`;
  }

  function setReminderOpen(open) {
    reminder.classList.toggle("open", open);
    reminderToggle.setAttribute("aria-expanded", String(open));
    reminderPanel.setAttribute("aria-hidden", String(!open));
  }

  function clearRoundTimers() {
    window.clearTimeout(memoryTimer);
    window.clearTimeout(revealTimer);
    window.clearTimeout(shakeTimer);
    window.clearTimeout(flashTimer);
    memoryTimer = 0;
    revealTimer = 0;
    shakeTimer = 0;
    flashTimer = 0;
  }

  function resetStage() {
    clearRoundTimers();
    playing = false;
    memoryCard.hidden = true;
    memoryCard.classList.remove("counting");
    reminder.hidden = true;
    setReminderOpen(false);
    effectsEl.replaceChildren();
    fieldEl.replaceChildren();
    successFlash.classList.remove("pulse");
    stage.classList.remove("idle", "memorizing", "hunting", "lights-on", "shake");
    stage.classList.add("idle");
    setBeamPosition(50, 50);
  }

  function chooseNumber(cell, value) {
    if (!playing || phase !== "hunting") return;

    if (targets.includes(value) && !foundSet.has(value)) {
      foundSet.add(value);
      cell.disabled = true;
      cell.classList.add("found", "hit");

      const elapsedSeconds = (performance.now() - huntStart) / 1000;
      const points = Math.max(20, 80 - Math.floor(elapsedSeconds * 2)) + difficulty * 5;
      score += points;

      updateHud();
      syncTargetDisplays(value);
      celebrateCorrectChoice(cell, points);
      playSuccess(foundSet.size);

      if (foundSet.size === targets.length) {
        playing = false;
        phase = "celebrating";
        setMessage(`Prime ${value} found — power up the board!`, "good");
        stopSearchMusic(0.28);
        const activeRound = roundId;
        revealTimer = window.setTimeout(() => revealBoard(activeRound), 360);
      } else {
        const left = targets.length - foundSet.size;
        setMessage(`Prime ${value} found! ${left} target${left === 1 ? "" : "s"} left.`, "good");
      }
      return;
    }

    score = Math.max(0, score - 5);
    updateHud();
    setMessage(`${value} is not on your target list. Keep sweeping.`, "bad");
    restartClass(cell, "miss", 420);
    playMiss();
  }

  function restartClass(element, className, duration) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), duration);
  }

  function celebrateCorrectChoice(cell, points) {
    window.clearTimeout(shakeTimer);
    stage.classList.remove("shake");
    void stage.offsetWidth;
    stage.classList.add("shake");
    shakeTimer = window.setTimeout(() => stage.classList.remove("shake"), 390);

    window.clearTimeout(flashTimer);
    successFlash.classList.remove("pulse");
    void successFlash.offsetWidth;
    successFlash.classList.add("pulse");
    flashTimer = window.setTimeout(() => successFlash.classList.remove("pulse"), 480);

    const stageRect = stage.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const x = cellRect.left - stageRect.left + cellRect.width / 2;
    const y = cellRect.top - stageRect.top + cellRect.height / 2;

    const ring = document.createElement("span");
    ring.className = "hit-ring";
    ring.style.setProperty("--fx", `${x}px`);
    ring.style.setProperty("--fy", `${y}px`);
    effectsEl.appendChild(ring);

    const scorePop = document.createElement("span");
    scorePop.className = "score-pop";
    scorePop.textContent = `+${points}`;
    scorePop.style.setProperty("--fx", `${x}px`);
    scorePop.style.setProperty("--fy", `${y}px`);
    effectsEl.appendChild(scorePop);

    const colors = ["#fff1a8", "#ffd166", "#65e6ff", "#65f0a8"];
    const particles = [];
    for (let index = 0; index < 18; index += 1) {
      const angle = (Math.PI * 2 * index) / 18 + rand(-0.18, 0.18);
      const distance = rand(48, 125);
      const particle = document.createElement("span");
      particle.className = "hit-particle";
      particle.style.setProperty("--fx", `${x}px`);
      particle.style.setProperty("--fy", `${y}px`);
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      particle.style.setProperty("--size", `${rand(4, 9)}px`);
      particle.style.setProperty("--particle-color", colors[index % colors.length]);
      effectsEl.appendChild(particle);
      particles.push(particle);
    }

    window.setTimeout(() => {
      ring.remove();
      scorePop.remove();
      particles.forEach((particle) => particle.remove());
    }, 1000);
  }

  function revealBoard(activeRound) {
    if (activeRound !== roundId || phase !== "celebrating") return;

    phase = "revealing";
    stage.classList.remove("hunting");
    stage.classList.add("lights-on");
    setReminderOpen(true);

    fieldEl.querySelectorAll(".num-cell").forEach((cell) => {
      const value = Number(cell.dataset.n);
      cell.disabled = true;
      if (targets.includes(value)) cell.classList.add("reveal-target");
    });

    setMessage("All three found! Lights on — mission complete.", "good");
    playVictory();
    revealTimer = window.setTimeout(() => finishGame(activeRound), VICTORY_REVEAL_MS);
  }

  function finishGame(activeRound) {
    if (activeRound !== roundId || phase !== "revealing") return;

    phase = "results";
    difficulty = Math.min(12, difficulty + 1);
    score += 40;
    updateHud();

    overlayKicker.textContent = "Mission complete";
    overlayTitle.textContent = "All primes found!";
    overlayCopy.textContent = "You tracked every target through the dark. The whole board is glowing because of you.";
    overlayStats.hidden = false;
    overlayStats.textContent = `Score ${score} · Next level ${difficulty}`;
    startBtn.textContent = "Hunt again";
    startBtn.disabled = false;
    overlay.classList.remove("hidden");

    const completedTargets = [...targets];
    const completedFound = [...foundSet];
    const completedScore = score;
    const completedDifficulty = difficulty;

    pendingSave = (async () => {
      try {
        await MathArcade.submitScore(GAME_ID, completedScore);
        await MathArcade.saveProgress(GAME_ID, completedDifficulty, {
          targets: completedTargets,
          found: completedFound
        });
      } catch (error) {
        console.error("Prime Search could not save this game.", error);
      }
    })();
  }

  function beginHunt(activeRound) {
    if (activeRound !== roundId || phase !== "memorizing") return;

    try {
      buildField();
    } catch (error) {
      console.error(error);
      showSetupError();
      return;
    }

    memoryCard.hidden = true;
    memoryCard.classList.remove("counting");
    reminder.hidden = false;
    setReminderOpen(false);
    stage.classList.remove("memorizing");
    stage.classList.add("hunting");
    setBeamPosition(50, 50);

    phase = "hunting";
    playing = true;
    huntStart = performance.now();
    setMessage("Sweep the darkness. Find your three prime targets.");
    startSearchMusic();
  }

  function showSetupError() {
    phase = "idle";
    playing = false;
    resetStage();
    overlayKicker.textContent = "Mission interrupted";
    overlayTitle.textContent = "Board unavailable";
    overlayCopy.textContent = "The number field could not be prepared. Please try the hunt again.";
    overlayStats.hidden = true;
    startBtn.textContent = "Try again";
    startBtn.disabled = false;
    overlay.classList.remove("hidden");
  }

  async function startGame() {
    const activeRound = ++roundId;
    ensureAudio();
    stopSearchMusic(0.05);
    resetStage();

    phase = "preparing";
    startBtn.disabled = true;
    startBtn.textContent = "Preparing mission…";

    let progress = null;
    try {
      await pendingSave;
      await MathArcade.ensurePlayer();
      progress = await MathArcade.loadProgress(GAME_ID);
    } catch (error) {
      console.error("Prime Search could not load saved progress.", error);
    }

    if (activeRound !== roundId) return;

    difficulty = clamp(Number(progress?.difficultyLevel) || difficulty || 1, 1, 12);
    score = 0;
    targets = drawTargets();
    foundSet = new Set();
    playing = false;
    phase = "memorizing";

    renderTargetLists();
    updateHud();
    overlay.classList.add("hidden");
    overlayStats.hidden = true;
    stage.classList.remove("idle");
    stage.classList.add("memorizing");
    memoryCard.hidden = false;
    reminder.hidden = true;
    setMessage("Memorize your targets. The lights are about to go out.");

    const memoryMs = Math.max(1900, 3600 - difficulty * 140);
    memoryCard.style.setProperty("--memory-duration", `${memoryMs}ms`);
    memoryCard.classList.remove("counting");
    void memoryCard.offsetWidth;
    memoryCard.classList.add("counting");

    startBtn.disabled = false;
    startBtn.textContent = "Hunt again";
    memoryTimer = window.setTimeout(() => beginHunt(activeRound), memoryMs);
  }

  // Flashlight tracking
  function setBeamPosition(xPercent, yPercent) {
    stage.style.setProperty("--mx", `${clamp(xPercent, 0, 100)}%`);
    stage.style.setProperty("--my", `${clamp(yPercent, 0, 100)}%`);
  }

  function queueBeamAt(clientX, clientY) {
    queuedPointer = { clientX, clientY };
    if (pointerFrame) return;

    pointerFrame = window.requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!queuedPointer || phase !== "hunting") return;

      const rect = stage.getBoundingClientRect();
      const x = ((queuedPointer.clientX - rect.left) / rect.width) * 100;
      const y = ((queuedPointer.clientY - rect.top) / rect.height) * 100;
      setBeamPosition(x, y);
      queuedPointer = null;
    });
  }

  function focusFlashlightOn(cell) {
    if (phase !== "hunting") return;
    const stageRect = stage.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const x = ((cellRect.left + cellRect.width / 2 - stageRect.left) / stageRect.width) * 100;
    const y = ((cellRect.top + cellRect.height / 2 - stageRect.top) / stageRect.height) * 100;
    setBeamPosition(x, y);
  }

  stage.addEventListener("pointermove", (event) => {
    if (phase === "hunting") queueBeamAt(event.clientX, event.clientY);
  });

  stage.addEventListener("pointerdown", (event) => {
    if (phase === "hunting") queueBeamAt(event.clientX, event.clientY);
  });

  fieldEl.addEventListener("focusin", (event) => {
    const cell = event.target.closest(".num-cell");
    if (cell) focusFlashlightOn(cell);
  });

  // Procedural audio
  function ensureAudio() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;

      audioContext = new AudioContextClass();
      masterGain = audioContext.createGain();
      musicGain = audioContext.createGain();
      sfxGain = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();

      masterGain.gain.value = muted ? 0 : 0.72;
      musicGain.gain.value = 0.0001;
      sfxGain.gain.value = 0.92;

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  function trackMusicSource(source) {
    musicSources.add(source);
    source.addEventListener("ended", () => musicSources.delete(source), { once: true });
    return source;
  }

  function scheduleSearchNote(time) {
    if (!audioContext || !musicRunning) return;

    const notes = [220, 261.63, 329.63, 293.66, 246.94, 293.66, 349.23, 261.63];
    const frequency = notes[musicStep % notes.length];
    musicStep += 1;

    const oscillator = trackMusicSource(audioContext.createOscillator());
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    oscillator.type = musicStep % 3 === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(950, time);
    filter.frequency.exponentialRampToValueAtTime(420, time + 0.48);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.045, time + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);

    oscillator.connect(filter).connect(gain).connect(musicGain);
    oscillator.start(time);
    oscillator.stop(time + 0.54);
  }

  function scheduleMusicAhead() {
    if (!audioContext || !musicRunning) return;
    while (nextMusicTime < audioContext.currentTime + 0.28) {
      scheduleSearchNote(nextMusicTime);
      nextMusicTime += 0.42;
    }
  }

  function startSearchMusic() {
    if (musicRunning || muted || phase !== "hunting") return;
    const context = ensureAudio();
    if (!context) return;

    musicRunning = true;
    musicStep = 0;
    nextMusicTime = context.currentTime + 0.05;
    musicGain.gain.cancelScheduledValues(context.currentTime);
    musicGain.gain.setValueAtTime(0.0001, context.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.72, context.currentTime + 0.8);

    [55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = trackMusicSource(context.createOscillator());
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 2 ? 4 : -3;
      gain.gain.value = index === 1 ? 0.016 : 0.024;
      filter.type = "lowpass";
      filter.frequency.value = 260;
      oscillator.connect(filter).connect(gain).connect(musicGain);
      oscillator.start();
    });

    scheduleMusicAhead();
    musicTimer = window.setInterval(scheduleMusicAhead, 100);
  }

  function stopSearchMusic(fadeSeconds) {
    if (!audioContext) return;

    musicRunning = false;
    window.clearInterval(musicTimer);
    musicTimer = 0;

    const now = audioContext.currentTime;
    const fade = Math.max(0.01, fadeSeconds || 0.01);
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
    musicGain.gain.exponentialRampToValueAtTime(0.0001, now + fade);

    const sourcesToStop = [...musicSources];
    window.setTimeout(() => {
      sourcesToStop.forEach((source) => {
        try {
          source.stop();
        } catch (_error) {
          // The source may already have ended naturally.
        }
      });
    }, (fade + 0.08) * 1000);
  }

  function playTone(options) {
    if (muted) return;
    const context = ensureAudio();
    if (!context) return;

    const now = context.currentTime + (options.delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(options.from, now);
    if (options.to) {
      oscillator.frequency.exponentialRampToValueAtTime(options.to, now + options.duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(options.volume || 0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    oscillator.connect(gain).connect(sfxGain);
    oscillator.start(now);
    oscillator.stop(now + options.duration + 0.03);
  }

  function playSuccess(foundCount) {
    const lift = 1 + foundCount * 0.06;
    playTone({ from: 330 * lift, to: 740 * lift, duration: 0.22, volume: 0.13, type: "triangle" });
    playTone({ from: 165, to: 78, duration: 0.18, volume: 0.16, type: "sine" });
    playTone({ from: 880 * lift, to: 1180 * lift, duration: 0.16, volume: 0.055, type: "sine", delay: 0.09 });
  }

  function playMiss() {
    playTone({ from: 185, to: 92, duration: 0.24, volume: 0.075, type: "triangle" });
  }

  function playVictory() {
    [0, 0.12, 0.24, 0.4].forEach((delay, index) => {
      const notes = [261.63, 329.63, 392, 523.25];
      playTone({
        from: notes[index],
        to: notes[index] * 1.02,
        duration: 0.42,
        volume: index === 3 ? 0.16 : 0.1,
        type: index % 2 ? "triangle" : "sine",
        delay
      });
    });
  }

  function updateSoundControl() {
    soundToggle.setAttribute("aria-pressed", String(muted));
    soundToggle.setAttribute("aria-label", muted ? "Turn sound on" : "Mute sound");
    soundIcon.textContent = muted ? "×" : "♪";
    soundLabel.textContent = muted ? "Sound off" : "Sound on";
  }

  function toggleSound() {
    muted = !muted;
    writeStorage(MUTE_KEY, String(muted));
    updateSoundControl();

    const context = muted ? audioContext : ensureAudio();
    if (context && masterGain) {
      const now = context.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, now, 0.035);
    }

    if (muted) {
      stopSearchMusic(0.12);
    } else if (phase === "hunting") {
      startSearchMusic();
    }
  }

  reminderToggle.addEventListener("click", () => {
    setReminderOpen(!reminder.classList.contains("open"));
  });

  soundToggle.addEventListener("click", toggleSound);
  startBtn.addEventListener("click", startGame);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (phase === "hunting") stopSearchMusic(0.08);
      if (audioContext?.state === "running") {
        audioContext.suspend().catch(() => {});
      }
      return;
    }

    if (phase === "hunting" && !muted && audioContext) {
      audioContext.resume().then(startSearchMusic).catch(() => {});
    }
  });

  updateSoundControl();
  updateHud();
  setBeamPosition(50, 50);
})();
