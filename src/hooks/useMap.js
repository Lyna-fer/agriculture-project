import { useEffect, useRef, useState, useCallback } from "react";
import { getPatternPoints } from "../data/cultures";

export function useMap({ onParcelleChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const sampleMarkersRef = useRef([]);
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
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Esri, USDA, USGS | SolGuide",
        maxZoom: 19,
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      },
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
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
        map.fitBounds(e.layer.getBounds(), { padding: [40, 40] });
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
    // const latlngs = layer.getLatLngs()[0];
    const latlngs = layer.getLatLngs().flat(2);
    const coords = latlngs.map((ll) => [ll.lng, ll.lat]);
    coords.push(coords[0]);
    const polygon = turf.polygon([coords]);
    const areaM2 = turf.area(polygon);
    const areaHa = areaM2 / 10000;
    const line = turf.lineString(coords);
    // const perimM = turf.length(line, { units: "meters" });
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
    // sampleMarkersRef.current.forEach((m) =>
    //   mapInstanceRef.current.removeLayer(m),
    // );
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

  const placeSamplePoints = useCallback((n, pattern, color, bounds) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    clearSampleMarkers();
    const points = getPatternPoints(pattern, n, bounds);
    // if (points.length) {
    //   map.fitBounds(points, { padding: [40, 40] });
    // }
    const markers = points.map((pt, i) => {
      const icon = L.divIcon({
        className: "",

        html: `<div style="
  width:26px; height:26px;
  background:rgba(255,255,255,0.9);
  border:1.5px solid ${color};
  color:${color};
  border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:0.65rem; font-family:'Geist Mono',monospace;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.4);
">${i + 1}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      return L.marker(pt, { icon })
        .addTo(map)
        .bindPopup(
          `<b>Point ${i + 1}</b><br>
          Prélèvement n°${i + 1} / ${points.length}<br>
          <span style="color:#7a5230;font-size:0.75rem">Lat: ${pt[0].toFixed(5)}, Lng: ${pt[1].toFixed(5)}</span>`,
        );
    });

    sampleMarkersRef.current = markers;
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
    mapInstanceRef.current.flyTo([wilaya.lat, wilaya.lng], 10, {
      animate: true,
      duration: 1.2,
    });
  }, []);

  return {
    mapRef,
    mapReady,
    placeSamplePoints,
    activateDrawTool,
    clearAll,
    flyToWilaya,
  };
}
