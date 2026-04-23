# VALMONT RACING

A retro pseudo-3D arcade racer built as a single-page HTML5 app. Nine tracks, seven cars, one love letter to the open road.

![Atlanta I-285 hero screenshot placeholder](docs/atlanta-i285.gif)
*(Atlanta I-285 hero GIF — add at `docs/atlanta-i285.gif` for final polish.)*

## Play

→ **[valmont-racing on GitHub Pages](https://valmont-racing.github.io)** *(deploys on push to `main`)*

Keyboard: arrow keys drive, `M` toggles music, `ESC`/`P` pauses, `N` for NOS.
Mobile: tap-hold the steering zones, NOS button bottom-right.

## Architecture

Zero build pipeline. Everything is plain `.html`/`.css`/`.js` served over `file://` or any static host.

- `index.html` — single SPA shell, 6 screens toggled by `.screen.active`
- `js/tracks.js` — 9 Drye-geography tracks + `StorageKeys` + `Tuning` presets
- `js/cars.js` — 7 cars (5 driveable + 2 prize-gated: Ferrari 458 after Atlanta, Cobra 427 after Vegas)
- `js/renderer.js` — canvas pseudo-3D road + skyline + weather + per-track scenery
- `js/game.js` — physics loop, input, unlock cascade, prize gates
- `js/audio.js` — Web Audio engine note (per-car profile) + chiptune music
- `js/ui.js` — screen router, HUD, intro card, credits overlay
- `js/sprites.js` — sprite decode/cache

IIFE globals on purpose — no bundler, no transpile, works offline and on any static host including `file://`. See `memory/project_module_decision.md` for the ES-module rejection.

## Tracks (tier → unlock cascade)

| Tier | Tracks |
|------|--------|
| T1   | Athens GA · Secaucus NJ |
| T2   | Garden City Beach SC · Orlando FL |
| T3   | Oahu HI · Tulum MX |
| T4   | **Atlanta I-285 (HERO)** · NYC |
| T5   | **Vegas Strip (FINALE)** |

Prize cars: Ferrari 458 unlocks after Atlanta qualify. Cobra 427 unlocks after Vegas qualify.

## Development

```bash
# Serve locally — any static server works
python3 -m http.server 8080
# or just open index.html directly (file:// works, no CORS needed)
open index.html
```

**Test plan**: see `.gstack/projects/CitadelAI-Atlas-valmont-racing/citadel-main-eng-review-test-plan-20260423-002708.md` — the `/plan-eng-review` test plan for v1.0.0.
**Deferred items**: see `TODOS.md`.
**Release history**: see `CHANGELOG.md`.

## License

Code: personal project. Art: generic silhouettes chosen to avoid IP entanglement (Orlando castle is NOT Disney-shaped, NYC skyline is generic).
