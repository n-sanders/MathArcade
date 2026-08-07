/* Daily Bonus — SVG desert endless runner (Chrome Dino–style).
   Score = run duration only (centiseconds). Jump cacti, duck flyers. */
(function () {
  const GAME_ID = "bonus";
  const VIEW_W = 900;
  const VIEW_H = 500;
  const GROUND_Y = 420;
  const PLAYER_X = 140;
  const PLAYER_GROUND_Y = 356;
  const GRAVITY = 2400;
  const JUMP_V = -820;
  const BASE_SPEED = 280;
  const SPEED_ACCEL = 18; // px/s gained per second of run
  const MAX_SPEED = 720;
  const URGENT_SPEED = 480;

  // ------------------------------------------------------------- DOM ----
  const stage = document.getElementById("stage");
  const worldSvg = document.getElementById("world-svg");
  const obstaclesEl = document.getElementById("obstacles");
  const playerEl = document.getElementById("player");
  const dunesFar = document.getElementById("dunes-far");
  const dunesNear = document.getElementById("dunes-near");
  const clouds = document.getElementById("clouds");
  const groundDashes = document.getElementById("ground-dashes");
  const legA = document.getElementById("leg-a");
  const legB = document.getElementById("leg-b");
  const fxEl = document.getElementById("fx-layer");
  const flashEl = document.getElementById("flash");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayCard = document.getElementById("overlay-card");

  const poseRun = document.getElementById("pose-run");
  const poseJump = document.getElementById("pose-jump");
  const poseDuck = document.getElementById("pose-duck");
  const poseCrash = document.getElementById("pose-crash");

  // ----------------------------------------------------------- state ----
  let mode = "idle"; // idle | playing | over
  let score = 0;
  let best = 0;
  let runElapsedMs = 0;
  let speed = BASE_SPEED;
  let playerY = PLAYER_GROUND_Y;
  let velY = 0;
  let onGround = true;
  let ducking = false;
  let wantDuck = false;
  let obstacles = [];
  let spawnTimer = 0;
  let scrollFar = 0;
  let scrollNear = 0;
  let scrollCloud = 0;
  let scrollDash = 0;
  let legPhase = 0;
  let lastTs = 0;
  let raf = null;
  let lastMilestone = 0;
  let stageW = 900;
  let stageH = 500;
  let touchStartY = null;
  let duckFromTouch = false;

  // Obstacle templates (SVG markup + hitbox in local space)
  const OBSTACLE_KINDS = {
    cactusShort: {
      type: "ground",
      w: 28,
      h: 48,
      y: GROUND_Y - 48,
      svg: `
        <rect x="10" y="18" width="10" height="30" rx="3" fill="#2d6b45"/>
        <rect x="2" y="24" width="8" height="6" rx="2" fill="#2d6b45"/>
        <rect x="20" y="28" width="8" height="6" rx="2" fill="#2d6b45"/>
        <rect x="2" y="18" width="6" height="12" rx="2" fill="#3a8a58"/>
        <rect x="22" y="22" width="6" height="12" rx="2" fill="#3a8a58"/>
        <ellipse cx="15" cy="16" rx="7" ry="5" fill="#3a8a58"/>
      `
    },
    cactusTall: {
      type: "ground",
      w: 36,
      h: 72,
      y: GROUND_Y - 72,
      svg: `
        <rect x="13" y="10" width="12" height="62" rx="4" fill="#2d6b45"/>
        <rect x="0" y="28" width="14" height="8" rx="3" fill="#2d6b45"/>
        <rect x="24" y="36" width="12" height="8" rx="3" fill="#2d6b45"/>
        <rect x="0" y="14" width="8" height="22" rx="3" fill="#3a8a58"/>
        <rect x="28" y="22" width="8" height="22" rx="3" fill="#3a8a58"/>
        <ellipse cx="19" cy="8" rx="8" ry="6" fill="#3a8a58"/>
      `
    },
    flyer: {
      type: "air",
      w: 48,
      h: 28,
      y: GROUND_Y - 78,
      svg: `
        <ellipse cx="24" cy="16" rx="16" ry="8" fill="#ff6b5a"/>
        <path d="M8 16 Q0 4 14 10" fill="#ff8f7a"/>
        <path d="M40 16 Q52 4 34 10" fill="#ff8f7a"/>
        <circle cx="32" cy="14" r="2.2" fill="#2a1210"/>
        <path d="M38 16 L46 14" stroke="#2a1210" stroke-width="2" stroke-linecap="round"/>
      `
    }
  };

  // =================================================================
  // AUDIO — procedural desert chase soundtrack + SFX
  // =================================================================
  let audio = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;
  let musicUrgent = false;

  const BPM_NORMAL = 112;
  const BPM_URGENT = 148;

  // Dm — C — Bb — A  (dusty chase)
  const BASS_NOTES = [41, 36, 34, 33]; // F2 C2 Bb1 A1 (rooted under Dm feel)
  const CHORDS = [
    [50, 53, 57, 62], // D F A D
    [48, 52, 55, 60], // C E G C
    [46, 50, 53, 58], // Bb D F Bb
    [45, 49, 52, 57]  // A C# E A
  ];
  const ARP = [0, 2, 1, 3, 2, 0, 3, 1];

  function stepDur() {
    return 60 / (musicUrgent ? BPM_URGENT : BPM_NORMAL) / 4;
  }

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensureAudio() {
    if (!audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audio = new Ctx();
      musicGain = audio.createGain();
      musicGain.gain.value = 0.7;
      musicGain.connect(audio.destination);
      sfxGain = audio.createGain();
      sfxGain.gain.value = 0.95;
      sfxGain.connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function noiseBuffer(seconds) {
    const buf = audio.createBuffer(1, Math.max(1, audio.sampleRate * seconds), audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(dest, opts) {
    const t = opts.t !== undefined ? opts.t : audio.currentTime;
    const dur = opts.dur || 0.2;
    const osc = audio.createOscillator();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), t + dur);
    }
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.2, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let head = osc;
    if (opts.filter) {
      const f = audio.createBiquadFilter();
      f.type = opts.filterType || "lowpass";
      f.frequency.value = opts.filter;
      osc.connect(f);
      head = f;
    }
    head.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.08);
  }

  function scheduleMusicStep(stepIdx, t) {
    const dur = stepDur();
    const bar = Math.floor(stepIdx / 16) % 4;
    const pos = stepIdx % 16;
    const chord = CHORDS[bar];
    const urgencyBoost = musicUrgent ? 1.25 : 1;

    if (pos % 4 === 0) {
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(BASS_NOTES[bar]),
        t, dur: 0.28, gain: 0.26 * urgencyBoost, attack: 0.01, filter: 480
      });
    }

    if (pos % 2 === 0) {
      const midi = chord[ARP[(pos / 2) % ARP.length]] + 12;
      tone(musicGain, {
        type: "square",
        freq: midiToFreq(midi),
        t, dur: 0.14, gain: 0.045 * urgencyBoost, attack: 0.004, filter: musicUrgent ? 2400 : 1600
      });
    }

    if (pos === 0) {
      const barLen = dur * 16;
      tone(musicGain, {
        type: "sawtooth",
        freq: midiToFreq(chord[0]),
        t, dur: barLen, gain: 0.028, attack: 0.4, filter: 700
      });
      tone(musicGain, {
        type: "triangle",
        freq: midiToFreq(chord[2]) * 1.002,
        t, dur: barLen, gain: 0.022, attack: 0.45, filter: 900
      });
    }

    if (pos % 4 === 2 || (musicUrgent && pos % 2 === 1)) {
      const src = audio.createBufferSource();
      src.buffer = noiseBuffer(0.045);
      const f = audio.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = musicUrgent ? 4500 : 6000;
      const g = audio.createGain();
      g.gain.setValueAtTime(musicUrgent ? 0.07 : 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t);
    }

    if (musicUrgent && pos % 4 === 0) {
      tone(musicGain, {
        type: "sine", freq: 90, freqEnd: 40,
        t, dur: 0.18, gain: 0.28, attack: 0.005
      });
    }
  }

  function musicScheduler() {
    if (!audio) return;
    while (nextNoteTime < audio.currentTime + 0.28) {
      scheduleMusicStep(musicStep, nextNoteTime);
      nextNoteTime += stepDur();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!ensureAudio() || musicTimer) return;
    musicStep = 0;
    musicUrgent = false;
    nextNoteTime = audio.currentTime + 0.05;
    musicTimer = setInterval(musicScheduler, 80);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function playJump() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sine", freq: 260, freqEnd: 780, t, dur: 0.22, gain: 0.24, attack: 0.008 });
    tone(sfxGain, { type: "triangle", freq: 520, freqEnd: 1100, t: t + 0.03, dur: 0.16, gain: 0.1 });
  }

  function playDuck() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.18);
    const f = audio.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
    tone(sfxGain, { type: "triangle", freq: 180, freqEnd: 90, t, dur: 0.12, gain: 0.12 });
  }

  function playLand() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "triangle", freq: 140, freqEnd: 70, t, dur: 0.1, gain: 0.16 });
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.07);
    const f = audio.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1200;
    const g = audio.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playCrash() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    tone(sfxGain, { type: "sawtooth", freq: 200, freqEnd: 50, t, dur: 0.55, gain: 0.24, filter: 700 });
    tone(sfxGain, { type: "square", freq: 120, freqEnd: 40, t: t + 0.05, dur: 0.4, gain: 0.16, filter: 500 });
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(0.7);
    const f = audio.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 0.65);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t);
  }

  function playMilestone() {
    if (!ensureAudio()) return;
    const t = audio.currentTime;
    [523, 659, 784].forEach((f, i) => {
      tone(sfxGain, { type: "triangle", freq: f, t: t + i * 0.07, dur: 0.18, gain: 0.16 });
    });
  }

  function playClick() {
    if (!ensureAudio()) return;
    tone(sfxGain, { type: "sine", freq: 720, dur: 0.06, gain: 0.12 });
  }

  // ------------------------------------------------------------ juice ----
  function setPose(name) {
    poseRun.setAttribute("display", name === "run" ? "inline" : "none");
    poseJump.setAttribute("display", name === "jump" ? "inline" : "none");
    poseDuck.setAttribute("display", name === "duck" ? "inline" : "none");
    poseCrash.setAttribute("display", name === "crash" ? "inline" : "none");
  }

  function shake(big) {
    stage.classList.remove("shake", "shake-big");
    void stage.offsetWidth;
    stage.classList.add(big ? "shake-big" : "shake");
  }

  function flash(kind) {
    flashEl.className = "screen-flash go" + (kind ? " " + kind : "");
    setTimeout(() => { flashEl.className = "screen-flash"; }, 380);
  }

  function svgToStage(x, y) {
    const rect = worldSvg.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    // Approximate mapping: SVG uses meet so content is letterboxed
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const offsetX = (rect.width - VIEW_W * scale) / 2;
    const offsetY = (rect.height - VIEW_H * scale) / 2;
    return {
      x: rect.left - stageRect.left + offsetX + x * scale,
      y: rect.top - stageRect.top + offsetY + y * scale
    };
  }

  function spawnSparks(svgX, svgY, count, colorA, colorB) {
    const p = svgToStage(svgX, svgY);
    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.className = "spark";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 36 + Math.random() * 70;
      s.style.left = p.x + "px";
      s.style.top = p.y + "px";
      s.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      s.style.setProperty("--dy", Math.sin(angle) * dist - 24 + "px");
      s.style.background = Math.random() > 0.45 ? (colorA || "#c4a574") : (colorB || "#2ec4b6");
      fxEl.appendChild(s);
      setTimeout(() => s.remove(), 750);
    }
  }

  function floatText(svgX, svgY, text, cls) {
    const p = svgToStage(svgX, svgY);
    const el = document.createElement("div");
    el.className = "float-text" + (cls ? " " + cls : "");
    el.textContent = text;
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    fxEl.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ---------------------------------------------------------- helpers ----
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
  }

  function playerHitbox() {
    // Hitboxes in SVG world coords
    if (ducking && onGround) {
      return { x: PLAYER_X + 8, y: playerY + 34, w: 50, h: 28 };
    }
    if (!onGround) {
      return { x: PLAYER_X + 12, y: playerY + 4, w: 36, h: 48 };
    }
    return { x: PLAYER_X + 12, y: playerY + 8, w: 36, h: 54 };
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ------------------------------------------------------- obstacles ----
  function clearObstacles() {
    obstacles = [];
    obstaclesEl.innerHTML = "";
  }

  function spawnObstacle() {
    const kinds = ["cactusShort", "cactusTall", "flyer"];
    // Prefer ground early; more flyers as speed rises
    let kindName;
    const r = Math.random();
    if (speed < 360) {
      kindName = r < 0.55 ? "cactusShort" : r < 0.85 ? "cactusTall" : "flyer";
    } else {
      kindName = pick(kinds);
    }
    const kind = OBSTACLE_KINDS[kindName];
    const x = VIEW_W + 40;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${x}, ${kind.y})`);
    g.innerHTML = kind.svg;
    obstaclesEl.appendChild(g);

    // Slight flyer height jitter
    let y = kind.y;
    if (kind.type === "air") {
      y = GROUND_Y - rand(70, 95);
      g.setAttribute("transform", `translate(${x}, ${y})`);
    }

    obstacles.push({
      el: g,
      x,
      y,
      w: kind.w,
      h: kind.h,
      type: kind.type,
      kind: kindName
    });
  }

  function nextSpawnDelay() {
    // Gap shrinks as speed rises (seconds)
    const minGap = clamp(0.85 - (speed - BASE_SPEED) / 900, 0.45, 0.95);
    const maxGap = clamp(1.55 - (speed - BASE_SPEED) / 700, 0.75, 1.7);
    return rand(minGap, maxGap);
  }

  // ---------------------------------------------------------- control ----
  function tryJump() {
    if (mode !== "playing") return;
    if (!onGround) return;
    if (wantDuck || ducking) return;
    onGround = false;
    ducking = false;
    velY = JUMP_V;
    setPose("jump");
    playJump();
    spawnSparks(PLAYER_X + 28, GROUND_Y - 4, 8, "#c4a574", "#e8d4b0");
  }

  function setDuckIntent(down) {
    wantDuck = down;
    if (mode !== "playing") return;
    if (down && onGround && !ducking) {
      ducking = true;
      setPose("duck");
      playDuck();
    } else if (!down && ducking && onGround) {
      ducking = false;
      setPose("run");
    }
  }

  // ------------------------------------------------------------- loop ----
  function resetRun() {
    clearObstacles();
    runElapsedMs = 0;
    score = 0;
    speed = BASE_SPEED;
    playerY = PLAYER_GROUND_Y;
    velY = 0;
    onGround = true;
    ducking = false;
    wantDuck = false;
    duckFromTouch = false;
    spawnTimer = 1.1;
    scrollFar = 0;
    scrollNear = 0;
    scrollCloud = 0;
    scrollDash = 0;
    legPhase = 0;
    lastMilestone = 0;
    musicUrgent = false;
    stage.classList.remove("urgent");
    playerEl.setAttribute("transform", `translate(${PLAYER_X}, ${playerY})`);
    setPose("run");
    updateHud();
  }

  function startGame() {
    ensureAudio();
    playClick();
    resetRun();
    mode = "playing";
    overlay.classList.add("hidden");
    stopMusic();
    startMusic();
    lastTs = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function endGame() {
    if (mode !== "playing") return;
    mode = "over";
    setPose("crash");
    stopMusic();
    playCrash();
    shake(true);
    flash("bad");
    spawnSparks(PLAYER_X + 28, playerY + 30, 22, "#ff6b5a", "#c4a574");
    floatText(PLAYER_X + 40, playerY, "Crash!", "bad");

    if (score > best) best = score;
    updateHud();
    persistRun();
    showEndOverlay();
  }

  async function persistRun() {
    try {
      await MathArcade.submitScore(GAME_ID, score);
      await MathArcade.saveProgress(GAME_ID, 1, {
        lastScore: score,
        bestScore: best,
        runMs: runElapsedMs
      });
    } catch (_) {
      /* offline / auth — ignore */
    }
  }

  function showEndOverlay() {
    const isBest = score >= best && score > 0;
    overlayCard.innerHTML = `
      <h2>${isBest && score > 0 ? "New best!" : "Wiped out"}</h2>
      <p>You survived ${(runElapsedMs / 1000).toFixed(1)}s in the desert dash.</p>
      <p class="overlay-stats">Score ${score} · Best ${best}</p>
      <button class="btn btn-primary" type="button" id="again-btn">Play again</button>
      <a class="btn btn-ghost" href="/">Back to arcade</a>
    `;
    overlay.classList.remove("hidden");
  }

  function updateParallax(dt) {
    scrollFar = (scrollFar + speed * 0.15 * dt) % 960;
    scrollNear = (scrollNear + speed * 0.35 * dt) % 1000;
    scrollCloud = (scrollCloud + speed * 0.08 * dt) % 900;
    scrollDash = (scrollDash + speed * dt) % 46;
    dunesFar.setAttribute("transform", `translate(${-scrollFar}, 0)`);
    dunesNear.setAttribute("transform", `translate(${-scrollNear}, 0)`);
    clouds.setAttribute("transform", `translate(${-scrollCloud}, 0)`);
    groundDashes.setAttribute("transform", `translate(${-scrollDash}, 0)`);
  }

  function updateLegs(dt) {
    if (!onGround || ducking || mode !== "playing") {
      if (legA) legA.setAttribute("transform", "");
      if (legB) legB.setAttribute("transform", "");
      return;
    }
    legPhase += dt * (speed / 55);
    const swing = Math.sin(legPhase) * 12;
    if (legA) legA.setAttribute("transform", `rotate(${swing} 22 50)`);
    if (legB) legB.setAttribute("transform", `rotate(${-swing} 36 50)`);
  }

  function frame(ts) {
    if (mode !== "playing") {
      raf = null;
      return;
    }
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(dt, 0.05);

    runElapsedMs += dt * 1000;
    score = Math.floor(runElapsedMs / 100);
    speed = Math.min(MAX_SPEED, BASE_SPEED + (runElapsedMs / 1000) * SPEED_ACCEL);
    updateHud();

    const urgent = speed >= URGENT_SPEED;
    if (urgent !== musicUrgent) {
      musicUrgent = urgent;
      stage.classList.toggle("urgent", urgent);
      if (urgent) floatText(VIEW_W * 0.55, 120, "Faster!", "milestone");
    }

    if (score > 0 && score % 100 === 0 && score !== lastMilestone) {
      lastMilestone = score;
      playMilestone();
      floatText(PLAYER_X + 40, playerY - 10, String(score), "milestone");
    }

    // Physics
    if (!onGround) {
      velY += GRAVITY * dt;
      playerY += velY * dt;
      if (playerY >= PLAYER_GROUND_Y) {
        playerY = PLAYER_GROUND_Y;
        velY = 0;
        onGround = true;
        playLand();
        spawnSparks(PLAYER_X + 28, GROUND_Y - 2, 6, "#c4a574", "#8a6b45");
        if (wantDuck) {
          ducking = true;
          setPose("duck");
        } else {
          ducking = false;
          setPose("run");
        }
      } else {
        setPose("jump");
      }
    } else if (wantDuck) {
      if (!ducking) {
        ducking = true;
        setPose("duck");
        playDuck();
      }
    } else if (ducking) {
      ducking = false;
      setPose("run");
    }

    playerEl.setAttribute("transform", `translate(${PLAYER_X}, ${playerY})`);

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      // Avoid stacking too close
      const last = obstacles[obstacles.length - 1];
      if (!last || last.x < VIEW_W - 120) {
        spawnObstacle();
      }
      spawnTimer = nextSpawnDelay();
    }

    // Move obstacles + collide
    const hit = playerHitbox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      o.el.setAttribute("transform", `translate(${o.x}, ${o.y})`);
      if (o.x + o.w < -40) {
        o.el.remove();
        obstacles.splice(i, 1);
        continue;
      }
      const ob = { x: o.x + 2, y: o.y + 2, w: o.w - 4, h: o.h - 4 };
      if (aabb(hit, ob)) {
        endGame();
        return;
      }
    }

    updateParallax(dt);
    updateLegs(dt);

    raf = requestAnimationFrame(frame);
  }

  // ----------------------------------------------------------- input ----
  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.key === " ") {
      e.preventDefault();
      if (mode === "idle" || mode === "over") {
        // Let button handle start; Space can also start when overlay visible
        if (!overlay.classList.contains("hidden")) startGame();
        else tryJump();
      } else {
        tryJump();
      }
    } else if (e.code === "ArrowDown" || e.key === "ArrowDown") {
      e.preventDefault();
      setDuckIntent(true);
    }
  }

  function onKeyUp(e) {
    if (e.code === "ArrowDown" || e.key === "ArrowDown") {
      e.preventDefault();
      setDuckIntent(false);
    }
  }

  function onPointerDown(e) {
    if (mode !== "playing") return;
    if (e.target.closest(".overlay")) return;
    const rect = stage.getBoundingClientRect();
    const yRatio = (e.clientY - rect.top) / rect.height;
    touchStartY = e.clientY;
    if (yRatio > 0.72) {
      duckFromTouch = true;
      setDuckIntent(true);
    } else {
      duckFromTouch = false;
      tryJump();
    }
  }

  function onPointerUp(e) {
    if (duckFromTouch) {
      duckFromTouch = false;
      setDuckIntent(false);
    }
    if (touchStartY != null && e.clientY - touchStartY > 40) {
      // swipe down completed — already ducked via move if needed
    }
    touchStartY = null;
  }

  function onPointerMove(e) {
    if (mode !== "playing" || touchStartY == null) return;
    if (e.clientY - touchStartY > 36) {
      duckFromTouch = true;
      setDuckIntent(true);
    }
  }

  // -------------------------------------------------------------- boot ----
  function measure() {
    stageW = stage.clientWidth || 900;
    stageH = stage.clientHeight || 600;
  }

  async function loadBest() {
    try {
      const progress = await MathArcade.loadProgress(GAME_ID);
      if (progress && progress.statsJson) {
        let stats = {};
        try {
          stats = JSON.parse(progress.statsJson);
        } catch (_) {
          stats = {};
        }
        const serverBest = Number(stats.bestScore || 0);
        if (serverBest > best) best = Math.floor(serverBest);
      }
    } catch (_) {
      /* ignore */
    }
    updateHud();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target.closest("#start-btn, #again-btn")) startGame();
  });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  stage.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", measure);

  measure();
  setPose("run");
  updateHud();
  loadBest();
})();
