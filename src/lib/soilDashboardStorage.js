export const SOIL_DASHBOARD_UPDATED_EVENT = "soil-dashboard-updated";

export function normalizeLatLngPoint(point) {
  if (Array.isArray(point)) {
    return { lat: Number(point[0]), lng: Number(point[1]) };
  }

  return {
    lat: Number(point?.lat),
    lng: Number(point?.lng),
  };
}

function buildParcelCoordsKey(parcelle) {
  return JSON.stringify(
    (parcelle?.latlngs || []).map((point) => normalizeLatLngPoint(point))
  );
}

function buildParcelStorageBase(parcelleName, parcelle, cultureGroupId) {
  // Include parcel id when available to ensure uniqueness across parcels
  const idPart = parcelle && parcelle.id ? String(parcelle.id) : "noid";
  return `${cultureGroupId}:${parcelleName || "parcel"}:${idPart}:${buildParcelCoordsKey(parcelle)}`;
}

export function getHistoryKey(parcelleName, parcelle, cultureGroupId) {
  return `soil-dashboard-history:${buildParcelStorageBase(parcelleName, parcelle, cultureGroupId)}`;
}

export function getCurrentAnalysisKey(parcelleName, parcelle, cultureGroupId) {
  return `soil-dashboard-current-analysis:${buildParcelStorageBase(parcelleName, parcelle, cultureGroupId)}`;
}

export function getDashboardStateKey(parcelleName, parcelle, cultureGroupId) {
  return `soil-dashboard-state:${buildParcelStorageBase(parcelleName, parcelle, cultureGroupId)}`;
}

export function readStoredDashboardState(parcelleName, parcelle, cultureGroupId) {
  if (!parcelle || !cultureGroupId) return null;

  try {
    const raw = localStorage.getItem(
      getDashboardStateKey(parcelleName, parcelle, cultureGroupId)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.warn("Dashboard state load failed:", error);
    return null;
  }
}

export function hasStoredDashboardAnalysis(parcelleName, parcelle, cultureGroupId) {
  const stored = readStoredDashboardState(parcelleName, parcelle, cultureGroupId);
  return !!stored?.zoneResults?.length;
}

/**
 * Check if a parcelle has completed analysis for all zones
 * Returns true if all zones have zone results (no null values in zoneResults)
 */
export function isParcelleAnalysisComplete(parcelleName, parcelle, cultureGroupId, nZones = 1) {
  const stored = readStoredDashboardState(parcelleName, parcelle, cultureGroupId);
  
  if (!stored || !Array.isArray(stored.zoneResults)) {
    return false;
  }
  
  const zoneResults = stored.zoneResults;
  const expectedZones = stored.nZones || nZones || 1;
  
  // All zones must have results (not null/undefined)
  if (zoneResults.length < expectedZones) {
    return false;
  }
  
  return zoneResults.slice(0, expectedZones).every(result => result !== null && result !== undefined);
}

export function dispatchDashboardUpdated(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(SOIL_DASHBOARD_UPDATED_EVENT, { detail })
    );
  } catch (error) {
    console.warn("Dashboard update event dispatch failed:", error);
  }
}
