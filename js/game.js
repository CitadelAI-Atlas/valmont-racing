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
    // Easier starts on lower tiers — tier 1 = almost always 1st/2nd
    const tier = track.tier || 3;
    const maxPos = tier <= 1 ? 2 : tier <= 2 ? 4 : tier <= 3 ? 6 : 8;
    position = Math.floor(Math.random() * maxPos) + 1;

    _spawnTraffic(track.trafficDensity);
    _sizeCanvas();
    UI.clearMsg();
    _countdown('race');
    Audio.startMusic();
    Audio.startEngine();
  }

  // ── Countdown ──────────────────────────────
  function _countdown(mode) {
    countdown = 3;
    UI.showMsg(mode === 'qualify' ? 'COMPLETE ONE LAP TO QUALIFY' : 'READY...');
    if (mode === 'qualify') setTimeout(() => UI.showMsg('READY...'), 1200);
    Audio.playCountdown(countdown);

    if (animFrame) cancelAnimationFrame(animFrame);
    lastTs = 0;
    animFrame = requestAnimationFrame(ts => _loop(ts, mode));

    countdownTimer = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        UI.showMsg(countdown + '...');
        Audio.playCountdown(countdown);
      } else if (countdown === 0) {
        UI.showMsg('GO!');
        Audio.playCountdown(0);
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

    // ── Surface ──────────────────────────────
    const segIdx  = Math.floor(playerZ) % segments.length;
    const seg     = segments[segIdx];
    const surface = seg ? seg.surface : 'road';
    let surfPen   = _penalty(surface);
    if (hazardEffect) surfPen = Math.max(surfPen, hazardEffect.strength);

    // ── Speed ────────────────────────────────
    const maxSpd = playerMaxSpeed * (1 - surfPen);
    if (gas && !brake) {
      playerSpeed = Math.min(maxSpd, playerSpeed + 0.7 * car.acceleration / 100 * dt);
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
    if (playerZ >= segments.length) {
      playerZ -= segments.length;
      if (mode === 'race') {
        lap++;
        Audio.playCheckpoint();
        if (lap > totalLaps) { _finishRace(); return; }
        UI.showMsg('LAP ' + lap + '!', 1500);
      } else {
        _finishQualify(); return;
      }
    }

    // Qualify time scales with tier — beginners get more time
    const tierMult  = track.tier <= 1 ? 2.0 : track.tier <= 2 ? 1.5 : 1.2;
    const speedMult = 118 / car.topSpeed;   // slower cars get proportionally more time
    if (mode === 'qualify' && raceTime > track.qualifyTime * tierMult * speedMult) {
      UI.showMsg('TIME UP!');
      setTimeout(() => startRace(), 2000);
      state = 'idle'; return;
    }

    _checkTrafficCollision(segIdx);
    _checkHazardCollision(seg);
    _updateTraffic(dt);

    Audio.setEngineSpeed(playerSpeed);
    if (mode === 'race') {
      UI.updateHUD('race', { pos: position, time: raceTime, speed: speedMPH, lap, totalLaps });
    } else {
      UI.updateHUD('qualify', { time: raceTime, speed: speedMPH });
    }

    if (hazardEffect) {
      hazardEffect.duration -= dt;
      if (hazardEffect.duration <= 0) hazardEffect = null;
    }
  }

  function _draw() {
    if (!ctx || !canvas) return;
    const W = canvas._lw || canvas.width;
    const H = canvas._lh || canvas.height;
    Renderer.render(ctx, track, segments, playerZ, playerX, playerSpeed, W, H);
  }

  // ── Finish line ────────────────────────────
  function _addFinishLine() {
    // Mark first 4 segments as finish line (buildSegments already set isFinish,
    // but _spawnHazards clears sprites[] so poles must be re-added here)
    if (segments[0]) {
      segments[0].sprites.push({ type: 'finishpole', lane: -2.5, hScale: 1.8, wRatio: 0.6, flagDir: 1 });
      segments[0].sprites.push({ type: 'finishpole', lane:  2.5, hScale: 1.8, wRatio: 0.6, flagDir: -1 });
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
        seg.sprites.push({ type: lt, lane: -(3.5 + Math.random() * 0.8), hScale: ls.h, wRatio: ls.w });
      }
      if (Math.random() < 0.55) {
        const rt = types[Math.floor(Math.random() * types.length)];
        const rs = SCALES[rt] || { h: 1.0, w: 0.8 };
        seg.sprites.push({ type: rt, lane:  (3.5 + Math.random() * 0.8), hScale: rs.h, wRatio: rs.w });
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
      trafficCars.push({
        _id:   i,
        z:     Math.floor(Math.random() * segments.length),
        x:     [-0.65, -0.32, 0.32, 0.65][Math.floor(Math.random() * 4)],
        speed: spd.min + Math.random() * (spd.max - spd.min),
        car:   carDef,
        _hitCooldown: 0,
      });
    }
  }

  function _updateTraffic(dt) {
    segments.forEach(s => { s.sprites = s.sprites.filter(sp => sp.type !== 'car'); });
    trafficCars.forEach(tc => {
      tc.z += tc.speed * 90 * dt;
      if (tc.z >= segments.length) tc.z -= segments.length;

      // Overtake avoidance — if faster than player and closing from behind, steer around
      const tSeg = Math.floor(tc.z) % segments.length;
      const pSeg = Math.floor(playerZ)  % segments.length;
      const behind = ((pSeg - tSeg + segments.length) % segments.length) < 25;
      if (behind && tc.speed > playerSpeed + 0.05 && Math.abs(tc.x - playerX) < 0.45) {
        const target = playerX >= 0 ? -0.65 : 0.65;
        tc.x += (target - tc.x) * Math.min(1, 3 * dt);
      }

      const seg = segments[Math.floor(tc.z) % segments.length];
      // zFrac must be relative to playerZ so renderer interpolation stays accurate
      const dist = ((tc.z - playerZ) + segments.length) % segments.length;
      if (seg) seg.sprites.push({ type: 'car', car: tc.car, lane: tc.x, zFrac: dist % 1 });
    });
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
        Audio.playCrash();
        const msg = impact > 2.5 ? 'BIG CRASH!' : impact > 1.0 ? 'CRASH!' : 'HIT!';
        const dur = impact > 2.5 ? 2000 : impact > 1.0 ? 1400 : 900;
        UI.showMsg(msg, dur);
      }
    });
  }

  // ── Hazards ────────────────────────────────
  function _spawnHazards() {
    segments.forEach(s => { s.sprites = []; });
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
        seg.sprites.push({ type: st, lane, hScale: sc.hScale, wRatio: sc.wRatio });
      }
    });
  }

  function _checkHazardCollision(seg) {
    if (!seg) return;
    seg.sprites.forEach(sp => {
      if (sp.type === 'car') return;
      if (Math.abs(sp.lane - playerX) < 0.2) _applyHazard(sp.type);
    });
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
        Audio.playCrash();
        UI.showMsg(imp > 1.5 ? 'DEBRIS IMPACT!' : 'DEBRIS!', imp > 1.5 ? 1200 : 800); break;
      }
      case 'tire': {
        const imp = (0.20 + 0.50 * spdR) / resist;
        e.strength = 0.12 + imp * 0.13; e.duration = 0.7 + imp * 0.8;
        crashTimer = 0.4 + imp * 1.1;
        playerX += (Math.random() - 0.5) * (0.30 + spdR * 0.40) / resist;
        playerX = Math.max(-1.3, Math.min(1.3, playerX));
        Audio.playCrash();
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
    if (type === 'debris' || type === 'jump') {
      const spinForce = (0.4 + 0.6 * spdR) / resist;
      if (jb === 'spinout') {
        playerX += (Math.random()-0.5) * spinForce * 1.3;
        crashTimer = Math.max(crashTimer, 1.5 + spinForce * 1.8);
        Audio.playCrash(); UI.showMsg('SPIN OUT!', 1500);
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
    cancelAnimationFrame(animFrame);
    position = Math.max(1, Math.floor(Math.random() * 4) + 1);
    UI.showMsg('QUALIFIED!\nGRID POS ' + position);

    if (track.cobraPrize) {
      // Always show Cobra prize screen before Autobahn race
      if (!CobraUnlock.isUnlocked()) CobraUnlock.unlock();
      const cobra = CARS.find(c => c.id === 'cobra');
      setTimeout(() => {
        UI.showCobraPrize(() => {
          UI.showScreen('game');
          UI.showMsg('RACE\nSTART!');
          startRace(cobra);
        });
      }, 2000);
    } else {
      setTimeout(() => { UI.showMsg('RACE\nSTART!'); startRace(); }, 4000);
    }
  }

  function _finishRace() {
    state = 'idle'; finished = true;
    cancelAnimationFrame(animFrame);
    Audio.stopEngine(); Audio.stopMusic(); Audio.playCheckpoint();
    UnlockManager.markCompleted(track.id);

    const completed = UnlockManager.getCompleted();
    const tierTracks = TRACKS.filter(t => t.tier === track.tier);
    const allDone = tierTracks.every(t => completed.includes(t.id));
    const newUnlock = allDone && track.tier < 5 ? track.tier + 1 : null;

    UI.showResults({
      finished: true,
      trackId: track.id,
      trackName: track.name,
      carName: car.name + ' (' + car.color + ')',
      time: raceTime, position, totalCars: 8,
      laps: lap - 1, totalLaps, newUnlock,
    });
  }

  // ── Keys ───────────────────────────────────
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if ((e.key === 'Escape' || e.key === 'p') && (state === 'race' || state === 'qualify')) {
      if (state !== 'paused') { state = 'paused'; UI.showMsg('PAUSED'); }
      else { state = 'race'; UI.clearMsg(); }
    }
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  // Resize canvas on orientation change
  window.addEventListener('resize', () => { if (canvas && state !== 'idle') _sizeCanvas(); });

  return { startQualify, startRace };
})();
