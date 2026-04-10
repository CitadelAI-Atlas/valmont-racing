// ─────────────────────────────────────────────
//  CARS — stats, surface penalties, pixel art
// ─────────────────────────────────────────────

const CARS = [
  {
    id: 'ferrari458',
    name: '2015 Ferrari 458',
    color: 'Pink',
    year: 2015,
    make: 'Ferrari',
    model: '458',
    topSpeed: 118,
    acceleration: 100,
    handling: 98,
    bodyColor: '#ff69b4',
    accentColor: '#cc2060',
    type: 'sports',
    description: 'Glass cannon. Fastest on tarmac,\ndisasters off-road.',
    crashResistance: 0.35,
    hidden: true,
    surfacePenalties: {
      dirt: 0.55, ice: 0.45, oil: 0.40, pothole: 0.35, jump: 'spinout'
    }
  },
  {
    id: 'sl550',
    name: '2018 Mercedes SL 550',
    color: 'Black',
    year: 2018,
    make: 'Mercedes',
    model: 'SL 550',
    topSpeed: 92,
    acceleration: 86,
    handling: 84,
    bodyColor: '#1a1a1a',
    accentColor: '#444444',
    type: 'convertible',
    description: 'Luxury convertible. Top down,\nwind in your hair.',
    crashResistance: 0.50,
    surfacePenalties: {
      dirt: 0.35, ice: 0.30, oil: 0.25, pothole: 0.20, jump: 'losecontrol'
    }
  },
  {
    id: 'cls550',
    name: '2012 Mercedes CLS 550',
    color: 'Silver',
    year: 2012,
    make: 'Mercedes',
    model: 'CLS 550',
    topSpeed: 76,
    acceleration: 72,
    handling: 70,
    bodyColor: '#c0c0c0',
    accentColor: '#888888',
    type: 'sedan',
    description: 'Elegant 4-door. Smooth cruise\nthrough city traffic.',
    crashResistance: 0.72,
    surfacePenalties: {
      dirt: 0.35, ice: 0.30, oil: 0.25, pothole: 0.20, jump: 'losecontrol'
    }
  },
  {
    id: 'gx460',
    name: '2017 Lexus GX 460',
    color: 'White',
    year: 2017,
    make: 'Lexus',
    model: 'GX460',
    topSpeed: 60,
    acceleration: 54,
    handling: 64,
    bodyColor: '#f0f0f0',
    accentColor: '#aaaaaa',
    type: 'suv',
    description: 'Modern SUV. Light off-road\npenalty. Reliable.',
    crashResistance: 1.10,
    surfacePenalties: {
      dirt: 0.10, ice: 0.20, oil: 0.20, pothole: 0.05, jump: 'bounce'
    }
  },
  {
    id: 'gx470',
    name: '2007 Lexus GX 470',
    color: 'Silver',
    year: 2007,
    make: 'Lexus',
    model: 'GX470',
    topSpeed: 54,
    acceleration: 48,
    handling: 54,
    bodyColor: '#b8b8b8',
    accentColor: '#777777',
    type: 'suv',
    description: 'Older & heavier. Tough build,\nslightly slower.',
    crashResistance: 1.15,
    surfacePenalties: {
      dirt: 0.10, ice: 0.20, oil: 0.20, pothole: 0.05, jump: 'bounce'
    }
  },
  {
    id: 'raptor',
    name: '2019 Ford F150 Raptor',
    color: 'Silver',
    year: 2019,
    make: 'Ford',
    model: 'F150 Raptor',
    topSpeed: 48,
    acceleration: 64,
    handling: 46,
    bodyColor: '#a8a8a8',
    accentColor: '#555555',
    type: 'truck',
    description: 'Slowest on tarmac. Zero penalty\non dirt. King of Baja.',
    crashResistance: 1.40,
    surfacePenalties: {
      dirt: 0.00, ice: 0.15, oil: 0.10, pothole: 0.00, jump: 'clean'
    }
  },
  {
    id: 'cobra',
    name: '1965 Shelby Cobra 427',
    color: 'Blue/White',
    year: 1965,
    make: 'Shelby',
    model: 'Cobra 427',
    topSpeed: 165,
    acceleration: 148,
    handling: 72,
    bodyColor: '#1a3a8a',
    accentColor: '#f0f0f0',
    type: 'convertible',
    description: 'The fastest production car\nfor 20+ years. Open cockpit.\nDoor handles on the inside.\nPure insanity.',
    crashResistance: 0.22,
    hidden: true,                       // won't appear in normal car select
    surfacePenalties: {
      dirt: 0.60, ice: 0.50, oil: 0.45, pothole: 0.40, jump: 'spinout'
    }
  }
];

