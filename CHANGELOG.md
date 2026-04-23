# CHANGELOG — Valmont Racing

## v1.0.0 — Drye Geography Edition (2026-04-23)

**The 9-track rewrite.** Every track is now a place tied to the Drye family, not a generic racing-game stop.

### Added
- **9 Drye-family-geography tracks** replacing the prior 12-track generic roster
  - T1 — Athens GA (stadium game-day), Secaucus NJ (mild commute)
  - T2 — Garden City Beach SC (sunny palms), Orlando FL (generic 4-tower castle, DMCA-safe)
  - T3 — Oahu HI (volcanic ridges, light rain), Tulum MX (golden-hour jungle)
  - T4 — **Atlanta I-285 HERO** (rush-hour haze, 0.90 traffic density), NYC (overcast)
  - T5 — Vegas Strip (neon night finale)
- **Atlanta I-285** is the new signature mid-game track — commuter mix, overpass signage, dense traffic
- **Track intro cards** stencil the name ("ATLANTA · I-285 · RUSH HOUR") for ~1.5s before the countdown
- **Car-specific engine profiles** — Ferrari high-rev, Cobra V8 square-wave punch, Raptor low-rumble triangle, SL/CLS diesel sawtooth hum, GX mid-range
- **Vegas credits roll + dedication card**: "For my Family, my Friends, and the Open Road." One-shot, plays on first Vegas completion
- New weather modes: `golden_hour`, `partly_cloudy`, `rush_hour_haze`
- **Ferrari 458 prize gate** relocated from prior track → **Atlanta I-285**
- **Cobra 427 prize gate** locked to **Vegas Strip**
- New scenery sprites: stadium crowd, beach house, overpass sign, neon sign, monorail, balloon, tiki hut, skyscraper
- New skyline silhouettes: Athens stadium, Atlanta, NYC, Vegas neon, Orlando castle, Oahu volcanic ridges
- GitHub Pages deploy workflow — `actions/deploy-pages@v4` on push to main

### Changed
- One-time save migration on v1.0.0 boot: progress/leaderboard/prize-unlock keys bumped to `_v2`. Tuning preset preserved at `_v1`. Old completion data is cleared (clean break, no partial migration).
- Cache-bust `?v=83` → `?v=100` on all CSS/JS refs to force fresh asset load for returning players
- Tier cascade: T5 is now single-track (Vegas). Completing it triggers the GAME COMPLETE trophy on the title screen

### Removed
- 12 generic tracks (Tokyo, Monaco, Fuji, Alps, Route 66, PCH, etc.) — replaced wholesale. Premise specificity over coverage
- 4 dead skyline styles (fuji/alps/amalfi/baja) and 4 dead city styles (tokyo/dubai/la/monaco)

### Deferred to post-v1.0.0
See `TODOS.md` for the full list: Vegas split mode, PWA install, gamepad support, replay/ghost, accessibility audit, localization.

---

*Portfolio outcome: shareable URL at ~100–1000 visitors. Runs on iOS Safari + Android Chrome.*
