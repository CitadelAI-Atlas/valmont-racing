// ─────────────────────────────────────────────
//  AUDIO — Web Audio API retro chiptune engine
// ─────────────────────────────────────────────

const Audio = (() => {
  let ctx = null;
  let enabled = false;
  let engineNode = null;
  let engineGain = null;
  let musicNodes = [];
  let musicGain = null;
  let musicInterval = null;
  let currentPattern = 0;

  function _init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.15;
    musicGain.connect(ctx.destination);
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(ctx.destination);
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
    // speedRatio 0..1 → pitch 80Hz..400Hz
    engineNode.frequency.setTargetAtTime(80 + speedRatio * 320, ctx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(0.04 + speedRatio * 0.07, ctx.currentTime, 0.05);
  }

  function stopEngine() {
    if (!engineNode) return;
    engineNode.stop();
    engineNode.disconnect();
    engineNode = null;
    if (engineGain) engineGain.gain.value = 0;
  }

  // ── Retro chiptune music ──────────────────
  // Simple arpeggio patterns played with square waves
  const PATTERNS = [
    // Pattern 0: upbeat race theme
    [261, 329, 392, 523, 392, 329, 261, 196,
     220, 277, 329, 440, 329, 277, 220, 165],
    // Pattern 1: faster variation
    [392, 440, 494, 523, 494, 440, 392, 349,
     330, 392, 440, 494, 440, 392, 330, 294],
    // Pattern 2: bass-heavy
    [130, 164, 196, 261, 196, 164, 130, 110,
     147, 185, 220, 294, 220, 185, 147, 123],
  ];

  let noteIndex = 0;
  let noteDuration = 0.12; // seconds per note

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
    musicNodes.push(osc);
  }

  function _scheduleMusic() {
    if (!ctx || !enabled) return;
    const pattern = PATTERNS[currentPattern % PATTERNS.length];
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const freq = pattern[noteIndex % pattern.length];
      _playNote(freq, now + i * noteDuration, noteDuration);
      noteIndex++;
    }
    // Clean up old nodes
    musicNodes = musicNodes.filter(n => {
      try { n.stop(0); } catch(e) {}
      return false;
    });
  }

  function startMusic() {
    if (!ctx || !enabled) return;
    stopMusic();
    noteIndex = 0;
    _scheduleMusic();
    musicInterval = setInterval(_scheduleMusic, noteDuration * 4 * 1000);
  }

  function stopMusic() {
    if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
    musicNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    musicNodes = [];
  }

  function nextPattern() {
    currentPattern++;
    stopMusic();
    startMusic();
  }

  // ── SFX ──────────────────────────────────
  function playCrash() {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  function playCheckpoint() {
    if (!ctx || !enabled) return;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.12);
    });
  }

  function playCountdown(n) {
    if (!ctx || !enabled) return;
    const freq = n === 0 ? 880 : 440;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // ── Public API ────────────────────────────
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
      if (ctx && ctx.state === 'suspended') ctx.resume();
    }
  };
})();
