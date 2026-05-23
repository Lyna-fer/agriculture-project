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
  if (parcelle?.id) {
    return `${cultureGroupId}:parcel:${parcelle.id}`;
  }

  const namePart = (parcelleName || "unnamed").trim().toLowerCase().replace(/\s+/g, "_");
  const coordsKey = buildParcelCoordsKey(parcelle);

  if (coordsKey && coordsKey !== "[]") {
    return `${cultureGroupId}:parcel:draft:${namePart}:${coordsKey}`;
  }

  return `${cultureGroupId}:parcel:draft:${namePart}`;
}

function isHistoryItemForParcel(item, parcelleName, parcelle, cultureGroupId) {
  if (!item) return false;

  if (parcelle?.id != null && item.parcelleId != null) {
    return Number(item.parcelleId) === Number(parcelle.id);
  }

  const expectedSig = buildParcelStorageBase(parcelleName, parcelle, cultureGroupId);
  if (item.parcelSignature) {
    return item.parcelSignature === expectedSig;
  }

  if (parcelleName && item.parcelleName) {
    return item.parcelleName === parcelleName;
  }

  return false;
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
    const raw = localStorage.getItem(getDashboardStateKey(parcelleName, parcelle, cultureGroupId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Dashboard state load failed:", error);
    return null;
  }
}

export function getDashboardHistory(parcelleName, parcelle, cultureGroupId) {
  if (!parcelle || !cultureGroupId) return { current: null, previous: null };

  try {
    const historyKey = getHistoryKey(parcelleName, parcelle, cultureGroupId);
    console.debug("[soilDashboardStorage] getDashboardHistory reading key=", historyKey);
    const raw = localStorage.getItem(historyKey);

    if (!raw) {
      if (parcelle?.id == null) {
        return { current: null, previous: null };
      }
      const legacy = readStoredDashboardState(parcelleName, parcelle, cultureGroupId);
      return { current: legacy, previous: null };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { current: null, previous: null };
    }

    let filtered = parsed;

    try {
      const expectedSig = buildParcelStorageBase(parcelleName, parcelle, cultureGroupId);
      filtered = parsed.filter((item) => {
        const match = isHistoryItemForParcel(item, parcelleName, parcelle, cultureGroupId);
        if (!match) {
          console.debug("[soilDashboardStorage] history item rejected for parcel", {
            fingerprint: item?.fingerprint,
            itemParcelleId: item?.parcelleId,
            expectedParcelleId: parcelle?.id ?? null,
            itemSignature: item?.parcelSignature,
            expectedSignature: expectedSig,
            itemName: item?.parcelleName,
            expectedName: parcelleName,
          });
        }
        return match;
      });
    } catch (error) {
      filtered = parsed;
    }

    const history = filtered.slice(-2);
    return {
      previous: history.length > 1 ? history[0] : null,
      current: history.length > 0 ? history[history.length - 1] : null,
    };
  } catch (error) {
    console.warn("Dashboard history load failed:", error);
    return { current: null, previous: null };
  }
}

export function saveDashboardState(parcelleName, parcelle, cultureGroupId, newState) {
  if (!parcelle || !cultureGroupId || !newState) return;

  try {
    const historyKey = getHistoryKey(parcelleName, parcelle, cultureGroupId);
    const raw = localStorage.getItem(historyKey);
    let historyArray = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(historyArray)) historyArray = [];
    historyArray = historyArray.filter((item) =>
      isHistoryItemForParcel(item, parcelleName, parcelle, cultureGroupId)
    );

    const parcelSig = buildParcelStorageBase(parcelleName, parcelle, cultureGroupId);
    const annotatedState = {
      ...newState,
      zoneResults: Array.isArray(newState?.zoneResults) ? [...newState.zoneResults] : [],
      parcelle,
      parcelleId: parcelle?.id ?? null,
      parcelleName: parcelleName ?? null,
      parcelSignature: parcelSig,
      nZones: Number.isFinite(Number(newState?.nZones))
        ? Number(newState.nZones)
        : Array.isArray(newState?.zoneResults)
        ? newState.zoneResults.length
        : null,
      zoneIndex: Number.isFinite(Number(newState?.zoneIndex))
        ? Number(newState.zoneIndex)
        : Number.isFinite(Number(newState?.activeZone))
        ? Number(newState.activeZone)
        : null,
    };

    console.debug("[soilDashboardStorage] saveDashboardState writing key=", historyKey, {
      parcelleId: annotatedState.parcelleId,
      parcelSignature: parcelSig,
      fingerprint: annotatedState.fingerprint,
    });

    historyArray.push(annotatedState);
    const trimmed = historyArray.slice(-2);

    localStorage.setItem(historyKey, JSON.stringify(trimmed));
    localStorage.setItem(
      getCurrentAnalysisKey(parcelleName, parcelle, cultureGroupId),
      JSON.stringify(annotatedState)
    );
    localStorage.setItem(
      getDashboardStateKey(parcelleName, parcelle, cultureGroupId),
      JSON.stringify({
        ...annotatedState,
        analysisHistory: trimmed,
        parcelSignature: parcelSig,
      })
    );
  } catch (error) {
    console.warn("Dashboard state save failed:", error);
  }
}

export function dispatchDashboardUpdated(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(SOIL_DASHBOARD_UPDATED_EVENT, { detail }));
  } catch (error) {
    console.warn("Dashboard update event dispatch failed:", error);
  }
}

export function hasStoredDashboardAnalysis(parcelleName, parcelle, cultureGroupId) {
  const { current } = getDashboardHistory(parcelleName, parcelle, cultureGroupId);
  return !!current?.zoneResults?.length;
}

export function isParcelleAnalysisComplete(parcelleName, parcelle, cultureGroupId, nZones = 1) {
  const { current } = getDashboardHistory(parcelleName, parcelle, cultureGroupId);

  if (!current || !Array.isArray(current.zoneResults)) {
    const legacy = readStoredDashboardState(parcelleName, parcelle, cultureGroupId);
    if (!legacy || !Array.isArray(legacy.zoneResults)) return false;
    const expected = legacy.nZones || nZones || 1;
    return legacy.zoneResults.slice(0, expected).every((r) => r !== null && r !== undefined);
  }

  const expected = current.nZones || nZones || 1;
  return current.zoneResults.slice(0, expected).every((r) => r !== null && r !== undefined);
}

export function clearDashboardHistory(parcelleName, parcelle, cultureGroupId) {
  if (!parcelle || !cultureGroupId) return;

  try {
    localStorage.removeItem(getHistoryKey(parcelleName, parcelle, cultureGroupId));
    localStorage.removeItem(getDashboardStateKey(parcelleName, parcelle, cultureGroupId));
    localStorage.removeItem(getCurrentAnalysisKey(parcelleName, parcelle, cultureGroupId));
  } catch (error) {
    console.warn("Failed to clear dashboard history:", error);
  }
}
