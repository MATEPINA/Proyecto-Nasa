/* =========================================================
   Ares-360 · Tactical EVA HUD (MarsWalk · NASA Space Apps)
   Plain JavaScript + Pannellum (360°) + Leaflet (minimap)
   ========================================================= */
'use strict';
(() => {
  // ---------- Utilities ----------
  const $ = (s, r = document) => r.querySelector(s);
  const RAD = Math.PI / 180;
  const norm360 = a => ((a % 360) + 360) % 360;
  const norm180 = a => { a = norm360(a); return a > 180 ? a - 360 : a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad3 = n => String(Math.round(norm360(n)) % 360).padStart(3, '0');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tick = () => new Promise(r => setTimeout(r, 16));
  const FONT = '"Cascadia Mono", Consolas, monospace';
  const CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- Global state ----------
  const S = {
    data: null, P: [], U: null, R: 3389500, idx: 0,
    viewer: null, map: null, layers: {}, mode: 0,
    pano: {}, heading: -1, hfov: -1, dpr: Math.min(window.devicePixelRatio || 1, 2),
  };
  // The 'hypso' mode is only offered if the real layer exists (see initMap)
  const ALL_MODES = [
    { id: 'satellite', label: 'REAL SATELLITE' },
    { id: 'hypso', label: 'HYPSOMETRIC MAP' },
    { id: 'slope', label: 'SLOPES & OBSTACLES' },
    { id: 'hydration', label: 'MINERAL HYDRATION / ISRU' },
  ];
  let MODES = ALL_MODES;
  const RAMPS = {
    slope: { min: 0, max: 35, unit: '°', stops: [[0, [48, 209, 88]], [0.34, [255, 214, 10]], [0.57, [255, 159, 10]], [0.7, [255, 59, 48]], [1, [170, 0, 40]]] },
    hydration: { min: 0, max: 8, unit: '% H₂O', stops: [[0, [20, 70, 170]], [0.5, [0, 200, 255]], [1, [225, 255, 255]]] },
  };
  const HYDR_DEFAULT = 3, REGOLITH_DENSITY = 1500;   // fallback % H₂O · kg/m³ (for extractable L/m³)

  // ---------- Martian geodesy ----------
  function bearing(a, b) {
    const f1 = a.lat * RAD, f2 = b.lat * RAD, dl = (b.lon - a.lon) * RAD;
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return norm360(Math.atan2(y, x) / RAD);
  }
  function distance(a, b) {
    const df = (b.lat - a.lat) * RAD, dl = (b.lon - a.lon) * RAD;
    const h = Math.sin(df / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dl / 2) ** 2;
    return 2 * S.R * Math.asin(Math.sqrt(h));
  }
  const byId = id => S.P.find(p => p.id === id);
  const numOr = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const hydrOf = p => numOr(p.hydration_pct, HYDR_DEFAULT);
  const waterOf = p => hydrOf(p) / 100 * REGOLITH_DENSITY;   // 1 kg H₂O ≈ 1 L
  // Danger hotspot: explicit "danger" type, or "terrain" above the slope threshold
  const isDanger = h => h.type === 'danger' || (h.type === 'terrain' && h.slope_degrees > S.U.slope_danger_degrees);
  const fmtSlope = h => Number.isFinite(h.slope_degrees) ? h.slope_degrees.toFixed(1) + '°' : '—';
  const fmtLat = v => `${Math.abs(v).toFixed(4)}°${v < 0 ? 'S' : 'N'}`;
  const fmtLon = v => `${Math.abs(v).toFixed(4)}°${v < 0 ? 'W' : 'E'}`;
  const terrainLevel = e => /^DANGER/i.test(e || '') ? 'crit' : /^CAUTION/i.test(e || '') ? 'warn' : 'ok';
  // Dangerous point: surrounding slope above threshold or terrain declared DANGER
  const isDangerPoint = p => p.slope_max_degrees > S.U.slope_danger_degrees || terrainLevel(p.navigation?.terrainStatus) === 'crit';

  // Adapter: JSON structure (coordinates / navigation / environment / eva) → flat fields
  // used by geodesy, synthetic fields and the minimap. The original JSON is left untouched.
  function normalizePoint(p) {
    const c = p.coordinates || {}, n = p.navigation || {}, a = p.environment || {}, e = p.eva || {};
    p.lat = numOr(c.lat, p.lat);
    p.lon = numOr(c.lng, p.lon);
    p.elevation_m = numOr(c.elevationMOLA, p.elevation_m);
    p.slope_degrees = Math.abs(numOr(n.localSlopeDegrees, p.slope_degrees ?? 0));
    p.slope_max_degrees = numOr(n.maxSurroundingSlopeDegrees, p.slope_degrees);
    p.oxygen_pct = numOr(e.oxygen_pct, numOr(p.oxygen_pct, 100));
    p.accumulated_radiation_msv = numOr(e.accumulated_radiation_msv, numOr(p.accumulated_radiation_msv, 0));
    p.hydration_pct = numOr(e.hydration_pct, p.hydration_pct);
    const dosePerDay = a.radiation?.doseRADmSvDay;
    p.dose_rate_usv_h = Number.isFinite(dosePerDay) ? dosePerDay * 1000 / 24 : numOr(p.dose_rate_usv_h, 0);
    return p;
  }

  // =========================================================
  //  BOOT
  // =========================================================
  function bootMsg(msg, pct) {
    $('#boot-msg').textContent = msg;
    if (pct != null) $('#boot-fill').style.width = pct + '%';
  }
  function fatal(html) {
    const m = $('#boot-msg');
    m.classList.add('err'); m.innerHTML = '⚠ ' + html;
    $('#boot').classList.remove('out');
    $('#boot-fill').style.background = 'var(--alert)';
  }
  function hideBoot() { bootMsg('SYSTEMS NOMINAL', 100); setTimeout(() => $('#boot').classList.add('out'), 350); }

  async function boot() {
    if (location.protocol === 'file:') {
      return fatal('This app must be opened from a local server, not by double-clicking.<br><br>In the project folder run:<br><code>python -m http.server 8080</code><br>and open <code>http://localhost:8080</code>');
    }
    if (typeof pannellum === 'undefined' || typeof L === 'undefined') {
      return fatal('Could not load Pannellum/Leaflet. The first load needs an Internet connection; after that it works offline.');
    }
    registerSW(); marsClock(); connectivity();

    try {
      bootMsg('LINKING TO ROUTE DATABASE…', 10);
      const r = await fetch('route_data.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      S.data = await r.json();
    } catch (e) {
      return fatal('Could not load <code>route_data.json</code>: ' + esc(e.message));
    }
    S.P = S.data.points.map(normalizePoint);
    S.U = S.data.mission.thresholds;
    S.R = S.data.mission.mars_radius_m || S.R;
    const A = S.data.mission.assets;

    for (let i = 0; i < S.P.length; i++) {
      const p = S.P[i];
      bootMsg(`RECONSTRUCTING TERRAIN ${p.id.toUpperCase()} · ${p.name.toUpperCase()}…`, 20 + i * 20);
      await tick();
      S.pano[p.id] = A.use_real_images ? p.image : await generatePanorama(p, i);
    }
    bootMsg('DEPLOYING TACTICAL MINIMAP…', 85); await tick();
    initMap();
    initUI();
    bootMsg('DOCKING 360° VIEWER…', 92); await tick();
    initViewer();
    requestAnimationFrame(loop);
  }

  // =========================================================
  //  PLACEHOLDER: MARTIAN EQUIRECTANGULAR PANORAMA (Canvas)
  // =========================================================
  function periodicProfile(W, seed, fmin, fmax, n) {
    const r = mulberry32(seed), comps = [];
    for (let j = 0; j < n; j++) {
      const f = Math.round(fmin + r() * (fmax - fmin));
      comps.push([f, r() * Math.PI * 2, 1 / Math.sqrt(f)]);
    }
    const sum = comps.reduce((a, c) => a + c[2], 0);
    return x => { let v = 0; for (const [f, ph, a] of comps) v += a * Math.sin(2 * Math.PI * f * x / W + ph); return v / sum; };
  }

  function generatePanorama(p, i) {
    const W = 4096, H = 2048, hz = H / 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rnd = mulberry32(4242 + i * 977);
    const rp = p.render_placeholder || {};
    const rough = rp.roughness ?? 0.5;
    const xFromHeading = r => ((norm180(r - p.center_heading) + 180) / 360) * W;
    const headingFromX = x => norm360(p.center_heading + (x / W) * 360 - 180);
    const bump = x => {
      if (rp.relief_heading == null) return 0;
      const d = Math.abs(norm180(headingFromX(x) - rp.relief_heading));
      return Math.exp(-((d / 38) ** 2));
    };

    // Martian butterscotch sky
    let gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#1a1210'); gr.addColorStop(0.4, '#5e3b2b');
    gr.addColorStop(0.8, '#bb8660'); gr.addColorStop(1, '#dcae86');
    g.fillStyle = gr; g.fillRect(0, 0, W, hz);

    // Sun (smaller than on Earth, with a bluish halo)
    const sx = xFromHeading(rp.sun_heading ?? 120), sy = hz * 0.42;
    for (const off of [-W, 0, W]) {
      let sg = g.createRadialGradient(sx + off, sy, 0, sx + off, sy, 320);
      sg.addColorStop(0, 'rgba(255,246,230,.75)'); sg.addColorStop(0.08, 'rgba(200,220,255,.35)');
      sg.addColorStop(0.3, 'rgba(230,180,140,.12)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(sx + off - 320, sy - 320, 640, 640);
    }

    // Far layer: crater rim visible low along the whole horizon (placeholder)
    const pf = periodicProfile(W, 11 + i, 2, 30, 14);
    const pm = periodicProfile(W, 91 + i, 3, 60, 18);
    const pn = periodicProfile(W, 171 + i, 8, 120, 22);
    const layer = (fy, colTop, colBot, height) => {
      g.beginPath(); g.moveTo(0, hz + 2);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, hz - fy(x));
      g.lineTo(W, hz + 2); g.closePath();
      const lg = g.createLinearGradient(0, hz - height, 0, hz);
      lg.addColorStop(0, colTop); lg.addColorStop(1, colBot);
      g.fillStyle = lg; g.fill();
    };
    layer(x => 22 + 26 * (pf(x) + 1) / 2, '#a77a5e', '#8e644a', 60);
    layer(x => 6 + 18 * (pm(x) + 1) / 2 * rough + bump(x) * (rp.relief_height || 0) * H, '#7b4c35', '#6a3f2c', 220);
    layer(x => 2 + 8 * (pn(x) + 1) / 2 * rough + bump(x) * (rp.relief_height || 0) * H * 0.35, '#6a3d29', '#7d4a31', 120);

    // Strata on the relief (delta/ridges)
    if ((rp.relief_height || 0) > 0.05) {
      g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#d8a27a'; g.lineWidth = 2;
      for (let k = 1; k < 10; k++) {
        g.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const b = bump(x); if (b < 0.25) { g.moveTo(x, hz); continue; }
          g.lineTo(x, hz - b * rp.relief_height * H * (k / 11) - pm(x) * 6);
        }
        g.stroke();
      }
      g.restore();
    }

    // Ground
    gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, '#9c6544'); gr.addColorStop(0.35, '#7a4630');
    gr.addColorStop(0.8, '#3d2216'); gr.addColorStop(1, '#1a0e09');
    g.fillStyle = gr; g.fillRect(0, hz, W, hz);

    // Regolith texture
    for (let k = 0; k < 60000; k++) {
      const y = hz + Math.pow(rnd(), 1.25) * hz;
      const t = (y - hz) / hz;
      const s = 1 + t * 3 * rnd();
      g.fillStyle = rnd() < 0.5 ? `rgba(30,14,8,${0.1 + 0.15 * rnd()})` : `rgba(230,170,120,${0.05 + 0.1 * rnd()})`;
      g.fillRect(rnd() * W, y, s, s * 0.6);
    }
    // Aeolian ripples
    g.save(); g.lineWidth = 3;
    for (let k = 0; k < 40; k++) {
      const y0 = hz + 30 + Math.pow(rnd(), 1.6) * hz * 0.6, x0 = rnd() * W, len = 200 + rnd() * 700;
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '40,20,12' : '220,160,110'},.12)`;
      g.beginPath();
      for (let x = 0; x <= len; x += 10) g.lineTo((x0 + x) % W, y0 + Math.sin(x / 40) * 4);
      g.stroke();
    }
    g.restore();

    // Rocks (larger the closer they are)
    const nRocks = Math.round(220 + rough * 260);
    for (let k = 0; k < nRocks; k++) {
      const y = hz + 6 + Math.pow(rnd(), 1.7) * hz * 0.9;
      const t = (y - hz) / hz;
      const r = (2 + t * t * 80 * (0.3 + rnd())) * (0.6 + rough * 0.6);
      const x = rnd() * W;
      const tone = 60 + rnd() * 50;
      const draw = (xx) => {
        g.fillStyle = 'rgba(15,6,3,.45)';
        g.beginPath(); g.ellipse(xx + r * 0.35, y + r * 0.25, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = `rgb(${tone + 25},${tone * 0.6},${tone * 0.42})`;
        g.beginPath(); g.ellipse(xx, y, r, r * (0.45 + rnd() * 0.25), 0, Math.PI, 0); g.lineTo(xx + r, y); g.ellipse(xx, y, r, r * 0.22, 0, 0, Math.PI); g.fill();
        g.fillStyle = 'rgba(255,215,170,.18)';
        g.beginPath(); g.ellipse(xx - r * 0.3, y - r * 0.18, r * 0.45, r * 0.16, -0.3, 0, Math.PI * 2); g.fill();
      };
      draw(x);
      if (x < r * 2) draw(x + W);
      if (x > W - r * 2) draw(x - W);
    }

    // Calibration overlay: horizon and headings
    g.save();
    g.strokeStyle = 'rgba(0,240,255,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, hz); g.lineTo(W, hz); g.stroke();
    g.font = `bold 30px ${FONT}`; g.textAlign = 'center'; g.fillStyle = 'rgba(0,240,255,.55)';
    for (let r = 0; r < 360; r += 15) {
      const x = xFromHeading(r);
      g.beginPath(); g.moveTo(x, hz + 4); g.lineTo(x, hz + (r % 45 ? 14 : 28)); g.stroke();
      if (r % 45 === 0) g.fillText(CARD[r / 45], x, hz + 62);
    }
    g.font = `bold 34px ${FONT}`; g.fillStyle = 'rgba(0,240,255,.18)';
    for (let r = 0; r < 360; r += 90) g.fillText(`PLACEHOLDER · ${p.image}`, xFromHeading(r + 45), hz + hz * 0.5);
    g.restore();

    return new Promise(res => c.toBlob(b => res(URL.createObjectURL(b)), 'image/jpeg', 0.9));
  }

  // =========================================================
  //  PLACEHOLDER: SATELLITE CROP (Canvas)
  // =========================================================
  function mapAspect(lim) {
    const latSpan = lim[1][0] - lim[0][0], lonSpan = lim[1][1] - lim[0][1];
    const latC = (lim[0][0] + lim[1][0]) / 2;
    return (lonSpan * Math.cos(latC * RAD)) / latSpan;
  }
  function projector(lim, w, h) {
    return {
      x: lon => (lon - lim[0][1]) / (lim[1][1] - lim[0][1]) * w,
      y: lat => (lim[1][0] - lat) / (lim[1][0] - lim[0][0]) * h,
      lon: x => lim[0][1] + x / w * (lim[1][1] - lim[0][1]),
      lat: y => lim[1][0] - y / h * (lim[1][0] - lim[0][0]),
    };
  }

  function generateMap(lim) {
    const w = 1024, h = Math.round(1024 / mapAspect(lim));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), rnd = mulberry32(777), P = projector(lim, w, h);

    g.fillStyle = '#5a3a2a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 600; k++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 120;
      const gg = g.createRadialGradient(x, y, 0, x, y, r);
      const light = rnd() < 0.5;
      gg.addColorStop(0, light ? 'rgba(190,130,95,.10)' : 'rgba(25,12,8,.12)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Fan (west): light alluvial fan with lobes
    const fx = P.x(S.geo.front);
    for (let k = 0; k < 7; k++) {
      g.fillStyle = `rgba(${165 + k * 6},${112 + k * 4},${80 + k * 3},.28)`;
      g.beginPath();
      g.ellipse(-40, h * (0.2 + rnd() * 0.5), fx + 20 + rnd() * 60, h * (0.25 + rnd() * 0.2), (rnd() - 0.5) * 0.6, -Math.PI / 2, Math.PI / 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(40,20,12,.5)'; g.lineWidth = 3; g.beginPath();
    for (let y = 0; y <= h; y += 6) g.lineTo(fx + Math.sin(y / 30) * 12 + Math.sin(y / 9) * 4, y);
    g.stroke();
    // Fossil channels on the fan
    g.strokeStyle = 'rgba(230,180,140,.25)'; g.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      g.beginPath(); let y = h * (0.1 + rnd() * 0.8);
      for (let x = 0; x < fx; x += 6) { y += (rnd() - 0.5) * 8; g.lineTo(x, y); }
      g.stroke();
    }
    // Ridge field (south): dark parallel ridges
    g.strokeStyle = 'rgba(30,14,9,.35)'; g.lineWidth = 2;
    const sy = P.y(S.geo.ridge);
    for (let k = 0; k < 70; k++) {
      const x0 = P.x(S.geo.front + 0.08 * S.geo.lonS) + rnd() * (w * 0.55), y0 = sy + rnd() * (h - sy);
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + 20, y0 - 8, x0 + 40 + rnd() * 30, y0 - 4); g.stroke();
    }
    // Craters
    for (let k = 0; k < 80; k++) {
      const x = rnd() * w, y = rnd() * h, r = 3 + Math.pow(rnd(), 3) * 30;
      g.fillStyle = 'rgba(20,9,5,.35)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(220,170,130,.35)'; g.lineWidth = Math.max(1, r / 6);
      g.beginPath(); g.arc(x, y, r, Math.PI * 0.1, Math.PI * 1.1); g.stroke();
    }
    // Grid
    g.strokeStyle = 'rgba(0,240,255,.08)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.font = `bold 16px ${FONT}`; g.fillStyle = 'rgba(0,240,255,.35)';
    g.fillText(`PLACEHOLDER · ${S.data.mission.assets.map || 'assets/gale_map.jpg'}`, 16, h - 16);
    return c.toDataURL('image/png');
  }

  // ---------- Slope / mineral hydration fields ----------
  // Geographic reference relative to the map bounds (works for Gale, Jezero, etc.)
  function geoRef(lim) {
    const latS = lim[1][0] - lim[0][0], lonS = lim[1][1] - lim[0][1];
    const widthM = distance({ lat: lim[0][0], lon: lim[0][1] }, { lat: lim[0][0], lon: lim[1][1] });
    return {
      latC: (lim[0][0] + lim[1][0]) / 2, lonC: (lim[0][1] + lim[1][1]) / 2, latS, lonS,
      front: lim[0][1] + 0.3 * lonS,       // fictional scarp/feature of the placeholder
      ridge: lim[0][0] + 0.42 * latS,      // fictional ridge zone of the placeholder
      sigma: Math.max(40, widthM * 0.08),  // influence radius of each measurement (m)
    };
  }
  function fieldBackground(kind, lat, lon) {
    const G = S.geo, nx = (lon - G.lonC) / G.lonS, ny = (lat - G.latC) / G.latS;   // -0.5..0.5
    const x = nx * 35, y = ny * 25;
    if (kind === 'slope') {
      // Gale Crater: nearly flat plain to the NW that steepens toward Mount Sharp (SE),
      // with a NE-SW band of ridges/dunes in the transition (synthetic)
      const s = nx - ny;   // -1 (NW) .. +1 (SE)
      let v = 4 + 7 * s + 2 * Math.sin(x * 1.9 + 1.3) * Math.cos(y * 2.3) + 1.5 * Math.sin(x * 5.1 + y * 4.2);
      v += 9 * Math.exp(-(((s - 0.3) / 0.12) ** 2)) * (0.7 + 0.3 * Math.sin(x * 4 + y * 4));
      return Math.max(0, v);
    }
    // hydration (% bound H₂O): increases gently toward the Mount Sharp strata
    return clamp(2.4 + 1.2 * (nx - ny) + 0.6 * Math.sin(x * 1.1 + 0.7) * Math.cos(y * 1.5) + 0.3 * Math.sin(x * 3.7 + y * 2.9), 0, 100);
  }
  // The slope field is forced to each point's MAXIMUM surrounding slope (zones >20° in red)
  const pointValue = (kind, p) => kind === 'slope' ? p.slope_max_degrees : hydrOf(p);
  function fieldValue(kind, lat, lon) {
    let v = fieldBackground(kind, lat, lon);
    const s2 = 2 * S.geo.sigma * S.geo.sigma;
    for (const p of S.P) {
      const d = distance({ lat, lon }, p);
      v += (pointValue(kind, p) - fieldBackground(kind, p.lat, p.lon)) * Math.exp(-(d * d) / s2);
    }
    return v;
  }
  function rampColor(kind, v) {
    const R = RAMPS[kind], t = clamp((v - R.min) / (R.max - R.min), 0, 1);
    let i = 0;
    while (i < R.stops.length - 2 && t > R.stops[i + 1][0]) i++;
    const [t0, c0] = R.stops[i], [t1, c1] = R.stops[i + 1];
    const k = clamp((t - t0) / (t1 - t0 || 1), 0, 1);
    return c0.map((c, j) => Math.round(lerp(c, c1[j], k)));
  }
  function generateField(kind, lim) {
    const w = 170, h = Math.round(170 / mapAspect(lim));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h), P = projector(lim, w, h);
    const U = S.U.slope_danger_degrees;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = fieldValue(kind, P.lat(y + 0.5), P.lon(x + 0.5));
      let [r, gg, b] = rampColor(kind, v), a;
      if (kind === 'slope') {
        // Only highlight what matters: faint in caution, solid red above the threshold
        if (v > U) { r = 255; gg = 45; b = 45; a = 215; }
        else a = clamp((v - 6) / (U - 6), 0, 1) * 110;
      } else {
        // Cyan aura: transparent where there is little bound water, bright where there is a lot
        a = clamp((v - RAMPS.hydration.min) / (RAMPS.hydration.max - RAMPS.hydration.min), 0, 1) ** 1.4 * 235;
      }
      const o = (y * w + x) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = a;
    }
    g.putImageData(img, 0, 0);
    if (kind === 'slope') {   // white threshold contour
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let y = 1; y < h; y++) for (let x = 1; x < w; x++) {
        const a = fieldValue(kind, P.lat(y), P.lon(x)) > U;
        const b = fieldValue(kind, P.lat(y), P.lon(x - 1)) > U;
        if (a !== b) g.fillRect(x, y, 1, 1);
      }
    }
    return c.toDataURL('image/png');
  }

  // =========================================================
  //  360° VIEWER (Pannellum)
  // =========================================================
  function hotspotsOf(p) {
    const hs = [];
    (p.connections || []).forEach(id => {
      const n = byId(id); if (!n) return;
      const b = bearing(p, n), d = distance(p, n);
      // Keep the arrow inside the vertical field of partial panoramas
      const vaov = S.data.mission.assets.use_real_images ? (p.vaov || 180) : 180;
      hs.push({
        id: 'nav-' + id, type: 'info', pitch: Math.max(-17, -vaov / 2 + 8), yaw: norm180(b - p.center_heading),
        cssClass: 'hs-nav', createTooltipFunc: tipNav, createTooltipArgs: { n, b, d },
        clickHandlerFunc: () => goTo(S.P.indexOf(n)),
      });
    });
    (p.hotspots || []).forEach((h, k) => {
      const danger = isDanger(h);
      const cls = h.type === 'science' ? 'hs-sci' : (danger ? 'hs-danger' : 'hs-terrain');
      hs.push({
        id: `hs-${p.id}-${k}`, type: 'info', pitch: h.pitch, yaw: h.yaw, cssClass: cls,
        createTooltipFunc: tipData, createTooltipArgs: { h, danger },
        clickHandlerFunc: () => showDetail(h, danger),
      });
    });
    return hs;
  }
  function tipNav(div, a) {
    div.innerHTML = `<div class="hs-ring"></div><div class="hs-arrow"></div><div class="hs-arrow b"></div>
      <div class="hs-label">▲ ${esc(a.n.id.toUpperCase())} · ${esc(a.n.name)}<small>${Math.round(a.d)} m · HEADING ${pad3(a.b)}°</small></div>`;
  }
  const truncate = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  function tipData(div, a) {
    const h = a.h, sci = h.type === 'science';
    const icon = sci ? '◆' : (a.danger ? '⚠' : '▲');
    const sub = sci ? `${esc(h.instrument || 'CRISM')} · ${esc(h.mineral)} · ${Math.round(numOr(h.confidence, 0) * 100)}%`
      : `${a.danger ? 'DANGER · ' : ''}SLOPE ${fmtSlope(h)}`;
    const finding = h.finding || h.description;
    div.innerHTML = `<div class="hs-ring"></div><div class="hs-core"><span>${icon}</span></div>
      <div class="hs-label">${esc(h.title)}<small>${sub}</small>${finding ? `<small class="hs-finding">${esc(truncate(finding, 72))}</small>` : ''}</div>`;
  }

  function initViewer() {
    const scenes = {};
    S.P.forEach(p => {
      // Partial real panoramas: 360° horizontally, vaov = 360·height/width (computed when optimizing them)
      const vaov = S.data.mission.assets.use_real_images ? (p.vaov || 180) : 180;
      scenes[p.id] = {
        type: 'equirectangular', panorama: S.pano[p.id], northOffset: p.center_heading,
        // Pannellum does not limit pitch on partial panoramas by itself: without minPitch/maxPitch
        // the black background shows and avoidShowingBackground computes hfov = NaN
        haov: 360, vaov, vOffset: 0, minPitch: -vaov / 2, maxPitch: vaov / 2,
        hfov: 100, pitch: -4, yaw: 0, hotSpots: hotspotsOf(p),
      };
    });
    S.viewer = pannellum.viewer('pano', {
      default: {
        firstScene: S.P[0].id, sceneFadeDuration: 900, autoLoad: true, avoidShowingBackground: true,
        showControls: false, compass: false, minHfov: 45, maxHfov: 120, friction: 0.15,
        strings: { loadingLabel: 'LOADING PANORAMA…', loadButtonLabel: 'LOAD' },
      },
      scenes,
    });
    let first = true;
    S.viewer.on('load', () => { if (first) { first = false; hideBoot(); } });
    S.viewer.on('scenechange', id => onPointChange(S.P.findIndex(p => p.id === id)));
    S.viewer.on('error', m => fatal('360° viewer error: ' + esc(m) + '<br>Check the file names in <code>assets/README.txt</code>.'));
    onPointChange(0);
  }

  function goTo(i) {
    if (!S.viewer || i < 0 || i >= S.P.length || i === S.idx) return;
    const from = S.P[S.idx], to = S.P[i];
    const arrival = norm180(bearing(from, to) - to.center_heading); // face the direction of travel
    S.viewer.loadScene(to.id, -4, arrival, 100);
  }

  function onPointChange(i) {
    if (i < 0) return;
    S.idx = i;
    const p = S.P[i];
    updateTelemetry(p);
    updateMapPoint(p);
    updateNav();
    updateAlerts(p);
    closeDetail();
    S.heading = -1; // force redraw
  }

  // =========================================================
  //  TELEMETRY
  // =========================================================
  function animateNumber(el, to, dec) {
    const from = parseFloat(el.dataset.v || 0), t0 = performance.now(), dur = 900;
    el.dataset.v = to;
    const f = t => {
      const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (from + (to - from) * e).toFixed(dec);
      if (k < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }
  function setMetric(id, val, max, state, dec) {
    const el = $('#' + id);
    el.classList.remove('ok', 'warn', 'crit'); el.classList.add(state);
    el.querySelector('.fill').style.width = clamp(val / max * 100, 0, 100) + '%';
    animateNumber(el.querySelector('.v'), val, dec);
  }
  function routeDistanceTo(i) {
    let d = 0;
    for (let k = 1; k <= i; k++) d += distance(S.P[k - 1], S.P[k]);
    return d;
  }
  const setTxt = (sel, txt, title) => { const el = $(sel); if (!el) return; el.textContent = txt; if (title != null) el.title = title; };
  const fmtNum = (v, dec = 0, u = '') => Number.isFinite(v) ? `${v.toFixed(dec)}${u}` : '—';

  function updateTelemetry(p) {
    const U = S.U, SLOPE_MAX = 35;
    const nav = p.navigation || {}, env = p.environment || {};
    const ta = env.airTemperatureC || {}, rh = env.relativeHumidityPercent || {};
    const wi = env.wind || {}, rad = env.radiation || {};
    $('#t-point').textContent = `${p.id.toUpperCase()} / ${S.P.length}`;
    $('#t-name').textContent = p.name;
    $('#t-sub').textContent = p.subtitle || '';
    $('#t-coords').textContent = `GPS ${fmtLat(p.lat)} · ${fmtLon(p.lon)}`;
    const ter = $('#t-terrain');
    if (ter) {
      ter.className = 'terrain ' + terrainLevel(nav.terrainStatus);
      ter.textContent = nav.terrainStatus || '—';
      ter.hidden = !nav.terrainStatus;
    }

    setMetric('m-o2', p.oxygen_pct, 100,
      p.oxygen_pct < U.oxygen_critical_pct ? 'crit' : p.oxygen_pct < U.oxygen_low_pct ? 'warn' : 'ok', 0);
    const min = Math.round(p.oxygen_pct / 100 * (U.total_autonomy_min || 480));
    $('#t-auto').textContent = `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;

    const lim = U.eva_radiation_limit_msv, fr = p.accumulated_radiation_msv / lim;
    setMetric('m-rad', p.accumulated_radiation_msv, lim, fr > 0.8 ? 'crit' : fr > 0.5 ? 'warn' : 'ok', 2);
    const dosePerDay = rad.doseRADmSvDay;
    $('#t-dose').textContent = Number.isFinite(dosePerDay)
      ? `${dosePerDay.toFixed(2)} mSv/day (${p.dose_rate_usv_h.toFixed(1)} µSv/h)`
      : `${p.dose_rate_usv_h.toFixed(1)} µSv/h`;
    $('#t-lim').textContent = lim.toFixed(1);
    setTxt('#t-uv', [rad.uvIndex && `UV ${rad.uvIndex}`, rad.solarAlert].filter(Boolean).join(' · ') || '—');

    setMetric('m-slope', p.slope_degrees, SLOPE_MAX,
      p.slope_degrees > U.slope_danger_degrees ? 'crit' : p.slope_degrees > U.slope_caution_degrees ? 'warn' : 'ok', 1);
    $('#tick-caution').style.left = (U.slope_caution_degrees / SLOPE_MAX * 100) + '%';
    $('#tick-danger').style.left = (U.slope_danger_degrees / SLOPE_MAX * 100) + '%';
    $('#t-threshold').textContent = U.slope_danger_degrees;
    const pmax = $('#t-pmax');
    if (pmax) {
      pmax.textContent = fmtNum(p.slope_max_degrees, 1, '°');
      pmax.className = p.slope_max_degrees > U.slope_danger_degrees ? 'crit' : '';
    }
    setTxt('#t-tilt', fmtNum(nav.lateralTiltDegrees, 1, '°'));

    // Mineral hydration (bound water, % by weight) → extractable liters per m³ of regolith
    const hydr = clamp(hydrOf(p), 0, 100), water = waterOf(p), R = RAMPS.hydration;
    const vh = $('#val-hydr'), bh = $('#bar-hydr');
    if (vh) vh.textContent = `${hydr.toFixed(1)}% · ${Math.round(water)} L/m³`;
    if (bh) bh.style.width = clamp((hydr - R.min) / (R.max - R.min) * 100, 0, 100) + '%';

    setTxt('#t-elev', fmtNum(p.elevation_m, 0, ' m'));
    setTxt('#t-pres', fmtNum(env.pressurePa, 0, ' Pa'));
    setTxt('#t-air', fmtNum(ta.current, 0, ' °C'), `MIN ${fmtNum(ta.min, 0, ' °C')} · MAX ${fmtNum(ta.max, 0, ' °C')}`);
    setTxt('#t-ground', fmtNum(env.groundTemperatureC, 0, ' °C'));
    setTxt('#t-wind', `${fmtNum(wi.speedMs, 1, ' m/s')} ${wi.direction || ''}`.trim(), wi.type || '');
    setTxt('#t-gust', fmtNum(wi.gustsMs, 1, ' m/s'), wi.type || '');
    setTxt('#t-rh', `${fmtNum(rh.day)}–${fmtNum(rh.predawn, 0, ' %')}`, 'Relative humidity: day – predawn');
    // Mission odometer (real data) or, if missing, geodesic distance traveled along the route
    const odo = Number.isFinite(nav.cumulativeDistanceMeters) ? nav.cumulativeDistanceMeters : routeDistanceTo(S.idx);
    setTxt('#t-dist', odo >= 1000 ? `${(odo / 1000).toFixed(1)} km` : `${Math.round(odo)} m`,
      Number.isFinite(nav.segmentDistanceMeters) ? `Segment: ${nav.segmentDistanceMeters} m` : '');
    $('#t-minerals').innerHTML = (p.minerals || []).map(m =>
      `<span class="min-chip" title="${esc(m.source)}"><b>${esc(m.name)}</b> ${Math.round(m.confidence * 100)}%</span>`).join('');
  }

  function updateAlerts(p) {
    const U = S.U, al = [], nav = p.navigation || {}, env = p.environment || {};
    if (p.slope_degrees > U.slope_danger_degrees)
      al.push(['crit', `⚠ CRITICAL SLOPE ${p.slope_degrees.toFixed(1)}° > ${U.slope_danger_degrees}° · SLIDE RISK`]);
    if (terrainLevel(nav.terrainStatus) === 'crit') al.push(['crit', `⚠ TERRAIN ${nav.terrainStatus.replace(/^DANGER\s*-\s*/i, '').toUpperCase()}`]);
    if (p.oxygen_pct < U.oxygen_critical_pct) al.push(['crit', `⚠ CRITICAL O₂ ${p.oxygen_pct}% · RETURN IMMEDIATELY`]);
    else if (p.oxygen_pct < U.oxygen_low_pct) al.push(['warn', `LOW O₂ ${p.oxygen_pct}% · PLAN RETURN`]);
    const fr = p.accumulated_radiation_msv / U.eva_radiation_limit_msv;
    if (fr > 0.8) al.push(['crit', `⚠ ACCUMULATED DOSE ${Math.round(fr * 100)}% OF EVA LIMIT`]);
    else if (fr > 0.5) al.push(['warn', `ACCUMULATED DOSE ${Math.round(fr * 100)}% OF EVA LIMIT`]);
    if (p.slope_max_degrees > U.slope_danger_degrees)
      al.push(['warn', `MAX SURROUNDING SLOPE ${p.slope_max_degrees.toFixed(1)}° > ${U.slope_danger_degrees}°`]);
    const gust = env.wind?.gustsMs;
    if (Number.isFinite(gust) && gust >= (U.gust_caution_ms ?? Infinity))
      al.push(['warn', `GUSTS ${gust.toFixed(1)} m/s · ${(env.wind.type || 'WIND').toUpperCase()}`]);
    const sol = env.radiation?.solarAlert;
    if (sol && !/^nominal/i.test(sol)) al.push(['warn', `☀ ${sol.toUpperCase()}`]);
    const zones = (p.hotspots || []).filter(isDanger).length;
    if (zones && !al.length) al.push(['warn', `${zones} ZONE(S) WITH SLOPE > ${U.slope_danger_degrees}° AT THIS POINT`]);
    al.sort((a, b) => (a[0] === 'crit' ? 0 : 1) - (b[0] === 'crit' ? 0 : 1));

    $('#alerts').innerHTML = al.slice(0, 2).map(([n, t]) => `<div class="alert ${n === 'warn' ? 'warn' : ''}">${esc(t)}</div>`).join('');
    $('#vignette').classList.toggle('crit', al.some(a => a[0] === 'crit'));
  }

  // ---------- Hotspot detail ----------
  function showDetail(h, danger) {
    const d = $('#detail'), U = S.U;
    let html = '<button class="close" type="button" title="Close (Esc)">✕</button>';
    // Text: finding (what is seen) + impact_on_humanity (why it matters); description as fallback
    const finding = h.finding || h.description;
    const texts = (finding ? `<div class="d-sec">FINDING</div><p>${esc(finding)}</p>` : '')
      + (h.impact_on_humanity ? `<div class="d-sec">IMPACT ON HUMANITY</div><p class="impact">${esc(h.impact_on_humanity)}</p>` : '');
    if (h.type === 'science') {
      d.className = 'panel brackets sci';
      const conf = numOr(h.confidence, 0);
      html += `<div class="tag">◆ DETECTION · ${esc(h.instrument || 'CRISM')}</div><h3>${esc(h.title)}</h3>
        <div class="kv"><span class="dim">MINERAL</span><b>${esc(h.mineral)}</b></div>
        <div class="kv"><span class="dim">FORMULA</span><b>${esc(h.formula)}</b></div>
        ${h.band_um ? `<div class="kv"><span class="dim">BAND</span><b>${esc(h.band_um)}${/^[\d.\s/]+$/.test(h.band_um) ? ' µm' : ''}</b></div>` : ''}
        <div class="kv"><span class="dim">SOURCE</span><b>${esc(h.source)}</b></div>
        <div class="metric ${conf > 0.7 ? 'ok' : conf > 0.5 ? 'warn' : 'crit'}" style="margin-top:10px">
          <div class="m-row"><span class="m-lbl">CONFIDENCE</span><b class="m-val">${Math.round(conf * 100)}<small>%</small></b></div>
          <div class="bar"><div class="fill" style="width:${conf * 100}%"></div></div></div>
        ${texts}`;
    } else {
      d.className = 'panel brackets ' + (danger ? 'danger' : 'caution');
      html += `<div class="tag">${danger ? '⚠ DANGER ALERT · TERRAIN' : '▲ TERRAIN ASSESSMENT'}</div><h3>${esc(h.title)}</h3>
        <div class="kv"><span class="dim">SLOPE</span><b>${fmtSlope(h)}</b></div>
        <div class="kv"><span class="dim">THRESHOLD</span><b>${U.slope_danger_degrees}°</b></div>
        <div class="kv"><span class="dim">STATUS</span><b style="color:${danger ? 'var(--alert)' : 'var(--caution)'}">${danger ? 'NOT TRAVERSABLE' : 'TRAVERSABLE WITH CAUTION'}</b></div>
        ${texts}`;
    }
    d.innerHTML = html;
    d.hidden = false;
    d.querySelector('.close').addEventListener('click', closeDetail);
  }
  function closeDetail() { $('#detail').hidden = true; }

  // =========================================================
  //  MINIMAP (Leaflet)
  // =========================================================
  function initMap() {
    const A = S.data.mission.assets, lim = A.map_bounds;
    S.bounds = lim; S.geo = geoRef(lim); S.boundsLL = L.latLngBounds(lim);
    const map = S.map = L.map('minimap', {
      zoomControl: false, attributionControl: false, zoomSnap: 0.25,
      minZoom: 0, maxZoom: 22, keyboard: false, maxBoundsViscosity: 1,
    });
    fitMap();

    // The overlay uses EXACTLY the data bounds: no padding or margins.
    // The real images are square (1:1) and map_bounds is a square box on the ground.
    const real = A.use_real_map && A.map;
    const baseUrl = real ? A.map : generateMap(lim);
    const ov = (url, o) => L.imageOverlay(url, S.boundsLL, Object.assign({ interactive: false }, o));
    S.layers.base = ov(baseUrl).addTo(map);
    MODES = ALL_MODES.filter(m => m.id !== 'hypso' || (real && A.map_hypso));
    if (real && A.map_hypso) S.layers.hypso = ov(A.map_hypso);
    S.layers.slope = ov(generateField('slope', lim), { opacity: 0.85, className: 'ov-field' });
    S.layers.hydration = ov(generateField('hydration', lim), { opacity: 0.9, className: 'ov-field' });

    // Unique route edges
    S.edges = []; const seen = new Set();
    S.P.forEach(p => (p.connections || []).forEach(id => {
      const k = [p.id, id].sort().join('|');
      if (seen.has(k) || !byId(id)) return;
      seen.add(k); S.edges.push([p, byId(id)]);
    }));
    S.route = L.layerGroup().addTo(map);

    // Vision cone
    S.cone = L.marker([S.P[0].lat, S.P[0].lon], {
      icon: L.divIcon({
        className: 'map-cone', iconSize: [120, 120], iconAnchor: [60, 60],
        html: `<div class="cone-rot"><svg viewBox="-60 -60 120 120" width="120" height="120">
          <defs><radialGradient id="cg" cx="0" cy="0" r="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#00F0FF" stop-opacity=".7"/><stop offset="1" stop-color="#00F0FF" stop-opacity="0"/></radialGradient></defs>
          <path class="cone-path" fill="url(#cg)" stroke="#00F0FF" stroke-opacity=".6" stroke-width="1"/></svg></div><div class="cone-dot"></div>`,
      }),
      interactive: false, keyboard: false, zIndexOffset: 1000,
    }).addTo(map);
    S.coneRot = S.cone.getElement().querySelector('.cone-rot');
    S.conePath = S.cone.getElement().querySelector('.cone-path');

    // Point markers
    S.markers = S.P.map((p, i) => {
      const danger = isDangerPoint(p);
      const m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: 'map-pt' + (danger ? ' danger' : ''), html: `${i + 1}`, iconSize: [20, 20], iconAnchor: [10, 10] }),
        keyboard: false, zIndexOffset: 2000,
      }).addTo(map);
      m.bindTooltip(`${p.id.toUpperCase()} · ${p.name}`, { direction: 'top', offset: [0, -10], className: 'map-tip' });
      m.on('click', () => goTo(i));
      return m;
    });

    // "Layer mode" control
    const Layers = L.Control.extend({
      options: { position: 'bottomleft' },   // bottom, next to the legend: the Gale points cluster in the northern half
      onAdd() {
        const b = L.DomUtil.create('button', 'layer-btn');
        b.type = 'button'; b.title = 'Layer mode (L): ' + MODES.map(m => m.label.toLowerCase()).join(' / ');
        L.DomEvent.disableClickPropagation(b);
        b.addEventListener('click', cycleLayer);
        S.layerBtn = b; return b;
      },
    });
    map.addControl(new Layers());
    const Legend = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd() { const d = L.DomUtil.create('div', 'legend'); S.legend = d; return d; },
    });
    map.addControl(new Legend());
    applyLayer();
    window.addEventListener('resize', () => { fitMap(); updateMapPoint(S.P[S.idx]); });
  }

  // Minimum zoom = the one that COVERS the whole container with the map bounds (inside=true),
  // and the max pan bounds = the overlay's → empty strips are never visible.
  function fitMap() {
    const { map, boundsLL } = S;
    map.invalidateSize(false);
    const sz = map.getSize();
    if (!sz.x || !sz.y) return;
    const z = map.getBoundsZoom(boundsLL, true);
    map.setMinZoom(z); map.setMaxZoom(z + 4);
    map.setView(boundsLL.getCenter(), z, { animate: false });
    map.setMaxBounds(boundsLL);
  }

  function cycleLayer() { S.mode = (S.mode + 1) % MODES.length; applyLayer(); }

  function applyLayer() {
    const m = MODES[S.mode].id, { map, layers } = S;
    ['hypso', 'slope', 'hydration'].forEach(k => { if (layers[k] && map.hasLayer(layers[k])) map.removeLayer(layers[k]); });
    if (m !== 'satellite' && layers[m]) layers[m].addTo(map);
    layers.base.setOpacity(m === 'satellite' || m === 'hypso' ? 1 : 0.55);
    drawRoute();
    S.layerBtn.innerHTML = `<span>MODE ${S.mode + 1}/${MODES.length} · LAYERS ⟳</span>${MODES[S.mode].label}`;
    S.legend.innerHTML = legendHTML(m);
  }

  // Optional safe route: mission.safe_route = list of point ids, [lat,lon] or {lat,lon}
  function safeRoute() {
    const rs = S.data.mission.safe_route;
    if (!Array.isArray(rs) || rs.length < 2) return null;
    const pts = rs.map(q => {
      if (typeof q === 'string') { const p = byId(q); return p && [p.lat, p.lon]; }
      if (Array.isArray(q)) return q;
      return q && Number.isFinite(q.lat) ? [q.lat, q.lon] : null;
    }).filter(Boolean);
    return pts.length > 1 ? pts : null;
  }

  function drawRoute() {
    const m = MODES[S.mode].id, U = S.U.slope_danger_degrees;
    S.route.clearLayers();
    const line = (ll, col, o = {}) => {
      L.polyline(ll, { color: '#0B0F19', weight: 6, opacity: 0.7, interactive: false }).addTo(S.route);
      L.polyline(ll, Object.assign({ color: col, weight: 2.5, interactive: false }, o)).addTo(S.route);
    };
    if (m === 'slope') {
      // Optional obstacles: mission.obstacles = [{ lat, lon, radius_m, name }]
      (S.data.mission.obstacles || []).forEach(o => {
        if (!Number.isFinite(o.lat) || !Number.isFinite(o.lon)) return;
        // Leaflet converts meters using Earth's radius; corrected to Mars' radius
        const r = (o.radius_m || 30) * 6378137 / S.R;
        const c = L.circle([o.lat, o.lon], { radius: r, color: '#FF3B30', weight: 1.5, fillColor: '#FF3B30', fillOpacity: 0.35, interactive: false }).addTo(S.route);
        if (o.name) c.bindTooltip(esc(o.name), { className: 'map-tip' });
      });
      const seg = safeRoute();
      if (seg) {
        S.edges.forEach(([a, b]) => L.polyline([[a.lat, a.lon], [b.lat, b.lon]],
          { color: '#8E8E93', weight: 1.5, dashArray: '2 6', opacity: 0.8, interactive: false }).addTo(S.route));
        line(seg, '#30D158', { weight: 3.5 });
      } else {
        S.edges.forEach(([a, b]) => {
          const bad = Math.max(a.slope_max_degrees, b.slope_max_degrees) > U;
          line([[a.lat, a.lon], [b.lat, b.lon]], bad ? '#FF3B30' : '#30D158', { dashArray: bad ? '3 5' : null, weight: 3 });
        });
      }
      return;
    }
    S.edges.forEach(([a, b]) => line([[a.lat, a.lon], [b.lat, b.lon]], m === 'hydration' ? '#E6FFFF' : '#00F0FF', { dashArray: '6 5' }));
  }

  function legendHTML(m) {
    const U = S.U.slope_danger_degrees, A = S.data.mission.assets;
    if (m === 'satellite') {
      const src = A.use_real_map ? `HiRISE ${esc(A.hirise?.product || '')}`.trim() : 'PLACEHOLDER';
      return `<div>REAL SATELLITE · ${src}</div><div class="lg-lbl"><span style="color:var(--cyan)">— EVA ROUTE</span><span style="color:var(--alert)">● DANGER</span></div>`;
    }
    if (m === 'hypso') {
      return `<div>HYPSOMETRIC MAP · MOLA</div><div class="lg-bar" style="background:linear-gradient(90deg,#4b2d8f,#3b5bd6,#3fb8c8,#d9c97a,#a0522d)"></div>
        <div class="lg-lbl"><span>LOW</span><span>ELEVATION</span><span>HIGH</span></div>`;
    }
    if (m === 'slope') {
      return `<div>SLOPES & OBSTACLES</div>
        <div class="lg-lbl"><span style="color:var(--alert)">■ &gt;${U}° (NOT TRAVERSABLE)</span></div>
        <div class="lg-lbl"><span style="color:#30D158">— SAFE ROUTE</span></div>`;
    }
    const R = RAMPS.hydration;
    const grad = R.stops.map(([t, c]) => `rgb(${c.join(',')}) ${t * 100}%`).join(',');
    return `<div>MINERAL HYDRATION / ISRU · % H₂O</div><div class="lg-bar" style="background:linear-gradient(90deg,rgba(0,0,0,0),${grad})"></div>
      <div class="lg-lbl"><span>${R.min}%</span><span>${Math.round((R.min + R.max) / 2)}%</span><span>${R.max}%</span></div>`;
  }

  function updateMapPoint(p) {
    if (!S.map || !p) return;
    S.cone.setLatLng([p.lat, p.lon]);
    S.markers.forEach((m, i) => {
      const el = m.getElement(); if (!el) return;
      el.classList.toggle('active', i === S.idx);
      el.classList.toggle('visited', i < S.idx);
    });
    S.map.panTo([p.lat, p.lon], { animate: true, duration: 0.8 });
  }

  function updateCone(heading, hfov) {
    if (!S.coneRot) return;
    S.coneRot.style.transform = `rotate(${heading}deg)`;
    const a = clamp(hfov, 20, 140) / 2 * RAD, r = 56;
    const sx = (r * Math.sin(a)).toFixed(2), sy = (-r * Math.cos(a)).toFixed(2);
    S.conePath.setAttribute('d', `M0 0 L${-sx} ${sy} A${r} ${r} 0 0 1 ${sx} ${sy} Z`);
  }

  // =========================================================
  //  COMPASS + RENDER LOOP
  // =========================================================
  function initCompass() {
    const c = $('#compass');
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, r.width * S.dpr); c.height = Math.max(1, r.height * S.dpr);
      S.heading = -1;
    };
    S.cmp = c; S.cmpCtx = c.getContext('2d');
    resize(); window.addEventListener('resize', resize);
  }

  function drawCompass(h) {
    const c = S.cmp, g = S.cmpCtx, W = c.width, H = c.height, d = S.dpr;
    g.clearRect(0, 0, W, H);
    const ppd = 3.2 * d, span = W / 2 / ppd;
    g.lineWidth = 1 * d; g.textAlign = 'center'; g.font = `600 ${11 * d}px ${FONT}`;
    for (let k = Math.ceil(h - span); k <= h + span; k++) {
      const dn = norm360(k);
      if (dn % 5) continue;
      const x = W / 2 + (k - h) * ppd, big = dn % 45 === 0, mid = dn % 15 === 0;
      g.strokeStyle = g.fillStyle = big ? '#00F0FF' : 'rgba(0,240,255,.6)';
      g.beginPath(); g.moveTo(x, H); g.lineTo(x, H - (big ? 14 : mid ? 9 : 5) * d); g.stroke();
      if (mid) g.fillText(big ? CARD[dn / 45] : String(dn).padStart(3, '0'), x, H - 18 * d);
    }
    // Heading to the connected points
    const p = S.P[S.idx];
    (p.connections || []).forEach(id => {
      const n = byId(id); if (!n) return;
      const dd = norm180(bearing(p, n) - h);
      if (Math.abs(dd) > span) return;
      const x = W / 2 + dd * ppd;
      g.fillStyle = '#FF9F0A';
      g.beginPath(); g.moveTo(x - 5 * d, 2 * d); g.lineTo(x + 5 * d, 2 * d); g.lineTo(x, 9 * d); g.fill();
      g.font = `700 ${9 * d}px ${FONT}`; g.fillText(id.toUpperCase(), x + 14 * d, 9 * d);
      g.font = `600 ${11 * d}px ${FONT}`;
    });
  }

  function loop() {
    // While a scene is loading, getYaw() still belongs to the previous one: don't sync
    if (S.viewer && S.viewer.isLoaded()) {
      try {
        const p = S.P[S.idx];
        const heading = norm360(p.center_heading + S.viewer.getYaw());
        const hfov = S.viewer.getHfov();
        if (Math.abs(heading - S.heading) > 0.1 || Math.abs(hfov - S.hfov) > 0.1) {
          S.heading = heading; S.hfov = hfov;
          updateCone(heading, hfov);
          drawCompass(heading);
          $('#heading-readout').textContent = `${pad3(heading)}° ${CARD[Math.round(heading / 45) % 8]}`;
        }
      } catch (e) { /* the viewer is still loading */ }
    }
    requestAnimationFrame(loop);
  }

  // =========================================================
  //  UI: navigation, keyboard, status
  // =========================================================
  function updateNav() {
    const p = S.P[S.idx];
    $('#nav-label').textContent = `${p.id.toUpperCase()} · ${p.name}`;
    $('#btn-prev').disabled = S.idx === 0;
    $('#btn-next').disabled = S.idx === S.P.length - 1;
    $('#nav-dots').innerHTML = S.P.map((q, i) =>
      `<i class="${i === S.idx ? 'on' : i < S.idx ? 'done' : ''}" data-i="${i}" title="${esc(q.name)}"></i>`).join('');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => { });
    else document.exitFullscreen?.();
  }

  function initUI() {
    initCompass();
    $('#btn-prev').addEventListener('click', () => goTo(S.idx - 1));
    $('#btn-next').addEventListener('click', () => goTo(S.idx + 1));
    $('#btn-fs').addEventListener('click', toggleFullscreen);
    $('#nav-dots').addEventListener('click', e => { const i = e.target.dataset.i; if (i != null) goTo(+i); });
    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === 'q' || k === 'pageup') goTo(S.idx - 1);
      else if (k === 'e' || k === 'pagedown') goTo(S.idx + 1);
      else if (k === 'l') cycleLayer();
      else if (k === 'f') toggleFullscreen();
      else if (k === 'escape') closeDetail();
      else if (/^[1-9]$/.test(k)) goTo(+k - 1);
    });
  }

  function registerSW() {
    const el = $('#s-cache');
    if (!('serviceWorker' in navigator)) { el.textContent = 'SW N/A'; el.classList.add('warn'); return; }
    navigator.serviceWorker.register('service-worker.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => { el.textContent = 'OFFLINE ✓'; el.classList.add('ok'); })
      .catch(err => { el.textContent = 'SW ERROR'; el.classList.add('crit'); console.warn('[Ares-360] SW:', err); });
  }

  function connectivity() {
    const el = $('#s-net');
    const f = () => {
      const on = navigator.onLine;
      el.textContent = on ? 'ORBITAL LINK' : 'AUTONOMOUS MODE';
      el.className = 'chip ' + (on ? 'ok' : 'warn');
    };
    f(); window.addEventListener('online', f); window.addEventListener('offline', f);
  }

  // Mars local mean solar time (Mars24 algorithm / Allison & McEwen)
  function marsClock() {
    const LON_E = 137.44, SOL0_CURIOSITY = 49269;   // Gale Crater · sol 0 = MSL landing (Aug 6, 2012)
    const f = () => {
      const jdTT = Date.now() / 86400000 + 2440587.5 + 69.184 / 86400;
      const msd = (jdTT - 2405522.0028779) / 1.0274912517;
      const lmst = ((msd % 1) * 24 + LON_E / 15) % 24;
      const sol = Math.floor(msd + LON_E / 360) - SOL0_CURIOSITY;
      const hh = Math.floor(lmst), mm = Math.floor((lmst - hh) * 60), ss = Math.floor(((lmst - hh) * 60 - mm) * 60);
      $('#s-sol').textContent = `SOL ${sol}`;
      $('#s-lmst').textContent = `LMST ${[hh, mm, ss].map(v => String(v).padStart(2, '0')).join(':')}`;
    };
    f(); setInterval(f, 1000);
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
