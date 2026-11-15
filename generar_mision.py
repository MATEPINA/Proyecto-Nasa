import json
import math

# ==============================================================================
# 1. CONSTANTES FÍSICAS Y PARÁMETROS DE MISIÓN (CRÁTER GALE · CURIOSITY)
# ==============================================================================
RADIO_MARTE_M = 3_389_500.0          # radio medio volumétrico de Marte (m)
GRAVEDAD_MARTE = 3.721               # m/s²
GRAVEDAD_TIERRA = 9.807

MASA_ASTRONAUTA_KG = 80.0
MASA_TRAJE_KG = 130.0
MASA_TOTAL_KG = MASA_ASTRONAUTA_KG + MASA_TRAJE_KG          # 210 kg

VELOCIDAD_BASE_KMH = 2.0
VELOCIDAD_BASE_MS = VELOCIDAD_BASE_KMH / 3.6                # 0.556 m/s

AUTONOMIA_NOMINAL_H = 8.0                                   # 480 min
CONSUMO_O2_REF_G_MIN = 1.25
FACTOR_CARGA = (MASA_TOTAL_KG * GRAVEDAD_MARTE) / (MASA_ASTRONAUTA_KG * GRAVEDAD_TIERRA)
CONSUMO_NOMINAL_G_MIN = CONSUMO_O2_REF_G_MIN * FACTOR_CARGA
CAPACIDAD_TANQUE_O2_G = CONSUMO_NOMINAL_G_MIN * AUTONOMIA_NOMINAL_H * 60.0

UMBRAL_PRECAUCION_DEG = 12
UMBRAL_PENALIZACION_DEG = 15.0
UMBRAL_PELIGRO_DEG = 20
LIMITE_RADIACION_EVA_MSV = 1.0

MINUTOS_POR_SOL = 24 * 60 + 39.58    # 1479.58 min
TIEMPO_PREPARACION_MIN = 15.0        # chequeo inicial en esclusa
ARCHIVO_SALIDA = "datos_ruta.json"

