// ─────────────────────────────────────────────
//  TRACKS — 12 tracks, 5 tiers, unlock logic
// ─────────────────────────────────────────────

const TRACKS = [
  // ── TIER 1: BEGINNER ──────────────────────
  {
    id: 'route66',
    name: 'Route 66',
    tier: 1,
    description: 'Classic American highway. Long straights,\ngentle curves. Perfect starting point.',
    setting: 'Desert day',
    skyColor:   '#87ceeb',
    groundColor:'#c8a060',
    roadColor:  '#555555',
    lineColor:  '#ffff00',
    hazards: ['traffic_light'],
    trafficDensity: 0.3,
    length: 150,
    curves: [
      { start: 30,  end: 45,  curve: 0.3 },
      { start: 90,  end: 105, curve: -0.2 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: null,
    lapGoal: 2,
    qualifyTime: 50,
  },
  {
    id: 'pch',
    name: 'Pacific Coast Hwy',
    tier: 1,
    description: 'Ocean cliffs, sunset views. Moderate\ncurves, light traffic.',
    setting: 'Coastal sunset',
    skyColor:   '#ff7040',
    groundColor:'#8B7355',
    oceanLeft:   true,
    roadColor:  '#484848',
    lineColor:  '#ffffff',
    hazards: ['traffic_light', 'pothole'],
    trafficDensity: 0.35,
    length: 165,
    curves: [
      { start: 15,  end: 37,  curve: 0.5 },
      { start: 60,  end: 82,  curve: -0.4 },
      { start: 112, end: 135, curve: 0.6 },
    ],
    hills: [{ start: 45, end: 67, height: 0.4 }],
    dirtZones: [],
    iceZones: [],
    unlockRequires: null,
    lapGoal: 2,
    qualifyTime: 50,
  },

  // ── TIER 2: INTERMEDIATE ──────────────────
  {
    id: 'tokyo',
    name: 'Downtown Tokyo',
    tier: 2,
    night: true,
    description: 'Night racing through neon-lit streets.\nHeavy traffic, oil slicks.',
    setting: 'City night',
    skyColor:   '#050520',
    groundColor:'#1a1a2e',
    roadColor:  '#2a2a2a',
    lineColor:  '#00ffff',
    hazards: ['traffic_heavy', 'oil'],
    trafficDensity: 0.65,
    length: 180,
    curves: [
      { start: 7,   end: 22,  curve: 0.7 },
      { start: 37,  end: 52,  curve: -0.8 },
      { start: 75,  end: 90,  curve: 0.6 },
      { start: 120, end: 135, curve: -0.7 },
      { start: 150, end: 165, curve: 0.5 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier1',
    lapGoal: 2,
    qualifyTime: 50,
  },
  {
    id: 'la_freeway',
    name: 'LA Freeway',
    tier: 2,
    description: 'Multi-lane chaos. Weave through\nLA traffic at high speed.',
    setting: 'Urban day',
    skyColor:   '#c0d8f0',
    groundColor:'#808080',
    roadColor:  '#606060',
    lineColor:  '#ffffff',
    hazards: ['traffic_heavy', 'pothole', 'debris'],
    trafficDensity: 0.70,
    length: 150,
    curves: [
      { start: 22,  end: 37,  curve: 0.3 },
      { start: 75,  end: 90,  curve: -0.3 },
      { start: 120, end: 135, curve: 0.4 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier1',
    lapGoal: 2,
    qualifyTime: 50,
  },

  // ── TIER 3: ADVANCED ──────────────────────
  {
    id: 'monaco',
    name: 'Monaco GP',
    tier: 3,
    description: 'Tight hairpins, armco barriers.\nOne mistake ends your race.',
    setting: 'City circuit day',
    skyColor:   '#5599cc',
    groundColor:'#909090',
    roadColor:  '#3a3a3a',
    lineColor:  '#ffffff',
    hazards: ['barrier', 'debris', 'traffic_medium'],
    trafficDensity: 0.50,
    length: 135,
    curves: [
      { start: 7,   end: 18,  curve: 1.2 },
      { start: 26,  end: 37,  curve: -1.0 },
      { start: 52,  end: 63,  curve: 1.5 },
      { start: 75,  end: 86,  curve: -1.3 },
      { start: 105, end: 116, curve: 1.1 },
      { start: 121, end: 131, curve: -0.9 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier2',
    lapGoal: 2,
    qualifyTime: 50,
  },
  {
    id: 'swiss_alps',
    name: 'Swiss Alps',
    tier: 3,
    description: 'Mountain switchbacks, ice patches,\nbreathtaking drops.',
    setting: 'Mountain snow',
    skyColor:   '#d0e8ff',
    groundColor:'#ffffff',
    roadColor:  '#555566',
    lineColor:  '#ffff00',
    hazards: ['ice', 'pothole', 'debris'],
    trafficDensity: 0.30,
    length: 195,
    curves: [
      { start: 15,  end: 30,  curve: 0.9 },
      { start: 41,  end: 56,  curve: -1.1 },
      { start: 75,  end: 90,  curve: 1.3 },
      { start: 108, end: 123, curve: -1.2 },
      { start: 150, end: 165, curve: 1.0 },
      { start: 176, end: 191, curve: -0.8 },
    ],
    hills: [
      { start: 0,   end: 60,  height: 0.6 },
      { start: 97,  end: 150, height: 0.8 },
    ],
    dirtZones: [],
    iceZones: [
      { start: 30,  end: 45  },
      { start: 75,  end: 90  },
      { start: 135, end: 157 },
    ],
    unlockRequires: 'tier2',
    lapGoal: 2,
    qualifyTime: 50,
  },

  // ── TIER 4: EXPERT ────────────────────────
  {
    id: 'dubai',
    name: 'Dubai Sheikh Zayed',
    tier: 4,
    night: true,
    description: 'Wide, fast, luxury. Night skyline.\nHigh-speed debris zones.',
    setting: 'City night luxury',
    skyColor:   '#020215',
    groundColor:'#1a1008',
    roadColor:  '#1a1a1a',
    lineColor:  '#ffd700',
    hazards: ['traffic_heavy', 'debris', 'oil'],
    trafficDensity: 0.60,
    length: 210,
    curves: [
      { start: 37,  end: 52,  curve: 0.4 },
      { start: 97,  end: 112, curve: -0.3 },
      { start: 157, end: 180, curve: 0.5 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier3',
    lapGoal: 2,
    qualifyTime: 50,
  },
  {
    id: 'fuji',
    name: 'Fuji Speedway',
    tier: 4,
    weather: 'rain',
    description: 'Nod to the original. Fast circuit\nwith a legendary final corner.\nWet conditions.',
    setting: 'Racetrack rain',
    skyColor:   '#6688aa',
    groundColor:'#4a7a30',
    roadColor:  '#404040',
    lineColor:  '#ffffff',
    hazards: ['traffic_medium', 'debris', 'oil'],
    trafficDensity: 0.55,
    length: 190,
    curves: [
      { start: 22,  end: 41,  curve: 0.6 },
      { start: 60,  end: 75,  curve: -0.4 },
      { start: 105, end: 123, curve: 0.8 },
      { start: 150, end: 165, curve: -1.0 },
      { start: 176, end: 186, curve: 1.2 },
    ],
    hills: [{ start: 37, end: 75, height: 0.3 }],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier3',
    lapGoal: 2,
    qualifyTime: 50,
  },

  // ── TIER 5: MASTER ────────────────────────
  {
    id: 'amalfi',
    name: 'Amalfi Coast',
    tier: 5,
    weather: 'fog',
    description: 'Impossibly narrow cliff roads. One\nwrong move = into the sea.\nSea fog.',
    setting: 'Mediterranean cliff',
    skyColor:   '#2266aa',
    groundColor:'#4a8040',
    roadColor:  '#505050',
    lineColor:  '#ffffff',
    hazards: ['barrier', 'pothole', 'debris', 'traffic_medium'],
    trafficDensity: 0.50,
    length: 150,
    curves: [
      { start: 3,   end: 15,  curve: 1.4 },
      { start: 21,  end: 31,  curve: -1.6 },
      { start: 41,  end: 52,  curve: 1.5 },
      { start: 60,  end: 71,  curve: -1.3 },
      { start: 82,  end: 93,  curve: 1.6 },
      { start: 105, end: 116, curve: -1.4 },
      { start: 127, end: 138, curve: 1.2 },
      { start: 144, end: 150, curve: -1.0 },
    ],
    hills: [
      { start: 0,   end: 75,  height: 0.5 },
      { start: 75,  end: 150, height: 0.7 },
    ],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier4',
    lapGoal: 2,
    qualifyTime: 50,
  },
  {
    id: 'baja',
    name: 'Baja California',
    tier: 5,
    description: 'Desert off-road madness. Dirt, rocks,\njumps. Raptor territory.',
    setting: 'Desert off-road',
    skyColor:   '#d06020',
    groundColor:'#c87820',
    roadColor:  '#a06030',
    lineColor:  '#ffaa00',
    hazards: ['dirt_heavy', 'pothole', 'jump', 'debris'],
    trafficDensity: 0.25,
    length: 225,
    curves: [
      { start: 15,  end: 33,  curve: 0.7 },
      { start: 52,  end: 67,  curve: -0.8 },
      { start: 90,  end: 108, curve: 0.9 },
      { start: 135, end: 150, curve: -0.6 },
      { start: 180, end: 198, curve: 0.7 },
    ],
    hills: [
      { start: 22,  end: 52,  height: 0.5 },
      { start: 97,  end: 127, height: 0.7 },
      { start: 165, end: 202, height: 0.6 },
    ],
    dirtZones: [
      { start: 0,   end: 225 }   // entire track is dirt
    ],
    iceZones: [],
    unlockRequires: 'tier4',
    lapGoal: 2,
    qualifyTime: 50,
  },
  {
    id: 'autobahn',
    name: 'Autobahn',
    tier: 5,
    description: 'No speed limit. Pure top-end\nspeed run. Debris everywhere.',
    setting: 'German highway',
    skyColor:   '#708090',
    groundColor:'#556b2f',
    roadColor:  '#3a3a3a',
    lineColor:  '#ffffff',
    hazards: ['traffic_heavy', 'debris', 'oil'],
    hazardSpawnRate: 0.006,          // lighter debris — high-speed highway, not a junkyard
    trafficDensity: 0.75,
    length: 240,
    curves: [
      { start: 45,  end: 60,  curve: 0.2 },
      { start: 120, end: 135, curve: -0.2 },
      { start: 195, end: 210, curve: 0.2 },
    ],
    hills: [],
    dirtZones: [],
    iceZones: [],
    unlockRequires: 'tier4',
    lapGoal: 2,
    qualifyTime: 50,
    cobraPrize: true,                // qualifying here unlocks the Shelby Cobra
  },
  {
    id: 'nullarbor',
    name: 'Nullarbor Plain',
    tier: 5,
    description: 'Dead straight. Endless horizon.\nPure speed test. Australia.',
    setting: 'Outback straight',
    skyColor:   '#c0a060',
    groundColor:'#a07840',
    roadColor:  '#505040',
    lineColor:  '#ffffff',
    hazards: ['pothole', 'debris', 'dirt_patches'],
    trafficDensity: 0.20,
    length: 300,
    curves: [],
    hills: [],
    dirtZones: [
      { start: 60,  end: 75  },
      { start: 150, end: 180 },
      { start: 247, end: 277 },
    ],
    iceZones: [],
    unlockRequires: 'tier4',
    lapGoal: 2,
    qualifyTime: 50,
  },
];

// ─── Unlock system ────────────────────────────
const UnlockManager = {
  // Stored in localStorage
  _key: 'pp_unlocked_tiers',

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
  _raceKey: 'pp_completed_tracks',

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
  const KEY = 'vr_lb_v1';

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
  function getTotalPoints() {
    const PTS = [10, 7, 5, 3, 1];
    let pts = 0;
    const data = _load();
    Object.values(data).forEach(entries => {
      entries.forEach(e => { pts += (PTS[e.pos - 1] || 0); });
    });
    return pts;
  }

  function resetAll() {
    try { localStorage.removeItem(KEY); } catch(e) {}
  }

  return { record, getTrack, getBest, getTotalPoints, resetAll };
})();

// ─── Cobra unlock ──────────────────────────────
const CobraUnlock = {
  _key: 'vr_cobra_v1',
  isUnlocked() { try { return !!localStorage.getItem(this._key); } catch(e) { return false; } },
  unlock()     { try { localStorage.setItem(this._key, '1');      } catch(e) {} },
  reset()      { try { localStorage.removeItem(this._key);         } catch(e) {} },
};

// ─── Full progress reset (invoked from title screen button) ──
const ProgressReset = {
  wipe() {
    UnlockManager.resetAll();
    Leaderboard.resetAll();
    CobraUnlock.reset();
  }
};
