// ─────────────────────────────────────────────
//  TRACKS — 9 tracks, 5 tiers (Drye Geography Edition)
// ─────────────────────────────────────────────
//
// Renderer-facing fields (picked up by js/renderer.js):
//   night        — stars + moon + no clouds
//   sunset       — warm horizon glow + low sun
//   skyline      — horizon silhouette. One of:
//                   'mountains:oahu'  'city:athens'  'city:orlando'
//                   'city:atlanta'    'city:nyc'     'city:vegas'
//                   'trees:secaucus'  'trees:garden_city'  'trees:tulum'
//   weather      — 'rain' | 'fog' | 'golden_hour' | 'partly_cloudy' | 'rush_hour_haze'
//   cloudCount   — override default cloud density (default 4, night = 0)
//   horizonGlow  — override the horizon-band rgba string
//   oceanLeft    — paint an ocean strip below horizon on the left
//
// Gameplay fields driven onto tracks (moved off game.js lookup tables):
//   scenery      — roadside sprite pool (_spawnScenery picks from this)
//   trafficPool  — traffic sprite-ID pool (_spawnTraffic picks from this)
//
// UI / presentation:
//   introLabel   — stencil overlay shown ~1.5s before countdown
//   prizeCarId   — car unlocked when this track is qualified
//   creditsRoll  — true on the finale track; triggers dedication card

