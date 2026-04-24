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
    prizeUnlock: document.getElementById('screen-prize-unlock'),
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

      function _isCarUnlocked(car) {
        // Hidden cars with prizeUnlock gate behind the PrizeUnlock registry.
        // Other hidden cars (none today, but future-proof) are always available.
        if (car.prizeUnlock) return PrizeUnlock.isUnlocked(car.id);
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

    // Stats row shows tuned values when a non-stock preset is active so the
    // bars reflect what the player will actually race with. Deltas render as
    // coloured ▲/▼ arrows next to each bar. Built via DOM nodes so no user-
    // sourced value would ever land in innerHTML (defence in depth — car
    // stats are all config today, but the pattern stays safe if that changes).
    const tuned = Tuning.apply(car);
    const s = document.getElementById('car-stats');
    s.textContent = '';
    _appendStatRow(s, 'SPEED:    ', tuned.topSpeed,     car.topSpeed);
    _appendStatRow(s, 'ACCEL:    ', tuned.acceleration, car.acceleration);
    _appendStatRow(s, 'HANDLING: ', tuned.handling,     car.handling);
    const offRow = document.createElement('div');
    offRow.textContent = 'OFF-ROAD: ' + _offRoad(tuned);
    s.appendChild(offRow);

    const pvs = document.getElementById('car-preview');
    const sd = Sprites.get(car.id, 'side');
    pvs.height = sd ? Math.round(sd.crop.h * (pvs.width / sd.crop.w)) : 220;
    _drawSideSprite(pvs.getContext('2d'), car, pvs.width, pvs.height,
      Math.round(pvs.width / 2), Math.round(pvs.height * 0.67), 2.8);

    _refreshTuneButton();
  }

  // Build one stat row: label + bar text node + optional coloured delta span.
  function _appendStatRow(parent, label, tunedVal, baseVal) {
    const row = document.createElement('div');
    row.appendChild(document.createTextNode(label + _bar(tunedVal)));
    const d = tunedVal - baseVal;
    if (d !== 0) {
      const span = document.createElement('span');
      span.className = d > 0 ? 'stat-delta-up' : 'stat-delta-down';
      span.textContent = ' ' + (d > 0 ? '▲' : '▼') + Math.abs(d);
      row.appendChild(span);
    }
    parent.appendChild(row);
  }

  function _refreshTuneButton() {
    const btn = document.getElementById('btn-tune');
    if (!btn) return;
    const car = CARS[selectedCarIndex];
    const key = Tuning.getPreset(car.id);
    const preset = Tuning.PRESETS[key];
    btn.textContent = 'TUNE: ' + preset.label + ' ▸';
    btn.classList.remove('preset-stock', 'preset-race', 'preset-rally');
    btn.classList.add('preset-' + key);
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

  let _trackCards = [];

  function _selectTrack(i) {
    selectedTrackIndex = i;
    _trackCards.forEach(entry => {
      entry.card.classList.toggle('selected', entry.index === i);
    });
    _updateTrackDetail();
  }

  function buildTrackGrid() {
    const grid = document.getElementById('track-grid');
    grid.textContent = '';
    _trackCards = [];
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
        const pick = () => { _selectTrack(i); };
        card.addEventListener('click', pick);
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });
        _trackCards.push({ card, index: i });
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
    _stopResultsCountdown();
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

    _stopResultsCountdown();
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
    if (data.pointsEarned != null) {
      _line('PTS:   ', (data.pointsEarned > 0 ? '+' : '') + data.pointsEarned);
    }

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
      _startResultsCountdown(GameConstants.RESULTS_AUTOSAVE_MS, _saveAndAdvance);
    } else {
      _pendingResult = null;
      nameRow.style.display = 'none';
      _startResultsCountdown(4000, goToTrackSelect);
    }

    showScreen('results');
  }

  // Run the results timer while updating the SKIP button label with a live
  // countdown. A single interval drives both the timeout and the UI so they
  // can't drift apart.
  let _resultsCountdownInterval = null;
  function _startResultsCountdown(ms, onExpire) {
    if (_resultsTimer) { clearTimeout(_resultsTimer); _resultsTimer = null; }
    if (_resultsCountdownInterval) { clearInterval(_resultsCountdownInterval); _resultsCountdownInterval = null; }
    const btn = document.getElementById('btn-continue');
    const deadline = Date.now() + ms;
    const render = () => {
      if (!btn) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      btn.textContent = remaining > 0 ? ('SKIP ▶ (' + remaining + 's)') : 'SKIP ▶';
    };
    render();
    _resultsCountdownInterval = setInterval(render, 250);
    _resultsTimer = setTimeout(() => {
      if (_resultsCountdownInterval) { clearInterval(_resultsCountdownInterval); _resultsCountdownInterval = null; }
      if (btn) btn.textContent = 'SKIP ▶';
      onExpire();
    }, ms);
  }
  function _stopResultsCountdown() {
    if (_resultsTimer) { clearTimeout(_resultsTimer); _resultsTimer = null; }
    if (_resultsCountdownInterval) { clearInterval(_resultsCountdownInterval); _resultsCountdownInterval = null; }
    const btn = document.getElementById('btn-continue');
    if (btn) btn.textContent = 'SKIP ▶';
  }

  function _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ── HUD ────────────────────────────────────
  // Cache DOM refs once — updateHUD runs every frame so getElementById
  // overhead adds up. Also diff each field against the last written value
  // to avoid no-op textContent writes that still trigger layout work.
  const _hud = {};
  function _hudEls() {
    if (_hud.l) return _hud;
    _hud.l       = document.getElementById('hud-left');
    _hud.c       = document.getElementById('hud-center');
    _hud.r       = document.getElementById('hud-right');
    _hud.fill    = document.getElementById('lap-progress-fill');
    _hud.nb      = document.getElementById('nitro-bar');
    _hud.nf      = document.getElementById('nitro-fill');
    _hud.btn     = document.getElementById('btn-nitro');
    _hud.cp      = document.getElementById('combo-pill');
    _hud.dp      = document.getElementById('draft-pill');
    _hud.sp      = document.getElementById('slowmo-pill');
    return _hud;
  }
  const _lastHUD = { l: null, c: null, r: null, fillPct: null, fillCol: null,
    nitroPct: null, nbActive: null, nbFull: null, btnReady: null, btnFiring: null,
    comboText: null, comboShow: null, draftShow: null, slowMoShow: null };

  function _setText(el, key, value) {
    if (!el || _lastHUD[key] === value) return;
    _lastHUD[key] = value;
    el.textContent = value;
  }

  function updateHUD(mode, data) {
    const h = _hudEls();
    const leftText = mode === 'qualify'
      ? 'QUALIFY'
      : 'P' + data.pos + ' LAP ' + data.lap + '/' + data.totalLaps;
    _setText(h.l, 'l', leftText);
    _setText(h.c, 'c', _fmtTime(data.time));
    _setText(h.r, 'r', Math.round(data.speed) + ' MPH');

    if (h.fill && Game && typeof Game.getLapProgress === 'function') {
      const pct = (Game.getLapProgress() * 100).toFixed(1) + '%';
      if (_lastHUD.fillPct !== pct) { _lastHUD.fillPct = pct; h.fill.style.width = pct; }
      // Colour the fill live by current speed ratio — at-a-glance pace feedback.
      // Low speed → red, mid → yellow, high → cyan. Thresholds are intentionally
      // forgiving so it's green-coded most of the time when driving well.
      const sr = Math.max(0, Math.min(1, data.speed / 200));
      const col = sr > 0.70 ? '#0ff' : sr > 0.45 ? '#ff0' : '#f60';
      if (_lastHUD.fillCol !== col) {
        _lastHUD.fillCol = col;
        h.fill.style.background = 'linear-gradient(90deg, ' + col + ', #fff)';
      }
    }

    // Nitro / combo / draft indicators. All optional — old callers without
    // fx still get a clean HUD.
    const fx = data.fx || {};
    if (h.nb && h.nf) {
      const nPct = ((fx.nitro || 0) * 100).toFixed(0) + '%';
      if (_lastHUD.nitroPct !== nPct) { _lastHUD.nitroPct = nPct; h.nf.style.height = nPct; }
      const active = !!fx.nitroActive;
      const full   = (fx.nitro || 0) >= 0.999;
      if (_lastHUD.nbActive !== active) { _lastHUD.nbActive = active; h.nb.classList.toggle('active', active); }
      if (_lastHUD.nbFull   !== full)   { _lastHUD.nbFull   = full;   h.nb.classList.toggle('full',   full); }
    }
    if (h.btn) {
      const ready  = (fx.nitro || 0) > 0.08 && !fx.nitroActive;
      const firing = !!fx.nitroActive;
      if (_lastHUD.btnReady  !== ready)  { _lastHUD.btnReady  = ready;  h.btn.classList.toggle('ready',  ready); }
      if (_lastHUD.btnFiring !== firing) { _lastHUD.btnFiring = firing; h.btn.classList.toggle('firing', firing); }
    }
    if (h.cp) {
      const show = (fx.combo || 0) >= 2;
      if (_lastHUD.comboShow !== show) { _lastHUD.comboShow = show; h.cp.classList.toggle('visible', show); }
      if (show) {
        const txt = 'COMBO x' + fx.combo;
        if (_lastHUD.comboText !== txt) { _lastHUD.comboText = txt; h.cp.textContent = txt; }
      }
    }
    if (h.dp) {
      const show = !!fx.drafting;
      if (_lastHUD.draftShow !== show) { _lastHUD.draftShow = show; h.dp.classList.toggle('visible', show); }
    }
    if (h.sp) {
      const show = !!fx.slowMo;
      if (_lastHUD.slowMoShow !== show) { _lastHUD.slowMoShow = show; h.sp.classList.toggle('visible', show); }
    }
  }

  function showMsg(msg, duration) {
    const el = document.getElementById('game-msg');
    el.textContent = msg;
    if (duration) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, duration);
  }

  function clearMsg() { document.getElementById('game-msg').textContent = ''; }

  // ── Track intro card ──────────────────────
  // Shows `label` (from track.introLabel) for `duration` ms, then fires `done`.
  // Renders above the game canvas as a full-screen dimmed overlay so the name
  // lands before the countdown hits. Multi-line labels use " · " → newline so
  // "ATLANTA · I-285 · RUSH HOUR" stacks.
  let _introTimer = null;
  function showIntroCard(label, duration, done) {
    const el = document.getElementById('intro-card');
    if (!el || !label) { if (done) done(); return; }
    if (_introTimer) { clearTimeout(_introTimer); _introTimer = null; }
    el.textContent = label.replace(/\s+·\s+/g, '\n');
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    _introTimer = setTimeout(() => {
      el.classList.remove('visible');
      el.setAttribute('aria-hidden', 'true');
      _introTimer = null;
      if (done) done();
    }, duration || 1500);
  }

  // ── Credits + dedication overlay (Vegas one-shot) ──
  // Shown once when the player completes the Vegas race for the first time.
  // Dismisses on the continue button OR after a 9s auto-advance. Either path
  // fires `done()` once. The dedication text lives in index.html so copy lands
  // in the DOM without JS, and is translation-ready if we ever localize.
  let _creditsDone = null;
  function showCreditsRoll(done) {
    const el = document.getElementById('credits-overlay');
    const btn = document.getElementById('btn-credits-continue');
    if (!el) { if (done) done(); return; }
    _creditsDone = done || null;
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    const finish = () => {
      el.classList.remove('visible');
      el.setAttribute('aria-hidden', 'true');
      if (btn) btn.removeEventListener('click', finish);
      if (_autoTimer) { clearTimeout(_autoTimer); _autoTimer = null; }
      const cb = _creditsDone; _creditsDone = null;
      if (cb) cb();
    };
    let _autoTimer = setTimeout(finish, 9000);
    if (btn) btn.addEventListener('click', finish);
  }

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

  // ── Prize car reveal (populated from the passed car) ──
  // Any hidden car with prizeUnlock can appear here — the screen template is
  // shared; fields come from the car object.
  let _prizeCallback = null;
  function _renderPrizeUnlock(car) {
    if (!car) return;
    const imgEl  = document.getElementById('prize-unlock-img');
    const nameEl = document.querySelector('.prize-unlock-name');
    const descEl = document.querySelector('.prize-unlock-desc');
    const statsEl = document.querySelector('.prize-unlock-stats');
    if (imgEl && car.prizeImage) imgEl.src = car.prizeImage;
    if (nameEl) nameEl.textContent = car.name.toUpperCase();
    if (descEl) descEl.textContent = car.description;
    if (statsEl) {
      statsEl.textContent =
        'TOP SPEED ▸ ' + car.topSpeed + ' MPH\n' +
        'ACCEL ▸ ' + car.acceleration + '\n' +
        'HANDLING ▸ ' + car.handling;
    }
  }

  function showPrizeUnlock(car, onRace) {
    _prizeCallback = onRace;
    _renderPrizeUnlock(car);
    showScreen('prizeUnlock');
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
      confirmDialog(
        'RESET ALL PROGRESS?',
        'Unlocked tiers, completions, leaderboard, and bonus cars will be cleared.',
        () => {
          ProgressReset.wipe();
          selectedCarIndex = 1;
          selectedTrackIndex = 0;
          carPage = 0;
          _cardCache.clear();
          _refreshTitleTrophy();
          showMsg('PROGRESS RESET', 1500);
        }
      );
    });

    document.getElementById('btn-page-standard').addEventListener('click', () => _setCarPage(0));
    document.getElementById('btn-page-prize').addEventListener('click', () => _setCarPage(1));

    document.getElementById('btn-car-confirm').addEventListener('click', () => {
      window._selectedCar = CARS[selectedCarIndex];
      buildTrackGrid();
      showScreen('trackSelect');
    });

    // TUNE: cycles STOCK → RACE → RALLY on each tap. Refreshes stat bars
    // in-place so the user sees the delta immediately.
    const tuneBtn = document.getElementById('btn-tune');
    if (tuneBtn) {
      tuneBtn.addEventListener('click', () => {
        const car = CARS[selectedCarIndex];
        Tuning.cycle(car.id);
        _updateCarDetail();
      });
    }

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
      if (_pendingResult) {
        _startResultsCountdown(GameConstants.RESULTS_AUTOSAVE_MS, _saveAndAdvance);
      }
    });

    document.getElementById('btn-continue').addEventListener('click', () => {
      _pendingResult = null;
      _stopResultsCountdown();
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
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          // Step through only the selectable cards on the current page.
          const n = _carCards.length;
          if (n === 0) return;
          let cur = _carCards.findIndex(entry => entry.index === selectedCarIndex);
          if (cur < 0) cur = 0;
          const next = e.key === 'ArrowRight' ? (cur + 1) % n : (cur - 1 + n) % n;
          _selectCar(_carCards[next].index);
        }
        else if (e.key === 'Enter') { window._selectedCar = CARS[selectedCarIndex]; buildTrackGrid(); showScreen('trackSelect'); }
      } else if (currentScreen === 'trackSelect') {
        if (e.key === 'Enter') { _goRace(); return; }
        if (e.key === 'Escape') { buildCarGrid(); showScreen('carSelect'); return; }
        // Step through only the unlocked tracks — arrow keys should skip locked cards.
        const n = _trackCards.length;
        if (n === 0) return;
        let cur = _trackCards.findIndex(entry => entry.index === selectedTrackIndex);
        if (cur < 0) cur = 0;
        let next = cur;
        if (e.key === 'ArrowRight') next = (cur + 1) % n;
        else if (e.key === 'ArrowLeft') next = (cur - 1 + n) % n;
        else if (e.key === 'ArrowDown') next = Math.min(n - 1, cur + 2);
        else if (e.key === 'ArrowUp') next = Math.max(0, cur - 2);
        else return;
        _selectTrack(_trackCards[next].index);
      } else if (currentScreen === 'results' && e.key === 'Enter') {
        buildTrackGrid(); showScreen('trackSelect');
      }
      if (e.key === 'm' || e.key === 'M') AudioFX.toggle();
    });

    // ── Prize-car reveal screen ────────────────
    document.getElementById('btn-prize-race').addEventListener('click', () => {
      if (_prizeCallback) { const cb = _prizeCallback; _prizeCallback = null; cb(); }
    });

    _refreshTitleTrophy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wire);
  } else {
    _wire();
  }

  // In-game confirm dialog — replaces native confirm() so the pixel-art theme
  // isn't broken by a browser-native prompt on mobile.
  function confirmDialog(title, body, onOk) {
    const overlay = document.getElementById('confirm-overlay');
    const titleEl = document.getElementById('confirm-title');
    const bodyEl  = document.getElementById('confirm-body');
    const okBtn   = document.getElementById('btn-confirm-ok');
    const cancelBtn = document.getElementById('btn-confirm-cancel');
    if (!overlay) { if (onOk) onOk(); return; }
    titleEl.textContent = title || 'ARE YOU SURE?';
    bodyEl.textContent = body || '';
    const close = () => {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
      okBtn.removeEventListener('click', okHandler);
      cancelBtn.removeEventListener('click', cancelHandler);
      document.removeEventListener('keydown', keyHandler);
    };
    const okHandler = () => { close(); if (onOk) onOk(); };
    const cancelHandler = () => { close(); };
    const keyHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelHandler(); }
      else if (e.key === 'Enter') { e.preventDefault(); okHandler(); }
    };
    okBtn.addEventListener('click', okHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    document.addEventListener('keydown', keyHandler);
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    cancelBtn.focus();
  }

  return { showScreen, showResults, showPrizeUnlock, updateHUD, showMsg, clearMsg,
           showPauseOverlay, showIntroCard, showCreditsRoll,
           goToTrackSelect, confirm: confirmDialog };
})();
