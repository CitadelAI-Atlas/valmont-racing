// ─────────────────────────────────────────────
//  GAME — Main loop, physics, AI, hazards
//  Portrait-first, single canvas
// ─────────────────────────────────────────────

const Game = (() => {
  let state = 'idle'; // idle | qualify | race | paused
  let track = null;
  let car   = null;
  let segments = [];

  let playerZ = 0, playerX = 0, playerSpeed = 0, playerMaxSpeed = 0;
  const keys = {};
  window.TouchKeys = window.TouchKeys || new Map();

  let lap = 0, totalLaps = 3, raceTime = 0, finished = false, position = 1;
  let hazardEffect = null, crashTimer = 0;
  let trafficCars = [];
  let countdown = -1, countdownTimer = null;
  let canvas = null, ctx = null, animFrame = null;
  // Pending qualify→race handoff timer — kept in scope so pause/retry/finish
  // can cancel it and prevent a zombie startRace() from firing after the player
  // leaves the game screen.
  let pendingRaceStart = null;
  // Best final time for the current track, cached at race start. Used to
  // compute a +/- delta at each lap roll-over.
  let bestTime = null;
  // Mode at the moment the player paused — so R-retry resumes the right path
  // (qualify-as-qualify vs. race-as-race) rather than always starting a race.
  let pausedFromMode = null;
  // Visual FX state — decayed each frame, passed to renderer as `fx`.
  //   shakeTime:  seconds of remaining camera shake. Amp scales with (shakeTime*18).
  //   damage:     0..1 cumulative — recovers slowly outside crashes.
  //   lastSpdR:   previous throttle ratio (reserved for future smoothing).
  let shakeTime = 0, damage = 0;
  // Nitro system: 0..1 meter, refills by clean passes, drains when active.
  //   nitroActive: currently boosting. Re-press while empty is a no-op.
  //   combo:       passes without a crash — multiplies refill, shown briefly.
  //   comboTimer:  seconds before combo resets if no new pass lands.
  //   drafting:    last-frame flag from _updateTraffic for HUD indicator.
  let nitro = 0, nitroActive = false, combo = 0, comboTimer = 0, drafting = false;
  // Debounces nitro key → one activation per keypress instead of per frame.
  let _nitroPressed = false;

  // ── Canvas sizing (portrait) ───────────────
  function _sizeCanvas() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    // Fill full viewport minus HUD only — controls are fixed overlay
    const w = window.innerWidth;
    const h = window.innerHeight - 32;
    // Match device pixel ratio for crisp rendering without excess pixel cost
    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    // Store logical size
    canvas._lw = w;
    canvas._lh = h;
  }

  function _penalty(surface) {
    if (surface === 'road') return 0;
    const p = car.surfacePenalties[surface];
    return typeof p === 'number' ? p : 0;
  }

  // ── Start qualify ──────────────────────────
  function startQualify(trackObj, carObj) {
    track = trackObj;
    car   = carObj;
    window._selectedCar   = carObj;
    window._selectedTrack = trackObj;

    segments = Renderer.buildSegments(track);
    _spawnHazards();
    _addFinishLine();
    _spawnScenery();
    _spawnTraffic(track.trafficDensity * 0.5);

    playerZ = playerX = playerSpeed = 0;
    playerMaxSpeed = carObj.topSpeed / 100;
    raceTime = 0; finished = false;
    shakeTime = 0; damage = 0;
    nitro = 0; nitroActive = false; combo = 0; comboTimer = 0; drafting = false;
    state = 'qualify';

    UI.showScreen('game');
    _sizeCanvas();
    UI.clearMsg();
    _countdown('qualify');
  }

  function startRace(overrideCar) {
    if (overrideCar) {
      car = overrideCar;
      window._selectedCar = overrideCar;
      playerMaxSpeed = overrideCar.topSpeed / 100;
    }
    playerZ = playerX = playerSpeed = 0;
    raceTime = 0; lap = 1;
    totalLaps = track.lapGoal;
    finished = false;
    shakeTime = 0; damage = 0;
    nitro = 0; nitroActive = false; combo = 0; comboTimer = 0; drafting = false;
    // Starting grid position is a soft tier scale; _updatePosition() will
    // re-rank live each frame based on traffic actually passed/ahead.
    const tier = track.tier || 3;
    position = tier <= 1 ? 2 : tier <= 2 ? 4 : tier <= 3 ? 6 : 8;

    bestTime = (Leaderboard.getBest(track.id) || {}).time || null;

    _spawnTraffic(track.trafficDensity);
    _sizeCanvas();
    UI.clearMsg();
    _countdown('race');
    AudioFX.startMusic();
    AudioFX.startEngine();
  }

  // ── Countdown ──────────────────────────────
  function _countdown(mode) {
    countdown = 3;
    UI.showMsg(mode === 'qualify' ? 'COMPLETE ONE LAP TO QUALIFY' : 'READY...');
    if (mode === 'qualify') setTimeout(() => UI.showMsg('READY...'), 1200);
    AudioFX.playCountdown(countdown);

    if (animFrame) cancelAnimationFrame(animFrame);
    lastTs = 0;
    animFrame = requestAnimationFrame(ts => _loop(ts, mode));

    countdownTimer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        UI.showMsg(countdown + '...');
        AudioFX.playCountdown(countdown);
      } else if (countdown === 0) {
        UI.showMsg('GO!');
        AudioFX.playCountdown(0);
        setTimeout(() => UI.clearMsg(), 800);
        clearInterval(countdownTimer);
        state = mode;
      }
    }, 1000);
  }

  // ── Main loop ──────────────────────────────
  let lastTs = 0;
  function _loop(ts, mode) {
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.033) : 0.016;
    lastTs = ts;

    if (state === mode || countdown > 0) {
      _update(dt, mode);
      _draw();
    }
    animFrame = requestAnimationFrame(t => _loop(t, mode));
  }

  function _update(dt, mode) {
    if (countdown > 0) return;
    raceTime += dt;

    // ── Input ────────────────────────────────
    const tk = window.TouchKeys;
    const gas   = keys['ArrowUp']    || keys['w'] || keys['W'] || tk.get('ArrowUp')    ? 1 : 0;
    const brake = keys['ArrowDown']  || keys['s'] || keys['S'] || tk.get('ArrowDown')  ? 1 : 0;
    const left  = keys['ArrowLeft']  || keys['a'] || keys['A'] || tk.get('ArrowLeft')  ? 1 : 0;
    const right = keys['ArrowRight'] || keys['d'] || keys['D'] || tk.get('ArrowRight') ? 1 : 0;

    // ── Nitro input + meter ──────────────────
    // Shift / Space / N, or touch 'nitro' key. Debounced via _nitroPressed so
    // holding the key doesn't re-trigger every frame — one burst per press.
    const nitroKey = keys['Shift'] || keys[' '] || keys['n'] || keys['N'] || tk.get('nitro');
    if (nitroKey && !_nitroPressed && nitro > 0.08) {
      nitroActive = true;
      _nitroPressed = true;
    }
    if (!nitroKey) _nitroPressed = false;
    if (nitroActive) {
      nitro -= 0.38 * dt;
      if (nitro <= 0) { nitro = 0; nitroActive = false; }
    }

    // ── Surface ──────────────────────────────
    const segIdx  = Math.floor(playerZ) % segments.length;
    const seg     = segments[segIdx];
    const surface = seg ? seg.surface : 'road';
    let surfPen   = _penalty(surface);
    if (hazardEffect) surfPen = Math.max(surfPen, hazardEffect.strength);
    // Rain adds a flat slickness penalty and raises grip loss on all surfaces;
    // fog is purely visual (handled in renderer).
    if (track.weather === 'rain') surfPen = Math.max(surfPen, 0.08);

    // ── Speed ────────────────────────────────
    // Nitro: +18% to top speed + +100% to acceleration while active.
    // Draft: +6% acceleration when tucked behind a traffic car (drafting flag
    // is set in _updateTraffic). Subtle — rewards tailgating without making
    // it required.
    const nitroBoost = nitroActive ? 1.18 : 1.0;
    const draftBoost = drafting    ? 1.06 : 1.0;
    const maxSpd = playerMaxSpeed * nitroBoost * (1 - surfPen);
    const accel  = 0.7 * (car.acceleration / 100) * (nitroActive ? 2.0 : 1.0) * draftBoost;
    if (gas && !brake) {
      playerSpeed = Math.min(maxSpd, playerSpeed + accel * dt);
    } else if (brake) {
      playerSpeed = Math.max(0, playerSpeed - 0.6 * dt);
    } else {
      playerSpeed = Math.max(0, playerSpeed - 0.15 * dt);
    }
    if (crashTimer > 0) { crashTimer -= dt; }  // timer only — no per-frame speed drain

    // ── Steering ─────────────────────────────
    const hf = car.handling / 100 * (0.5 + playerSpeed * 0.5);
    const ls = 1.8 * dt * hf * (1 - surfPen * 0.5);
    if (left)  playerX -= ls;
    if (right) playerX += ls;
    if (surface === 'ice') playerX += (Math.random() - 0.5) * 0.01 * playerSpeed;

    if (Math.abs(playerX) > 1.0) {
      // dt-scaled so it's a per-second rate — low dirt penalty (SUV/truck) = minimal slowdown
      playerSpeed *= Math.max(0.25, 1 - car.surfacePenalties.dirt * 2.5 * dt);
      playerX = Math.max(-1.3, Math.min(1.3, playerX));
    }

    // ── Move ─────────────────────────────────
    const speedMPH = playerSpeed * 100;
    playerZ += playerSpeed * 90 * dt;

    // ── Lap ──────────────────────────────────
    // `while` handles dt spikes that could cross more than one finish line.
    while (playerZ >= segments.length) {
      playerZ -= segments.length;
      if (mode === 'race') {
        lap++;
        AudioFX.playCheckpoint();
        AudioFX.nextPattern();
        if (lap > totalLaps) { _finishRace(); return; }
        // Ghost delta: at lap boundary L of totalLaps, expected raceTime is
        // bestTime * (L-1)/totalLaps. Deviation from that is our +/- readout.
        let deltaMsg = '';
        if (bestTime) {
          const expected = bestTime * ((lap - 1) / totalLaps);
          const delta = raceTime - expected;
          const sign = delta >= 0 ? '+' : '-';
          deltaMsg = '\n' + sign + Math.abs(delta).toFixed(2) + 's';
        }
        UI.showMsg('LAP ' + lap + '!' + deltaMsg, 1500);
      } else {
        _finishQualify(); return;
      }
    }

    // Qualify time scales with tier — beginners get more time
    const tierMult  = track.tier <= 1 ? 2.0 : track.tier <= 2 ? 1.5 : 1.2;
    const speedMult = 118 / car.topSpeed;   // slower cars get proportionally more time
    if (mode === 'qualify' && raceTime > track.qualifyTime * tierMult * speedMult) {
      UI.showMsg('TIME UP!');
      if (pendingRaceStart) clearTimeout(pendingRaceStart);
      pendingRaceStart = setTimeout(() => { pendingRaceStart = null; startRace(); }, 2000);
      state = 'idle'; return;
    }

    _checkTrafficCollision(segIdx);
    _checkHazardCollision(seg);
    _updateTraffic(dt);
    if (mode === 'race') _updatePosition();

    // Engine pitch reacts to the actual boosted speed so nitro is audible.
    AudioFX.setEngineSpeed(playerSpeed * (nitroActive ? 1.12 : 1.0));
    const hudFx = { nitro, nitroActive, combo, drafting };
    if (mode === 'race') {
      UI.updateHUD('race', { pos: Math.round(position), time: raceTime, speed: speedMPH, lap, totalLaps, fx: hudFx });
    } else {
      UI.updateHUD('qualify', { time: raceTime, speed: speedMPH, fx: hudFx });
    }

    if (hazardEffect) {
      hazardEffect.duration -= dt;
      if (hazardEffect.duration <= 0) hazardEffect = null;
    }

    // FX decay — shake runs out fast, damage heals slowly so the smoke/tint
    // lingers past a single crash but clears over a lap of clean driving.
    if (shakeTime > 0) shakeTime = Math.max(0, shakeTime - dt);
    if (damage > 0)    damage    = Math.max(0, damage - dt * 0.08);
    // Combo expires 3.5s after last pass; visible x-multiplier disappears too.
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
  }

  function _draw() {
    if (!ctx || !canvas) return;
    const W = canvas._lw || canvas.width;
    const H = canvas._lh || canvas.height;

    // Compute shake offset from remaining shakeTime; random per-frame so it
    // actually looks like shake, not drift.
    let sx = 0, sy = 0;
    if (shakeTime > 0) {
      const amp = Math.min(1, shakeTime) * 14;
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp * 0.5;
    }
    // Banking: use upcoming segment curve so the horizon leans into the turn.
    const lookIdx = (Math.floor(playerZ) + 10) % segments.length;
    const bank    = segments[lookIdx] ? -segments[lookIdx].curve : 0;

    // Current player surface drives particle colour ('dirt' → tan dust,
    // 'ice' → white powder). Renderer checks fx.surface + playerSpeed itself.
    const pSeg    = segments[Math.floor(playerZ) % segments.length];
    const surface = pSeg ? pSeg.surface : 'road';

    Renderer.render(ctx, track, segments, playerZ, playerX, playerSpeed, W, H, {
      maxSpeed: playerMaxSpeed,
      shakeX: sx, shakeY: sy,
      damage, banking: bank,
      surface,
      nitro: nitroActive,
    });
    _drawMinimap();
  }

  // ── Traffic minimap ────────────────────────
  // Horizontal strip, player at centre. Traffic within ±30 segments shown as
  // small squares positioned left (behind) or right (ahead) of the player.
  // Colour: red = ahead, yellow = just ahead, cyan = behind.
  const _MINIMAP_RANGE = 30;
  function _drawMinimap() {
    const mm = document.getElementById('minimap');
    if (!mm) return;
    const mctx = mm.getContext('2d');
    const mw = mm.width, mh = mm.height;
    mctx.clearRect(0, 0, mw, mh);
    // Centre-line + player marker
    mctx.fillStyle = '#222';
    mctx.fillRect(0, mh / 2 - 1, mw, 2);
    mctx.fillStyle = '#0ff';
    mctx.fillRect(mw / 2 - 2, mh / 2 - 3, 4, 6);

    const L = segments.length || 1;
    for (let i = 0; i < trafficCars.length; i++) {
      const tc = trafficCars[i];
      let d = ((tc.z - playerZ + L) % L);
      if (d > L / 2) d -= L;   // signed distance: negative = behind
      if (Math.abs(d) > _MINIMAP_RANGE) continue;
      const fx = (d / _MINIMAP_RANGE) * (mw / 2 - 2);
      const x = Math.round(mw / 2 + fx);
      // Lane offset mirrored as small Y offset so lane position is visible too
      const y = Math.round(mh / 2 + tc.x * (mh / 2 - 2));
      mctx.fillStyle = d > 10 ? '#f33' : d > 0 ? '#ff0' : '#8af';
      mctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  // ── Finish line ────────────────────────────
  function _addFinishLine() {
    // Mark first 4 segments as finish line (buildSegments already set isFinish,
    // but _spawnHazards clears staticSprites[] so poles must be re-added here)
    if (segments[0]) {
      segments[0].staticSprites.push({ type: 'finishpole', lane: -2.5, hScale: 1.8, wRatio: 0.6, flagDir: 1 });
      segments[0].staticSprites.push({ type: 'finishpole', lane:  2.5, hScale: 1.8, wRatio: 0.6, flagDir: -1 });
    }
  }

  // ── Scenery (roadside objects) ─────────────
  const SCENERY_MAP = {
    route66:    ['billboard', 'cactus', 'barn'],
    pch:        ['palm', 'billboard'],
    tokyo:      ['building'],
    la_freeway: ['building', 'billboard'],
    monaco:     ['building'],
    swiss_alps: ['tree', 'boulder'],
    dubai:      ['building', 'billboard'],
    fuji:       ['tree', 'billboard'],
    amalfi:     ['building', 'boulder'],
    baja:       ['cactus', 'boulder'],
    autobahn:   ['tree', 'billboard'],
    nullarbor:  ['billboard'],
  };

  function _spawnScenery() {
    const types = SCENERY_MAP[track.id] || ['billboard'];
    // hScale and wRatio are multipliers on the base road-proportional sprite size.
    // hScale * wRatio must stay well under 2.28 to avoid overlapping the road edge.
    const SCALES = {
      building:  { h: 1.2, w: 0.7 },
      cactus:    { h: 1.0, w: 0.35 },
      tree:      { h: 1.2, w: 0.8 },
      palm:      { h: 1.4, w: 0.45 },
      billboard: { h: 0.8, w: 1.2 },
      boulder:   { h: 0.45, w: 0.8 },
      barn:      { h: 1.1, w: 0.9 },
    };
    segments.forEach((seg, i) => {
      if (i % 40 !== 0) return;
      // Each side independently at 55% probability — sparse, not wall-to-wall
      if (Math.random() < 0.55) {
        const lt = types[Math.floor(Math.random() * types.length)];
        const ls = SCALES[lt] || { h: 1.0, w: 0.8 };
        seg.staticSprites.push({ type: lt, lane: -(3.5 + Math.random() * 0.8), hScale: ls.h, wRatio: ls.w });
      }
      if (Math.random() < 0.55) {
        const rt = types[Math.floor(Math.random() * types.length)];
        const rs = SCALES[rt] || { h: 1.0, w: 0.8 };
        seg.staticSprites.push({ type: rt, lane:  (3.5 + Math.random() * 0.8), hScale: rs.h, wRatio: rs.w });
      }
    });
  }

  // ── Traffic ────────────────────────────────
  const TRACK_TRAFFIC = {
    route66:    ['Sport01','Comfort01','Highway01','OffRoad01'],
    pch:        ['Sport01','Sport02','Comfort01','OffRoad01'],
    tokyo:      ['Sport01','Sport02','Sport03','Comfort01'],
    la_freeway: ['Sport01','Sport02','Comfort01','Highway01'],
    monaco:     ['Sport02','Sport03','Comfort01'],
    swiss_alps: ['OffRoad01','OffRoad02','Comfort01'],
    dubai:      ['Sport02','Sport03','Comfort01'],
    fuji:       ['Sport01','Sport02','Sport03'],
    amalfi:     ['Sport01','Comfort01','OffRoad01'],
    baja:       ['OffRoad01','OffRoad02','Highway01'],
    autobahn:   ['Sport02','Sport03','Highway01','Comfort01'],
    nullarbor:  ['OffRoad01','OffRoad02','Highway01','Comfort01'],
  };

  // Speed ranges in mph / 100 (same units as playerSpeed).
  // Traffic moves at tc.speed * 90 * dt — identical scale to the player.
  // Sport cars can exceed slower player cars and will steer around them.
  const TRAFFIC_SPEEDS = {
    Highway01: { min: 0.70, max: 0.80 },   // big trucks  70–80 mph
    OffRoad01: { min: 0.78, max: 0.88 },   // off-road    78–88 mph
    OffRoad02: { min: 0.78, max: 0.90 },   // off-road    78–90 mph
    Comfort01: { min: 0.85, max: 0.98 },   // comfort     85–98 mph
    Sport01:   { min: 0.95, max: 1.10 },   // sport      95–110 mph
    Sport02:   { min: 1.00, max: 1.15 },   // sport     100–115 mph
    Sport03:   { min: 1.05, max: 1.20 },   // sport     105–120 mph
  };

  function _spawnTraffic(density) {
    trafficCars = [];
    const count = Math.floor(segments.length * density * 0.025);
    const pool  = (TRACK_TRAFFIC[track.id] || ['Sport01','Comfort01','Highway01'])
                    .map(id => ({ spriteId: id }));
    for (let i = 0; i < count; i++) {
      const carDef = pool[i % pool.length];
      const spd    = TRAFFIC_SPEEDS[carDef.spriteId] || { min: 0.55, max: 0.85 };
      const baseSpeed = spd.min + Math.random() * (spd.max - spd.min);
      trafficCars.push({
        _id:   i,
        z:     Math.floor(Math.random() * segments.length),
        x:     [-0.65, -0.32, 0.32, 0.65][Math.floor(Math.random() * 4)],
        speed: baseSpeed,
        _baseSpeed: baseSpeed,   // rubber-band adjusts around this
        _wasAhead: true,          // pass-detection: transition ahead→behind = pass
        car:   carDef,
        _hitCooldown: 0,
      });
    }
  }

  function _updateTraffic(dt) {
    // Reset per-frame traffic lists only on segments that had cars last frame.
    // Cleared on first population below for segments that will now have cars;
    // segments that had cars and no longer do still need to be emptied.
    for (let i = 0; i < _dirtyTrafficSegs.length; i++) {
      const s = _dirtyTrafficSegs[i];
      if (s && s.trafficSprites.length) s.trafficSprites.length = 0;
    }
    _dirtyTrafficSegs.length = 0;

    const L = segments.length;
    let nearestAhead = Infinity;
    let nearestAheadDx = 0;

    trafficCars.forEach(tc => {
      // ── Rubber-band AI: nudge traffic speed based on distance to player.
      // "Ahead" = in front within half a lap; if the leader is far ahead, slow
      // slightly so they remain catchable. "Behind" traffic speeds up a bit
      // so a sandbagging player can't lap the field trivially. Small effect —
      // clamps at ±8% of baseline.
      const dForward = (tc.z - playerZ + L) % L;
      const ahead = dForward > 0 && dForward < L / 2;
      if (ahead) {
        const lead = dForward / (L / 2);  // 0..1 (0 = right on top, 1 = half lap ahead)
        tc.speed = tc._baseSpeed * (1 - 0.08 * lead);
      } else {
        const trail = ((L - dForward) % L) / (L / 2);
        tc.speed = tc._baseSpeed * (1 + 0.08 * trail);
      }

      tc.z += tc.speed * 90 * dt;
      if (tc.z >= L) tc.z -= L;

      // ── Pass detection: traffic crosses from ahead-of-player to behind.
      // Using `isAhead` state against stored `_wasAhead` avoids counting a
      // pass multiple times when the car hovers near the boundary.
      const dNow = (tc.z - playerZ + L) % L;
      const isAhead = dNow > 0 && dNow < L / 2;
      if (tc._wasAhead && !isAhead) {
        combo++;
        comboTimer = 3.5;
        // Nitro refill: base +0.12, compounded by combo multiplier up to x4.
        const mult = Math.min(4, 1 + combo * 0.25);
        nitro = Math.min(1, nitro + 0.12 * mult);
        if (combo >= 2) UI.showMsg('PASS x' + combo, 700);
      }
      tc._wasAhead = isAhead;

      // Overtake avoidance — faster traffic closing from behind steers around.
      const tSeg = Math.floor(tc.z) % L;
      const pSeg = Math.floor(playerZ) % L;
      const behindP = ((pSeg - tSeg + L) % L) < 25;
      if (behindP && tc.speed > playerSpeed + 0.05 && Math.abs(tc.x - playerX) < 0.45) {
        const target = playerX >= 0 ? -0.65 : 0.65;
        tc.x += (target - tc.x) * Math.min(1, 3 * dt);
      }

      // Track nearest traffic car directly ahead of the player for draft check.
      if (isAhead && dNow < nearestAhead && Math.abs(tc.x - playerX) < 0.35) {
        nearestAhead = dNow;
        nearestAheadDx = Math.abs(tc.x - playerX);
      }

      const seg = segments[tSeg];
      const dist = dNow;
      if (seg) {
        seg.trafficSprites.push({ type: 'car', car: tc.car, lane: tc.x, zFrac: dist % 1 });
        _dirtyTrafficSegs.push(seg);
      }
    });

    // Drafting: tucked within 6 segments behind a traffic car, same lane-ish.
    drafting = (nearestAhead < 6 && nearestAheadDx < 0.30 && playerSpeed > 0.45);
  }
  // Segments touched by traffic last frame — scanned to reset trafficSprites
  // without iterating every segment every frame.
  const _dirtyTrafficSegs = [];

  // ── Race position (live re-rank each frame) ──
  // Rank = 1 + (traffic cars currently ahead within half a lap). This gives a
  // responsive HUD indicator that rises as the player overtakes traffic and
  // falls if traffic passes them.
  const _TOTAL_RACERS = 8;
  function _updatePosition() {
    if (!trafficCars.length) { position = 1; return; }
    const L = segments.length, half = L / 2;
    let ahead = 0;
    for (let i = 0; i < trafficCars.length; i++) {
      const d = ((trafficCars[i].z - playerZ) + L) % L;
      if (d > 0 && d < half) ahead++;
    }
    // Clamp into [1 .. _TOTAL_RACERS] so the HUD never shows P0 or P9+.
    const rank = Math.min(_TOTAL_RACERS, 1 + ahead);
    // Smooth toward target so position doesn't flicker on sprite-level passes.
    // Only show integer positions in the HUD — updateHUD rounds via |0.
    position += (rank - position) * 0.15;
  }

  // ── Haptics ──
  // navigator.vibrate is a no-op on desktops and on iOS Safari — guard so we
  // never block on missing API.
  function _haptic(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch(e) {} }
  }

  function _checkTrafficCollision(pSeg) {
    trafficCars.forEach(tc => {
      if (tc._hitCooldown > 0) { tc._hitCooldown--; return; }
      const tSeg = Math.floor(tc.z) % segments.length;
      // Only collide when traffic is ahead of player (player running into it).
      // Skip if traffic is overtaking from behind — avoidance logic handles that.
      const segDiff = (tSeg - pSeg + segments.length) % segments.length;
      const trafficAhead = segDiff < segments.length / 2;
      if (!trafficAhead || segDiff >= 4) return;
      if (Math.abs(tc.x - playerX) < 0.28) {
        const spdR   = playerMaxSpeed > 0 ? playerSpeed / playerMaxSpeed : 0;
        const resist = car.crashResistance || 1.0;
        // impact: how devastating the crash is — fast + fragile car = much higher
        const impact = (0.30 + 0.70 * spdR) / resist;
        playerSpeed      = Math.max(0.02, playerSpeed * (1 - impact * 0.28));
        crashTimer       = 0.8 + impact * 0.95;
        const bounce     = Math.min(1.0, (0.35 + spdR * 0.5) / resist);
        playerX         += (playerX > tc.x ? bounce : -bounce);
        playerX          = Math.max(-1.3, Math.min(1.3, playerX));
        tc._hitCooldown  = Math.min(120, Math.round(50 + impact * 20));
        shakeTime        = Math.max(shakeTime, 0.25 + impact * 0.20);
        damage           = Math.min(1, damage + 0.10 + impact * 0.18);
        combo = 0; comboTimer = 0;   // crash breaks the combo chain
        AudioFX.playCrash();
        _haptic(impact > 2.5 ? [40, 60, 120] : impact > 1.0 ? 90 : 40);
        const msg = impact > 2.5 ? 'BIG CRASH!' : impact > 1.0 ? 'CRASH!' : 'HIT!';
        const dur = impact > 2.5 ? 2000 : impact > 1.0 ? 1400 : 900;
        UI.showMsg(msg, dur);
      }
    });
  }

  // ── Hazards ────────────────────────────────
  // Stationary hazards (oil, potholes, debris, tires, cones, ice) only spawn
  // on tracks where the player is naturally slowed: off-road tracks with
  // dirtZones/iceZones, or bumper-to-bumper tracks (trafficDensity >= 0.60).
  // On fast highway tracks the player has no reaction time, so skip entirely.
  function _spawnHazards() {
    segments.forEach(s => { s.staticSprites.length = 0; });
    const hasOffroad = (track.dirtZones && track.dirtZones.length) ||
                       (track.iceZones  && track.iceZones.length);
    const heavyTraffic = (track.trafficDensity || 0) >= 0.60;
    if (!hasOffroad && !heavyTraffic) return;
    const types = track.hazards;
    segments.forEach(seg => {
      if (Math.random() > (track.hazardSpawnRate || 0.015)) return;
      const ht = types[Math.floor(Math.random() * types.length)];
      const lane = (Math.random() - 0.5) * 1.6;
      let st = null;
      if (ht === 'oil') st = 'oil';
      else if (ht === 'pothole') st = 'pothole';
      else if (ht.startsWith('debris')) st = Math.random() < 0.30 ? 'tire' : 'debris';
      else if (ht === 'ice') st = 'ice';
      else if (ht === 'barrier') st = 'cone';
      else if (ht === 'jump') st = 'debris';
      if (st) {
        const HAZARD_SCALES = {
          oil:     { hScale: 0.22, wRatio: 2.2 },
          pothole: { hScale: 0.20, wRatio: 1.5 },
          debris:  { hScale: 0.25, wRatio: 1.6 },
          tire:    { hScale: 0.35, wRatio: 1.10 },
          ice:     { hScale: 0.24, wRatio: 2.0 },
          cone:    { hScale: 0.38, wRatio: 0.60 },
        };
        const sc = HAZARD_SCALES[st] || {};
        seg.staticSprites.push({ type: st, lane, hScale: sc.hScale, wRatio: sc.wRatio });
      }
    });
  }

  // Only these sprite types produce a hazard effect; scenery and finish poles
  // share the staticSprites list but sit at |lane| >= 2.5 so they never enter
  // the drivable band anyway. Filter is a defence-in-depth guard.
  const _HAZARD_TYPES = new Set(['oil', 'pothole', 'debris', 'tire', 'ice', 'cone']);
  // Half-width scaled from each sprite's wRatio so wide tires get a wider
  // hitbox than a narrow cone. 0.18 is the base half-lane overlap threshold.
  function _checkHazardCollision(seg) {
    if (!seg) return;
    const list = seg.staticSprites;
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      if (!_HAZARD_TYPES.has(sp.type)) continue;
      const halfW = 0.18 * (sp.wRatio || 1);
      if (Math.abs(sp.lane - playerX) < halfW) _applyHazard(sp.type);
    }
  }

  function _applyHazard(type) {
    if (hazardEffect && hazardEffect.duration > 0.5) return;
    const spdR   = playerMaxSpeed > 0 ? playerSpeed / playerMaxSpeed : 0;
    const resist = car.crashResistance || 1.0;
    let e = { type, strength: 0, duration: 2 };
    switch (type) {
      case 'oil':
        e.strength = car.surfacePenalties.oil; e.duration = 2.5;
        playerX += (Math.random() - 0.5) * (0.3 + spdR * 0.3) / resist;
        UI.showMsg('OIL!', 800); break;
      case 'pothole': {
        const imp = (0.20 + 0.45 * spdR) / resist;
        e.strength = car.surfacePenalties.pothole; e.duration = 0.8;
        playerSpeed *= Math.max(0.05, 1 - car.surfacePenalties.pothole * imp * 1.2);
        UI.showMsg('POTHOLE!', 600); break;
      }
      case 'debris': {
        const imp = (0.15 + 0.40 * spdR) / resist;
        e.strength = 0.10 + imp * 0.14; e.duration = 0.8 + imp * 0.9;
        crashTimer = 0.3 + imp * 1.3;
        shakeTime  = Math.max(shakeTime, 0.20 + imp * 0.15);
        damage     = Math.min(1, damage + 0.06 + imp * 0.10);
        AudioFX.playCrash();
        _haptic(imp > 1.5 ? 80 : 30);
        UI.showMsg(imp > 1.5 ? 'DEBRIS IMPACT!' : 'DEBRIS!', imp > 1.5 ? 1200 : 800); break;
      }
      case 'tire': {
        const imp = (0.20 + 0.50 * spdR) / resist;
        e.strength = 0.12 + imp * 0.13; e.duration = 0.7 + imp * 0.8;
        crashTimer = 0.4 + imp * 1.1;
        shakeTime  = Math.max(shakeTime, 0.22 + imp * 0.18);
        damage     = Math.min(1, damage + 0.08 + imp * 0.12);
        playerX += (Math.random() - 0.5) * (0.30 + spdR * 0.40) / resist;
        playerX = Math.max(-1.3, Math.min(1.3, playerX));
        AudioFX.playCrash();
        _haptic(imp > 1.2 ? 100 : 40);
        UI.showMsg(imp > 1.2 ? 'TIRE IMPACT!' : 'LOOSE TIRE!', imp > 1.2 ? 1100 : 800); break;
      }
      case 'ice':
        e.strength = car.surfacePenalties.ice; e.duration = 3;
        UI.showMsg('ICE!', 1000); break;
      case 'cone': {
        const imp = (0.08 + 0.20 * spdR) / resist;
        e.strength = 0.08 + imp * 0.08; e.duration = 0.4 + imp * 0.5;
        crashTimer = 0.2 + imp * 0.7;
        UI.showMsg('CONE!', 600); break;
      }
    }
    const jb = car.surfacePenalties.jump;
    // Only 'debris' reaches here as a hazard type — 'jump' track hazards are
    // remapped to 'debris' sprites in _spawnHazards. Kept the jb switch so
    // per-car reactions still vary on debris impact.
    if (type === 'debris') {
      const spinForce = (0.4 + 0.6 * spdR) / resist;
      if (jb === 'spinout') {
        playerX += (Math.random()-0.5) * spinForce * 1.3;
        crashTimer = Math.max(crashTimer, 1.5 + spinForce * 1.8);
        AudioFX.playCrash();
        _haptic([60, 80, 160]);
        UI.showMsg('SPIN OUT!', 1500);
      } else if (jb === 'losecontrol') {
        playerX += (Math.random()-0.5) * spinForce * 0.65;
        crashTimer = Math.max(crashTimer, 0.8 + spinForce * 0.9);
      } else if (jb === 'bounce') {
        crashTimer = Math.max(crashTimer, 0.3 + spinForce * 0.25);
      }
    }
    hazardEffect = e;
  }

  // ── Finish ─────────────────────────────────
  function _finishQualify() {
    state = 'idle';
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    position = Math.max(1, Math.floor(Math.random() * 4) + 1);
    UI.showMsg('QUALIFIED!\nGRID POS ' + position);
    if (pendingRaceStart) clearTimeout(pendingRaceStart);

    if (track.cobraPrize) {
      // Always show Cobra prize screen before Autobahn race
      if (!CobraUnlock.isUnlocked()) CobraUnlock.unlock();
      const cobra = CARS.find(c => c.id === 'cobra');
      pendingRaceStart = setTimeout(() => {
        pendingRaceStart = null;
        UI.showCobraPrize(() => {
          UI.showScreen('game');
          UI.showMsg('RACE\nSTART!');
          startRace(cobra);
        });
      }, 2000);
    } else {
      pendingRaceStart = setTimeout(() => {
        pendingRaceStart = null;
        UI.showMsg('RACE\nSTART!'); startRace();
      }, 4000);
    }
  }

  function _finishRace() {
    state = 'idle'; finished = true;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (pendingRaceStart) { clearTimeout(pendingRaceStart); pendingRaceStart = null; }
    AudioFX.stopEngine(); AudioFX.stopMusic(); AudioFX.playCheckpoint();

    // markCompleted internally calls checkAndUnlock when the tier is done.
    // We detect whether a brand-new tier was unlocked by diffing the unlocked
    // list across the call — single source of truth, no duplicated logic.
    const beforeUnlocks = UnlockManager.getUnlocked().slice();
    UnlockManager.markCompleted(track.id);
    const afterUnlocks = UnlockManager.getUnlocked();
    const newUnlock = afterUnlocks.find(t => !beforeUnlocks.includes(t)) || null;

    UI.showResults({
      finished: true,
      trackId: track.id,
      trackName: track.name,
      carName: car.name + ' (' + car.color + ')',
      time: raceTime, position, totalCars: _TOTAL_RACERS,
      laps: lap - 1, totalLaps, newUnlock,
    });
  }

  // ── Keys ───────────────────────────────────
  // Gameplay-only listener. Nav keys live in ui.js so each module owns its
  // own concerns. Both fire on every keystroke but each checks its own state
  // guard, so there is no double-dispatch.
  function _isGameState() {
    return state === 'race' || state === 'qualify' || state === 'paused';
  }
  document.addEventListener('keydown', e => {
    if (!_isGameState()) return;
    keys[e.key] = true;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      togglePause();
    } else if ((e.key === 'r' || e.key === 'R') && state === 'paused') {
      restartRace();
    }
  });
  document.addEventListener('keyup', e => {
    if (!_isGameState()) return;
    keys[e.key] = false;
  });

  // ── Resize (debounced via rAF — iOS fires this continuously) ──
  let _resizePending = false;
  window.addEventListener('resize', () => {
    if (!canvas || state === 'idle' || _resizePending) return;
    _resizePending = true;
    requestAnimationFrame(() => {
      _resizePending = false;
      _sizeCanvas();
      if (typeof Renderer.invalidateSkyCache === 'function') {
        Renderer.invalidateSkyCache();
      }
    });
  });

  // ── Pause (shared between keyboard, on-screen button, and page hide) ──
  function togglePause() {
    if (state === 'race' || state === 'qualify') {
      pausedFromMode = state;
      state = 'paused';
      UI.showPauseOverlay(true);
      AudioFX.stopEngine();
    } else if (state === 'paused') {
      state = pausedFromMode || 'race';
      pausedFromMode = null;
      UI.showPauseOverlay(false);
      UI.clearMsg();
      AudioFX.startEngine();
    }
  }

  // ── Retry: restart the current qualify or race from the start without
  // leaving the track. Only reachable while paused or after a finish — avoids
  // accidental wipes mid-run on a stray keypress.
  function restartRace() {
    if (state !== 'paused' && !finished) return;
    if (!track || !car) return;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (pendingRaceStart) { clearTimeout(pendingRaceStart); pendingRaceStart = null; }
    hazardEffect = null; crashTimer = 0;
    for (const k in keys) keys[k] = false;
    AudioFX.stopEngine();
    UI.showPauseOverlay(false);
    UI.clearMsg();
    // If the user was mid-qualify, restart qualify. Otherwise it's a race.
    const mode = pausedFromMode || 'race';
    pausedFromMode = null;
    if (mode === 'qualify') {
      startQualify(track, car);
    } else {
      segments = Renderer.buildSegments(track);
      _spawnHazards();
      _addFinishLine();
      _spawnScenery();
      startRace();
    }
  }

  // Full quit back to track-select screen from pause menu. Tears down audio
  // and timers so a stale race can't run in the background.
  function quitToTracks() {
    if (state !== 'paused') return;
    state = 'idle'; finished = false; pausedFromMode = null;
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    if (pendingRaceStart) { clearTimeout(pendingRaceStart); pendingRaceStart = null; }
    AudioFX.stopEngine(); AudioFX.stopMusic();
    UI.showPauseOverlay(false);
    UI.clearMsg();
    UI.goToTrackSelect();
  }

  // Auto-pause when the tab is hidden — prevents ghost-driving if the user
  // switches apps mid-race. Audio module handles its own hidden cleanup.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (state === 'race' || state === 'qualify')) {
      togglePause();
    }
  });

  // HUD progress fraction for the lap-progress bar. In race mode returns the
  // cumulative fraction across all laps so the bar advances monotonically.
  // In qualify mode it's just the current lap progress (one lap to qualify).
  function getLapProgress() {
    if (!segments || !segments.length) return 0;
    const lapFrac = playerZ / segments.length;
    if (state === 'race' || (state === 'paused' && pausedFromMode === 'race')) {
      return Math.max(0, Math.min(1, ((lap - 1) + lapFrac) / totalLaps));
    }
    return Math.max(0, Math.min(1, lapFrac));
  }

  return { startQualify, startRace, togglePause, restartRace, quitToTracks, getLapProgress };
})();