// ────────────────────────────────────────────────────
//  PIXEL ART SIDE-VIEW  (car select screen)
//
//  Each car is drawn onto a 140×52 offscreen canvas at
//  true 1:1 pixel size (all shapes are fillRect).
//  drawCarPixel() then copies it to the display canvas
//  with imageSmoothingEnabled=false → crisp block pixels.
//
//  Orientation: front of car = LEFT (x≈4), rear = RIGHT (x≈136).
//  Diagonal surfaces use 2px horizontal strips at each
//  row — classic pixel-art staircase for angled lines.
// ────────────────────────────────────────────────────

const _AW = 140, _AH = 52;

// ── Color helpers ──────────────────────────────────
function _lc(hex, a) {
  const [r,g,b] = _hc(hex);
  return `rgb(${Math.min(255,r+(255-r)*a)|0},${Math.min(255,g+(255-g)*a)|0},${Math.min(255,b+(255-b)*a)|0})`;
}
function _dc(hex, a) {
  const [r,g,b] = _hc(hex);
  return `rgb(${r*a|0},${g*a|0},${b*a|0})`;
}
function _hc(h) {
  h = h.replace('#','');
  if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}

// ── Pixel-art wheel (scanline circles + multi-spoke rim) ──
function _pxWheel(oc, cx, cy, r) {
  // Outer tire (black scanlines)
  oc.fillStyle = '#111';
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(r*r - dy*dy));
    if (hw > 0) oc.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }
  // Tire sidewall highlight (left arc)
  oc.fillStyle = '#2a2a2a';
  for (let dy = -r; dy <= -Math.round(r*0.3); dy++) {
    const hw = Math.round(Math.sqrt(r*r - dy*dy));
    oc.fillRect(cx - hw, cy + dy, 2, 1);
  }
  // Rim face (silver)
  const ir = Math.max(2, Math.round(r * 0.68));
  oc.fillStyle = '#b0b0b0';
  for (let dy = -ir; dy <= ir; dy++) {
    const hw = Math.round(Math.sqrt(ir*ir - dy*dy));
    if (hw > 0) oc.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }
  // Rim shadow (lower half darker)
  oc.fillStyle = '#888';
  for (let dy = 0; dy <= ir; dy++) {
    const hw = Math.round(Math.sqrt(ir*ir - dy*dy));
    if (hw > 0) oc.fillRect(cx - hw, cy + dy, hw * 2, 1);
  }
  // Multi-spoke pattern (10 thin spokes like Mercedes AMG wheel)
  oc.fillStyle = '#555';
  const spokeCount = r >= 8 ? 10 : 6;
  for (let a = 0; a < spokeCount; a++) {
    const ang = (a / spokeCount) * Math.PI * 2;
    for (let d = Math.round(r*0.20); d < ir - 1; d++) {
      oc.fillRect(Math.round(cx + Math.cos(ang)*d), Math.round(cy + Math.sin(ang)*d), 1, 1);
    }
  }
  // Rim edge ring (dark border between tire and rim)
  oc.fillStyle = '#444';
  const rr = ir + 1;
  for (let dy = -rr; dy <= rr; dy++) {
    const hw = Math.round(Math.sqrt(rr*rr - dy*dy));
    oc.fillRect(cx - hw, cy + dy, 1, 1);
    if (hw > 0) oc.fillRect(cx + hw - 1, cy + dy, 1, 1);
  }
  // Center hub cap
  oc.fillStyle = '#222'; oc.fillRect(cx-2, cy-2, 5, 5);
  oc.fillStyle = '#aaa'; oc.fillRect(cx-1, cy-1, 3, 3);
  oc.fillStyle = '#666'; oc.fillRect(cx,   cy,   1, 1);
}

// ── Main dispatcher ────────────────────────────────
function drawCarPixel(ctx, car, cx, cy, scale) {
  scale = scale || 1;

  // Use PNG sprite if one has loaded for this car (better quality)
  const sd = Sprites.get(car.id, 'side');
  if (sd) {
    const { img, crop } = sd;
    // Scale cropped region to match the hand-coded art bounding-box width.
    const targetW = _AW * scale;
    const s  = targetW / crop.w;
    const sw = Math.round(targetW);
    const sh = Math.round(crop.h * s);
    ctx.save();
    ctx.imageSmoothingEnabled = true;  // smooth for high-res source photos
    ctx.drawImage(img,
      crop.x, crop.y, crop.w, crop.h,  // source rect (crops black space)
      Math.round(cx - sw / 2),
      Math.round(cy - sh / 2),
      sw, sh);
    ctx.restore();
    return;
  }

  // Fallback: hand-coded pixel art
  const off = document.createElement('canvas');
  off.width = _AW; off.height = _AH;
  const oc = off.getContext('2d');
  const fn = {
    sports:      _pxFerrari,
    convertible: _pxSL550,
    sedan:       _pxCLS550,
    suv:         _pxSUV,
    truck:       _pxRaptor,
  }[car.type] || _pxFerrari;
  fn(oc, car.bodyColor, car.accentColor);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off,
    Math.round(cx - _AW * scale / 2),
    Math.round(cy - _AH * scale / 2),
    _AW * scale, _AH * scale);
  ctx.restore();
}

