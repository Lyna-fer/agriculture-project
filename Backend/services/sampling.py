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

RECOMMENDED_ZONE_SIZE_RANGES = {
    "vegetables": (1.0, 2.0),
    "cereals": (2.0, 5.0),
    "trees": (1.0, 3.0),
}

MAX_POINTS_PER_ZONE = 30
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


def get_recommended_zone_range(crop_type: str, strategy: dict) -> tuple[float, float]:
    return RECOMMENDED_ZONE_SIZE_RANGES.get(crop_type.lower(), (strategy["zoneHa"] * 0.5, strategy["zoneHa"]))


def compute_num_zones(total_area_ha: float, strategy: dict, sampling_mode: str, crop_type: str) -> int:
    """Compute a crop-aware number of zones using recommended sample areas."""
    if sampling_mode == "economic":
        return next((t["zones"] for t in ECONOMIC_THRESHOLDS if total_area_ha <= t["maxHa"]), 3)

    min_ha, max_ha = get_recommended_zone_range(crop_type, strategy)
    if total_area_ha <= min_ha:
        return 1

    zones_by_max = math.ceil(total_area_ha / max_ha)
    if zones_by_max < 1:
        return 1

    if total_area_ha / zones_by_max < min_ha:
        return 1

    return zones_by_max


def generate_points(poly: Polygon, area_ha: float, strategy: dict, density_factor: float = 1.0, is_single_zone: bool = False) -> list[list[float]]:
    """
    Generate spatially distributed sub-core sampling points inside a polygon.
    Implements staggered grid centroids, high density for single zones, and vertex coverage.
    """
    target_cores = max(
        strategy["minCores"],
        min(strategy["maxCores"], round(area_ha * strategy["coresPerHa"] * density_factor))
    )
    # Never request more than the absolute maximum
    target_cores = min(target_cores, MAX_POINTS_PER_ZONE)

    minx, miny, maxx, maxy = poly.bounds  # (minLng, minLat, maxLng, maxLat)

    # ✅ Extract polygon vertices and identify extremes (tips)
    exterior_coords = list(poly.exterior.coords[:-1])
    vertex_candidates = []
    if len(exterior_coords) >= 3:
        # Find extreme vertices: leftmost, rightmost, topmost, bottommost
        extreme_indices = set()
        min_x_idx = min(range(len(exterior_coords)), key=lambda i: exterior_coords[i][0])
        max_x_idx = max(range(len(exterior_coords)), key=lambda i: exterior_coords[i][0])
        min_y_idx = min(range(len(exterior_coords)), key=lambda i: exterior_coords[i][1])
        max_y_idx = max(range(len(exterior_coords)), key=lambda i: exterior_coords[i][1])
        extreme_indices.update([min_x_idx, max_x_idx, min_y_idx, max_y_idx])

        # For triangular or sharp polygons, also include vertices that deviate from average edge length
        if len(exterior_coords) <= 5:
            extreme_indices.update(range(len(exterior_coords)))

        for idx in extreme_indices:
            x, y = exterior_coords[idx]
            pt = Point(x, y)
            if poly.contains(pt) or poly.touches(pt):
                vertex_candidates.append({
                    "lng": x,
                    "lat": y,
                    "x": x,
                    "y": y,
                    "col": -1,  # Mark as vertex
                    "row": -1,
                    "is_vertex": True
                })

    # ✅ Virtual grid centroid sampling with staggered (hexagonal) pattern
    def build_candidate_centroids(cell_side_km: float) -> list[dict]:
        cell_side_deg_lat = cell_side_km * (1 / 111.32)
        cell_side_deg_lng = cell_side_km * (1 / (111.32 * math.cos(math.radians((miny + maxy) / 2))))

        cols = max(1, math.ceil((maxx - minx) / cell_side_deg_lng))
        rows = max(1, math.ceil((maxy - miny) / cell_side_deg_lat))
        cell_width = (maxx - minx) / cols
        cell_height = (maxy - miny) / rows

        # Shift grid origin inward by half a cell to keep points away from polygon edges
        x_start = minx + (cell_width * 0.5)
        y_start = miny + (cell_height * 0.5)

        centroids = []
        for col in range(cols):
            # Staggered grid: odd columns shifted by half cell height
            y_offset = (cell_height / 2.0) if (col % 2 == 1) else 0.0
            for row in range(rows):
                cx = x_start + col * cell_width
                cy = y_start + row * cell_height + y_offset
                pt = Point(cx, cy)
                if poly.contains(pt):
                    centroids.append({
                        "lng": cx,
                        "lat": cy,
                        "x": cx,
                        "y": cy,
                        "col": col,
                        "row": row,
                        "is_vertex": False
                    })
        return centroids

    # For single zones, force higher density
    if is_single_zone:
        cell_side_km = max(math.sqrt((area_ha / (MAX_POINTS_PER_ZONE * 1.2)) / 100), 0.003)
    else:
        cell_side_km = max(math.sqrt((area_ha / (target_cores * 1.2)) / 100), 0.003)

    candidates = build_candidate_centroids(cell_side_km)

    # If we have too many candidates, increase the virtual cell size until candidate count is manageable
    while len(candidates) > MAX_POINTS_PER_ZONE:
        cell_side_km *= 1.1
        candidates = build_candidate_centroids(cell_side_km)
        if len(candidates) <= strategy["minCores"]:
            break

    # Combine vertex candidates with centroid candidates
    all_candidates = vertex_candidates + candidates

    # Sort retained candidates into serpentine order
    def serpentine_compare(a, b):
        # Vertices go to the beginning and stay in discovery order
        if a.get("is_vertex") and not b.get("is_vertex"):
            return -1
        if not a.get("is_vertex") and b.get("is_vertex"):
            return 1
        if a.get("is_vertex") and b.get("is_vertex"):
            # Sort vertices by column then by latitude
            if a.get("col", -1) != b.get("col", -1):
                return -1  # Keep discovery order for vertices
            return 0

        # Regular centroid sorting by serpentine pattern
        if a["col"] != b["col"]:
            return a["col"] - b["col"]
        if a["col"] % 2 == 0:
            return a["lat"] - b["lat"]
        return b["lat"] - a["lat"]

    all_candidates.sort(key=cmp_to_key(serpentine_compare))

    if not all_candidates:
        # Fallback: random points within polygon
        pts = []
        attempts = 0
        while len(pts) < target_cores and attempts < 5000:
            pt = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
            if poly.contains(pt):
                pts.append([pt.y, pt.x])
            attempts += 1
        return pts

    # If candidate count exceeds the hard cap, subsample by every Nth serpentine point
    if len(all_candidates) > MAX_POINTS_PER_ZONE:
        step = math.ceil(len(all_candidates) / MAX_POINTS_PER_ZONE)
        all_candidates = [all_candidates[i] for i in range(0, len(all_candidates), step)]

    # Respect minCores when possible, otherwise accept the available centroid count
    if len(all_candidates) < strategy["minCores"] and len(all_candidates) < target_cores:
        pts = [[c["lat"], c["lng"]] for c in all_candidates]
        attempts = 0
        while len(pts) < min(target_cores, strategy["minCores"]) and attempts < 5000:
            pt = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
            if poly.contains(pt):
                pts.append([pt.y, pt.x])
            attempts += 1
        return pts

    return [[c["lat"], c["lng"]] for c in all_candidates[:MAX_POINTS_PER_ZONE]]


