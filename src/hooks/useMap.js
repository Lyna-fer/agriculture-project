import { useEffect, useRef, useState, useCallback } from "react";

export function useMap({ onParcelleChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const sampleMarkersRef = useRef([]);
  const zoneLayersRef = useRef([]);
  const parcelleLayerRef = useRef(null);
  const drawControlRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [36.5, 3.0],
      zoom: 6,
      zoomControl: false,
      maxZoom: 18,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Esri, USDA, USGS | SolGuide",
        maxZoom: 18,
        maxNativeZoom: 19,
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      },
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        maxNativeZoom: 19,
        opacity: 0.7,
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      },
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems, remove: true },
      draw: {
        polygon: {
          shapeOptions: {
            color: "#4a7c2f",
            fillColor: "#6ab04c",
            fillOpacity: 0.22,
            weight: 2.5,
          },
          allowIntersection: false,
        },
        rectangle: {
          shapeOptions: {
            color: "#4a7c2f",
            fillColor: "#6ab04c",
            fillOpacity: 0.22,
            weight: 2.5,
          },
        },
        marker: {
          icon: L.divIcon({
            className: "",
            html: '<div style="width:18px;height:18px;background:#4a7c2f;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        },
        circle: false,
        circlemarker: false,
        polyline: false,
      },
    });

    map.addControl(drawControl);
    drawControlRef.current = drawControl;

    setTimeout(() => {
      const toolbar = document.querySelector(".leaflet-draw");
      if (toolbar) toolbar.style.display = "none";
    }, 100);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      clearSampleMarkers();
      parcelleLayerRef.current = e.layer;
      drawnItems.addLayer(e.layer);

      if (e.layerType === "polygon" || e.layerType === "rectangle") {
        const stats = computeStats(e.layer);
        onParcelleChange({ type: e.layerType, layer: e.layer, ...stats });
        const bounds = e.layer.getBounds();
        let zoom = map.getBoundsZoom(bounds);
        zoom = Math.min(zoom, 19);
        map.setView(bounds.getCenter(), zoom);
      } else {
        onParcelleChange({
          type: "marker",
          layer: e.layer,
          area: 0,
          perim: 0,
          coords: null,
        });
      }
    });

    mapInstanceRef.current = map;
    setMapReady(true);
  }, []);

  const computeStats = (layer) => {
    const turf = window.turf;
    const latlngs = layer.getLatLngs().flat(2);
    const coords = latlngs.map((ll) => [ll.lng, ll.lat]);
    coords.push(coords[0]);
    const polygon = turf.polygon([coords]);
    const areaM2 = turf.area(polygon);
    const areaHa = areaM2 / 10000;
    const line = turf.lineString(coords);
    const perimM = turf.length(line, { units: "kilometers" }) * 1000;
    const bounds = layer.getBounds();
    return {
      area: areaHa,
      areaM2,
      perim: perimM,
      latlngs,
      bounds: {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      },
    };
  };

  const clearSampleMarkers = () => {
    if (!mapInstanceRef.current) return;
    sampleMarkersRef.current.forEach((m) => m.remove());
    sampleMarkersRef.current = [];
  };

  const cancelDraw = useCallback(() => {
    const drawControl = drawControlRef.current;
    if (!drawControl) return;
    try {
      Object.values(drawControl._toolbars).forEach((toolbar) => {
        if (toolbar._activeMode && toolbar._activeMode.handler) {
          toolbar._activeMode.handler.disable();
        }
      });
    } catch (e) {
      const mapContainer = mapInstanceRef.current?.getContainer();
      if (mapContainer) {
        const escEvent = new KeyboardEvent("keydown", {
          key: "Escape",
          keyCode: 27,
          which: 27,
          bubbles: true,
        });
        mapContainer.dispatchEvent(escEvent);
        document.dispatchEvent(escEvent);
      }
    }
  }, []);

  // ✅ NEW: Draw a polygon programmatically from lat/lng coordinates
  const drawParcelleFromLatLngs = useCallback((latlngs, color = "#4a7c2f") => {
    const L = window.L;
    const map = mapInstanceRef.current;
    const drawnItems = drawnItemsRef.current;

    if (!map || !L || !drawnItems || !latlngs || latlngs.length < 3) {
      console.warn("drawParcelleFromLatLngs: missing dependencies");
      return null;
    }

    try {
      // Clear existing drawn items
      drawnItems.clearLayers();
      clearSampleMarkers();

      // Create polygon from lat/lng array
      const polygon = L.polygon(latlngs, {
        color: color,
        fillColor: color,
        fillOpacity: 0.22,
        weight: 2.5,
      });

      // Add to map and drawnItems (so it behaves like a user-drawn parcelle)
      drawnItems.addLayer(polygon);
      parcelleLayerRef.current = polygon;

      // Fit map to parcelle bounds
      const bounds = polygon.getBounds();
      const zoom = Math.min(map.getBoundsZoom(bounds), 19);
      map.setView(bounds.getCenter(), zoom);

      // Compute and return stats (so UI can update)
      const stats = computeStats(polygon);

      console.log(`✅ Drew parcelle with ${latlngs.length} points`);
      return stats;
    } catch (error) {
      console.error("❌ Error drawing parcelle from latlngs:", error);
      return null;
    }
  }, []);

  const placeSamplePoints = useCallback((zones, color) => {
    console.log(
      "placeSamplePoints called with",
      zones.length,
      "zones and color",
      color,
    );
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !L) {
      console.log("placeSamplePoints: early return - missing map or L");
      return;
    }

    clearSampleMarkers();
    let totalMarkers = 0;

    zones.forEach((zone) => {
      const points = zone.points || [];

      if (points.length > 1) {
        try {
          const polyline = L.polyline(points, {
            color: color,
            weight: 1.5,
            opacity: 0.8,
            dashArray: "3,4",
          }).addTo(map);
          sampleMarkersRef.current.push(polyline);
          console.log(
            `Zone ${zone.id}: drew pattern line with ${points.length} points`,
          );
        } catch (e) {
          console.error(`Error drawing pattern line for zone ${zone.id}:`, e);
        }
      }

      points.forEach((pt, idx) => {
        try {
          const pointNum = idx + 1;
          const icon = L.divIcon({
            className: "",
            html: `<div style="
  width:16px; height:16px;
  background:rgba(255,255,255,0.9);
  border:1.5px solid ${color};
  color:${color};
  border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:0.65rem; font-family:'Geist Mono',monospace;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.4);
">${pointNum}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });

          const marker = L.marker(pt, { icon })
            .addTo(map)
            .bindPopup(
              `<b>${zone.id} - Point ${pointNum}</b><br>
          Prélèvement n°${pointNum} / ${points.length}<br>
          <span style="color:#7a5230;font-size:0.75rem">Lat: ${pt[0].toFixed(5)}, Lng: ${pt[1].toFixed(5)}</span>`,
            );

          sampleMarkersRef.current.push(marker);
          totalMarkers++;
        } catch (e) {
          console.error(
            "Error creating marker for zone point",
            zone.id,
            idx,
            e,
          );
        }
      });
    });

    console.log(
      "placeSamplePoints: created",
      totalMarkers,
      "markers across all zones",
    );
  }, []);

  const activateDrawTool = useCallback(
    (tool) => {
      if (!tool) {
        cancelDraw();
        return;
      }
      const btn = document.querySelector(`.leaflet-draw-draw-${tool}`);
      if (btn) btn.click();
    },
    [cancelDraw],
  );

  const clearAll = useCallback(() => {
    cancelDraw();
    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();
    clearSampleMarkers();
    parcelleLayerRef.current = null;
  }, [cancelDraw]);

  const flyToWilaya = useCallback((wilaya) => {
    if (!mapInstanceRef.current) return;
    const zoomByZone = {
      humide: 12,
      subhumide: 11,
      "semi-aride": 11,
      aride: 10,
      saharienne: 9,
    };
    const zoom = zoomByZone[wilaya.zone] ?? 11;
    mapInstanceRef.current.flyTo([wilaya.lat, wilaya.lng], zoom, {
      animate: true,
      duration: 1.2,
    });
  }, []);

  const clearZones = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    zoneLayersRef.current.forEach((layer) => map.removeLayer(layer));
    zoneLayersRef.current = [];
  }, []);

  const displayZones = useCallback(
    (zones, mode) => {
      const L = window.L;
      const map = mapInstanceRef.current;
      if (!map || !L || !zones || zones.length === 0) {
        console.log("displayZones: early return", {
          hasMap: !!map,
          hasL: !!L,
          hasZones: !!zones,
          zone_count: zones?.length,
        });
        return;
      }

      console.log("displayZones called with", zones.length, "zones");

      try {
        clearZones();
      } catch (e) {
        console.error("Error clearing zones:", e);
      }

      const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];

      zones.forEach((zone, idx) => {
        try {
          if (!zone.geoJson) {
            console.warn(`Zone ${idx}: no geoJson`);
            return;
          }
          if (!zone.geoJson.geometry) {
            console.warn(`Zone ${idx}: no geometry`);
            return;
          }
          if (zone.geoJson.geometry.type !== "Polygon") {
            console.warn(
              `Zone ${idx}: geometry type is ${zone.geoJson.geometry.type}, not Polygon`,
            );
            return;
          }

          const coords = zone.geoJson.geometry.coordinates[0];
          if (!coords || coords.length === 0) {
            console.warn(`Zone ${idx}: no coordinates`);
            return;
          }

          const latlngs = coords.map((c) => [c[1], c[0]]);

          const polyline = L.polyline(latlngs, {
            color: colors[idx % colors.length],
            weight: 2.5,
            opacity: 0.7,
            dashArray: "5,5",
          }).addTo(map);

          zoneLayersRef.current.push(polyline);

          const bounds = polyline.getBounds();
          const center = bounds.getCenter();
          const popup = `<b>${zone.id}</b><br>${zone.area} ha<br>${zone.points?.length || 0} pts`;
          const marker = L.marker(center, {
            icon: L.divIcon({
              className: "",
              html: `<div style="
              background: ${colors[idx % colors.length]};
              color: white;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
              font-family: monospace;
             box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 2px rgba(255,255,255,0.3);
              white-space: nowrap;
            ">${zone.id}</div>`,
              iconSize: [60, 28],
              iconAnchor: [30, 14],
            }),
          })
            .addTo(map)
            .bindPopup(popup);

          zoneLayersRef.current.push(marker);
          console.log(`Zone ${idx} (${zone.id}) rendered successfully`);
        } catch (e) {
          console.error(`Error rendering zone ${idx}:`, e, zone);
        }
      });
      console.log(
        "displayZones complete, total layers:",
        zoneLayersRef.current.length,
      );
    },
    [clearZones],
  );

  return {
    mapRef,
    mapReady,
    placeSamplePoints,
    displayZones,
    clearZones,
    activateDrawTool,
    clearAll,
    flyToWilaya,
    drawParcelleFromLatLngs, // ✅ NEW: Expose this function
  };
}