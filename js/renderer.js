// ─────────────────────────────────────────────
//  RENDERER — Pseudo-3D road engine (portrait)
//  Smooth trapezoid road edges, proper sprite scaling
// ─────────────────────────────────────────────

const Renderer = (() => {
  const DRAW_DISTANCE = GameConstants.DRAW_DISTANCE;
  const ROAD_WIDTH    = GameConstants.ROAD_WIDTH;

  // Damage vignette cache — radial gradient geometry is stable per (W, H).
  // Opacity is modulated via globalAlpha at draw time, so one gradient serves
  // every damage level. Rebuilt only on canvas resize.
  let _vignetteCache = null;
  function _damageVignette(ctx, W, H) {
    if (_vignetteCache && _vignetteCache.w === W && _vignetteCache.h === H) return _vignetteCache.grad;
    const g = ctx.createRadialGradient(W/2, H*0.85, W*0.15, W/2, H*0.85, W*0.70);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(120,20,0,1)');
    _vignetteCache = { w: W, h: H, grad: g };
    return g;
  }

  function buildSegments(track) {
    const segs = [];
    const total = track.length * 20;
    for (let i = 0; i < total; i++) {
      const pos = i / 10;
      let curve = 0, hill = 0;
      for (const c of track.curves) {
        if (pos >= c.start && pos < c.end) {
          const t = (pos - c.start) / (c.end - c.start);
          curve = c.curve * Math.sin(t * Math.PI);
        }
      }
      for (const h of track.hills) {
        if (pos >= h.start && pos < h.end) {
          const t = (pos - h.start) / (h.end - h.start);
          hill = Math.sin(t * Math.PI) * h.height;
        }
      }
      let surface = 'road';
      for (const d of (track.dirtZones || [])) {
        if (pos >= d.start && pos < d.end) { surface = 'dirt'; break; }
      }
      for (const ic of (track.iceZones || [])) {
        if (pos >= ic.start && pos < ic.end) { surface = 'ice'; break; }
      }
      segs.push({
        index: i, curve, hill, surface,
        stripe: Math.floor(i / 3) % 2 === 0,
        isFinish: i < 4,
        // staticSprites = hazards, scenery, finish-line poles (long-lived)
        // trafficSprites = traffic cars (rebuilt each frame)
        // Kept separate so the per-frame traffic refresh doesn't have to
        // filter-and-rebuild every segment's sprite array.
        staticSprites:  [],
        trafficSprites: [],
      });
    }
    return segs;
  }

  // ── Sky + horizon cache ────────────────────
  // Sky gradient, stars, sun/moon, clouds, horizon silhouette — all
  // deterministic per-track. Render once into an offscreen canvas keyed on
  // (track.id, W, H) and blit each frame. This removes ~20% of frame cost
  // on the more elaborate skylines (Tokyo, Dubai) and eliminates per-frame
  // gradient/random work entirely.
  const _skyCache = new Map();
  function _getSkyLayer(track, W, H, horizon) {
    const key = track.id + '|' + W + 'x' + H;
    let cached = _skyCache.get(key);
    if (cached) return cached;

    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const c = off.getContext('2d');

    // Sky
    const sky = c.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, track.skyColor);
    sky.addColorStop(1, _darken(track.skyColor, 0.6));
    c.fillStyle = sky;
    c.fillRect(0, 0, W, horizon);
    _drawSkyDetails(c, track, W, horizon);
    _drawHorizonSilhouette(c, track, W, horizon);

    _skyCache.set(key, off);
    // Cap cache to avoid unbounded growth across resize/orientation cycles.
    if (_skyCache.size > 8) {
      const firstKey = _skyCache.keys().next().value;
      _skyCache.delete(firstKey);
    }
    return off;
  }
  function invalidateSkyCache() { _skyCache.clear(); }

  // ── Main render ────────────────────────────
  // fx (optional): { maxSpeed, shakeX, shakeY, damage, nitro, banking }
  //   maxSpeed — used for speed-line intensity ratio
  //   shakeX/Y — camera-shake pixel offset (game.js computes, renderer applies)
  //   damage   — 0..1 cumulative player damage (drives smoke + red tint)
  //   nitro    — boosted motion lines + FOV warp stub
  //   banking  — -1..1 horizon tilt target (driven by current seg curve)
  function render(ctx, track, segments, playerZ, playerX, playerSpeed, W, H, fx) {
    W = W || ctx.canvas.width;
    H = H || ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    fx = fx || {};
    const shakeX = fx.shakeX || 0;
    const shakeY = fx.shakeY || 0;
    if (shakeX || shakeY) { ctx.save(); ctx.translate(shakeX, shakeY); }

    const horizon = H * 0.40;
    const roadH   = H - horizon;

    // Blit cached sky + horizon silhouette layer, optionally banked on curves.
    const bank = fx.banking || 0;
    if (bank) {
      ctx.save();
      ctx.translate(W / 2, horizon);
      ctx.rotate(bank * 0.06);    // max ~3.4° tilt — subtle, not arcade-gaudy
      ctx.translate(-W / 2, -horizon);
      ctx.drawImage(_getSkyLayer(track, W, H, horizon), 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(_getSkyLayer(track, W, H, horizon), 0, 0);
    }

    // Ground (below horizon) with depth gradient — cheap, kept per-frame
    // so dynamic ocean/ground behavior stays responsive.
    if (track.oceanLeft) {
      const og = ctx.createLinearGradient(0, horizon, 0, H);
      og.addColorStop(0, _lighten('#1a5a90', 0.18));
      og.addColorStop(1, _darken('#1a5a90', 0.72));
      ctx.fillStyle = og;
      ctx.fillRect(0, horizon, W / 2, roadH);
      const gg = ctx.createLinearGradient(0, horizon, 0, H);
      gg.addColorStop(0, _lighten(track.groundColor, 0.18));
      gg.addColorStop(1, _darken(track.groundColor, 0.72));
      ctx.fillStyle = gg;
      ctx.fillRect(W / 2, horizon, W / 2, roadH);
    } else {
      const gg = ctx.createLinearGradient(0, horizon, 0, H);
      gg.addColorStop(0, _lighten(track.groundColor, 0.18));
      gg.addColorStop(1, _darken(track.groundColor, 0.72));
      ctx.fillStyle = gg;
      ctx.fillRect(0, horizon, W, roadH);
    }

    const totalSegs = segments.length;
    const startSeg  = Math.floor(playerZ) % totalSegs;

    // ── Project segments (near → far) ────────
    // Non-linear n steps: fine near the player (reduces blocky close strips),
    // coarser farther away where strips are already thin.
    const proj = [];
    let cumCurve = 0;
    let cumHill  = 0;

    let n = 1;
    while (n <= DRAW_DISTANCE) {
      const step = n < 2  ? 0.15 :
                   n < 5  ? 0.30 :
                   n < 15 ? 0.75 :
                   n < 60 ? 1.5  : 3;

      const idx   = (startSeg + Math.round(n)) % totalSegs;
      const seg   = segments[idx];
      const scale = 1 / n;

      const screenY = horizon + roadH * scale + cumHill * scale * roadH;
      const roadW   = ROAD_WIDTH * scale * (W / 1000);
      const midX    = W / 2 - playerX * roadW * 0.6 + cumCurve;

      cumCurve += seg.curve * scale * W * 0.15 * step;
      cumHill  -= seg.hill  * scale * 0.5      * step;

      proj.push({ seg, screenY, roadW, midX, scale, n });
      n += step;
    }

    // Pre-compute each segment's closest proj index so sprites are drawn
    // exactly once (fractional stepping can map the same segment multiple times).
    // proj[0] = n≈1 (closest), so first occurrence = smallest i = correct scale.
    const segClosest = new Map();
    for (let i = 0; i < proj.length; i++) {
      if (!segClosest.has(proj[i].seg)) segClosest.set(proj[i].seg, i);
    }

    // ── Draw far → near (painter's algorithm) ──
    // Each strip is a TRAPEZOID between this segment and the next farther one
    for (let i = proj.length - 1; i >= 0; i--) {
      const cur = proj[i];

      // "top" row = next farther segment (or horizon)
      let topY, topMidX, topRoadW;
      if (i < proj.length - 1) {
        const far = proj[i + 1];
        topY     = far.screenY;
        topMidX  = far.midX;
        topRoadW = far.roadW;
      } else {
        topY     = horizon;
        topMidX  = W / 2 + cumCurve; // far vanishing point
        topRoadW = 0;
      }

      const botY     = cur.screenY;
      const botMidX  = cur.midX;
      const botRoadW = cur.roadW;

      if (botY <= topY) continue;

      _drawTrapStrip(ctx, cur.seg, track, W,
        topY, topMidX, topRoadW,
        botY, botMidX, botRoadW);

      // ── Sprites ────────────────────────────
      // Only draw sprites at the closest proj entry for this segment —
      // duplicate entries (same seg, different fractional n) must not double-render.
      if (segClosest.get(cur.seg) !== i) continue;
      // Iterate static + traffic lists together without allocating a new array.
      const _sta = cur.seg.staticSprites, _tra = cur.seg.trafficSprites;
      const _staLen = _sta.length, _total = _staLen + _tra.length;
      for (let _k = 0; _k < _total; _k++) {
        const sprite = _k < _staLen ? _sta[_k] : _tra[_k - _staLen];
        if (sprite.type === 'car' && cur.n < 1.1) continue;

        let sY = cur.screenY, sRW = cur.roadW, sMX = cur.midX;
        let sx, sh, sw;

        if (sprite.type === 'car') {
          // Sub-segment interpolation: blend between this segment and the next
          // farther one using zFrac — eliminates segment-boundary Y snapping.
          if (sprite.zFrac !== undefined && i < proj.length - 1) {
            const far = proj[i + 1];
            const f   = sprite.zFrac;
            sY  = cur.screenY + (far.screenY - cur.screenY) * f;
            sRW = cur.roadW   + (far.roadW   - cur.roadW)   * f;
            sMX = cur.midX    + (far.midX    - cur.midX)    * f;
          }
          // Tighter lane multiplier keeps cars on the road; clamp to road edges
          const laneOffset = sprite.lane * sRW * 0.62;
          sx = sMX + Math.max(-sRW * 0.80, Math.min(sRW * 0.80, laneOffset));
          sw = Math.min(sRW * 0.38, W * 0.22);
          sh = sw * 1.20;
        } else {
          // Scenery / hazards — original formula, no clamp
          sx = cur.midX + sprite.lane * cur.roadW * 0.80;
          const baseH = Math.max(2, cur.roadW * 0.90);
          sh = baseH * (sprite.hScale || 1);
          sw = sh * (sprite.wRatio || 1.4);
        }

        _drawSprite(ctx, sprite, sx, sY - sh, sw, sh);
      }
    }

    // ── Distance fog / atmosphere band ──────
    // Fade far segments toward an atmospheric band so the horizon dissolves
    // smoothly. track.weather mode picks the flavour:
    //   'fog'            — thick grey, covers ~80% of road area
    //   'rush_hour_haze' — warm ochre/brown smog, medium thickness (Atlanta)
    //   (default)        — thin band tinted toward track.skyColor
    const wm = track.weather;
    let fogCol = track.skyColor || '#88a';
    let fogSpan = 0.45;
    let fogAlpha = 0.55;
    if (wm === 'fog') {
      fogCol = '#cad2d8'; fogSpan = 0.80; fogAlpha = 0.78;
    } else if (wm === 'rush_hour_haze') {
      fogCol = '#c0a478'; fogSpan = 0.58; fogAlpha = 0.60;
    }
    const fogTop = horizon;
    const fogBot = horizon + roadH * fogSpan;
    const fogG = ctx.createLinearGradient(0, fogTop, 0, fogBot);
    fogG.addColorStop(0, _alpha(fogCol, fogAlpha));
    fogG.addColorStop(1, _alpha(fogCol, 0));
    ctx.fillStyle = fogG;
    ctx.fillRect(0, fogTop, W, fogBot - fogTop);

    // ── Rain ─────────────────────────────────
    // Diagonal streaks across the whole view, animated via playerZ so they
    // scroll at car speed. Density scales slightly with speed for motion feel.
    if (track.weather === 'rain') {
      ctx.strokeStyle = 'rgba(180,200,230,0.45)';
      ctx.lineWidth = 1;
      const drops = 90;
      const seed3 = (playerZ * 41) | 0;
      const scroll = (playerZ * 80) % 40;
      ctx.beginPath();
      for (let i = 0; i < drops; i++) {
        const rx = ((seed3 + i * 53) % 1000) / 1000 * W;
        const ry = (((i * 31) % 100) / 100 * H + scroll) % H;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 14);
      }
      ctx.stroke();
    }

    // Compute throttle ratio — kept only for internal surface/particle
    // calculations below. Speed lines themselves are gated purely on nitro
    // (not throttle) so the "starburst" is reserved as a boost reward.
    const maxS = fx.maxSpeed || 1;
    const spdR = maxS > 0 ? playerSpeed / maxS : 0;

    // ── Speed lines (nitro-only) ─────────────
    // Short horizontal streaks from the screen edges inward — reads as motion
    // without the radial-burst arcade filter look. Low count + low alpha.
    // Suppressed under prefers-reduced-motion — streaks are exactly the kind
    // of vestibular trigger the setting exists to avoid.
    if (fx.nitro && !fx.reducedMotion) {
      const n = 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      const seed = (playerZ * 13) | 0;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const side = i < n / 2 ? -1 : 1;     // half left edge, half right
        const y    = horizon + ((i * 53) % 100) / 100 * roadH * 0.95;
        const x0   = side < 0 ? 0 : W;
        const len  = W * (0.08 + ((seed + i * 17) % 50) / 500);
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + side * -len, y);     // inward toward vanishing point
      }
      ctx.stroke();
    }

    // Player car
    _drawPlayerCar(ctx, W, H, playerX, window._selectedCar);

    // ── Surface particles ────────────────────
    // Dust/powder kicked up behind the player on non-road surfaces. Scales
    // with current speed so slow-rolling on dirt gets a wisp, flat-out gets
    // a plume.
    if ((fx.surface === 'dirt' || fx.surface === 'ice') && spdR > 0.15) {
      const col = fx.surface === 'ice'
        ? `rgba(230,240,255,${(0.30 + spdR * 0.35).toFixed(2)})`
        : `rgba(170,130,70,${(0.32 + spdR * 0.38).toFixed(2)})`;
      ctx.fillStyle = col;
      const baseX = W / 2 + playerX * W * 0.28;
      const baseY = H * 0.95;
      const n = 4 + (spdR * 6) | 0;
      const seed2 = (playerZ * 17) | 0;
      for (let i = 0; i < n; i++) {
        const ph  = ((seed2 + i * 29) % 50) / 50;
        const ox  = (((seed2 + i * 41) % 100) / 100 - 0.5) * W * 0.22;
        const py  = baseY - ph * H * 0.06;
        const r   = W * (0.012 + ph * 0.018);
        ctx.beginPath();
        ctx.ellipse(baseX + ox, py, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Damage tint + smoke ──────────────────
    // damage 0..1. Red edge vignette + rising smoke puffs from the player car.
    const dmg = fx.damage || 0;
    if (dmg > 0.15) {
      // Gradient geometry only depends on (W, H) — cache per resize, modulate
      // opacity with globalAlpha so we don't rebuild a CanvasGradient every frame.
      const vg = _damageVignette(ctx, W, H);
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = prevAlpha * Math.min(1, dmg * 0.35);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = prevAlpha;
      // Rising smoke puffs — 2-3 soft grey ellipses behind/above the car
      const cx2 = W / 2 + playerX * W * 0.28;
      const cy2 = H * 0.90;
      const puff = ((playerZ * 6) | 0) % 60;
      ctx.fillStyle = `rgba(60,60,60,${(dmg * 0.45).toFixed(2)})`;
      for (let i = 0; i < 3; i++) {
        const py = cy2 - (puff + i * 20) % 60 - 10;
        const px = cx2 + ((i * 13) % 30 - 15);
        ctx.beginPath();
        ctx.ellipse(px, py, W * 0.04 + dmg * W * 0.02, W * 0.025, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (shakeX || shakeY) ctx.restore();
  }

  // ── Trapezoid road strip ───────────────────
  // Draws ground, road, rumble, lines as proper
  // trapezoids so edges are smooth diagonals
  function _drawTrapStrip(ctx, seg, track, W,
    tY, tMX, tRW,    // top row: Y, midX, road half-width
    bY, bMX, bRW     // bottom row
  ) {
    const isStripe = seg.stripe;
    let roadCol = track.roadColor;
    if (seg.surface === 'dirt') roadCol = '#8B6030';
    if (seg.surface === 'ice')  roadCol = '#aaccee';

    // Ground strip
    if (track.oceanLeft) {
      // Left = ocean, right = ground (trapezoid each side)
      ctx.fillStyle = isStripe ? '#144e7a' : '#1a5a90';
      ctx.beginPath();
      ctx.moveTo(0, tY); ctx.lineTo(tMX - tRW, tY);
      ctx.lineTo(bMX - bRW, bY); ctx.lineTo(0, bY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = isStripe ? _darken(track.groundColor, 0.85) : track.groundColor;
      ctx.beginPath();
      ctx.moveTo(tMX + tRW, tY); ctx.lineTo(W, tY);
      ctx.lineTo(W, bY); ctx.lineTo(bMX + bRW, bY);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = isStripe ? _darken(track.groundColor, 0.85) : track.groundColor;
      ctx.fillRect(0, tY, W, bY - tY);
    }

    // Road trapezoid
    ctx.fillStyle = roadCol;
    ctx.beginPath();
    ctx.moveTo(tMX - tRW, tY);
    ctx.lineTo(tMX + tRW, tY);
    ctx.lineTo(bMX + bRW, bY);
    ctx.lineTo(bMX - bRW, bY);
    ctx.closePath();
    ctx.fill();

    // Finish line — checkered columns over the road surface
    if (seg.isFinish) {
      const N = 12;
      for (let col = 0; col < N; col++) {
        const f0 = col / N, f1 = (col + 1) / N;
        ctx.fillStyle = col % 2 === 0 ? '#000' : '#fff';
        ctx.beginPath();
        ctx.moveTo(tMX - tRW + 2 * tRW * f0, tY);
        ctx.lineTo(tMX - tRW + 2 * tRW * f1, tY);
        ctx.lineTo(bMX - bRW + 2 * bRW * f1, bY);
        ctx.lineTo(bMX - bRW + 2 * bRW * f0, bY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Rumble strips (trapezoid outside road edge)
    const tRumble = Math.max(2, tRW * 0.1);
    const bRumble = Math.max(2, bRW * 0.1);
    ctx.fillStyle = isStripe ? '#cc0000' : '#ffffff';

    // Left rumble
    ctx.beginPath();
    ctx.moveTo(tMX - tRW - tRumble, tY);
    ctx.lineTo(tMX - tRW, tY);
    ctx.lineTo(bMX - bRW, bY);
    ctx.lineTo(bMX - bRW - bRumble, bY);
    ctx.closePath();
    ctx.fill();

    // Right rumble
    ctx.beginPath();
    ctx.moveTo(tMX + tRW, tY);
    ctx.lineTo(tMX + tRW + tRumble, tY);
    ctx.lineTo(bMX + bRW + bRumble, bY);
    ctx.lineTo(bMX + bRW, bY);
    ctx.closePath();
    ctx.fill();

    // Lane dividers at ±0.33 — always drawn, solid in stripe segments
    {
      const lineCol  = track.lineColor || '#fff';
      const alpha    = isStripe ? 0.85 : 0.35;
      const lw       = Math.max(1, bRW * 0.022);
      ctx.fillStyle  = _alpha(lineCol, alpha);
      for (const side of [-0.33, 0.33]) {
        const tX = tMX + tRW * side;
        const bX = bMX + bRW * side;
        ctx.beginPath();
        ctx.moveTo(tX - lw, tY);
        ctx.lineTo(tX + lw, tY);
        ctx.lineTo(bX + lw, bY);
        ctx.lineTo(bX - lw, bY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // ── Sprites ────────────────────────────────
  function _drawSprite(ctx, sprite, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    if (sprite.type === 'finishpole') {
      const pw = Math.max(2, w * 0.12);
      // Pole
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(-pw / 2, 0, pw, h);
      ctx.fillStyle = '#888';
      ctx.fillRect(-pw / 2, 0, pw / 3, h);
      // Checkered flag at top — extends in flagDir (1=right, -1=left)
      const fd = sprite.flagDir || 1;
      const fw = w * 0.85, fh = h * 0.28;
      const fx = fd > 0 ? -pw / 2 : -pw / 2 - fw;
      const nx = 6, ny = 3;
      for (let ry = 0; ry < ny; ry++) {
        for (let cx2 = 0; cx2 < nx; cx2++) {
          ctx.fillStyle = (cx2 + ry) % 2 === 0 ? '#000' : '#fff';
          ctx.fillRect(fx + cx2 * (fw / nx), ry * (fh / ny), fw / nx + 0.5, fh / ny + 0.5);
        }
      }
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.5;
      ctx.strokeRect(fx, 0, fw, fh);

    } else if (sprite.type === 'car') {
      const trd = sprite.car && sprite.car.spriteId
                    ? Sprites.getTraffic(sprite.car.spriteId) : null;
      if (trd) {
        const { img, crop } = trd;
        const dw = w;
        const dh = dw * (crop.h / crop.w);   // preserve sprite aspect ratio
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, -dw/2, -dh/2, dw, dh);
      } else {
        drawCarTopDown(ctx, sprite.car, 0, 0, w, h);
      }
    } else if (sprite.type === 'oil') {
      ctx.fillStyle = 'rgba(20,20,40,0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.6, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,0,255,0.3)';
      ctx.lineWidth = 2; ctx.stroke();
    } else if (sprite.type === 'pothole') {
      ctx.fillStyle = '#1a1008';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.4, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (sprite.type === 'tire') {
      // Loose tire lying flat on road — foreshortened circle
      ctx.save();
      ctx.scale(1, 0.52);           // flatten to simulate lying on tarmac
      const r = w * 0.44;
      ctx.fillStyle = '#1a1a1a';    // tyre rubber
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a3a3a';  // tread ring
      ctx.lineWidth = r * 0.20;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#7a7a7a';    // alloy rim
      ctx.beginPath(); ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bababa';    // hub centre
      ctx.beginPath(); ctx.arc(0, 0, r * 0.20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (sprite.type === 'debris') {
      // Scattered chunks — dark amber/rust, visible against grey tarmac
      ctx.fillStyle = '#b84800';
      ctx.fillRect(-w * 0.28, -h * 0.12, w * 0.22, h * 0.14);
      ctx.fillStyle = '#7a3000';
      ctx.fillRect(-w * 0.02, -h * 0.07, w * 0.18, h * 0.16);
      ctx.fillStyle = '#cc5500';
      ctx.fillRect( w * 0.10, -h * 0.13, w * 0.16, h * 0.11);
    } else if (sprite.type === 'cone') {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.4);
      ctx.lineTo(-w * 0.2, h * 0.2);
      ctx.lineTo(w * 0.2, h * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-w * 0.2, -h * 0.05, w * 0.4, h * 0.06);
    } else if (sprite.type === 'ice') {
      ctx.fillStyle = 'rgba(150,220,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.7, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();

    // ── Roadside scenery (0,0 = top of sprite, h = ground level) ──
    } else if (sprite.type === 'building') {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(-w / 2, 0, w, h);
      const cols = Math.max(2, Math.floor(w / 9));
      const rows = Math.max(2, Math.floor(h / 9));
      const ww = Math.max(2, w / cols - 3);
      const wh = Math.max(2, h / rows - 3);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = (c * 3 + r * 7) % 5 > 0 ? '#ffe866' : '#111';
          ctx.fillRect(-w / 2 + 2 + c * (w / cols), 2 + r * (h / rows), ww, wh);
        }
      }
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2, 0, w, h);

    } else if (sprite.type === 'cactus') {
      const sw2 = Math.max(2, w * 0.18);
      ctx.fillStyle = '#2e7a28';
      ctx.fillRect(-sw2 / 2, 0, sw2, h);                         // stem
      ctx.fillRect(-w / 2, h * 0.35, w * 0.38 + sw2, sw2);      // left arm horiz
      ctx.fillRect(-w / 2, h * 0.18, sw2, h * 0.18 + sw2);      // left arm vert
      ctx.fillRect(w * 0.12, h * 0.45, w * 0.38 + sw2, sw2);    // right arm horiz
      ctx.fillRect(w / 2 - sw2, h * 0.28, sw2, h * 0.18 + sw2); // right arm vert

    } else if (sprite.type === 'tree') {
      ctx.fillStyle = '#5a3010';
      ctx.fillRect(-w * 0.07, h * 0.65, w * 0.14, h * 0.35);    // trunk
      const greens = ['#1a6010', '#247a18', '#1a6010'];
      for (let layer = 0; layer < 3; layer++) {
        const ly = layer * h * 0.22;
        const lw = w * (0.92 - layer * 0.20);
        ctx.fillStyle = greens[layer];
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(-lw / 2, h * 0.55 + ly * 0.28);
        ctx.lineTo( lw / 2, h * 0.55 + ly * 0.28);
        ctx.closePath(); ctx.fill();
      }

    } else if (sprite.type === 'palm') {
      ctx.fillStyle = '#8a6030';
      for (let i = 0; i < 5; i++) {           // slightly curved trunk
        const tx = w * 0.04 * Math.sin(i * 0.55);
        ctx.fillRect(tx - w * 0.06, h * 0.18 * i, w * 0.12, h * 0.22);
      }
      ctx.strokeStyle = '#3a8a1a';
      ctx.lineWidth = Math.max(1.5, w * 0.07);
      const frondAngles = [-70, -42, -16, 10, 36, 62, 86];
      for (const ang of frondAngles) {
        const rad = ang * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.08);
        ctx.lineTo(Math.sin(rad) * w * 0.62, h * 0.08 - Math.cos(rad) * h * 0.32);
        ctx.stroke();
      }

    } else if (sprite.type === 'billboard') {
      const pw = Math.max(2, w * 0.08);
      ctx.fillStyle = '#666';
      ctx.fillRect(-pw / 2, h * 0.38, pw, h * 0.62);   // pole
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(-w / 2, 0, w, h * 0.40);             // sign board
      ctx.fillStyle = '#fff';
      ctx.fillRect(-w * 0.38, h * 0.07, w * 0.76, Math.max(2, h * 0.09));
      ctx.fillRect(-w * 0.28, h * 0.22, w * 0.56, Math.max(1, h * 0.06));
      ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2, 0, w, h * 0.40);

    } else if (sprite.type === 'boulder') {
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.65, w * 0.50, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.ellipse(-w * 0.1, h * 0.50, w * 0.26, h * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();

    } else if (sprite.type === 'barn') {
      const roofH = h * 0.34;
      const bodyY = roofH;
      const bodyH = h - roofH;
      ctx.fillStyle = '#8a1a0a';
      ctx.fillRect(-w / 2, bodyY, w, bodyH);             // body
      ctx.fillStyle = '#4a0a04';
      ctx.fillRect(-w * 0.15, bodyY + bodyH * 0.38, w * 0.3, bodyH * 0.62); // door
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.moveTo(-w / 2, roofH); ctx.lineTo(0, 0); ctx.lineTo(w / 2, roofH);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w * 0.14, bodyY + bodyH * 0.39);
      ctx.lineTo( w * 0.14, h - 1);
      ctx.moveTo( w * 0.14, bodyY + bodyH * 0.39);
      ctx.lineTo(-w * 0.14, h - 1);
      ctx.stroke();

    // ── ATHENS: stadium crowd (Red & Black) ──────────
    } else if (sprite.type === 'stadium_crowd') {
      // Bleacher base
      ctx.fillStyle = '#555';
      ctx.fillRect(-w / 2, h * 0.70, w, h * 0.30);
      // Crowd torsos — alternating red/black rectangles, two rows
      const cols = Math.max(5, Math.floor(w / 4));
      const bw = w / cols;
      for (let row = 0; row < 2; row++) {
        const ry = h * (0.32 + row * 0.22);
        for (let c = 0; c < cols; c++) {
          const hash = (c * 7 + row * 3);
          ctx.fillStyle = (hash % 2 === 0) ? '#b00020' : '#1a1a1a';
          ctx.fillRect(-w / 2 + c * bw, ry, bw - 1, h * 0.18);
          // Head dab
          ctx.fillStyle = '#e8c898';
          ctx.fillRect(-w / 2 + c * bw + bw * 0.25, ry - h * 0.08, bw * 0.50, h * 0.08);
        }
      }

    // ── GARDEN CITY: beach house on stilts ───────────
    } else if (sprite.type === 'beach_house') {
      // Stilts
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(-w * 0.38, h * 0.68, w * 0.08, h * 0.32);
      ctx.fillRect( w * 0.30, h * 0.68, w * 0.08, h * 0.32);
      // Body (pastel wood)
      ctx.fillStyle = '#e8d4b0';
      ctx.fillRect(-w / 2, h * 0.30, w, h * 0.40);
      // Roof (pitched, weathered blue)
      ctx.fillStyle = '#6a90b0';
      ctx.beginPath();
      ctx.moveTo(-w * 0.58, h * 0.30);
      ctx.lineTo(0, h * 0.02);
      ctx.lineTo( w * 0.58, h * 0.30);
      ctx.closePath(); ctx.fill();
      // Porch rail
      ctx.fillStyle = '#6a4820';
      ctx.fillRect(-w * 0.50, h * 0.66, w, h * 0.04);
      // Door + window
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(-w * 0.08, h * 0.42, w * 0.18, h * 0.26);
      ctx.fillStyle = '#88bbee';
      ctx.fillRect( w * 0.14, h * 0.38, w * 0.20, h * 0.18);

    // ── ATLANTA: overpass gantry sign ────────────────
    } else if (sprite.type === 'overpass_sign') {
      // Gantry pole (assume this is the right-side pole of a gantry that spans the road)
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(-w * 0.04, h * 0.20, w * 0.08, h * 0.80);
      // Cross arm extending left (over road)
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(-w * 1.10, h * 0.20, w * 1.10, h * 0.06);
      // Green sign panel
      ctx.fillStyle = '#0f5a1a';
      ctx.fillRect(-w * 0.85, h * 0.05, w * 0.75, h * 0.22);
      // White text stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w * 0.80, h * 0.10, w * 0.65, h * 0.04);
      ctx.fillRect(-w * 0.72, h * 0.17, w * 0.48, h * 0.04);
      // Shield
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-w * 0.14, h * 0.08, w * 0.06, h * 0.16);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-w * 0.13, h * 0.10, w * 0.04, h * 0.10);

    // ── VEGAS: vertical neon casino sign ─────────────
    } else if (sprite.type === 'neon_sign') {
      // Pole
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-w * 0.06, h * 0.20, w * 0.12, h * 0.80);
      // Sign box stack (3 glowing rectangles, rising)
      const colors = ['#ff2e88', '#ffcc00', '#00e0ff'];
      for (let i = 0; i < 3; i++) {
        const y = h * (0.04 + i * 0.18);
        const bw = w * (0.85 - i * 0.08);
        ctx.fillStyle = '#111';
        ctx.fillRect(-bw / 2 - 2, y - 2, bw + 4, h * 0.16 + 4);
        ctx.fillStyle = colors[i];
        ctx.fillRect(-bw / 2, y, bw, h * 0.14);
        // Glow (simulate with lighter inset)
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-bw / 2 + 2, y + 2, bw - 4, Math.max(1, h * 0.03));
      }

    // ── ORLANDO: monorail pylon + rail beam ──────────
    } else if (sprite.type === 'monorail') {
      // Pylon
      ctx.fillStyle = '#b8b8c8';
      ctx.fillRect(-w * 0.08, h * 0.35, w * 0.16, h * 0.65);
      // Rail beam (horizontal concrete)
      ctx.fillStyle = '#d0d0d8';
      ctx.fillRect(-w * 0.55, h * 0.28, w * 1.10, h * 0.09);
      // Rail car
      ctx.fillStyle = '#f0f0f4';
      ctx.fillRect(-w * 0.42, h * 0.14, w * 0.84, h * 0.16);
      ctx.fillStyle = '#88bbee';
      ctx.fillRect(-w * 0.36, h * 0.18, w * 0.72, h * 0.06);
      ctx.fillStyle = '#d8442a';
      ctx.fillRect(-w * 0.42, h * 0.28, w * 0.84, h * 0.02);

    // ── ORLANDO: balloon cluster ─────────────────────
    } else if (sprite.type === 'balloon') {
      // String (from ground hook)
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.55);
      ctx.stroke();
      // Three balloons, different colors
      const bc = [['#e02030', -w * 0.22, h * 0.28],
                  ['#ffcc00',  w * 0.18, h * 0.22],
                  ['#2a8cff', -w * 0.02, h * 0.10]];
      for (const [col, bx, by] of bc) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(bx, by, w * 0.22, h * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(bx - w * 0.06, by - h * 0.07, w * 0.05, h * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }

    // ── TULUM: thatched tiki hut ─────────────────────
    } else if (sprite.type === 'tiki_hut') {
      // Body (open sides, dark interior)
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(-w * 0.42, h * 0.48, w * 0.84, h * 0.42);
      // Support posts
      ctx.fillStyle = '#6a4a28';
      ctx.fillRect(-w * 0.44, h * 0.46, w * 0.08, h * 0.54);
      ctx.fillRect( w * 0.36, h * 0.46, w * 0.08, h * 0.54);
      // Thatch roof (triangular, multi-tone straw)
      ctx.fillStyle = '#8a6a2a';
      ctx.beginPath();
      ctx.moveTo(-w * 0.60, h * 0.48);
      ctx.lineTo(0, h * 0.08);
      ctx.lineTo( w * 0.60, h * 0.48);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a4a18';
      // Thatch stripes
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-w * 0.55 + i * w * 0.10, h * (0.42 + i * 0.015),
                     w * 0.08, Math.max(1, h * 0.02));
      }

    // ── NYC: tall narrow skyscraper ──────────────────
    } else if (sprite.type === 'skyscraper') {
      // Body is a tall thin column — narrower than the generic building sprite
      ctx.fillStyle = '#2a2a32';
      const sw = w * 0.70;
      ctx.fillRect(-sw / 2, 0, sw, h);
      // Window grid — denser than 'building', gold at the top third
      const cols = Math.max(3, Math.floor(sw / 6));
      const rows = Math.max(6, Math.floor(h / 8));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const on = (c * 5 + r * 3) % 4 > 0;
          if (!on) { continue; }
          // Crown windows (top quarter) glow warmer
          ctx.fillStyle = (r < rows * 0.25) ? '#ffe866' : '#88ddff';
          ctx.fillRect(-sw / 2 + 2 + c * (sw / cols),
                       2 + r * (h / rows),
                       Math.max(2, sw / cols - 3),
                       Math.max(2, h / rows - 3));
        }
      }
      // Spire at top
      ctx.fillStyle = '#555';
      ctx.fillRect(-w * 0.04, -h * 0.06, w * 0.08, h * 0.08);
    }

    ctx.restore();
  }

  // ── Player car — rear view (offscreen pixel-art, crisp at any size) ─
  function _drawPlayerCar(ctx, W, H, playerX, car) {
    if (!car) return;

    const carW = W * 0.55;
    const cx   = W / 2 + playerX * W * 0.28;
    const bot  = H * 0.97;

    // Use PNG rear sprite if available
    const rd = Sprites.get(car.id, 'rear');
    if (rd) {
      const { img, crop } = rd;
      const sc = crop.scale || 1.0;
      const sw = Math.round(carW * sc);
      const sh = Math.round(crop.h * (carW / crop.w) * sc);
      ctx.save();
      ctx.imageSmoothingEnabled = true;   // bilinear for downscaled photo renders
      ctx.drawImage(img,
        crop.x, crop.y, crop.w, crop.h,
        Math.round(cx - sw / 2),
        Math.round(bot - sh),
        sw, sh);
      ctx.restore();
      return;
    }

    // Fallback: hand-coded pixel art rear view
    const bc = car.bodyColor, ac = car.accentColor;
    const type = car.type || 'sports';

    // All detail drawn on small fixed canvas, then scaled up
    // with imageSmoothingEnabled=false → true block-pixel sharpness.
    const RW = 120, RH = 84;
    const off = document.createElement('canvas');
    off.width = RW; off.height = RH;
    const oc = off.getContext('2d');

    const hi = _lighten(bc, 0.38), mid = bc;
    const sh = _darken(bc, 0.68),  dk  = _darken(bc, 0.42);

    // Scanline circle (no anti-aliasing)
    function _circ(cx, cy, r, fill) {
      oc.fillStyle = fill;
      for (let dy = -r; dy <= r; dy++) {
        const hw = Math.round(Math.sqrt(r*r - dy*dy));
        if (hw > 0) oc.fillRect(cx - hw, cy + dy, hw * 2, 1);
      }
    }

    // ─ Fixed layout (pixels in 120×84 canvas) ────────
    const BL = 8, BR = 112;               // body left / right
    const isSUV = type === 'suv' || type === 'truck';
    const cabL  = isSUV ? BL + 1 : BL + 7;
    const cabR  = isSUV ? BR - 1 : BR - 7;
    const cabT  = type === 'convertible' ? 22 : 18;
    const cabB  = isSUV ? 52 : 46;
    const trkT  = cabB;
    const trkB  = isSUV ? 64 : 60;
    const bmpT  = trkB;

    // ── TOP SECTION (roof / open cockpit) ─────────────
    if (type === 'convertible') {
      // Twin roll hoops — the definitive SL 550 feature from behind
      _circ(50, 13, 11, '#3a3a3a');          // left hoop ring
      _circ(50, 13,  8, '#1a0c04');          // hollow inside
      _circ(70, 13, 11, '#3a3a3a');          // right hoop ring
      _circ(70, 13,  8, '#1a0c04');
      // Hoop top chrome bar
      oc.fillStyle = '#aaa';  oc.fillRect(42, 3, 36, 3);
      oc.fillStyle = '#ccc';  oc.fillRect(43, 3, 34, 1);
      // Vertical posts
      oc.fillStyle = '#666';
      oc.fillRect(43, 5, 4, 18); oc.fillRect(55, 5, 4, 18);
      oc.fillRect(61, 5, 4, 18); oc.fillRect(73, 5, 4, 18);
      oc.fillStyle = '#999';
      oc.fillRect(44, 5, 2, 18); oc.fillRect(62, 5, 2, 18); // highlight
      // Headrests
      oc.fillStyle = '#5a3015'; oc.fillRect(45, 14, 11, 9);
      oc.fillStyle = '#4a2008'; oc.fillRect(46, 14,  9, 3);
      oc.fillStyle = '#5a3015'; oc.fillRect(64, 14, 11, 9);
      oc.fillStyle = '#4a2008'; oc.fillRect(65, 14,  9, 3);

    } else if (isSUV) {
      const rW = type === 'truck' ? 100 : 96, rL = (RW - rW) / 2;
      oc.fillStyle = _lighten(ac, 0.35); oc.fillRect(rL, 2, rW, 2);
      oc.fillStyle = _lighten(ac, 0.12); oc.fillRect(rL, 4, rW, 10);
      oc.fillStyle = ac;                  oc.fillRect(rL, 14, rW, 4);
      oc.fillStyle = dk;
      oc.fillRect(rL, 2, 3, 16); oc.fillRect(rL + rW - 3, 2, 3, 16);
      // Rear window
      oc.fillStyle = '#1a3a5a'; oc.fillRect(rL + 5, 5, rW - 10, 10);
      oc.fillStyle = '#3a6aaa'; oc.fillRect(rL + 5, 5, rW - 10, 2);
      oc.fillRect(rL + 5, 5, 3, 10);

    } else {
      // Sports / sedan roof
      const rW = type === 'sports' ? 60 : 74, rL = (RW - rW) / 2;
      oc.fillStyle = _lighten(bc, 0.48); oc.fillRect(rL, 2, rW, 2);
      oc.fillStyle = _lighten(bc, 0.24); oc.fillRect(rL, 4, rW, 8);
      oc.fillStyle = mid;                 oc.fillRect(rL, 12, rW, 4);
      oc.fillStyle = dk;
      oc.fillRect(rL, 2, 2, 14); oc.fillRect(rL + rW - 2, 2, 2, 14);
      // Rear window
      const wW = rW - 14, wL = (RW - wW) / 2;
      oc.fillStyle = dk; oc.fillRect(wL - 2, 4, wW + 4, 12);
      oc.fillStyle = '#1a3a5a'; oc.fillRect(wL, 5, wW, 10);
      oc.fillStyle = '#3a6aaa'; oc.fillRect(wL, 5, wW, 2); oc.fillRect(wL, 5, 3, 10);
    }

    // ── CABIN BODY SIDES ──────────────────────────────
    oc.fillStyle = hi;  oc.fillRect(cabL, cabT, cabR - cabL, 2);
    oc.fillStyle = mid; oc.fillRect(cabL, cabT + 2, cabR - cabL, cabB - cabT - 2);
    oc.fillStyle = dk;
    oc.fillRect(cabL, cabT, 4, cabB - cabT);          // left C-pillar
    oc.fillRect(cabR - 4, cabT, 4, cabB - cabT);      // right C-pillar
    if (!isSUV) {
      oc.fillStyle = '#aaa'; // belt-line chrome
      oc.fillRect(cabL + 4, cabT + (cabB - cabT) / 2 | 0, cabR - cabL - 8, 1);
    }

    // Convertible: open interior in cabin section
    if (type === 'convertible') {
      oc.fillStyle = '#120a04';
      oc.fillRect(cabL + 4, cabT + 2, cabR - cabL - 8, cabB - cabT - 4);
      // Driver seat
      oc.fillStyle = '#8b5a2b'; oc.fillRect(cabL + 6, cabT + 4, 26, cabB - cabT - 8);
      oc.fillStyle = '#a06030'; oc.fillRect(cabL + 6, cabT + 4, 26, 4);
      // Passenger seat
      oc.fillStyle = '#8b5a2b'; oc.fillRect(cabR - 32, cabT + 4, 26, cabB - cabT - 8);
      oc.fillStyle = '#a06030'; oc.fillRect(cabR - 32, cabT + 4, 26, 4);
      // Center console
      oc.fillStyle = '#0d0d0d'; oc.fillRect(55, cabT + 4, 10, cabB - cabT - 6);
    }

    // ── TRUNK / DECK ──────────────────────────────────
    oc.fillStyle = _lighten(bc, 0.20); oc.fillRect(BL, trkT, BR - BL, 2);
    oc.fillStyle = mid;                 oc.fillRect(BL, trkT + 2, BR - BL, trkB - trkT - 4);
    oc.fillStyle = sh;                  oc.fillRect(BL, trkB - 4, BR - BL, 4);
    oc.fillStyle = dk;
    oc.fillRect(BL, trkT, 3, trkB - trkT);          // left edge
    oc.fillRect(BR - 3, trkT, 3, trkB - trkT);      // right edge

    // ── TAILLIGHTS (type-specific shapes) ────────────
    if (type === 'convertible') {
      // SL 550: diagonal sweep from outer-low to inner-high at each corner
      for (let row = 0; row < 20; row++) {
        const wid = 22 - Math.round(row * 0.6);
        oc.fillStyle = row < 7 ? '#ff3300' : '#cc0000';
        oc.fillRect(BL + Math.round(row * 0.4), trkT + row, wid, 1);         // left
        oc.fillRect(BR - wid - Math.round(row * 0.4), trkT + row, wid, 1);  // right
      }
      // Bright inner strip
      oc.fillStyle = '#ff6633';
      oc.fillRect(BL + 2, trkT + 1, 10, 2);
      oc.fillRect(BR - 12, trkT + 1, 10, 2);
      // Mercedes star badge center
      oc.fillStyle = '#888'; oc.fillRect(56, trkT + 6, 8, 8);
      oc.fillStyle = '#bbb'; oc.fillRect(57, trkT + 7, 6, 6);
      oc.fillStyle = '#888'; oc.fillRect(59, trkT + 9, 2, 2);
      // Chrome lid strip
      oc.fillStyle = '#aaa'; oc.fillRect(BL + 24, trkT, BR - BL - 48, 1);

    } else if (type === 'sports') {
      // Wide outer band + chrome separator + inner bright bar
      const tlW = 22;
      oc.fillStyle = '#cc0000';
      oc.fillRect(BL,        cabT, tlW, trkB - cabT);
      oc.fillRect(BR - tlW,  cabT, tlW, trkB - cabT);
      oc.fillStyle = '#ff2200';
      oc.fillRect(BL,        cabT, tlW, 8);
      oc.fillRect(BR - tlW,  cabT, tlW, 8);
      oc.fillStyle = '#550000';
      oc.fillRect(BL,        cabT + 10, tlW, 2);
      oc.fillRect(BR - tlW,  cabT + 10, tlW, 2);
      oc.fillStyle = '#888';   // chrome separator
      oc.fillRect(BL + tlW,  cabT, 2, trkB - cabT);
      oc.fillRect(BR - tlW - 2, cabT, 2, trkB - cabT);

    } else if (type === 'sedan') {
      // CLS: tall vertical taillight at each corner
      const tlW = 20;
      oc.fillStyle = '#cc0000';
      oc.fillRect(BL,       cabT + 2, tlW, trkB - cabT - 2);
      oc.fillRect(BR - tlW, cabT + 2, tlW, trkB - cabT - 2);
      oc.fillStyle = '#ff2200';
      oc.fillRect(BL,       cabT + 2, tlW, 9);
      oc.fillRect(BR - tlW, cabT + 2, tlW, 9);
      oc.fillStyle = '#550000';
      oc.fillRect(BL,       cabT + 13, tlW, 2);
      oc.fillRect(BR - tlW, cabT + 13, tlW, 2);
      oc.fillStyle = '#888';
      oc.fillRect(BL + tlW, cabT + 2, 2, trkB - cabT - 2);
      oc.fillRect(BR - tlW - 2, cabT + 2, 2, trkB - cabT - 2);

    } else {
      // SUV / Truck: wide horizontal bar
      const tlW = 30;
      oc.fillStyle = '#cc0000';
      oc.fillRect(BL,       trkT, tlW, trkB - trkT);
      oc.fillRect(BR - tlW, trkT, tlW, trkB - trkT);
      oc.fillStyle = '#ff2200';
      oc.fillRect(BL,       trkT, tlW, 8);
      oc.fillRect(BR - tlW, trkT, tlW, 8);
      oc.fillStyle = '#550000';
      oc.fillRect(BL,       trkT + 10, tlW, 2);
      oc.fillRect(BR - tlW, trkT + 10, tlW, 2);
    }

    // ── REAR BUMPER ───────────────────────────────────
    oc.fillStyle = _darken(bc, 0.52);
    oc.fillRect(BL, bmpT, BR - BL, 3);
    oc.fillStyle = '#2e2e2e';
    oc.fillRect(BL, bmpT + 3, BR - BL, 8);
    oc.fillStyle = '#505050';
    oc.fillRect(BL, bmpT + 3, BR - BL, 2);

    // License plate
    oc.fillStyle = '#ddd';  oc.fillRect(43, bmpT + 1, 34, 8);
    oc.fillStyle = '#222';
    oc.fillRect(44, bmpT + 2, 5, 2); oc.fillRect(51, bmpT + 2, 5, 2);
    oc.fillRect(58, bmpT + 2, 5, 2); oc.fillRect(65, bmpT + 2, 5, 2);

    // Diffuser slots
    oc.fillStyle = '#111';
    oc.fillRect(BL + 4, bmpT + 9, BR - BL - 8, 4);
    oc.fillStyle = '#1e1e1e';
    for (let i = 0; i < 4; i++) {
      oc.fillRect(BL + 6 + i * 24, bmpT + 9, 18, 4);
    }

    // ── EXHAUST PIPES ─────────────────────────────────
    if (type === 'sports' || type === 'convertible') {
      // Dual oval exhausts
      for (const ex of [34, 68]) {
        oc.fillStyle = '#aaa';  oc.fillRect(ex,     bmpT + 5, 16, 8);
        oc.fillStyle = '#666';  oc.fillRect(ex,     bmpT + 5, 16, 2);
        oc.fillStyle = '#111';  oc.fillRect(ex + 2, bmpT + 6, 12, 5);
        oc.fillStyle = '#0a0a0a'; oc.fillRect(ex + 3, bmpT + 7, 10, 3);
      }
    } else if (type === 'sedan') {
      for (const ex of [36, 66]) {
        oc.fillStyle = '#999'; oc.fillRect(ex,     bmpT + 5, 14, 7);
        oc.fillStyle = '#111'; oc.fillRect(ex + 2, bmpT + 6, 10, 4);
      }
    } else {
      // Single large center pipe (truck/SUV)
      oc.fillStyle = '#888'; oc.fillRect(48, bmpT + 5, 24, 7);
      oc.fillStyle = '#111'; oc.fillRect(50, bmpT + 6, 20, 5);
    }

    // ── REAR WHEELS (scanline circles, peaking each side) ──
    const wr = 15;
    const wy = bmpT + 4;
    _circ(BL, wy, wr, '#111');                // left tyre
    _circ(BL, wy, Math.round(wr*0.64), '#888'); // left rim
    _circ(BL, wy, Math.round(wr*0.18), '#333'); // left hub
    _circ(BR, wy, wr, '#111');
    _circ(BR, wy, Math.round(wr*0.64), '#888');
    _circ(BR, wy, Math.round(wr*0.18), '#333');
    // Spoke crosses (right angles, 2 per wheel)
    oc.fillStyle = '#555';
    for (const wx of [BL, BR]) {
      const ir = Math.round(wr * 0.62);
      oc.fillRect(wx - ir, wy - 1, ir * 2, 2);
      oc.fillRect(wx - 1, wy - ir, 2, ir * 2);
      oc.fillRect(wx - Math.round(ir*0.72), wy - Math.round(ir*0.72), 2, 2);
      oc.fillRect(wx + Math.round(ir*0.70), wy - Math.round(ir*0.72), 2, 2);
    }

    // ── BLIT: scale up with pixel-perfect sharpness ───
    const scale = carW / RW;
    const carH  = RH * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off,
      Math.round(cx - carW / 2),
      Math.round(bot - carH),
      Math.round(carW),
      Math.round(carH)
    );
    ctx.restore();
  }

  function _lighten(hex, amt) {
    const c = _hex(hex);
    return `rgb(${Math.min(255, c.r + amt * 255) | 0},${Math.min(255, c.g + amt * 255) | 0},${Math.min(255, c.b + amt * 255) | 0})`;
  }

  // ── Colour helpers ─────────────────────────
  function _darken(hex, amt) {
    const c = _hex(hex);
    return `rgb(${c.r * amt | 0},${c.g * amt | 0},${c.b * amt | 0})`;
  }
  function _alpha(hex, a) {
    const c = _hex(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }
  function _hex(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  }

  // ══════════════════════════════════════════
  //  SKY & HORIZON GRAPHICS
  // ══════════════════════════════════════════

  // Deterministic per-track RNG (xorshift32) — same output every frame
  function _rng(seed) {
    let s = (seed + 1) | 0;
    return function() {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }

  // ── Stars / sun / moon / glow / clouds ────
  // Data-driven from track fields: night, sunset, moonX, horizonGlow,
  // cloudStyle, cloudCount, oceanLeft. No track.id branching here.
  function _drawSkyDetails(ctx, track, W, horizon) {
    const id       = track.id;
    const isNight  = !!track.night;
    const isSunset = !!track.sunset;
    const rng = _rng(id.charCodeAt(0) * 31 + id.length * 17);

    // Stars (night only)
    if (isNight) {
      for (let i = 0; i < 150; i++) {
        const bri = 0.45 + rng() * 0.55;
        ctx.fillStyle = `rgba(255,255,255,${bri.toFixed(2)})`;
        ctx.fillRect(rng() * W | 0, rng() * horizon * 0.90 | 0,
          i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
      }
    }

    // Sun / Moon
    if (isNight) {
      const mx = W * (track.moonX || 0.82);
      const my = horizon * 0.28;
      const mr = W * 0.036;
      ctx.fillStyle = '#dde8ff';
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      // Shadow arc creates crescent
      ctx.fillStyle = _darken(track.skyColor, 0.88);
      ctx.beginPath(); ctx.arc(mx - mr * 0.38, my - mr * 0.12, mr * 0.80, 0, Math.PI * 2); ctx.fill();
    } else {
      const sx = isSunset ? W * 0.65 : W * 0.78;
      const sy = isSunset ? horizon * 0.82 : horizon * 0.28;
      const sr = W * (isSunset ? 0.055 : 0.030);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 4.5);
      sg.addColorStop(0,   isSunset ? 'rgba(255,185,40,0.95)' : 'rgba(255,255,200,0.80)');
      sg.addColorStop(0.4, isSunset ? 'rgba(255,80,0,0.40)'   : 'rgba(255,210,90,0.28)');
      sg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - sr*5, sy - sr*5, sr*10, sr*10);
      ctx.fillStyle = isSunset ? '#ffdc50' : '#fffbea';
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }

    // Horizon glow band — track.horizonGlow overrides; sunset gets a warm default.
    const gh = horizon * 0.20;
    const hg = ctx.createLinearGradient(0, horizon - gh, 0, horizon);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(1,
      track.horizonGlow ? track.horizonGlow :
      isSunset          ? 'rgba(255,90,0,0.48)' :
                          'rgba(255,255,255,0.10)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - gh, W, gh);

    // Ocean shimmer — any coastal track with oceanLeft gets the shimmer band.
    if (track.oceanLeft) {
      const og = ctx.createLinearGradient(0, horizon - 4, 0, horizon);
      og.addColorStop(0, 'rgba(255,255,255,0)');
      og.addColorStop(1, 'rgba(255,220,180,0.55)');
      ctx.fillStyle = og;
      ctx.fillRect(0, horizon - 4, W * 0.50, 4);
    }

    // Clouds — skipped at night. cloudCount/cloudStyle from track; weather
    // drives default palette (golden_hour → warm, rush_hour_haze → ochre).
    if (!isNight) {
      let defaultStyle = isSunset ? 'sunset' : 'day';
      if (track.weather === 'golden_hour')    defaultStyle = 'golden';
      else if (track.weather === 'rush_hour_haze') defaultStyle = 'haze';
      else if (track.weather === 'partly_cloudy')  defaultStyle = 'partly';
      const cloudStyle = track.cloudStyle || defaultStyle;
      const palette = _CLOUD_PALETTE[cloudStyle] || _CLOUD_PALETTE.day;
      const n = track.cloudCount;
      for (let i = 0; i < n; i++) {
        const cx = W  * (0.06 + rng() * 0.88);
        const cy = horizon * (0.06 + rng() * 0.44);
        const cw = W  * (0.08 + rng() * 0.13);
        const ch = cw * (0.32 + rng() * 0.28);
        _cloud(ctx, cx, cy + ch * 0.28, cw, ch * 0.38, palette.shadow);
        _cloud(ctx, cx, cy, cw, ch, palette.fill);
      }
    }
  }

  // Cloud palettes keyed by track.cloudStyle. Keep here so a new style is
  // one-entry to add rather than a track.id conditional.
  const _CLOUD_PALETTE = {
    day:    { fill: 'rgba(255,255,255,0.62)', shadow: 'rgba(150,155,180,0.32)' },
    sunset: { fill: 'rgba(255,160,80,0.68)',  shadow: 'rgba(175,70,15,0.36)'   },
    golden: { fill: 'rgba(255,200,120,0.72)', shadow: 'rgba(200,110,50,0.40)'  },
    haze:   { fill: 'rgba(210,185,140,0.58)', shadow: 'rgba(150,110,70,0.35)'  },
    partly: { fill: 'rgba(255,255,255,0.72)', shadow: 'rgba(180,185,200,0.40)' },
  };

  function _cloud(ctx, cx, cy, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(cx,          cy + h*0.28, w*0.48, h*0.38, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - w*0.28, cy + h*0.44, w*0.27, h*0.32, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w*0.27, cy + h*0.40, w*0.25, h*0.28, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + w*0.06, cy + h*0.12, w*0.30, h*0.32, 0, 0, Math.PI*2); ctx.fill();
  }

  // ── Horizon silhouettes ────────────────────
  function _poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  }

  // Data-driven from track.skyline: 'mountains:<style>' | 'city:<style>' | 'trees:<style>'
  function _drawHorizonSilhouette(ctx, track, W, horizon) {
    const sk = track.skyline;
    if (!sk) return;
    const night = !!track.night;
    const sep = sk.indexOf(':');
    if (sep < 0) return;
    const kind  = sk.slice(0, sep);
    const style = sk.slice(sep + 1);
    if (kind === 'mountains')   _drawMountains(ctx, style, W, horizon);
    else if (kind === 'city')   _drawCitySkyline(ctx, style, W, horizon, night);
    else if (kind === 'trees')  _drawTreeLine(ctx, style, W, horizon);
  }

  // Drye-geography mountain styles only. Oahu = volcanic green ridgeline.
  function _drawMountains(ctx, style, W, horizon) {
    const B = horizon;
    if (style === 'oahu') {
      // Tall jagged green ridges — volcanic Hawaiian terrain
      const far  = [[0,.30],[.08,.42],[.18,.25],[.28,.48],[.40,.34],[.52,.52],[.63,.38],[.74,.50],[.86,.33],[1,.44]];
      const near = [[0,.12],[.10,.28],[.20,.10],[.32,.34],[.44,.20],[.56,.40],[.68,.24],[.80,.38],[.92,.20],[1,.28]];
      ctx.fillStyle = 'rgba(40,70,50,0.52)';
      ctx.beginPath(); ctx.moveTo(0, B);
      far.forEach(([x,h]) => ctx.lineTo(W*x, B - horizon*h));
      ctx.lineTo(W, B); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(22,48,28,0.78)';
      ctx.beginPath(); ctx.moveTo(0, B);
      near.forEach(([x,h]) => ctx.lineTo(W*x, B - horizon*h));
      ctx.lineTo(W, B); ctx.closePath(); ctx.fill();
    }
  }

  // City silhouette configs — one entry per Drye-geography urban track.
  const _CITY_CFG = {
    athens:  { n: 14, minH: .08, maxH: .20, minW: 10, maxW: 22, // low college-town skyline
               windowCol: 'rgba(255,220,120,0.60)' },
    atlanta: { n: 20, minH: .24, maxH: .56, minW: 12, maxW: 26, // mid-high dense downtown
               windowCol: 'rgba(255,228,130,0.52)' },
    nyc:     { n: 28, minH: .28, maxH: .78, minW: 10, maxW: 22, // tall dense Manhattan
               windowCol: 'rgba(255,220,140,0.58)' },
    vegas:   { n: 18, minH: .20, maxH: .52, minW: 14, maxW: 30, // wide casino facades
               windowCol: 'rgba(255,90,180,0.70)' },
    orlando: { n: 16, minH: .12, maxH: .28, minW:  8, maxW: 18, // low sprawl behind the castle
               windowCol: 'rgba(255,220,120,0.55)' },
  };

  function _drawCitySkyline(ctx, style, W, horizon, isNight) {
    const B = horizon;
    const cfg = _CITY_CFG[style] || _CITY_CFG.atlanta;

    // Vegas gets a neon glow band regardless (its whole mood)
    if (isNight) {
      const cg = ctx.createLinearGradient(0, horizon*.60, 0, horizon);
      cg.addColorStop(0, 'rgba(0,0,0,0)');
      cg.addColorStop(1, style === 'vegas' ? 'rgba(220,60,180,0.26)' : 'rgba(80,0,130,0.22)');
      ctx.fillStyle = cg; ctx.fillRect(0, horizon*.60, W, horizon*.40);
    }

    // Athens gets stadium lights before the skyline draws
    if (style === 'athens') _drawAthensStadium(ctx, W, horizon);

    // Orlando draws a castle silhouette BEFORE the low skyline, so the skyline
    // appears behind the castle. Castle is the focal element.
    if (style === 'orlando') _drawOrlandoCastle(ctx, W, horizon);

    const rng = _rng(style.charCodeAt(0) * 31 + style.length * 17);
    const step = W / cfg.n;
    const col1 = isNight ? 'rgba(10,6,20,0.94)' : 'rgba(65,75,100,0.44)';
    const col2 = isNight ? 'rgba(16,11,32,0.86)' : 'rgba(50,60,82,0.32)';

    // Back row
    ctx.fillStyle = col2;
    for (let i = 0; i < cfg.n; i++) {
      const h = horizon * (cfg.minH + rng() * (cfg.maxH - cfg.minH) * .58);
      const w = cfg.minW + rng() * (cfg.maxW - cfg.minW);
      ctx.fillRect(i * step + rng() * step * .5, B - h, w, h);
    }
    // Front row + windows
    for (let i = 0; i < cfg.n; i++) {
      const h  = horizon * (cfg.minH * .8 + rng() * (cfg.maxH - cfg.minH));
      const w  = cfg.minW + rng() * (cfg.maxW - cfg.minW);
      const bx = i * step + rng() * step * .4;
      ctx.fillStyle = col1;
      ctx.fillRect(bx, B - h, w, h);
      if (isNight) {
        const wc   = cfg.windowCol;
        const cols = Math.max(1, w / 5 | 0);
        const rows = Math.max(1, h / 7 | 0);
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if ((col * 3 + row * 5 + (bx | 0)) % 4 > 0) {
              ctx.fillStyle = wc;
              ctx.fillRect(bx + 1 + col*5, B - h + 2 + row*7, 3, 4);
            }
          }
        }
      }
    }

    // Vegas: add neon sign tips on the tallest buildings
    if (style === 'vegas') {
      ctx.fillStyle = 'rgba(255,90,180,0.75)';
      for (let i = 1; i < cfg.n; i += 3) {
        const x = i * step + step * 0.4;
        ctx.fillRect(x, B - horizon * 0.56, 2, horizon * 0.08);
      }
      ctx.fillStyle = 'rgba(255,220,60,0.70)';
      for (let i = 2; i < cfg.n; i += 3) {
        const x = i * step + step * 0.5;
        ctx.fillRect(x, B - horizon * 0.62, 2, horizon * 0.10);
      }
    }
  }

  // ── Orlando castle silhouette ─────────────────────
  // Generic fairy-tale castle: four pointed spires over a keep.
  // DELIBERATELY GENERIC — no specific resemblance to any branded theme
  // park attraction. Colors kept neutral so it reads as "theme park" not
  // "this specific theme park." Keep it that way.
  function _drawOrlandoCastle(ctx, W, horizon) {
    const cx = W * 0.50;
    const base = horizon;
    const baseH = horizon * 0.28;
    const kw = W * 0.14;

    // Keep body
    ctx.fillStyle = 'rgba(180,195,220,0.85)';
    ctx.fillRect(cx - kw / 2, base - baseH, kw, baseH);
    // Crenellations
    ctx.fillStyle = 'rgba(130,150,180,0.92)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx - kw / 2 + i * (kw / 5), base - baseH - 4, kw / 10, 4);
    }
    // Four towers (outer-lower, inner-higher) + central tallest
    const towerXs = [-0.46, -0.22, 0.22, 0.46, 0];
    const towerHs = [0.35, 0.42, 0.42, 0.35, 0.56];
    for (let i = 0; i < towerXs.length; i++) {
      const tx = cx + kw * towerXs[i];
      const th = horizon * towerHs[i];
      const tw = W * 0.018;
      // Shaft
      ctx.fillStyle = 'rgba(180,195,220,0.90)';
      ctx.fillRect(tx - tw, base - th, tw * 2, th);
      // Conical spire
      ctx.fillStyle = 'rgba(90,120,180,0.95)';
      ctx.beginPath();
      ctx.moveTo(tx - tw - 2, base - th);
      ctx.lineTo(tx, base - th - horizon * 0.14);
      ctx.lineTo(tx + tw + 2, base - th);
      ctx.closePath(); ctx.fill();
      // Pennant
      ctx.fillStyle = 'rgba(220,80,80,0.95)';
      ctx.fillRect(tx + 1, base - th - horizon * 0.14, W * 0.010, Math.max(2, horizon * 0.02));
    }
    // Gate
    ctx.fillStyle = 'rgba(60,40,20,0.9)';
    ctx.fillRect(cx - kw * 0.10, base - baseH * 0.55, kw * 0.20, baseH * 0.55);
  }

  // ── Athens stadium pylons (game-day lights) ───────
  // Four floodlight stacks visible over the horizon, centered.
  function _drawAthensStadium(ctx, W, horizon) {
    const cx = W * 0.50;
    const B = horizon;
    // Stadium bowl shape (low curved silhouette)
    ctx.fillStyle = 'rgba(60,50,40,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx, B + horizon * 0.02, W * 0.34, horizon * 0.12, 0, Math.PI, 0, false);
    ctx.fill();
    // Pylon poles + light boxes
    const pylons = [-0.28, -0.10, 0.10, 0.28];
    for (const px of pylons) {
      const x = cx + W * px;
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x - 1, B - horizon * 0.22, 2, horizon * 0.20);
      // Light box
      ctx.fillStyle = '#f0f0d0';
      ctx.fillRect(x - 6, B - horizon * 0.24, 12, 5);
      // Glow
      ctx.fillStyle = 'rgba(255,240,180,0.35)';
      ctx.fillRect(x - 10, B - horizon * 0.26, 20, 9);
    }
  }

  // Tree-line horizon — used by Secaucus (plain), Garden City (palms), Tulum (palms + golden glow).
  function _drawTreeLine(ctx, style, W, horizon) {
    style = style || 'secaucus';
    if (style === 'garden_city' || style === 'tulum') {
      // Palm silhouettes
      ctx.fillStyle = style === 'tulum' ? 'rgba(20,14,10,0.70)' : 'rgba(30,60,40,0.58)';
      const count = Math.max(6, Math.floor(W / 80));
      for (let i = 0; i < count; i++) {
        const px = (i + 0.5) * (W / count);
        const ph = horizon * (0.12 + (i % 3) * 0.04);
        // Trunk
        ctx.fillRect(px - 1, horizon - ph, 2, ph);
        // Fronds — five diagonals
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 2;
        const fh = horizon * 0.08;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(px, horizon - ph);
          ctx.lineTo(px + k * 10, horizon - ph - fh + Math.abs(k) * 4);
          ctx.stroke();
        }
      }
      return;
    }
    // Default: dense forest tree line (Secaucus)
    ctx.fillStyle = 'rgba(16,36,12,0.58)';
    const n = Math.ceil(W / (W * .065));
    for (let i = 0; i < n; i++) {
      const tx = i * W * .065;
      const th = horizon * (.10 + (i % 4) * .026);
      _poly(ctx, [[tx, horizon+1], [tx + W*.0325, horizon - th], [tx + W*.065, horizon+1]]);
    }
  }

  return { buildSegments, render, invalidateSkyCache };
})();
