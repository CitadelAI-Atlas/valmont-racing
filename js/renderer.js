// ─────────────────────────────────────────────
//  RENDERER — Pseudo-3D road engine (portrait)
//  Smooth trapezoid road edges, proper sprite scaling
// ─────────────────────────────────────────────

const Renderer = (() => {
  const DRAW_DISTANCE = 400;
  const ROAD_WIDTH    = 1200;

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
        sprites: [],
      });
    }
    return segs;
  }

  // ── Main render ────────────────────────────
  function render(ctx, track, segments, playerZ, playerX, playerSpeed, W, H) {
    W = W || ctx.canvas.width;
    H = H || ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const horizon = H * 0.40;
    const roadH   = H - horizon;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, track.skyColor);
    sky.addColorStop(1, _darken(track.skyColor, 0.6));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);
    _drawSkyDetails(ctx, track, W, horizon);

    // Ground with depth gradient (lighter near horizon, darker near player)
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
    _drawHorizonSilhouette(ctx, track, W, horizon);

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
      for (const sprite of cur.seg.sprites) {
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

    // Player car
    _drawPlayerCar(ctx, W, H, playerX, window._selectedCar);
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
  function _drawSkyDetails(ctx, track, W, horizon) {
    const id       = track.id;
    const isNight  = id === 'tokyo' || id === 'dubai';
    const isSunset = id === 'pch';
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
      const mx = id === 'dubai' ? W * 0.75 : W * 0.82;
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

    // Horizon glow band
    const gh = horizon * 0.20;
    const hg = ctx.createLinearGradient(0, horizon - gh, 0, horizon);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(1,
      id === 'tokyo'      ? 'rgba(180,20,100,0.22)'    :
      id === 'dubai'      ? 'rgba(220,130,0,0.24)'     :
      isSunset            ? 'rgba(255,90,0,0.48)'      :
      id === 'swiss_alps' ? 'rgba(180,210,255,0.15)'   :
                            'rgba(255,255,255,0.10)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - gh, W, gh);

    // Ocean shimmer (PCH only)
    if (id === 'pch') {
      const og = ctx.createLinearGradient(0, horizon - 4, 0, horizon);
      og.addColorStop(0, 'rgba(255,255,255,0)');
      og.addColorStop(1, 'rgba(255,220,180,0.55)');
      ctx.fillStyle = og;
      ctx.fillRect(0, horizon - 4, W * 0.50, 4);
    }

    // Clouds (non-night)
    if (!isNight) {
      const ccFill   = isSunset         ? 'rgba(255,160,80,0.68)' :
                       id === 'swiss_alps' ? 'rgba(196,212,238,0.60)' :
                                            'rgba(255,255,255,0.62)';
      const ccShadow = isSunset         ? 'rgba(175,70,15,0.36)'  :
                       id === 'swiss_alps' ? 'rgba(135,158,210,0.32)' :
                                            'rgba(150,155,180,0.32)';
      const n = (id === 'nullarbor' || id === 'baja') ? 1 :
                id === 'route66' ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const cx = W  * (0.06 + rng() * 0.88);
        const cy = horizon * (0.06 + rng() * 0.44);
        const cw = W  * (0.08 + rng() * 0.13);
        const ch = cw * (0.32 + rng() * 0.28);
        _cloud(ctx, cx, cy + ch * 0.28, cw, ch * 0.38, ccShadow);
        _cloud(ctx, cx, cy, cw, ch, ccFill);
      }
    }
  }

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

  function _drawHorizonSilhouette(ctx, track, W, horizon) {
    const id = track.id;
    if      (id === 'swiss_alps') _drawMountains(ctx, 'alps',   W, horizon);
    else if (id === 'fuji')       _drawMountains(ctx, 'fuji',   W, horizon);
    else if (id === 'amalfi')     _drawMountains(ctx, 'amalfi', W, horizon);
    else if (id === 'baja')       _drawMountains(ctx, 'baja',   W, horizon);
    else if (id === 'tokyo')      _drawCitySkyline(ctx, 'tokyo',  W, horizon);
    else if (id === 'dubai')      _drawCitySkyline(ctx, 'dubai',  W, horizon);
    else if (id === 'la_freeway') _drawCitySkyline(ctx, 'la',     W, horizon);
    else if (id === 'monaco')     _drawCitySkyline(ctx, 'monaco', W, horizon);
    else if (id === 'autobahn')   _drawTreeLine(ctx, W, horizon);
  }

  function _drawMountains(ctx, style, W, horizon) {
    const B = horizon;
    if (style === 'fuji') {
      ctx.fillStyle = 'rgba(68,78,105,0.35)';
      _poly(ctx, [[0,B],[W*0.22,B-horizon*0.36],[W*0.44,B]]);
      _poly(ctx, [[W*0.60,B],[W*0.82,B-horizon*0.40],[W,B]]);
      ctx.fillStyle = 'rgba(84,92,118,0.58)';
      _poly(ctx, [[W*0.27,B],[W*0.55,B-horizon*0.68],[W*0.83,B]]);
      ctx.fillStyle = 'rgba(228,236,255,0.82)';
      _poly(ctx, [
        [W*0.43, B-horizon*0.44], [W*0.55, B-horizon*0.68],
        [W*0.67, B-horizon*0.44], [W*0.61, B-horizon*0.48], [W*0.49, B-horizon*0.48]
      ]);

    } else if (style === 'alps') {
      const far  = [[0,.44],[.10,.28],[.22,.42],[.33,.13],[.45,.32],[.55,.08],[.65,.30],[.76,.19],[.88,.36],[1,.44]];
      const near = [[0,.56],[.08,.36],[.19,.52],[.29,.19],[.41,.41],[.52,.13],[.62,.36],[.73,.24],[.84,.43],[.94,.32],[1,.50]];
      ctx.fillStyle = 'rgba(152,168,196,0.38)';
      ctx.beginPath(); ctx.moveTo(0, B);
      far.forEach(([x,h]) => ctx.lineTo(W*x, B - horizon*h));
      ctx.lineTo(W, B); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(80,96,126,0.64)';
      ctx.beginPath(); ctx.moveTo(0, B);
      near.forEach(([x,h]) => ctx.lineTo(W*x, B - horizon*h));
      ctx.lineTo(W, B); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(228,238,255,0.82)';
      [[.29,.19],[.52,.13],[.73,.24]].forEach(([px,ph]) => {
        _poly(ctx, [
          [W*(px-.065), B-horizon*(ph+.13)],
          [W*px,        B-horizon*ph],
          [W*(px+.065), B-horizon*(ph+.13)],
        ]);
      });

    } else if (style === 'amalfi') {
      const r = [0,.48, .08,.28, .18,.44, .28,.17, .40,.34, .52,.21, .65,.39, .78,.25, .90,.36, 1,.48];
      ctx.fillStyle = 'rgba(36,55,30,0.55)';
      ctx.beginPath(); ctx.moveTo(0, B);
      for (let i = 0; i < r.length; i+=2) ctx.lineTo(W*r[i], B - horizon*r[i+1]);
      ctx.lineTo(W, B); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(26,44,20,0.72)';
      ctx.beginPath(); ctx.moveTo(0, B);
      for (let i = 0; i < r.length; i+=2) ctx.lineTo(W*r[i], B - horizon*(r[i+1]*.55+.24));
      ctx.lineTo(W, B); ctx.closePath(); ctx.fill();

    } else if (style === 'baja') {
      ctx.fillStyle = 'rgba(108,65,28,0.42)';
      _poly(ctx, [[0,B],[W*.14,B-horizon*.36],[W*.30,B-horizon*.30],[W*.40,B]]);
      _poly(ctx, [[W*.54,B],[W*.63,B-horizon*.32],[W*.80,B-horizon*.28],[W,B]]);
    }
  }

  function _drawCitySkyline(ctx, style, W, horizon) {
    const B   = horizon;
    const isNight = style === 'tokyo' || style === 'dubai';
    const rng = _rng(style.charCodeAt(0) * 31 + style.length * 17);

    if (isNight) {
      const cg = ctx.createLinearGradient(0, horizon*.60, 0, horizon);
      cg.addColorStop(0, 'rgba(0,0,0,0)');
      cg.addColorStop(1, style === 'dubai' ? 'rgba(200,120,0,0.22)' : 'rgba(80,0,130,0.22)');
      ctx.fillStyle = cg; ctx.fillRect(0, horizon*.60, W, horizon*.40);
    }

    const cfgs = {
      dubai:  { n:16, minH:.33, maxH:.72, minW:14, maxW:28 },
      tokyo:  { n:26, minH:.13, maxH:.44, minW:8,  maxW:20 },
      la:     { n:19, minH:.11, maxH:.38, minW:10, maxW:24 },
      monaco: { n:22, minH:.09, maxH:.24, minW:7,  maxW:16 },
    };
    const cfg  = cfgs[style] || cfgs.la;
    const step = W / cfg.n;
    const col1 = isNight ? 'rgba(10,6,20,0.94)'  : 'rgba(65,75,100,0.44)';
    const col2 = isNight ? 'rgba(16,11,32,0.86)'  : 'rgba(50,60,82,0.32)';

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
        const wc   = style === 'dubai' ? 'rgba(255,208,75,0.75)' : 'rgba(0,188,255,0.65)';
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
  }

  function _drawTreeLine(ctx, W, horizon) {
    ctx.fillStyle = 'rgba(16,36,12,0.58)';
    const n = Math.ceil(W / (W * .065));
    for (let i = 0; i < n; i++) {
      const tx = i * W * .065;
      const th = horizon * (.10 + (i % 4) * .026);
      _poly(ctx, [[tx, horizon+1], [tx + W*.0325, horizon - th], [tx + W*.065, horizon+1]]);
    }
  }

  return { buildSegments, render };
})();