const TRACKS = [
  // ── TIER 1: HOME ──────────────────────────
  {
    id: 'athens',
    name: 'Athens GA',
    tier: 1,
    skyline: 'city:athens',
    introLabel: 'ATHENS · GA · GAME DAY',
    description: 'Red and Black everywhere. Fans\nspilling into the street. Dawgs\nat home.',
    setting: 'College town, game-day clear',
    skyColor:   '#8fc6ea',
    groundColor:'#6a8a3a',
    roadColor:  '#555555',
    lineColor:  '#ffff00',
    hazards: ['traffic_light'],
    trafficDensity: 0.35,
    length: 150,
    curves: [
      { start: 30, end: 45, curve: 0.3 },
      { start: 90, end: 105, curve: -0.25 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: null,
    cloudCount: 3,
    scenery: ['stadium_crowd', 'tree', 'billboard'],
    trafficPool: ['Sport01','Comfort01','Highway01','OffRoad01'],
  },
  {
    id: 'secaucus',
    name: 'Secaucus NJ',
    tier: 1,
    skyline: 'trees:secaucus',
    introLabel: 'SECAUCUS · NJ',
    description: 'Trees both sides, quiet road.\nHometown feel.',
    setting: 'Suburban New Jersey',
    skyColor:   '#a8c8e0',
    groundColor:'#4a6a2a',
    roadColor:  '#4a4a4a',
    lineColor:  '#ffffff',
    hazards: ['traffic_light'],
    trafficDensity: 0.25,
    length: 160,
    curves: [
      { start: 22, end: 40, curve: 0.35 },
      { start: 70, end: 88, curve: -0.30 },
      { start: 120, end: 138, curve: 0.25 },
    ],
    hills: [{ start: 50, end: 80, height: 0.25 }],
    dirtZones: [],
    iceZones: [],
    unlockRequires: null,
    cloudCount: 4,
    scenery: ['tree', 'billboard'],
    trafficPool: ['Sport01','Comfort01','Highway01'],
  },

  // ── TIER 2: FAMILY TRIPS ──────────────────
  {
    id: 'garden_city',
    name: 'Garden City Beach',
    tier: 2,
    skyline: 'trees:garden_city',
    weather: 'partly_cloudy',
    introLabel: 'GARDEN CITY · SC · BEACH TRIP',
    description: 'Water on the left, beach houses\non the right. Family-trip chill.',
    setting: 'Coastal Carolina, sunny',
    skyColor:   '#a8d8f0',
    groundColor:'#c8b880',
    oceanLeft:   true,
    roadColor:  '#505050',
    lineColor:  '#ffffff',
    hazards: ['traffic_light', 'pothole'],
    trafficDensity: 0.32,
    length: 165,
    curves: [
      { start: 18, end: 40, curve: 0.45 },
      { start: 62, end: 84, curve: -0.40 },
      { start: 112, end: 135, curve: 0.50 },
    ],
    hills: [{ start: 45, end: 70, height: 0.30 }],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier1',
    scenery: ['beach_house', 'palm', 'billboard'],
    trafficPool: ['Sport01','Comfort01','OffRoad01','Highway01'],
  },
  {
    id: 'orlando',
    name: 'Orlando',
    tier: 2,
    skyline: 'city:orlando',
    weather: 'partly_cloudy',
    introLabel: 'ORLANDO · FL · FAMILY VACATION',
    description: 'Theme-park gates, monorail overhead,\nballoons in the sky. Family vacation.',
    setting: 'Florida, warm sun',
    skyColor:   '#b0d8ee',
    groundColor:'#6aa040',
    roadColor:  '#505050',
    lineColor:  '#ffffff',
    hazards: ['traffic_medium', 'pothole'],
    trafficDensity: 0.45,
    length: 160,
    curves: [
      { start: 20, end: 38, curve: 0.40 },
      { start: 62, end: 80, curve: -0.45 },
      { start: 105, end: 125, curve: 0.50 },
      { start: 140, end: 156, curve: -0.35 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier1',
    scenery: ['balloon', 'tree', 'billboard'],
    trafficPool: ['Comfort01','Highway01','OffRoad01','Sport01'],
  },

  // ── TIER 3: DESTINATIONS ──────────────────
  {
    id: 'oahu',
    name: 'Oahu',
    tier: 3,
    skyline: 'mountains:oahu',
    weather: 'rain',
    introLabel: 'OAHU · HAWAII',
    description: 'Green volcanic mountains on the\nright, Pacific on the left. Light rain.',
    setting: 'Hawaiian coast, tropical',
    skyColor:   '#7ab0c8',
    groundColor:'#3a7a40',
    oceanLeft:   true,
    roadColor:  '#484848',
    lineColor:  '#ffffff',
    hazards: ['pothole', 'debris', 'traffic_light'],
    trafficDensity: 0.35,
    length: 180,
    curves: [
      { start: 12, end: 32, curve: 0.70 },
      { start: 50, end: 70, curve: -0.85 },
      { start: 95, end: 115, curve: 0.90 },
      { start: 140, end: 160, curve: -0.75 },
    ],
    hills: [
      { start: 0, end: 90, height: 0.35 },
      { start: 100, end: 170, height: 0.50 },
    ],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier2',
    scenery: ['palm', 'boulder'],
    trafficPool: ['Sport01','Comfort01','OffRoad01','OffRoad02'],
  },
  {
    id: 'tulum',
    name: 'Tulum',
    tier: 3,
    skyline: 'trees:tulum',
    weather: 'golden_hour',
    introLabel: 'TULUM · MEXICO · GOLDEN HOUR',
    description: 'Beachfront huts, palms, the\nCaribbean glowing gold.',
    setting: 'Yucatán coast, sunset glow',
    skyColor:   '#f0a060',
    groundColor:'#b89060',
    oceanLeft:   true,
    roadColor:  '#4e4638',
    lineColor:  '#ffffff',
    horizonGlow: 'rgba(255,160,60,0.55)',
    hazards: ['pothole', 'traffic_light'],
    trafficDensity: 0.28,
    length: 165,
    curves: [
      { start: 18, end: 40, curve: 0.55 },
      { start: 65, end: 88, curve: -0.45 },
      { start: 110, end: 135, curve: 0.65 },
    ],
    hills: [{ start: 40, end: 70, height: 0.25 }],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier2',
    scenery: ['tiki_hut', 'palm'],
    trafficPool: ['Comfort01','OffRoad01','Sport01'],
  },

  // ── TIER 4: URBAN ─────────────────────────
  {
    id: 'atlanta_i285',
    name: 'Atlanta I-285',
    tier: 4,
    skyline: 'city:atlanta',
    weather: 'rush_hour_haze',
    introLabel: 'ATLANTA · I-285 · RUSH HOUR',
    description: 'The Perimeter at rush hour.\nBumper to bumper, semis, overpasses.\nWelcome home to the commute.',
    setting: 'Interstate rush hour',
    skyColor:   '#b0a890',
    groundColor:'#707060',
    roadColor:  '#3e3e3e',
    lineColor:  '#ffffff',
    horizonGlow: 'rgba(180,140,90,0.32)',
    hazards: ['debris', 'oil', 'pothole'],
    hazardSpawnRate: 0.07,           // hero-track rate — ~14 hazards across 210 segs
    trafficDensity: 18.0,            // HERO — true rush-hour gridlock (~20x normal)
    trafficSpeedCap: 0.40,           // 40 mph cap — everyone stuck at commute pace
    length: 210,
    curves: [
      { start: 22, end: 40, curve: 0.45 },
      { start: 70, end: 90, curve: -0.40 },
      { start: 120, end: 140, curve: 0.55 },
      { start: 170, end: 190, curve: -0.35 },
    ],
    hills: [{ start: 50, end: 110, height: 0.20 }],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier3',
    cloudCount: 5,
    scenery: ['overpass_sign', 'building', 'billboard'],
    trafficPool: ['Sport01','Sport02','Comfort01','Highway01','OffRoad01'],
    prizeCarId: 'ferrari458',        // Italian supercar + American rush hour = hero-track reward
  },
  {
    id: 'nyc',
    name: 'Manhattan',
    tier: 4,
    skyline: 'city:nyc',
    introLabel: 'NEW YORK · MANHATTAN',
    description: 'Skyscrapers both sides, yellow\ncabs weaving, steam off the vents.',
    setting: 'Midtown, overcast',
    skyColor:   '#9aa0a8',
    groundColor:'#505560',
    roadColor:  '#383838',
    lineColor:  '#ffff00',
    hazards: ['traffic_heavy', 'pothole', 'debris'],
    hazardSpawnRate: 0.06,           // NYC streets: potholes everywhere — ~11 hazards over 180 segs
    trafficDensity: 0.75,
    length: 180,
    curves: [
      { start: 15, end: 30, curve: 0.50 },
      { start: 55, end: 72, curve: -0.60 },
      { start: 98, end: 115, curve: 0.55 },
      { start: 140, end: 160, curve: -0.50 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier3',
    cloudCount: 6,
    scenery: ['skyscraper', 'building', 'billboard'],
    trafficPool: ['Sport01','Sport02','Comfort01','Highway01'],
  },

  // ── TIER 5: ENDGAME ───────────────────────
  {
    id: 'vegas',
    name: 'Las Vegas Strip',
    tier: 5,
    night: true,
    skyline: 'city:vegas',
    moonX: 0.8,
    horizonGlow: 'rgba(255,90,180,0.28)',
    introLabel: 'LAS VEGAS · THE STRIP',
    description: 'Neon blazing, limos on the Strip,\ndesert beyond. Finale.',
    setting: 'Vegas Strip at night',
    skyColor:   '#080822',
    groundColor:'#221820',
    roadColor:  '#1e1e1e',
    lineColor:  '#ffd700',
    hazards: ['traffic_heavy', 'debris'],
    hazardSpawnRate: 0.05,           // Vegas Strip: stray cones and debris — ~10 across 210 segs
    trafficDensity: 0.70,
    length: 210,
    curves: [
      { start: 30, end: 48, curve: 0.30 },
      { start: 90, end: 108, curve: -0.35 },
      { start: 150, end: 170, curve: 0.40 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier4',
    cloudCount: 0,
    scenery: ['neon_sign', 'building', 'billboard'],
    trafficPool: ['Sport02','Sport03','Comfort01','Highway01'],
    prizeCarId: 'cobra',             // qualifying Vegas unlocks the Shelby Cobra 427
    creditsRoll: true,               // triggers dedication card on race completion
  },
];

// ── Per-track defaults ────────────────────────
// Applied once at load so every track has these fields without each definition
// re-stating them. Override any of these by setting the field on the track above.
const TRACK_DEFAULTS = Object.freeze({
  lapGoal:         2,
  qualifyTime:     50,
  hazardSpawnRate: 0.035,
  cloudCount:      4,    // auto-forced to 0 on night tracks in the renderer
  scenery:        ['billboard'],
  trafficPool:    ['Sport01','Comfort01','Highway01'],
});
for (const t of TRACKS) {
  for (const k in TRACK_DEFAULTS) {
    if (t[k] === undefined) t[k] = TRACK_DEFAULTS[k];
  }
}

// ── Tier-scaled race rules ────────────────────
// Starting grid position on the HUD and qualify-time multiplier — both scale
// with difficulty tier. Beginners get more time + a better grid.
const TIER_RULES = Object.freeze({
  1: { gridPos: 2, qualifyMult: 2.0 },
  2: { gridPos: 4, qualifyMult: 1.5 },
  3: { gridPos: 6, qualifyMult: 1.2 },
  4: { gridPos: 8, qualifyMult: 1.2 },
  5: { gridPos: 8, qualifyMult: 1.2 },
});

// ── Shared runtime constants ──────────────────
// Lives in tracks.js (not game.js) because renderer.js needs DRAW_DISTANCE /
// ROAD_WIDTH and loads before game.js in the script order.
const GameConstants = Object.freeze({
  TOTAL_RACERS:       8,      // field size shown in the position HUD (P1..P8)
  HEAVY_TRAFFIC:      0.60,   // trafficDensity above which a track is "bumper-to-bumper"
  MINIMAP_RANGE:      30,     // segment radius shown on the mini-map
  SCENERY_STEP:       40,     // seed scenery every N segments
  SCENERY_PROB:       0.55,   // per-side spawn probability at each seeded segment
  TRAFFIC_PER_SEG:    0.025,  // traffic count = segments * density * this
  HAZARD_DEFAULT:     0.035,  // default per-segment hazard roll when track omits hazardSpawnRate
  DEFAULT_TIER:       3,      // fall-back tier for TIER_RULES lookup
  QUALIFY_SPEED_REF:  118,    // cars.topSpeed reference for qualify-time speed scaling
  DRAW_DISTANCE:      400,    // renderer: number of projected segments
  ROAD_WIDTH:         1200,   // renderer: virtual road width in world units
  RESULTS_AUTOSAVE_MS: 10000, // results screen auto-saves score after this delay
});

// ── Storage key registry ──────────────────────
// Single source of truth for every localStorage key used by the game.
// ProgressReset.wipe() iterates this so a new persisted key won't be forgotten.
//
// v1.0.0 (Drye Geography Edition) bumped every progress key to _v2. The old
// 12-track roster was cut entirely; leaving the old keys in place would mean
// phantom "route66 / monaco / autobahn" entries in the leaderboard forever.
// Tuning stays on _v1 — cars didn't change, user's RACE/RALLY preferences
// are still valid and worth preserving across the migration.
const StorageKeys = Object.freeze({
  unlockedTiers:   'pp_unlocked_v2',
  completedTracks: 'pp_completed_v2',
  leaderboard:     'vr_lb_v2',
  prizeUnlocks:    'vr_prize_v2',       // map of { carId: true }
  tuning:          'vr_tuning_v1',      // preserved across v1.0.0 reset
  lastCar:         'vr_last_car_v2',
  vegasCredits:    'vr_credits_v1',     // one-shot: dedication card shown once
});

// ─── Unlock system ────────────────────────────
const UnlockManager = {
  // Stored in localStorage
  _key: StorageKeys.unlockedTiers,

  getUnlocked() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : [1];
    } catch(e) { return [1]; }
  },

  unlockTier(tier) {
    const unlocked = this.getUnlocked();
    if (!unlocked.includes(tier)) {
      unlocked.push(tier);
      localStorage.setItem(this._key, JSON.stringify(unlocked));
    }
  },

  isTrackUnlocked(track) {
    if (!track || !track.unlockRequires) return true;    // tier 1
    const m = /^tier(\d)$/.exec(track.unlockRequires);
    if (!m) return true;
    const reqTier = parseInt(m[1], 10);
    return this.getUnlocked().includes(reqTier + 1)
        || this._isTierCompleted(reqTier);
  },

  _isTierCompleted(tier) {
    const done = this.getCompleted();
    return TRACKS.filter(t => t.tier === tier).every(t => done.includes(t.id));
  },

  checkAndUnlock(completedTier) {
    // Completing all tracks in a tier unlocks the next
    const nextTier = completedTier + 1;
    if (nextTier <= 5) this.unlockTier(nextTier);
  },

  // Track which tracks have been completed
  _raceKey: StorageKeys.completedTracks,

  markCompleted(trackId) {
    try {
      const raw = localStorage.getItem(this._raceKey);
      const done = raw ? JSON.parse(raw) : [];
      if (!done.includes(trackId)) {
        done.push(trackId);
        localStorage.setItem(this._raceKey, JSON.stringify(done));
      }
      // Check if all tracks in this tier are done
      const track = TRACKS.find(t => t.id === trackId);
      if (track) {
        const tierTracks = TRACKS.filter(t => t.tier === track.tier);
        const allDone = tierTracks.every(t => done.includes(t.id));
        if (allDone) this.checkAndUnlock(track.tier);
      }
    } catch(e) {}
  },

  getCompleted() {
    try {
      const raw = localStorage.getItem(this._raceKey);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  },

  // True only once the player has cleared every track across every tier.
  // Used by the title screen to show a completion trophy.
  isAllComplete() {
    const done = this.getCompleted();
    return TRACKS.every(t => done.includes(t.id));
  },

  resetAll() {
    localStorage.removeItem(this._key);
    localStorage.removeItem(this._raceKey);
  }
};

// ─── Leaderboard ───────────────────────────────
const Leaderboard = (() => {
  const KEY = StorageKeys.leaderboard;

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { return {}; }
  }
  function _save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e) {}
  }

  // entry = { name, car, time, pos, totalCars }
  function record(trackId, entry) {
    const data = _load();
    if (!data[trackId]) data[trackId] = [];
    data[trackId].push({
      name: (entry.name || 'RACER').toUpperCase().slice(0, 14),
      car:  entry.car,
      time: entry.time,
      pos:  entry.pos,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
    data[trackId].sort((a, b) => a.time - b.time);  // fastest first
    data[trackId] = data[trackId].slice(0, 5);
    _save(data);
  }

  function getTrack(trackId) {
    return _load()[trackId] || [];
  }

  function getBest(trackId) {
    const e = getTrack(trackId);
    return e.length ? e[0] : null;
  }

  // Simple points: P1=10, P2=7, P3=5, P4=3, P5=1
  const _PTS = [10, 7, 5, 3, 1];
  function pointsFor(pos) {
    const i = (pos | 0) - 1;
    return _PTS[i] || 0;
  }
  function getTotalPoints() {
    let pts = 0;
    const data = _load();
    Object.values(data).forEach(entries => {
      entries.forEach(e => { pts += pointsFor(e.pos); });
    });
    return pts;
  }

  function resetAll() {
    try { localStorage.removeItem(KEY); } catch(e) {}
  }

  return { record, getTrack, getBest, getTotalPoints, pointsFor, resetAll };
})();

// ─── Prize-car unlock ──────────────────────────
// Map-backed so future hidden prize cars drop in by setting car.prizeUnlock +
// a track.prizeCarId; no code edit needed.
const PrizeUnlock = (() => {
  const KEY = StorageKeys.prizeUnlocks;

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function _save(m) {
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {}
  }

  return {
    isUnlocked(carId) { return !!_load()[carId]; },
    unlock(carId)     { const m = _load(); m[carId] = true; _save(m); },
    reset()           { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
})();

// ─── Vegas one-shot: dedication card on first completion ────
// Separate storage key so RESET PROGRESS restores the moment. Read on every
// Vegas race finish; written once the dedication has played to end.
const VegasCredits = (() => {
  const KEY = StorageKeys.vegasCredits;
  return {
    hasShown()   { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    markShown()  { try { localStorage.setItem(KEY, '1'); } catch (e) {} },
    reset()      { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
})();

// ─── Per-car tuning presets (car-select → TUNE button) ──
// Three presets shift stat points between top speed / accel / handling and
// adjust dirt penalty. Applied at race start via Tuning.apply(car). Original
// base stats are untouched — returns a new car-like object.
const Tuning = (() => {
  const KEY = StorageKeys.tuning;
  const PRESETS = {
    stock: { label: 'STOCK', dTop: 0,   dAcc: 0,  dHand: 0,   dDirt: 1.00 },
    race:  { label: 'RACE',  dTop: 10,  dAcc: 8,  dHand: -15, dDirt: 1.25 },
    rally: { label: 'RALLY', dTop: -10, dAcc: 4,  dHand: 12,  dDirt: 0.55 },
  };
  const ORDER = ['stock', 'race', 'rally'];

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function _save(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }

  return {
    PRESETS, ORDER,
    getPreset(carId) {
      const map = _load();
      return PRESETS[map[carId]] ? map[carId] : 'stock';
    },
    setPreset(carId, key) {
      if (!PRESETS[key]) return;
      const map = _load();
      map[carId] = key;
      _save(map);
    },
    cycle(carId) {
      const cur = this.getPreset(carId);
      const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length];
      this.setPreset(carId, next);
      return next;
    },
    // Clamp final stats into a sane range; dirt penalty scales multiplicatively.
    apply(car) {
      const p = PRESETS[this.getPreset(car.id)];
      if (!p || p === PRESETS.stock) return car;
      const tuned = Object.assign({}, car);
      tuned.topSpeed     = Math.max(40, Math.min(220, car.topSpeed     + p.dTop));
      tuned.acceleration = Math.max(10, Math.min(100, car.acceleration + p.dAcc));
      tuned.handling     = Math.max(10, Math.min(100, car.handling     + p.dHand));
      if (car.surfacePenalties) {
        tuned.surfacePenalties = Object.assign({}, car.surfacePenalties);
        tuned.surfacePenalties.dirt = Math.max(0,
          Math.min(0.80, (car.surfacePenalties.dirt || 0) * p.dDirt));
      }
      return tuned;
    },
    resetAll() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
})();

// ─── Full progress reset (invoked from title screen button) ──
// Tuning is intentionally excluded here — RESET PROGRESS is a clean career
// wipe, not a car-tuning wipe. Players treat STOCK/RACE/RALLY as a car setting,
// not as progress. Tuning.resetAll() stays available for direct use.
const ProgressReset = {
  wipe() {
    UnlockManager.resetAll();
    Leaderboard.resetAll();
    PrizeUnlock.reset();
    VegasCredits.reset();
  }
};

// Dev shortcut: `?unlock=all` unlocks every tier + both prize cars, then
// strips the query so a normal reload doesn't re-trigger.
(function devUnlock() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('unlock') === 'all') {
      localStorage.setItem(StorageKeys.unlockedTiers, JSON.stringify([1,2,3,4,5]));
      const prizes = {};
      TRACKS.forEach(t => { if (t.prizeCarId) prizes[t.prizeCarId] = true; });
      localStorage.setItem(StorageKeys.prizeUnlocks, JSON.stringify(prizes));
      q.delete('unlock');
      const clean = location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash;
      history.replaceState(null, '', clean);
    }
  } catch (e) {}
})();
