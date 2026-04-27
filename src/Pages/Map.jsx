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
import { ZONE_COLORS } from "../data/wilayas";
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
const MAX_PARCEL_AREA_HA = 50;

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function Map() {
  useEffect(() => { document.body.className = "page-map"; }, []);

  const [parcelles,          setParcelles]          = useState([]);
  const [selectedParcelleId, setSelectedParcelleId] = useState(null);
  const [pendingParcelleInfo,setPendingParcelleInfo] = useState(null);
  const [pendingColor,       setPendingColor]        = useState("#2ecc71");
  const [parcelleInfo,       setParcelleInfo]        = useState(null);
  const [selectedGroupId,    setSelectedGroupId]     = useState(null);
  const samplingMode = "standard";
  const [activeTool,         setActiveTool]          = useState(null);
  const [resultsOpen,        setResultsOpen]         = useState(false);
  const [selectedWilaya,     setSelectedWilaya]      = useState(null);
  const [toast,              setToast]               = useState({ msg: "", visible: false });
  const [geeReady,           setGeeReady]            = useState(false);
  const [isAnalyzing,        setIsAnalyzing]         = useState(false);
  //  number of zones returned by the backend after analysis
  const [nZonesFromBackend,  setNZonesFromBackend]   = useState(1);
  const [analyzedZones,      setAnalyzedZones]       = useState([]);
  const [samplingColor,      setSamplingColor]       = useState("#2ecc71");

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
      showToast("📍 Marker placed - draw a polygon to calculate area");
      return;
    }
    if (info.type === "oversize") {
      setActiveTool(null);
      setPendingParcelleInfo(null);
      setParcelleInfo(null);
      setResultsOpen(false);
      showToast(`⚠️ Parcel too large: max ${MAX_PARCEL_AREA_HA} ha per parcel`);
      return;
    }
    const color = nextColor();
    setActiveTool(null);
    setPendingParcelleInfo(info);
    setPendingColor(color);
    setParcelleInfo(info);
    setAnalyzedZones([]);
    setSamplingColor(color);
    setResultsOpen(false);
    const ha = info.area || 0;
    showToast(`✅ Parcel drawn - ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Give it a name`);
  }, [showToast]);

  const {
    mapRef, placeSamplePoints, clearSampleMarkers, activateDrawTool, clearAll,
    flyToWilaya, displayZones, clearZones, drawParcelleFromLatLngs,
    clearSamplingMarkers, drawAllParcelles, clearAllParcelles, clearSelectedParcelle,
  } = useMap({ onParcelleChange: handleParcelleChange, maxParcelAreaHa: MAX_PARCEL_AREA_HA });

  useEffect(() => {
    if (parcelles.length > 0) {
      drawAllParcelles(parcelles, selectedParcelleId);
    } else {
      clearAllParcelles();
    }
  }, [parcelles, selectedParcelleId, drawAllParcelles, clearAllParcelles]);

  const handleActivateTool = useCallback((tool) => {
    setActiveTool(tool);
    if (tool) { activateDrawTool(tool); setPendingParcelleInfo(null); setResultsOpen(false); }
    else { activateDrawTool(null); }
  }, [activateDrawTool]);

  const handleSaveParcelle = useCallback(({ name, groupId }) => {
    if (!pendingParcelleInfo) return;
    if ((pendingParcelleInfo.area || 0) > MAX_PARCEL_AREA_HA) {
      showToast(`⚠️ Parcel too large: max ${MAX_PARCEL_AREA_HA} ha per parcel`);
      return;
    }
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
    showToast(`✅ ${name} saved`);
  }, [pendingParcelleInfo, pendingColor, showToast]);

  const handleCancelDraw = useCallback(() => {
    setActiveTool(null);
    activateDrawTool(null);
    setPendingParcelleInfo(null);
    // Always clear any temporary drawn overlay so cancel is immediate
    clearSelectedParcelle();
    // If there are no saved parcelles, clear the whole map state
    if (!parcelles.length) { clearAll(); setParcelleInfo(null); }
    showToast("✕ Drawing canceled");
  }, [activateDrawTool, clearAll, parcelles.length, showToast, clearSelectedParcelle]);

  // ✅ FIXED: Delete single parcelle immediately (UI + Map + DB)
  const handleDeleteParcelle = useCallback(
    async (id) => {
      if (!id) return;
      const token = localStorage.getItem("token");

      // 1. Optimistic UI update
      const next = parcelles.filter((p) => p.id !== id);
      setParcelles(next);

      // 2. Ensure any overlay for that parcel is removed immediately
      // If the deleted parcel was the currently selected one, clear selection state
      const nextSelectedParcelleId = selectedParcelleId === id ? null : selectedParcelleId;
      if (selectedParcelleId === id) {
        setSelectedParcelleId(null);
        setParcelleInfo(null);
        setResultsOpen(false);
      }
      // Always clear the selected/drawn overlay and redraw remaining parcels
      clearSelectedParcelle();
      clearSampleMarkers();
      clearZones();
      drawAllParcelles(next, nextSelectedParcelleId);

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
          showToast("🗑 Parcel deleted");
        } catch (error) {
          console.error(`❌ Failed to delete parcelle ${id}:`, error);
          showToast("❌ Delete failed - refresh the page");
        }
      } else {
        showToast("🗑 Parcel deleted (local)");
      }
    },
    [selectedParcelleId, showToast, parcelles, clearSelectedParcelle, clearSampleMarkers, drawAllParcelles, clearZones]
  );

  // ✅ FIXED: Bulk delete - uses snapshot of IDs to ensure ALL are deleted
  const handleClearAll = useCallback(async () => {
    clearAll();
    clearZones();
    const token = localStorage.getItem("token");

    // Take a snapshot of IDs to delete to avoid state staleness issues
    const idsToDelete = parcelles.map(p => p.id);

    if (idsToDelete.length > 0 && token) {
      showToast("🗑 Deleting in progress...");
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
          showToast(`⚠️ ${idsToDelete.length - failed.length}/${idsToDelete.length} deleted`);
        } else {
          console.log("✅ All parcelles deleted from DB");
          showToast("🗑 Everything cleared");
        }
      } catch (error) {
        console.error("❌ Bulk delete error:", error);
        showToast("❌ Error during deletion");
      }
    } else if (idsToDelete.length > 0 && !token) {
      // If no token, just clear UI
      showToast("🗑 Everything cleared (UI only)");
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
    setAnalyzedZones([]);
    setSamplingColor("#2ecc71");
  }, [parcelles, clearAll, clearZones, showToast, setNZonesFromBackend]);

  const handleSelectParcelle = useCallback((id) => {
    if (id === selectedParcelleId) {
      setSelectedParcelleId(null);
      setParcelleInfo(null);
      setResultsOpen(false);
      clearSelectedParcelle();
      return;
    }

    setSelectedParcelleId(id);
    const p = parcelles.find(x => x.id === id);
    if (p && p.latlngs && p.latlngs.length > 0) {
      setSelectedGroupId(p.groupId || selectedGroupId);
      const stats = drawParcelleFromLatLngs(p.latlngs, p.color || pendingColor);
      if (stats) { setParcelleInfo({ ...stats, name: p.name, type: "polygon" }); }
    }
    setResultsOpen(false);
  }, [parcelles, selectedGroupId, drawParcelleFromLatLngs, pendingColor, selectedParcelleId, clearSelectedParcelle]);

  const handleGroupChange = useCallback((groupId) => {
    setSelectedGroupId(groupId); setResultsOpen(false);
    const c = CULTURES.find(c => c.id === groupId);
    if (c) showToast(`${c.iconEmoji} ${c.nameShort} selected`);
  }, [showToast]);

  const handleAnalyze = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { showToast("❌ Please sign in first"); return; }
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    const isExistingParcelle = selectedParcelleId && !pendingParcelleInfo;
    const targetParcelle = isExistingParcelle ? parcelles.find(p => p.id === selectedParcelleId) : null;
    const geometry = isExistingParcelle && targetParcelle?.latlngs
      ? { latlngs: targetParcelle.latlngs, area: targetParcelle.area / 10000 }
      : parcelleInfo;

    if (!geometry || !geometry.latlngs || geometry.latlngs.length < 3) {
      showToast("❌ Missing info - please reselect the parcel");
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
      showToast("❌ Crop type not selected"); setIsAnalyzing(false); return;
    }

    if ((geometry.area || 0) > MAX_PARCEL_AREA_HA) {
      showToast(`⚠️ Parcel too large: max ${MAX_PARCEL_AREA_HA} ha per parcel`);
      setIsAnalyzing(false);
      return;
    }

    const culture = CULTURES.find(c => c.id === cropGroupId);
    const cropType = CULTURES_TO_STRATEGIES[cropGroupId];
    if (!culture || !cropType) {
      showToast("❌ Invalid crop type"); setIsAnalyzing(false); return;
    }

    const customName = pendingParcelleInfo?.name || targetParcelle?.name || null;
    const polygonPoints = normalizeLatLngs(geometry.latlngs);

    const payload = { polygonPoints, cropType, samplingMode, parcelleName: customName };
    showToast("⏳ Calculating + saving...");

    try {
      const response = await fetch(`${API_BASE}/api/sampling/run-and-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          showToast("❌ Session expired. Please sign in again.");
          localStorage.removeItem("token"); localStorage.removeItem("user");
        } else {
          showToast(`❌ Erreur: ${errData.detail || response.statusText}`);
        }
        setIsAnalyzing(false); return;
      }

      const data = await response.json();

      if (data.zones?.length > 0) {
        setNZonesFromBackend(data.zones.length);
        setAnalyzedZones(data.zones);
        setSamplingColor(culture.color);
        clearSamplingMarkers();
        displayZones(data.zones, samplingMode);
        placeSamplePoints(data.zones, culture.color);
        setResultsOpen(true);

        // Prefetch satellite metrics for the parcel polygon to warm the cache used by SoilDiagnostic
        (async function prefetchSatelliteMetrics() {
          try {
            const safeCoords = polygonPoints;
            const parcelKey = customName || (parcelleInfo && parcelleInfo.name) || "parcelle";
            const coordsKey = JSON.stringify(safeCoords);
            const cacheKey = `sat:${parcelKey}:${coordsKey}`;
            // Do not block UI - check existing cache first
            const raw = localStorage.getItem(cacheKey);
            const CACHE_TTL = 1000 * 60 * 60 * 24;
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.ts && (Date.now() - parsed.ts) < CACHE_TTL) return; // fresh enough
            }

            const token = localStorage.getItem("token");
            const resp = await fetch(`${API_BASE}/api/satellite/soil-metrics`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
              },
              body: JSON.stringify({ polygonPoints: safeCoords }),
            });
            if (!resp.ok) return;
            const data = await resp.json();
            try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) { /* ignore quota */ }
          } catch (err) {
            console.warn('Prefetch satellite failed', err);
          }
        })();

        const totalPoints = data.zones.reduce((sum, z) => sum + (z.points?.length || 0), 0);
        const modeLabel = "standard";
        showToast(data.savedParcelleId
          ? `🔬 ${totalPoints} pts · ${data.zones.length} zone(s) + 💾 Parcel #${data.savedParcelleId} saved! (${modeLabel})`
          : `🔬 ${totalPoints} points generated in ${data.zones.length} zone(s)! (${modeLabel})`
        );
      } else {
        showToast("⚠️ No zone generated");
        setAnalyzedZones([]);
        clearSamplingMarkers();
        clearSampleMarkers();
        showToast("⚠️ No zone generated");
      }
    } catch (error) {
      console.error("Network Error:", error);
      showToast("❌ Network error");
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    parcelleInfo, selectedGroupId, samplingMode, pendingParcelleInfo,
    selectedParcelleId, parcelles, displayZones, placeSamplePoints,
    showToast, isAnalyzing, clearSampleMarkers, clearSamplingMarkers,
  ]);

  const exportSamplingKml = useCallback(async () => {
    if (!analyzedZones || analyzedZones.length === 0) {
      showToast("❌ Aucune parcelle analysée");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      showToast("❌ Veuillez vous connecter d'abord");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/sampling/export-kml`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          zones: analyzedZones,
          parcelleName: pendingParcelleInfo?.name || parcelleInfo?.name || "sampling-points",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || "KML export failed");
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${(pendingParcelleInfo?.name || parcelleInfo?.name || "sampling-points").trim().replace(/\s+/g, "-")}.kml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      showToast("✅ Fichier KML téléchargé");
    } catch (error) {
      console.error("KML export error:", error);
      showToast(`❌ ${error.message}`);
    }
  }, [analyzedZones, parcelleInfo, pendingParcelleInfo, showToast]);

  const handleStartSampling = useCallback(() => {
    if (!analyzedZones || analyzedZones.length === 0) {
      showToast("❌ Aucune parcelle analysée");
      return;
    }
    exportSamplingKml();
  }, [
    analyzedZones,
    exportSamplingKml,
    showToast,
  ]);

  const handleSelectWilaya = useCallback((wilaya) => {
    setSelectedWilaya(wilaya); flyToWilaya(wilaya);
    const zoneLabel = ZONE_COLORS[wilaya.zone]?.label || wilaya.zone;
    showToast(`📍 ${wilaya.name} Province · Zone ${zoneLabel}`);
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
          activeTool={activeTool}
          pendingParcelleInfo={pendingParcelleInfo}
          pendingColor={pendingColor}
          onToolClick={handleActivateTool}
          onSelectParcelle={handleSelectParcelle}
          onDeleteParcelle={handleDeleteParcelle}
          onGroupChange={handleGroupChange}
          onGenerate={handleAnalyze}
          onClearAll={handleClearAll}
          onSaveParcelle={handleSaveParcelle}
          onCancelDraw={handleCancelDraw}
          isAnalyzing={isAnalyzing}
          maxParcelAreaHa={MAX_PARCEL_AREA_HA}
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
        onStartSampling={handleStartSampling}
      />
      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}