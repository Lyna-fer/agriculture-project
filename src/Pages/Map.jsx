import React, { useState, useCallback, useRef, useEffect } from "react";
import "../styles/map.css";
// import Navbar from '../components/map/Navbar';
import LeftPanel from "../components/map/LeftPanel";
import MapView from "../components/map/MapView";
import ResultsPanel from "../components/map/ResultsPanel";
import Toast from "../components/map/Toast";
import { useMap } from "../hooks/useMap";
import { CULTURES } from "../data/cultures";
import {
  generatePoints,
  buildZones,
  computePreview,
  computeNumZones,
  CROP_STRATEGIES,
  authenticateGEE,
} from "../lib/samplingEngine";

// Mapping from CULTURES.id to CROP_STRATEGIES key
const CULTURES_TO_STRATEGIES = {
  1: "vegetables", // Maraîchères
  2: "cereals", // Céréalières
  3: "trees", // Arbres
};

const FIELD_COLORS = [
  "#2ecc71",
  "#3b82f6",
  "#e6970a",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
  "#ef4444",
];
let colorIdx = 0;
const nextColor = () => FIELD_COLORS[colorIdx++ % FIELD_COLORS.length];

export default function Map() {
  useEffect(() => {
    document.body.className = "page-map";
  }, []);

  const [parcelles, setParcelles] = useState([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState(null);

  const [pendingParcelleInfo, setPendingParcelleInfo] = useState(null);
  const [pendingColor, setPendingColor] = useState("#2ecc71");

  const [parcelleInfo, setParcelleInfo] = useState(null);

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [samplingMode, setSamplingMode] = useState("standard"); // 'standard' or 'economic'
  const [activeTool, setActiveTool] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [toast, setToast] = useState({ msg: "", visible: false });
  const [geeReady, setGeeReady] = useState(false);
  const toastTimer = useRef(null);

  // Initialize GEE on mount
  useEffect(() => {
    (async () => {
      try {
        await authenticateGEE();
        setGeeReady(true);
        showToast("✅ Google Earth Engine authenticated");
      } catch (err) {
        console.log("GEE auth skipped:", err.message);
        // Non-blocking: GEE is optional for preview mode
      }
    })();
  }, []);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      3200,
    );
  }, []);

  const handleParcelleChange = useCallback(
    (info) => {
      if (info.type === "marker") {
        showToast(
          "📍 Marqueur posé — dessinez un polygone pour calculer la surface",
        );
        return;
      }

      const color = nextColor();
      setActiveTool(null);
      setPendingParcelleInfo(info);
      setPendingColor(color);
      setParcelleInfo(info);
      setResultsOpen(false);
      const ha = info.area || 0;
      showToast(
        `✅ Parcelle tracée — ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Donnez-lui un nom`,
      );
    },
    [showToast],
  );

  const {
    mapRef,
    placeSamplePoints,
    activateDrawTool,
    clearAll,
    flyToWilaya,
    displayZones,
    clearZones,
  } = useMap({
    onParcelleChange: handleParcelleChange,
  });

  const handleActivateTool = useCallback(
    (tool) => {
      setActiveTool(tool);
      if (tool) {
        activateDrawTool(tool);
        setPendingParcelleInfo(null);
        setResultsOpen(false);
      } else {
        activateDrawTool(null);
      }
    },
    [activateDrawTool],
  );

  const handleSaveParcelle = useCallback(
    ({ name, groupId }) => {
      if (!pendingParcelleInfo) return;

      const newP = {
        id: Date.now(),
        name,
        area: (pendingParcelleInfo.area || 0) * 10000, // ha → m²
        color: pendingColor,
        groupId,
        bounds: pendingParcelleInfo.bounds,
        latlngs: pendingParcelleInfo.latlngs,
      };

      setParcelles((prev) => [...prev, newP]);
      setSelectedParcelleId(newP.id);
      setSelectedGroupId(groupId);
      setPendingParcelleInfo(null);
      setResultsOpen(false);

      showToast(`✅ ${name} enregistrée`);
    },
    [pendingParcelleInfo, pendingColor, showToast],
  );

  const handleCancelDraw = useCallback(() => {
    setActiveTool(null);
    activateDrawTool(null);
    setPendingParcelleInfo(null);

    if (!parcelles.length) {
      clearAll();
      setParcelleInfo(null);
    }
    showToast("✕ Dessin annulé");
  }, [activateDrawTool, clearAll, parcelles.length, showToast]);

  const handleClearAll = useCallback(() => {
    clearAll();
    clearZones(); // 👈 This wipes the dashed boxes!
    setParcelles([]);
    setSelectedParcelleId(null);
    setParcelleInfo(null);
    setPendingParcelleInfo(null);
    setSelectedGroupId(null);
    setActiveTool(null);
    setResultsOpen(false);
    showToast("🗑 Tout effacé");
  }, [clearAll, clearZones, showToast]);

  const handleSelectParcelle = useCallback(
    (id) => {
      setSelectedParcelleId(id);
      const p = parcelles.find((x) => x.id === id);

      if (p) setSelectedGroupId(p.groupId || selectedGroupId);
      setResultsOpen(false);
    },
    [parcelles, selectedGroupId],
  );

  const handleDeleteParcelle = useCallback(
    (id) => {
      setParcelles((prev) => prev.filter((p) => p.id !== id));
      if (selectedParcelleId === id) {
        setSelectedParcelleId(null);
        setParcelleInfo(null);
        setResultsOpen(false);
      }
      showToast("🗑 Parcelle supprimée");
    },
    [selectedParcelleId, showToast],
  );

  const handleGroupChange = useCallback(
    (groupId) => {
      setSelectedGroupId(groupId);
      setResultsOpen(false);
      const c = CULTURES.find((c) => c.id === groupId);
      if (c) showToast(`${c.iconEmoji} ${c.nameShort} sélectionné`);
    },
    [showToast],
  );

  const handleAnalyze = useCallback(async () => {
    console.log("handleAnalyze: started");
    if (!parcelleInfo || !selectedGroupId) {
      showToast("❌ Info manquante");
      return;
    }

    const culture = CULTURES.find((c) => c.id === selectedGroupId);
    const cropType = CULTURES_TO_STRATEGIES[selectedGroupId];
    const turf = window.turf;

    if (!culture || !cropType || !turf) return;

    // 1. Build the Polygon
    const coords = parcelleInfo.latlngs.map((ll) => [ll.lng, ll.lat]);
    coords.push(coords[0]);
    const drawnPolygon = turf.polygon([coords]);
    const totalAreaHa = turf.area(drawnPolygon) / 10000;

    if (totalAreaHa < 0.05) {
      showToast(`❌ Surface trop petite (${totalAreaHa.toFixed(3)} ha)`);
      return;
    }

    // 2. Perform the Agronomic Math (Frontend calculates zigzags and slices)
    const strategy = CROP_STRATEGIES[cropType];
    const activeParcelle = parcelles.find(p => p.id === selectedParcelleId);
    const parcelleName = activeParcelle ? activeParcelle.name : "Nouvelle Parcelle";
    
    // Turf.js slices the field into zones and generates points
    const numZones = computeNumZones(totalAreaHa, strategy, samplingMode);
    const zones = buildZones(drawnPolygon, totalAreaHa, numZones, strategy, samplingMode);
    const numZones = computeNumZones(totalAreaHa, strategy, samplingMode);

    console.log(
      "handleAnalyze: strategy =",
      cropType,
      "numZones =",
      numZones,
      "samplingMode =",
      samplingMode,
    );

    // Build zones and generate all points
    const zones = buildZones(
      drawnPolygon,
      totalAreaHa,
      numZones,
      strategy,
      samplingMode,
    );

    console.log(
      "handleAnalyze: buildZones returned",
      zones.length,
      "zones",
      zones,
    );

    // Flatten all points from all zones
    const allPoints = zones.flatMap((zone) => zone.points || []);

    if (allPoints.length === 0) {
      showToast("❌ Erreur génération points");
      return;
    }

    // 3. Package the calculated zones for Python
    const zonesPayload = zones.map(z => ({
      zone_name: z.id,
      points: z.points // Array of [lat, lng]
    }));

    showToast("⏳ Envoi à PostGIS...");

<<<<<<< HEAD
    // 4. Send to Database
    try {
      const response = await fetch('http://127.0.0.1:8000/api/generate-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmer_id: 1, 
          parcelle_name: parcelleName,
          surface_ha: parseFloat(totalAreaHa.toFixed(2)),
          polygon_geojson: {
            type: "Polygon",
            coordinates: drawnPolygon.geometry.coordinates,
          },
          crop_name: cropType,
          zones:zonesPayload // Send the exact calculated zones
        })
      });
