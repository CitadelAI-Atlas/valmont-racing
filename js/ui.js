// ─────────────────────────────────────────────
//  UI — Mobile-first, portrait mode
// ─────────────────────────────────────────────

const UI = (() => {
  let currentScreen = 'title';
  let selectedCarIndex = 0;
  let selectedTrackIndex = 0;
  let carPage = 0; // 0 = standard, 1 = prize

  const screens = {
    title:       document.getElementById('screen-title'),
    carSelect:   document.getElementById('screen-car-select'),
    trackSelect: document.getElementById('screen-track-select'),
    game:        document.getElementById('screen-game'),
    cobraPrize:  document.getElementById('screen-cobra-prize'),
    results:     document.getElementById('screen-results'),
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    currentScreen = name;
  }

  // ── Touch driving controls ─────────────────
  window.TouchKeys = window.TouchKeys || new Map();

  // ── Car select ─────────────────────────────
  // Draw a side-view sprite filling the full canvas width, bottom-anchored.
  // Falls back to drawCarPixel if no sprite is loaded.
  function _drawSideSprite(ctx, car, W, H, fallbackCx, fallbackCy, fallbackScale) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    const sd = Sprites.get(car.id, 'side');
    if (sd) {
      const { img, crop } = sd;
      const s  = W / crop.w;
      const dw = W;
      const dh = Math.round(crop.h * s);
      ctx.imageSmoothingEnabled = false;  // pixel art — keep crisp
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h,
        0, H - dh, dw, dh);
    } else {
      drawCarPixel(ctx, car, fallbackCx, fallbackCy, fallbackScale);
    }
  }

  function _setCarPage(page) {
    carPage = page;
    document.getElementById('btn-page-standard').classList.toggle('active', page === 0);
    document.getElementById('btn-page-prize').classList.toggle('active', page === 1);
    buildCarGrid();
  }

  function buildCarGrid() {
    const grid = document.getElementById('car-grid');
    grid.innerHTML = '';

    if (carPage === 0) {
      // Standard cars — all non-hidden
      CARS.forEach((car, i) => {
        if (car.hidden) return;
        const card = document.createElement('div');
        card.className = 'car-card' + (i === selectedCarIndex ? ' selected' : '');
        const cvs = document.createElement('canvas');
        cvs.width = 480; cvs.height = 220;
        _drawSideSprite(cvs.getContext('2d'), car, 480, 220, 240, 148, 2.5);
        const lbl = document.createElement('div');
        const yr = document.createElement('div'); yr.textContent = car.year;
        const mk = document.createElement('div'); mk.textContent = car.make;
        lbl.appendChild(yr); lbl.appendChild(mk);
        card.appendChild(cvs); card.appendChild(lbl);
        card.addEventListener('click', () => { selectedCarIndex = i; buildCarGrid(); });
        grid.appendChild(card);
      });
    } else {
      // Prize cars — hidden cars + future locked slots
      const prizeCars = CARS.map((car, i) => ({ car, i })).filter(({ car }) => car.hidden);
      const cobraUnlocked = CobraUnlock.isUnlocked();

      // Per-car unlock rules: ferrari458 always available, cobra requires Autobahn qualify
      function _isCarUnlocked(car) {
        if (car.id === 'cobra') return cobraUnlocked;
        return true; // all other prize cars available by default
      }

      prizeCars.forEach(({ car, i }) => {
        const unlocked = _isCarUnlocked(car);
        const card = document.createElement('div');
        card.className = 'car-card' + (i === selectedCarIndex && unlocked ? ' selected' : '')
          + (unlocked ? '' : ' locked-slot');
        const cvs = document.createElement('canvas');
        cvs.width = 480; cvs.height = 220;
        if (unlocked) {
          _drawSideSprite(cvs.getContext('2d'), car, 480, 220, 240, 148, 2.5);
        } else {
          const c2 = cvs.getContext('2d');
          c2.fillStyle = '#0a0a0a'; c2.fillRect(0, 0, 480, 220);
          c2.fillStyle = '#222'; c2.font = 'bold 40px monospace';
          c2.textAlign = 'center'; c2.fillText('???', 240, 120);
        }
        const lbl = document.createElement('div');
        if (unlocked) {
          const yr = document.createElement('div'); yr.textContent = car.year;
          const mk = document.createElement('div'); mk.textContent = car.make;
          lbl.appendChild(yr); lbl.appendChild(mk);
        } else {
          lbl.textContent = 'LOCKED';
        }
        card.appendChild(cvs); card.appendChild(lbl);
        if (unlocked) {
          card.addEventListener('click', () => { selectedCarIndex = i; buildCarGrid(); });
        }
        grid.appendChild(card);
      });

      // Future locked placeholder slots (fill to at least 3 cards)
      const slots = Math.max(0, 3 - prizeCars.length);
      for (let s = 0; s < slots; s++) {
        const card = document.createElement('div');
        card.className = 'car-card locked-slot';
        const cvs = document.createElement('canvas');
        cvs.width = 480; cvs.height = 220;
        const c2 = cvs.getContext('2d');
        c2.fillStyle = '#0a0a0a'; c2.fillRect(0, 0, 480, 220);
        c2.fillStyle = '#1a1a1a'; c2.font = 'bold 40px monospace';
        c2.textAlign = 'center'; c2.fillText('???', 240, 120);
        const lbl = document.createElement('div'); lbl.textContent = 'COMING SOON';
        card.appendChild(cvs); card.appendChild(lbl);
        grid.appendChild(card);
      }

      // If selected car isn't a prize car or isn't unlocked, fall back to detail of first unlocked prize car
      const selectedPrize = prizeCars.find(({ i }) => i === selectedCarIndex);
      if (!selectedPrize || !_isCarUnlocked(selectedPrize.car)) {
        const firstUnlocked = prizeCars.find(({ car }) => _isCarUnlocked(car));
        if (firstUnlocked) selectedCarIndex = firstUnlocked.i;
        _updateCarDetail(); return;
      }
    }
    _updateCarDetail();
  }

  function _updateCarDetail() {
    const car = CARS[selectedCarIndex];
    document.getElementById('car-name').textContent = car.name;
    document.getElementById('car-desc').textContent = car.description;

    const s = document.getElementById('car-stats');
    s.innerHTML =
      'SPEED:    ' + _bar(car.topSpeed) + '<br>' +
      'ACCEL:    ' + _bar(car.acceleration) + '<br>' +
      'HANDLING: ' + _bar(car.handling) + '<br>' +
      'OFF-ROAD: ' + _offRoad(car);

    const pvs = document.getElementById('car-preview');
    // Size canvas to match sprite's natural aspect ratio so nothing is clipped
    const sd = Sprites.get(car.id, 'side');
    pvs.height = sd ? Math.round(sd.crop.h * (pvs.width / sd.crop.w)) : 220;
    _drawSideSprite(pvs.getContext('2d'), car, pvs.width, pvs.height,
      Math.round(pvs.width / 2), Math.round(pvs.height * 0.67), 2.8);
  }

  function _bar(v) {
    const f = Math.min(10, Math.max(0, Math.round(v / 10)));
    return '█'.repeat(f) + '░'.repeat(10 - f);
  }
  function _offRoad(car) {
    const p = car.surfacePenalties.dirt;
    if (p === 0)    return '██████████ BEAST';
    if (p <= 0.12)  return '████████░░ GREAT';
    if (p <= 0.30)  return '█████░░░░░ OK';
    if (p <= 0.40)  return '███░░░░░░░ POOR';
    return               '█░░░░░░░░░ AVOID';
  }

  // ── Track select ───────────────────────────
  const TIER_LABELS = ['', 'BEGINNER', 'INTER.', 'ADVANCED', 'EXPERT', 'MASTER'];

  function buildTrackGrid() {
    const grid = document.getElementById('track-grid');
    grid.innerHTML = '';
    const completed = UnlockManager.getCompleted();

    TRACKS.forEach((track, i) => {
      const ok = UnlockManager.isTrackUnlocked(track);
      const done = completed.includes(track.id);

      const card = document.createElement('div');
      card.className = 'track-card tier-' + track.tier +
        (i === selectedTrackIndex ? ' selected' : '') +
        (ok ? '' : ' locked');

      const badge = document.createElement('span');
      badge.className = 'tier-badge';
      badge.textContent = TIER_LABELS[track.tier];

      card.appendChild(badge);
      card.appendChild(document.createTextNode(track.name));

      if (done) {
        const d = document.createElement('div');
        d.style.cssText = 'font-size:5px;color:#0f0;margin-top:2px;';
        d.textContent = '✓ DONE';
        card.appendChild(d);
      }
      if (!ok) {
        const l = document.createElement('div');
        l.style.cssText = 'font-size:5px;color:#444;margin-top:2px;';
        l.textContent = 'LOCKED';
        card.appendChild(l);
      }

      if (ok) {
        card.addEventListener('click', () => {
          selectedTrackIndex = i;
          buildTrackGrid();
        });
      }
      grid.appendChild(card);
    });
    _updateTrackDetail();
  }

  function _updateTrackDetail() {
    const t = TRACKS[selectedTrackIndex];
    document.getElementById('track-name').textContent = t.name;
    document.getElementById('track-desc').textContent = t.description;
    document.getElementById('track-hazards').textContent = 'HAZARDS: ' + t.hazards.join(', ').toUpperCase();

    const entries = Leaderboard.getTrack(t.id);
    const MEDALS  = ['★', '②', '③', '④', '⑤'];
    const COLORS  = ['#ffd700', '#c0c0c0', '#cd7f32', '#888', '#666'];

    let lbHtml = '';
    if (entries.length) {
      lbHtml = '<span style="color:#555;font-size:min(1.8vw,6px)">── BEST TIMES ──</span>';
      entries.forEach((e, i) => {
        const col = COLORS[i];
        const name = e.name || 'RACER';
        lbHtml +=
          '<div class="lb-entry">' +
            '<div class="lb-line1" style="color:' + col + '">' +
              MEDALS[i] + ' ' + name + '&nbsp;&nbsp;' + _fmtTime(e.time) +
            '</div>' +
            '<div class="lb-line2">' + e.car + '&nbsp;&nbsp;' + (e.date || '') + '</div>' +
          '</div>';
      });
    } else {
      lbHtml = '<span style="color:#333;font-size:min(1.8vw,6px)">NO TIMES YET</span>';
    }
    document.getElementById('track-leaderboard').innerHTML = lbHtml;
  }

  function _goRace() {
    const t = TRACKS[selectedTrackIndex];
    if (UnlockManager.isTrackUnlocked(t)) {
      window._selectedCar = CARS[selectedCarIndex];
      window._selectedTrack = t;
      Game.startQualify(t, CARS[selectedCarIndex]);
    }
  }

  // ── Results ────────────────────────────────
  let _resultsTimer = null;
  let _pendingResult = null;   // held until name is saved

  function _goToTrackSelect() {
    if (_resultsTimer) { clearTimeout(_resultsTimer); _resultsTimer = null; }
    buildTrackGrid();
    showScreen('trackSelect');
  }

  function _saveAndAdvance() {
    if (!_pendingResult) { _goToTrackSelect(); return; }
    const name = (document.getElementById('player-name-input').value.trim() || 'RACER').toUpperCase();
    const d = _pendingResult;
    _pendingResult = null;
    Leaderboard.record(d.trackId, { name, car: d.carName, time: d.time, pos: d.position });
    document.getElementById('name-entry-row').style.display = 'none';
    document.getElementById('results-body').innerHTML +=
      '<br><span style="color:#0ff">SCORE SAVED — ' + name + '</span>' +
      '<br><span style="font-size:min(1.8vw,6px);color:#444;">RETURNING TO TRACKS...</span>';
    if (_resultsTimer) clearTimeout(_resultsTimer);
    _resultsTimer = setTimeout(_goToTrackSelect, 2500);
  }

  function showResults(data) {
    document.getElementById('results-title').textContent =
      data.finished ? 'RACE COMPLETE!' : 'TIME EXPIRED';

    const pts = Leaderboard.getTotalPoints();
    document.getElementById('results-body').innerHTML =
      'TRACK: <span class="highlight">' + data.trackName + '</span><br>' +
      'CAR:   <span class="highlight">' + data.carName + '</span><br>' +
      'TIME:  <span class="highlight">' + _fmtTime(data.time) + '</span><br>' +
      'POS:   <span class="highlight">' + data.position + '/' + data.totalCars + '</span><br>' +
      'LAPS:  <span class="highlight">' + data.laps + '/' + data.totalLaps + '</span>' +
      (data.newUnlock ? '<br><br><span class="highlight">★ TIER ' + data.newUnlock + ' UNLOCKED! ★</span>' : '') +
      '<br><span style="color:#f80">TOTAL POINTS: ' + pts + '</span>';

    const nameRow = document.getElementById('name-entry-row');
    const nameInput = document.getElementById('player-name-input');

    if (data.finished && data.trackId) {
      _pendingResult = data;
      nameInput.value = '';
      nameRow.style.display = 'flex';
      // Auto-save after 10s if player doesn't act
      if (_resultsTimer) clearTimeout(_resultsTimer);
      _resultsTimer = setTimeout(_saveAndAdvance, 10000);
    } else {
      _pendingResult = null;
      nameRow.style.display = 'none';
      if (_resultsTimer) clearTimeout(_resultsTimer);
      _resultsTimer = setTimeout(_goToTrackSelect, 4000);
    }

    showScreen('results');
  }

  function _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ── HUD ────────────────────────────────────
  function updateHUD(mode, data) {
    const l = document.getElementById('hud-left');
    const c = document.getElementById('hud-center');
    const r = document.getElementById('hud-right');
    if (mode === 'qualify') {
      l.textContent = 'QUALIFY';
      c.textContent = _fmtTime(data.time);
      r.textContent = Math.round(data.speed) + ' MPH';
    } else {
      l.textContent = 'P' + data.pos + ' LAP ' + data.lap + '/' + data.totalLaps;
      c.textContent = _fmtTime(data.time);
      r.textContent = Math.round(data.speed) + ' MPH';
    }
  }

  function showMsg(msg, duration) {
    const el = document.getElementById('game-msg');
    el.textContent = msg;
    if (duration) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, duration);
  }

  function clearMsg() { document.getElementById('game-msg').textContent = ''; }

  // ── Nav button wiring ──────────────────────
  document.getElementById('btn-start').addEventListener('click', () => {
    Audio.resume();
    buildCarGrid();
    showScreen('carSelect');
  });

  document.getElementById('btn-page-standard').addEventListener('click', () => _setCarPage(0));
  document.getElementById('btn-page-prize').addEventListener('click', () => _setCarPage(1));

  document.getElementById('btn-car-confirm').addEventListener('click', () => {
    window._selectedCar = CARS[selectedCarIndex];
    buildTrackGrid();
    showScreen('trackSelect');
  });

  document.getElementById('btn-race').addEventListener('click', () => { _goRace(); });

  document.getElementById('btn-back-car').addEventListener('click', () => {
    carPage = 0;
    document.getElementById('btn-page-standard').classList.add('active');
    document.getElementById('btn-page-prize').classList.remove('active');
    buildCarGrid();
    showScreen('carSelect');
  });

  document.getElementById('btn-save-score').addEventListener('click', _saveAndAdvance);

  // Enter key submits name
  document.getElementById('player-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); _saveAndAdvance(); }
  });

  document.getElementById('btn-continue').addEventListener('click', () => {
    _pendingResult = null;
    _goToTrackSelect();
    buildTrackGrid();
    showScreen('trackSelect');
  });

  // ── Single multi-touch overlay ─────────────
  // One element handles ALL touches so left+right thumb work simultaneously.
  // Left half  of overlay = gas (top) / brake (bottom)
  // Right half of overlay = steer left (25%) / steer right (25%)
  (function _wireOverlay() {
    const el = document.getElementById('touch-overlay');
    if (!el) return;

    const _zGas   = document.getElementById('zone-gas');
    const _zBrake = document.getElementById('zone-brake');
    const _zLeft  = document.getElementById('zone-left');
    const _zRight = document.getElementById('zone-right');

    function _setActive(gas, brake, left, right) {
      _zGas  ?.classList.toggle('active', gas);
      _zBrake?.classList.toggle('active', brake);
      _zLeft ?.classList.toggle('active', left);
      _zRight?.classList.toggle('active', right);
    }

    function _applyTouches(touches) {
      let gas = false, brake = false, left = false, right = false;
      const r = el.getBoundingClientRect();
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        const relX = (t.clientX - r.left) / r.width;
        const relY = (t.clientY - r.top)  / r.height;
        if (relX < 0.5) {
          // Left zone: top half = gas, bottom half = brake
          if (relY < 0.5) gas   = true;
          else             brake = true;
        } else {
          // Right zone: left quarter = steer left, right quarter = steer right
          if (relX < 0.75) left  = true;
          else              right = true;
        }
      }
      TouchKeys.set('ArrowUp',    gas);
      TouchKeys.set('ArrowDown',  brake);
      TouchKeys.set('ArrowLeft',  left);
      TouchKeys.set('ArrowRight', right);
      _setActive(gas, brake, left, right);
    }

    function _clearAll() {
      TouchKeys.set('ArrowUp', false); TouchKeys.set('ArrowDown', false);
      TouchKeys.set('ArrowLeft', false); TouchKeys.set('ArrowRight', false);
      _setActive(false, false, false, false);
    }

    el.addEventListener('touchstart',  e => { e.preventDefault(); _applyTouches(e.touches); }, { passive: false });
    el.addEventListener('touchmove',   e => { e.preventDefault(); _applyTouches(e.touches); }, { passive: false });
    el.addEventListener('touchend',    e => { e.preventDefault(); _applyTouches(e.touches); }, { passive: false });
    el.addEventListener('touchcancel', e => { e.preventDefault(); _clearAll(); },              { passive: false });

    // Mouse fallback for desktop testing
    let _mx = 0, _my = 0, _mdown = false;
    el.addEventListener('mousedown', e => {
      _mdown = true; _mx = e.clientX; _my = e.clientY;
      _applyTouches([{ clientX: _mx, clientY: _my }]);
    });
    el.addEventListener('mousemove', e => {
      if (!_mdown) return;
      _mx = e.clientX; _my = e.clientY;
      _applyTouches([{ clientX: _mx, clientY: _my }]);
    });
    el.addEventListener('mouseup',    () => { _mdown = false; _clearAll(); });
    el.addEventListener('mouseleave', () => { _mdown = false; _clearAll(); });
  })();

  // ── Keyboard fallback (desktop) ────────────
  document.addEventListener('keydown', e => {
    Audio.resume();
    if (currentScreen === 'title' && e.key === 'Enter') {
      buildCarGrid(); showScreen('carSelect');
    } else if (currentScreen === 'carSelect') {
      if (e.key === 'ArrowRight') { selectedCarIndex = (selectedCarIndex + 1) % CARS.length; buildCarGrid(); }
      else if (e.key === 'ArrowLeft') { selectedCarIndex = (selectedCarIndex - 1 + CARS.length) % CARS.length; buildCarGrid(); }
      else if (e.key === 'Enter') { window._selectedCar = CARS[selectedCarIndex]; buildTrackGrid(); showScreen('trackSelect'); }
    } else if (currentScreen === 'trackSelect') {
      const len = TRACKS.length;
      if (e.key === 'ArrowRight') selectedTrackIndex = (selectedTrackIndex + 1) % len;
      else if (e.key === 'ArrowLeft') selectedTrackIndex = (selectedTrackIndex - 1 + len) % len;
      else if (e.key === 'ArrowDown') selectedTrackIndex = Math.min(len - 1, selectedTrackIndex + 2);
      else if (e.key === 'ArrowUp') selectedTrackIndex = Math.max(0, selectedTrackIndex - 2);
      else if (e.key === 'Enter') { _goRace(); return; }
      else if (e.key === 'Escape') { buildCarGrid(); showScreen('carSelect'); return; }
      buildTrackGrid();
    } else if (currentScreen === 'results' && e.key === 'Enter') {
      buildTrackGrid(); showScreen('trackSelect');
    }
    if (e.key === 'm' || e.key === 'M') Audio.toggle();
  });

  // ── Cobra prize screen ─────────────────────
  let _cobraCallback = null;
  document.getElementById('btn-cobra-race').addEventListener('click', () => {
    if (_cobraCallback) { const cb = _cobraCallback; _cobraCallback = null; cb(); }
  });

  function showCobraPrize(onRace) {
    _cobraCallback = onRace;
    showScreen('cobraPrize');
  }

  return { showScreen, showResults, showCobraPrize, updateHUD, showMsg, clearMsg };
})();
