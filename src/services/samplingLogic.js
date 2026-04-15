/**
 * Sampling Logic Service
 * Handles the logic for sampling points in batches.
 */

export function initializeSamplingState(zones) {
  if (!zones || zones.length === 0) return null;
  const firstZoneIdx = zones.findIndex(z => (z.points || []).length > 0);
  if (firstZoneIdx === -1) return null;
  return {
    zone: firstZoneIdx,
    unmarked: zones[firstZoneIdx].points.map((_, i) => i),
    done: []
  };
}

export function getCurrentBatchPoints(zones, state) {
  if (!state || !zones[state.zone]) return [];
  const currentUnmarked = state.unmarked;
  const currentBatchIndices = currentUnmarked.slice(0, 10);
  return currentBatchIndices.map(i => zones[state.zone].points[i]);
}

export function markPointDone(state, batchIndex) {
  if (!state || batchIndex < 0 || batchIndex >= state.unmarked.length) return state;
  const pointIndex = state.unmarked[batchIndex];
  return {
    ...state,
    unmarked: state.unmarked.filter(i => i !== pointIndex),
    done: [...state.done, pointIndex]
  };
}

export function nextBatch(zones, state) {
  if (!state) return null;
  if (state.unmarked.length === 0) {
    const nextZone = state.zone + 1;
    if (nextZone < zones.length) {
      return {
        zone: nextZone,
        unmarked: zones[nextZone].points.map((_, i) => i),
        done: []
      };
    } else {
      return null; // all done
    }
  } else {
    return state; // batch is already the next
  }
}

export function advanceSamplingBatch(zones, state, batchSize = 10) {
  if (!state || !zones || zones.length === 0) return null;

  const currentBatch = state.unmarked.slice(0, batchSize);
  const remaining = state.unmarked.slice(batchSize);

  if (remaining.length > 0) {
    return {
      ...state,
      unmarked: remaining,
      done: [...state.done, ...currentBatch]
    };
  }

  let nextZone = state.zone + 1;
  while (nextZone < zones.length) {
    const pts = zones[nextZone]?.points || [];
    if (pts.length > 0) {
      return {
        zone: nextZone,
        unmarked: pts.map((_, i) => i),
        done: []
      };
    }
    nextZone += 1;
  }

  return null;
}