=======
    console.log("handleAnalyze: setting resultsOpen to true");
    setResultsOpen(true);

    const modeLabel = samplingMode === "economic" ? "économique" : "standard";
    showToast(
      `🔬 ${allPoints.length} points (${numZones} zone${numZones > 1 ? "s" : ""} · mode ${modeLabel})`,
    );

    console.log("handleAnalyze: complete");
  }, [
    parcelleInfo,
    selectedGroupId,
    samplingMode,
    placeSamplePoints,
    displayZones,
    showToast,
  ]);
>>>>>>> 75b4829a424e54337969bf136775739e90ffe53f

      // Catch strict FastAPI errors (like Pydantic 422s)
      if (!response.ok) {
          const errData = await response.text();
          console.error("API failed:", errData);
          showToast("❌ Erreur API Python (Voir console)");
          return;
      }

      const data = await response.json();

      // 5. Update the UI with the exact zones React originally calculated
      if (data.status === "success") {
        displayZones(zones, samplingMode);
        placeSamplePoints(zones, culture.color);
        setResultsOpen(true); 
        
        const modeLabel = samplingMode === "economic" ? "économique" : "standard";
        showToast(`🔬 ${allPoints.length} points sauvegardés dans ${zones.length} zone(s) ! (${modeLabel})`);
      } else {
        showToast("❌ Erreur DB: " + data.detail);
      }
    } catch (error) {
      console.error("Network Error:", error);
      showToast("❌ Erreur réseau. Uvicorn tourne-t-il ?");
    }
  }, [parcelleInfo, selectedGroupId, samplingMode, placeSamplePoints, displayZones, showToast, parcelles, selectedParcelleId]);
  const handleSelectWilaya = useCallback(
    (wilaya) => {
      setSelectedWilaya(wilaya);
      flyToWilaya(wilaya);
      showToast(`📍 Wilaya de ${wilaya.name} · Zone ${wilaya.zone}`);
    },
    [flyToWilaya, showToast],
  );

  const selectedCulture = CULTURES.find((c) => c.id === selectedGroupId);
  const selectedParcelle =
    parcelles.find((p) => p.id === selectedParcelleId) ?? null;
  return (
    <>
      <div style={{ display: "flex", height: "100vh" }}>
        <LeftPanel
          parcelles={parcelles}
          selectedParcelle={selectedParcelleId}
          selectedGroup={selectedGroupId}
          samplingMode={samplingMode}
          activeTool={activeTool}
          pendingParcelleInfo={pendingParcelleInfo}
          pendingColor={pendingColor}
          onToolClick={handleActivateTool}
          onSelectParcelle={handleSelectParcelle}
          onDeleteParcelle={handleDeleteParcelle}
          onGroupChange={handleGroupChange}
          onSamplingModeChange={setSamplingMode}
          onGenerate={handleAnalyze}
          onClearAll={handleClearAll}
          onSaveParcelle={handleSaveParcelle}
          onCancelDraw={handleCancelDraw}
        />

        <MapView
          mapRef={mapRef}
          parcelleInfo={parcelleInfo}
          selectedCulture={selectedCulture}
          onSelectWilaya={handleSelectWilaya}
          selectedWilaya={selectedWilaya}
          onCloseWilaya={() => setSelectedWilaya(null)}
        />
      </div>

      <ResultsPanel
        open={resultsOpen}
        onClose={() => setResultsOpen(false)}
        cultureId={selectedGroupId}
        parcelleHa={parcelleInfo?.area}
        region={selectedWilaya?.name}
        samplingMode={samplingMode} // 👈 ADD THIS LINE
        parcelle={selectedParcelle}
      />

      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}
