import json
import math

# ==============================================================================
# 1. PHYSICAL CONSTANTS AND MISSION PARAMETERS (GALE CRATER · CURIOSITY)
# ==============================================================================
MARS_RADIUS_M = 3_389_500.0          # mean volumetric radius of Mars (m)
MARS_GRAVITY = 3.721                 # m/s²
EARTH_GRAVITY = 9.807

ASTRONAUT_MASS_KG = 80.0
SUIT_MASS_KG = 130.0
TOTAL_MASS_KG = ASTRONAUT_MASS_KG + SUIT_MASS_KG             # 210 kg

BASE_SPEED_KMH = 2.0
BASE_SPEED_MS = BASE_SPEED_KMH / 3.6                         # 0.556 m/s

NOMINAL_AUTONOMY_H = 8.0                                     # 480 min
REF_O2_CONSUMPTION_G_MIN = 1.25
LOAD_FACTOR = (TOTAL_MASS_KG * MARS_GRAVITY) / (ASTRONAUT_MASS_KG * EARTH_GRAVITY)
NOMINAL_CONSUMPTION_G_MIN = REF_O2_CONSUMPTION_G_MIN * LOAD_FACTOR
O2_TANK_CAPACITY_G = NOMINAL_CONSUMPTION_G_MIN * NOMINAL_AUTONOMY_H * 60.0

CAUTION_THRESHOLD_DEG = 12
PENALTY_THRESHOLD_DEG = 15.0
DANGER_THRESHOLD_DEG = 20
EVA_RADIATION_LIMIT_MSV = 1.0

MINUTES_PER_SOL = 24 * 60 + 39.58    # 1479.58 min
PREP_TIME_MIN = 15.0                 # initial check in the airlock
OUTPUT_FILE = "route_data.json"

