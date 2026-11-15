import json
import math

# ==============================================================================
# 1. CONSTANTES FÍSICAS Y PARÁMETROS DE MISIÓN
# ==============================================================================
RADIO_MARTE_M = 3_389_500.0
GRAVEDAD_MARTE = 3.721
GRAVEDAD_TIERRA = 9.807

MASA_ASTRONAUTA_KG = 80.0
MASA_TRAJE_KG = 130.0
MASA_TOTAL_KG = MASA_ASTRONAUTA_KG + MASA_TRAJE_KG          # 210 kg

VELOCIDAD_BASE_KMH = 2.0
VELOCIDAD_BASE_MS = VELOCIDAD_BASE_KMH / 3.6                # 0.556 m/s

AUTONOMIA_NOMINAL_H = 8.0
CONSUMO_O2_REF_G_MIN = 1.25
FACTOR_CARGA = (MASA_TOTAL_KG * GRAVEDAD_MARTE) / (MASA_ASTRONAUTA_KG * GRAVEDAD_TIERRA)
CONSUMO_NOMINAL_G_MIN = CONSUMO_O2_REF_G_MIN * FACTOR_CARGA
CAPACIDAD_TANQUE_O2_G = CONSUMO_NOMINAL_G_MIN * AUTONOMIA_NOMINAL_H * 60.0

RESERVA_MINIMA_PCT = 15.0

TASA_RADIACION_MSV_SOL = 0.64        # MSL/RAD en Gale
MINUTOS_POR_SOL = 24 * 60 + 39.58    # 1479.58 min
TASA_RADIACION_MSV_MIN = TASA_RADIACION_MSV_SOL / MINUTOS_POR_SOL
TASA_RADIACION_USV_H = (TASA_RADIACION_MSV_MIN * 60.0) * 1000.0
LIMITE_RADIACION_EVA_MSV = 1.0

UMBRAL_PRECAUCION_DEG = 12.0
UMBRAL_PENALIZACION_DEG = 15.0
UMBRAL_PELIGRO_DEG = 20.0

DENSIDAD_ROCA_KG_M3 = 2200.0
EFICIENCIA_EXTRACCION = 0.75
FRACCION_MASA_O2_EN_H2O = 15.999 / 18.015
DENSIDAD_AGUA_KG_L = 1.0

TIEMPO_PREPARACION_MIN = 15.0
ARCHIVO_SALIDA = "datos_ruta.json"

