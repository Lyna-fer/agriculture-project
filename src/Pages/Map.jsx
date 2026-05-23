import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/map.css";
import LeftPanel from "../components/map/LeftPanel";
import MapView from "../components/map/MapView";
import ResultsPanel from "../components/map/ResultsPanel";
import SoilDiagnostic from "../components/map/SoilDiagnostic";
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
import {
  isParcelleAnalysisComplete,
  SOIL_DASHBOARD_UPDATED_EVENT,
  getDashboardStateKey,
  getHistoryKey,
  getCurrentAnalysisKey,
} from "../lib/soilDashboardStorage";
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
const formatApiError = (fallbackMessage, response, errData) => {
  const detail = errData?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.msg || item.message || item.detail || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("; ");
    if (joined) return joined;
  }
  if (detail && typeof detail === "object") {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  return response?.statusText || fallbackMessage;
};
const normalizeLatLngPairs = (latlngs) => {
  if (!Array.isArray(latlngs)) return [];
  return latlngs
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        return [Number(point[0]), Number(point[1])];
      }
      if (point && typeof point === "object" && "lat" in point && "lng" in point) {
        return [Number(point.lat), Number(point.lng)];
      }
      return null;
    })
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
};

const buildParcelSignature = (parcelle, parcelleName = "") => {
  if (!parcelle) return "";

  const idPart = parcelle.id != null ? `id:${String(parcelle.id)}` : "id:unknown";
  const namePart = `name:${String(parcelle.name || parcelleName || "").trim().toLowerCase()}`;
  const groupPart = parcelle.groupId != null ? `group:${String(parcelle.groupId)}` : "group:unknown";
  const coordsPart = Array.isArray(parcelle.latlngs) && parcelle.latlngs.length > 0
    ? `coords:${JSON.stringify(normalizeLatLngPairs(parcelle.latlngs))}`
    : "coords:empty";

  return [idPart, namePart, groupPart, coordsPart].join("|");
};

const buildDashboardSnapshotFromRow = (row) => {
  const metrics = row?.soilMetrics || {};
  return {
    id: String(row?.id ?? ""),
    fingerprint: String(row?.id ?? ""),
    timestamp: row?.analyzedAt || null,
    zoneIndex: Number.isFinite(Number(row?.zoneIndex)) ? Number(row.zoneIndex) : null,
    diagMode: row?.diagMode || "standard",
    targetCropId: row?.targetCropId ?? null,
    targetCropMode: metrics.analysisCropMode || (row?.targetCropId ? "manual" : "recommended"),
    avgScore: Number(row?.compatibilityScore || 0),
    avgPh: metrics.ph,
    avgLime: metrics.lime,
    avgCe: metrics.ce,
    avgN: metrics.n,
    avgP: metrics.p,
    avgK: metrics.k,
    avgPb: metrics.pb,
    avgCd: metrics.cd,
    depthAverages: metrics.permanentDepths || null,
  };
};

