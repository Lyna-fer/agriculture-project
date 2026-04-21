from __future__ import annotations

from datetime import datetime, timezone
from xml.sax.saxutils import escape


def _kml_point(name: str, lat: float, lng: float, zone_name: str | None = None) -> str:
    title = escape(name)
    zone_label = f"<description>{escape(zone_name)}</description>" if zone_name else ""
    return (
        "<Placemark>"
        f"<name>{title}</name>"
        f"{zone_label}"
        "<Point>"
        f"<coordinates>{lng:.8f},{lat:.8f},0</coordinates>"
        "</Point>"
        "</Placemark>"
    )


def build_sampling_kml(zones: list[dict], parcelle_name: str = "Sampling points") -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    document_name = escape(parcelle_name or "Sampling points")

    folders: list[str] = []
    point_count = 0

    for zone_index, zone in enumerate(zones or [], start=1):
        zone_name = zone.get("id") or f"Zone {zone_index}"
        placemarks: list[str] = []
        for point_index, point in enumerate(zone.get("points", []), start=1):
            if not point or len(point) < 2:
                continue
            lat, lng = point[0], point[1]
            placemarks.append(_kml_point(f"Z{zone_index}-{point_index}", lat, lng, zone_name))
            point_count += 1

        folders.append(
            "<Folder>"
            f"<name>{escape(zone_name)}</name>"
            + "".join(placemarks)
            + "</Folder>"
        )

    kml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<kml xmlns="http://www.opengis.net/kml/2.2">'
        '<Document>'
        f'<name>{document_name}</name>'
        f'<description>Generated {escape(now)} · {point_count} points</description>'
        + "".join(folders)
        + "</Document></kml>"
    )
    return kml