# ==============================================================================
# 2. DATOS REALES DE TERRENO — 4 ESTACIONES EN CRÁTER GALE (ROL 1)
# ==============================================================================
DATOS_MISION = {
    "nombre": "Ares-360 · MarsWalk EVA-01",
    "sitio": "Cráter Gale · Monte Sharp (Misión Curiosity)",
    "nota": "Coordenadas, navegación y ambiente: datos de referencia de la misión MSL Curiosity (MOLA, REMS, RAD). O₂, dosis acumulada de EVA, hidratación mineral y hotspots son SIMULADOS con órdenes de magnitud realistas. No usar para navegación real.",
    "radio_marte_m": int(RADIO_MARTE_M),
    "umbrales": {
        "pendiente_precaucion_grados": UMBRAL_PRECAUCION_DEG,
        "pendiente_peligro_grados": UMBRAL_PELIGRO_DEG,
        "oxigeno_bajo_pct": 50,
        "oxigeno_critico_pct": 25,
        "radiacion_limite_eva_msv": LIMITE_RADIACION_EVA_MSV,
        "rafaga_precaucion_ms": 10,
        "autonomia_total_min": int(AUTONOMIA_NOMINAL_H * 60)
    },
    "monte_sharp": {"lat": -5.08, "lng": 137.85},
    "assets": {
        "usar_imagenes_reales": True,
        "usar_mapa_real": True,
        "mapa": "assets/mapa_gale.jpg",
        "mapa_hipso": "assets/mapa_gale_hipso.jpg",
        "hirise": {"producto": "PSP_009149_1750", "lat": -4.799, "lng": 137.412},
        "mapa_limites_nota": "Caja cuadrada (16.7 km de lado) centrada en los 4 puntos + centro HiRISE, con 35% de margen. Georreferenciación aproximada: las imágenes aún no tienen relación 1:1 verificada.",
        "mapa_limites": [[-4.8357, 137.2600], [-4.5528, 137.5438]]
    },
    "puntos": [
        {
            "id": "p1",
            "nombre": "Vera Rubin Ridge",
            "subtitulo": "Cresta de hematita · lecho rocoso duro",
            "imagen": "assets/punto1.jpg",
            "vaov": 83.85,
            "rumbo_centro": 131,
            "rumbo_nota": "Sin referencia visible (tormenta de polvo): centro orientado hacia Monte Sharp. Estimación de baja confianza.",
            "conexiones": ["p2"],
            "coordenadas": {"lat": -4.6795, "lng": 137.3882, "elevacionMOLA": -4175},
            "navegacion": {
                "pendienteLocalGrados": 6.5,
                "pendienteMaximaEntornoGrados": 18.5,
                "inclinacionLateralGrados": 2.1,
                "estadoTerreno": "PRECAUCIÓN - Lecho rocoso duro (Vera Rubin Ridge) y polvo fino"
            },
            "ambiente": {
                "temperaturaAireC": {"max": -15, "min": -65, "actual": -18},
                "temperaturaSueloC": -5,
                "presionPa": 865,
                "humedadRelativaPorcentaje": {"dia": 1, "madrugada": 25},
                "viento": {"velocidadMs": 5.5, "rafagasMs": 10.2, "direccion": "SE", "tipo": "Tormenta de polvo en decaimiento"},
                "radiacion": {"dosisRADmSvDia": 0.62, "indiceUV": "MODERATE", "alertaSolar": "Opacidad atmosférica (Tau) elevada"}
            },
            "hidratacion_pct": 3.0,
            "minerales": [
                {"nombre": "Hematita", "formula": "Fe₂O₃", "confianza": 0.88, "fuente": "CRISM + CheMin (XRD) · Vera Rubin Ridge"},
                {"nombre": "Sulfato de Ca", "formula": "CaSO₄·nH₂O", "confianza": 0.74, "fuente": "ChemCam · vetas blancas"}
            ],
            "hotspots": [
                {
                    "tipo": "ciencia", "yaw": 110, "pitch": -24,
                    "titulo": "Losas con hematita",
                    "mineral": "Hematita", "formula": "Fe₂O₃", "confianza": 0.88, "banda_um": "0.86",
                    "instrumento": "CRISM", "fuente": "CRISM / CheMin (MSL)",
                    "hallazgo": "Lecho rocoso fracturado con hematita cristalina: el agua subterránea endureció la cresta.",
                    "impacto_humanidad": "La hematita registra antiguas aguas oxidantes. Entender cuánto duraron indica dónde buscar ambientes habitables y materia orgánica preservada."
                },
                {
                    "tipo": "ciencia", "yaw": -160, "pitch": -8,
                    "titulo": "Vetas de sulfato de calcio",
                    "mineral": "Sulfato de Ca (yeso/basanita)", "formula": "CaSO₄·nH₂O", "confianza": 0.74, "banda_um": "1.9 / 2.2",
                    "instrumento": "ChemCam", "fuente": "ChemCam LIBS (MSL)",
                    "hallazgo": "Vetas blancas que rellenan fracturas: fluidos circularon después de formarse la roca.",
                    "impacto_humanidad": "El yeso contiene agua ligada extraíble por calentamiento: un recurso ISRU accesible para futuras bases humanas."
                },
                {
                    "tipo": "terreno", "yaw": -120, "pitch": 22,
                    "titulo": "Flanco de la cresta",
                    "pendiente_grados": 18.5,
                    "hallazgo": "Escalones de roca dura cubiertos de polvo fino que oculta bordes sueltos.",
                    "impacto_humanidad": "Probar rutas de ascenso sobre roca dura con polvo enseña cómo diseñar botas y protocolos de tracción para EVA reales."
                }
            ]
        },
        {
            "id": "p2",
            "nombre": "Rocknest",
            "subtitulo": "Sombra de arena basáltica · llanura Bradbury",
            "imagen": "assets/punto2.jpg",
            "vaov": 102.74,
            "rumbo_centro": 194,
            "rumbo_nota": "Monte Sharp visible en yaw ≈ -54° (rumbo real ≈ 140°).",
            "conexiones": ["p1", "p3"],
            "coordenadas": {"lat": -4.5895, "lng": 137.4417, "elevacionMOLA": -4521},
            "navegacion": {
                "pendienteLocalGrados": -1.5,
                "pendienteMaximaEntornoGrados": 2.5,
                "inclinacionLateralGrados": -3.5,
                "estadoTerreno": "ESTABLE - Montículo de arena basáltica (Rocknest)"
            },
            "ambiente": {
                "temperaturaAireC": {"max": -2, "min": -75, "actual": -10},
                "temperaturaSueloC": 3,
                "presionPa": 740,
                "humedadRelativaPorcentaje": {"dia": 2, "madrugada": 45},
                "viento": {"velocidadMs": 4.2, "rafagasMs": 9.1, "direccion": "E-SE", "tipo": "Vientos de llanura"},
                "radiacion": {"dosisRADmSvDia": 0.64, "indiceUV": "HIGH", "alertaSolar": "Nominal (Sin tormentas solares)"}
            },
            "hidratacion_pct": 2.0,
            "minerales": [
                {"nombre": "Plagioclasa", "formula": "(Na,Ca)Al₁₋₂Si₃₋₂O₈", "confianza": 0.9, "fuente": "CheMin (XRD) · primera difracción en Marte"},
                {"nombre": "Olivino", "formula": "(Mg,Fe)₂SiO₄", "confianza": 0.82, "fuente": "CheMin (XRD)"},
                {"nombre": "Fase amorfa", "formula": "—", "confianza": 0.6, "fuente": "CheMin + SAM · ~2% H₂O"}
            ],
            "hotspots": [
                {
                    "tipo": "ciencia", "yaw": 100, "pitch": -13,
                    "titulo": "Sombra de arena Rocknest",
                    "mineral": "Plagioclasa + olivino + augita", "formula": "(Na,Ca)(Al,Si)₄O₈ · (Mg,Fe)₂SiO₄", "confianza": 0.9, "banda_um": "XRD",
                    "instrumento": "CheMin", "fuente": "CheMin / SAM (MSL)",
                    "hallazgo": "Arena basáltica similar a la de Hawái, con una fase amorfa que libera agua al calentarse.",
                    "impacto_humanidad": "Demuestra que el polvo global de Marte contiene ~2% de agua: cualquier astronauta podría obtener agua del suelo en casi cualquier lugar."
                },
                {
                    "tipo": "ciencia", "yaw": -54, "pitch": 28,
                    "titulo": "Monte Sharp (Aeolis Mons)",
                    "mineral": "Arcillas y sulfatos estratificados", "formula": "—", "confianza": 0.85, "banda_um": "1.9 / 2.3",
                    "instrumento": "CRISM", "fuente": "CRISM / HiRISE (MRO)",
                    "hallazgo": "Montaña de 5 km formada por capas de sedimentos: un libro de historia climática.",
                    "impacto_humanidad": "Sus estratos registran la transición de un Marte húmedo a uno seco: clave para entender el futuro climático de planetas como la Tierra."
                },
                {
                    "tipo": "terreno", "yaw": -128, "pitch": 3,
                    "titulo": "Bloques de basalto vesicular",
                    "pendiente_grados": 2.5,
                    "hallazgo": "Rocas sueltas sobre arena compacta. Terreno llano y transitable.",
                    "impacto_humanidad": "Zona ideal para practicar la marcha y el muestreo antes de afrontar las laderas de Monte Sharp."
                }
            ]
        },
        {
            "id": "p3",
            "nombre": "Naukluft Plateau",
            "subtitulo": "Arenisca eólica Stimson · meseta fracturada",
            "imagen": "assets/punto3.jpg",
            "vaov": 82.71,
            "rumbo_centro": 25,
            "rumbo_nota": "Monte Sharp visible en yaw ≈ +110° (rumbo real ≈ 135°).",
            "conexiones": ["p2", "p4"],
            "coordenadas": {"lat": -4.6418, "lng": 137.4085, "elevacionMOLA": -4415},
            "navegacion": {
                "pendienteLocalGrados": 14.2,
                "pendienteMaximaEntornoGrados": 22.0,
                "inclinacionLateralGrados": 6.8,
                "estadoTerreno": "PELIGRO - Arenisca fracturada (Naukluft Plateau). Alto desgaste en ruedas."
            },
            "ambiente": {
                "temperaturaAireC": {"max": -4, "min": -74, "actual": -8},
                "temperaturaSueloC": 2,
                "presionPa": 825,
                "humedadRelativaPorcentaje": {"dia": 1, "madrugada": 30},
                "viento": {"velocidadMs": 4.8, "rafagasMs": 9.5, "direccion": "E", "tipo": "Constante por elevación"},
                "radiacion": {"dosisRADmSvDia": 0.64, "indiceUV": "HIGH", "alertaSolar": "Nominal"}
            },
            "hidratacion_pct": 3.5,
            "minerales": [
                {"nombre": "Sílice amorfa (ópalo-A)", "formula": "SiO₂·nH₂O", "confianza": 0.79, "fuente": "CheMin + APXS · halos de fractura"},
                {"nombre": "Magnetita", "formula": "Fe₃O₄", "confianza": 0.66, "fuente": "CheMin (XRD) · arenisca Stimson"}
            ],
            "hotspots": [
                {
                    "tipo": "ciencia", "yaw": -30, "pitch": -10,
                    "titulo": "Halos ricos en sílice",
                    "mineral": "Sílice amorfa (ópalo-A)", "formula": "SiO₂·nH₂O", "confianza": 0.79, "banda_um": "2.21",
                    "instrumento": "APXS", "fuente": "APXS / CheMin (MSL)",
                    "hallazgo": "Franjas claras junto a las fracturas: fluidos tardíos depositaron sílice en la arenisca.",
                    "impacto_humanidad": "En la Tierra los depósitos de sílice hidrotermal conservan microfósiles: son objetivos prioritarios para buscar vida pasada."
                },
                {
                    "tipo": "terreno", "yaw": -55, "pitch": -20,
                    "titulo": "Arenisca con aristas afiladas",
                    "pendiente_grados": 22.0,
                    "hallazgo": "Placas fracturadas y ventifactos que perforaron las ruedas de Curiosity.",
                    "impacto_humanidad": "Este terreno obligó a rediseñar las rutas del rover; para una EVA marca dónde una bota o un traje podrían rasgarse."
                },
                {
                    "tipo": "ciencia", "yaw": 110, "pitch": 34,
                    "titulo": "Estratos de Monte Sharp",
                    "mineral": "Sulfatos de Mg / arcillas", "formula": "MgSO₄·nH₂O", "confianza": 0.7, "banda_um": "1.9 / 2.4",
                    "instrumento": "CRISM", "fuente": "CRISM (MRO)",
                    "hallazgo": "Capas superiores de la montaña: transición de arcillas a sulfatos.",
                    "impacto_humanidad": "Marca el momento en que Marte perdió su agua superficial: ayuda a entender cómo un planeta habitable se vuelve inhóspito."
                }
            ]
        },
        {
            "id": "p4",
            "nombre": "Terreno Gator-back",
            "subtitulo": "Ventifactos · unidad de sulfatos",
            "imagen": "assets/punto4.jpg",
            "vaov": 100.02,
            "rumbo_centro": 84,
            "rumbo_nota": "Relieve de Monte Sharp visible en yaw ≈ +45° (rumbo real ≈ 129°).",
            "conexiones": ["p3"],
            "coordenadas": {"lat": -4.6865, "lng": 137.3621, "elevacionMOLA": -3810},
            "navegacion": {
                "pendienteLocalGrados": 12.5,
                "pendienteMaximaEntornoGrados": 24.5,
                "inclinacionLateralGrados": 4.1,
                "estadoTerreno": "PELIGRO - Rocas afiladas (Ventifactos / Gator-back terrain)"
            },
            "ambiente": {
                "temperaturaAireC": {"max": -11, "min": -72, "actual": -14},
                "temperaturaSueloC": -2,
                "presionPa": 780,
                "humedadRelativaPorcentaje": {"dia": 2, "madrugada": 35},
                "viento": {"velocidadMs": 5.1, "rafagasMs": 9.8, "direccion": "S-SE", "tipo": "Catabático"},
                "radiacion": {"dosisRADmSvDia": 0.65, "indiceUV": "HIGH", "alertaSolar": "Nominal"}
            },
            "hidratacion_pct": 5.5,
            "minerales": [
                {"nombre": "Sulfato de Mg", "formula": "MgSO₄·nH₂O", "confianza": 0.81, "fuente": "CheMin + ChemCam · unidad de sulfatos"},
                {"nombre": "Sulfato de Ca", "formula": "CaSO₄·nH₂O", "confianza": 0.68, "fuente": "ChemCam LIBS"}
            ],
            "hotspots": [
                {
                    "tipo": "terreno", "yaw": 15, "pitch": -5,
                    "titulo": "Ventifactos (gator-back)",
                    "pendiente_grados": 24.5,
                    "hallazgo": "Escamas de roca dura talladas por el viento, con filos cortantes como lomo de caimán.",
                    "impacto_humanidad": "La erosión eólica activa muestra que Marte sigue cambiando hoy; para una EVA es el terreno más peligroso para trajes y botas."
                },
                {
                    "tipo": "ciencia", "yaw": 110, "pitch": 6,
                    "titulo": "Unidad rica en sulfatos",
                    "mineral": "Sulfato de Mg", "formula": "MgSO₄·nH₂O", "confianza": 0.81, "banda_um": "1.9 / 2.4",
                    "instrumento": "CheMin", "fuente": "CheMin / ChemCam (MSL)",
                    "hallazgo": "Sales hidratadas que se formaron al evaporarse lagos salinos.",
                    "impacto_humanidad": "Los sulfatos hidratados guardan hasta un 20% de agua: el mejor recurso ISRU de la ruta para agua y oxígeno."
                },
                {
                    "tipo": "ciencia", "yaw": 50, "pitch": 36,
                    "titulo": "Laderas de Monte Sharp",
                    "mineral": "Sulfatos estratificados", "formula": "—", "confianza": 0.72, "banda_um": "1.9 / 2.4",
                    "instrumento": "Mastcam", "fuente": "Mastcam (MSL)",
                    "hallazgo": "Capas finas y regulares en las laderas: ciclos climáticos repetidos.",
                    "impacto_humanidad": "Leer estos ciclos es como leer anillos de árboles: revela cómo cambia el clima de un planeta a lo largo de millones de años."
                }
            ]
        }
    ]
}