# ==============================================================================
# 2. DATOS DE TERRENO — CRÁTER GALE (tabla del Rol 1)
# ==============================================================================
DATOS_TERRENO = {
    "mision": "MarsWalk · Ares-360",
    "zona": "Cráter Gale · Monte Sharp",
    "sol": 4120,
    "mapa": {
        "imagen": "assets/mapa_gale.png",
        "ancho_px": 1000,
        "alto_px": 1000,
        "escala_m_por_px": 2.5
    },
    "puntos": [
        {
            "id": "punto1",
            "nombre": "Yellowknife Bay · Lutitas Lacustres",
            "descripcion": "Antiguo lecho de lago con lutitas que conservan carbono orgánico y evidencia de agua neutra. Terreno firme, inicio de la EVA.",
            "lat": -4.5895,
            "lng": 137.4417,
            "mapa_px": {"x": 280, "y": 720},
            "norte_offset_deg": 0,
            "vista_inicial_yaw": 20,
            "azimut_pendiente_deg": 90,
            "elevacion_m": -4520,
            "temperatura_c": -24,
            "presion_pa": 840,
            "profundidad_hielo_cm": 0,
            "concentracion_hielo_pct": 8,
            "unidad_geologica_usgs": "Nh · Unidad Sheepbed (Lutitas de Yellowknife Bay)",
            "imagen_360": "assets/punto1.jpg",
            "desvio_m": 0,
            "minerales": [
                {"nombre": "Esmectita (Arcilla)", "formula": "(Ca,Na)(Al,Mg,Fe)₂(Si,Al)₄O₁₀(OH)₂", "indice_crism": "D2300", "valor": 0.042, "confianza": 0.91},
                {"nombre": "Carbono orgánico", "formula": "Compuestos aromáticos", "indice_crism": "SAM", "valor": 0.015, "confianza": 0.85}
            ],
            "hotspots": [
                {
                    "yaw": 20,
                    "pitch": -15,
                    "tipo": "ciencia",
                    "etiqueta": "BIOFIRMAS · CARBONO ORGÁNICO",
                    "titulo": "Carbono orgánico y agua neutra",
                    "descripcion": "Lutitas con carbono orgánico y arcillas formadas en agua neutra. Impacto: comprender el origen químico de la vida y mejorar las técnicas de detección biológica.",
                    "datos": {"Dato clave": "Carbono orgánico + agua neutra", "Instrumento": "Curiosity SAM/CheMin"}
                },
                {
                    "yaw": 120,
                    "pitch": 5,
                    "tipo": "ciencia",
                    "etiqueta": "RADIACIÓN CÓSMICA · 0.64 mSv/sol",
                    "titulo": "Mediciones de radiación (RAD)",
                    "descripcion": "Exposición a radiación cósmica en superficie: ~0.64 mSv/sol. Impacto: diseño de escudos antirradiación y protocolos médicos para viajes espaciales.",
                    "datos": {"Tasa superficie": "0.64 mSv/sol", "Límite EVA": "1.0 mSv"}
                }
            ]
        },
        {
            "id": "punto2",
            "nombre": "Estratos del Monte Sharp · Escarpe de Transición",
            "descripcion": "Afloramiento estratificado donde las arcillas pasan a sulfatos. Pendiente directa > 20°: obligatorio rodear por el flanco este.",
            "lat": -4.5935,
            "lng": 137.4417,
            "mapa_px": {"x": 520, "y": 480},
            "norte_offset_deg": 25,
            "vista_inicial_yaw": -15,
            "azimut_pendiente_deg": 210,
            "elevacion_m": -4420,
            "temperatura_c": -29,
            "presion_pa": 825,
            "profundidad_hielo_cm": 0,
            "concentracion_hielo_pct": 12,
            "unidad_geologica_usgs": "HNs · Estratos inferiores de Aeolis Mons (Monte Sharp)",
            "imagen_360": "assets/punto2.jpg",
            "desvio_m": 200,
            "minerales": [
                {"nombre": "Sulfatos polihidratados", "formula": "MgSO₄·nH₂O", "indice_crism": "SINDEX2", "valor": 0.078, "confianza": 0.88},
                {"nombre": "Filosilicatos férricos", "formula": "(Fe,Mg)₃Si₄O₁₀(OH)₂", "indice_crism": "D2300", "valor": 0.036, "confianza": 0.82}
            ],
            "hotspots": [
                {
                    "yaw": -15,
                    "pitch": 10,
                    "tipo": "peligro",
                    "etiqueta": "PENDIENTE > 20° · RIESGO DESLIZAMIENTO",
                    "titulo": "Pendiente crítica",
                    "descripcion": "Ladera estratificada con inclinación superior a 20°: riesgo de deslizamiento con traje de 130 kg y consumo de O2 muy alto. Ejecutar rodeo por el flanco este.",
                    "datos": {"Pendiente directa": "22.9°", "Maniobra": "Rodeo +200 m (12.9°)"}
                },
                {
                    "yaw": 65,
                    "pitch": -5,
                    "tipo": "ciencia",
                    "etiqueta": "CLIMA · ARCILLAS A SULFATOS",
                    "titulo": "Transición de arcillas a sulfatos",
                    "descripcion": "Registro del paso de lagos húmedos a un ambiente ácido y seco. Impacto: mejores modelos de cambio climático global y de pérdida atmosférica.",
                    "datos": {"Transición": "Arcillas -> Sulfatos", "Índice": "CRISM SINDEX2"}
                }
            ]
        },
        {
            "id": "punto3",
            "nombre": "Minerales Hidratados y Percloratos · ISRU",
            "descripcion": "Vetas de sulfatos hidratados y yeso con agua en su estructura cristalina, junto a sales de perclorato en el polvo. Objetivo ISRU.",
            "lat": -4.596,
            "lng": 137.438,
            "mapa_px": {"x": 750, "y": 250},
            "norte_offset_deg": 330,
            "vista_inicial_yaw": 0,
            "azimut_pendiente_deg": 180,
            "elevacion_m": -4440,
            "temperatura_c": -33,
            "presion_pa": 828,
            "profundidad_hielo_cm": 0,
            "concentracion_hielo_pct": 18,
            "unidad_geologica_usgs": "As · Unidad sulfatada hidratada de Monte Sharp",
            "imagen_360": "assets/punto3.jpg",
            "desvio_m": 0,
            "minerales": [
                {"nombre": "Yeso (Sulfato hidratado)", "formula": "CaSO₄·2H₂O", "indice_crism": "BD1900_2", "valor": 0.142, "confianza": 0.93},
                {"nombre": "Perclorato de magnesio", "formula": "Mg(ClO₄)₂", "indice_crism": "SAM-EGA", "valor": 0.055, "confianza": 0.86}
            ],
            "hotspots": [
                {
                    "yaw": 0,
                    "pitch": -20,
                    "tipo": "ciencia",
                    "etiqueta": "ISRU · EXTRACCIÓN DE H₂O",
                    "titulo": "Agua atrapada en rocas",
                    "descripcion": "Sulfatos hidratados con hasta 18 % de agua en peso. Calentando la roca se libera agua y se obtiene oxígeno. Impacto: tecnologías de extracción de agua espacial.",
                    "datos": {"Agua estructural": "18 % peso", "Rendimiento": "297.0 L/m³ roca"}
                },
                {
                    "yaw": -85,
                    "pitch": -14,
                    "tipo": "peligro",
                    "etiqueta": "TOXICIDAD · PERCLORATOS",
                    "titulo": "Percloratos tóxicos en el polvo",
                    "descripcion": "Sales de perclorato con riesgo tiroideo. Sellar muestras y limpiar el traje antes de la esclusa. Impacto: biorremediación de suelos en la Tierra.",
                    "datos": {"Compuesto": "ClO₄⁻", "Protocolo": "Sellado + limpieza esclusa"}
                }
            ]
        }
    ]
}

