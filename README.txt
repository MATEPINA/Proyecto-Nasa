=====================================================================
 ARES-360 · ASSETS FOLDER · Gale Crater · Mount Sharp (Curiosity)
=====================================================================

Real images ACTIVE (route_data.json -> use_real_images /
use_real_map = true). If set to false, the app goes back to
generating PLACEHOLDER panoramas and map in the browser (Canvas).

---------------------------------------------------------------------
1) 360° PANORAMAS (one per point)
---------------------------------------------------------------------
     point1.jpg -> P1 · Vera Rubin Ridge
     point2.jpg -> P2 · Rocknest
     point3.jpg -> P3 · Naukluft Plateau
     point4.jpg -> P4 · Gator-back Terrain

  - They cover 360° horizontally but are NOT 2:1: the vertical field
    is declared per point in route_data.json -> points[i].vaov,
    computed as vaov = 360 * height / width.
  - Max. 4096 px wide (WebGL texture limit on mobile), JPG 85.
  - points[i].center_heading = heading (0=N, 90=E…) of the image center.
  - Hotspots: yaw/pitch relative to the center; |pitch| < vaov/2.

---------------------------------------------------------------------
2) MINIMAP (square 1:1, north up)
---------------------------------------------------------------------
     gale_map.jpg        -> REAL SATELLITE layer (HiRISE PSP_009149_1750)
     gale_map_hypso.jpg  -> HYPSOMETRIC MAP layer (elevation)

  - Both cover mission.assets.map_bounds (square box on the ground):
         SW: -4.8357, 137.2600    NE: -4.5528, 137.5438
    APPROXIMATE georeferencing. If you get the exact crop,
    update those bounds.

---------------------------------------------------------------------
3) WHEN CHANGING ANY IMAGE
---------------------------------------------------------------------
  Bump VERSION in service-worker.js (e.g. 'ares360-v5') and reload
  once while online to re-cache them for offline use.
  The unoptimized originals are in ../_originals/ (outside the app).
=====================================================================
