/* Zombie Attack — Daily Bonus Galaxian clone. */
(function () {
  'use strict';

  const GAME_ID = "bonus2";

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 960, H = 720;
  let scale = 1, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    canvas.style.width = (W * scale) + 'px';
    canvas.style.height = (H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------- utils ----------------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const pad = (n, w) => String(Math.max(0, n | 0)).padStart(w, '0');

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------- audio ----------------
  let AC = null, muted = false;
  const SFX_GAIN = 0.32;
  let sfxGain = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  function sfxBus() {
    const c = ac();
    if (!c) return null;
    if (!sfxGain) {
      sfxGain = c.createGain();
      sfxGain.gain.value = muted ? 0.0001 : SFX_GAIN;
      sfxGain.connect(c.destination);
    }
    return sfxGain;
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (muted) return; const c = ac(); const dest = sfxBus(); if (!c || !dest) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(f0, 1), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noiseBurst(dur, vol, fc, delay) {
    if (muted) return; const c = ac(); const dest = sfxBus(); if (!c || !dest) return;
    const t = c.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fc || 1200;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t);
  }
  const sfx = {
    shoot() { tone(720, 240, 0.09, 'square', 0.06); },
    enemyShoot() { tone(300, 90, 0.16, 'sawtooth', 0.045); },
    hit() { tone(520, 300, 0.06, 'square', 0.09); },
    enemyDie() { noiseBurst(0.25, 0.22, 1800); tone(420, 60, 0.22, 'square', 0.1); },
    playerDie() { noiseBurst(0.7, 0.35, 900); tone(220, 30, 0.7, 'sawtooth', 0.22); },
    dive() { tone(700, 140, 0.5, 'sine', 0.04); },
    levelUp() { tone(440, 440, 0.12, 'square', 0.08); tone(660, 660, 0.12, 'square', 0.08, 0.12); tone(880, 880, 0.2, 'square', 0.08, 0.24); },
    gameOver() { tone(400, 400, 0.25, 'sawtooth', 0.1); tone(300, 300, 0.25, 'sawtooth', 0.1, 0.25); tone(200, 200, 0.3, 'sawtooth', 0.1, 0.5); tone(120, 60, 0.6, 'sawtooth', 0.1, 0.8); },
    start() { tone(330, 330, 0.1, 'square', 0.08); tone(495, 495, 0.1, 'square', 0.08, 0.1); tone(660, 990, 0.25, 'square', 0.08, 0.2); }
  };

  // ---------------- state ----------------
  const G = {
    state: 'title', // title | playing | banner | dying | gameover
    time: 0, score: 0, hi: 0, level: 1, lives: 3,
    shake: 0, bannerT: 0, dyingT: 0, newHi: false,
    diveTimer: 2, fireTimer: 2
  };

  // Procedural space-arcade loop (Web Audio, no assets). Tempo climbs with level.
  const MUSIC_GAIN = 0.22;
  const BASS_NOTES = [40, 43, 35, 36]; // E2 G2 B1 C2
  const CHORDS = [
    [52, 55, 59, 64], // Em
    [55, 59, 62, 67], // G
    [50, 54, 57, 62], // D
    [48, 52, 55, 60]  // C
  ];
  const ARP = [0, 2, 3, 2, 1, 3, 2, 0];
  let musicGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  function midiToFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function musicBus() {
    const c = ac();
    if (!c) return null;
    if (!musicGain) {
      musicGain = c.createGain();
      musicGain.gain.value = muted ? 0.0001 : MUSIC_GAIN;
      musicGain.connect(c.destination);
    }
    return c;
  }

  function applyMute() {
    const c = ac();
    if (!c) return;
    if (musicGain) {
      musicGain.gain.cancelScheduledValues(c.currentTime);
      musicGain.gain.setTargetAtTime(muted ? 0.0001 : MUSIC_GAIN, c.currentTime, 0.04);
    }
    if (sfxGain) {
      sfxGain.gain.cancelScheduledValues(c.currentTime);
      sfxGain.gain.setTargetAtTime(muted ? 0.0001 : SFX_GAIN, c.currentTime, 0.04);
    }
  }

  function currentBpm() {
    return 112 + Math.min(G.level, 12) * 3;
  }

  function stepDur() {
    return 60 / currentBpm() / 4;
  }

  function musicTone(opts) {
    const c = musicBus();
    if (!c || !musicGain) return;
    const t = opts.t;
    const dur = opts.dur || 0.2;
    const o = c.createOscillator();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(Math.max(opts.freq, 1), t);
    if (opts.freqEnd) {
      o.frequency.exponentialRampToValueAtTime(Math.max(opts.freqEnd, 1), t + dur);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.gain || 0.1, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (opts.filter) {
      const f = c.createBiquadFilter();
      f.type = opts.filterType || 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      f.connect(g);
    } else {
      o.connect(g);
    }
    g.connect(musicGain);
    o.start(t);
    o.stop(t + dur + 0.06);
  }

  function musicNoise(t, dur, vol, type, freq) {
    const c = musicBus();
    if (!c || !musicGain) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type || 'highpass';
    f.frequency.value = freq || 6000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(musicGain);
    s.start(t);
  }

  function scheduleMusicStep(stepIdx, t) {
    const bar = Math.floor(stepIdx / 16) % 4;
    const pos = stepIdx % 16;
    const chord = CHORDS[bar];
    const heat = Math.min(1, (G.level - 1) / 8);

    if (pos % 4 === 0) {
      musicTone({
        type: 'triangle', freq: midiToFreq(BASS_NOTES[bar]),
        t, dur: 0.28, gain: 0.2, attack: 0.01, filter: 480
      });
    }

    if (pos % 2 === 0) {
      const midi = chord[ARP[(pos / 2) % ARP.length]] + 12;
      musicTone({
        type: 'square', freq: midiToFreq(midi),
        t, dur: 0.12, gain: 0.04 + heat * 0.018, attack: 0.004,
        filter: 1400 + heat * 1200
      });
    }

    if (pos === 0) {
      const barLen = stepDur() * 16;
      musicTone({
        type: 'sawtooth', freq: midiToFreq(chord[0]),
        t, dur: barLen, gain: 0.02, attack: 0.35, filter: 620
      });
      musicTone({
        type: 'sawtooth', freq: midiToFreq(chord[2]) * 1.004,
        t, dur: barLen, gain: 0.016, attack: 0.4, filter: 620
      });
    }

    if (pos % 4 === 2 || (heat > 0.4 && pos % 2 === 1)) {
      musicNoise(t, 0.03, 0.03 + heat * 0.02, 'highpass', 6200);
    }

    if (heat > 0.25 && (pos === 4 || pos === 12)) {
      musicNoise(t, 0.08, 0.06, 'bandpass', 1800);
    }

    // sparse UFO wail — original, not a Galaxian sting
    if (stepIdx % 32 === 24) {
      musicTone({
        type: 'sine', freq: 780, freqEnd: 240,
        t, dur: 0.55, gain: 0.035, attack: 0.08, filter: 2200
      });
    }
  }

  function musicScheduler() {
    const c = musicBus();
    if (!c) return;
    while (nextNoteTime < c.currentTime + 0.28) {
      if (!muted) scheduleMusicStep(musicStep, nextNoteTime);
      nextNoteTime += stepDur();
      musicStep += 1;
    }
  }

  function startMusic() {
    if (!musicBus() || musicTimer) return;
    musicStep = 0;
    nextNoteTime = AC.currentTime + 0.05;
    applyMute();
    musicTimer = setInterval(musicScheduler, 80);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  let gateResult = null;

  async function checkGate() {
    if (gateResult) return gateResult;
    try {
      const progress = await MathArcade.loadAllProgress();
      const status = MathArcade.getDailyBonusUnlockStatus(progress);
      gateResult = status;
      const stats = MathArcade.parseProgressStats(progress[GAME_ID]);
      if (Number.isFinite(stats.bestScore)) G.hi = Math.max(G.hi, stats.bestScore);
    } catch (_) {
      gateResult = { unlocked: true, completed: 0, required: 0 };
    }
    return gateResult;
  }

  function showLockedCard(status) {
    const overlayEl = document.getElementById('lock-overlay');
    const card = document.getElementById('lock-card');
    const stillNeed = MathArcade.formatActivityList(status.remainingTitles);
    const remainingLine = stillNeed
      ? ` Still need: <strong>${stillNeed}</strong>.`
      : "";
    card.innerHTML =
      `<h2>Still locked!</h2>` +
      `<p>The Daily Bonus opens after you finish today's math activities.` +
      ` You've done <strong>${status.completed} of ${status.required}</strong> so far.${remainingLine}</p>` +
      `<a href="/">Back to activities</a>`;
    overlayEl.hidden = false;
  }

  async function persistRun() {
    try {
      await MathArcade.submitScore(GAME_ID, G.score);
      await MathArcade.saveProgress(GAME_ID, 1, {
        bestScore: G.hi,
        lastScore: G.score,
        level: G.level
      });
    } catch (err) {
      console.error(err);
    }
  }

  const bullets = [];   // marshmallows
  const ebullets = [];  // slime bolts
  const enemies = [];
  const particles = [];
  const floaters = [];

  const player = {
    x: W / 2, y: H - 84, vx: 0, speed: 430,
    alive: true, invuln: 0, respawn: 0, fireCd: 0
  };

  const form = { swayX: 0, swayAmp: 60, swaySpeed: 0.6, baseY: 92, descent: 0, gridW: 0, slotW: 66, slotH: 50 };

  // ---------------- starfield ----------------
  const starLayers = [
    { n: 70, sp: 18, sz: 1.0, br: 0.45 },
    { n: 46, sp: 46, sz: 1.7, br: 0.7 },
    { n: 26, sp: 105, sz: 2.6, br: 1.0 }
  ];
  const stars = [];
  const starCols = ['#ffffff', '#cfe8ff', '#d8ffd0', '#ffd8f0'];
  for (let l = 0; l < starLayers.length; l++) {
    for (let i = 0; i < starLayers[l].n; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, l, tw: Math.random() * 6.28, c: pick(starCols) });
    }
  }
  const nebulae = [
    { x: 200, y: 150, r: 260, c: 'rgba(90,40,170,0.10)', vx: 6, vy: 4 },
    { x: 720, y: 420, r: 300, c: 'rgba(30,130,60,0.08)', vx: -5, vy: 6 },
    { x: 480, y: 620, r: 240, c: 'rgba(170,40,120,0.07)', vx: 4, vy: -5 }
  ];

  // ---------------- scanline / vignette overlay ----------------
  const overlay = document.createElement('canvas');
  overlay.width = W; overlay.height = H;
  (function () {
    const o = overlay.getContext('2d');
    o.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = 0; y < H; y += 3) o.fillRect(0, y, W, 1);
    const g = o.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    o.fillStyle = g;
    o.fillRect(0, 0, W, H);
  })();

  // ---------------- difficulty scaling ----------------
  const diveInterval = () => Math.max(0.55, 2.4 - G.level * 0.18);
  const maxDivers = () => Math.min(1 + Math.floor(G.level / 2), 4);
  const diveDuration = () => Math.max(1.15, 2.4 - G.level * 0.09);
  const fireInterval = () => Math.max(0.4, 1.7 - G.level * 0.13);
  const diverFireCd = () => Math.max(0.5, 1.2 - G.level * 0.06);
  const boltSpeed = () => 200 + G.level * 16;
  const aimedBoltSpeed = () => 250 + G.level * 18;

  // ---------------- waves ----------------
  function slotWorld(e) {
    return {
      x: W / 2 - form.gridW / 2 + e.col * form.slotW + form.swayX,
      y: form.baseY + form.descent + e.row * form.slotH + Math.sin(G.time * 2 + e.bob) * 3
    };
  }

  function spawnWave(level) {
    enemies.length = 0;
    ebullets.length = 0;
    const cols = Math.min(6 + level, 10);
    const rows = Math.min(3 + Math.floor((level - 1) / 2), 5);
    form.gridW = (cols - 1) * form.slotW;
    form.descent = 0;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          col: c, row: r, lord: r === 0,
          hp: r === 0 ? 2 : 1,
          x: 0, y: -80, rot: 0, flash: 0,
          state: 'entering',
          enterDelay: 0.25 + i * 0.045, enterT: 0,
          bob: Math.random() * 6.28,
          path: null, fireCd: 1 + Math.random()
        });
        i++;
      }
    }
    G.diveTimer = 2.2;
    G.fireTimer = 2.0;
  }

  function startDive(e) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const px = player.x;
    e.path = {
      p0: { x: e.x, y: e.y },
      p1: { x: e.x + side * rand(190, 330), y: e.y + rand(40, 110) },
      p2: { x: px - side * rand(120, 220), y: H * rand(0.45, 0.6) },
      p3: { x: px + rand(-40, 40), y: H + 70 },
      t: 0, dur: diveDuration()
    };
    e.state = 'diving';
    e.fireCd = Math.min(e.fireCd, 0.4);
    sfx.dive();
  }

  function cubic(p, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return {
      x: a * p.p0.x + b * p.p1.x + c * p.p2.x + d * p.p3.x,
      y: a * p.p0.y + b * p.p1.y + c * p.p2.y + d * p.p3.y
    };
  }
  function cubicDer(p, t) {
    const u = 1 - t;
    return {
      x: 3 * u * u * (p.p1.x - p.p0.x) + 6 * u * t * (p.p2.x - p.p1.x) + 3 * t * t * (p.p3.x - p.p2.x),
      y: 3 * u * u * (p.p1.y - p.p0.y) + 6 * u * t * (p.p2.y - p.p1.y) + 3 * t * t * (p.p3.y - p.p2.y)
    };
  }

  // ---------------- particles / floaters ----------------
  function explode(x, y, colors, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, v = spd * (0.25 + Math.random() * 0.75);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0, max: rand(0.35, 0.9), size: rand(1.5, 4.5),
        color: pick(colors), drag: 0.90, glow: true
      });
    }
    if (particles.length > 550) particles.splice(0, particles.length - 550);
  }

  // ---------------- firing ----------------
  function playerFire() {
    bullets.push({ x: player.x, y: player.y - 26, vy: -640, wob: Math.random() * 6 });
    sfx.shoot();
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: player.x + rand(-4, 4), y: player.y - 24, vx: rand(-40, 40), vy: rand(-120, -40),
        life: 0, max: 0.2, size: rand(1, 2.5), color: '#ffe9a0', drag: 0.9, glow: true
      });
    }
  }

  function enemyFire(e, aimed) {
    if (ebullets.length > 45) return;
    let vx = 0, vy = boltSpeed();
    if (aimed) {
      const dx = player.x - e.x, dy = (player.y - 10) - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = aimedBoltSpeed();
      vx = dx / d * sp; vy = dy / d * sp;
      if (vy < 70) vy = 70;
    }
    ebullets.push({ x: e.x, y: e.y + 16, vx, vy, t: Math.random() * 6 });
    sfx.enemyShoot();
  }

  // ---------------- combat ----------------
  function hitEnemy(ei) {
    const e = enemies[ei];
    e.hp--; e.flash = 1;
    if (e.hp > 0) {
      sfx.hit();
      explode(e.x, e.y, ['#d8ffd0', '#8cff6a'], 8, 140);
      return;
    }
    const diving = e.state === 'diving';
    const pts = e.lord ? (diving ? 300 : 150) : (diving ? 150 : 60);
    G.score += pts;
    if (G.score > G.hi) G.hi = G.score;
    enemies.splice(ei, 1);
    explode(e.x, e.y, ['#8cff6a', '#5cff4f', '#d8ffd0', '#ff8fb3', '#3a7a2a'], 34, 260);
    floaters.push({ x: e.x, y: e.y, text: '+' + pts, life: 0, color: e.lord ? '#ff9cff' : '#8cff6a' });
    G.shake = Math.max(G.shake, 3);
    sfx.enemyDie();
  }

  function playerHit() {
    if (!player.alive || player.invuln > 0) return;
    explode(player.x, player.y, ['#ffffff', '#ffb347', '#ff6a3a', '#4fe8ff'], 60, 330);
    sfx.playerDie();
    G.shake = 16;
    G.lives--;
    player.alive = false;
    player.respawn = 1.5;
    ebullets.length = 0;
    if (G.lives <= 0) {
      G.state = 'dying';
      G.dyingT = 1.8;
      G.newHi = G.score >= G.hi && G.score > 0;
      stopMusic();
      persistRun();
      sfx.gameOver();
    }
  }

  // ---------------- game flow ----------------
  function startGame() {
    if (!gateResult || !gateResult.unlocked) return;
    G.score = 0; G.level = 1; G.lives = 3; G.newHi = false;
    bullets.length = 0; ebullets.length = 0; particles.length = 0; floaters.length = 0;
    player.x = W / 2; player.vx = 0; player.alive = true; player.invuln = 1.2; player.fireCd = 0;
    spawnWave(1);
    G.state = 'playing';
    sfx.start();
    startMusic();
  }

  const FLAVOR = [
    'DEFEND THE SKIES', 'THE HORDE GROWS', 'THEY SMELL YOUR BRAINS',
    'FASTER. HUNGRIER.', 'THE SKY TURNS SICKLY', 'THEY JUST KEEP COMING',
    'NO END IN SIGHT', 'BRAINS... BRAINS...'
  ];
  const flavorText = () => G.level <= FLAVOR.length ? FLAVOR[G.level - 1] : pick(FLAVOR.slice(4));

  // ---------------- input ----------------
  const keys = {};
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    ac();
    if (e.code === 'Enter') {
      if (G.state === 'title' || G.state === 'gameover') startGame();
    }
    // edge-triggered fire so quick taps never fall between frames
    if (e.code === 'Space' && !e.repeat && (G.state === 'playing' || G.state === 'banner')) {
      if (player.alive && player.fireCd <= 0 && bullets.length < 3) {
        playerFire();
        player.fireCd = 0.28;
      }
    }
    if (e.code === 'KeyM') {
      muted = !muted;
      applyMute();
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('pointerdown', () => {
    ac();
    if (G.state === 'title' || G.state === 'gameover') startGame();
  });

  // ---------------- update ----------------
  function update(dt) {
    // stars always scroll
    const starMul = G.state === 'playing' ? 1 : 0.5;
    for (const s of stars) {
      s.y += starLayers[s.l].sp * starMul * dt;
      if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
    }
    for (const n of nebulae) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -n.r) n.x = W + n.r; if (n.x > W + n.r) n.x = -n.r;
      if (n.y < -n.r) n.y = H + n.r; if (n.y > H + n.r) n.y = -n.r;
    }
    G.shake = Math.max(0, G.shake - dt * 30);

    // particles & floaters always
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= p.drag; p.vy *= p.drag;
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life += dt; f.y -= 40 * dt;
      if (f.life > 0.9) floaters.splice(i, 1);
    }

    if (G.state === 'title' || G.state === 'gameover') return;

    if (G.state === 'dying') {
      G.dyingT -= dt;
      updateEnemies(dt, false);
      if (G.dyingT <= 0) G.state = 'gameover';
      return;
    }

    // formation motion
    form.swaySpeed = 0.6 + G.level * 0.06;
    form.swayX = Math.sin(G.time * form.swaySpeed) * form.swayAmp;
    form.descent = Math.min(150, form.descent + dt * (2 + G.level * 0.9));

    // player
    if (player.alive) {
      const dir = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
      const target = dir * player.speed;
      player.vx += (target - player.vx) * Math.min(1, 14 * dt);
      player.x = clamp(player.x + player.vx * dt, 30, W - 30);
      player.fireCd -= dt;
      player.invuln = Math.max(0, player.invuln - dt);
      if (keys.Space && player.fireCd <= 0 && bullets.length < 3) {
        playerFire();
        player.fireCd = 0.28;
      }
    } else {
      player.respawn -= dt;
      if (player.respawn <= 0 && G.lives > 0) {
        player.alive = true;
        player.x = W / 2; player.vx = 0;
        player.invuln = 2.5;
      }
    }

    // marshmallows
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * dt;
      // flame trail
      for (let k = 0; k < 2; k++) {
        particles.push({
          x: b.x + rand(-3.5, 3.5), y: b.y + rand(8, 14),
          vx: rand(-25, 25), vy: rand(50, 130),
          life: 0, max: rand(0.15, 0.3), size: rand(1.5, 3.5),
          color: pick(['#ffd23c', '#ff9a1e', '#fff3b0', '#ff6a1e']), drag: 0.92, glow: true
        });
      }
      if (b.y < -40) bullets.splice(i, 1);
    }

    updateEnemies(dt, G.state === 'playing' && player.alive);

    // slime bolts
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.t += dt;
      b.x += b.vx * dt + Math.sin(b.t * 9) * 0.4;
      b.y += b.vy * dt;
      if (Math.random() < 0.3) {
        particles.push({
          x: b.x + rand(-2, 2), y: b.y - 4, vx: rand(-15, 15), vy: rand(-30, 0),
          life: 0, max: 0.3, size: rand(1, 2.5), color: '#7cff4f', drag: 0.9, glow: true
        });
      }
      if (b.y > H + 30 || b.x < -30 || b.x > W + 30) ebullets.splice(i, 1);
    }

    if (G.state === 'banner') {
      G.bannerT -= dt;
      if (G.bannerT <= 0) { spawnWave(G.level); G.state = 'playing'; }
      return;
    }

    // dive scheduler
    G.diveTimer -= dt;
    if (G.diveTimer <= 0) {
      G.diveTimer = diveInterval();
      const diving = enemies.filter(e => e.state === 'diving').length;
      if (diving < maxDivers()) {
        const cands = enemies.filter(e => e.state === 'formation');
        if (cands.length) startDive(pick(cands));
      }
    }

    // enemy fire scheduler
    G.fireTimer -= dt;
    if (G.fireTimer <= 0 && player.alive) {
      G.fireTimer = fireInterval();
      const divers = enemies.filter(e => e.state === 'diving');
      const pool = (divers.length && Math.random() < 0.7) ? divers
        : enemies.filter(e => e.state === 'formation' || e.state === 'diving');
      if (pool.length) enemyFire(pick(pool), pool === divers || Math.random() < 0.25);
    }

    // collisions: marshmallows vs zombies
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let hit = false;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (e.state === 'entering' && e.enterDelay > 0) continue;
        const r = e.lord ? 24 : 19;
        if (Math.hypot(b.x - e.x, b.y - e.y) < r + 6) {
          bullets.splice(bi, 1);
          hitEnemy(ei);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // collisions: player vs bolts & diving ships
    if (player.alive && player.invuln <= 0) {
      for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i];
        if (Math.hypot(b.x - player.x, b.y - player.y) < 7 + 15) {
          ebullets.splice(i, 1);
          playerHit();
          break;
        }
      }
      if (player.alive) {
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
          const e = enemies[ei];
          if (e.state !== 'diving') continue;
          if (Math.hypot(e.x - player.x, e.y - player.y) < 30) {
            explode(e.x, e.y, ['#8cff6a', '#5cff4f', '#d8ffd0'], 26, 240);
            enemies.splice(ei, 1);
            playerHit();
            break;
          }
        }
      }
    }

    // wave cleared?
    if (enemies.length === 0) {
      G.level++;
      G.state = 'banner';
      G.bannerT = 2.4;
      sfx.levelUp();
    }
  }

  function updateEnemies(dt, canFire) {
    for (const e of enemies) {
      e.flash = Math.max(0, e.flash - dt * 6);
      if (e.state === 'entering') {
        const s = slotWorld(e);
        if (e.enterDelay > 0) { e.enterDelay -= dt; e.x = s.x; e.y = -80; continue; }
        e.enterT += dt / 1.3;
        const k = easeOutCubic(Math.min(e.enterT, 1));
        e.x = s.x;
        e.y = -80 + (s.y + 80) * k;
        if (e.enterT >= 1) e.state = 'formation';
      } else if (e.state === 'formation') {
        const s = slotWorld(e);
        e.x = s.x; e.y = s.y;
        e.rot = Math.sin(G.time * 2 + e.bob) * 0.07;
      } else if (e.state === 'diving') {
        const p = e.path;
        p.t += dt / p.dur;
        if (p.t >= 1) {
          e.state = 'returning';
          e.y = -50;
          e.x = clamp(e.x, 50, W - 50);
          e.rot = 0;
        } else {
          const pos = cubic(p, p.t);
          const der = cubicDer(p, p.t);
          e.x = pos.x; e.y = pos.y;
          e.rot = Math.atan2(der.y, der.x) - Math.PI / 2;
          e.fireCd -= dt;
          if (canFire && e.fireCd <= 0) {
            enemyFire(e, true);
            e.fireCd = diverFireCd();
          }
        }
      } else if (e.state === 'returning') {
        const s = slotWorld(e);
        const dx = s.x - e.x, dy = s.y - e.y;
        const d = Math.hypot(dx, dy);
        const sp = 320 + G.level * 22;
        if (d < Math.max(10, sp * dt)) { e.state = 'formation'; e.rot = 0; }
        else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; e.rot *= 0.9; }
      }
    }
  }

  // ---------------- drawing ----------------
  function drawZombieShip(e, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.rot);
    const s = e.lord ? 1.22 : 1;
    ctx.scale(s, s);
    const t = G.time + e.bob;
    const flash = e.flash > 0.4;
    ctx.shadowColor = e.lord ? '#c66aff' : '#59ff4a';
    ctx.shadowBlur = 12;

    // slime drips
    ctx.fillStyle = 'rgba(120,255,80,0.75)';
    for (let i = -1; i <= 1; i++) {
      const dl = 2 + (Math.sin(t * 3 + i * 2.1) + 1) * 2;
      ctx.beginPath();
      ctx.ellipse(i * 11, 13 + dl, 2.2, 3.5 + dl * 0.4, 0, 0, 6.28);
      ctx.fill();
    }

    // body
    const g = ctx.createLinearGradient(0, -14, 0, 16);
    if (e.lord) {
      g.addColorStop(0, flash ? '#ffffff' : '#d9a6ff');
      g.addColorStop(0.5, flash ? '#f4eaff' : '#7a4fae');
      g.addColorStop(1, '#2a1d4a');
    } else {
      g.addColorStop(0, flash ? '#ffffff' : '#9dff6e');
      g.addColorStop(0.5, flash ? '#eaffea' : '#4fae3a');
      g.addColorStop(1, '#1d4a22');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 2, 22, 13, 0, 0, 6.28);
    ctx.fill();

    // ribs on belly
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(8,35,12,0.55)';
    ctx.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * 8, 4, 7, 0.35, Math.PI - 0.35);
      ctx.stroke();
    }

    // stitches
    ctx.strokeStyle = flash ? '#fff' : '#c8ffb0';
    ctx.lineWidth = 1.2;
    for (const sx of [-14, 14]) {
      ctx.beginPath(); ctx.moveTo(sx - 3, -2); ctx.lineTo(sx + 3, 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 3, 2); ctx.lineTo(sx + 3, -2); ctx.stroke();
    }

    // dome with brain
    ctx.shadowColor = e.lord ? '#e0b3ff' : '#baffab';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(200,255,200,0.32)';
    ctx.beginPath();
    ctx.arc(0, -6, 10, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = flash ? '#ffffff' : '#ff8fb3';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.bezierCurveTo(-5, -13, -2, -8, 0, -12);
    ctx.bezierCurveTo(2, -8, 5, -13, 7, -8);
    ctx.stroke();

    // bone spikes for lords
    if (e.lord) {
      ctx.fillStyle = flash ? '#fff' : '#efe6d0';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 8 - 3, -12);
        ctx.lineTo(i * 8, -20);
        ctx.lineTo(i * 8 + 3, -12);
        ctx.closePath();
        ctx.fill();
      }
    }

    // X eye (dead)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(10, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(4, 2); ctx.stroke();

    // dangling eyeball
    const sw = Math.sin(t * 2.4) * 3;
    ctx.strokeStyle = '#9dff6e';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-8, 2); ctx.quadraticCurveTo(-8 + sw, 8, -8 + sw, 12); ctx.stroke();
    ctx.fillStyle = '#f2ffe8';
    ctx.beginPath(); ctx.arc(-8 + sw, 14, 3.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#c00';
    ctx.beginPath(); ctx.arc(-8 + sw, 14.8, 1.4, 0, 6.28); ctx.fill();

    // jagged mouth
    ctx.fillStyle = '#0d2b10';
    ctx.beginPath();
    ctx.moveTo(-7, 7);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-7 + i * 2.33, 7 + (i % 2 ? 3.4 : 0));
    ctx.lineTo(7, 11); ctx.lineTo(-7, 11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8ffd8';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-5 + i * 5, 7); ctx.lineTo(-3.5 + i * 5, 10); ctx.lineTo(-2 + i * 5, 7);
      ctx.closePath(); ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayerShip(x, y, sc) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    // engine flame
    const f = 9 + Math.sin(G.time * 28) * 3 + Math.random() * 2.5;
    ctx.globalCompositeOperation = 'lighter';
    const fg = ctx.createLinearGradient(0, 12, 0, 12 + f * 2);
    fg.addColorStop(0, 'rgba(160,255,255,0.9)');
    fg.addColorStop(0.4, 'rgba(60,180,255,0.55)');
    fg.addColorStop(1, 'rgba(0,60,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 12); ctx.lineTo(0, 12 + f * 2); ctx.lineTo(5, 12);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.shadowColor = '#4fe8ff';
    ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(0, -20, 0, 14);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#7ce8ff');
    g.addColorStop(1, '#1450c8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(6, -6, 17, 8);
    ctx.lineTo(17, 12);
    ctx.lineTo(7, 9);
    ctx.lineTo(0, 13);
    ctx.lineTo(-7, 9);
    ctx.lineTo(-17, 12);
    ctx.lineTo(-17, 8);
    ctx.quadraticCurveTo(-6, -6, 0, -20);
    ctx.closePath(); ctx.fill();

    // magenta wing accents
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-13, 8); ctx.lineTo(-6, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(13, 8); ctx.lineTo(6, 2); ctx.stroke();

    // cockpit
    ctx.fillStyle = '#eaffff';
    ctx.beginPath(); ctx.arc(0, -4, 3.4, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  function drawMarshmallow(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.sin(G.time * 10 + b.wob) * 0.14);
    // flame
    const f = 11 + Math.sin(G.time * 38 + b.wob) * 4;
    ctx.globalCompositeOperation = 'lighter';
    let fg = ctx.createLinearGradient(0, 6, 0, 8 + f * 1.7);
    fg.addColorStop(0, 'rgba(255,240,160,0.95)');
    fg.addColorStop(0.45, 'rgba(255,150,30,0.7)');
    fg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 6); ctx.quadraticCurveTo(-3, 10 + f, 0, 8 + f * 1.7);
    ctx.quadraticCurveTo(3, 10 + f, 5, 6);
    ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // toasted marshmallow body
    ctx.shadowColor = '#fff2c0';
    ctx.shadowBlur = 9;
    const g = ctx.createLinearGradient(0, -8, 0, 7);
    g.addColorStop(0, '#d9974f');
    g.addColorStop(0.35, '#fdfdf6');
    g.addColorStop(1, '#e9dcc4');
    ctx.fillStyle = g;
    rr(-6, -8, 12, 14, 5);
    ctx.fill();
    // tiny face
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4a3a28';
    ctx.beginPath(); ctx.arc(-2.2, -1, 1, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(2.2, -1, 1, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(0, 1.4, 1.8, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.restore();
  }

  function drawSlimeBolt(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = '#7cff4f';
    ctx.shadowBlur = 12;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
    g.addColorStop(0, '#eaffd0');
    g.addColorStop(0.4, '#8cff5a');
    g.addColorStop(1, 'rgba(60,180,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.28); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(140,255,90,0.6)';
    ctx.beginPath(); ctx.arc(0, -9, 3, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -15, 1.8, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    ctx.font = '700 20px "Courier New", monospace';
    ctx.textBaseline = 'top';
    ctx.shadowColor = '#4fe8ff'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#bff4ff';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + pad(G.score, 6), 18, 14);
    ctx.font = '700 13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(160,220,255,0.65)';
    ctx.fillText('HI ' + pad(G.hi, 6), 18, 40);

    ctx.font = '700 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#59ff4a';
    ctx.fillStyle = '#c6ffb8';
    ctx.fillText('LEVEL ' + G.level, W / 2, 14);

    // lives
    ctx.textAlign = 'right';
    ctx.font = '700 13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(160,220,255,0.65)';
    ctx.shadowColor = '#4fe8ff';
    ctx.fillText('LIVES', W - 20 - Math.max(0, G.lives) * 30 - 8, 20);
    for (let i = 0; i < Math.max(0, G.lives); i++) {
      drawPlayerShip(W - 34 - i * 30, 26, 0.55);
    }
    ctx.restore();
  }

  function drawText(str, x, y, size, color, glow, align) {
    ctx.save();
    ctx.font = '700 ' + size + 'px "Courier New", monospace';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = size * 0.6;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04040e');
    bg.addColorStop(0.6, '#070418');
    bg.addColorStop(1, '#0a0620');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (G.shake > 0) {
      ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);
    }

    // nebulae
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, n.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // stars
    for (const s of stars) {
      const L = starLayers[s.l];
      ctx.globalAlpha = L.br * (0.55 + 0.45 * Math.sin(G.time * 3 + s.tw));
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x, s.y, L.sz, L.sz);
    }
    ctx.globalAlpha = 1;

    if (G.state === 'title') {
      // decorative mini fleet
      const bob = Math.sin(G.time * 1.5) * 8;
      const demo = [
        { x: W / 2 - 130, lord: false, bob: 1 }, { x: W / 2, lord: true, bob: 2 }, { x: W / 2 + 130, lord: false, bob: 3 }
      ];
      for (const d of demo) {
        drawZombieShip({ rot: Math.sin(G.time + d.bob) * 0.08, lord: d.lord, flash: 0, bob: d.bob }, d.x, 150 + bob + Math.sin(G.time * 2 + d.bob) * 5);
      }
      drawText('ZOMBIE', W / 2, 300, 84, '#6aff4f', '#2aff2a');
      drawText('ATTACK', W / 2, 380, 84, '#ff4fd8', '#ff2ad0');
      drawText('— A GALAXIAN OF THE UNDEAD —', W / 2, 438, 18, '#7ce8ff', '#4fe8ff');
      if (Math.floor(G.time * 2) % 2 === 0) {
        drawText('PRESS ENTER TO START', W / 2, 520, 26, '#ffffff', '#aaffff');
      }
      drawText('← → MOVE    SPACE FIRE    M MUTE', W / 2, 580, 16, 'rgba(180,220,255,0.7)', '#4fe8ff');
      drawText('FLING FLAMING MARSHMALLOWS. TOAST THE HORDE.', W / 2, 612, 15, 'rgba(255,210,140,0.75)', '#ffb347');
      if (G.hi > 0) drawText('HI-SCORE ' + pad(G.hi, 6), W / 2, 664, 16, '#ffe9a0', '#ffb347');
    } else {
      // slime bolts
      for (const b of ebullets) drawSlimeBolt(b);
      // enemies
      for (const e of enemies) {
        if (e.state === 'entering' && e.enterDelay > 0) continue;
        drawZombieShip(e, e.x, e.y);
      }
      // marshmallows
      for (const b of bullets) drawMarshmallow(b);
      // player
      if (player.alive && (player.invuln <= 0 || Math.floor(G.time * 12) % 2 === 0)) {
        drawPlayerShip(player.x, player.y, 1);
      }

      // particles (additive)
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, 6.28);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // floaters
      for (const f of floaters) {
        ctx.globalAlpha = 1 - f.life / 0.9;
        drawText(f.text, f.x, f.y, 16, f.color, f.color);
      }
      ctx.globalAlpha = 1;

      drawHUD();

      if (G.state === 'banner') {
        ctx.fillStyle = 'rgba(2,2,10,0.45)';
        ctx.fillRect(0, 0, W, H);
        drawText('LEVEL ' + G.level, W / 2, H / 2 - 30, 54, '#6aff4f', '#2aff2a');
        drawText(flavorText(), W / 2, H / 2 + 26, 20, '#7ce8ff', '#4fe8ff');
      } else if (G.state === 'dying') {
        drawText('THE HORDE FEASTS...', W / 2, H / 2, 26, '#ff6a6a', '#ff2a2a');
      } else if (G.state === 'gameover') {
        ctx.fillStyle = 'rgba(2,2,10,0.6)';
        ctx.fillRect(0, 0, W, H);
        drawText('GAME OVER', W / 2, 250, 64, '#ff4f6a', '#ff2a4a');
        drawText('FINAL SCORE  ' + pad(G.score, 6), W / 2, 350, 24, '#bff4ff', '#4fe8ff');
        drawText('LEVEL REACHED  ' + G.level, W / 2, 392, 24, '#c6ffb8', '#59ff4a');
        if (G.newHi && Math.floor(G.time * 2) % 2 === 0) {
          drawText('★ NEW HIGH SCORE ★', W / 2, 446, 22, '#ffe9a0', '#ffb347');
        }
        if (Math.floor(G.time * 2) % 2 === 0) {
          drawText('PRESS ENTER OR CLICK TO RESTART', W / 2, 530, 20, '#ffffff', '#aaffff');
        }
      }
    }

    // scanlines + vignette
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.drawImage(overlay, 0, 0);
  }

  // ---------------- main loop ----------------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    G.time += dt;
    update(dt);
    render();
  }
  requestAnimationFrame(frame);

  checkGate().then((status) => {
    if (!status.unlocked) showLockedCard(status);
  });

  // ---------------- test hooks ----------------
  window.__game = {
    G, player, enemies, bullets, ebullets, particles,
    startGame,
    forceDive() { const c = enemies.find(e => e.state === 'formation'); if (c) startDive(c); return !!c; },
    clearWave() { enemies.length = 0; },
    hitPlayer() { player.invuln = 0; playerHit(); },
    countByState() {
      const m = {};
      for (const e of enemies) m[e.state] = (m[e.state] || 0) + 1;
      return m;
    }
  };
})();
