=====================================================================
 ARES-360 · CARPETA DE ASSETS · Cráter Gale · Monte Sharp (Curiosity)
=====================================================================

Imágenes reales ACTIVAS (datos_ruta.json -> usar_imagenes_reales /
usar_mapa_real = true). Si se ponen en false, la app vuelve a generar
panoramas y mapa PLACEHOLDER en el navegador (Canvas).

---------------------------------------------------------------------
1) PANORÁMICAS 360° (una por punto)
---------------------------------------------------------------------
     punto1.jpg -> P1 · Vera Rubin Ridge
     punto2.jpg -> P2 · Rocknest
     punto3.jpg -> P3 · Naukluft Plateau
     punto4.jpg -> P4 · Terreno Gator-back

  - Cubren 360° en horizontal pero NO son 2:1: el campo vertical se
    declara por punto en datos_ruta.json -> puntos[i].vaov, calculado
    como vaov = 360 * alto / ancho.
  - Máx. 4096 px de ancho (límite de textura WebGL en móviles), JPG 85.
  - puntos[i].rumbo_centro = rumbo (0=N, 90=E…) del centro de la imagen.
  - Hotspots: yaw/pitch relativos al centro; |pitch| < vaov/2.

---------------------------------------------------------------------
2) MINIMAPA (cuadrado 1:1, norte arriba)
---------------------------------------------------------------------
     mapa_gale.jpg        -> capa SATÉLITE REAL (HiRISE PSP_009149_1750)
     mapa_gale_hipso.jpg  -> capa MAPA HIPSOMÉTRICO (elevación)

  - Ambas cubren mision.assets.mapa_limites (caja cuadrada en el terreno):
         SO: -4.8357, 137.2600    NE: -4.5528, 137.5438
    Georreferenciación APROXIMADA. Si se obtiene el recorte exacto,
    actualizad esos límites.

---------------------------------------------------------------------
3) AL CAMBIAR CUALQUIER IMAGEN
---------------------------------------------------------------------
  Subid VERSION en service-worker.js (p. ej. 'ares360-v4') y recargad
  una vez con conexión para volver a cachearlas para uso offline.
  Los originales sin optimizar están en ../_originales/ (fuera de la app).
=====================================================================
