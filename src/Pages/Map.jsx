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
  useEffect(() => { document.body.className = "page-map"; }, []);

  const [parcelles,          setParcelles]          = useState([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState(null);
  const [pendingParcelleInfo,setPendingParcelleInfo] = useState(null);
  const [pendingColor,       setPendingColor]        = useState("#2ecc71");
  const [parcelleInfo,       setParcelleInfo]        = useState(null);
  const [selectedGroupId,    setSelectedGroupId]     = useState(null);
  const [samplingMode,       setSamplingMode]        = useState("standard");
  const [activeTool,         setActiveTool]          = useState(null);
  const [resultsOpen,        setResultsOpen]         = useState(false);
  const [selectedWilaya,     setSelectedWilaya]      = useState(null);
  const [toast,              setToast]               = useState({ msg: "", visible: false });
  const [geeReady,           setGeeReady]            = useState(false);
  const [isAnalyzing,        setIsAnalyzing]         = useState(false);
  //  number of zones returned by the backend after analysis
  const [nZonesFromBackend,  setNZonesFromBackend]   = useState(1);

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
            const uniqueParcels = data.filter((parcel, index, self) =>
              index === self.findIndex((p) => p.id === parcel.id)
            );
            setParcelles(uniqueParcels);
            console.log(`✅ Loaded ${uniqueParcels.length} unique parcelles from DB`);
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
      try { await authenticateGEE(); setGeeReady(true); }
      catch (err) { console.log("GEE auth stub:", err?.message || "OK"); }
    })();
  }, []);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(
      () => setToast(t => ({ ...t, visible: false })),
      3200
    );
  }, []);

  const handleParcelleChange = useCallback((info) => {
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
    showToast(`✅ Parcelle tracée — ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Donnez-lui un nom`);
  }, [showToast]);

  const {
    mapRef, placeSamplePoints, activateDrawTool, clearAll,
    flyToWilaya, displayZones, clearZones, drawParcelleFromLatLngs,
  } = useMap({ onParcelleChange: handleParcelleChange });

  const handleActivateTool = useCallback((tool) => {
    setActiveTool(tool);
    if (tool) { activateDrawTool(tool); setPendingParcelleInfo(null); setResultsOpen(false); }
    else { activateDrawTool(null); }
  }, [activateDrawTool]);

  const handleSaveParcelle = useCallback(({ name, groupId }) => {
    if (!pendingParcelleInfo) return;
    setPendingParcelleInfo({ ...pendingParcelleInfo, name });
    const newP = {
      id: Date.now(), name,
      area: (pendingParcelleInfo.area || 0) * 10000,
      color: pendingColor, groupId,
      bounds: pendingParcelleInfo.bounds,
      latlngs: pendingParcelleInfo.latlngs,
    };
    setParcelles(prev => [...prev, newP]);
    setSelectedParcelleId(newP.id);
    setSelectedGroupId(groupId);
    setPendingParcelleInfo(null);
    setResultsOpen(false);
    showToast(`✅ ${name} enregistrée`);
  }, [pendingParcelleInfo, pendingColor, showToast]);

  const handleCancelDraw = useCallback(() => {
    setActiveTool(null); activateDrawTool(null); setPendingParcelleInfo(null);
    if (!parcelles.length) { clearAll(); setParcelleInfo(null); }
    showToast("✕ Dessin annulé");
  }, [activateDrawTool, clearAll, parcelles.length, showToast]);

  // ✅ FIXED: Delete single parcelle immediately (UI + Map + DB)
  const handleDeleteParcelle = useCallback(
    async (id) => {
      if (!id) return;
      const token = localStorage.getItem("token");

      // 1. Optimistic UI update
      setParcelles((prev) => prev.filter((p) => p.id !== id));

      // 2. If the deleted parcelle was selected, clear selection AND map drawing
      if (selectedParcelleId === id) {
        setSelectedParcelleId(null);
        setParcelleInfo(null);
        setResultsOpen(false);
        clearAll(); // ✅ Removes the polygon from the map immediately
      }

      // 3. Backend deletion
      if (token) {
        try {
          const response = await fetch(`${API_BASE}/api/parcels/${id}`, {
            method: "DELETE",
            headers: {
               "Authorization": `Bearer ${token}`,
               "Content-Type": "application/json"
            },
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `HTTP ${response.status}`);
          }
          console.log(`✅ Parcelle ${id} deleted from DB`);
          showToast("🗑 Parcelle supprimée");
        } catch (error) {
          console.error(`❌ Failed to delete parcelle ${id}:`, error);
          showToast("❌ Échec suppression - rafraîchissez la page");
        }
      } else {
        showToast("🗑 Parcelle supprimée (local)");
      }
    },
    [selectedParcelleId, showToast, clearAll]
  );

  // ✅ FIXED: Bulk delete - uses snapshot of IDs to ensure ALL are deleted
  const handleClearAll = useCallback(async () => {
    clearAll();
    clearZones();
    const token = localStorage.getItem("token");

    // Take a snapshot of IDs to delete to avoid state staleness issues
    const idsToDelete = parcelles.map(p => p.id);

    if (idsToDelete.length > 0 && token) {
      showToast("🗑 Suppression en cours...");
      try {
        const results = await Promise.allSettled(
          idsToDelete.map((id) =>
            fetch(`${API_BASE}/api/parcels/${id}`, {
              method: "DELETE",
              headers: {
                 "Authorization": `Bearer ${token}`,
                 "Content-Type": "application/json"
              },
            }).then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${res.status}`);
              }
              return { id, success: true };
            })
          )
        );
        const failed = results.filter(r => r.status === "rejected");
        if (failed.length > 0) {
          console.warn(`⚠️ ${failed.length} deletion(s) failed`);
          showToast(`⚠️ ${idsToDelete.length - failed.length}/${idsToDelete.length} supprimées`);
        } else {
          console.log("✅ All parcelles deleted from DB");
          showToast("🗑 Tout effacé");
        }
      } catch (error) {
        console.error("❌ Bulk delete error:", error);
        showToast("❌ Erreur lors de la suppression");
      }
    } else if (idsToDelete.length > 0 && !token) {
      // If no token, just clear UI
      showToast("🗑 Tout effacé (UI only)");
    }

    // Always clear frontend state
    setParcelles([]);
    setSelectedParcelleId(null);
    setParcelleInfo(null);
    setPendingParcelleInfo(null);
    setSelectedGroupId(null);
    setActiveTool(null);
    setResultsOpen(false);
    setNZonesFromBackend(1);
  }, [parcelles, clearAll, clearZones, showToast, setNZonesFromBackend]);

  const handleSelectParcelle = useCallback((id) => {
    setSelectedParcelleId(id);
    const p = parcelles.find(x => x.id === id);
    if (p && p.latlngs && p.latlngs.length > 0) {
      setSelectedGroupId(p.groupId || selectedGroupId);
      const stats = drawParcelleFromLatLngs(p.latlngs, p.color || pendingColor);
      if (stats) { setParcelleInfo({ ...stats, name: p.name, type: "polygon" }); }
    }
    setResultsOpen(false);
  }, [parcelles, selectedGroupId, drawParcelleFromLatLngs, pendingColor]);

  const handleGroupChange = useCallback((groupId) => {
    setSelectedGroupId(groupId); setResultsOpen(false);
    const c = CULTURES.find(c => c.id === groupId);
    if (c) showToast(`${c.iconEmoji} ${c.nameShort} sélectionné`);
  }, [showToast]);

  const handleAnalyze = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { showToast("❌ Veuillez vous connecter d'abord"); return; }
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    const isExistingParcelle = selectedParcelleId && !pendingParcelleInfo;
    const targetParcelle = isExistingParcelle ? parcelles.find(p => p.id === selectedParcelleId) : null;
    const geometry = isExistingParcelle && targetParcelle?.latlngs
      ? { latlngs: targetParcelle.latlngs, area: targetParcelle.area / 10000 }
      : parcelleInfo;

    if (!geometry || !geometry.latlngs || geometry.latlngs.length < 3) {
      showToast("❌ Info manquante - veuillez re-sélectionner la parcelle");
      setIsAnalyzing(false); return;
    }

    const normalizeLatLngs = latlngs => {
      if (!latlngs) return [];
      return latlngs.map(ll => {
        if (Array.isArray(ll)) return ll;
        if (ll && typeof ll === "object" && "lat" in ll && "lng" in ll) return [ll.lat, ll.lng];
        return ll;
      });
    };

    const cropGroupId = targetParcelle?.groupId ? Number(targetParcelle.groupId) : selectedGroupId;
    if (!cropGroupId || !CULTURES_TO_STRATEGIES[cropGroupId]) {
      showToast("❌ Type de culture non sélectionné"); setIsAnalyzing(false); return;
    }

    const culture = CULTURES.find(c => c.id === cropGroupId);
    const cropType = CULTURES_TO_STRATEGIES[cropGroupId];
    if (!culture || !cropType) {
      showToast("❌ Type de culture invalide"); setIsAnalyzing(false); return;
    }

    const customName = pendingParcelleInfo?.name || targetParcelle?.name || null;
    const polygonPoints = normalizeLatLngs(geometry.latlngs);

    const payload = { polygonPoints, cropType, samplingMode, parcelleName: customName };
    showToast("⏳ Calcul + sauvegarde en cours...");

    try {
      const response = await fetch(`${API_BASE}/api/sampling/run-and-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          showToast("❌ Session expirée. Veuillez vous reconnecter.");
          localStorage.removeItem("token"); localStorage.removeItem("user");
        } else {
          showToast(`❌ Erreur: ${errData.detail || response.statusText}`);
        }
        setIsAnalyzing(false); return;
      }

      const data = await response.json();

      if (data.zones?.length > 0) {
        setNZonesFromBackend(data.zones.length);
        displayZones(data.zones, samplingMode);
        placeSamplePoints(data.zones, culture.color);
        setResultsOpen(true);

        const totalPoints = data.zones.reduce((sum, z) => sum + (z.points?.length || 0), 0);
        const modeLabel = samplingMode === "economic" ? "économique" : "standard";
        showToast(data.savedParcelleId
          ? `🔬 ${totalPoints} pts · ${data.zones.length} zone(s) + 💾 Parcelle #${data.savedParcelleId} sauvegardée ! (${modeLabel})`
          : `🔬 ${totalPoints} points générés dans ${data.zones.length} zone(s) ! (${modeLabel})`
        );
      } else {
        showToast("⚠️ Aucune zone générée");
      }
    } catch (error) {
      console.error("Network Error:", error);
      showToast("❌ Erreur réseau");
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    parcelleInfo, selectedGroupId, samplingMode, pendingParcelleInfo,
    selectedParcelleId, parcelles, placeSamplePoints, displayZones,
    showToast, isAnalyzing,
  ]);

  const handleSelectWilaya = useCallback((wilaya) => {
    setSelectedWilaya(wilaya); flyToWilaya(wilaya);
    showToast(`📍 Wilaya de ${wilaya.name} · Zone ${wilaya.zone}`);
  }, [flyToWilaya, showToast]);

  const selectedCulture = CULTURES.find(c => c.id === selectedGroupId);
  const selectedParcelle = parcelles.find(p => p.id === selectedParcelleId) ?? null;

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
        nZones={nZonesFromBackend}
      />
      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}