def build_zones(drawn_polygon: Polygon, total_area_ha: float, num_zones: int, strategy: dict, sampling_mode: str) -> \
list[dict]:
    """
    Build exactly num_zones zones.
    If the drawn polygon is an axis-aligned rectangle, use a perfect square grid.
    Otherwise fall back to the recursive polygon split.
    """
    density_factor = 0.5 if sampling_mode == "economic" else 1.0
    zones = []

    if num_zones == 1:
        points = generate_points(drawn_polygon, total_area_ha, strategy, density_factor, is_single_zone=True)
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

    def choose_row_counts(num_zones: int, width: float, height: float) -> list[int]:
        best = None
        best_counts = [num_zones]
        for rows in range(1, num_zones + 1):
            base = num_zones // rows
            if base == 0:
                break
            extra = num_zones % rows
            counts = [base + 1] * extra + [base] * (rows - extra)
            heights = [height * count / num_zones for count in counts]
            distortions = []
            for count, row_height in zip(counts, heights):
                cell_width = width / count
                if row_height <= 0:
                    distortions.append(float('inf'))
                else:
                    distortions.append(max(cell_width / row_height, row_height / cell_width))
            score = max(distortions)
            if best is None or score < best:
                best = score
                best_counts = counts
        return best_counts

    def split_rectangle_into_squares(poly: Polygon, zones_needed: int, total_area_ha: float) -> list[Polygon]:
        minx, miny, maxx, maxy = poly.bounds
        width = maxx - minx
        height = maxy - miny

        row_counts = choose_row_counts(zones_needed, width, height)
        y0 = miny
        squares = []
        for count in row_counts:
            row_height = height * count / zones_needed
            x0 = minx
            for _ in range(count):
                x1 = x0 + width / count
                y1 = y0 + row_height
                squares.append(box(x0, y0, x1, y1))
                x0 = x1
            y0 = y1

        return squares

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

    minx, miny, maxx, maxy = drawn_polygon.bounds
    bbox_rectangle = box(minx, miny, maxx, maxy)
    if drawn_polygon.equals(bbox_rectangle):
        zone_polygons = split_rectangle_into_squares(drawn_polygon, num_zones, total_area_ha)
    else:
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
    num_zones = compute_num_zones(total_area_ha, strategy, sampling_mode, crop_type)
    zones = build_zones(drawn_polygon, total_area_ha, num_zones, strategy, sampling_mode)

    return {
        "totalAreaHa": total_area_ha,
        "soilData": soil_data,
        "zones": zones,
        "strategy": strategy,
        "mode": sampling_mode
    }