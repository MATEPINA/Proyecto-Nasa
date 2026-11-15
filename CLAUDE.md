# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ares-360: offline-first PWA acting as an astronaut helmet HUD for an EVA in Gale Crater / Mount Sharp (Curiosity route) (NASA Space Apps "MarsWalk"). Plain HTML/CSS/vanilla JS, no build step, no frameworks, no package.json. Libraries come from CDN: Pannellum 2.5.6 (360° viewer, jsdelivr) and Leaflet 1.9.4 (minimap, unpkg). UI text, identifiers, comments and data keys are in English — keep that convention.

## Commands

- Run: `python -m http.server 8080` (or `npx serve .`) in the repo root, open `http://localhost:8080`. Opening `index.html` via `file://` is intentionally blocked by `app.js` (service worker and `fetch` of the JSON need http).
- Syntax check (no linter/tests exist): `node --check app.js && node --check service-worker.js`
- Validate data: `node -e "JSON.parse(require('fs').readFileSync('route_data.json','utf8'))"`
- Regenerate data: `python generate_mission.py` (overwrites `route_data.json` with computed distances / O₂ / dose; the committed JSON has hand-tuned values).
- Offline test: load once online until the status chip shows `OFFLINE ✓`, then DevTools → Network → Offline and reload.

## Architecture

**Data-driven from `route_data.json`.** Everything (scenes, hotspots, telemetry, minimap markers, route edges, alert thresholds) derives from it. `mission.thresholds` holds thresholds (slope danger 20°, O₂, radiation EVA limit); `mission.assets` holds the real-asset flags and the map's geographic bounds (`map_bounds`). Each point has nested `coordinates` (`lat`, `lng`, `elevationMOLA`), `navigation`, `environment` and `eva` (simulated O₂ / accumulated dose / `hydration_pct`), plus `vaov`, `center_heading`, `connections` (graph edges), `minerals` and `hotspots` (`type: "science" | "terrain"`, texts in `finding` + `impact_on_humanity`; a `terrain` hotspot renders as danger when `slope_degrees` exceeds the threshold). `navigation.terrainStatus` must start with `DANGER`, `CAUTION` or `STABLE` (drives colors/alerts). `normalizePoint()` in `app.js` flattens the nested structure into the internal fields (`lat`, `lon`, `slope_degrees` = |local|, `slope_max_degrees`, `oxygen_pct`, …) used by geodesy, fields and the minimap; read nested data (`p.environment`, `p.navigation`) directly for display.

**Heading convention (ties viewer, compass and minimap together).** `center_heading` is the compass heading of the panorama's center column (yaw 0) and is passed to Pannellum as `northOffset`. World heading = `center_heading + viewer.getYaw()`. Navigation hotspot yaw = `bearing(p, neighbor) - center_heading`. The `loop()` rAF loop polls yaw/hfov each frame to rotate the minimap vision cone (SVG wedge whose angle = hfov) and redraw the compass canvas. Distances/bearings use Mars radius (`mars_radius_m`).

**Real assets + placeholder fallback.** Real images exist (`assets/point1-4.jpg`, partial-height 360° strips → Pannellum gets `haov: 360, vaov: p.vaov`; square maps `assets/gale_map.jpg` + `gale_map_hypso.jpg`; originals in `_originals/`) and the flags are `true`. If `use_real_images` / `use_real_map` are `false`, `app.js` generates equirectangular panoramas (`generatePanorama`, 4096×2048 canvas → blob URL, seamless via integer-frequency periodic profiles) and the satellite map (`generateMap`) at boot. Slope/hydration map layers (`generateField`) are synthetic fields: a background function plus Gaussian bumps forced to match each point's measured value. Never reference asset files that may not exist without gating on these flags. `assets/README.txt` documents the exact filenames/format for the data team.

**Scene flow.** Pannellum runs in tour mode with one scene per point; all hotspots are `type: 'info'` with custom `createTooltipFunc`/`clickHandlerFunc` (navigation goes through `goTo(i)`, which calls `loadScene` facing the travel direction). The `scenechange` event → `onPointChange(i)` is the single place that updates telemetry, map, nav bar and alerts. Pannellum positions hotspots by `offsetWidth`, so hotspot labels must stay absolutely positioned children and animations must not target the hotspot root (Pannellum owns its `transform`).

**Service worker.** Same-origin requests are network-first (so edits show immediately, cache as fallback); CDN requests are cache-first. `CORE` is precached with `addAll` (any missing file breaks install), CDN entries individually. The 6 real Gale assets are in `CORE`; `precacheOptionalAssets` additionally caches any image the JSON declares (non-fatal). Bump `VERSION` whenever the precache list or real assets change. CDN `<script>/<link>` tags use `crossorigin="anonymous"` so cached CORS responses match.

**Layout.** `#hud` overlays `#pano` with `pointer-events: none` (drags pass through to the viewer); individual panels re-enable pointer events. Colors are CSS variables in `:root` of `style.css`; metric state classes `ok/warn/crit` set `--c` for bar/value color. The briefing modal and EVA simulator drawer live in an inline script at the end of `index.html` and only observe DOM written by `app.js` (`#t-auto`, the radiation bar fill).