// ── Ferrari 458  (low wedge sports) ───────────────
// Front=left. Extremely low roof, long nose, fastback rear.
function _pxFerrari(oc, body, accent) {
  const hi = _lc(body, 0.38), md = body, sh = _dc(body, 0.68), dk = _dc(body, 0.40);

  // Hood (front left, low)
  oc.fillStyle = hi;  oc.fillRect(10, 22, 50, 2);
  oc.fillStyle = md;  oc.fillRect(10, 24, 50, 10);
  oc.fillStyle = sh;  oc.fillRect(10, 34, 50, 6);

  // Nose (very low front face)
  oc.fillStyle = sh;  oc.fillRect(4, 28, 8, 12);
  oc.fillStyle = dk;  oc.fillRect(4, 40, 10, 2);

  // Cabin sides
  oc.fillStyle = hi;  oc.fillRect(58, 14, 56, 2);
  oc.fillStyle = md;  oc.fillRect(58, 16, 56, 14);
  oc.fillStyle = sh;  oc.fillRect(58, 30, 56, 8);

  // Roof (narrow, sports car)
  oc.fillStyle = _lc(body, 0.50); oc.fillRect(64,  8, 42, 2);
  oc.fillStyle = hi;               oc.fillRect(64, 10, 42, 4);
  oc.fillStyle = md;               oc.fillRect(64, 14, 42, 2);

  // Fastback rear slope
  oc.fillStyle = md;  oc.fillRect(112, 16, 18, 4);
  oc.fillStyle = sh;  oc.fillRect(112, 20, 18, 4);
                      oc.fillRect(114, 24, 16, 6);
                      oc.fillRect(116, 30, 14, 6);
  oc.fillStyle = dk;  oc.fillRect(130, 18, 6, 22);

  // Underbody
  oc.fillStyle = dk;  oc.fillRect(10, 40, 120, 2);

  // Windshield — stepped 2px strips for angled glass
  oc.fillStyle = '#1a3a5a';
  oc.fillRect(58, 28, 8, 2); oc.fillRect(60, 26, 8, 2); oc.fillRect(62, 24, 8, 2);
  oc.fillRect(64, 22, 8, 2); oc.fillRect(66, 20, 6, 2); oc.fillRect(68, 18, 6, 2);
  oc.fillRect(70, 16, 4, 2);
  // Glass highlight (left edge)
  oc.fillStyle = '#3a6aaa';
  oc.fillRect(58, 28, 2, 2); oc.fillRect(60, 26, 2, 2);
  oc.fillRect(62, 24, 2, 2); oc.fillRect(64, 22, 2, 2);

  // Side window
  oc.fillStyle = '#1a3a5a'; oc.fillRect(74, 16, 32, 14);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(74, 16, 2, 14); oc.fillRect(74, 16, 32, 2);

  // Rear fastback window (stepped)
  oc.fillStyle = '#1a3a5a';
  oc.fillRect(110, 20, 4, 2); oc.fillRect(108, 22, 6, 2);
  oc.fillRect(106, 24, 8, 2); oc.fillRect(104, 26, 10, 6);
  oc.fillStyle = '#3a6aaa';
  oc.fillRect(110, 20, 2, 2); oc.fillRect(108, 22, 2, 2);

  // Pillars
  oc.fillStyle = dk;
  oc.fillRect(58, 12, 2, 18); // A-pillar
  oc.fillRect(106, 12, 2, 20); // C-pillar
  oc.fillRect(58, 12, 50, 2);  // roof rail

  // Air intake behind door
  oc.fillStyle = '#080808'; oc.fillRect(82, 30, 20, 10);
  oc.fillStyle = '#333';
  oc.fillRect(84, 32, 2, 6); oc.fillRect(88, 32, 2, 6);
  oc.fillRect(92, 32, 2, 6); oc.fillRect(96, 32, 2, 6);

  // Accent stripe
  oc.fillStyle = accent; oc.fillRect(12, 30, 116, 2);

  // Front splitter
  oc.fillStyle = dk; oc.fillRect(4, 40, 28, 2);

  // Headlight
  oc.fillStyle = '#ffff99'; oc.fillRect(4, 24, 8, 6);
  oc.fillStyle = '#ffffff';  oc.fillRect(4, 24, 4, 3);
  oc.fillStyle = '#ffdd00';  oc.fillRect(4, 30, 8, 2); // DRL

  // Taillights
  oc.fillStyle = '#cc0000'; oc.fillRect(130, 18, 6, 22);
  oc.fillStyle = '#ff2200'; oc.fillRect(130, 18, 6, 8);
  oc.fillStyle = '#550000'; oc.fillRect(130, 26, 6, 2);

  // Spoiler
  oc.fillStyle = accent; oc.fillRect(114, 6, 18, 2);
  oc.fillStyle = dk;     oc.fillRect(128, 6, 2, 12);

  // Dual exhausts
  oc.fillStyle = '#888'; oc.fillRect(118, 40, 6, 4); oc.fillStyle = '#222'; oc.fillRect(119, 41, 4, 2);
  oc.fillStyle = '#888'; oc.fillRect(126, 40, 6, 4); oc.fillStyle = '#222'; oc.fillRect(127, 41, 4, 2);

  _pxWheel(oc, 26, 42, 8);
  _pxWheel(oc, 110, 42, 8);
}

