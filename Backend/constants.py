# Exact translation of JS constants. No logic changed.

CROP_STRATEGIES = {
    "vegetables": {
        "label": "Vegetables (Maraîchères)",
        "name": "Vegetables",
        "depth": "0–20 cm (tillage layer)",
        "tools": "Soil auger or flat spade",
        "timing": "4–6 weeks before planting",
        "buckets": "1 composite bucket per zone",
        "coresPerHa": 7,
        "minCores": 8,
        "maxCores": 20,
        "zoneHa": 3,
        "sourceLabel": "USDA-NRCS / Mosaic Crop Nutrition [1]",
    },
    "cereals": {
        "label": "Cereals & Field Crops",
        "name": "Cereals & Field Crops",
        "depth": "0–25 cm",
        "tools": "Soil auger",
        "timing": "Late summer / early autumn (before sowing)",
        "buckets": "1 composite bucket per zone",
        "coresPerHa": 4,
        "minCores": 6,
        "maxCores": 20,
        "zoneHa": 5,
        "sourceLabel": "Ohio State Univ. Agronomy Network [2]",
    },
    "trees": {
        "label": "Permanent Crops (Trees)",
        "name": "Trees / Orchard",
        "depth": "0–30 cm AND 30–60 cm (two buckets)",
        "tools": "Deep soil auger — 2 buckets per zone",
        "timing": "Winter dormancy (pruning season)",
        "buckets": "2 buckets per zone (0–30 cm + 30–60 cm)",
        "coresPerHa": 5,
        "minCores": 6,
        "maxCores": 20,
        "zoneHa": 4,
        "sourceLabel": "AFNOR NF X 31-100 [3]",
    },
}

ECONOMIC_THRESHOLDS = [
    {"maxHa": 10, "zones": 1},
    {"maxHa": 25, "zones": 2},
    {"maxHa": 9999, "zones": 3},
]

USDA_SOIL = {
    1: {"name": "Clay", "color": "#b07d2e"},
    2: {"name": "Silty Clay", "color": "#8e44ad"},
    3: {"name": "Sandy Clay", "color": "#6d8b3a"},
    4: {"name": "Clay Loam", "color": "#c0392b"},
    5: {"name": "Silty Clay Loam", "color": "#16a085"},
    6: {"name": "Sandy Clay Loam", "color": "#2471a3"},
    7: {"name": "Loam", "color": "#7f8c8d"},
    8: {"name": "Silt Loam", "color": "#a39d5f"},
    9: {"name": "Sandy Loam", "color": "#d4a017"},
    10: {"name": "Silt", "color": "#ca6f1e"},
    11: {"name": "Loamy Sand", "color": "#ba8a2f"},
    12: {"name": "Sand", "color": "#c8b800"},
}