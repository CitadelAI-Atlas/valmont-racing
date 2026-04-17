// ─────────────────────────────────────────────
//  UI — Mobile-first, portrait mode
// ─────────────────────────────────────────────

const UI = (() => {
  let currentScreen = 'title';
  let selectedCarIndex = 1; // SL550 is index 1 (ferrari at 0 is prize-only)
  let selectedTrackIndex = 0;
  let carPage = 0; // 0 = standard (Drye Family), 1 = unlocks

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
    if (name === 'title') _refreshTitleTrophy();
  }

  // ── Touch driving controls ─────────────────
  window.TouchKeys = window.TouchKeys || new Map();

  // ── Car select ─────────────────────────────
  // Cache card canvases so selecting a different car doesn't redraw every
  // tile. Keyed on car.id; invalidated only if the sprite loads late.
  const _cardCache = new Map();
  function _getCardCanvas(car) {
    const cached = _cardCache.get(car.id);
    if (cached) return cached;
    const cvs = document.createElement('canvas');
    cvs.width = 480; cvs.height = 220;
    _drawSideSprite(cvs.getContext('2d'), car, 480, 220, 240, 148, 2.5);
    _cardCache.set(car.id, cvs);
    return cvs;
  }

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
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h,
        0, H - dh, dw, dh);
    } else {
      drawCarPixel(ctx, car, fallbackCx, fallbackCy, fallbackScale);
    }
  }

  function _setCarPage(page) {
    carPage = page;
    const tabS = document.getElementById('btn-page-standard');
    const tabP = document.getElementById('btn-page-prize');
    tabS.classList.toggle('active', page === 0);
    tabP.classList.toggle('active', page === 1);
    tabS.setAttribute('aria-selected', page === 0);
    tabP.setAttribute('aria-selected', page === 1);
    buildCarGrid();
  }

  // Stable DOM: cards are built once per page and kept. Selection changes
  // only toggle the .selected class rather than rebuilding the grid. Rebuild
  // only happens when page switches or progress is reset.
  let _carCards = [];

  function _buildCarCard(car, i, unlocked) {
    const card = document.createElement('div');
    card.className = 'car-card'
      + (unlocked ? '' : ' locked-slot');
    if (unlocked) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', car.name);

      const cached = _getCardCanvas(car);
      const cvs = document.createElement('canvas');
      cvs.width = cached.width; cvs.height = cached.height;
      cvs.getContext('2d').drawImage(cached, 0, 0);
      card.appendChild(cvs);

      const lbl = document.createElement('div');
      const yr = document.createElement('div'); yr.textContent = car.year;
      const mk = document.createElement('div'); mk.textContent = car.make;
      lbl.appendChild(yr); lbl.appendChild(mk);
      card.appendChild(lbl);

      const select = () => { _selectCar(i); };
      card.addEventListener('click', select);
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    } else {
      const cvs = document.createElement('canvas');
      cvs.width = 480; cvs.height = 220;
      const c2 = cvs.getContext('2d');
      c2.fillStyle = '#0a0a0a'; c2.fillRect(0, 0, 480, 220);
      c2.fillStyle = '#222'; c2.font = 'bold 40px monospace';
      c2.textAlign = 'center'; c2.fillText('???', 240, 120);
      card.appendChild(cvs);
      const lbl = document.createElement('div'); lbl.textContent = 'LOCKED';
      card.appendChild(lbl);
    }
    return card;
  }

  function _selectCar(i) {
    selectedCarIndex = i;
    _carCards.forEach(entry => {
      entry.card.classList.toggle('selected', entry.index === i);
    });
    _updateCarDetail();
  }

  function buildCarGrid() {
    const grid = document.getElementById('car-grid');
    grid.textContent = '';
    _carCards = [];

    if (carPage === 0) {
      CARS.forEach((car, i) => {
        if (car.hidden) return;
        const card = _buildCarCard(car, i, true);
        if (i === selectedCarIndex) card.classList.add('selected');
        grid.appendChild(card);
        _carCards.push({ card, index: i });
      });
    } else {
      const prizeCars = CARS.map((car, i) => ({ car, i })).filter(({ car }) => car.hidden);
      const cobraUnlocked = CobraUnlock.isUnlocked();

      function _isCarUnlocked(car) {
        if (car.id === 'cobra') return cobraUnlocked;
        return true;
      }

      prizeCars.forEach(({ car, i }) => {
        const unlocked = _isCarUnlocked(car);
        const card = _buildCarCard(car, i, unlocked);
        if (unlocked && i === selectedCarIndex) card.classList.add('selected');
        grid.appendChild(card);
        if (unlocked) _carCards.push({ card, index: i });
      });

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

      const selectedPrize = prizeCars.find(({ i }) => i === selectedCarIndex);
      if (!selectedPrize || !_isCarUnlocked(selectedPrize.car)) {
        const firstUnlocked = prizeCars.find(({ car }) => _isCarUnlocked(car));
        if (firstUnlocked) selectedCarIndex = firstUnlocked.i;
      }
    }
    _updateCarDetail();
  }

  function _updateCarDetail() {
    const car = CARS[selectedCarIndex];
    document.getElementById('car-name').textContent = car.name;
    document.getElementById('car-desc').textContent = car.description;

    // Stats row uses static labels + sanitized bar graphics — safe to keep
    // innerHTML since _bar / _offRoad only emit block/shade glyphs.
    const s = document.getElementById('car-stats');
    s.innerHTML =
      'SPEED:    ' + _bar(car.topSpeed) + '<br>' +
      'ACCEL:    ' + _bar(car.acceleration) + '<br>' +
      'HANDLING: ' + _bar(car.handling) + '<br>' +
      'OFF-ROAD: ' + _offRoad(car);

    const pvs = document.getElementById('car-preview');
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

  // Tiny track thumbnail (cached) — one sky color + one ground band.
  // Keeps each track card visually distinct at a glance.
  const _thumbCache = new Map();
  function _trackThumb(track) {
    const cached = _thumbCache.get(track.id);
    if (cached) return cached;
    const W = 64, H = 28;
    const cvs = document.createElement('canvas');
    cvs.width = W; cvs.height = H;
    const c = cvs.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, H * 0.55);
    sky.addColorStop(0, track.skyColor);
    sky.addColorStop(1, track.skyColor);
    c.fillStyle = sky; c.fillRect(0, 0, W, H * 0.55);
    c.fillStyle = track.groundColor || '#444';
    c.fillRect(0, H * 0.55, W, H * 0.45);
    c.fillStyle = track.roadColor || '#333';
    c.beginPath();
    c.moveTo(W * 0.45, H * 0.55);
    c.lineTo(W * 0.55, H * 0.55);
    c.lineTo(W * 0.80, H);
    c.lineTo(W * 0.20, H);
    c.closePath(); c.fill();
    c.fillStyle = track.lineColor || '#fff';
    c.fillRect(W * 0.495, H * 0.64, 1, 2);
    c.fillRect(W * 0.495, H * 0.78, 1.5, 2.5);
    c.fillRect(W * 0.495, H * 0.92, 2, 3);
    _thumbCache.set(track.id, cvs);
    return cvs;
  }

  function buildTrackGrid() {
    const grid = document.getElementById('track-grid');
    grid.textContent = '';
    const completed = UnlockManager.getCompleted();

    TRACKS.forEach((track, i) => {
      const ok = UnlockManager.isTrackUnlocked(track);
      const done = completed.includes(track.id);

      const card = document.createElement('div');
      card.className = 'track-card tier-' + track.tier +
        (i === selectedTrackIndex ? ' selected' : '') +
        (ok ? '' : ' locked');
      if (ok) {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', track.name + ' — tier ' + track.tier);
      } else {
        card.setAttribute('aria-label', track.name + ' — locked');
      }

      const badge = document.createElement('span');
      badge.className = 'tier-badge';
      badge.textContent = TIER_LABELS[track.tier];
      card.appendChild(badge);

      const thumb = _trackThumb(track);
      const img = document.createElement('canvas');
      img.className = 'track-thumb';
      img.width = thumb.width; img.height = thumb.height;
      img.getContext('2d').drawImage(thumb, 0, 0);
      card.appendChild(img);

      card.appendChild(document.createTextNode(track.name));

      if (done) {
        const d = document.createElement('div');
        d.className = 'done-badge';
        d.textContent = '✓ DONE';
        card.appendChild(d);
      }
      if (!ok) {
        const l = document.createElement('div');
        l.className = 'locked-badge';
        l.textContent = 'LOCKED';
        card.appendChild(l);
      }

      if (ok) {
        const pick = () => { selectedTrackIndex = i; buildTrackGrid(); };
        card.addEventListener('click', pick);
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });
      }
      grid.appendChild(card);
    });
    _updateTrackDetail();
  }

  // Build a leaderboard entry row from trusted + user data using DOM APIs.
  // Critical: `entry.name` is user-supplied and could contain markup. Every
  // user-sourced value is inserted via textContent.
  function _buildLbEntry(entry, medal, color) {
    const row = document.createElement('div');
    row.className = 'lb-entry';

    const l1 = document.createElement('div');
    l1.className = 'lb-line1';
    l1.style.color = color;
    l1.textContent = medal + ' ' + (entry.name || 'RACER') + '  ' + _fmtTime(entry.time);
    row.appendChild(l1);

    const l2 = document.createElement('div');
    l2.className = 'lb-line2';
    l2.textContent = (entry.car || '') + '  ' + (entry.date || '');
    row.appendChild(l2);

    return row;
  }

  function _updateTrackDetail() {
    const t = TRACKS[selectedTrackIndex];
    document.getElementById('track-name').textContent = t.name;
    document.getElementById('track-desc').textContent = t.description;
    document.getElementById('track-hazards').textContent = 'HAZARDS: ' + t.hazards.join(', ').toUpperCase();

    const entries = Leaderboard.getTrack(t.id);
    const MEDALS  = ['★', '②', '③', '④', '⑤'];
    const COLORS  = ['#ffd700', '#c0c0c0', '#cd7f32', '#888', '#666'];

    const lb = document.getElementById('track-leaderboard');
    lb.textContent = '';
    if (entries.length) {
      const head = document.createElement('span');
      head.className = 'lb-head';
      head.textContent = '── BEST TIMES ──';
      lb.appendChild(head);
      entries.forEach((e, i) => {
        lb.appendChild(_buildLbEntry(e, MEDALS[i], COLORS[i]));
      });
    } else {
      const empty = document.createElement('span');
      empty.className = 'lb-empty';
      empty.textContent = 'NO TIMES YET';
      lb.appendChild(empty);
    }
  }

  function _goRace() {
    const t = TRACKS[selectedTrackIndex];
    if (UnlockManager.isTrackUnlocked(t)) {
      window._selectedCar = CARS[selectedCarIndex];
      window._selectedTrack = t;
      Game.startQualify(t, CARS[selectedCarIndex]);
    }
  }

  function goToTrackSelect() {
    if (_resultsTimer) { clearTimeout(_resultsTimer); _resultsTimer = null; }
    buildTrackGrid();
    showScreen('trackSelect');
  }

  // ── Results ────────────────────────────────
  let _resultsTimer = null;
  let _pendingResult = null;

  function _saveAndAdvance() {
    if (!_pendingResult) { goToTrackSelect(); return; }
    const name = (document.getElementById('player-name-input').value.trim() || 'RACER').toUpperCase();
    const d = _pendingResult;
    _pendingResult = null;
    Leaderboard.record(d.trackId, { name, car: d.carName, time: d.time, pos: d.position });
    document.getElementById('name-entry-row').style.display = 'none';

    const body = document.getElementById('results-body');
    body.appendChild(document.createElement('br'));
    const saved = document.createElement('span');
    saved.className = 'saved-msg';
    saved.textContent = 'SCORE SAVED — ' + name;
    body.appendChild(saved);
    body.appendChild(document.createElement('br'));
    const back = document.createElement('span');
    back.className = 'results-footer';
    back.textContent = 'RETURNING TO TRACKS...';
    body.appendChild(back);

    if (_resultsTimer) clearTimeout(_resultsTimer);
    _resultsTimer = setTimeout(goToTrackSelect, 2500);
  }

  // Build the results body using DOM so user-sourced values (carName) never
  // touch innerHTML. trackName / tierNumber are from config but running it
  // all through the same builder keeps one code path.
  function _buildResultsBody(data) {
    const body = document.getElementById('results-body');
    body.textContent = '';

    function _line(label, value, color) {
      const line = document.createElement('div');
      line.appendChild(document.createTextNode(label));
      const v = document.createElement('span');
      v.className = 'highlight';
      if (color) v.style.color = color;
      v.textContent = value;
      line.appendChild(v);
      body.appendChild(line);
    }

    _line('TRACK: ', data.trackName);
    _line('CAR:   ', data.carName);
    _line('TIME:  ', _fmtTime(data.time));
    _line('POS:   ', data.position + '/' + data.totalCars);
    _line('LAPS:  ', data.laps + '/' + data.totalLaps);

    if (data.newUnlock) {
      body.appendChild(document.createElement('br'));
      const unlock = document.createElement('span');
      unlock.className = 'highlight';
      unlock.textContent = '★ TIER ' + data.newUnlock + ' UNLOCKED! ★';
      body.appendChild(unlock);
    }

    if (UnlockManager.isAllComplete && UnlockManager.isAllComplete()) {
      body.appendChild(document.createElement('br'));
      const done = document.createElement('span');
      done.className = 'highlight all-done';
      done.textContent = '★ ALL TRACKS CLEARED! ★';
      body.appendChild(done);
    }

    body.appendChild(document.createElement('br'));
    const pts = Leaderboard.getTotalPoints();
    const p = document.createElement('span');
    p.className = 'total-points';
    p.textContent = 'TOTAL POINTS: ' + pts;
    body.appendChild(p);
  }

  function showResults(data) {
    document.getElementById('results-title').textContent =
      data.finished ? 'RACE COMPLETE!' : 'TIME EXPIRED';

    _buildResultsBody(data);

    const nameRow = document.getElementById('name-entry-row');
    const nameInput = document.getElementById('player-name-input');

    if (data.finished && data.trackId) {
      _pendingResult = data;
      nameInput.value = '';
      nameRow.style.display = 'flex';
      if (_resultsTimer) clearTimeout(_resultsTimer);
      _resultsTimer = setTimeout(_saveAndAdvance, 10000);
    } else {
      _pendingResult = null;
      nameRow.style.display = 'none';
      if (_resultsTimer) clearTimeout(_resultsTimer);
      _resultsTimer = setTimeout(goToTrackSelect, 4000);
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
    if (Game && typeof Game.getLapProgress === 'function') {
      const fill = document.getElementById('lap-progress-fill');
      if (fill) {
        fill.style.width = (Game.getLapProgress() * 100).toFixed(1) + '%';
        // Colour the fill live by current speed ratio — at-a-glance pace feedback.
        // Low speed → red, mid → yellow, high → cyan. Thresholds are intentionally
        // forgiving so it's green-coded most of the time when driving well.
        const sr = Math.max(0, Math.min(1, data.speed / 200));
        const col = sr > 0.70 ? '#0ff' : sr > 0.45 ? '#ff0' : '#f60';
        fill.style.background = 'linear-gradient(90deg, ' + col + ', #fff)';
      }
    }

    // Nitro / combo / draft indicators. All optional — old callers without
    // fx still get a clean HUD.
    const fx = data.fx || {};
    const nb = document.getElementById('nitro-bar');
    const nf = document.getElementById('nitro-fill');
    if (nb && nf) {
      nf.style.height = ((fx.nitro || 0) * 100).toFixed(0) + '%';
      nb.classList.toggle('active', !!fx.nitroActive);
      nb.classList.toggle('full', (fx.nitro || 0) >= 0.999);
    }
    const btn = document.getElementById('btn-nitro');
    if (btn) {
      btn.classList.toggle('ready',  (fx.nitro || 0) > 0.08 && !fx.nitroActive);
      btn.classList.toggle('firing', !!fx.nitroActive);
    }
    const cp = document.getElementById('combo-pill');
    if (cp) {
      const show = (fx.combo || 0) >= 2;
      cp.classList.toggle('visible', show);
      if (show) cp.textContent = 'COMBO x' + fx.combo;
    }
    const dp = document.getElementById('draft-pill');
    if (dp) dp.classList.toggle('visible', !!fx.drafting);
  }

  function showMsg(msg, duration) {
    const el = document.getElementById('game-msg');
    el.textContent = msg;
    if (duration) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, duration);
  }

  function clearMsg() { document.getElementById('game-msg').textContent = ''; }

  // ── Pause overlay ─────────────────────────
  function showPauseOverlay(on) {
    const ov = document.getElementById('pause-overlay');
    if (!ov) return;
    ov.classList.toggle('visible', !!on);
  }

  // ── Title-screen trophy (all tracks cleared) ──
  function _refreshTitleTrophy() {
    const el = document.getElementById('title-trophy');
    if (!el) return;
    el.style.display =
      (UnlockManager.isAllComplete && UnlockManager.isAllComplete()) ? 'block' : 'none';
  }

  // ── Cobra prize (populated from CARS config) ──
  let _cobraCallback = null;
  function _renderCobraPrize() {
    const cobra = CARS.find(c => c.id === 'cobra');
    if (!cobra) return;
    const nameEl = document.querySelector('.cobra-prize-name');
    const descEl = document.querySelector('.cobra-prize-desc');
    const statsEl = document.querySelector('.cobra-prize-stats');
    if (nameEl) nameEl.textContent = cobra.name.toUpperCase();
    if (descEl) descEl.textContent = cobra.description;
    if (statsEl) {
      statsEl.textContent =
        'TOP SPEED ▸ ' + cobra.topSpeed + ' MPH\n' +
        'ACCEL ▸ ' + cobra.acceleration + '\n' +
        'HANDLING ▸ ' + cobra.handling;
    }
  }

  function showCobraPrize(onRace) {
    _cobraCallback = onRace;
    _renderCobraPrize();
    showScreen('cobraPrize');
  }

  // ── Wire-up ────────────────────────────────
  // Guard against the DOM not yet being parsed — shouldn't happen since we
  // load at body end, but safer for future script re-ordering / module conv.
  function _wire() {
    document.getElementById('btn-start').addEventListener('click', () => {
      AudioFX.resume();
      buildCarGrid();
      showScreen('carSelect');
    });

    // Reset progress — confirms, wipes localStorage, returns to title.
    document.getElementById('btn-reset-progress').addEventListener('click', () => {
      if (!confirm('Reset ALL progress?\nUnlocked tiers, completions, leaderboard, and bonus cars will be cleared.')) return;
      ProgressReset.wipe();
      selectedCarIndex = 1;
      selectedTrackIndex = 0;
      carPage = 0;
      _cardCache.clear();
      _refreshTitleTrophy();
      showMsg('PROGRESS RESET', 1500);
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

    // Reset the 10s auto-save as the user types so typing doesn't get cut off.
    const nameInput = document.getElementById('player-name-input');
    nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); _saveAndAdvance(); return; }
    });
    nameInput.addEventListener('input', () => {
      if (_pendingResult && _resultsTimer) {
        clearTimeout(_resultsTimer);
        _resultsTimer = setTimeout(_saveAndAdvance, 10000);
      }
    });

    document.getElementById('btn-continue').addEventListener('click', () => {
      _pendingResult = null;
      goToTrackSelect();
    });

    // Nitro button — toggles TouchKeys.nitro for one frame per tap. Game.js
    // debounces via _nitroPressed, so a held button still fires only once.
    const nitroBtn = document.getElementById('btn-nitro');
    if (nitroBtn) {
      const fire = (e) => {
        e.preventDefault();
        TouchKeys.set('nitro', true);
        setTimeout(() => TouchKeys.set('nitro', false), 80);
      };
      nitroBtn.addEventListener('click', fire);
      nitroBtn.addEventListener('touchend', fire, { passive: false });
    }

    // Pause button — delegates to Game.togglePause.
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) {
      const toggle = (e) => {
        e.preventDefault();
        if (typeof Game.togglePause === 'function') Game.togglePause();
      };
      pauseBtn.addEventListener('click', toggle);
      pauseBtn.addEventListener('touchend', toggle, { passive: false });
    }

    // Pause-overlay buttons.
    const btnResume = document.getElementById('btn-pause-resume');
    const btnRetry  = document.getElementById('btn-pause-retry');
    const btnQuit   = document.getElementById('btn-pause-quit');
    if (btnResume) btnResume.addEventListener('click', () => Game.togglePause());
    if (btnRetry)  btnRetry .addEventListener('click', () => Game.restartRace && Game.restartRace());
    if (btnQuit)   btnQuit  .addEventListener('click', () => Game.quitToTracks && Game.quitToTracks());

    // ── Single multi-touch overlay ─────────────
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
            if (relY < 0.5) gas   = true;
            else             brake = true;
          } else {
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
    // AudioFX.resume() is only invoked on the title screen's first interaction
    // (Enter) — in-game keys don't need to re-resume on every press.
    document.addEventListener('keydown', e => {
      if (currentScreen === 'title') {
        if (e.key === 'Enter') {
          AudioFX.resume();
          buildCarGrid(); showScreen('carSelect');
        }
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
      if (e.key === 'm' || e.key === 'M') AudioFX.toggle();
    });

    // ── Cobra prize screen ─────────────────────
    document.getElementById('btn-cobra-race').addEventListener('click', () => {
      if (_cobraCallback) { const cb = _cobraCallback; _cobraCallback = null; cb(); }
    });

    _refreshTitleTrophy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wire);
  } else {
    _wire();
  }

  return { showScreen, showResults, showCobraPrize, updateHUD, showMsg, clearMsg,
           showPauseOverlay, goToTrackSelect };
})();