// ── Mercedes SL 550  (open-top roadster) ──────────
// VERY long hood (~55%), 3 fender vents, open cockpit,
// tan leather seats + roll hoops, short rear deck.
function _pxSL550(oc, body, accent) {
  const hi = _lc(body, 0.38), md = body, sh = _dc(body, 0.68), dk = _dc(body, 0.40);

  // ── VERY LONG HOOD (x=12 to x=78) ──────────────
  oc.fillStyle = _lc(body, 0.55); oc.fillRect(14, 23, 64, 2);  // top highlight
  oc.fillStyle = hi;               oc.fillRect(14, 25, 64, 3);
  oc.fillStyle = md;               oc.fillRect(14, 28, 64, 6);
  oc.fillStyle = sh;               oc.fillRect(14, 34, 64, 3);

  // Front nose (low wedge)
  oc.fillStyle = sh;  oc.fillRect(4, 26, 12, 10);
  oc.fillStyle = dk;  oc.fillRect(4, 36, 14, 2);
  // Chin splitter
  oc.fillStyle = '#111'; oc.fillRect(4, 38, 20, 2);

  // ── 3 DIAGONAL SIDE VENTS on front fender ──────
  // Each vent: 3 slanted dark slots with thin gap
  for (let i = 0; i < 3; i++) {
    const vx = 20 + i * 11;
    oc.fillStyle = '#0a0a0a';
    oc.fillRect(vx,     32, 7, 1);
    oc.fillRect(vx + 1, 30, 7, 1);
    oc.fillRect(vx + 2, 28, 7, 1);
    oc.fillStyle = '#3a3a3a';
    oc.fillRect(vx + 8, 28, 1, 5);  // right shadow edge
  }

  // ── ROCKER PANEL / SILL ─────────────────────────
  oc.fillStyle = dk;   oc.fillRect(14, 37, 116, 3);
  oc.fillStyle = '#c0c0c0'; oc.fillRect(16, 37, 112, 1);  // chrome sill

  // ── WINDSHIELD GLASS (raked, roadster style) ────
  oc.fillStyle = '#1a3a5a';
  oc.fillRect(70, 33, 6, 2);
  oc.fillRect(72, 31, 6, 2);
  oc.fillRect(74, 29, 6, 2);
  oc.fillRect(76, 27, 5, 2);
  oc.fillRect(77, 25, 4, 2);
  // Glass highlight (left edge)
  oc.fillStyle = '#4a7abf';
  oc.fillRect(70, 33, 2, 2);
  oc.fillRect(72, 31, 2, 2);
  oc.fillRect(74, 29, 2, 2);

  // ── A-PILLAR FRAME (thin post — no roof) ───────
  oc.fillStyle = dk; oc.fillRect(79, 14, 3, 25);
  oc.fillStyle = dk; oc.fillRect(68, 33, 4, 5);  // pillar base

  // ── SIDE MIRROR ─────────────────────────────────
  oc.fillStyle = _dc(body, 0.75); oc.fillRect(66, 20, 7, 4);
  oc.fillStyle = '#666'; oc.fillRect(72, 21, 1, 2);  // stem

  // ── OPEN COCKPIT INTERIOR ───────────────────────
  oc.fillStyle = '#120a04'; oc.fillRect(82, 28, 30, 9);  // dark floor

  // Driver seat (left/rear)
  oc.fillStyle = '#8b5a2b'; oc.fillRect(84, 22, 11, 13);  // seatback
  oc.fillStyle = '#a06030'; oc.fillRect(84, 22, 11, 3);   // top highlight
  oc.fillStyle = '#704018'; oc.fillRect(86, 31, 7, 4);    // cushion

  // Passenger seat (right/front)
  oc.fillStyle = '#8b5a2b'; oc.fillRect(98, 22, 11, 13);
  oc.fillStyle = '#a06030'; oc.fillRect(98, 22, 11, 3);
  oc.fillStyle = '#704018'; oc.fillRect(100, 31, 7, 4);

  // Center console
  oc.fillStyle = '#0d0d0d'; oc.fillRect(95, 27, 4, 9);

  // ── HEADRESTS ───────────────────────────────────
  oc.fillStyle = '#5a3015'; oc.fillRect(85, 16, 9, 6);
  oc.fillStyle = '#4a2008'; oc.fillRect(99, 16, 9, 6);

  // ── ROLL HOOPS (twin chrome — iconic SL feature)
  oc.fillStyle = '#555';
  oc.fillRect(92, 10, 2, 13);  // left post
  oc.fillRect(96, 10, 2, 13);  // right post
  oc.fillStyle = '#999'; oc.fillRect(92, 10, 6, 2);  // top bar
  oc.fillStyle = '#bbb'; oc.fillRect(93, 10, 4, 1);  // highlight

  // ── STEERING WHEEL ──────────────────────────────
  oc.fillStyle = '#111'; oc.fillRect(87, 33, 8, 2); oc.fillRect(90, 31, 2, 5);

  // ── SHORT REAR DECK ─────────────────────────────
  oc.fillStyle = _lc(body, 0.45); oc.fillRect(114, 23, 18, 2);
  oc.fillStyle = md;               oc.fillRect(114, 25, 18, 10);
  oc.fillStyle = sh;               oc.fillRect(114, 35, 18, 2);
  // Folded soft-top (dark lumped shape)
  oc.fillStyle = '#1c1c1c'; oc.fillRect(108, 19, 16, 4);
  oc.fillStyle = '#111';    oc.fillRect(110, 15, 12, 6);

  // ── REAR FACE ───────────────────────────────────
  oc.fillStyle = sh;  oc.fillRect(130, 21, 3, 17);
  oc.fillStyle = dk;  oc.fillRect(133, 19, 4, 21);

  // ── UNDERBODY ───────────────────────────────────
  oc.fillStyle = dk; oc.fillRect(6, 39, 127, 2);

  // ── ACCENT BELT LINE ────────────────────────────
  oc.fillStyle = accent; oc.fillRect(14, 34, 116, 2);

  // ── HEADLIGHT (thin swept LED) ──────────────────
  oc.fillStyle = '#ffff99'; oc.fillRect(4, 25, 11, 6);
  oc.fillStyle = '#ffffff';  oc.fillRect(4, 25, 5, 3);
  oc.fillStyle = '#ffdd00';  oc.fillRect(4, 31, 11, 2);  // DRL

  // ── TAILLIGHTS ──────────────────────────────────
  oc.fillStyle = '#cc0000'; oc.fillRect(131, 21, 5, 18);
  oc.fillStyle = '#ff2200'; oc.fillRect(131, 21, 5, 7);
  oc.fillStyle = '#550000'; oc.fillRect(131, 28, 5, 2);

  // ── DUAL EXHAUSTS (oval, centered) ──────────────
  oc.fillStyle = '#aaa'; oc.fillRect(116, 38, 7, 3);
  oc.fillStyle = '#333'; oc.fillRect(117, 39, 5, 1);
  oc.fillStyle = '#aaa'; oc.fillRect(124, 38, 7, 3);
  oc.fillStyle = '#333'; oc.fillRect(125, 39, 5, 1);

  // ── MERCEDES STAR (nose badge) ───────────────────
  oc.fillStyle = '#aaa'; oc.fillRect(8, 27, 4, 4);
  oc.fillStyle = '#ddd'; oc.fillRect(9, 28, 2, 2);

  _pxWheel(oc, 28, 42, 8);
  _pxWheel(oc, 114, 42, 8);
}