# ==============================================================================
# 3. FUNCIONES FÍSICAS (HAVERSINE, CONSUMO O2, RADIACIÓN)
# ==============================================================================
def distancia_haversine_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * RADIO_MARTE_M * math.asin(math.sqrt(a))

def factores_terreno(pendiente_deg, subiendo):
    p = abs(pendiente_deg)
    if p <= UMBRAL_PENALIZACION_DEG:
        esfuerzo = 1.0 + (p / UMBRAL_PENALIZACION_DEG) * 0.6
        velocidad = max(0.6, 1.0 - p * 0.02)
    else:
        exceso = p - UMBRAL_PENALIZACION_DEG
        esfuerzo = 1.6 + 0.30 * exceso ** 1.5
        velocidad = max(0.25, 0.70 - exceso * 0.04)
    if not subiendo:
        esfuerzo = 1.0 + (esfuerzo - 1.0) * 0.5
    return esfuerzo, velocidad

def calcular_tramo(distancia_m, delta_h_m, pendiente_local_deg, dosis_rad_sol):
    esfuerzo, f_vel = factores_terreno(pendiente_local_deg, subiendo=delta_h_m > 0)
    longitud_real_m = math.hypot(distancia_m, delta_h_m)
    tiempo_min = longitud_real_m / (VELOCIDAD_BASE_MS * f_vel) / 60.0
    o2_g = tiempo_min * CONSUMO_NOMINAL_G_MIN * esfuerzo
    tasa_rad_min = dosis_rad_sol / MINUTOS_POR_SOL
    return {
        "tiempo_min": tiempo_min,
        "o2_g": o2_g,
        "radiacion_msv": tiempo_min * tasa_rad_min
    }

