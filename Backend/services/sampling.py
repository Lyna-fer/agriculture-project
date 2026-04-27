import math
import random
import ee
from functools import cmp_to_key
from shapely.geometry import Polygon, Point, box
from pyproj import Geod
try:
    from Backend.constants import CROP_STRATEGIES, ECONOMIC_THRESHOLDS, USDA_SOIL
    from Backend.utils.geometry import safe_intersect
except ModuleNotFoundError:
    from constants import CROP_STRATEGIES, ECONOMIC_THRESHOLDS, USDA_SOIL
    from utils.geometry import safe_intersect

MAX_PARCEL_AREA_HA = 50

# ─── GEODESIC AREA HELPER (matches Turf.js exactly) ──────────────────────────────
def calculate_area_hectares(coords: list[list[float]]) -> float:
    """
    Calculate polygon area in hectares using geodesic (WGS84) calculation.
    Matches Turf.js area() behavior exactly.
    """
    geod = Geod(ellps="WGS84")
    lons = [c[1] for c in coords]
    lats = [c[0] for c in coords]
    if lons[0] != lons[-1] or lats[0] != lats[-1]:
        lons.append(lons[0])
        lats.append(lats[0])
    area_m2, _ = geod.polygon_area_perimeter(lons, lats)
    return abs(area_m2) / 10000  # m² → ha


def compute_num_zones(total_area_ha: float, strategy: dict, sampling_mode: str) -> int:
    """Exact translation of JS computeNumZones. Same decision tree."""
    if sampling_mode == "economic":
        return next((t["zones"] for t in ECONOMIC_THRESHOLDS if total_area_ha <= t["maxHa"]), 3)
    if total_area_ha > strategy["zoneHa"] * 1.35:
        return math.ceil(total_area_ha / strategy["zoneHa"])
    return 1


def generate_points(poly: Polygon, area_ha: float, strategy: dict, density_factor: float = 1.0) -> list[list[float]]:
    """
    Generate spatially distributed sub-core sampling points inside a polygon.
    EXACT match to Turf.js pointGrid() + serpentine selection from samplingEngine.js.

    KEY FIX: Properly distribute points evenly across the entire serpentine path
    to eliminate gaps between sample locations.
    """
    target_cores = max(
        strategy["minCores"],
        min(strategy["maxCores"], round(area_ha * strategy["coresPerHa"] * density_factor))
    )

    minx, miny, maxx, maxy = poly.bounds  # (minLng, minLat, maxLng, maxLat)

    # ✅ EXACT JS FORMULA: cellSide in kilometers
    cell_side_km = max(math.sqrt((area_ha / (target_cores * 6)) / 100), 0.003)

    # ✅ Convert km to degrees (geodesic conversion)
    avg_lat = (miny + maxy) / 2
    km_to_deg_lat = 1 / 111.32
    km_to_deg_lng = 1 / (111.32 * math.cos(math.radians(avg_lat)))

    cell_side_deg_lat = cell_side_km * km_to_deg_lat
    cell_side_deg_lng = cell_side_km * km_to_deg_lng

    # ✅ Generate full grid covering bounding box (like turf.pointGrid)
    all_grid_points = []
    x = minx
    while x <= maxx + 1e-9:
        y = miny
        while y <= maxy + 1e-9:
            pt = Point(x, y)
            if poly.contains(pt):
                all_grid_points.append({
                    "lng": x,
                    "lat": y,
                    "x": x,
                    "y": y
                })
            y += cell_side_deg_lat
        x += cell_side_deg_lng

    # ✅ Apply serpentine ordering if we have enough candidates
    if len(all_grid_points) >= target_cores:
        col_count = max(1, math.ceil(math.sqrt(target_cores)))
        col_width = (maxx - minx) / col_count

        for pt in all_grid_points:
            pt["_col"] = min(col_count - 1, math.floor((pt["x"] - minx) / col_width))
            pt["_lat"] = pt["y"]

        # ✅ CRITICAL: Use cmp_to_key for proper serpentine sort (matches JS comparator exactly)
        def serpentine_compare(a, b):
            if a["_col"] != b["_col"]:
                return a["_col"] - b["_col"]
            if a["_col"] % 2 == 0:
                return a["_lat"] - b["_lat"]  # Even cols: bottom→top (ascending)
            else:
                return b["_lat"] - a["_lat"]  # Odd cols: top→bottom (descending)

        all_grid_points.sort(key=cmp_to_key(serpentine_compare))

        # ✅ EXACT JS DISTRIBUTION with proper spacing
        result = []
        num_candidates = len(all_grid_points)

        if target_cores == 1:
            mid_idx = num_candidates // 2
            result.append([all_grid_points[mid_idx]["lat"], all_grid_points[mid_idx]["lng"]])
        else:
            for i in range(target_cores):
                float_idx = i * (num_candidates - 1) / (target_cores - 1)
                idx = int(round(float_idx))
                idx = max(0, min(idx, num_candidates - 1))
                result.append([all_grid_points[idx]["lat"], all_grid_points[idx]["lng"]])

        return result

    # ✅ Fallback: random points within polygon (same as JS)
    pts = []
    attempts = 0
    while len(pts) < target_cores and attempts < 5000:
        pt = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
        if poly.contains(pt):
            pts.append([pt.y, pt.x])
        attempts += 1
    return pts


