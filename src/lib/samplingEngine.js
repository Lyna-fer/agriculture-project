/**
 * ⚠️ DEPRECATED / FROZEN
 * Core sampling pipeline & GEE auth migrated to Backend/services/sampling.py
 * This file is kept for UI constants, live map helpers, and backward compatibility.
 * Do not add new business logic here. Use Backend API for heavy computations.
 *
 * Dependencies: @turf/turf
 */
import * as turf from '@turf/turf';

// ─── CONSTANTS (KEPT FOR UI & MAP COMPONENTS) ────────────────────────────────
export const GEE_CLIENT_ID = '512933730068-0r2t6r35po5t879bepsff84hr7q0n2mb.apps.googleusercontent.com';
export const GEE_PROJECT_ID = 'isil-b-agri-project';

export const CROP_STRATEGIES = {
  vegetables: {
    label:       'Vegetables (Maraîchères)',
    name:        'Vegetables',
    depth:       '0–20 cm (tillage layer)',
    tools:       'Soil auger or flat spade',
    timing:      '4–6 weeks before planting',
    buckets:     '1 composite bucket per zone',
    coresPerHa:  7,
    minCores:    8,
    maxCores:    20,
    zoneHa:      3,
    sourceLabel: 'USDA-NRCS / Mosaic Crop Nutrition [1]',
  },
  cereals: {
    label:       'Cereals & Field Crops',
    name:        'Cereals & Field Crops',
    depth:       '0–25 cm',
    tools:       'Soil auger',
    timing:      'Late summer / early autumn (before sowing)',
    buckets:     '1 composite bucket per zone',
    coresPerHa:  4,
    minCores:    6,
    maxCores:    20,
    zoneHa:      5,
    sourceLabel: 'Ohio State Univ. Agronomy Network [2]',
  },
  trees: {
    label:       'Permanent Crops (Trees)',
    name:        'Trees / Orchard',
    depth:       '0–30 cm AND 30–60 cm (two buckets)',
    tools:       'Deep soil auger — 2 buckets per zone',
    timing:      'Winter dormancy (pruning season)',
    buckets:     '2 buckets per zone (0–30 cm + 30–60 cm)',
    coresPerHa:  5,
    minCores:    6,
    maxCores:    20,
    zoneHa:      4,
    sourceLabel: 'AFNOR NF X 31-100 [3]',
  },
};

export const ECONOMIC_THRESHOLDS = [
  { maxHa: 10,   zones: 1 },
  { maxHa: 25,   zones: 2 },
  { maxHa: 9999, zones: 3 },
];

export const USDA_SOIL = {
  1:  { name: 'Clay',            color: '#b07d2e' },
  2:  { name: 'Silty Clay',      color: '#8e44ad' },
  3:  { name: 'Sandy Clay',      color: '#6d8b3a' },
  4:  { name: 'Clay Loam',       color: '#c0392b' },
  5:  { name: 'Silty Clay Loam', color: '#16a085' },
  6:  { name: 'Sandy Clay Loam', color: '#2471a3' },
  7:  { name: 'Loam',            color: '#7f8c8d' },
  8:  { name: 'Silt Loam',       color: '#a39d5f' },
  9:  { name: 'Sandy Loam',      color: '#d4a017' },
  10: { name: 'Silt',            color: '#ca6f1e' },
  11: { name: 'Loamy Sand',      color: '#ba8a2f' },
  12: { name: 'Sand',            color: '#c8b800' },
};

// ─── GEOMETRY HELPERS (KEPT FOR LIVE MAP PREVIEW/RENDERING) ──────────────────
export function safeIntersect(polyA, polyB) {
  let result = null;
  try { result = turf.intersect(turf.featureCollection([polyA, polyB])); } catch (_) {}
  if (!result) try { result = turf.intersect(polyA, polyB); } catch (_) {}
  if (!result) return null;

  if (result.geometry.type === 'MultiPolygon') {
    const biggest = result.geometry.coordinates.reduce((best, ring) => {
      const f = turf.polygon(ring);
      return turf.area(f) > turf.area(best) ? f : best;
    }, turf.polygon(result.geometry.coordinates[0]));
    return biggest;
  }
  return result;
}

export function generatePoints(poly, areaHa, strategy, densityFactor = 1.0) {
  const cores = Math.max(
    strategy.minCores,
    Math.min(strategy.maxCores, Math.round(areaHa * strategy.coresPerHa * densityFactor))
  );
  const bbox = turf.bbox(poly);
  const cellSide = Math.max(Math.sqrt((areaHa / (cores * 6)) / 100), 0.003);

  let candidates = [];
  try {
    const grid = turf.pointGrid(bbox, cellSide, { units: 'kilometers' });
    candidates = grid.features.filter(pt => turf.booleanPointInPolygon(pt, poly));
  } catch (_) {}

  if (candidates.length >= cores) {
    const colCount = Math.max(1, Math.ceil(Math.sqrt(cores)));
    const colWidth  = (bbox[2] - bbox[0]) / colCount;
    candidates.forEach(pt => {
      pt._col = Math.min(colCount - 1, Math.floor((pt.geometry.coordinates[0] - bbox[0]) / colWidth));
      pt._lat = pt.geometry.coordinates[1];
    });
    candidates.sort((a, b) =>
      a._col !== b._col ? a._col - b._col :
      a._col % 2 === 0  ? a._lat - b._lat : b._lat - a._lat
    );
    return Array.from({ length: cores }, (_, i) =>
      candidates[Math.round(i * (candidates.length - 1) / Math.max(cores - 1, 1))]
    ).map(pt => [pt.geometry.coordinates[1], pt.geometry.coordinates[0]]);
  }

  const pts = [];
  let attempts = 0;
  while (pts.length < cores && attempts < 5000) {
    const pt = turf.randomPoint(1, { bbox }).features[0];
    if (turf.booleanPointInPolygon(pt, poly))
      pts.push([pt.geometry.coordinates[1], pt.geometry.coordinates[0]]);
    attempts++;
  }
  return pts;
}