# ==============================================================================
# 4. GENERADOR DE datos_ruta.json COMPATIBLE CON app.js
# ==============================================================================
def generar_json_mision(entrada=DATOS_MISION, ruta_salida=ARCHIVO_SALIDA):
    puntos_in = entrada["puntos"]
    o2_g = CAPACIDAD_TANQUE_O2_G - (TIEMPO_PREPARACION_MIN * CONSUMO_NOMINAL_G_MIN)
    rad_msv = TIEMPO_PREPARACION_MIN * (puntos_in[0]["ambiente"]["radiacion"]["dosisRADmSvDia"] / MINUTOS_POR_SOL)
    dist_acumulada = 0.0
    puntos_out = []

    for i, p in enumerate(puntos_in):
        c = p["coordenadas"]
        nav = p["navegacion"]
        dosis_sol = p["ambiente"]["radiacion"]["dosisRADmSvDia"]

        if i == 0:
            dist_tramo = 0.0
            dh = 0.0
            tramo = {"tiempo_min": 0.0, "o2_g": 0.0, "radiacion_msv": 0.0}
        else:
            prev_c = puntos_in[i - 1]["coordenadas"]
            dist_tramo = distancia_haversine_m(prev_c["lat"], prev_c["lng"], c["lat"], c["lng"])
            dh = c["elevacionMOLA"] - prev_c["elevacionMOLA"]
            tramo = calcular_tramo(dist_tramo, dh, nav["pendienteLocalGrados"], dosis_sol)

        dist_acumulada += dist_tramo
        o2_g -= tramo["o2_g"]
        rad_msv += tramo["radiacion_msv"]
        o2_pct = round(max(0.0, o2_g / CAPACIDAD_TANQUE_O2_G * 100.0), 1)

        puntos_out.append({
            "id": p["id"],
            "nombre": p["nombre"],
            "subtitulo": p["subtitulo"],
            "imagen": p["imagen"],
            "vaov": p["vaov"],
            "rumbo_centro": p["rumbo_centro"],
            "rumbo_nota": p["rumbo_nota"],
            "conexiones": p["conexiones"],
            "coordenadas": c,
            "navegacion": {
                "distanciaTramoMetros": round(dist_tramo, 1),
                "distanciaAcumuladaMetros": round(dist_acumulada, 1),
                "pendienteLocalGrados": nav["pendienteLocalGrados"],
                "pendienteMaximaEntornoGrados": nav["pendienteMaximaEntornoGrados"],
                "inclinacionLateralGrados": nav["inclinacionLateralGrados"],
                "estadoTerreno": nav["estadoTerreno"]
            },
            "ambiente": p["ambiente"],
            "eva": {
                "oxigeno_pct": o2_pct,
                "radiacion_acumulada_msv": round(rad_msv, 3),
                "hidratacion_pct": p["hidratacion_pct"]
            },
            "minerales": p["minerales"],
            "hotspots": p["hotspots"]
        })

    datos_finales = {
        "mision": {
            "nombre": entrada["nombre"],
            "sitio": entrada["sitio"],
            "nota": entrada["nota"],
            "radio_marte_m": entrada["radio_marte_m"],
            "umbrales": entrada["umbrales"],
            "monte_sharp": entrada["monte_sharp"],
            "assets": entrada["assets"]
        },
        "puntos": puntos_out
    }

    with open(ruta_salida, "w", encoding="utf-8") as f:
        json.dump(datos_finales, f, indent=2, ensure_ascii=False)

    print(f"[OK] '{ruta_salida}' generado con 4 estaciones reales del Cráter Gale.")
    for pt in puntos_out:
        print(f"  {pt['id']} ({pt['nombre']}): dist={pt['navegacion']['distanciaAcumuladaMetros']} m | "
              f"O2={pt['eva']['oxigeno_pct']}% | Rad={pt['eva']['radiacion_acumulada_msv']} mSv | "
              f"H2O={pt['eva']['hidratacion_pct']}%")
    return datos_finales

if __name__ == "__main__":
    generar_json_mision()