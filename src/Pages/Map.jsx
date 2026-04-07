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
  1: "vegetables",  // Maraîchères
  2: "cereals",     // Céréalières
  3: "trees",       // Arbres
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

      const ha = info.area || 0;
      showToast(
        `✅ Parcelle tracée — ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Donnez-lui un nom`,
      );
    },
    [showToast],
  );

  const { mapRef, placeSamplePoints, activateDrawTool, clearAll, flyToWilaya, displayZones } =
    useMap({
      onParcelleChange: handleParcelleChange,
    });

  const handleActivateTool = useCallback(
    (tool) => {
      setActiveTool(tool);
      if (tool) {
        activateDrawTool(tool);
        setPendingParcelleInfo(null);
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
    setParcelles([]);
    setSelectedParcelleId(null);
    setParcelleInfo(null);
    setPendingParcelleInfo(null);
    setSelectedGroupId(null);
    setActiveTool(null);
    setResultsOpen(false);
    showToast("🗑 Tout effacé");
  }, [clearAll, showToast]);

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

  const handleAnalyze = useCallback(() => {
    console.log("handleAnalyze: started");
    if (!parcelleInfo || !selectedGroupId) {
      console.log("handleAnalyze: missing parcelleInfo or selectedGroupId");
      return;
    }

    const culture = CULTURES.find((c) => c.id === selectedGroupId);
    if (!culture) {
      console.log("handleAnalyze: culture not found");
      return;
    }

    const cropType = CULTURES_TO_STRATEGIES[selectedGroupId];
    if (!cropType) {
      showToast("❌ Type de culture non reconnu");
      console.log("handleAnalyze: invalid crop type");
      return;
    }

    // Build Turf polygon from latlngs
    const turf = window.turf;
    if (!turf) {
      showToast("❌ Turf.js non chargé");
      console.log("handleAnalyze: Turf.js not loaded");
      return;
    }

    const coords = parcelleInfo.latlngs.map((ll) => [ll.lng, ll.lat]);
    coords.push(coords[0]);
    const drawnPolygon = turf.polygon([coords]);
    const totalAreaHa = turf.area(drawnPolygon) / 10000;

    console.log("handleAnalyze: created polygon, area =", totalAreaHa, "ha");

    if (totalAreaHa < 0.05) {
      showToast(`❌ Surface trop petite (${totalAreaHa.toFixed(3)} ha)`);
      console.log("handleAnalyze: area too small");
      return;
    }

    const strategy = CROP_STRATEGIES[cropType];
    const numZones = computeNumZones(totalAreaHa, strategy, samplingMode);
    
    console.log("handleAnalyze: strategy =", cropType, "numZones =", numZones, "samplingMode =", samplingMode);

    // Build zones and generate all points
    const zones = buildZones(
      drawnPolygon,
      totalAreaHa,
      numZones,
      strategy,
      samplingMode,
    );

    console.log("handleAnalyze: buildZones returned", zones.length, "zones", zones);

    // Flatten all points from all zones
    const allPoints = zones.flatMap((zone) => zone.points || []);

    console.log("handleAnalyze: flattened points, total =", allPoints.length);

    if (allPoints.length === 0) {
      showToast("❌ Impossible de générer les points");
      console.log("handleAnalyze: no points generated");
      return;
    }

    console.log("handleAnalyze: calling displayZones");
    // Display zones on map
    displayZones(zones, samplingMode);

    console.log("handleAnalyze: calling placeSamplePoints");
    // Display points on map (with per-zone numbering)
    placeSamplePoints(zones, culture.color);

    console.log("handleAnalyze: setting resultsOpen to true");
    setResultsOpen(true);
    
    const modeLabel = samplingMode === "economic" ? "économique" : "standard";
    showToast(
      `🔬 ${allPoints.length} points (${numZones} zone${numZones > 1 ? "s" : ""} · mode ${modeLabel})`,
    );
    
    console.log("handleAnalyze: complete");
  }, [parcelleInfo, selectedGroupId, samplingMode, placeSamplePoints, displayZones, showToast]);

  const handleSelectWilaya = useCallback(
    (wilaya) => {
      setSelectedWilaya(wilaya);
      flyToWilaya(wilaya);
      showToast(`📍 Wilaya de ${wilaya.name} · Zone ${wilaya.zone}`);
    },
    [flyToWilaya, showToast],
  );

  const selectedCulture = CULTURES.find((c) => c.id === selectedGroupId);

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
      />

      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}