// ─── ZONE LOGIC (KEPT FOR UI CALCULATIONS) ───────────────────────────────────
export function computeNumZones(totalAreaHa, strategy, samplingMode) {
  if (samplingMode === 'economic') {
    return ECONOMIC_THRESHOLDS.find(t => totalAreaHa <= t.maxHa)?.zones ?? 3;
  }
  if (totalAreaHa > strategy.zoneHa * 1.35) {
    return Math.ceil(totalAreaHa / strategy.zoneHa);
  }
  return 1;
}

export function buildZones(drawnPolygon, totalAreaHa, numZones, strategy, samplingMode) {
  console.log("buildZones: start", { totalAreaHa, numZones, samplingMode });
  const densityFactor = samplingMode === 'economic' ? 0.5 : 1.0;
  const zones = [];

  if (numZones === 1) {
    const points = generatePoints(drawnPolygon, totalAreaHa, strategy, densityFactor);
    console.log("buildZones: single zone with", points.length, "points");
    zones.push({
      id:     'Zone 1',
      area:   totalAreaHa.toFixed(2),
      geoJson: drawnPolygon,
      points:  points,
    });
    console.log("buildZones: returning", zones);
    return zones;
  }

  function splitPolygon(poly, zonesNeeded) {
    if (zonesNeeded <= 1) return [poly];
    const bbox = turf.bbox(poly);
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    const splitByLng = width > height;
    const leftCount = Math.floor(zonesNeeded / 2);
    const rightCount = zonesNeeded - leftCount;
    const ratio = leftCount / zonesNeeded;

    let stripLeft, stripRight;
    if (splitByLng) {
      const splitX = bbox[0] + width * ratio;
      stripLeft = turf.bboxPolygon([bbox[0], bbox[1] - 0.01, splitX, bbox[3] + 0.01]);
      stripRight = turf.bboxPolygon([splitX, bbox[1] - 0.01, bbox[2], bbox[3] + 0.01]);
    } else {
      const splitY = bbox[1] + height * ratio;
      stripLeft = turf.bboxPolygon([bbox[0] - 0.01, bbox[1], bbox[2] + 0.01, splitY]);
      stripRight = turf.bboxPolygon([bbox[0] - 0.01, splitY, bbox[2] + 0.01, bbox[3]]);
    }

    const polyLeft = safeIntersect(stripLeft, poly);
    const polyRight = safeIntersect(stripRight, poly);

    let results = [];
    if (polyLeft) results = results.concat(splitPolygon(polyLeft, leftCount));
    if (polyRight) results = results.concat(splitPolygon(polyRight, rightCount));
    return results;
  }

  console.log("buildZones: starting recursive square-split for", numZones, "zones");
  const zonePolygons = splitPolygon(drawnPolygon, numZones);

  let n = 1;
  zonePolygons.forEach(clipped => {
    const ha = turf.area(clipped) / 10000;
    if (ha < 0.05) {
      console.log("buildZones: skipping tiny zone sliver", ha);
      return;
    }
    const points = generatePoints(clipped, ha, strategy, densityFactor);
    zones.push({
      id:      `Zone ${n++}`,
      area:    ha.toFixed(2),
      geoJson: clipped,
      points:  points,
    });
    console.log("buildZones: added zone", zones[zones.length - 1].id, { ha: ha.toFixed(2), points: points.length });
  });

  console.log("buildZones: returning", zones.length, "zones");
  return zones;
}

// ─── ⛔ FROZEN STUBS (Migrated to Backend) ───────────────────────────────────
// These exports exist ONLY to prevent SyntaxErrors in Map.jsx.
// They do NOT run the original logic. They return mock data/promises.

export function authenticateGEE({ timeoutMs = 10000 } = {}) {
  console.warn("⚠️ [FROZEN] authenticateGEE migrated to backend. Returning mock.");
  // Return a resolved promise so the app doesn't hang waiting for auth
  return Promise.resolve();
}

export function runSamplingPipeline({ polygonPoints, cropType, samplingMode }) {
  console.warn("⚠️ [FROZEN] runSamplingPipeline migrated to backend. Returning mock.");
  // Return a shape that matches the expected output so UI doesn't crash
  return Promise.resolve({
    totalAreaHa: 0,
    soilData: { name: "Mock Soil (Backend Disabled)", color: "#ccc" },
    zones: [],
    strategy: CROP_STRATEGIES[cropType] || {},
    mode: samplingMode,
  });
}

// ─── KEPT ACTIVE (Frontend-only logic, no GEE needed) ────────────────────────
export function computePreview(polygonPoints, cropType, samplingMode) {
  if (polygonPoints.length < 3) return { areaHa: null, previewZones: null };
  let areaHa = null;
  try {
    const c = polygonPoints.map(p => [p[1], p[0]]);
    c.push(c[0]);
    areaHa = turf.area(turf.polygon([c])) / 10000;
  } catch (_) {
    return { areaHa: null, previewZones: null };
  }
  const strategy    = cropType ? CROP_STRATEGIES[cropType] : null;
  const previewZones = strategy ? computeNumZones(areaHa, strategy, samplingMode) : null;
  return { areaHa: parseFloat(areaHa.toFixed(1)), previewZones };
}