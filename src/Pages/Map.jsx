import React, { useState, useCallback, useRef, useEffect } from "react";
import "../styles/map.css";
import LeftPanel from "../components/map/LeftPanel";
import MapView from "../components/map/MapView";
import ResultsPanel from "../components/map/ResultsPanel";
import Toast from "../components/map/Toast";
import { useMap } from "../hooks/useMap";
import { CULTURES } from "../data/cultures";
import {
  computePreview,
  computeNumZones,
  CROP_STRATEGIES,
  authenticateGEE,
} from "../lib/samplingEngine";

const CULTURES_TO_STRATEGIES = {
  1: "vegetables",
  2: "cereals",
  3: "trees",
};

const FIELD_COLORS = [
  "#2ecc71", "#3b82f6", "#e6970a", "#ec4899", "#06b6d4", "#a855f7", "#ef4444",
];
let colorIdx = 0;
const nextColor = () => FIELD_COLORS[colorIdx++ % FIELD_COLORS.length];

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const toastTimer = useRef(null);

  // Fetch parcelles from DB on mount
  useEffect(() => {
    const fetchUserParcelles = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await fetch(`${API_BASE}/api/parcels`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            setParcelles(data);
            console.log(`✅ Loaded ${data.length} parcelles from DB`);
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not fetch parcelles from DB:", error);
      }
    };
    fetchUserParcelles();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await authenticateGEE();
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

  // ✅ Destructure the new drawParcelleFromLatLngs function
  const {
    mapRef,
    placeSamplePoints,
    activateDrawTool,
    clearAll,
    flyToWilaya,
    displayZones,
    clearZones,
    drawParcelleFromLatLngs,
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
      setPendingParcelleInfo({
        ...pendingParcelleInfo,
        name: name
      });
      const newP = {
        id: Date.now(),
        name,
        area: (pendingParcelleInfo.area || 0) * 10000,
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

  // ✅ FIX: Click parcelle → Display on map + enable re-generate
  const handleSelectParcelle = useCallback(
    (id) => {
      setSelectedParcelleId(id);
      const p = parcelles.find((x) => x.id === id);

      if (p && p.latlngs && p.latlngs.length > 0) {
        setSelectedGroupId(p.groupId || selectedGroupId);

        // ✅ Use the new function to draw the parcelle on map
        const stats = drawParcelleFromLatLngs(p.latlngs, p.color || pendingColor);

        if (stats) {
          // Update parcelleInfo so UI components can access the data
          setParcelleInfo({
            ...stats,
            name: p.name,
            type: "polygon"
          });
          console.log(`✅ Displayed parcelle "${p.name}" on map`);
        }
      } else {
        console.warn(`⚠️ Parcelle ${id} has no latlngs to display`);
      }
      setResultsOpen(false);
    },
    [parcelles, selectedGroupId, drawParcelleFromLatLngs, pendingColor]
  );

  const handleDeleteParcelle = useCallback(
    async (id) => {
      const token = localStorage.getItem("token");
      setParcelles((prev) => prev.filter((p) => p.id !== id));
      if (selectedParcelleId === id) {
        setSelectedParcelleId(null);
        setParcelleInfo(null);
        setResultsOpen(false);
      }
      if (token) {
        try {
          const response = await fetch(`${API_BASE}/api/parcels/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (response.ok) {
            showToast("🗑 Parcelle supprimée (DB + UI)");
          } else {
            const errData = await response.json().catch(() => ({}));
            console.warn("⚠️ DB delete failed:", errData);
            showToast("⚠️ UI updated, but DB delete failed");
          }
        } catch (error) {
          console.error("❌ Network error deleting parcelle:", error);
          showToast("❌ Erreur réseau lors de la suppression");
        }
      } else {
        showToast("🗑 Parcelle supprimée (UI only)");
      }
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

  // ✅ FIXED: Handle re-generate for existing parcelles (fixes 422 error)
  const handleAnalyze = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("❌ Veuillez vous connecter d'abord");
      return;
    }

    if (isAnalyzing) return;
    setIsAnalyzing(true);

    console.log("handleAnalyze: started");

    // Handle both new drawings AND existing parcelles
    const isExistingParcelle = selectedParcelleId && !pendingParcelleInfo;
    const targetParcelle = isExistingParcelle
      ? parcelles.find(p => p.id === selectedParcelleId)
      : null;

    // Get geometry: from pending (new) or from stored (existing)
    const geometry = isExistingParcelle && targetParcelle?.latlngs
      ? { latlngs: targetParcelle.latlngs, area: targetParcelle.area / 10000 }
      : parcelleInfo;

    // ✅ VALIDATION: Ensure we have valid geometry
    if (!geometry || !geometry.latlngs || geometry.latlngs.length < 3) {
      console.error("❌ Invalid geometry:", geometry);
      showToast("❌ Info manquante - veuillez re-sélectionner la parcelle");
      setIsAnalyzing(false);
      return;
    }

    // ✅ FIX: Normalize latlngs to handle both formats (objects from Leaflet, arrays from DB)
    const normalizeLatLngs = (latlngs) => {
      if (!latlngs) return [];
      return latlngs.map((ll) => {
        if (Array.isArray(ll)) {
          return ll; // Already [lat, lng] from DB
        }
        if (ll && typeof ll === 'object' && 'lat' in ll && 'lng' in ll) {
          return [ll.lat, ll.lng]; // Convert from Leaflet object
        }
        return ll; // Fallback
      });
    };

    // ✅ FIX: Ensure cropGroupId is a NUMBER (DB stores as integer)
    const cropGroupId = targetParcelle?.groupId
      ? Number(targetParcelle.groupId)
      : selectedGroupId;

    // ✅ VALIDATION: Ensure we have a valid crop type mapping
    if (!cropGroupId || !CULTURES_TO_STRATEGIES[cropGroupId]) {
      console.error("❌ Invalid cropGroupId:", cropGroupId, "selectedGroupId:", selectedGroupId);
      showToast("❌ Type de culture non sélectionné");
      setIsAnalyzing(false);
      return;
    }

    const culture = CULTURES.find((c) => c.id === cropGroupId);
    const cropType = CULTURES_TO_STRATEGIES[cropGroupId];

    if (!culture || !cropType) {
      console.error("❌ Culture not found for groupId:", cropGroupId);
      showToast("❌ Type de culture invalide");
      setIsAnalyzing(false);
      return;
    }

    // Get name
    const customName = pendingParcelleInfo?.name || targetParcelle?.name || null;

    // ✅ Normalize coordinates for backend (always [lat, lng] arrays)
    const polygonPoints = normalizeLatLngs(geometry.latlngs);

    console.log(`📝 Sending parcelle name: "${customName}"`);
    console.log(`📝 Payload:`, {
      polygonPoints: polygonPoints.slice(0, 3), // Log first 3 points for brevity
      cropType,
      samplingMode,
      parcelleName: customName,
    });

    const payload = {
      polygonPoints, // ✅ Now always [[lat, lng], ...] format
      cropType,
      samplingMode,
      parcelleName: customName,
    };

    showToast("⏳ Calcul + sauvegarde en cours...");

    try {
      const response = await fetch(`${API_BASE}/api/sampling/run-and-save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Backend API failed:", errData);

        if (response.status === 401) {
          showToast("❌ Session expirée. Veuillez vous reconnecter.");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setIsAnalyzing(false);
          return;
        }

        if (response.status === 422) {
          console.error("❌ Validation error - payload:", payload);
          showToast("❌ Données invalides - veuillez re-sélectionner la parcelle");
        } else {
          showToast(`❌ Erreur: ${errData.detail || response.statusText}`);
        }
        setIsAnalyzing(false);
        return;
      }

      const data = await response.json();

      if (data.zones?.length > 0) {
        displayZones(data.zones, samplingMode);
        placeSamplePoints(data.zones, culture.color);
        setResultsOpen(true);

        const totalPoints = data.zones.reduce((sum, z) => sum + (z.points?.length || 0), 0);
        const modeLabel = samplingMode === "economic" ? "économique" : "standard";

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
      setIsAnalyzing(false);
    }
  }, [
    parcelleInfo, selectedGroupId, samplingMode, pendingParcelleInfo,
    selectedParcelleId, parcelles, placeSamplePoints, displayZones,
    showToast, isAnalyzing
  ]);

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
          onGenerate={handleAnalyze}
          onClearAll={handleClearAll}
          onSaveParcelle={handleSaveParcelle}
          onCancelDraw={handleCancelDraw}
          isAnalyzing={isAnalyzing}
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