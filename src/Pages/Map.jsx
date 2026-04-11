import React, { useState, useCallback, useRef, useEffect } from "react";
import "../styles/map.css";
import LeftPanel from "../components/map/LeftPanel";
import MapView from "../components/map/MapView";
import ResultsPanel from "../components/map/ResultsPanel";
import Toast from "../components/map/Toast";
import { useMap } from "../hooks/useMap";
import { CULTURES } from "../data/cultures";
// Import constants/helpers that are still needed for UI (kept active in frozen samplingEngine.js)
import {
  computePreview,
  computeNumZones,
  CROP_STRATEGIES,
  authenticateGEE, // Stub: returns resolved promise, no GEE auth needed now
} from "../lib/samplingEngine";

// Mapping from CULTURES.id to CROP_STRATEGIES key
const CULTURES_TO_STRATEGIES = {
  1: "vegetables", // Maraîchères
  2: "cereals", // Céréalières
  3: "trees", // Arbres
};

const FIELD_COLORS = [
  "#2ecc71", "#3b82f6", "#e6970a", "#ec4899", "#06b6d4", "#a855f7", "#ef4444",
];
let colorIdx = 0;
const nextColor = () => FIELD_COLORS[colorIdx++ % FIELD_COLORS.length];

// Backend API base URL (matches your FastAPI server)
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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
  const [samplingMode, setSamplingMode] = useState("standard");
  const [activeTool, setActiveTool] = useState(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedWilaya, setSelectedWilaya] = useState(null);
  const [toast, setToast] = useState({ msg: "", visible: false });
  const [geeReady, setGeeReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // ✅ Loading state for DB save
  const toastTimer = useRef(null);

  // Initialize GEE stub (non-blocking, just for compatibility)
  useEffect(() => {
    (async () => {
      try {
        await authenticateGEE(); // Stub: resolves immediately
        setGeeReady(true);
      } catch (err) {
        console.log("GEE auth stub:", err?.message || "OK");
      }
    })();
  }, []);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      3200
    );
  }, []);

  const handleParcelleChange = useCallback(
    (info) => {
      if (info.type === "marker") {
        showToast("📍 Marqueur posé — dessinez un polygone pour calculer la surface");
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
        `✅ Parcelle tracée — ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Donnez-lui un nom`
      );
    },
    [showToast]
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
    [activateDrawTool]
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
    [pendingParcelleInfo, pendingColor, showToast]
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
    clearZones();
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
    [parcelles, selectedGroupId]
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
    [selectedParcelleId, showToast]
  );

  const handleGroupChange = useCallback(
    (groupId) => {
      setSelectedGroupId(groupId);
      setResultsOpen(false);
      const c = CULTURES.find((c) => c.id === groupId);
      if (c) showToast(`${c.iconEmoji} ${c.nameShort} sélectionné`);
    },
    [showToast]
  );

  // ✅ MIGRATED: Calls backend API AND saves to Neon DB
  const handleAnalyze = useCallback(async () => {
    if (isAnalyzing) return; // Prevent double-click
    setIsAnalyzing(true);

    console.log("handleAnalyze: started (backend + DB save mode)");
    if (!parcelleInfo || !selectedGroupId) {
      showToast("❌ Info manquante");
      setIsAnalyzing(false);
      return;
    }

    const culture = CULTURES.find((c) => c.id === selectedGroupId);
    const cropType = CULTURES_TO_STRATEGIES[selectedGroupId];
    if (!culture || !cropType) {
      setIsAnalyzing(false);
      return;
    }

    // Prepare payload for backend (matches SamplingRequest schema)
    const payload = {
      polygonPoints: parcelleInfo.latlngs.map((ll) => [ll.lat, ll.lng]), // [[lat, lng], ...]
      cropType,
      samplingMode, // "standard" or "economic"
    };

    showToast("⏳ Calcul + sauvegarde en cours...");

    try {
      // ✅ Call the NEW endpoint that calculates AND saves to Neon DB
      const response = await fetch(`${API_BASE}/api/sampling/run-and-save?farmer_id=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Backend API failed:", errData);
        showToast(`❌ Erreur: ${errData.detail || response.statusText}`);
        return;
      }

      const data = await response.json();
      // ✅ Backend returns: { ..., savedParcelleId, savedSamplesCount }

      if (data.zones?.length > 0) {
        // Use backend-calculated zones & points (same structure as frontend)
        displayZones(data.zones, samplingMode);
        placeSamplePoints(data.zones, culture.color);
        setResultsOpen(true);

        const totalPoints = data.zones.reduce((sum, z) => sum + (z.points?.length || 0), 0);
        const modeLabel = samplingMode === "economic" ? "économique" : "standard";

        // ✅ Show save confirmation
        if (data.savedParcelleId) {
          showToast(
            `🔬 ${totalPoints} points générés + 💾 Parcelle #${data.savedParcelleId} sauvegardée ! (${modeLabel})`
          );
        } else {
          showToast(`🔬 ${totalPoints} points générés dans ${data.zones.length} zone(s) ! (${modeLabel})`);
        }
      } else {
        showToast("⚠️ Aucune zone générée — essayez une parcelle plus grande");
      }
    } catch (error) {
      console.error("Network Error:", error);
      showToast("❌ Erreur réseau. Vérifiez que le backend tourne sur http://127.0.0.1:8000");
    } finally {
      setIsAnalyzing(false); // Always reset loading state
    }
  }, [parcelleInfo, selectedGroupId, samplingMode, placeSamplePoints, displayZones, showToast, isAnalyzing]);

  const handleSelectWilaya = useCallback(
    (wilaya) => {
      setSelectedWilaya(wilaya);
      flyToWilaya(wilaya);
      showToast(`📍 Wilaya de ${wilaya.name} · Zone ${wilaya.zone}`);
    },
    [flyToWilaya, showToast]
  );

  const selectedCulture = CULTURES.find((c) => c.id === selectedGroupId);
  const selectedParcelle = parcelles.find((p) => p.id === selectedParcelleId) ?? null;

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
          onGenerate={handleAnalyze} // ✅ Now calls backend + saves to DB
          onClearAll={handleClearAll}
          onSaveParcelle={handleSaveParcelle}
          onCancelDraw={handleCancelDraw}
          isAnalyzing={isAnalyzing} // ✅ Pass loading state to LeftPanel
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
        samplingMode={samplingMode}
        parcelle={selectedParcelle}
      />

      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}