# ==============================================================================
# 2. REAL TERRAIN DATA — 4 STATIONS IN GALE CRATER (ROLE 1)
# ==============================================================================
MISSION_DATA = {
    "name": "Ares-360 · MarsWalk EVA-01",
    "site": "Gale Crater · Mount Sharp (Curiosity Mission)",
    "note": "Coordinates, navigation and environment: reference data from the MSL Curiosity mission (MOLA, REMS, RAD). O₂, accumulated EVA dose, mineral hydration and hotspots are SIMULATED with realistic orders of magnitude. Not for real navigation.",
    "mars_radius_m": int(MARS_RADIUS_M),
    "thresholds": {
        "slope_caution_degrees": CAUTION_THRESHOLD_DEG,
        "slope_danger_degrees": DANGER_THRESHOLD_DEG,
        "oxygen_low_pct": 50,
        "oxygen_critical_pct": 25,
        "eva_radiation_limit_msv": EVA_RADIATION_LIMIT_MSV,
        "gust_caution_ms": 10,
        "total_autonomy_min": int(NOMINAL_AUTONOMY_H * 60)
    },
    "mount_sharp": {
        "lat": -5.08,
        "lng": 137.85
    },
    "assets": {
        "use_real_images": True,
        "use_real_map": True,
        "map": "assets/gale_map.jpg",
        "map_hypso": "assets/gale_map_hypso.jpg",
        "hirise": {
            "product": "PSP_009149_1750",
            "lat": -4.799,
            "lng": 137.412
        },
        "map_bounds_note": "Square box (16.7 km per side) centered on the 4 points + HiRISE center, with a 35% margin. Approximate georeferencing: the images do not yet have a verified 1:1 mapping.",
        "map_bounds": [
            [
                -4.8357,
                137.26
            ],
            [
                -4.5528,
                137.5438
            ]
        ]
    },
    "points": [
        {
            "id": "p1",
            "name": "Vera Rubin Ridge",
            "subtitle": "Hematite ridge · hard bedrock",
            "image": "assets/point1.jpg",
            "vaov": 83.85,
            "center_heading": 131,
            "heading_note": "No visible reference (dust storm): center oriented toward Mount Sharp. Low-confidence estimate.",
            "connections": [
                "p2"
            ],
            "coordinates": {
                "lat": -4.6795,
                "lng": 137.3882,
                "elevationMOLA": -4175
            },
            "navigation": {
                "localSlopeDegrees": 6.5,
                "maxSurroundingSlopeDegrees": 18.5,
                "lateralTiltDegrees": 2.1,
                "terrainStatus": "CAUTION - Hard bedrock (Vera Rubin Ridge) and fine dust"
            },
            "environment": {
                "airTemperatureC": {
                    "max": -15,
                    "min": -65,
                    "current": -18
                },
                "groundTemperatureC": -5,
                "pressurePa": 865,
                "relativeHumidityPercent": {
                    "day": 1,
                    "predawn": 25
                },
                "wind": {
                    "speedMs": 5.5,
                    "gustsMs": 10.2,
                    "direction": "SE",
                    "type": "Decaying dust storm"
                },
                "radiation": {
                    "doseRADmSvDay": 0.62,
                    "uvIndex": "MODERATE",
                    "solarAlert": "Elevated atmospheric opacity (Tau)"
                }
            },
            "hydration_pct": 3.0,
            "minerals": [
                {
                    "name": "Hematite",
                    "formula": "Fe₂O₃",
                    "confidence": 0.88,
                    "source": "CRISM + CheMin (XRD) · Vera Rubin Ridge"
                },
                {
                    "name": "Ca sulfate",
                    "formula": "CaSO₄·nH₂O",
                    "confidence": 0.74,
                    "source": "ChemCam · white veins"
                }
            ],
            "hotspots": [
                {
                    "type": "science",
                    "yaw": 110,
                    "pitch": -24,
                    "title": "Hematite-bearing slabs",
                    "mineral": "Hematite",
                    "formula": "Fe₂O₃",
                    "confidence": 0.88,
                    "band_um": "0.86",
                    "instrument": "CRISM",
                    "source": "CRISM / CheMin (MSL)",
                    "finding": "Fractured bedrock with crystalline hematite: groundwater hardened the ridge.",
                    "impact_on_humanity": "Hematite records ancient oxidizing waters. Understanding how long they lasted shows where to look for habitable environments and preserved organic matter."
                },
                {
                    "type": "science",
                    "yaw": -160,
                    "pitch": -8,
                    "title": "Calcium sulfate veins",
                    "mineral": "Ca sulfate (gypsum/bassanite)",
                    "formula": "CaSO₄·nH₂O",
                    "confidence": 0.74,
                    "band_um": "1.9 / 2.2",
                    "instrument": "ChemCam",
                    "source": "ChemCam LIBS (MSL)",
                    "finding": "White veins filling fractures: fluids circulated after the rock formed.",
                    "impact_on_humanity": "Gypsum contains bound water that can be extracted by heating: an accessible ISRU resource for future human bases."
                },
                {
                    "type": "terrain",
                    "yaw": -120,
                    "pitch": 22,
                    "title": "Ridge flank",
                    "slope_degrees": 18.5,
                    "finding": "Hard rock steps covered in fine dust that hides loose edges.",
                    "impact_on_humanity": "Testing ascent routes over dusty hard rock teaches how to design boots and traction protocols for real EVAs."
                }
            ]
        },
        {
            "id": "p2",
            "name": "Rocknest",
            "subtitle": "Basaltic sand shadow · Bradbury plain",
            "image": "assets/point2.jpg",
            "vaov": 102.74,
            "center_heading": 194,
            "heading_note": "Mount Sharp visible at yaw ≈ -54° (true heading ≈ 140°).",
            "connections": [
                "p1",
                "p3"
            ],
            "coordinates": {
                "lat": -4.5895,
                "lng": 137.4417,
                "elevationMOLA": -4521
            },
            "navigation": {
                "localSlopeDegrees": -1.5,
                "maxSurroundingSlopeDegrees": 2.5,
                "lateralTiltDegrees": -3.5,
                "terrainStatus": "STABLE - Basaltic sand mound (Rocknest)"
            },
            "environment": {
                "airTemperatureC": {
                    "max": -2,
                    "min": -75,
                    "current": -10
                },
                "groundTemperatureC": 3,
                "pressurePa": 740,
                "relativeHumidityPercent": {
                    "day": 2,
                    "predawn": 45
                },
                "wind": {
                    "speedMs": 4.2,
                    "gustsMs": 9.1,
                    "direction": "E-SE",
                    "type": "Plain winds"
                },
                "radiation": {
                    "doseRADmSvDay": 0.64,
                    "uvIndex": "HIGH",
                    "solarAlert": "Nominal (No solar storms)"
                }
            },
            "hydration_pct": 2.0,
            "minerals": [
                {
                    "name": "Plagioclase",
                    "formula": "(Na,Ca)Al₁₋₂Si₃₋₂O₈",
                    "confidence": 0.9,
                    "source": "CheMin (XRD) · first diffraction on Mars"
                },
                {
                    "name": "Olivine",
                    "formula": "(Mg,Fe)₂SiO₄",
                    "confidence": 0.82,
                    "source": "CheMin (XRD)"
                },
                {
                    "name": "Amorphous phase",
                    "formula": "—",
                    "confidence": 0.6,
                    "source": "CheMin + SAM · ~2% H₂O"
                }
            ],
            "hotspots": [
                {
                    "type": "science",
                    "yaw": 100,
                    "pitch": -13,
                    "title": "Rocknest sand shadow",
                    "mineral": "Plagioclase + olivine + augite",
                    "formula": "(Na,Ca)(Al,Si)₄O₈ · (Mg,Fe)₂SiO₄",
                    "confidence": 0.9,
                    "band_um": "XRD",
                    "instrument": "CheMin",
                    "source": "CheMin / SAM (MSL)",
                    "finding": "Basaltic sand similar to Hawaii's, with an amorphous phase that releases water when heated.",
                    "impact_on_humanity": "Shows that Mars' global dust contains ~2% water: any astronaut could get water from the soil almost anywhere."
                },
                {
                    "type": "science",
                    "yaw": -54,
                    "pitch": 28,
                    "title": "Mount Sharp (Aeolis Mons)",
                    "mineral": "Layered clays and sulfates",
                    "formula": "—",
                    "confidence": 0.85,
                    "band_um": "1.9 / 2.3",
                    "instrument": "CRISM",
                    "source": "CRISM / HiRISE (MRO)",
                    "finding": "A 5 km mountain built from sediment layers: a book of climate history.",
                    "impact_on_humanity": "Its strata record the transition from a wet Mars to a dry one: key to understanding the climate future of planets like Earth."
                },
                {
                    "type": "terrain",
                    "yaw": -128,
                    "pitch": 3,
                    "title": "Vesicular basalt blocks",
                    "slope_degrees": 2.5,
                    "finding": "Loose rocks on compacted sand. Flat, traversable terrain.",
                    "impact_on_humanity": "Ideal area to practice walking and sampling before tackling the slopes of Mount Sharp."
                }
            ]
        },
        {
            "id": "p3",
            "name": "Naukluft Plateau",
            "subtitle": "Stimson aeolian sandstone · fractured plateau",
            "image": "assets/point3.jpg",
            "vaov": 82.71,
            "center_heading": 25,
            "heading_note": "Mount Sharp visible at yaw ≈ +110° (true heading ≈ 135°).",
            "connections": [
                "p2",
                "p4"
            ],
            "coordinates": {
                "lat": -4.6418,
                "lng": 137.4085,
                "elevationMOLA": -4415
            },
            "navigation": {
                "localSlopeDegrees": 14.2,
                "maxSurroundingSlopeDegrees": 22.0,
                "lateralTiltDegrees": 6.8,
                "terrainStatus": "DANGER - Fractured sandstone (Naukluft Plateau). High wheel wear."
            },
            "environment": {
                "airTemperatureC": {
                    "max": -4,
                    "min": -74,
                    "current": -8
                },
                "groundTemperatureC": 2,
                "pressurePa": 825,
                "relativeHumidityPercent": {
                    "day": 1,
                    "predawn": 30
                },
                "wind": {
                    "speedMs": 4.8,
                    "gustsMs": 9.5,
                    "direction": "E",
                    "type": "Steady due to elevation"
                },
                "radiation": {
                    "doseRADmSvDay": 0.64,
                    "uvIndex": "HIGH",
                    "solarAlert": "Nominal"
                }
            },
            "hydration_pct": 3.5,
            "minerals": [
                {
                    "name": "Amorphous silica (opal-A)",
                    "formula": "SiO₂·nH₂O",
                    "confidence": 0.79,
                    "source": "CheMin + APXS · fracture halos"
                },
                {
                    "name": "Magnetite",
                    "formula": "Fe₃O₄",
                    "confidence": 0.66,
                    "source": "CheMin (XRD) · Stimson sandstone"
                }
            ],
            "hotspots": [
                {
                    "type": "science",
                    "yaw": -30,
                    "pitch": -10,
                    "title": "Silica-rich halos",
                    "mineral": "Amorphous silica (opal-A)",
                    "formula": "SiO₂·nH₂O",
                    "confidence": 0.79,
                    "band_um": "2.21",
                    "instrument": "APXS",
                    "source": "APXS / CheMin (MSL)",
                    "finding": "Light bands along fractures: late fluids deposited silica in the sandstone.",
                    "impact_on_humanity": "On Earth, hydrothermal silica deposits preserve microfossils: they are priority targets in the search for past life."
                },
                {
                    "type": "terrain",
                    "yaw": -55,
                    "pitch": -20,
                    "title": "Sharp-edged sandstone",
                    "slope_degrees": 22.0,
                    "finding": "Fractured plates and ventifacts that punctured Curiosity's wheels.",
                    "impact_on_humanity": "This terrain forced the rover's routes to be redesigned; for an EVA it marks where a boot or suit could tear."
                },
                {
                    "type": "science",
                    "yaw": 110,
                    "pitch": 34,
                    "title": "Mount Sharp strata",
                    "mineral": "Mg sulfates / clays",
                    "formula": "MgSO₄·nH₂O",
                    "confidence": 0.7,
                    "band_um": "1.9 / 2.4",
                    "instrument": "CRISM",
                    "source": "CRISM (MRO)",
                    "finding": "Upper layers of the mountain: transition from clays to sulfates.",
                    "impact_on_humanity": "Marks the moment Mars lost its surface water: helps understand how a habitable planet becomes inhospitable."
                }
            ]
        },
        {
            "id": "p4",
            "name": "Gator-back Terrain",
            "subtitle": "Ventifacts · sulfate unit",
            "image": "assets/point4.jpg",
            "vaov": 100.02,
            "center_heading": 84,
            "heading_note": "Mount Sharp relief visible at yaw ≈ +45° (true heading ≈ 129°).",
            "connections": [
                "p3"
            ],
            "coordinates": {
                "lat": -4.6865,
                "lng": 137.3621,
                "elevationMOLA": -3810
            },
            "navigation": {
                "localSlopeDegrees": 12.5,
                "maxSurroundingSlopeDegrees": 24.5,
                "lateralTiltDegrees": 4.1,
                "terrainStatus": "DANGER - Sharp rocks (Ventifacts / Gator-back terrain)"
            },
            "environment": {
                "airTemperatureC": {
                    "max": -11,
                    "min": -72,
                    "current": -14
                },
                "groundTemperatureC": -2,
                "pressurePa": 780,
                "relativeHumidityPercent": {
                    "day": 2,
                    "predawn": 35
                },
                "wind": {
                    "speedMs": 5.1,
                    "gustsMs": 9.8,
                    "direction": "S-SE",
                    "type": "Katabatic"
                },
                "radiation": {
                    "doseRADmSvDay": 0.65,
                    "uvIndex": "HIGH",
                    "solarAlert": "Nominal"
                }
            },
            "hydration_pct": 5.5,
            "minerals": [
                {
                    "name": "Mg sulfate",
                    "formula": "MgSO₄·nH₂O",
                    "confidence": 0.81,
                    "source": "CheMin + ChemCam · sulfate unit"
                },
                {
                    "name": "Ca sulfate",
                    "formula": "CaSO₄·nH₂O",
                    "confidence": 0.68,
                    "source": "ChemCam LIBS"
                }
            ],
            "hotspots": [
                {
                    "type": "terrain",
                    "yaw": 15,
                    "pitch": -5,
                    "title": "Ventifacts (gator-back)",
                    "slope_degrees": 24.5,
                    "finding": "Hard rock scales carved by the wind, with edges as sharp as an alligator's back.",
                    "impact_on_humanity": "Active wind erosion shows that Mars is still changing today; for an EVA it is the most dangerous terrain for suits and boots."
                },
                {
                    "type": "science",
                    "yaw": 110,
                    "pitch": 6,
                    "title": "Sulfate-rich unit",
                    "mineral": "Mg sulfate",
                    "formula": "MgSO₄·nH₂O",
                    "confidence": 0.81,
                    "band_um": "1.9 / 2.4",
                    "instrument": "CheMin",
                    "source": "CheMin / ChemCam (MSL)",
                    "finding": "Hydrated salts that formed as saline lakes evaporated.",
                    "impact_on_humanity": "Hydrated sulfates hold up to 20% water: the best ISRU resource on the route for water and oxygen."
                },
                {
                    "type": "science",
                    "yaw": 50,
                    "pitch": 36,
                    "title": "Mount Sharp slopes",
                    "mineral": "Layered sulfates",
                    "formula": "—",
                    "confidence": 0.72,
                    "band_um": "1.9 / 2.4",
                    "instrument": "Mastcam",
                    "source": "Mastcam (MSL)",
                    "finding": "Thin, regular layers on the slopes: repeated climate cycles.",
                    "impact_on_humanity": "Reading these cycles is like reading tree rings: it reveals how a planet's climate changes over millions of years."
                }
            ]
        }
    ]
}