# ==============================================================================
# 3. FUNCIONES DE CÁLCULO
# ==============================================================================
def distancia_haversine_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * RADIO_MARTE_M * math.asin(math.sqrt(a))

def calcular_pendiente_deg(delta_h_m, distancia_m):
    if distancia_m <= 0:
        return 0.0
    return math.degrees(math.atan(abs(delta_h_m) / distancia_m))

def clasificar_riesgo(pendiente_deg):
    if pendiente_deg > UMBRAL_PELIGRO_DEG:
        return "PELIGRO"
    if pendiente_deg > UMBRAL_PRECAUCION_DEG:
        return "PRECAUCION"
    return "SEGURO"

def factores_terreno(pendiente_deg, subiendo):
    if pendiente_deg <= UMBRAL_PENALIZACION_DEG:
        esfuerzo = 1.0 + (pendiente_deg / UMBRAL_PENALIZACION_DEG) * 0.6
        velocidad = max(0.6, 1.0 - pendiente_deg * 0.02)
    else:
        exceso = pendiente_deg - UMBRAL_PENALIZACION_DEG
        esfuerzo = 1.6 + 0.30 * exceso ** 1.5
        velocidad = max(0.25, 0.70 - exceso * 0.04)
    if not subiendo:
        esfuerzo = 1.0 + (esfuerzo - 1.0) * 0.5
    return esfuerzo, velocidad

def calcular_tramo(distancia_m, delta_h_m):
    pendiente = calcular_pendiente_deg(delta_h_m, distancia_m)
    esfuerzo, f_vel = factores_terreno(pendiente, subiendo=delta_h_m > 0)
    longitud_real_m = math.hypot(distancia_m, delta_h_m)
    tiempo_min = longitud_real_m / (VELOCIDAD_BASE_MS * f_vel) / 60.0
    o2_g = tiempo_min * CONSUMO_NOMINAL_G_MIN * esfuerzo
    return {
        "pendiente": pendiente,
        "tiempo_min": tiempo_min,
        "o2_g": o2_g,
        "radiacion_msv": tiempo_min * TASA_RADIACION_MSV_MIN,
    }