def build_zones(drawn_polygon: Polygon, total_area_ha: float, num_zones: int, strategy: dict, sampling_mode: str) -> \
list[dict]:
    """
    Recursive square-split algorithm. Identical logic to JS buildZones.
    """
    density_factor = 0.5 if sampling_mode == "economic" else 1.0
    zones = []

    if num_zones == 1:
        points = generate_points(drawn_polygon, total_area_ha, strategy, density_factor)
        zones.append({
            "id": "Zone 1",
            "area": f"{total_area_ha:.2f}",
            "geoJson": {
                "type": "Feature",
                "geometry": drawn_polygon.__geo_interface__,
                "properties": {}
            },
            "points": points
        })
        return zones

    def split_polygon(poly: Polygon, zones_needed: int) -> list[Polygon]:
        if zones_needed <= 1:
            return [poly]

        minx, miny, maxx, maxy = poly.bounds
        width = maxx - minx
        height = maxy - miny
        split_by_lng = width > height

        left_count = zones_needed // 2
        right_count = zones_needed - left_count
        ratio = left_count / zones_needed

        if split_by_lng:
            split_x = minx + width * ratio
            strip_left = box(minx, miny - 0.01, split_x, maxy + 0.01)
            strip_right = box(split_x, miny - 0.01, maxx, maxy + 0.01)
        else:
            split_y = miny + height * ratio
            strip_left = box(minx - 0.01, miny, maxx + 0.01, split_y)
            strip_right = box(minx - 0.01, split_y, maxx + 0.01, maxy + 0.01)

        poly_left = safe_intersect(strip_left, poly)
        poly_right = safe_intersect(strip_right, poly)

        results = []
        if poly_left:
            results.extend(split_polygon(poly_left, left_count))
        if poly_right:
            results.extend(split_polygon(poly_right, right_count))
        return results

    zone_polygons = split_polygon(drawn_polygon, num_zones)
    n = 1
    for clipped in zone_polygons:
        zone_coords = [[c[1], c[0]] for c in list(clipped.exterior.coords)[:-1]]
        ha = calculate_area_hectares(zone_coords)

        if ha < 0.05:
            continue

        points = generate_points(clipped, ha, strategy, density_factor)
        zones.append({
            "id": f"Zone {n}",
            "area": f"{ha:.2f}",
            "geoJson": {
                "type": "Feature",
                "geometry": clipped.__geo_interface__,
                "properties": {}
            },
            "points": points
        })
        n += 1

    return zones


def run_sampling_pipeline(polygon_points: list[list[float]], crop_type: str, sampling_mode: str) -> dict:
    """
    Main pipeline. Exact flow match: area check -> GEE soil lookup -> zone split -> points.
    """
    if len(polygon_points) < 3:
        raise ValueError("Need at least 3 polygon points.")

    strategy = CROP_STRATEGIES.get(crop_type)
    if not strategy:
        raise ValueError(f"Unknown crop type: {crop_type}")

    coords = [[p[1], p[0]] for p in polygon_points]
    coords.append(coords[0])

    total_area_ha = calculate_area_hectares(polygon_points)

    if total_area_ha < 0.1:
        raise ValueError(f"Area too small ({total_area_ha:.2f} ha) for satellite analysis.")
    if total_area_ha > MAX_PARCEL_AREA_HA:
        raise ValueError(f"Area too large ({total_area_ha:.2f} ha). Maximum is {MAX_PARCEL_AREA_HA} ha per parcel.")

    drawn_polygon = Polygon(coords)
    ee_polygon = ee.Geometry.Polygon([coords])

    soil_image = ee.Image('OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02').select('b0')
    result = soil_image.reduceRegion(
        reducer=ee.Reducer.mode(),
        geometry=ee_polygon,
        scale=250,
        maxPixels=10 ** 9
    ).getInfo()

    if not result or 'b0' not in result:
        raise ValueError("Satellite error or field too small for 250 m resolution.")

    soil_data = USDA_SOIL.get(result['b0'], {"name": "Unknown", "color": "#888"})
    num_zones = compute_num_zones(total_area_ha, strategy, sampling_mode)
    zones = build_zones(drawn_polygon, total_area_ha, num_zones, strategy, sampling_mode)

    return {
        "totalAreaHa": total_area_ha,
        "soilData": soil_data,
        "zones": zones,
        "strategy": strategy,
        "mode": sampling_mode
    }