// ── Mercedes CLS 550  (4-door fastback coupe) ─────
// Long elegant profile, 4 windows, sweeping roofline.
function _pxCLS550(oc, body, accent) {
  const hi = _lc(body, 0.38), md = body, sh = _dc(body, 0.68), dk = _dc(body, 0.40);

  // Hood
  oc.fillStyle = hi;  oc.fillRect(10, 20, 42, 2);
  oc.fillStyle = md;  oc.fillRect(10, 22, 42, 14);
  oc.fillStyle = sh;  oc.fillRect(10, 36, 42, 4);
  oc.fillStyle = sh;  oc.fillRect(4, 24, 8, 14);
  oc.fillStyle = dk;  oc.fillRect(4, 38, 10, 2);

  // Long cabin (4-door width)
  oc.fillStyle = hi;  oc.fillRect(50, 12, 74, 2);
  oc.fillStyle = md;  oc.fillRect(50, 14, 74, 18);
  oc.fillStyle = sh;  oc.fillRect(50, 32, 74, 8);

  // Sweeping fastback rear
  oc.fillStyle = md;  oc.fillRect(120, 14, 8, 4);
  oc.fillStyle = sh;
  oc.fillRect(122, 18, 6, 4); oc.fillRect(124, 22, 4, 4);
  oc.fillRect(126, 26, 2, 4);
  oc.fillStyle = dk;  oc.fillRect(128, 14, 6, 26);

  // Long roof
  oc.fillStyle = _lc(body, 0.50); oc.fillRect(54,  6, 70, 2);
  oc.fillStyle = hi;               oc.fillRect(54,  8, 70, 4);
  oc.fillStyle = md;               oc.fillRect(54, 12, 70, 2);

  // Underbody
  oc.fillStyle = dk; oc.fillRect(10, 40, 118, 2);

  // Windshield (steep)
  oc.fillStyle = '#1a3a5a';
  oc.fillRect(52, 28, 8, 2); oc.fillRect(54, 26, 8, 2); oc.fillRect(56, 24, 8, 2);
  oc.fillRect(58, 22, 8, 2); oc.fillRect(60, 20, 8, 2); oc.fillRect(62, 18, 6, 2);
  oc.fillRect(64, 16, 6, 2); oc.fillRect(66, 14, 4, 2);
  oc.fillStyle = '#3a6aaa';
  oc.fillRect(52, 28, 2, 2); oc.fillRect(54, 26, 2, 2);
  oc.fillRect(56, 24, 2, 2); oc.fillRect(58, 22, 2, 2);

  // Front window
  oc.fillStyle = '#1a3a5a'; oc.fillRect(72, 14, 20, 16);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(72, 14, 2, 16); oc.fillRect(72, 14, 20, 2);

  // Rear window (tapered — fastback)
  oc.fillStyle = '#1a3a5a'; oc.fillRect(94, 14, 22, 16);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(94, 14, 2, 16); oc.fillRect(94, 14, 22, 2);

  // Pillars
  oc.fillStyle = dk;
  oc.fillRect(50, 10, 2, 22);  // A
  oc.fillRect(70, 10, 4, 20);  // B
  oc.fillRect(92, 10, 4, 20);  // C
  oc.fillRect(116, 10, 4, 22); // D
  oc.fillRect(50, 10, 70, 2);  // roof rail

  // Belt rail (chrome)
  oc.fillStyle = '#ccc'; oc.fillRect(50, 30, 70, 2);

  // Accent stripe
  oc.fillStyle = accent; oc.fillRect(12, 30, 116, 2);

  // Headlight
  oc.fillStyle = '#ffff99'; oc.fillRect(4, 20, 8, 6);
  oc.fillStyle = '#ffffff';  oc.fillRect(4, 20, 4, 3);
  oc.fillStyle = '#ffdd00';  oc.fillRect(4, 26, 8, 2);

  // Taillights (long bar)
  oc.fillStyle = '#cc0000'; oc.fillRect(128, 14, 6, 26);
  oc.fillStyle = '#ff2200'; oc.fillRect(128, 14, 6, 8);
  oc.fillStyle = '#550000'; oc.fillRect(128, 22, 6, 2);

  // Exhaust
  oc.fillStyle = '#888'; oc.fillRect(118, 40, 8, 4);
  oc.fillStyle = '#222'; oc.fillRect(119, 41, 6, 2);

  _pxWheel(oc, 26, 42, 8);
  _pxWheel(oc, 112, 42, 8);
}