# ==============================================================================
# 3. PHYSICS FUNCTIONS (HAVERSINE, O2 CONSUMPTION, RADIATION)
# ==============================================================================
def haversine_distance_m(lat1, lng1, lat2, lng2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * MARS_RADIUS_M * math.asin(math.sqrt(a))

def terrain_factors(slope_deg, uphill):
    p = abs(slope_deg)
    if p <= PENALTY_THRESHOLD_DEG:
        effort = 1.0 + (p / PENALTY_THRESHOLD_DEG) * 0.6
        speed = max(0.6, 1.0 - p * 0.02)
    else:
        excess = p - PENALTY_THRESHOLD_DEG
        effort = 1.6 + 0.30 * excess ** 1.5
        speed = max(0.25, 0.70 - excess * 0.04)
    if not uphill:
        effort = 1.0 + (effort - 1.0) * 0.5
    return effort, speed

def compute_segment(distance_m, delta_h_m, local_slope_deg, rad_dose_per_sol):
    effort, speed_f = terrain_factors(local_slope_deg, uphill=delta_h_m > 0)
    real_length_m = math.hypot(distance_m, delta_h_m)
    time_min = real_length_m / (BASE_SPEED_MS * speed_f) / 60.0
    o2_g = time_min * NOMINAL_CONSUMPTION_G_MIN * effort
    rad_rate_min = rad_dose_per_sol / MINUTES_PER_SOL
    return {
        "time_min": time_min,
        "o2_g": o2_g,
        "radiation_msv": time_min * rad_rate_min
    }

# ==============================================================================
# 4. route_data.json GENERATOR COMPATIBLE WITH app.js
# ==============================================================================
def generate_mission_json(source=MISSION_DATA, output_path=OUTPUT_FILE):
    points_in = source["points"]
    o2_g = O2_TANK_CAPACITY_G - (PREP_TIME_MIN * NOMINAL_CONSUMPTION_G_MIN)
    rad_msv = PREP_TIME_MIN * (points_in[0]["environment"]["radiation"]["doseRADmSvDay"] / MINUTES_PER_SOL)
    cumulative_dist = 0.0
    points_out = []

    for i, p in enumerate(points_in):
        c = p["coordinates"]
        nav = p["navigation"]
        dose_sol = p["environment"]["radiation"]["doseRADmSvDay"]

        if i == 0:
            segment_dist = 0.0
            dh = 0.0
            segment = {"time_min": 0.0, "o2_g": 0.0, "radiation_msv": 0.0}
        else:
            prev_c = points_in[i - 1]["coordinates"]
            segment_dist = haversine_distance_m(prev_c["lat"], prev_c["lng"], c["lat"], c["lng"])
            dh = c["elevationMOLA"] - prev_c["elevationMOLA"]
            segment = compute_segment(segment_dist, dh, nav["localSlopeDegrees"], dose_sol)

        cumulative_dist += segment_dist
        o2_g -= segment["o2_g"]
        rad_msv += segment["radiation_msv"]
        o2_pct = round(max(0.0, o2_g / O2_TANK_CAPACITY_G * 100.0), 1)

        points_out.append({
            "id": p["id"],
            "name": p["name"],
            "subtitle": p["subtitle"],
            "image": p["image"],
            "vaov": p["vaov"],
            "center_heading": p["center_heading"],
            "heading_note": p["heading_note"],
            "connections": p["connections"],
            "coordinates": c,
            "navigation": {
                "segmentDistanceMeters": round(segment_dist, 1),
                "cumulativeDistanceMeters": round(cumulative_dist, 1),
                "localSlopeDegrees": nav["localSlopeDegrees"],
                "maxSurroundingSlopeDegrees": nav["maxSurroundingSlopeDegrees"],
                "lateralTiltDegrees": nav["lateralTiltDegrees"],
                "terrainStatus": nav["terrainStatus"]
            },
            "environment": p["environment"],
            "eva": {
                "oxygen_pct": o2_pct,
                "accumulated_radiation_msv": round(rad_msv, 3),
                "hydration_pct": p["hydration_pct"]
            },
            "minerals": p["minerals"],
            "hotspots": p["hotspots"]
        })

    final_data = {
        "mission": {
            "name": source["name"],
            "site": source["site"],
            "note": source["note"],
            "mars_radius_m": source["mars_radius_m"],
            "thresholds": source["thresholds"],
            "mount_sharp": source["mount_sharp"],
            "assets": source["assets"]
        },
        "points": points_out
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"[OK] '{output_path}' generated with 4 real Gale Crater stations.")
    for pt in points_out:
        print(f"  {pt['id']} ({pt['name']}): dist={pt['navigation']['cumulativeDistanceMeters']} m | "
              f"O2={pt['eva']['oxygen_pct']}% | Rad={pt['eva']['accumulated_radiation_msv']} mSv | "
              f"H2O={pt['eva']['hydration_pct']}%")
    return final_data

if __name__ == "__main__":
    generate_mission_json()
