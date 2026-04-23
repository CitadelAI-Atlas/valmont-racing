# TODOS — Valmont Racing

Deferred items cut from v1.0.0 (Drye Geography Edition) scope. Captured here so they don't evaporate. Not prioritized; not committed to.

## Post-v1.0.0 candidates

- **Vegas split mode** — qualify-then-free-roam on endgame track. Lap the Strip after beating it; no clock, no traffic rules. Reinforces "endgame reward" feel.
- **PWA manifest + install prompt** — mobile home-screen install. Zero-build friendly (just a manifest.json + icons). Turns the URL into an app.
- **Gamepad support** — Xbox/PS controller via Gamepad API. Desktop-play quality jump.
- **Replay / ghost car** — record best lap; race against it. Reuses existing physics state serialization.
- **Accessibility audit** — colorblind-safe palette on HUD, reduced-motion toggle for speed lines + screen shake, keyboard-only nav path.
- **Localization** — string extraction pass. Currently all copy is inline in HTML/JS. Not a v1.0.0 need (portfolio outcome is English-speaking).
- **Menu music sound design pass** — current audio is engine-only. Title screen + car select deserve ambient loops.
- **Proper test framework** — `bun test` or similar. Currently zero automated tests; QA is manual via `/qa`.
- **Seasonal variants on non-Vegas tracks** — Athens night-game edition, Atlanta dusk commute, Garden City sunset. Cheap replay value after Vegas's "after midnight" variant lands.
- **FPS graph overlay** — beyond the basic counter. Rolling 5s graph for perf regression detection during polish passes.

---

*Captured during `/plan-eng-review` on 2026-04-23 for v1.0.0 Drye Geography Edition scope.*