def calcular_isru(concentracion_agua_pct):
    agua_kg = DENSIDAD_ROCA_KG_M3 * (concentracion_agua_pct / 100.0) * EFICIENCIA_EXTRACCION
    return {
        "agua_l_m3": agua_kg / DENSIDAD_AGUA_KG_L,
        "o2_kg_m3": agua_kg * FRACCION_MASA_O2_EN_H2O
    }

# ==============================================================================
# 4. GENERADOR DEL JSON COMPATIBLE CON app.js
# ==============================================================================
def generar_json_mision(entrada=DATOS_TERRENO, ruta_salida=ARCHIVO_SALIDA):
    puntos = entrada["puntos"]
    o2_g = CAPACIDAD_TANQUE_O2_G
    rad_msv = TIEMPO_PREPARACION_MIN * TASA_RADIACION_MSV_MIN
    o2_g -= TIEMPO_PREPARACION_MIN * CONSUMO_NOMINAL_G_MIN
    tiempo_total_min = TIEMPO_PREPARACION_MIN
    o2_retorno_g = 0.0
    salida = []
    alertas = []

    # Precalcular distancias de cada tramo
    tramos_info = []
    for i, p in enumerate(puntos):
        if i == 0:
            tramos_info.append((0.0, 0.0, 0.0))
        else:
            prev = puntos[i - 1]
            dist = distancia_haversine_m(prev["lat"], prev["lng"], p["lat"], p["lng"])
            dh = p["elevacion_m"] - prev["elevacion_m"]
            pend = calcular_pendiente_deg(dh, dist)
            tramos_info.append((dist, dh, pend))

    for i, p in enumerate(puntos):
        dist, dh, pendiente_directa = tramos_info[i]
        if i == 0:
            tramo = {"tiempo_min": 0.0, "o2_g": 0.0, "radiacion_msv": 0.0}
            ruta = "inicio"
        else:
            if pendiente_directa > UMBRAL_PELIGRO_DEG and p["desvio_m"] > 0:
                tramo = calcular_tramo(dist + p["desvio_m"], dh)
                ruta = "rodeo"
                alertas.append(f"{p['id']}: pendiente directa {pendiente_directa:.1f}° > 20°, rodeo de +{p['desvio_m']} m ({tramo['pendiente']:.1f}°)")
            else:
                tramo = calcular_tramo(dist, dh)
                ruta = "directa"

            dist_caminada = dist + p["desvio_m"] if ruta == "rodeo" else dist
            vuelta = calcular_tramo(dist_caminada, -dh)
            o2_retorno_g += vuelta["o2_g"]

        o2_g -= tramo["o2_g"]
        rad_msv += tramo["radiacion_msv"]
        tiempo_total_min += tramo["tiempo_min"]

        o2_pct = max(0.0, o2_g / CAPACIDAD_TANQUE_O2_G * 100.0)
        retorno_pct = o2_retorno_g / CAPACIDAD_TANQUE_O2_G * 100.0
        margen_pct = o2_pct - retorno_pct
        retorno_viable = margen_pct >= RESERVA_MINIMA_PCT

        riesgo = clasificar_riesgo(pendiente_directa)
        isru = calcular_isru(p["concentracion_hielo_pct"])
        tasa_local_usv_h = round(TASA_RADIACION_USV_H * (1.0 + (pendiente_directa * 0.005)), 1)

        conexiones = []
        if i > 0:
            conexiones.append({"destino": puntos[i - 1]["id"], "distancia_m": round(dist)})
        if i < len(puntos) - 1:
            conexiones.append({"destino": puntos[i + 1]["id"], "distancia_m": round(tramos_info[i + 1][0])})

        salida.append({
            "id": p["id"],
            "nombre": p["nombre"],
            "descripcion": p["descripcion"],
            "imagen": p["imagen_360"],
            "coordenadas": {"lat": p["lat"], "lon": p["lng"]},
            "mapa": p["mapa_px"],
            "norte_offset_deg": p.get("norte_offset_deg", 0),
            "vista_inicial_yaw": p.get("vista_inicial_yaw", 0),
            "elevacion_m": p["elevacion_m"],
            "distancia_m": round(dist, 1),
            "pendiente_deg": round(pendiente_directa, 1),
            "azimut_pendiente_deg": p.get("azimut_pendiente_deg", 0),
            "radiacion": {
                "dosis_acumulada_msv": round(rad_msv, 4),
                "tasa_usv_h": tasa_local_usv_h
            },
            "oxigeno_restante_pct": round(o2_pct, 1),
            "temperatura_c": p["temperatura_c"],
            "presion_pa": p["presion_pa"],
            "nivel_riesgo": riesgo,
            "unidad_geologica_usgs": p["unidad_geologica_usgs"],
            "profundidad_hielo_cm": p["profundidad_hielo_cm"],
            "concentracion_hielo_pct": p["concentracion_hielo_pct"],
            "agua_isru_litros_m3": round(isru["agua_l_m3"], 1),
            "oxigeno_isru_kg_m3": round(isru["o2_kg_m3"], 1),
            "minerales": p["minerales"],
            "ruta": {
                "tipo": ruta,
                "desvio_m": p["desvio_m"] if ruta == "rodeo" else 0,
                "pendiente_efectiva_grados": round(tramo.get("pendiente", 0.0), 1),
                "tiempo_tramo_min": round(tramo["tiempo_min"], 1),
                "tiempo_acumulado_min": round(tiempo_total_min, 1),
            },
            "retorno": {
                "oxigeno_necesario_pct": round(retorno_pct, 1),
                "margen_pct": round(margen_pct, 1),
                "viable": retorno_viable,
            },
            "conexiones": conexiones,
            "hotspots": [
                {"id": f"{p['id']}-h{k + 1}", **h} for k, h in enumerate(p["hotspots"])
            ],
        })

    datos = {
        "mision": {
            "nombre": entrada.get("mision", "MarsWalk · Ares-360"),
            "sitio": entrada["zona"],
            "sol": entrada.get("sol", 4120),
            "astronauta": "EV-1",
            "masa_traje_kg": MASA_TRAJE_KG,
            "masa_total_kg": MASA_TOTAL_KG,
            "velocidad_base_kmh": VELOCIDAD_BASE_KMH,
            "o2_capacidad_horas": AUTONOMIA_NOMINAL_H,
            "reserva_minima_o2_pct": RESERVA_MINIMA_PCT,
            "tasa_radiacion_msv_sol": TASA_RADIACION_MSV_SOL,
            "limite_radiacion_eva_msv": LIMITE_RADIACION_EVA_MSV,
            "umbral_pendiente_peligro_deg": UMBRAL_PELIGRO_DEG,
            "tiempo_total_min": round(tiempo_total_min, 1),
            "fotos_360_reales": False,
            "mapa_satelital_real": False,
            "alertas": alertas,
        },
        "mapa": entrada["mapa"],
        "puntos": salida,
    }

    with open(ruta_salida, "w", encoding="utf-8") as f:
        json.dump(datos, f, indent=2, ensure_ascii=False)

    print(f"[OK] {ruta_salida} generado · {len(salida)} puntos · {tiempo_total_min:.0f} min de EVA")
    for p in salida:
        print(f"  {p['id']}: {p['distancia_m']:>6.0f} m | {p['pendiente_deg']:>4.1f}° {p['nivel_riesgo']:<10} "
              f"| O2 {p['oxigeno_restante_pct']:>5.1f} % (retorno {p['retorno']['oxigeno_necesario_pct']} %) "
              f"| {p['radiacion']['dosis_acumulada_msv']:.4f} mSv | ISRU {p['agua_isru_litros_m3']} L/m³")
    return datos

if __name__ == "__main__":
    generar_json_mision()