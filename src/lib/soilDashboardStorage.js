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
  return `${cultureGroupId}:${parcelleName || "parcel"}:${buildParcelCoordsKey(parcelle)}`;
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

export function dispatchDashboardUpdated(detail = {}) {
  try {
    window.dispatchEvent(
      new CustomEvent(SOIL_DASHBOARD_UPDATED_EVENT, { detail })
    );
  } catch (error) {
    console.warn("Dashboard update event dispatch failed:", error);
  }
}
