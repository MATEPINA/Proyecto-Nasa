# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ares-360: offline-first PWA acting as an astronaut helmet HUD for an EVA in Gale Crater / Mount Sharp (Curiosity route) (NASA Space Apps "MarsWalk"). Plain HTML/CSS/vanilla JS, no build step, no frameworks, no package.json. Libraries come from CDN: Pannellum 2.5.6 (360° viewer, jsdelivr) and Leaflet 1.9.4 (minimap, unpkg). UI text, identifiers and data keys are in Spanish — keep that convention.

## Commands

- Run: `python -m http.server 8080` (or `npx serve .`) in the repo root, open `http://localhost:8080`. Opening `index.html` via `file://` is intentionally blocked by `app.js` (service worker and `fetch` of the JSON need http).
- Syntax check (no linter/tests exist): `node --check app.js && node --check service-worker.js`
- Validate data: `node -e "JSON.parse(require('fs').readFileSync('datos_ruta.json','utf8'))"`
- Offline test: load once online until the status chip shows `OFFLINE ✓`, then DevTools → Network → Offline and reload.

## Architecture

**Data-driven from `datos_ruta.json`.** Everything (scenes, hotspots, telemetry, minimap markers, route edges, alert thresholds) derives from it. `mision.umbrales` holds thresholds (slope danger 20°, O₂, radiation EVA limit); `mision.assets` holds the real-asset flags and the map's geographic bounds. Each point has nested `coordenadas` (`lat`, `lng`, `elevacionMOLA`), `navegacion`, `ambiente` and `eva` (simulated O₂ / accumulated dose / `hidratacion_pct`), plus `vaov`, `rumbo_centro`, `conexiones` (graph edges), `minerales` and `hotspots` (`tipo: "ciencia" | "terreno"`, texts in `hallazgo` + `impacto_humanidad`; a `terreno` hotspot renders as danger when `pendiente_grados` exceeds the threshold). `normalizarPunto()` in `app.js` flattens the nested structure into the internal fields (`lat`, `lon`, `pendiente_grados` = |local|, `pendiente_max_grados`, `oxigeno_pct`, …) used by geodesy, fields and the minimap; read nested data (`p.ambiente`, `p.navegacion`) directly for display.

**Heading convention (ties viewer, compass and minimap together).** `rumbo_centro` is the compass heading of the panorama's center column (yaw 0) and is passed to Pannellum as `northOffset`. World heading = `rumbo_centro + viewer.getYaw()`. Navigation hotspot yaw = `bearing(p, neighbor) - rumbo_centro`. The `bucle()` rAF loop polls yaw/hfov each frame to rotate the minimap vision cone (SVG wedge whose angle = hfov) and redraw the compass canvas. Distances/bearings use Mars radius (`radio_marte_m`).

**Real assets + placeholder fallback.** Real images exist (`assets/punto1-4.jpg`, partial-height 360° strips → Pannellum gets `haov: 360, vaov: p.vaov`; square maps `assets/mapa_gale.jpg` + `mapa_gale_hipso.jpg`; originals in `_originales/`) and the flags are `true`. If `usar_imagenes_reales` / `usar_mapa_real` are `false`, `app.js` generates equirectangular panoramas (`generarPanorama`, 4096×2048 canvas → blob URL, seamless via integer-frequency periodic profiles) and the satellite map (`generarMapa`) at boot. Slope/hydration map layers (`generarCampo`) are synthetic fields: a background function plus Gaussian bumps forced to match each point's measured value. Never reference asset files that may not exist without gating on these flags. `assets/README.txt` documents the exact filenames/format for the data team.

**Scene flow.** Pannellum runs in tour mode with one scene per point; all hotspots are `type: 'info'` with custom `createTooltipFunc`/`clickHandlerFunc` (navigation goes through `irA(i)`, which calls `loadScene` facing the travel direction). The `scenechange` event → `alCambiarPunto(i)` is the single place that updates telemetry, map, nav bar and alerts. Pannellum positions hotspots by `offsetWidth`, so hotspot labels must stay absolutely positioned children and animations must not target the hotspot root (Pannellum owns its `transform`).

**Service worker.** Same-origin requests are network-first (so edits show immediately, cache as fallback); CDN requests are cache-first. `CORE` is precached with `addAll` (any missing file breaks install), CDN entries individually. The 6 real Gale assets are in `CORE`; `precacheAssetsOpcionales` additionally caches any image the JSON declares (non-fatal). Bump `VERSION` whenever the precache list or real assets change. CDN `<script>/<link>` tags use `crossorigin="anonymous"` so cached CORS responses match.

**Layout.** `#hud` overlays `#pano` with `pointer-events: none` (drags pass through to the viewer); individual panels re-enable pointer events. Colors are CSS variables in `:root` of `style.css`; metric state classes `ok/warn/crit` set `--c` for bar/value color.
