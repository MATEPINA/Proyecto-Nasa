# Ares-360 · MarsWalk HUD

Offline-first web app (PWA) that acts as an astronaut helmet HUD for an EVA in
Gale Crater / Mount Sharp, following the Curiosity route. Built for NASA Space
Apps ("MarsWalk").

**Live app:** https://astonishing-arithmetic-9398b6.netlify.app

## Free to use

Ares-360 is free and open source under the [MIT License](LICENSE). Anyone may
use, copy, modify and redistribute it, including commercially, as long as the
copyright notice and the license text are kept.

No account, payment or API key is needed, either to use the live app or to run
your own copy.

## Run it yourself

No build step and no dependencies to install. From the project folder:

```bash
python -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` by double-click does not
work: the app needs to be served over http.

To publish your own copy, upload the folder as-is to any static host (Netlify,
GitHub Pages, Vercel…).

## Third-party material

The MIT License above covers the code and data written by the Ares-360 team.
The following are used under their own terms:

| Material | Source | Terms |
| --- | --- | --- |
| Pannellum 2.5.6 (360° viewer) | https://pannellum.org | MIT |
| Leaflet 1.9.4 (minimap) | https://leafletjs.com | BSD 2-Clause |
| Mars panoramas (`point1-4.jpg`) | NASA/JPL-Caltech/MSSS, Curiosity rover | NASA media usage guidelines |
| Satellite map (HiRISE PSP_009149_1750) | NASA/JPL-Caltech/University of Arizona | NASA media usage guidelines |
| Elevation data (MOLA) | NASA/GSFC | NASA media usage guidelines |

NASA imagery is generally not copyrighted, but must be credited and must not
imply NASA endorsement. This project is not affiliated with or endorsed by NASA.