const averageSnapshotMetric = (zoneResults, key) => {
  const values = zoneResults
    .filter(Boolean)
    .map((zone) => Number(zone?.[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const averageSnapshotDepthMetric = (zoneResults, depthKey, metricKey) => {
  const values = zoneResults
    .filter(Boolean)
    .map((zone) => Number(zone?.permanentDepths?.[depthKey]?.[metricKey]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const buildParcelAnalysisSnapshot = ({
  rowsByZone,
  parcelle,
  parcelleName,
  parcelleHa,
  parcelSignature,
  nZones,
}) => {
  const zoneResults = Array(Math.max(1, nZones)).fill(null);
  const rows = [];

  rowsByZone.forEach(({ zoneIndex, row }) => {
    if (!Number.isInteger(zoneIndex) || !row) return;
    const metrics = row.soilMetrics || null;
    zoneResults[zoneIndex] = metrics
      ? {
          ...metrics,
          analysisCropId: metrics.analysisCropId || row.targetCropId || null,
          analysisCropMode:
            metrics.analysisCropMode ||
            (metrics.crop ? "manual" : row.targetCropId ? "recommended" : null),
        }
      : null;
    rows.push({ zoneIndex, row });
  });

  if (!rows.length) return null;

  const completed = zoneResults.filter(Boolean);
  const latestRow = rows
    .slice()
    .sort((a, b) => new Date(b.row?.analyzedAt || 0).getTime() - new Date(a.row?.analyzedAt || 0).getTime())[0];
  const timestamp = latestRow?.row?.analyzedAt || null;
  const fingerprint = rows
    .map(({ row }) => String(row?.id ?? ""))
    .filter(Boolean)
    .join("|");
  const hasPermanentDepths = completed.some((zone) => zone?.permanentDepths);

  return {
    id: fingerprint || String(timestamp || Date.now()),
    fingerprint: fingerprint || String(timestamp || Date.now()),
    timestamp,
    zoneIndex: latestRow?.zoneIndex ?? 0,
    diagMode: latestRow?.row?.diagMode || "standard",
    targetCropId: latestRow?.row?.targetCropId ?? null,
    parcelleId: parcelle?.id ?? null,
    parcelleName: parcelleName ?? null,
    parcelSignature,
    parcelle,
    parcelleHa,
    nZones: Math.max(1, nZones),
    zoneCount: completed.length,
    zoneResults,
    avgScore: rows.length
      ? Math.round(
          rows
            .map(({ row }) => Number(row?.compatibilityScore))
            .filter((value) => Number.isFinite(value))
            .reduce((sum, value, _, arr) => sum + value / Math.max(1, arr.length), 0)
        )
      : 0,
    avgPh: averageSnapshotMetric(completed, "ph"),
    avgCe: averageSnapshotMetric(completed, "ce"),
    avgN: averageSnapshotMetric(completed, "n"),
    avgP: averageSnapshotMetric(completed, "p"),
    avgK: averageSnapshotMetric(completed, "k"),
    avgLime: averageSnapshotMetric(completed, "lime"),
    avgPb: averageSnapshotMetric(completed, "pb"),
    avgCd: averageSnapshotMetric(completed, "cd"),
    depthAverages: hasPermanentDepths
      ? {
          depth0_20: {
            ph: averageSnapshotDepthMetric(completed, "depth0_20", "ph"),
            ce: averageSnapshotDepthMetric(completed, "depth0_20", "ce"),
            n: averageSnapshotDepthMetric(completed, "depth0_20", "n"),
            p: averageSnapshotDepthMetric(completed, "depth0_20", "p"),
            k: averageSnapshotDepthMetric(completed, "depth0_20", "k"),
            lime: averageSnapshotDepthMetric(completed, "depth0_20", "lime"),
            pb: averageSnapshotDepthMetric(completed, "depth0_20", "pb"),
            cd: averageSnapshotDepthMetric(completed, "depth0_20", "cd"),
          },
          depth20_40: {
            ph: averageSnapshotDepthMetric(completed, "depth20_40", "ph"),
            ce: averageSnapshotDepthMetric(completed, "depth20_40", "ce"),
            n: averageSnapshotDepthMetric(completed, "depth20_40", "n"),
            p: averageSnapshotDepthMetric(completed, "depth20_40", "p"),
            k: averageSnapshotDepthMetric(completed, "depth20_40", "k"),
            lime: averageSnapshotDepthMetric(completed, "depth20_40", "lime"),
            pb: averageSnapshotDepthMetric(completed, "depth20_40", "pb"),
            cd: averageSnapshotDepthMetric(completed, "depth20_40", "cd"),
          },
        }
      : null,
  };
};

const buildDashboardSessionFromDb = ({
  parcelle,
  parcelleName,
  parcelleHa,
  cultureGroupId,
  responseData,
  mapSnapshot,
  zones,
  weatherData,
}) => {
  const zoneEntries = Object.entries(responseData || {})
    .map(([zoneKey, rows]) => {
      const zoneIndex = Number(zoneKey.replace("zone_", ""));
      const zoneRows = Array.isArray(rows) ? rows : [];
      const latestRow = zoneRows[0] || null;
      return {
        zoneIndex,
        latestRow,
        snapshots: zoneRows.slice(0, 2).map((row) => ({
          ...buildDashboardSnapshotFromRow(row),
          zoneIndex,
        })).filter(Boolean),
      };
    })
    .filter((entry) => Number.isInteger(entry.zoneIndex) && entry.latestRow);
  const parcelSignature = buildParcelSignature(parcelle, parcelleName);
  const historyDepth = zoneEntries.reduce(
    (max, entry) => Math.max(max, Array.isArray(entry.snapshots) ? entry.snapshots.length : 0),
    0
  );
  const parcelAnalysisHistory = Array.from({ length: historyDepth }, (_, historyIndex) =>
    buildParcelAnalysisSnapshot({
      rowsByZone: zoneEntries
        .map((entry) => ({
          zoneIndex: entry.zoneIndex,
          row: Array.isArray(responseData?.[`zone_${entry.zoneIndex}`])
            ? responseData[`zone_${entry.zoneIndex}`][historyIndex] || null
            : null,
        }))
        .filter((entry) => entry.row),
      parcelle,
      parcelleName,
      parcelleHa,
      parcelSignature,
      nZones: Math.max(1, zoneEntries.length || zones?.length || 1),
    })
  ).filter(Boolean);
  const currentAnalysis = parcelAnalysisHistory[0] || null;
  const activeZone = currentAnalysis?.zoneIndex ?? 0;

  return {
    savedAt: new Date().toISOString(),
    parcelSignature,
    activeZone,
    diagMode: currentAnalysis?.diagMode || "standard",
    parcelleName,
    parcelleHa,
    cultureGroupId,
    parcelle,
    mapSnapshot,
    zones,
    nZones: Math.max(1, currentAnalysis?.zoneResults?.length || zones?.length || 1),
    zoneResults: currentAnalysis?.zoneResults?.length
      ? currentAnalysis.zoneResults
      : Array(Math.max(1, zones?.length || 1)).fill(null),
    currentAnalysis,
    analysisHistory: parcelAnalysisHistory,
    weatherData: weatherData || null,
  };
};
export default function Map() {
  useEffect(() => { document.body.className = "page-map"; }, []);
  const navigate = useNavigate();
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
  const [analyzedParcelle,   setAnalyzedParcelle]    = useState(null);
  const [analysisMapSnapshot,setAnalysisMapSnapshot] = useState(null);
  const [samplingColor,      setSamplingColor]       = useState("#2ecc71");
  const [parcelWeather,      setParcelWeather]       = useState(null);
  const [storedDashboardSession, setStoredDashboardSession] = useState(null);
  const [storedDashboardOpen, setStoredDashboardOpen] = useState(false);
  const [dashboardReadyForSelected, setDashboardReadyForSelected] = useState(false);
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
        console.warn("⚠️ Could not fetch parcelles from DB: ", error);
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
  // Check if selected parcel has a complete analysis
  useEffect(() => {
    if (!selectedParcelleId) {
      setDashboardReadyForSelected(false);
      return;
    }
    const selectedParcelle = parcelles.find(p => p.id === selectedParcelleId);
    if (!selectedParcelle) {
      setDashboardReadyForSelected(false);
      return;
    }

    // Check if this parcel has a complete analysis stored
    const cultureGroupId = Number(selectedParcelle.groupId || 1);
    const isComplete = isParcelleAnalysisComplete(
      selectedParcelle.name,
      selectedParcelle,
      cultureGroupId,
      1 // minimum 1 zone
    );

    setDashboardReadyForSelected(isComplete);
  }, [selectedParcelleId, parcelles]);
  const selectedParcelle = parcelles.find((p) => p.id === selectedParcelleId) ?? null;
  const selectedParcelSignature = buildParcelSignature(
    selectedParcelle || pendingParcelleInfo,
    selectedParcelle?.name || pendingParcelleInfo?.name || "Parcel"
  );
  const activeDashboardParcelSignature = storedDashboardSession?.parcelSignature || selectedParcelSignature;
  // Listen for dashboard updates to refresh the ready status
  useEffect(() => {
    const handleDashboardUpdated = () => {
      // Re-check if the selected parcel's dashboard is ready
      if (selectedParcelleId) {
        const selectedParcelle = parcelles.find(p => p.id === selectedParcelleId);
        if (selectedParcelle) {
          const cultureGroupId = Number(selectedParcelle.groupId || 1);
          const isComplete = isParcelleAnalysisComplete(
            selectedParcelle.name,
            selectedParcelle,
            cultureGroupId,
            1
          );
          setDashboardReadyForSelected(isComplete);
        }
      }
    };
    window.addEventListener(SOIL_DASHBOARD_UPDATED_EVENT, handleDashboardUpdated);
    return () => {
      window.removeEventListener(SOIL_DASHBOARD_UPDATED_EVENT, handleDashboardUpdated);
    };
  }, [selectedParcelleId, parcelles]);
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
    setAnalyzedParcelle(null);
    setAnalysisMapSnapshot(null);
    setSamplingColor(color);
    setResultsOpen(false);
    const ha = info.area || 0;
    showToast(`✅ Parcel drawn - ${ha < 0.1 ? info.areaM2?.toFixed(0) + " m²" : ha.toFixed(2) + " ha"} · Give it a name`);
  }, [showToast]);
  const {
    mapRef, placeSamplePoints, clearSampleMarkers, activateDrawTool, clearAll,
    flyToWilaya, displayZones, clearZones, drawParcelleFromLatLngs,
    clearSamplingMarkers, drawAllParcelles, clearAllParcelles, clearSelectedParcelle, getMapSnapshot,
  } = useMap({ onParcelleChange: handleParcelleChange, maxParcelAreaHa: MAX_PARCEL_AREA_HA });
  // Listen for parcel click events dispatched by the map hook and select parcel in UI
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const handler = (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      // Clear previous sampling overlays
      try { clearZones(); clearSampleMarkers(); clearSamplingMarkers(); } catch (err) { console.warn(err); }
      setSelectedParcelleId(id);
      const p = parcelles.find(x => x.id === id);
      if (p && p.latlngs && p.latlngs.length > 0) {
        setSelectedGroupId(p.groupId || selectedGroupId);
        const stats = drawParcelleFromLatLngs(p.latlngs, p.color || pendingColor);
        if (stats) { setParcelleInfo({ ...stats, name: p.name, type: "polygon" }); }
      }
      setResultsOpen(false);
    };
    el.addEventListener('parcelle-click', handler);
    return () => el.removeEventListener('parcelle-click', handler);
  }, [mapRef, parcelles, clearZones, clearSampleMarkers, clearSamplingMarkers, drawParcelleFromLatLngs, pendingColor, selectedGroupId]);
  useEffect(() => {
    if (parcelles.length > 0) {
      drawAllParcelles(parcelles, selectedParcelleId);
    } else {
      clearAllParcelles();
    }
  }, [parcelles, selectedParcelleId, drawAllParcelles, clearAllParcelles]);
  // Clear any previously-loaded stored dashboard when user selects a different parcel
  useEffect(() => {
    setStoredDashboardSession(null);
    setStoredDashboardOpen(false);
  }, [selectedParcelleId]);
  // Also clear stored dashboard when the user starts editing/creating a new parcel
  useEffect(() => {
    if (pendingParcelleInfo) {
      setStoredDashboardSession(null);
      setStoredDashboardOpen(false);
    }
  }, [pendingParcelleInfo]);
  const handleActivateTool = useCallback((tool) => {
    setActiveTool(tool);
    if (tool) { activateDrawTool(tool); setPendingParcelleInfo(null); setResultsOpen(false); }
    else { activateDrawTool(null); }
  }, [activateDrawTool]);
  const handleSaveParcelle = useCallback(async ({ name, groupId }) => {
    if (!pendingParcelleInfo) return;
    if ((pendingParcelleInfo.area || 0) > MAX_PARCEL_AREA_HA) {
      showToast(`⚠️ Parcel too large: max ${MAX_PARCEL_AREA_HA} ha per parcel`);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("❌ Please sign in first");
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/parcels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          polygonPoints: normalizeLatLngPairs(pendingParcelleInfo.latlngs),
          areaHa: pendingParcelleInfo.area || 0,
          groupId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(formatApiError("Parcel save failed", response, errData));
      }

      const savedParcel = await response.json();
      const newP = {
        ...savedParcel,
        color: pendingColor,
      };
// ... inside handleSaveParcelle, after response.ok check and before showToast ...
// ✅ MIGRATE TEMP LOCALSTORAGE KEY TO PERMANENT DB ID KEY
try {
const oldTempKey = getDashboardStateKey(name, pendingParcelleInfo, cultureGroupId);
const oldHistoryKey = getHistoryKey(name, pendingParcelleInfo, cultureGroupId);
const oldCurrentKey = getCurrentAnalysisKey(name, pendingParcelleInfo, cultureGroupId);
// If temp keys exist, copy them to permanent keys & cleanup
const tempState = localStorage.getItem(oldTempKey);
if (tempState && newP.id) {
const newPermKey = getDashboardStateKey(name, newP, cultureGroupId);
const newHistKey = getHistoryKey(name, newP, cultureGroupId);
const newCurrKey = getCurrentAnalysisKey(name, newP, cultureGroupId);
localStorage.setItem(newPermKey, tempState);
const tempHist = localStorage.getItem(oldHistoryKey);
if (tempHist) localStorage.setItem(newHistKey, tempHist);
const tempCurr = localStorage.getItem(oldCurrentKey);
if (tempCurr) localStorage.setItem(newCurrKey, tempCurr);

// Clean up old temp keys
localStorage.removeItem(oldTempKey);
localStorage.removeItem(oldHistoryKey);
localStorage.removeItem(oldCurrentKey);
console.log("🔄 Migrated dashboard storage from temp key to permanent ID key");
}
} catch (e) {
console.warn("⚠️ Key migration failed (non-critical):", e);
}
// ... continue with existing setParcelles, setSelectedParcelleId, etc.
setParcelles((prev) => {
const withoutDuplicate = prev.filter((parcel) => parcel.id !== newP.id);
return [...withoutDuplicate, newP];
});
setSelectedParcelleId(newP.id);
setSelectedGroupId(groupId);
setPendingParcelleInfo(null);
setParcelleInfo(null);
setAnalyzedParcelle(null);
setAnalysisMapSnapshot(null);
setResultsOpen(false);
clearSelectedParcelle();
showToast(`✅ ${name} saved`);
} catch (error) {
console.error("Parcel save error:", error);
showToast(`❌ ${error.message}`);
}
}, [pendingParcelleInfo, pendingColor, showToast, clearSelectedParcelle]);
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
        console.error("❌ Bulk delete error: ", error);
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
    setAnalyzedParcelle(null);
    setAnalysisMapSnapshot(null);
    setSamplingColor("#2ecc71");
    setParcelWeather(null);
  }, [parcelles, clearAll, clearZones, showToast, setNZonesFromBackend]);
  const handleSelectParcelle = useCallback((id) => {
    if (id === selectedParcelleId) {
      setSelectedParcelleId(null);
      setParcelleInfo(null);
      setResultsOpen(false);
      clearSelectedParcelle();
      return;
    }
    // Clear any sampling overlays from previously selected parcel
    try {
      clearZones();
      clearSampleMarkers();
      clearSamplingMarkers();
    } catch (e) {
      console.warn('Could not clear sampling overlays on parcel select', e);
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

    if (!isExistingParcelle || !targetParcelle?.id) {
      showToast("❌ Save the parcel first before generating the sampling guide");
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

    const payload = { polygonPoints, cropType, samplingMode, parcelleName: customName, groupId: cropGroupId, parcelleId: targetParcelle.id };
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
        const totalAreaSqm = Number(data.totalAreaHa || 0) * 10000;
        if (data.savedParcelleId && Number.isFinite(totalAreaSqm) && totalAreaSqm > 0) {
          setParcelles((prev) =>
            prev.map((parcel) =>
              parcel.id === data.savedParcelleId
                ? { ...parcel, area: totalAreaSqm }
                : parcel
            )
          );
        }

        setNZonesFromBackend(data.zones.length);
        setAnalyzedZones(data.zones);
        setAnalyzedParcelle({
          ...(targetParcelle || {}),
          name: customName || targetParcelle?.name || parcelleInfo?.name || "Parcelle",
          latlngs: geometry.latlngs,
          area: totalAreaSqm || (geometry.area || 0) * 10000,
          groupId: cropGroupId,
        });
        setAnalysisMapSnapshot(getMapSnapshot());
        setSamplingColor(culture.color);
        clearSamplingMarkers();
        displayZones(data.zones, samplingMode);
        placeSamplePoints(data.zones, culture.color);

        try {
          const weatherResponse = await fetch(`${API_BASE}/api/weather/parcel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ polygonPoints }),
          });
          setParcelWeather(weatherResponse.ok ? await weatherResponse.json() : null);
        } catch (weatherError) {
           console.warn("Parcel weather fetch failed: ", weatherError);
          setParcelWeather(null);
        }

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
        setAnalyzedParcelle(null);
        setAnalysisMapSnapshot(null);
        setParcelWeather(null);
        clearSamplingMarkers();
        clearSampleMarkers();
        showToast("⚠️ No zone generated");
      }
    } catch (error) {
      console.error("Network Error: ", error);
      showToast("❌ Network error");
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    parcelleInfo, selectedGroupId, samplingMode, pendingParcelleInfo,
    selectedParcelleId, parcelles, displayZones, placeSamplePoints,
    showToast, isAnalyzing, clearSampleMarkers, clearSamplingMarkers, getMapSnapshot,
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
      console.error("KML export error: ", error);
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
  const selectedParcelDashboardReady = dashboardReadyForSelected;

  const handleOpenStoredDashboard = useCallback(async () => {
    if (!selectedParcelle) {
      showToast("❌ Select a parcel first");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      showToast("❌ Please sign in again to load the dashboard");
      return;
    }

    const cultureGroupId = Number(selectedParcelle.groupId || selectedGroupId);
    const cachedStateKey = getDashboardStateKey(selectedParcelle.name, selectedParcelle, cultureGroupId);
    const selectedParcelSignature = buildParcelSignature(selectedParcelle, selectedParcelle?.name || "Parcel");

    const findStoredDashboardFallback = () => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith("soil-dashboard-state:")) continue;
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const cachedParcel = parsed?.parcelle || null;
          const cachedSignature = parsed?.parcelSignature || buildParcelSignature(cachedParcel, parsed?.parcelleName || "Parcel");
          const idMatch = cachedParcel?.id != null && selectedParcelle?.id != null && String(cachedParcel.id) === String(selectedParcelle.id);
          const signatureMatch = cachedSignature && cachedSignature === selectedParcelSignature;
          if ((idMatch || signatureMatch) && parsed?.zoneResults?.length > 0) {
            return parsed;
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not search local dashboard fallback:", error);
      }
      return null;
    };

    // 🔍 Robust parcel matching (ID-first, then normalized coordinates)
    const isParcelMatch = (cached, current) => {
      if (!cached || !current) return false;

      // 1. Match by ID (100% reliable for saved parcels)
      if (cached.id && current.id) {
        return String(cached.id) === String(current.id);
      }

      // 2. Fallback: Match by normalized coordinates
      const normalize = (coords) => {
        if (!Array.isArray(coords)) return [];
        return coords.map(pt => {
          if (Array.isArray(pt)) return { lat: Number(pt[0]), lng: Number(pt[1]) };
          if (pt && typeof pt === "object") return { lat: Number(pt.lat ?? pt[0]), lng: Number(pt.lng ?? pt[1]) };
          return null;
        }).filter(Boolean);
      };

      const a = normalize(cached.latlngs);
      const b = normalize(current.latlngs);
      if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;

      const EPSILON = 0.00001; // ~1 meter precision tolerance
      return a.every((pa, i) =>
        Math.abs(pa.lat - b[i].lat) < EPSILON && Math.abs(pa.lng - b[i].lng) < EPSILON
      );
    };

    try {
      const rawCache = localStorage.getItem(cachedStateKey);
      if (rawCache) {
        const parsedState = JSON.parse(rawCache);
        console.debug('[Map] loaded cached dashboard', { cachedStateKey, parsedParcelId: parsedState?.parcelle?.id, parsedParcelSignature: parsedState?.parcelSignature, selectedParcelleId: selectedParcelle?.id });
        if (!parsedState) return;

        const cachedParcel = parsedState.parcelle || null;
        const cachedParcelSignature = parsedState.parcelSignature || buildParcelSignature(cachedParcel, parsedState?.parcelleName || "Parcel");
        const selectedParcelSignature = buildParcelSignature(selectedParcelle, selectedParcelle?.name || "Parcel");
        const idsMatch = cachedParcel && cachedParcel.id && selectedParcelle && selectedParcelle.id && String(cachedParcel.id) === String(selectedParcelle.id);
        const coordsMatch = cachedParcel && cachedParcel.latlngs && selectedParcelle && selectedParcelle.latlngs && coordsEqual(cachedParcel.latlngs, selectedParcelle.latlngs);
        const signatureMatch = cachedParcelSignature && selectedParcelSignature && cachedParcelSignature === selectedParcelSignature;

        if ((signatureMatch || idsMatch || coordsMatch) && parsedState?.zoneResults?.length > 0) {
          console.log("✅ Loading dashboard from local cache (verified parcel match)");
          setStoredDashboardSession(parsedState);
          setStoredDashboardOpen(true);
          return;
        }
      }
    } catch (e) {
      console.warn("⚠️ Could not load from localStorage:", e);
    }

    // 🌐 Fallback: Fetch from DB if not in cache or parcel mismatched
    try {
      const response = await fetch(`${API_BASE}/api/analysis/parcel/${selectedParcelle.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const fallbackSession = findStoredDashboardFallback();
        if (fallbackSession) {
          setStoredDashboardSession(fallbackSession);
          setStoredDashboardOpen(true);
          console.log("✅ Loaded dashboard from local fallback after DB miss");
          return;
        }
        showToast("❌ This parcel does not have a saved dashboard yet");
        return;
      }

      const data = await response.json();
      const hasData = data && Object.values(data).some((rows) => Array.isArray(rows) && rows.length > 0);

      if (!hasData) {
        const fallbackSession = findStoredDashboardFallback();
        if (fallbackSession) {
          setStoredDashboardSession(fallbackSession);
          setStoredDashboardOpen(true);
          console.log("✅ Loaded dashboard from local fallback after empty DB response");
          return;
        }
        showToast("❌ This parcel does not have a saved dashboard yet");
        return;
      }

      const storedSession = buildDashboardSessionFromDb({
        parcelle: selectedParcelle,
        parcelleName: selectedParcelle.name,
        parcelleHa: (selectedParcelle.area || 0) / 10000,
        cultureGroupId,
        responseData: data,
        mapSnapshot: analysisMapSnapshot,
        zones: analyzedZones,
        weatherData: parcelWeather,
      });

      // 💾 Cache DB response for offline/future use
      try {
        localStorage.setItem(cachedStateKey, JSON.stringify(storedSession));
        if (storedSession.analysisHistory?.length > 0) {
          localStorage.setItem(
            getHistoryKey(selectedParcelle.name, selectedParcelle, cultureGroupId),
            JSON.stringify(storedSession.analysisHistory)
          );
        }
        if (storedSession.currentAnalysis) {
          localStorage.setItem(
            getCurrentAnalysisKey(selectedParcelle.name, selectedParcelle, cultureGroupId),
            JSON.stringify(storedSession.currentAnalysis)
          );
        }
      } catch (e) {
        console.warn("⚠️ Could not cache dashboard to localStorage:", e);
      }

      setStoredDashboardSession(storedSession);
      setStoredDashboardOpen(true);
    } catch (error) {
      console.warn("Failed to load dashboard from DB:", error);
      showToast("❌ Could not load dashboard data");
    }
  }, [analysisMapSnapshot, analyzedZones, parcelWeather, selectedGroupId, selectedParcelle, showToast]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);
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
          selectedParcelleData={selectedParcelle}
          dashboardEnabled={selectedParcelDashboardReady}
          onOpenDashboard={handleOpenStoredDashboard}
          onLogout={handleLogout}
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
        parcelle={analyzedParcelle || selectedParcelle}
        mapSnapshot={analysisMapSnapshot}
        zones={analyzedZones}
        nZones={nZonesFromBackend}
        onStartSampling={handleStartSampling}
        weatherData={parcelWeather}
      />
      <SoilDiagnostic
        key={activeDashboardParcelSignature || `${storedDashboardOpen ? "dashboard" : "analysis"}`}
        open={storedDashboardOpen}
        onClose={() => setStoredDashboardOpen(false)}
        parcelleName={storedDashboardSession?.parcelleName || selectedParcelle?.name || pendingParcelleInfo?.name || "Parcel"}
        parcelleHa={storedDashboardSession?.parcelleHa || (selectedParcelle?.area || pendingParcelleInfo?.area || 0) / 10000}
        cultureGroupId={storedDashboardSession?.cultureGroupId || Number(selectedParcelle?.groupId || selectedGroupId || 1)}
        parcelle={pendingParcelleInfo || storedDashboardSession?.parcelle || selectedParcelle}
        mapSnapshot={storedDashboardSession?.mapSnapshot || null}
        zones={storedDashboardSession?.zones || []}
        nZones={storedDashboardSession?.nZones || storedDashboardSession?.zoneResults?.length || 1}
        initialDiagMode={storedDashboardSession?.diagMode || "standard"}
        weatherData={storedDashboardSession?.weatherData || null}
        persistedDashboardData={storedDashboardSession}
        startInDashboard
      />
      <Toast message={toast.msg} visible={toast.visible} />
    </>
  );
}