// ── Lexus GX SUV  (tall, boxy, no trunk) ──────────
// Very tall vertical profile, flat roof, flat rear, 3 windows + rear glass.
function _pxSUV(oc, body, accent) {
  const hi = _lc(body, 0.38), md = body, sh = _dc(body, 0.68), dk = _dc(body, 0.40);

  // Short hood (boxy front)
  oc.fillStyle = hi;  oc.fillRect(6, 14, 28, 2);
  oc.fillStyle = md;  oc.fillRect(6, 16, 28, 18);
  oc.fillStyle = sh;  oc.fillRect(6, 34, 28, 8);
  oc.fillStyle = sh;  oc.fillRect(4, 8, 6, 34);

  // Tall cabin body
  oc.fillStyle = hi;  oc.fillRect(32,  6, 94, 2);
  oc.fillStyle = md;  oc.fillRect(32,  8, 94, 28);
  oc.fillStyle = sh;  oc.fillRect(32, 36, 94, 6);

  // Flat roof (wide, boxy)
  oc.fillStyle = _lc(body, 0.50); oc.fillRect(32, 3, 92, 2);
  oc.fillStyle = hi;               oc.fillRect(32, 5, 92, 2);

  // Flat rear (no trunk — boxy)
  oc.fillStyle = sh;  oc.fillRect(124,  6, 4, 36);
  oc.fillStyle = dk;  oc.fillRect(128,  6, 6, 36);

  // Underbody
  oc.fillStyle = dk; oc.fillRect(6, 42, 122, 2);

  // Windshield (near-vertical)
  oc.fillStyle = '#1a3a5a'; oc.fillRect(34, 10, 14, 26);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(34, 10, 2, 26); oc.fillRect(34, 10, 14, 2);

  // Front side window
  oc.fillStyle = '#1a3a5a'; oc.fillRect(50, 10, 22, 22);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(50, 10, 2, 22); oc.fillRect(50, 10, 22, 2);

  // Rear side window
  oc.fillStyle = '#1a3a5a'; oc.fillRect(74, 10, 22, 22);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(74, 10, 2, 22); oc.fillRect(74, 10, 22, 2);

  // Rear hatch glass
  oc.fillStyle = '#1a3a5a'; oc.fillRect(100, 10, 20, 22);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(100, 10, 2, 22); oc.fillRect(100, 10, 20, 2);

  // Pillars (thick, SUV)
  oc.fillStyle = dk;
  oc.fillRect(32,  4, 4, 32); // A
  oc.fillRect(48,  4, 4, 30); // B
  oc.fillRect(72,  4, 4, 30); // C
  oc.fillRect(98,  4, 4, 30); // D
  oc.fillRect(32,  4, 70, 4); // roof rail

  // Roof rails (chrome bar)
  oc.fillStyle = '#888'; oc.fillRect(34, 2, 88, 2);
  oc.fillStyle = '#bbb'; oc.fillRect(34, 2, 88, 1);

  // Cladding strip
  oc.fillStyle = _dc(body, 0.70); oc.fillRect(8, 36, 118, 6);
  oc.fillStyle = accent;          oc.fillRect(8, 36, 118, 2);

  // Door handles
  oc.fillStyle = '#ccc';
  oc.fillRect(52, 24, 8, 3);
  oc.fillRect(76, 24, 8, 3);

  // Headlight (rectangular SUV)
  oc.fillStyle = '#ffff99'; oc.fillRect(4,  8, 8, 8);
  oc.fillStyle = '#ffffff';  oc.fillRect(4,  8, 4, 4);

  // Taillights (tall vertical bar)
  oc.fillStyle = '#cc0000'; oc.fillRect(128,  8, 6, 28);
  oc.fillStyle = '#ff2200'; oc.fillRect(128,  8, 6, 10);
  oc.fillStyle = '#550000'; oc.fillRect(128, 18, 6, 2);

  _pxWheel(oc, 24, 43, 9);
  _pxWheel(oc, 112, 43, 9);
}

