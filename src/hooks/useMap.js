import { useEffect, useRef, useState, useCallback } from "react";

export function useMap({ onParcelleChange, maxParcelAreaHa = 50, onParcelleClick = null }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const sampleMarkersRef = useRef([]);
  const zoneLayersRef = useRef([]);
  const parcelleLayerRef = useRef(null);
  const parcelleLayersRef = useRef({});
  const parcelleLabelLayersRef = useRef({});
  const currentZoomRef = useRef(10);
  const MIN_ZOOM_FOR_MARKERS = 13;
  const drawControlRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const getParcelLabelFontSize = useCallback((zoom) => {
    const clampedZoom = Math.max(MIN_ZOOM_FOR_MARKERS, Math.min(zoom, 18));
    const ratio = (clampedZoom - MIN_ZOOM_FOR_MARKERS) / (18 - MIN_ZOOM_FOR_MARKERS || 1);
    const size = 15 - ratio * 4;
    return `${Math.max(11, size).toFixed(1)}px`;
  }, []);

  const createParcelLabelIcon = useCallback((parcel, zoom) => {
    const L = window.L;
    if (!L) return null;

    return L.divIcon({
      className: " ",
      html: `<div style="
        position: relative;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: max-content;
        padding: 0;
        border-radius: 0;
        font-size: ${getParcelLabelFontSize(zoom)};
        font-weight: 700;
        font-family: system-ui, sans-serif;
        line-height: 1;
        white-space: nowrap;
        text-shadow: 0 2px 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9);
        box-sizing: border-box;
      ">${parcel.name || `Parcel #${parcel.id}`}</div>`,
      iconSize: [1, 1],
      iconAnchor: [0, 0],
    });
  }, [getParcelLabelFontSize]);

  const syncParcelLabelsWithZoom = useCallback(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    const shouldShow = map.getZoom() >= MIN_ZOOM_FOR_MARKERS;

    Object.entries(parcelleLabelLayersRef.current).forEach(([parcelId, layer]) => {
      const parcel = parcelleLayersRef.current[parcelId]?._parcelMeta;
      if (!parcel) return;

      if (!shouldShow) {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        return;
      }

      layer.setIcon(createParcelLabelIcon(parcel, map.getZoom()));
      if (!map.hasLayer(layer)) map.addLayer(layer);
    });
  }, [createParcelLabelIcon]);

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
            className: " ",
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
        if (stats.area > maxParcelAreaHa) {
          drawnItems.clearLayers();
          parcelleLayerRef.current = null;
          onParcelleChange({ type: "oversize", limitHa: maxParcelAreaHa, ...stats });
          return;
        }
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

    map.on("zoomend", () => {
      currentZoomRef.current = map.getZoom();
      toggleMarkersByZoom();
      syncParcelLabelsWithZoom();
    });

    mapInstanceRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const refreshSize = () => {
      try {
        map.invalidateSize({ pan: false, animate: false });
      } catch (e) {
        console.warn("Map resize refresh failed:", e);
      }
    };

    const rafId = window.requestAnimationFrame(refreshSize);
    window.addEventListener("resize", refreshSize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", refreshSize);
    };
  }, [mapReady]);

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
    // mark sampling as not visible and restore parcel labels according to zoom
    try {
      samplingVisibleRef.current = false;
      const map = mapInstanceRef.current;
      if (map) {
        const shouldShow = map.getZoom() >= MIN_ZOOM_FOR_MARKERS;
        Object.values(parcelleLabelLayersRef.current).forEach((layer) => {
          if (shouldShow && !map.hasLayer(layer)) map.addLayer(layer);
          if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
        });
      }
    } catch (e) {
      console.warn("Could not restore parcel labels:", e);
    }
  };

  const samplingMarkersRef = useRef([]);
  const samplingVisibleRef = useRef(false);

  const drawAllParcelles = useCallback((parcelles, selectedParcelleId) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    Object.values(parcelleLayersRef.current).forEach((layer) => {
      map.removeLayer(layer);
    });
    parcelleLayersRef.current = {};

    Object.values(parcelleLabelLayersRef.current).forEach((layer) => {
      map.removeLayer(layer);
    });
    parcelleLabelLayersRef.current = {};

    parcelles.forEach((parcel) => {
      if (!parcel.latlngs || parcel.latlngs.length < 3) return;

      const isSelected = parcel.id === selectedParcelleId;
      const polygon = L.polygon(parcel.latlngs, {
        color: parcel.color || "#4a7c2f",
        fillColor: parcel.color || "#4a7c2f",
        fillOpacity: isSelected ? 0.3 : 0.15,
        weight: isSelected ? 4 : 2,
        opacity: 0.8,
      });
      polygon._parcelMeta = parcel;

      polygon.bindPopup(`
        <b>${parcel.name || `Parcel #${parcel.id}`}</b><br>
        Area: ${(parcel.area / 10000).toFixed(2)} ha
      `);

      polygon.addTo(map);
      parcelleLayersRef.current[parcel.id] = polygon;

      const bounds = polygon.getBounds();
      const center = bounds.getCenter();
      const label = L.marker(center, {
        interactive: true,
        keyboard: false,
        zIndexOffset: 1000,
        icon: createParcelLabelIcon(parcel, map.getZoom()),
      }).addTo(map);

      // Bind click handlers so clicking polygon or its label can notify the app
      try {
        polygon.on && polygon.on('click', () => {
          if (typeof onParcelleClick === 'function') onParcelleClick(parcel.id);
          try { if (mapRef && mapRef.current) mapRef.current.dispatchEvent(new CustomEvent('parcelle-click', { detail: { id: parcel.id } })); } catch(e){}
        });
        label.on && label.on('click', () => {
          if (typeof onParcelleClick === 'function') onParcelleClick(parcel.id);
          try { if (mapRef && mapRef.current) mapRef.current.dispatchEvent(new CustomEvent('parcelle-click', { detail: { id: parcel.id } })); } catch(e){}
        });
      } catch (e) {
        console.warn('Could not bind parcel click handlers', e);
      }

      parcelleLabelLayersRef.current[parcel.id] = label;
      if (map.getZoom() < MIN_ZOOM_FOR_MARKERS) {
        map.removeLayer(label);
      }
    });
  }, []);

  const clearAllParcelles = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(parcelleLayersRef.current).forEach((layer) => {
      map.removeLayer(layer);
    });
    parcelleLayersRef.current = {};

    Object.values(parcelleLabelLayersRef.current).forEach((layer) => {
      map.removeLayer(layer);
    });
    parcelleLabelLayersRef.current = {};
  }, []);

  const toggleMarkersByZoom = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const shouldShow = map.getZoom() >= MIN_ZOOM_FOR_MARKERS;

    sampleMarkersRef.current.forEach((layer) => {
      if (shouldShow && !map.hasLayer(layer)) map.addLayer(layer);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    });

    zoneLayersRef.current.forEach((layer) => {
      if (shouldShow && !map.hasLayer(layer)) map.addLayer(layer);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    });

    Object.values(parcelleLabelLayersRef.current).forEach((layer) => {
      if (shouldShow && !map.hasLayer(layer)) map.addLayer(layer);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    });
  }, []);

  const clearSamplingMarkers = useCallback(() => {
    if (!mapInstanceRef.current) return;
    samplingMarkersRef.current.forEach((m) => mapInstanceRef.current.removeLayer(m));
    samplingMarkersRef.current = [];
  }, []);

  const setSamplingMarkers = useCallback((points, onMark) => {
    clearSamplingMarkers();
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    const currentZoom = map.getZoom();
    currentZoomRef.current = currentZoom;
    if (currentZoom < MIN_ZOOM_FOR_MARKERS) return;

    points.forEach((point, index) => {
      const marker = L.marker([point[0], point[1]], {
        icon: L.divIcon({
          className: " ",
          html: `<div style="background: red; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${index + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map);
      if (typeof onMark === "function") {
        marker.on("click", () => onMark(index));
      }
      samplingMarkersRef.current.push(marker);
    });
  }, []);

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

  // ✅ Draw a polygon programmatically from lat/lng coordinates
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

  const clearSelectedParcelle = useCallback(() => {
    if (drawnItemsRef.current) drawnItemsRef.current.clearLayers();
    parcelleLayerRef.current = null;
  }, []);

  const placeSamplePoints = useCallback((zones, color) => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    const currentZoom = map.getZoom();
    currentZoomRef.current = currentZoom;
    if (currentZoom < MIN_ZOOM_FOR_MARKERS) {
      clearSampleMarkers();
      return;
    }

    clearSampleMarkers();
    zones.forEach((zone, zoneIdx) => {
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
            className: " ",
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
            .bindPopup(`
              <b>${zone.id} - Point ${pointNum}</b><br>
              Sample #${pointNum} / ${points.length}<br>
              <span style="color:#7a5230;font-size:0.75rem">Lat: ${pt[0].toFixed(5)}, Lng: ${pt[1].toFixed(5)}</span>
            `);

          sampleMarkersRef.current.push(marker);
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

    // mark sampling visible and hide parcel labels while samples are shown
    try {
      samplingVisibleRef.current = true;
      const map = mapInstanceRef.current;
      if (map) {
        Object.values(parcelleLabelLayersRef.current).forEach((layer) => {
          if (map.hasLayer(layer)) map.removeLayer(layer);
        });
      }
    } catch (e) {
      console.warn("Could not hide parcel labels:", e);
    }

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
    clearSamplingMarkers();
    clearAllParcelles();
    parcelleLayerRef.current = null;
  }, [cancelDraw, clearAllParcelles]);

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

      const currentZoom = map.getZoom();
      currentZoomRef.current = currentZoom;
      if (currentZoom < MIN_ZOOM_FOR_MARKERS) {
        return;
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
              className: " ",
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

  const getMapSnapshot = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return null;
    const bounds = map.getBounds();
    const size = map.getSize();
    return {
      bounds: {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast(),
      },
      size: {
        width: Math.max(640, Math.round(size.x || 0)),
        height: Math.max(420, Math.round(size.y || 0)),
      },
      zoom: map.getZoom(),
      center: map.getCenter(),
    };
  }, []);

  return {
    mapRef,
    mapReady,
    placeSamplePoints,
    clearSampleMarkers,
    displayZones,
    clearZones,
    activateDrawTool,
    clearAll,
    getMapSnapshot,
    flyToWilaya,
    drawParcelleFromLatLngs,
    drawAllParcelles,
    clearAllParcelles,
    clearSelectedParcelle,
    setSamplingMarkers,
    clearSamplingMarkers,
  };
}
