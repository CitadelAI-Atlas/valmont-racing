// ─────────────────────────────────────────────
//  AUDIO — Web Audio API retro chiptune engine
//  Exposed as AudioFX so we don't shadow window.Audio (HTMLAudioElement).
// ─────────────────────────────────────────────

const AudioFX = (() => {
  let ctx = null;
  let enabled = false;
  let engineNode = null;
  let engineGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicActive = false;

  // Web Audio lookahead scheduler state
  let nextNoteTime = 0;
  let noteIndex = 0;
  let schedulerTimer = null;
  let currentPattern = 0;
  const NOTE_DUR = 0.12;
  const SCHEDULE_AHEAD = 0.18; // seconds
  const TICK_MS = 40;

  // Crash uses a fixed-length white noise buffer. Built once at init so
  // every hit reuses the same samples — no per-crash allocation / GC churn.
  let _crashBuf = null;

  function _init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.15;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.7;
    sfxGain.connect(ctx.destination);
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(ctx.destination);

    const size = Math.floor(ctx.sampleRate * 0.3);
    _crashBuf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = _crashBuf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  }

  // ── Engine sound (oscillator that pitches with speed) ──
  function startEngine() {
    if (!ctx || !enabled) return;
    if (engineNode) return;
    engineNode = ctx.createOscillator();
    engineNode.type = 'sawtooth';
    engineNode.frequency.value = 80;
    engineNode.connect(engineGain);
    engineNode.start();
    engineGain.gain.value = 0.08;
  }

  function setEngineSpeed(speedRatio) {
    if (!engineNode || !engineGain) return;
    engineNode.frequency.setTargetAtTime(80 + speedRatio * 320, ctx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(0.04 + speedRatio * 0.07, ctx.currentTime, 0.05);
  }

  function stopEngine() {
    if (!engineNode) return;
    try { engineNode.stop(); } catch(e) {}
    try { engineNode.disconnect(); } catch(e) {}
    engineNode = null;
    if (engineGain) engineGain.gain.value = 0;
  }

  // ── Retro chiptune music ──────────────────
  const PATTERNS = [
    [261, 329, 392, 523, 392, 329, 261, 196,
     220, 277, 329, 440, 329, 277, 220, 165],
    [392, 440, 494, 523, 494, 440, 392, 349,
     330, 392, 440, 494, 440, 392, 330, 294],
    [130, 164, 196, 261, 196, 164, 130, 110,
     147, 185, 220, 294, 220, 185, 147, 123],
  ];

  function _playNote(freq, time, dur) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.9);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(time);
    osc.stop(time + dur);
    // Self-cleanup: disconnect both nodes when the oscillator stops playing.
    osc.onended = () => {
      try { osc.disconnect(); } catch(e) {}
      try { gain.disconnect(); } catch(e) {}
    };
  }

  // Lookahead scheduler — enqueue notes up to SCHEDULE_AHEAD into the future.
  // Keeps timing rock-solid even if the setInterval tick drifts or the tab
  // briefly throttles.
  function _tick() {
    if (!ctx || !enabled || !musicActive) return;
    const pattern = PATTERNS[currentPattern % PATTERNS.length];
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      _playNote(pattern[noteIndex % pattern.length], nextNoteTime, NOTE_DUR);
      nextNoteTime += NOTE_DUR;
      noteIndex++;
    }
  }

  function startMusic() {
    if (!ctx || !enabled) return;
    if (musicActive) return;
    musicActive = true;
    noteIndex = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = setInterval(_tick, TICK_MS);
    _tick();
  }

  function stopMusic() {
    musicActive = false;
    if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
    // Notes already scheduled will self-clean via onended; no force-stop needed.
  }

  function nextPattern() {
    currentPattern++;
  }

  // ── SFX (all routed through sfxGain so master volume works) ──
  function playCrash() {
    if (!ctx || !enabled || !_crashBuf) return;
    const source = ctx.createBufferSource();
    const gain   = ctx.createGain();
    source.buffer = _crashBuf;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    source.connect(gain);
    gain.connect(sfxGain);
    source.start();
    source.onended = () => {
      try { source.disconnect(); } catch(e) {}
      try { gain.disconnect();   } catch(e) {}
    };
  }

  function _toneBurst(freq, startOffset, dur) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(sfxGain);
    osc.start(t0); osc.stop(t0 + dur);
    osc.onended = () => {
      try { osc.disconnect(); } catch(e) {}
      try { gain.disconnect(); } catch(e) {}
    };
  }

  function playCheckpoint() {
    if (!ctx || !enabled) return;
    [523, 659, 784].forEach((freq, i) => _toneBurst(freq, i * 0.1, 0.12));
  }

  function playCountdown(n) {
    if (!ctx || !enabled) return;
    _toneBurst(n === 0 ? 880 : 440, 0, 0.2);
  }

  // ── Visibility / pagehide handling ────────
  // Silences audio when the page is backgrounded so we don't burn battery
  // or leave a zombie oscillator running.
  let _wasMusicActive = false;
  function _suspend() {
    _wasMusicActive = musicActive;
    stopMusic();
    stopEngine();
    if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch(e) {} }
  }
  function _resumeFromHidden() {
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch(e) {} }
    if (enabled && _wasMusicActive) startMusic();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) _suspend();
    else _resumeFromHidden();
  });
  window.addEventListener('pagehide', _suspend);

  return {
    toggle() {
      _init();
      enabled = !enabled;
      if (enabled) {
        startMusic();
      } else {
        stopMusic();
        stopEngine();
      }
      return enabled;
    },
    isEnabled() { return enabled; },
    startEngine,
    stopEngine,
    setEngineSpeed,
    startMusic,
    stopMusic,
    nextPattern,
    playCrash,
    playCheckpoint,
    playCountdown,
    resume() {
      _init();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
  };
})();
