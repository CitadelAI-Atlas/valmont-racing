// ─────────────────────────────────────────────
//  SPRITES — PNG sprite loader for car art
//
//  Drop files into /sprites/ using this naming:
//    <car-id>_side.png  →  car select screen
//    <car-id>_rear.png  →  in-game driver view
//
//  Car IDs: ferrari458, sl550, cls550,
//           gx460, gx470, raptor
//
//  To add a new sprite: uncomment its line below.
//  Missing files fail silently — fallback to
//  hand-coded pixel art automatically.
// ─────────────────────────────────────────────

const Sprites = (() => {
  const _imgs = {};   // key → HTMLImageElement
  const _ok   = {};   // key → true once loaded

  // Source dimensions for each sprite.
  // For transparent-background sprites the full image is used (x:0, y:0).
  // For black-background sprites, crop to the car bounds to remove dead space.
  const CROPS = {
    cobra_rear:      { x: 0, y: 0, w: 951,  h: 592, scale: 1.10 },
    Cobra_prize:     { x: 0, y: 0, w: 1024, h: 648 },
    sl550_side:      { x: 0, y: 0, w: 974,  h: 260 },
    sl550_rear:      { x: 0, y: 0, w: 852,  h: 517 },
    ferrari458_side: { x: 0, y: 0, w: 990,  h: 267 },
    ferrari458_rear: { x: 0, y: 0, w: 836,  h: 450 },
    cls550_side:     { x: 0, y: 0, w: 922,  h: 256 },
    cls550_rear:     { x: 0, y: 0, w: 945,  h: 664, scale: 1.30 },
    gx460_side:      { x: 0, y: 0, w: 936,  h: 355 },
    gx460_rear:      { x: 0, y: 0, w: 795,  h: 706 },
    gx470_side:      { x: 0, y: 0, w: 941,  h: 363 },
    gx470_rear:      { x: 0, y: 0, w: 1010, h: 1000 },
    raptor_side:     { x: 0, y: 0, w: 997,  h: 367 },
    raptor_rear:     { x: 0, y: 0, w: 1014, h: 799 },

    // Traffic sprites (top-down / 3/4 view)
    Sport01:         { x: 0, y: 0, w: 613,  h: 454 },
    Sport02:         { x: 0, y: 0, w: 909,  h: 587 },
    Sport03:         { x: 0, y: 0, w: 964,  h: 588 },
    OffRoad01:       { x: 0, y: 0, w: 724,  h: 647 },
    OffRoad02:       { x: 0, y: 0, w: 704,  h: 517 },
    Comfort01:       { x: 0, y: 0, w: 864,  h: 590 },
    Highway01:       { x: 0, y: 0, w: 533,  h: 677 },
  };

  const FILES = Object.keys(CROPS);

  FILES.forEach(key => {
    const img = new Image();
    img.onload  = () => { _ok[key] = true; };
    img.onerror = () => { /* silently fall back to hand-coded art */ };
    img.src = 'sprites/' + key + '.png';
    _imgs[key] = img;
  });

  // Returns { img, crop } for (carId, 'side'|'rear'), or null.
  function get(carId, view) {
    const key = carId + '_' + view;
    if (!_ok[key]) return null;
    return { img: _imgs[key], crop: CROPS[key] };
  }

  // Returns { img, crop } for traffic sprite keys (Sport01, Highway01, etc.), or null.
  function getTraffic(key) {
    if (!_ok[key]) return null;
    return { img: _imgs[key], crop: CROPS[key] };
  }

  return { get, getTraffic };
})();
