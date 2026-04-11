from shapely.geometry import Polygon, MultiPolygon, shape
from shapely.ops import unary_union


def safe_intersect(poly_a: Polygon, poly_b: Polygon) -> Polygon | None:
    """
    Exact logic match for JS safeIntersect.
    Handles MultiPolygon results by returning the largest single polygon.
    """
    try:
        intersection = poly_a.intersection(poly_b)
    except Exception:
        return None

    if intersection.is_empty:
        return None

    if isinstance(intersection, MultiPolygon):
        # Return the largest polygon (same as JS reduce)
        return max(intersection.geoms, key=lambda p: p.area)

    return intersection if isinstance(intersection, Polygon) else None