// ── Ford F150 Raptor  (cab + bed truck) ───────────
// Front=cab (left), rear=bed (right). Very tall, lifted.
function _pxRaptor(oc, body, accent) {
  const hi = _lc(body, 0.38), md = body, sh = _dc(body, 0.68), dk = _dc(body, 0.40);

  // Bed (rear, right side)
  oc.fillStyle = hi;  oc.fillRect(78, 16, 52, 2);
  oc.fillStyle = md;  oc.fillRect(78, 18, 52, 22);
  oc.fillStyle = sh;  oc.fillRect(78, 40, 52, 2);
  // Bed top rail
  oc.fillStyle = _dc(body, 0.75); oc.fillRect(80, 14, 50, 4);
  // Bed stake sides
  oc.fillStyle = dk;
  oc.fillRect(90, 14, 2, 26); oc.fillRect(102, 14, 2, 26); oc.fillRect(116, 14, 2, 26);
  // Bed floor
  oc.fillStyle = _dc(body, 0.60); oc.fillRect(80, 16, 48, 2);
  // Tailgate
  oc.fillStyle = sh; oc.fillRect(128, 14, 6, 28);
  oc.fillStyle = dk; oc.fillRect(130, 14, 6, 28);

  // Cab (front, left side) — taller
  oc.fillStyle = hi;  oc.fillRect(8,  8, 68, 2);
  oc.fillStyle = md;  oc.fillRect(8, 10, 68, 28);
  oc.fillStyle = sh;  oc.fillRect(8, 38, 68, 4);

  // Cab roof
  oc.fillStyle = _lc(body, 0.50); oc.fillRect(8, 4, 68, 2);
  oc.fillStyle = hi;               oc.fillRect(8, 6, 68, 2);

  // Cab-bed divider wall
  oc.fillStyle = dk; oc.fillRect(74, 4, 6, 38);

  // Underbody
  oc.fillStyle = dk; oc.fillRect(4, 42, 126, 2);

  // Windshield (raked, 2px steps)
  oc.fillStyle = '#1a3a5a';
  oc.fillRect(12, 32, 10, 2); oc.fillRect(14, 30, 10, 2); oc.fillRect(16, 28, 10, 2);
  oc.fillRect(18, 26, 10, 2); oc.fillRect(20, 24, 10, 2); oc.fillRect(22, 22, 10, 2);
  oc.fillRect(24, 20, 10, 2); oc.fillRect(26, 18, 10, 2); oc.fillRect(28, 16, 10, 2);
  oc.fillRect(30, 14, 10, 2); oc.fillRect(32, 12, 10, 2); oc.fillRect(34, 10, 8, 2);
  oc.fillStyle = '#3a6aaa';
  oc.fillRect(12, 32, 2, 2); oc.fillRect(14, 30, 2, 2); oc.fillRect(16, 28, 2, 2);
  oc.fillRect(18, 26, 2, 2); oc.fillRect(20, 24, 2, 2);

  // Side window (rear of cab)
  oc.fillStyle = '#1a3a5a'; oc.fillRect(44, 10, 26, 24);
  oc.fillStyle = '#3a6aaa'; oc.fillRect(44, 10, 2, 24); oc.fillRect(44, 10, 26, 2);

  // Pillars
  oc.fillStyle = dk;
  oc.fillRect(10,  6, 4, 28); // A-pillar
  oc.fillRect(42,  6, 4, 28); // B-pillar
  oc.fillRect(10,  6, 64, 2); // roof rail

  // Aggressive grille (front)
  oc.fillStyle = '#111'; oc.fillRect(4, 14, 8, 24);
  oc.fillStyle = '#333';
  oc.fillRect(4, 16, 8, 4); oc.fillRect(4, 22, 8, 4); oc.fillRect(4, 28, 8, 4);
  // FORD badge
  oc.fillStyle = '#666'; oc.fillRect(5, 18, 6, 2); oc.fillRect(5, 20, 4, 1);

  // Hood (above grille, high)
  oc.fillStyle = md;  oc.fillRect(4, 6, 8, 8);
  oc.fillStyle = hi;  oc.fillRect(4, 6, 8, 2);

  // Accent stripe on bed
  oc.fillStyle = accent; oc.fillRect(80, 16, 48, 3);

  // Fender flares (dark plastic)
  oc.fillStyle = '#1a1a1a';
  oc.fillRect(8, 40, 22, 4);   // front fender
  oc.fillRect(96, 40, 22, 4);  // rear fender

  // Running boards
  oc.fillStyle = '#333'; oc.fillRect(12, 40, 58, 2);

  // Skid plate
  oc.fillStyle = '#555'; oc.fillRect(4, 36, 14, 4);

  // Headlight
  oc.fillStyle = '#ffff99'; oc.fillRect(4, 6, 8, 8);
  oc.fillStyle = '#ffffff';  oc.fillRect(4, 6, 4, 4);

  // Taillights
  oc.fillStyle = '#cc0000'; oc.fillRect(130, 16, 6, 24);
  oc.fillStyle = '#ff2200'; oc.fillRect(130, 16, 6, 8);

  _pxWheel(oc, 26, 43, 9);
  _pxWheel(oc, 110, 43, 9);
}

