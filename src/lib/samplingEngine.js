/**
 * samplingEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure backend logic for the Precision Soil Sampling Planner.
 * No JSX, no CSS, no React state. Import and call from any frontend.
 *
 * Dependencies (must be available in the host environment):
 *   - @turf/turf  (window.turf or import * as turf from '@turf/turf')
 *   - Google Earth Engine JS API  (window.ee)
 *   - Google Identity Services    (window.google.accounts.oauth2)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as turf from '@turf/turf';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const GEE_CLIENT_ID =
  '512933730068-0r2t6r35po5t879bepsff84hr7q0n2mb.apps.googleusercontent.com';

export const GEE_PROJECT_ID = 'isil-b-agri-project';

/**
 * Agronomic sampling rules per crop category.
 * Sources: USDA-NRCS / Mosaic Crop Nutrition [1],
 *          Ohio State Univ. Agronomy Network [2], , 
 *          AFNOR NF X 31-100 [3], ARVALIS [4].
 */
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
    zoneHa:      3,   // target ha per management zone (standard mode)
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

/**
 * Economic mode: fixed zone count thresholds by total field area.
 * Fields ≤ 10 ha → 1 zone, ≤ 25 ha → 2 zones, larger → 3 zones.
 */
export const ECONOMIC_THRESHOLDS = [
  { maxHa: 10,   zones: 1 },
  { maxHa: 25,   zones: 2 },
  { maxHa: 9999, zones: 3 },
];

/**
 * USDA Soil Texture Classification lookup.
 * Key = GEE band value (b0) from OpenLandMap SOL_TEXTURE-CLASS.
 */
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

// ─── GEOMETRY HELPERS ─────────────────────────────────────────────────────────

/**
 * Safe polygon intersection that handles both old and new Turf.js API signatures
 * and gracefully degrades MultiPolygon results to the largest single polygon.
 *
 * @param {turf.Feature<Polygon>} polyA
 * @param {turf.Feature<Polygon>} polyB
 * @returns {turf.Feature<Polygon> | null}
 */
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

/**
 * Generate spatially distributed sub-core sampling points inside a polygon.
 * Uses a serpentine point-grid strategy, falling back to random placement
 * when the grid is too coarse for the zone shape.
 *
 * @param {turf.Feature<Polygon>} poly         - Clipped zone polygon
 * @param {number}                areaHa       - Zone area in hectares
 * @param {object}                strategy     - One entry from CROP_STRATEGIES
 * @param {number}               [densityFactor=1.0] - Scale factor (0.5 for economic mode)
 * @returns {Array<[lat, lng]>}  - Array of [latitude, longitude] pairs
 */
export function generatePoints(poly, areaHa, strategy, densityFactor = 1.0) {
  const cores = Math.max(
    strategy.minCores,
    Math.min(strategy.maxCores, Math.round(areaHa * strategy.coresPerHa * densityFactor))
  );
  const bbox = turf.bbox(poly);

  // Cell size in km derived from area and desired core density
  const cellSide = Math.max(Math.sqrt((areaHa / (cores * 6)) / 100), 0.003);

  let candidates = [];
  try {
    const grid = turf.pointGrid(bbox, cellSide, { units: 'kilometers' });
    candidates = grid.features.filter(pt => turf.booleanPointInPolygon(pt, poly));
  } catch (_) {}

  // Serpentine column selection when enough grid candidates exist
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

  // Fallback: random points within polygon
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

// ─── ZONE LOGIC ───────────────────────────────────────────────────────────────

/**
 * Determine how many zones a field should be split into.
 *
 * @param {number} totalAreaHa
 * @param {object} strategy    - One entry from CROP_STRATEGIES
 * @param {'standard'|'economic'} samplingMode
 * @returns {number}
 */
export function computeNumZones(totalAreaHa, strategy, samplingMode) {
  if (samplingMode === 'economic') {
    return ECONOMIC_THRESHOLDS.find(t => totalAreaHa <= t.maxHa)?.zones ?? 3;
  }
  // Standard: allow up to 35 % overflow before forcing a second zone
  if (totalAreaHa > strategy.zoneHa * 1.35) {
    return Math.ceil(totalAreaHa / strategy.zoneHa);
  }
  return 1;
}

/**
 * Slice a drawn polygon into `numZones` equal strips along its longest axis,
 * clip each strip to the original boundary, then generate sampling points.
 *
 * @param {turf.Feature<Polygon>} drawnPolygon
 * @param {number}                totalAreaHa
 * @param {number}                numZones
 * @param {object}                strategy       - One entry from CROP_STRATEGIES
 * @param {'standard'|'economic'} samplingMode
 * @returns {Array<{ id, area, geoJson, points }>}
 */
export function buildZones(drawnPolygon, totalAreaHa, numZones, strategy, samplingMode) {
  console.log("buildZones: start", { totalAreaHa, numZones, samplingMode });
  const densityFactor = samplingMode === 'economic' ? 0.5 : 1.0;
  const zones = [];

  // If only 1 zone is needed, don't slice anything
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

  // --- NEW: RECURSIVE SQUARE-SPLIT ALGORITHM ---
  function splitPolygon(poly, zonesNeeded) {
    if (zonesNeeded <= 1) return [poly];

    const bbox = turf.bbox(poly);
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    
    // Always split along the longest axis of the CURRENT sub-piece
    const splitByLng = width > height;

    // Split as close to half as possible to maintain square-like shapes
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
    
    // Skip tiny slivers created by diagonal borders
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

// ─── GEE AUTHENTICATION ───────────────────────────────────────────────────────

/**
 * Authenticate with Google Earth Engine via OAuth 2.0 and initialise the EE
 * client library.  Returns a Promise that resolves when EE is ready.
 *
 * @param {object} [options]
 * @param {number} [options.timeoutMs=10000]  - Max ms to wait for ee.initialize
 * @returns {Promise<void>}                   - Rejects with an Error on failure
 */
export function authenticateGEE({ timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    const { google, ee } = window;
    if (!google || !ee) {
      reject(new Error('Google Identity Services or EE API not loaded.'));
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GEE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/earthengine.readonly',
      callback: (tokenResponse) => {
        if (!tokenResponse?.access_token) {
          reject(new Error('OAuth failed: no access token returned.'));
          return;
        }

        ee.data.setAuthToken(
          GEE_CLIENT_ID,
          'Bearer',
          tokenResponse.access_token,
          tokenResponse.expires_in
        );

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('ee.initialize() timed out.'));
          }
        }, timeoutMs);

        ee.initialize(
          null, null,
          () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } },
          (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`EE init failed: ${err}`)); } },
          null,
          GEE_PROJECT_ID
        );
      },
    });

    tokenClient.requestAccessToken();
  });
}

// ─── CORE PIPELINE ───────────────────────────────────────────────────────────

/**
 * Main entry point.  Runs the full satellite → soil → zone → points pipeline.
 *
 * @param {object} params
 * @param {Array<[lat,lng]>}      params.polygonPoints  - Raw click points (≥ 3)
 * @param {string}                params.cropType       - Key of CROP_STRATEGIES
 * @param {'standard'|'economic'} params.samplingMode
 *
 * @returns {Promise<{
 *   totalAreaHa : number,
 *   soilData    : { name: string, color: string },
 *   zones       : Array<{ id, area, geoJson, points }>,
 *   strategy    : object,
 *   mode        : string,
 * }>}
 */
export function runSamplingPipeline({ polygonPoints, cropType, samplingMode }) {
  return new Promise((resolve, reject) => {
    const ee = window.ee;
    if (!ee) { reject(new Error('GEE not initialised.')); return; }

    const strategy = CROP_STRATEGIES[cropType];
    if (!strategy)  { reject(new Error(`Unknown crop type: ${cropType}`)); return; }
    if (polygonPoints.length < 3) { reject(new Error('Need at least 3 polygon points.')); return; }

    // Build closed GeoJSON ring  [lng, lat]
    const coords = polygonPoints.map(p => [p[1], p[0]]);
    coords.push(coords[0]);

    const drawnPolygon = turf.polygon([coords]);
    const totalAreaHa  = turf.area(drawnPolygon) / 10000;

    if (totalAreaHa < 0.1) {
      reject(new Error(`Area too small (${totalAreaHa.toFixed(2)} ha) for satellite analysis.`));
      return;
    }

    const eePolygon = ee.Geometry.Polygon([coords]);

    ee.Image('OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02')
      .select('b0')
      .reduceRegion({
        reducer:   ee.Reducer.mode(),
        geometry:  eePolygon,
        scale:     250,
        maxPixels: 1e9,
      })
      .evaluate((res, err) => {
        if (err || !res?.b0) {
          reject(new Error('Satellite error or field too small for 250 m resolution.'));
          return;
        }

        const soilData = USDA_SOIL[res.b0] || { name: 'Unknown', color: '#888' };
        const numZones = computeNumZones(totalAreaHa, strategy, samplingMode);
        const zones    = buildZones(drawnPolygon, totalAreaHa, numZones, strategy, samplingMode);

        resolve({
          totalAreaHa,
          soilData,
          zones,
          strategy,
          mode: samplingMode,
        });
      });
  });
}

// ─── PREVIEW HELPER (no GEE needed) ──────────────────────────────────────────

/**
 * Cheaply compute live area + zone count preview from polygon points alone.
 * Safe to call on every map click without GEE.
 *
 * @param {Array<[lat,lng]>}      polygonPoints
 * @param {string|null}           cropType      - Key of CROP_STRATEGIES, or null
 * @param {'standard'|'economic'} samplingMode
 * @returns {{ areaHa: number|null, previewZones: number|null }}
 */
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