// ────────────────────────────────────────────────────
//  TOP-DOWN / REAR VIEW for road rendering
// ────────────────────────────────────────────────────

function drawCarTopDown(ctx, car, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  const bc = car.bodyColor || '#cc0000';
  const ac = car.accentColor || '#880000';
  const hw = w / 2, hh = h / 2;
  const type = car.type || 'sports';

  if (type === 'convertible') {
    ctx.fillStyle = bc;
    ctx.fillRect(-hw, -hh, w, h);
    // Open interior
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(-hw * 0.7, -hh * 0.5, w * 0.7, h * 0.4);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-hw * 0.5, -hh * 0.4, hw * 0.4, hh * 0.5);
    ctx.fillRect(hw * 0.05, -hh * 0.4, hw * 0.4, hh * 0.5);
  } else if (type === 'suv') {
    // Boxy SUV — no trunk, flat rear
    ctx.fillStyle = bc;
    ctx.fillRect(-hw, -hh, w, h);
    // Roof (wide, flat, boxy)
    ctx.fillStyle = ac;
    ctx.fillRect(-hw * 0.8, -hh * 0.7, w * 0.8, h * 0.55);
    // Rear window
    ctx.fillStyle = '#88bbee';
    ctx.fillRect(-hw * 0.55, -hh * 0.6, w * 0.55, h * 0.3);
    // Spare tire bump hint (GX style flat back)
    ctx.fillStyle = bc;
    ctx.fillRect(-hw * 0.3, hh * 0.5, w * 0.3, h * 0.15);
  } else if (type === 'truck') {
    ctx.fillStyle = bc;
    ctx.fillRect(-hw, -hh, w, h * 0.5);
    ctx.fillStyle = ac;
    ctx.fillRect(-hw, 0, w, h * 0.6);
    ctx.fillStyle = '#333';
    ctx.fillRect(-hw * 0.85, hh * 0.1, w * 0.7, h * 0.4);
  } else {
    ctx.fillStyle = bc;
    ctx.fillRect(-hw, -hh, w, h);
    ctx.fillStyle = '#88bbee';
    ctx.fillRect(-hw * 0.7, -hh + 2, hw * 1.4, hh * 0.35);
  }

  // Taillights
  ctx.fillStyle = '#ff2200';
  ctx.fillRect(-hw, hh * 0.6, hw * 0.3, hh * 0.25);
  ctx.fillRect(hw * 0.7, hh * 0.6, hw * 0.3, hh * 0.25);

  // Wheels
  ctx.fillStyle = '#111';
  ctx.fillRect(-hw - 2, -hh + 2, 4, hh * 0.5);
  ctx.fillRect(hw - 2, -hh + 2, 4, hh * 0.5);
  ctx.fillRect(-hw - 2, hh * 0.35, 4, hh * 0.5);
  ctx.fillRect(hw - 2, hh * 0.35, 4, hh * 0.5);

  ctx.restore();
}
