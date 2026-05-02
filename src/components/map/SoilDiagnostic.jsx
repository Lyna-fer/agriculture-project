import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import "./SoilDiagnostic.css";
import PortalOverlay from "./PortalOverlay";
import satelliteFallback from "../../assets/satellite.png";
import {
  normalizeLatLngPoint,
  getHistoryKey,
  getCurrentAnalysisKey,
  getDashboardStateKey,
  dispatchDashboardUpdated,
} from "../../lib/soilDashboardStorage";

/* ─── Satellite defaults ─────────────────────────────────────────────────── */
const SAT_DEFAULTS = { ce: 1.2, temp: 22, tex: "limon-argileux", om: "moyen" };
const SAT_FIELDS   = {
  ce: "Landsat 8",
  temp: "MODIS (Terra/Aqua)",
  tex: "OpenLandMap / SoilGrids (Global Soil Map)",
  om: "Sentinel-2 (NDVI / bare-soil proxy)",
};
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

/* ─── Zone colour palette ────────────────────────────────────────────────── */
const ZONE_COLORS = ["#7F77DD","#1D9E75","#E07850","#C05090","#3090C0","#8060A0","#C0A020"];
const ZONE_LIGHTS = ["#EEEDFE","#E1F5EE","#FEF0E8","#FCE8F4","#E8F4FC","#F0E8FC","#FEF8E0"];

/* ─── Crop helpers ───────────────────────────────────────────────────────── */
const EMOJI_BG = {
  "🍅":"#ffd8d0","🥔":"#f5e6cc","🧅":"#f0e0c0","🧄":"#f0e8c0","🫑":"#d0f0d0",
  "🌶️":"#ffd0c0","🥒":"#d0f0e0","🍆":"#e0c8f8","🥕":"#ffe0c0","🥦":"#d0ecd0",
  "🥬":"#c8f0d0","🫘":"#f0e8d0","🍉":"#ffd0d8","🌾":"#f5f0d8","🌽":"#fff0c8",
  "🍈":"#e8f6cc","🫒":"#d8ecd0","🌴":"#d0e8c0","🍊":"#ffe0c0","🍋":"#fff8c8","🍇":"#e0d0f8",
  "🍑":"#ffdcc8","🍎":"#ffd0d0","🍒":"#ffc8cc","🍐":"#e0f0d0",
};

const SOIL_TEXTURE_TO_KEY = {
  "Clay Loam": "limon-argileux",
  "Loam": "limoneux",
  "Sandy Loam": "sablo-limoneux",
  "Sand": "sableux",
  "Clay": "argileux",
};

const SOIL_TEXTURE_LABEL = {
  "limon-argileux": "Clay loam",
  limoneux: "Loam",
  "sablo-limoneux": "Sandy loam",
  sableux: "Sandy",
  argileux: "Clay",
};

const TEXTURE_ORDER = ["sableux", "sablo-limoneux", "limoneux", "limon-argileux", "argileux"];
const OM_LEVEL_VALUES = {
  "tres-bas": 0.5,
  bas: 1.5,
  moyen: 3,
  bon: 5,
  excellent: 7,
};
const POLLUTION_RISK_SHIFT = { low: 10, medium: 0, high: -10 };

const GROUP_SCORE_WEIGHTS = {
  vegetables: {
    texture: 0.12,
    ph: 0.18,
    ec: 0.24,
    om: 0.16,
    lime: 0.07,
    n: 0.08,
    p: 0.05,
    k: 0.06,
    pollution: 0,
    temp: 0.08,
    wind: 0.04,
  },
  cereals: {
    texture: 0.16,
    ph: 0.15,
    ec: 0.22,
    om: 0.10,
    lime: 0.08,
    n: 0.12,
    p: 0.09,
    k: 0.08,
    pollution: 0,
    temp: 0.07,
    wind: 0.03,
  },
  trees: {
    texture: 0.20,
    ph: 0.15,
    ec: 0.20,
    om: 0.07,
    lime: 0.13,
    n: 0.04,
    p: 0.04,
    k: 0.08,
    pollution: 0,
    temp: 0.06,
    wind: 0.07,
  },
};

const HEAVY_METAL_PARAMS = new Set(["pb", "cd"]);

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getGroupKey(crop = {}) {
  if (crop.category === "cereals") return "cereals";
  if (crop.category === "trees") return "trees";
  return "vegetables";
}

const SCORE_LEVEL_FACTOR = { optimal: 1, stress: 0.5, destroyable: 0.2 };

function pointsByLevel(weight, level) {
  return weight * (SCORE_LEVEL_FACTOR[level] ?? SCORE_LEVEL_FACTOR.destroyable);
}

function within(value, min, max) {
  return value >= min && value <= max;
}

function seasonRelation(actual, target) {
  if (!actual || !target) return "destroyable";
  if (actual === target) return "optimal";
  const tolerantPairs = new Set([
    "printemps|ete", "ete|printemps",
    "automne|ete", "ete|automne",
    "hiver|automne", "automne|hiver",
  ]);
  return tolerantPairs.has(`${actual}|${target}`) ? "stress" : "destroyable";
}

function seasonLevel(actualSeason, targetSeasons = []) {
  if (!Array.isArray(targetSeasons) || targetSeasons.length === 0) return "optimal";
  if (targetSeasons.includes(actualSeason)) return "optimal";
  return targetSeasons.some(s => seasonRelation(actualSeason, s) === "stress") ? "stress" : "destroyable";
}

function textureLevel(preferred, actual) {
  if (!preferred || !actual) return "destroyable";
  if (preferred === actual) return "optimal";

  const safe = new Set([
    "limoneux|sablo-limoneux", "sablo-limoneux|limoneux",
    "limoneux|limon-argileux", "limon-argileux|limoneux",
  ]);
  if (safe.has(`${preferred}|${actual}`)) return "stress";

  const functionalStress = new Set([
    "sablo-limoneux|sableux", "sableux|sablo-limoneux",
    "limon-argileux|argileux", "argileux|limon-argileux",
  ]);
  if (functionalStress.has(`${preferred}|${actual}`)) return "stress";

  const severe = new Set([
    "sableux|argileux", "argileux|sableux",
    "limoneux|sableux", "sableux|limoneux",
    "limoneux|argileux", "argileux|limoneux",
  ]);
  if (severe.has(`${preferred}|${actual}`)) return "destroyable";

  return "destroyable";
}

function organicMatterPoints(level, groupKey) {
  const table = {
    vegetables: { excellent: 16, bon: 12, moyen: 8, bas: 4, "tres-bas": 3.2 },
    cereals:    { excellent: 10, bon: 7.5, moyen: 5, bas: 2.5, "tres-bas": 2 },
    trees:      { excellent: 7, bon: 7, moyen: 3.5, bas: 3.5, "tres-bas": 1.4 },
  };
  return table[groupKey]?.[level] ?? table[groupKey]?.moyen ?? 0;
}

function nutrientLevel(value, optimal, lowDelta, highDelta) {
  if (!Number.isFinite(optimal) || optimal <= 0) return "optimal";
  if (value === optimal) return "optimal";
  const min = optimal - lowDelta;
  const max = optimal + highDelta;
  return within(value, min, max) ? "stress" : "destroyable";
}

function pollutionThresholds(crop) {
  const risk = String(crop?.pollutionAccumulationRisk || "").toLowerCase();
  if (risk.includes("hyper") || risk.includes("sensitive")|| risk.includes("high")) {
    return { cdSafe: 0.5, cdLethal: 2, pbSafe: 30, pbLethal: 150 };
  }
  if (risk.includes("tolerant") || risk.includes("low")) {
    return { cdSafe: 2, cdLethal: 15, pbSafe: 100, pbLethal: 800 };
  }
  return { cdSafe: 1, cdLethal: 5, pbSafe: 50, pbLethal: 400 };
}

function pollutantMultiplier(actual, safe, lethal) {
  if (actual <= safe) return 1;
  if (actual >= lethal) return 0;
  return 1 - ((actual - safe) / (lethal - safe));
}

function pollutionMultiplier(st, crop) {
  const thresholds = pollutionThresholds(crop);
  const cdFactor = pollutantMultiplier(Number(st?.cd || 0), thresholds.cdSafe, thresholds.cdLethal);
  const pbFactor = pollutantMultiplier(Number(st?.pb || 0), thresholds.pbSafe, thresholds.pbLethal);
  return Math.max(0, Math.min(cdFactor, pbFactor));
}

// âœ… NEW: Severe contamination check (Pb > 800 OR Cd > 15 blocks ALL crops)
function isSoilToxic(st) {
  const pb = Number(st?.pb || 0);
  const cd = Number(st?.cd || 0);
  return {
    isToxic: pb > 800 || cd > 15,
    pb, cd,
    pbExcess: pb > 800 ? pb - 800 : 0,
    cdExcess: cd > 15 ? cd - 15 : 0,
  };
}

function contaminationValue(st) {
  return Math.max(Number(st?.pb || 0), Number(st?.cd || 0));
}

function scoreCropByFormula(crop, st) {
  const groupKey = getGroupKey(crop);
  const phMin = Number(crop.ph?.[0] ?? 6);
  const phMax = Number(crop.ph?.[1] ?? 7.5);
  const phCenter = (phMin + phMax) / 2;
  const seasonFit = seasonLevel(st.seas, crop.ss);
  const texFit = textureLevel(crop.prefTex, st.tex);

  let base = 0;
  let maxPoints = 0;
  const add = (weight, level) => {
    maxPoints += weight;
    base += pointsByLevel(weight, level);
  };

  if (groupKey === "vegetables") {
    add(18, within(st.ph, phMin, phMax) ? "optimal" : within(st.ph, phMin - 2, phMax + 2) ? "stress" : "destroyable");
    add(16, st.ce <= crop.ce ? "optimal" : st.ce <= crop.ce + 1.5 ? "stress" : "destroyable");
    maxPoints += 16; base += organicMatterPoints(st.mo, groupKey);
    add(12, texFit);
    add(8, seasonFit);
    add(7, st.lime <= crop.limeMx ? "optimal" : st.lime <= crop.limeMx + 5 ? "stress" : "destroyable");
    add(4, st.wind <= crop.maxWindKmh ? "optimal" : st.wind <= crop.maxWindKmh + 25 ? "stress" : "destroyable");
    add(8, nutrientLevel(st.n, crop.nReq, 10, 20));
    add(5, nutrientLevel(st.p, crop.pReq, 15, 30));
    add(6, nutrientLevel(st.k, crop.kReq, 80, 150));
  } else if (groupKey === "cereals") {
    add(15, within(st.ph, phCenter - 1, phCenter + 1) ? "optimal" : within(st.ph, phCenter - 2, phCenter + 2) ? "stress" : "destroyable");
    add(12, st.ce <= crop.ce ? "optimal" : st.ce <= crop.ce + 4 ? "stress" : "destroyable");
    maxPoints += 10; base += organicMatterPoints(st.mo, groupKey);
    add(12, nutrientLevel(st.n, crop.nReq, 60, 80));
    add(9, nutrientLevel(st.p, crop.pReq, 15, 30));
    add(8, nutrientLevel(st.k, crop.kReq, 80, 150));
    add(8, st.lime <= crop.limeMx ? "optimal" : st.lime <= crop.limeMx + 7 ? "stress" : "destroyable");
    add(7, seasonFit);
    add(3, st.wind <= crop.maxWindKmh ? "optimal" : st.wind <= crop.maxWindKmh + 30 ? "stress" : "destroyable");
  } else {
    add(20, texFit);
    add(15, within(st.ph, phMin, phMax) ? "optimal" : within(st.ph, phCenter - 1, phCenter + 1) ? "stress" : "destroyable");
    add(12, st.ce <= crop.ce ? "optimal" : st.ce <= crop.ce + 3 ? "stress" : "destroyable");
    add(13, st.lime <= crop.limeMx ? "optimal" : st.lime <= crop.limeMx + 5 ? "stress" : "destroyable");
    add(8, nutrientLevel(st.k, crop.kReq, 60, 100));
    add(7, st.wind <= crop.maxWindKmh ? "optimal" : st.wind <= crop.maxWindKmh + 20 ? "stress" : "destroyable");
    maxPoints += 7; base += organicMatterPoints(st.mo, groupKey);
    add(6, seasonFit);
    add(4, nutrientLevel(st.n, crop.nReq, 20, 50));
    add(4, nutrientLevel(st.p, crop.pReq, 20, 50));
  }

  const normalizedBase = maxPoints > 0 ? (base / maxPoints) * 100 : 0;
  return clampScore(normalizedBase * pollutionMultiplier(st, crop));
}

function inferSeasons(c) {
  if (c.tempMin >= 18) return ["ete"];
  if (c.tempMin >= 15) return ["printemps","ete"];
  if (c.tempMin >= 10) return ["printemps","ete","automne"];
  if (c.tempMin <= 5 && c.tempMax <= 25) return ["hiver","printemps","automne"];
  return ["printemps","ete","automne"];
}

function toCrop(c) {
  const limits = { omMin: c.omMin ?? 1.5, activeLimeMax: c.activeLimeMax ?? 15 };
  const prefTex = SOIL_TEXTURE_TO_KEY[c.soilType] || "limon-argileux";
  return {
    ...c,
    id: c.id,
    n: c.nameEn,
    ar: c.nameAr || c.nameEn,
    e: c.emoji,
    bg: EMOJI_BG[c.emoji] || "#f0f0f0",
    lat: c.nameEn,
    ph: c.ph,
    ce: c.ec,
    tMn: c.tempMin,
    tMx: c.tempMax,
    nHi: c.nReq > 100,
    limeMx: limits.activeLimeMax,
    omMin: limits.omMin,
    soilType: c.soilType,
    prefTex,
    // Prefer explicit seasons from DB; fallback to inferred seasons.
    ss: c.season
      ? c.season.split(",").map(s => s.trim()).filter(Boolean)
      : inferSeasons(c),
    note: `Soil ${c.soilType}. N: ${c.nReq} kg/ha · P: ${c.pReq} kg/ha · K: ${c.kReq} kg/ha · OM >= ${limits.omMin}% · Active lime <= ${limits.activeLimeMax}%`,
  };
}

/* ─── Scoring ────────────────────────────────────────────────────────────── */
const ZC = {
  ph:   [{c:"#ff8a80",f:14},{c:"#ffcc80",f:14},{c:"#a5d6a7",f:36},{c:"#ffcc80",f:20},{c:"#ff8a80",f:16}],
  ce:   [{c:"#a5d6a7",f:35},{c:"#ffcc80",f:25},{c:"#ff8a80",f:40}],
  temp: [{c:"#80cff0",f:15},{c:"#ffcc80",f:20},{c:"#a5d6a7",f:35},{c:"#ffcc80",f:20},{c:"#ff8a80",f:10}],
  n:    [{c:"#ff8a80",f:20},{c:"#ffcc80",f:15},{c:"#a5d6a7",f:35},{c:"#ffcc80",f:15},{c:"#ff8a80",f:15}],
  p:    [{c:"#ff8a80",f:20},{c:"#ffcc80",f:15},{c:"#a5d6a7",f:40},{c:"#ffcc80",f:15},{c:"#ff8a80",f:10}],
  k:    [{c:"#ff8a80",f:20},{c:"#ffcc80",f:15},{c:"#a5d6a7",f:40},{c:"#ffcc80",f:15},{c:"#ff8a80",f:10}],
  lime: [{c:"#a5d6a7",f:45},{c:"#ffcc80",f:25},{c:"#ff8a80",f:30}],
  wind: [{c:"#a5d6a7",f:42},{c:"#ffcc80",f:28},{c:"#ff8a80",f:30}],
  pb:   [{c:"#a5d6a7",f:45},{c:"#ffcc80",f:20},{c:"#ff8a80",f:35}],
  cd:   [{c:"#a5d6a7",f:45},{c:"#ffcc80",f:20},{c:"#ff8a80",f:35}],
};

const mc   = m => m>=80 ? "#1a7a50" : m>=60 ? "#b06010" : "#c02020";
const mcBg = m => m>=80 ? "#c8f5e0" : m>=60 ? "#fff3c8" : "#ffc8c8";

const PARAMS = [
  {id:"ph",  name:"pH",         u:"",     mn:4, mx:9  },
  {id:"ce",  name:"CE",         u:"dS/m", mn:0, mx:6  },
  {id:"n",   name:"Azote N",    u:"kg/ha",mn:0, mx:400},
  {id:"p",   name:"Phosphore P",u:"kg/ha",mn:0, mx:400},
  {id:"k",   name:"Potassium K",u:"kg/ha",mn:0, mx:400},
  {id:"temp",name:"Temp. sol",  u:"°C",   mn:0, mx:40 },
  {id:"lime",name:"Active Lime",u:"%",    mn:0, mx:30 },
  {id:"wind",name:"Wind",       u:"km/h", mn:0, mx:80 },
  {id:"pb",  name:"Lead (Pb)",   u:"mg/kg",mn:0, mx:100},
  {id:"cd",  name:"Cadmium (Cd)",u:"mg/kg",mn:0, mx:100},
];

const PARAM_ROWS = [
  PARAMS.slice(0, 3),
  PARAMS.slice(3, 6),
  PARAMS.slice(6),
];

const SN = {
  ete:"☀️ Algerian summer: verify irrigation. Intense heat is possible.",
  hiver:"❄️ Winter: frost risk in high plateaus. Mulching is recommended.",
  printemps:"🌱 Spring: excellent window for summer crops.",
  automne:"🍂 Autumn: favorable for Mediterranean crops.",
};

const SEASON_LABELS = {
  printemps: "Spring",
  ete: "Summer",
  automne: "Autumn",
  hiver: "Winter",
};

const SEASON_EMOJIS = {
  printemps: "🌱",
  ete: "☀️",
  automne: "🍂",
  hiver: "❄️",
};

function toDateInputValue(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seasonFromDate(value) {
  if (!value) return "ete";

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "ete";

  const month = date.getMonth() + 1;
  if (month === 12 || month <= 2) return "hiver";
  if (month <= 5) return "printemps";
  if (month <= 8) return "ete";
  return "automne";
}

function monthFromDatePlusDays(value, offsetDays = 0) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Number(offsetDays || 0));
  return date.getMonth() + 1;
}

function getSeasonLabel(season) {
  return SEASON_LABELS[season] || season;
}

function pSt(id, v, crop = null) {
  if (crop) {
    if (id === "ph") {
      if (v >= crop.ph[0] && v <= crop.ph[1]) return "ok";
      return Math.min(Math.abs(v - crop.ph[0]), Math.abs(v - crop.ph[1])) <= 0.5 ? "lo" : "hi";
    }

    if (id === "ce") {
      if (v <= crop.ce) return "ok";
      return v <= crop.ce + 0.5 ? "lo" : "hi";
    }

    if (id === "n" || id === "p" || id === "k") {
      const req = Number(crop[`${id}Req`] || 0);
      const val = Number(v || 0);
      if (!req) return "ok";
      if (val >= req) return "ok";
      return val >= req * 0.9 ? "lo" : "hi";
    }

    if (id === "temp") {
      if (v >= crop.tMn && v <= crop.tMx) return "ok";
      const delta = v < crop.tMn ? crop.tMn - v : v - crop.tMx;
      return delta <= 2 ? "lo" : "hi";
    }

    if (id === "lime") {
      if (v <= crop.limeMx) return "ok";
      return v <= crop.limeMx + 2 ? "lo" : "hi";
    }

    if (id === "wind") {
      if (v <= crop.maxWindKmh) return "ok";
      return v <= crop.maxWindKmh + 10 ? "lo" : "hi";
    }

    if (HEAVY_METAL_PARAMS.has(id)) {
      if (v <= 50) return "ok";
      if (v <= 80) return "lo";
      return crop.category === "vegetables" ? "hi" : "lo";
    }

    if (id === "tex") {
      const preferredIndex = TEXTURE_ORDER.indexOf(crop.prefTex);
      const actualIndex = TEXTURE_ORDER.indexOf(v);
      if (preferredIndex === -1 || actualIndex === -1) return "hi";
      const distance = Math.abs(preferredIndex - actualIndex);
      if (distance === 0) return "ok";
      return distance === 1 ? "lo" : "hi";
    }

    if (id === "mo") {
      if (OM_LEVEL_VALUES[v] >= crop.omMin) return "ok";
      return (crop.omMin - (OM_LEVEL_VALUES[v] ?? 0)) <= 0.5 ? "lo" : "hi";
    }
  }

  const R = { ph:[6,7.5], ce:[0,2], n:[30,65], p:[15,35], k:[130,280], temp:[14,30], lime:[0,12], wind:[0,30], pb:[0,25], cd:[0,25] };
  const [lo,hi] = R[id] || [0,100];
  if (v>=lo && v<=hi) return "ok";
  if (id==="ce") return "hi";
  return v<lo ? "lo" : "hi";
}

function statusLabel(id, v, crop = null) {
  if (crop) {
    if (id === "ph") {
      if (v < crop.ph[0]) return "Too low";
      if (v > crop.ph[1]) return "Too high";
      return "✓ OK";
    }

    if (id === "ce") {
      if (v > crop.ce) return v <= crop.ce + 0.5 ? "⚠ Near" : "Too high";
      return "✓ OK";
    }

    if (id === "n" || id === "p" || id === "k") {
      const req = Number(crop[`${id}Req`] || 0);
      const val = Number(v || 0);
      if (!req || val >= req) return "✓ OK";
      return val >= req * 0.9 ? "⚠ Near" : "Too low";
    }

    if (id === "temp") {
      if (v < crop.tMn) return crop.tMn - v <= 2 ? "⚠ Near" : "Too low";
      if (v > crop.tMx) return v - crop.tMx <= 2 ? "⚠ Near" : "Too high";
      return "✓ OK";
    }

    if (id === "lime") {
      if (v > crop.limeMx) return v <= crop.limeMx + 2 ? "⚠ Near" : "Too high";
      return "✓ OK";
    }

    if (id === "wind") {
      if (v > crop.maxWindKmh) return v <= crop.maxWindKmh + 10 ? "⚠ Near" : "Too high";
      return "✓ OK";
    }

    if (HEAVY_METAL_PARAMS.has(id)) {
      if (v <= 50) return "✓ OK";
      if (v <= 80) return "⚠ Warning";
      if (crop.category === "vegetables") return "🚨 Health alert";
      if (crop.category === "cereals") return "⚠ Warning";
      return "ℹ Advice";
    }

    if (id === "tex") {
      const preferredIndex = TEXTURE_ORDER.indexOf(crop.prefTex);
      const actualIndex = TEXTURE_ORDER.indexOf(v);
      if (preferredIndex === -1 || actualIndex === -1) return "Too high";
      const distance = Math.abs(preferredIndex - actualIndex);
      if (distance === 0) return "✓ OK";
      return distance === 1 ? "⚠ Near" : "Too far";
    }

    if (id === "mo") {
      return (OM_LEVEL_VALUES[v] ?? 0) >= crop.omMin ? "✓ OK" : ((crop.omMin - (OM_LEVEL_VALUES[v] ?? 0)) <= 0.5 ? "⚠ Near" : "Too low");
    }
  }

  const fallback = { ok: "✓ OK", lo: "⚠ Near", hi: "Too high" };
  return fallback[pSt(id, v)] || "✓ OK";
}

function calcScore(st, crops = []) {
  if (!st || !Array.isArray(crops) || crops.length === 0) return 0;

  const selectedCrop = st.crop ? crops.find((crop) => crop.id === st.crop) : null;
  if (selectedCrop) return scoreCropByFormula(selectedCrop, st);

  const bestScore = Math.max(...crops.map((crop) => scoreCropByFormula(crop, st)));
  return clampScore(bestScore);
}

function cropScore(c, st) {
  return scoreCropByFormula(c, st);
}

function cropAdj(c, st) {
  const adj = [];
  const { ph, ce, temp, seas, lime, wind, pb, cd, mo } = st;
  if (ph<c.ph[0]) adj.push({t:`Correct acidity - lime application (target pH ${c.ph[0]}-${c.ph[1]})`,bg:"#fff3c0"});
  if (ph>c.ph[1]) adj.push({t:"Reduce alkalinity - agricultural sulfur",bg:"#fff3c0"});
  if (ce>c.ce)    adj.push({t:"High salinity - leach soil before planting",bg:"#ffc0c0"});
  if (st.n < c.nReq) adj.push({t:`Add Nitrogen (N) - need at least ${c.nReq} kg/ha, current ${st.n} kg/ha`,bg:"#fff3c0"});
  if (st.p < c.pReq) adj.push({t:`Add Phosphorus (P) - need at least ${c.pReq} kg/ha, current ${st.p} kg/ha`,bg:"#fff3c0"});
  if (st.k < c.kReq) adj.push({t:`Add Potassium (K) - need at least ${c.kReq} kg/ha, current ${st.k} kg/ha`,bg:"#fff3c0"});
  if (temp<c.tMn) adj.push({t:`Soil too cold - wait for >= ${c.tMn}°C`,bg:"#c0d8ff"});
  if (lime>c.limeMx) adj.push({t:`Active lime too high - use tolerant crops or acidifying strategy (target <= ${c.limeMx}%)`,bg:"#fff3c0"});
  if (wind>35) adj.push({t:"Strong wind risk - add windbreaks and adjust irrigation scheduling",bg:"#ffe8c0"});
  [
    [pb, "Lead (Pb)"],
    [cd, "Cadmium (Cd)"],
  ].forEach(([value, label]) => {
    if (value > 50 && value <= 80) {
      adj.push({t:`${label} warning (50-80 mg/kg) - verify contamination before intensive use`,bg:"#fff3c0"});
    } else if (value > 80 && c.category === "vegetables") {
      adj.push({t:`RED ALERT - human health risk for edible vegetables (${label.toLowerCase()} > 80 mg/kg)`,bg:"#ffb3b3"});
    } else if (value > 80 && c.category === "cereals") {
      adj.push({t:`High ${label.toLowerCase()} - cereals need caution and residue testing`,bg:"#fff3c0"});
    } else if (value > 80 && c.category === "trees") {
      adj.push({t:`Advice - trees are more tolerant; monitor fruit quality and irrigation source (${label.toLowerCase()})`,bg:"#e8f4ff"});
    }
  });
  if (c.omMin > 2 && (mo === "tres-bas" || mo === "bas")) adj.push({t:`Increase organic matter to at least ${c.omMin}% (compost + cover crops)`,bg:"#fff3c0"});
  if (st.tex !== c.prefTex) adj.push({t:`Texture mismatch - preferred soil type: ${c.soilType} (${SOIL_TEXTURE_LABEL[c.prefTex]})`,bg:"#fff3c0"});
  if (!c.ss.includes(seas)) adj.push({t:`Non-optimal season - prefer ${c.ss.join(" or ")}`,bg:"#fff3c0"});
  return adj;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLabRequestHtml({
  parcelleName,
  parcelleHa,
  cultureLabel,
  zoneNumber,
  totalZones,
  generatedAt,
  includeEcTexture = true, // when false (economic tier) omit EC and texture tests
  includeOrganicMatter = true,
}) {
  const surface =
    parcelleHa > 0
      ? `${parcelleHa < 0.1 ? (parcelleHa * 10000).toFixed(0) + " m2" : parcelleHa.toFixed(2) + " ha"}`
      : "A renseigner";

  const safeParcelle = escapeHtml(parcelleName || "Parcelle Agricole");
  const safeCulture = escapeHtml(cultureLabel || "Culture non precisee");
  const safeDate = escapeHtml(generatedAt);

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bordereau - Demande d'analyse de sol</title>
  <style>
    :root {
      --ink: #16324f;
      --ink-soft: #425c78;
      --line: #b9c9d8;
      --accent: #0b6bcb;
      --paper: #ffffff;
      --bg: #eef3f8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Calibri", "Arial", sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.45;
      padding: 20px;
    }
    .paper {
      max-width: 900px;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 28px;
      box-shadow: 0 8px 32px rgba(11, 38, 68, 0.08);
    }
    .head {
      border-bottom: 2px solid var(--line);
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .title {
      margin: 0 0 4px;
      font-size: 24px;
      letter-spacing: 0.02em;
      color: var(--accent);
      font-weight: 800;
      text-transform: uppercase;
    }
    .subtitle {
      margin: 0;
      color: var(--ink-soft);
      font-size: 15px;
    }
    .meta {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 18px;
      font-size: 14px;
    }
    .meta th,
    .meta td {
      border: 1px solid var(--line);
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    .meta th {
      width: 32%;
      color: var(--ink-soft);
      font-weight: 700;
      background: #f7fbff;
    }
    .intro {
      margin: 0 0 16px;
      color: #20384f;
      font-size: 14px;
    }
    h2 {
      margin: 18px 0 8px;
      font-size: 16px;
      color: #123f69;
      border-left: 4px solid var(--accent);
      padding-left: 8px;
    }
    .checklist {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .checklist li {
      border: 1px solid #d9e4ef;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
    }
    .box {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 1.7px solid #2f4f6e;
      border-radius: 3px;
      margin-right: 8px;
      vertical-align: -3px;
    }
    .method {
      color: #2f4f6e;
      font-size: 13px;
      margin-top: 4px;
    }
    .foot {
      margin-top: 22px;
      border-top: 1px dashed var(--line);
      padding-top: 14px;
      font-size: 13px;
      color: var(--ink-soft);
    }
    .sign {
      margin-top: 26px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      font-size: 13px;
    }
    .sign-box {
      border-top: 1px solid var(--line);
      padding-top: 6px;
      min-height: 40px;
      color: #294765;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .paper { max-width: none; border-radius: 0; border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <article class="paper">
    <header class="head">
      <h1 class="title">Bordereau de demande d'analyse de sol</h1>
      <p class="subtitle">A l'attention du Laboratoire d'Analyses Agronomiques</p>
    </header>

    <table class="meta" aria-label="Informations de la demande">
      <tr><th>Date d'edition</th><td>${safeDate}</td></tr>
      <tr><th>Parcelle</th><td>${safeParcelle}</td></tr>
      <tr><th>Surface</th><td>${surface}</td></tr>
      <tr><th>Culture cible</th><td>${safeCulture}</td></tr>
      <tr><th>Zone analysee</th><td>Zone ${zoneNumber} / ${totalZones}</td></tr>
    </table>

    <p class="intro">
      Veuillez realiser les analyses physico-chimiques ci-dessous sur l'echantillon de sol joint.
      Afin d'assurer la compatibilite avec notre systeme de recommandation agronomique,
      merci de respecter les methodes d'extraction indiquees.
    </p>

    ${includeEcTexture ? `
    <h2>1. Analyses physiques (texture)</h2>
    <ul class="checklist">
      <li>
        <span class="box" aria-hidden="true"></span>
        Granulometrie (3 ou 5 fractions)
        <div class="method">Methode recommandee: pipette de Robinson ou densimetre de Bouyoucos. Resultat attendu: classe texturale exploitable.</div>
      </li>
    </ul>

    <h2>2. Analyses chimiques (salinite et pH)</h2>
    <ul class="checklist">
      <li>
        <span class="box" aria-hidden="true"></span>
        pH (potentiel hydrogene)
        <div class="method">Mesure pH eau sur suspension sol/eau 1:5.</div>
      </li>
      <li>
        <span class="box" aria-hidden="true"></span>
        Conductivite electrique (CE / salinite)
        <div class="method">Sur extrait de pate saturee (ou extrait 1:5 avec conversion explicite).</div>
      </li>
    </ul>
    ` : `
    <h2>1. Analyses chimiques (pH)</h2>
    <ul class="checklist">
      <li>
        <span class="box" aria-hidden="true"></span>
        pH (potentiel hydrogene)
        <div class="method">Mesure pH eau sur suspension sol/eau 1:5.</div>
      </li>
    </ul>
    `}

    <h2>3. Statut organo-calcique</h2>
    <ul class="checklist">
      ${includeOrganicMatter ? `
      <li>
        <span class="box" aria-hidden="true"></span>
        Matiere organique (%)
        <div class="method">Methode Anne ou Walkley-Black (oxydation au bichromate de potassium).</div>
      </li>
      ` : ``}
      <li>
        <span class="box" aria-hidden="true"></span>
        Calcaire actif (%)
        <div class="method">Methode Drouineau-Galet. Mesure prioritaire (ne pas confondre avec calcaire total).</div>
      </li>
    </ul>

    <h2>4. Elements fertilisants majeurs (NPK)</h2>
    <ul class="checklist">
      <li>
        <span class="box" aria-hidden="true"></span>
        Azote total (N)
        <div class="method">Methode Kjeldahl.</div>
      </li>
      <li>
        <span class="box" aria-hidden="true"></span>
        Phosphore assimilable (P2O5)
        <div class="method">Methode Olsen (extraction au bicarbonate de sodium), obligatoire pour les sols alcalins.</div>
      </li>
      <li>
        <span class="box" aria-hidden="true"></span>
        Potassium echangeable (K2O)
        <div class="method">Extraction a l'acetate d'ammonium normal neutre.</div>
      </li>
    </ul>

    <h2>5. Risques environnementaux (metaux lourds)</h2>
    <ul class="checklist">
      <li>
        <span class="box" aria-hidden="true"></span>
        Plomb (Pb) - concentration en mg/kg
        <div class="method">Extraction acide totale, quantification par ICP-OES ou AAS.</div>
      </li>
      <li>
        <span class="box" aria-hidden="true"></span>
        Cadmium (Cd) - concentration en mg/kg
        <div class="method">Extraction acide totale, quantification par ICP-OES ou AAS.</div>
      </li>
    </ul>

    <div class="foot">
      Merci d'indiquer sur le rapport final les unites de mesure, les methodes analytiques appliquees,
      ainsi que les seuils de reference utilises par le laboratoire.
    </div>

    <div class="sign">
      <div class="sign-box">Signature technicien laboratoire</div>
      <div class="sign-box">Signature demandeur / agriculteur</div>
    </div>
  </article>
</body>
</html>`;
}

function buildZoneReportHtml({
  parcelleName,
  parcelleHa,
  cultureLabel,
  zoneNumber,
  totalZones,
  generatedAt,
  diagMode,
  st,
  crops = [],
}) {
  const state = st || {};
  const surface =
    parcelleHa > 0
      ? `${parcelleHa < 0.1 ? (parcelleHa * 10000).toFixed(0) + " m2" : parcelleHa.toFixed(2) + " ha"}`
      : "A renseigner";

  const safeParcelle = escapeHtml(parcelleName || "Parcelle Agricole");
  const safeCulture = escapeHtml(cultureLabel || "Culture non precisee");
  const safeDate = escapeHtml(generatedAt);
  const modeLabel = diagMode === "eco" ? "Eco" : "Standard";

  const scored = Array.isArray(crops)
    ? crops
        .map(c => ({ ...c, sc: cropScore(c, state), adj: cropAdj(c, state) }))
        .sort((a, b) => b.sc - a.sc)
    : [];
  const selectedCrop = state.crop ? scored.find(c => String(c.id) === String(state.crop)) : null;
  const bestCrop = scored[0] || null;
  const focusCrop = selectedCrop || bestCrop || null;
  const contamination = isSoilToxic(state);
  const score = calcScore(state, crops);
  const scoreAccent = mc(score);
  const scoreBg = mcBg(score);
  const scoreLabel = contamination.isToxic
    ? "Critical contamination"
    : score >= 80
    ? "Excellent zone"
    : score >= 60
    ? "Needs improvement"
    : "At-risk zone";
  const scoreNote = contamination.isToxic
    ? "Heavy metals exceed safe thresholds and require remediation before cultivation."
    : score >= 80
    ? "The zone is structurally favorable and can be used with minor adjustments."
    : score >= 60
    ? "The zone can be cultivated after correcting the limiting factors listed below."
    : "The zone needs corrective actions before it becomes reliable for planting.";

  const metricRows = PARAMS.map((p) => {
    const value = state[p.id];
    const fit = pSt(p.id, value, focusCrop);
    const label = statusLabel(p.id, value, focusCrop);
    const color = fit === "ok" ? "#1a7a50" : fit === "lo" ? "#b06010" : "#c02020";
    const bg = fit === "ok" ? "#e3f8ea" : fit === "lo" ? "#fff4d3" : "#ffe0e0";
    const formatted = Number.isInteger(value) ? value : Number(value || 0).toFixed(1);
    const target = focusCrop
      ? `${pSt(p.id, value, focusCrop) === "ok" ? "Within target" : "Outside target"}`
      : "Reference only";
    return `
      <tr>
        <th>${escapeHtml(p.name)}</th>
        <td>${escapeHtml(String(formatted))} <span class="unit">${escapeHtml(p.u)}</span></td>
        <td><span class="pill" style="background:${bg};color:${color}">${escapeHtml(label)}</span></td>
        <td>${escapeHtml(target)}</td>
      </tr>
    `;
  }).join("");

  const actionRows = (focusCrop?.adj || []).slice(0, 6).map((item) => `
    <li><span class="bullet">•</span><span>${escapeHtml(item.t)}</span></li>
  `).join("");

  const cropCards = scored.slice(0, 5).map((crop, index) => {
    const rank = index + 1;
    const tone = rank === 1 ? "rank--top" : rank === 2 ? "rank--mid" : "rank--low";
    const seasonMatch = crop?.ss?.includes(state.seas);
    return `
      <article class="crop-card ${tone}">
        <div class="crop-head">
          <div class="rank">#${rank}</div>
          <div class="crop-emoji" style="background:${crop.bg}">${escapeHtml(crop.e)}</div>
          <div class="crop-info">
            <h3>${escapeHtml(crop.n)}</h3>
            <p>${escapeHtml(crop.ar || crop.lat || crop.n)}</p>
          </div>
          <div class="crop-score">
            <strong style="color:${mc(crop.sc)}">${crop.sc}/100</strong>
            <span>compatibility</span>
          </div>
        </div>
        <div class="crop-body">
          <div class="tags">
            <span class="tag">${rank === 1 ? "Best match" : "Alternative"}</span>
            <span class="tag ${seasonMatch ? "tag--ok" : "tag--warn"}">${seasonMatch ? "Season match" : "Season gap"}</span>
          </div>
          <p>${escapeHtml(crop.note || "No note available.")}</p>
        </div>
      </article>
    `;
  }).join("");

  const reportState = contamination.isToxic
    ? `
      <section class="alert alert--danger">
        <div class="alert-icon">⚠</div>
        <div>
          <h2>Critical contamination detected</h2>
          <p>Lead (Pb): ${contamination.pb} mg/kg ${contamination.pbExcess > 0 ? `( +${contamination.pbExcess.toFixed(1)} over limit )` : ""}<br />Cadmium (Cd): ${contamination.cd} mg/kg ${contamination.cdExcess > 0 ? `( +${contamination.cdExcess.toFixed(1)} over limit )` : ""}</p>
        </div>
      </section>
      <ul class="action-list">
        <li><span class="bullet">•</span><span>Confirm contamination sources with a detailed laboratory analysis.</span></li>
        <li><span class="bullet">•</span><span>Apply remediation measures such as phytoremediation, soil replacement, or stabilization.</span></li>
        <li><span class="bullet">•</span><span>Keep edible crops out of the zone until concentrations are reduced below safe thresholds.</span></li>
        <li><span class="bullet">•</span><span>Document all corrective actions for traceability and future audits.</span></li>
      </ul>
    `
    : `
      <ul class="action-list">
        ${actionRows || '<li><span class="bullet">•</span><span>No major correction is required for the current focus crop.</span></li>'}
      </ul>
    `;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rapport de zone - Analyse de sol</title>
  <style>
    :root {
      --ink: #142235;
      --ink-soft: #4b5e75;
      --line: rgba(20, 34, 53, 0.14);
      --paper: #ffffff;
      --bg: #eef4f8;
      --accent: #1d9e75;
      --accent2: #2f8ef3;
      --warning: #b06010;
      --danger: #c02020;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(47, 142, 243, 0.14), transparent 26%),
        radial-gradient(circle at 92% 8%, rgba(67, 212, 141, 0.16), transparent 24%),
        var(--bg);
      color: var(--ink);
      font-family: "Segoe UI", "Calibri", "Arial", sans-serif;
      line-height: 1.5;
    }
    .sheet {
      max-width: 1160px;
      margin: 0 auto;
      background: var(--paper);
      border: 1px solid rgba(20, 34, 53, 0.08);
      border-radius: 26px;
      box-shadow: 0 24px 80px rgba(15, 24, 39, 0.12);
      overflow: hidden;
    }
    .hero {
      padding: 28px;
      background:
        linear-gradient(135deg, rgba(29, 158, 117, 0.16), rgba(47, 142, 243, 0.16)),
        linear-gradient(180deg, #f9fcfe 0%, #eef8f4 100%);
      border-bottom: 1px solid rgba(20, 34, 53, 0.08);
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 18px;
      align-items: stretch;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(29, 158, 117, 0.12);
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .hero h1 {
      margin: 14px 0 10px;
      font-size: 34px;
      line-height: 1.08;
      letter-spacing: -0.04em;
    }
    .hero p {
      margin: 0;
      max-width: 66ch;
      color: var(--ink-soft);
      font-size: 14px;
    }
    .meta-grid {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .meta-card {
      border: 1px solid rgba(20, 34, 53, 0.08);
      border-radius: 18px;
      background: rgba(255,255,255,0.78);
      padding: 12px 14px;
      box-shadow: 0 10px 20px rgba(15, 24, 39, 0.05);
    }
    .meta-card span { display: block; }
    .meta-card .label {
      color: var(--ink-soft);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .meta-card .value {
      font-size: 16px;
      font-weight: 800;
      color: var(--ink);
    }
    .score-card {
      border-radius: 22px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.82));
      border: 1px solid rgba(20, 34, 53, 0.08);
      box-shadow: 0 18px 34px rgba(15, 24, 39, 0.08);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 100%;
    }
    .score-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: ${scoreBg};
      color: ${scoreAccent};
      font-size: 12px;
      font-weight: 900;
    }
    .score-value {
      margin-top: 10px;
      font-size: 54px;
      line-height: 1;
      font-weight: 900;
      color: ${scoreAccent};
      letter-spacing: -0.06em;
    }
    .score-subtitle {
      margin: 4px 0 0;
      color: var(--ink-soft);
      font-size: 14px;
      font-weight: 600;
    }
    .score-note {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid rgba(20, 34, 53, 0.08);
      color: var(--ink-soft);
      font-size: 13px;
    }
    .section {
      margin: 18px 18px 0;
      border: 1px solid rgba(20, 34, 53, 0.08);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,253,255,0.96));
      box-shadow: 0 12px 26px rgba(15, 24, 39, 0.05);
      padding: 18px;
    }
    .section h2 {
      margin: 0 0 12px;
      font-size: 18px;
      letter-spacing: -0.03em;
      color: var(--ink);
    }
    .param-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      overflow: hidden;
      border-radius: 16px;
    }
    .param-table th, .param-table td {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid rgba(20, 34, 53, 0.08);
      vertical-align: top;
    }
    .param-table thead th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ink-soft);
      background: rgba(20, 34, 53, 0.03);
    }
    .param-table tbody tr:hover { background: rgba(47, 142, 243, 0.03); }
    .unit { color: var(--ink-soft); font-size: 11px; }
    .pill, .tag {
      display: inline-flex;
      align-items: center;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .tag { background: rgba(47, 142, 243, 0.1); color: var(--accent2); }
    .tag--ok { background: rgba(29, 158, 117, 0.12); color: var(--accent); }
    .tag--warn { background: rgba(176, 96, 16, 0.12); color: var(--warning); }
    .metric-note {
      margin-top: 10px;
      color: var(--ink-soft);
      font-size: 12px;
    }
    .grid-two {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 18px;
      margin: 18px;
    }
    .action-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 10px;
    }
    .action-list li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 11px 12px;
      border-radius: 14px;
      background: rgba(47, 142, 243, 0.05);
      border: 1px solid rgba(47, 142, 243, 0.08);
      font-size: 13px;
      color: var(--ink);
    }
    .bullet {
      color: var(--accent);
      font-weight: 900;
      line-height: 1.2;
      flex-shrink: 0;
    }
    .alert {
      display: flex;
      gap: 14px;
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(192, 32, 32, 0.18);
      background: linear-gradient(135deg, rgba(192, 32, 32, 0.08), rgba(20, 34, 53, 0.03));
      margin-bottom: 18px;
    }
    .alert--danger h2 {
      margin: 0 0 6px;
      color: var(--danger);
      font-size: 18px;
    }
    .alert--danger p {
      margin: 0;
      color: var(--ink);
      font-size: 13px;
    }
    .alert-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: rgba(192, 32, 32, 0.14);
      color: var(--danger);
      font-size: 20px;
      font-weight: 900;
    }
    .crop-grid {
      display: grid;
      gap: 12px;
    }
    .crop-card {
      border: 1px solid rgba(20, 34, 53, 0.08);
      border-radius: 18px;
      background: rgba(255,255,255,0.94);
      padding: 14px;
    }
    .rank--top { box-shadow: 0 12px 24px rgba(29, 158, 117, 0.08); }
    .rank--mid { box-shadow: 0 10px 20px rgba(47, 142, 243, 0.05); }
    .rank--low { box-shadow: 0 8px 18px rgba(20, 34, 53, 0.04); }
    .crop-head {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .rank {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 900;
      color: white;
      background: linear-gradient(135deg, ${scoreAccent}, ${scoreAccent}cc);
      flex-shrink: 0;
    }
    .crop-emoji {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      font-size: 24px;
      flex-shrink: 0;
    }
    .crop-info h3 {
      margin: 0 0 2px;
      font-size: 15px;
    }
    .crop-info p, .crop-body p {
      margin: 0;
      color: var(--ink-soft);
      font-size: 12px;
    }
    .crop-score {
      margin-left: auto;
      text-align: right;
    }
    .crop-score strong {
      display: block;
      font-size: 20px;
      line-height: 1;
    }
    .crop-score span {
      display: block;
      color: var(--ink-soft);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 3px;
    }
    .crop-body {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(20, 34, 53, 0.08);
    }
    .tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .footer {
      padding: 20px 28px 26px;
      color: var(--ink-soft);
      font-size: 12px;
      border-top: 1px solid rgba(20, 34, 53, 0.08);
      background: linear-gradient(180deg, rgba(247,250,253,0.88), rgba(238,246,242,0.95));
    }
    .footer strong { color: var(--ink); }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { border: none; border-radius: 0; box-shadow: none; }
      .hero, .section, .footer { break-inside: avoid; }
    }
    @media (max-width: 900px) {
      body { padding: 12px; }
      .hero, .grid-two { grid-template-columns: 1fr; }
      .meta-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <article class="sheet">
    <header class="hero">
      <div class="hero-main">
        <div class="eyebrow">Zone report · ${escapeHtml(modeLabel)} mode</div>
        <h1>Full zone report for ${safeParcelle}</h1>
        <p>
          This report summarizes the analyzed zone, the measured soil indicators, the crop fit score,
          and the corrective actions needed before planting.
        </p>

        <div class="meta-grid">
          <div class="meta-card"><span class="label">Parcel</span><span class="value">${safeParcelle}</span></div>
          <div class="meta-card"><span class="label">Zone</span><span class="value">Zone ${zoneNumber} / ${totalZones}</span></div>
          <div class="meta-card"><span class="label">Area</span><span class="value">${escapeHtml(surface)}</span></div>
          <div class="meta-card"><span class="label">Target culture</span><span class="value">${safeCulture}</span></div>
          <div class="meta-card"><span class="label">Season</span><span class="value">${escapeHtml(getSeasonLabel(state.seas))}</span></div>
          <div class="meta-card"><span class="label">Generated</span><span class="value">${safeDate}</span></div>
        </div>
      </div>

      <aside class="score-card">
        <div>
          <div class="score-top">
            <div>
              <div class="score-badge">Overall zone score</div>
              <div class="score-value">${score}</div>
            </div>
            <div class="score-badge" style="background:${scoreBg};color:${scoreAccent}">${escapeHtml(scoreLabel)}</div>
          </div>
          <div class="score-subtitle">${escapeHtml(scoreNote)}</div>
        </div>
        <div class="score-note">
          Focus crop: <strong>${escapeHtml(focusCrop?.n || "No crop selected")}</strong><br />
          ${focusCrop ? `Compatibility score is calculated from the current zone state and crop requirements.` : `No crop profile was available, so the score reflects the most suitable general fit.`}
        </div>
      </aside>
    </header>

    <section class="section">
      <h2>Measured parameters</h2>
      <table class="param-table" aria-label="Zone parameter summary">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Value</th>
            <th>Status</th>
            <th>Interpretation</th>
          </tr>
        </thead>
        <tbody>
          ${metricRows}
        </tbody>
      </table>
      <div class="metric-note">The status is computed against the current zone crop profile when available, otherwise it uses a general agronomic reference.</div>
    </section>

    <div class="grid-two">
      <section class="section" style="margin:0;">
        <h2>Priority actions</h2>
        ${reportState}
      </section>

      <section class="section" style="margin:0;">
        <h2>Best crop matches</h2>
        <div class="crop-grid">
          ${cropCards || '<div class="metric-note">No crop profiles were loaded for this report.</div>'}
        </div>
      </section>
    </div>

    <div class="footer">
      <strong>Note:</strong> This report is meant to be downloaded, shared, and printed as a field-ready zone summary.
      It complements the laboratory request and does not replace formal lab results.
    </div>
  </article>
</body>
</html>`;
}

/* â”€â”€â”€ Default state factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PERMANENT_DEPTHS = [
  { key: "depth0_20", label: "0-20 cm", note: "Surface layer" },
  { key: "depth20_40", label: "20-40 cm", note: "Root zone" },
];

function buildDepthState(mode = "eco") {
  return {
    ph: 6.5,
    ce: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.ce : 1.2,
    temp: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.temp : 18,
    n: 45,
    p: 22,
    k: 180,
    lime: 8,
    pb: 10,
    cd: 0.5,
    tex: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.tex : "limon-argileux",
    mo: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.om : "moyen",
  };
}

const freshSt = (mode = "eco") => {
  const primaryDepth = buildDepthState(mode);
  return {
    date: toDateInputValue(),
    ...primaryDepth,
    wind: 12,
    seas: seasonFromDate(toDateInputValue()),
    crop: "",
    permanentDepths: {
      depth0_20: { ...primaryDepth },
      depth20_40: buildDepthState(mode),
    },
  };
};

/* ATOM COMPONENTS */
function ZoneBar({ id }) {
  if (!ZC[id]) return null;
  return (
    <div className="sd-zones">
      {ZC[id].map((z,i) => <div key={i} className="sd-zone" style={{flex:z.f,background:z.c}} />)}
    </div>
  );
}

function Slider({ id, label, unit, min, max, step, value, onChange, zones, badge, l, m, r, locked, src }) {
  const pct = ((value - min) / (max - min)) * 100;
  const fill = locked ? "#5DCAA5" : "#5ed4a0";
  const track = `linear-gradient(to right,${fill} 0%,${fill} ${pct}%,rgba(0,0,0,.09) ${pct}%,rgba(0,0,0,.09) 100%)`;
  return (
    <div className={`sd-slider ${locked ? "sd-slider--sat" : ""}`}>
      <div className="sd-slider-head">
        <div className="sd-slider-label-row">
          <span className="sd-slider-label">{label}</span>
          {locked && (
            <span className="sd-sat-tag">
              <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1" />
                <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
              </svg>
              {src}
            </span>
          )}
        </div>
        <span className="sd-slider-val">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          <span className="sd-slider-unit">{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        style={{background: track}}
        className={locked ? "sd-range--sat" : ""}
        disabled={locked}
        onChange={e => !locked && onChange(id, parseFloat(e.target.value))}
      />
      {zones && <ZoneBar id={id}/>}
      <div className="sd-slider-scale"><span>{l}</span>{m && <span>{m}</span>}<span>{r}</span></div>
      {locked && (
        <div className="sd-sat-lock">
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <rect x="1.5" y="4" width="6" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <path d="M3 4V2.8a1.5 1.5 0 013 0V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Imported from {src}
        </div>
      )}
    </div>
  );
}

function PermanentDepthSection({ depth, sectionColor, isSat, st, onChange }) {
  return (
    <div className="sd-depth-card" style={{ borderColor: `${sectionColor}26` }}>
      <div className="sd-depth-head">
        <div className="sd-depth-title" style={{ color: sectionColor }}>{depth.label}</div>
        <div className="sd-depth-note">{depth.note}</div>
      </div>

      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:sectionColor}}>1</span>Soil Chemistry</div>
        <Slider id="ph" label="Soil pH" unit="pH" min={4} max={9} step={0.1} value={st.ph} onChange={(id, value) => onChange(id, value, depth.key)} zones l="4.0 Acidic" m="6.5 Neutral" r="9.0 Alkaline" />
        <Slider id="ce" label="Salinity (EC)" unit="dS/m" min={0} max={6} step={0.1} value={st.ce} onChange={(id, value) => onChange(id, value, depth.key)} zones l="0 None" m="2.0 Limit" r="6.0 Critical" locked={isSat("ce")} src={SAT_FIELDS.ce} />
      </div>

      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:sectionColor}}>2</span>NPK Fertility</div>
        <Slider id="n" label="Nitrogen (N)" unit="kg/ha" min={0} max={400} step={1} value={st.n} onChange={(id, value) => onChange(id, value, depth.key)} zones l="Low" m="30-60 Optimal" r="400" />
        <Slider id="p" label="Phosphorus (P)" unit="kg/ha" min={0} max={400} step={1} value={st.p} onChange={(id, value) => onChange(id, value, depth.key)} zones l="0" m="15-30 Optimal" r="400" />
        <Slider id="k" label="Potassium (K)" unit="kg/ha" min={0} max={400} step={5} value={st.k} onChange={(id, value) => onChange(id, value, depth.key)} zones l="0" m="130-250 Opt." r="400" />
        <Slider id="lime" label="Active Lime" unit="%" min={0} max={30} step={1} value={st.lime} onChange={(id, value) => onChange(id, value, depth.key)} zones l="0 Low" m="8-12 Preferred" r="30 High" />
      </div>

      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:sectionColor}}>3</span>Physical Properties</div>
        <div className="sd-two">
          <div>
            <div className="sd-col-lbl">
              Soil Texture
              {isSat("tex") && (
                <span className="sd-sat-tag" style={{marginLeft:5}}>
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1" />
                    <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
                  </svg>
                  {SAT_FIELDS.tex}
                </span>
              )}
            </div>
            <div className="sd-opts">
              {[
                {val:"limon-argileux",label:"Clay loam", sub:"Ideal for vegetables"},
                {val:"limoneux", label:"Loam", sub:"Very fertile"},
                {val:"sablo-limoneux",label:"Sandy loam",sub:"Balanced drainage"},
                {val:"sableux", label:"Sandy", sub:"Fast drainage"},
                {val:"argileux", label:"Clay", sub:"High retention"},
              ].map(o => (
                <div
                  key={o.val}
                  className={`sd-opt ${st.tex===o.val?"sd-opt--on":""} ${isSat("tex")?"sd-opt--locked":""}`}
                  onClick={() => !isSat("tex") && onChange("tex", o.val, depth.key)}
                >
                  <div className="sd-opt-r"><div className="sd-opt-dot" /></div>
                  <div>
                    <div className="sd-opt-lbl">{o.label}</div>
                    <div className="sd-opt-sub">{o.sub}</div>
                  </div>
                  {isSat("tex") && st.tex===o.val && (
                    <div className="sd-opt-sat-mark">
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <circle cx="4.5" cy="4.5" r="3.5" stroke="#1D9E75" strokeWidth="1.1" />
                        <circle cx="4.5" cy="4.5" r="1.2" fill="#1D9E75" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="sd-col-lbl">
              Organic Matter
              {isSat("om") && (
                <span className="sd-sat-tag" style={{marginLeft:5}}>
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1" />
                    <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
                  </svg>
                  {SAT_FIELDS.om}
                </span>
              )}
            </div>
            <div className="sd-opts">
              {[
                {val:"tres-bas",label:"Very low <1%"},
                {val:"bas", label:"Low 1-2%"},
                {val:"moyen", label:"Medium 2-4%"},
                {val:"bon", label:"Good 4-6%"},
                {val:"excellent",label:"Excellent >6%"},
              ].map(o => (
                <div
                  key={o.val}
                  className={`sd-opt ${st.mo===o.val?"sd-opt--on":""} ${isSat("om")?"sd-opt--locked":""}`}
                  onClick={() => !isSat("om") && onChange("mo", o.val, depth.key)}
                >
                  <div className="sd-opt-r"><div className="sd-opt-dot" /></div>
                  <div><div className="sd-opt-lbl">{o.label}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:sectionColor}}>4</span>Environmental Risks</div>
        <Slider id="pb" label="Lead (Pb)" unit="mg/kg" min={0} max={100} step={1} value={st.pb} onChange={(id, value) => onChange(id, value, depth.key)} zones l="0 Clean" m="25 Alert" r="100 Critical" />
        <Slider id="cd" label="Cadmium (Cd)" unit="mg/kg" min={0} max={20} step={0.1} value={st.cd} onChange={(id, value) => onChange(id, value, depth.key)} zones l="0 Clean" m="25 Alert" r="100 Critical" />
      </div>
    </div>
  );
}

/* ZONE FORM */
function ZoneForm({ zoneIdx, color, light, diagMode, st, onChange, crops, cultureLabel, onAnalyze, analyzing, hasResult, onPrintLabRequest, onPrintLabRequestEco }) {
  const isSat = id => diagMode === "eco" && id in SAT_FIELDS;
  const seasonLabel = getSeasonLabel(st.seas);
  const seasonEmoji = SEASON_EMOJIS[st.seas] || "📅";
  const isPermanentCulture = cultureLabel === "Permanent";

  return (
    <div className="sd-fc">
      <div className="sd-zone-strip" style={{background: light, borderLeft: `4px solid ${color}`}}>
        <div className="sd-zone-strip-dot" style={{background: color}} />
        <span className="sd-zone-strip-name" style={{color}}>Zone {zoneIdx + 1}</span>
        <span className="sd-zone-strip-hint">Enter the soil properties for this zone</span>
      </div>

      {diagMode === "eco" && (
        <div className="sd-sat-notice">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5" cy="5" r="1.5" fill="currentColor" />
          </svg>
          CE: Landsat 8 · Texture: OpenLandMap / SoilGrids (Global Soil Map)
        </div>
      )}

      {diagMode === "standard" && (
        <button className="sd-lab-request-btn" onClick={onPrintLabRequest}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M3 2h7v9H3z" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M4.5 4.3h4M4.5 6.3h4M4.5 8.3h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Download Lab Request
        </button>
      )}

      {diagMode === "eco" && onPrintLabRequestEco && (
        <button className="sd-lab-request-btn" onClick={onPrintLabRequestEco}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M3 2h7v9H3z" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M4.5 4.3h4M4.5 6.3h4M4.5 8.3h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Download Lab Request (Eco)
        </button>
      )}

      {isPermanentCulture ? (
        <>
          <div className="sd-permanent-intro" style={{ borderColor: `${color}24`, background: light }}>
            <div className="sd-permanent-intro-title" style={{ color }}>Permanent crops: two depths in one form</div>
            <div className="sd-permanent-intro-text">Fill both sections for this zone: 0-20 cm and 20-40 cm.</div>
          </div>
          <div className="sd-depth-stack">
            {PERMANENT_DEPTHS.map((depth, index) => (
              <PermanentDepthSection
                key={depth.key}
                depth={depth}
                sectionColor={index === 0 ? color : "#8B6045"}
                isSat={isSat}
                st={{
                  ...(st.permanentDepths?.[depth.key] || buildDepthState(diagMode)),
                  ...(diagMode === "eco" ? { ce: st.ce, temp: st.temp, tex: st.tex, mo: st.mo } : {}),
                }}
                onChange={onChange}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="sd-sec">
            <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>1</span>Soil Chemistry</div>
            <Slider id="ph" label="Soil pH" unit="pH" min={4} max={9} step={0.1} value={st.ph} onChange={onChange} zones l="4.0 Acidic" m="6.5 Neutral" r="9.0 Alkaline" />
            <Slider id="ce" label="Salinity (EC)" unit="dS/m" min={0} max={6} step={0.1} value={st.ce} onChange={onChange} zones l="0 None" m="2.0 Limit" r="6.0 Critical" locked={isSat("ce")} src={SAT_FIELDS.ce} />
          </div>

          <div className="sd-sec">
            <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>2</span>NPK Fertility</div>
            <Slider id="n" label="Nitrogen (N)" unit="kg/ha" min={0} max={400} step={1} value={st.n} onChange={onChange} zones l="Low" m="30-60 Optimal" r="400" />
            <Slider id="p" label="Phosphorus (P)" unit="kg/ha" min={0} max={400} step={1} value={st.p} onChange={onChange} zones l="0" m="15-30 Optimal" r="400" />
            <Slider id="k" label="Potassium (K)" unit="kg/ha" min={0} max={400} step={5} value={st.k} onChange={onChange} zones l="0" m="130-250 Opt." r="400" />
            <Slider id="lime" label="Active Lime" unit="%" min={0} max={30} step={1} value={st.lime} onChange={onChange} zones l="0 Low" m="8-12 Preferred" r="30 High" />
          </div>

          <div className="sd-sec">
            <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>3</span>Physical Properties</div>
            <div className="sd-two">
              <div>
                <div className="sd-col-lbl">
                  Soil Texture
                  {isSat("tex") && (
                    <span className="sd-sat-tag" style={{marginLeft:5}}>
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1" />
                        <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
                      </svg>
                      {SAT_FIELDS.tex}
                    </span>
                  )}
                </div>
                <div className="sd-opts">
                  {[
                    {val:"limon-argileux",label:"Clay loam", sub:"Ideal for vegetables"},
                    {val:"limoneux", label:"Loam", sub:"Very fertile"},
                    {val:"sablo-limoneux",label:"Sandy loam",sub:"Balanced drainage"},
                    {val:"sableux", label:"Sandy", sub:"Fast drainage"},
                    {val:"argileux", label:"Clay", sub:"High retention"},
                  ].map(o => (
                    <div key={o.val}
                      className={`sd-opt ${st.tex===o.val?"sd-opt--on":""} ${isSat("tex")?"sd-opt--locked":""}`}
                      onClick={() => !isSat("tex") && onChange("tex", o.val)}>
                      <div className="sd-opt-r"><div className="sd-opt-dot" /></div>
                      <div>
                        <div className="sd-opt-lbl">{o.label}</div>
                        <div className="sd-opt-sub">{o.sub}</div>
                      </div>
                      {isSat("tex") && st.tex===o.val && (
                        <div className="sd-opt-sat-mark">
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                            <circle cx="4.5" cy="4.5" r="3.5" stroke="#1D9E75" strokeWidth="1.1" />
                            <circle cx="4.5" cy="4.5" r="1.2" fill="#1D9E75" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="sd-col-lbl">
                  Organic Matter
                  {isSat("om") && (
                    <span className="sd-sat-tag" style={{marginLeft:5}}>
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1" />
                        <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
                      </svg>
                      {SAT_FIELDS.om}
                    </span>
                  )}
                </div>
                <div className="sd-opts">
                  {[
                    {val:"tres-bas",label:"Very low <1%"},
                    {val:"bas", label:"Low 1-2%"},
                    {val:"moyen", label:"Medium 2-4%"},
                    {val:"bon", label:"Good 4-6%"},
                    {val:"excellent",label:"Excellent >6%"},
                  ].map(o => (
                    <div key={o.val}
                      className={`sd-opt ${st.mo===o.val?"sd-opt--on":""} ${isSat("om")?"sd-opt--locked":""}`}
                      onClick={() => !isSat("om") && onChange("mo", o.val)}>
                      <div className="sd-opt-r"><div className="sd-opt-dot" /></div>
                      <div><div className="sd-opt-lbl">{o.label}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="sd-sec">
            <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>4</span>Environmental Risks</div>
            <Slider id="pb" label="Lead (Pb)" unit="mg/kg" min={0} max={900} step={1} value={st.pb} onChange={onChange} zones l="0 Clean" m="25 Alert" r="900 Critical" />
            <Slider id="cd" label="Cadmium (Cd)" unit="mg/kg" min={0} max={20} step={0.1} value={st.cd} onChange={onChange} zones l="0 Clean" m="25 Alert" r="20 Critical" />
          </div>
        </>
      )}

      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>5</span>Field Date</div>
        <div className="sd-date-grid">
          <label className="sd-date-card" style={{borderColor:`${color}24`}}>
            <span className="sd-date-card-lbl">Pick a day</span>
            <input
              type="date"
              className="sd-date-input"
              value={st.date}
              onChange={e => {
                const d = e.target.value;
                onChange("date", d);
                onChange("seas", seasonFromDate(d));
              }}
            />
            <span className="sd-date-card-hint">Used in the analysis and recommendations.</span>
          </label>
          <div className="sd-season-card" style={{background:`${color}10`, borderColor:`${color}22`}}>
            <span className="sd-season-card-lbl">Derived season</span>
            <div className="sd-season-card-val" style={{color}}>{seasonEmoji} {seasonLabel}</div>
            <span className="sd-season-card-hint">Used in the analysis and recommendations.</span>
          </div>
        </div>
      </div>

      <div className="sd-sec">
        <div className="sd-sec-lbl">
          <span className="sd-sec-num" style={{background:color}}>6</span>
          Target Crop
          <span className="sd-sec-opt"> - optional</span>
        </div>
        <div className="sd-crops-count">
          <span>{crops.length} crops · {cultureLabel}</span>
        </div>
        <div className="sd-select-wrap">
          <select className="sd-sel" value={st.crop} onChange={e => onChange("crop", e.target.value)}>
            <option value="">Recommend for me</option>
            {crops.map(c => <option key={c.id} value={c.id}>{c.e} {c.n} / {c.ar}</option>)}
          </select>
          <svg className="sd-sel-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 4.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <div className="sd-sub-wrap">
        {hasResult ? (
          <div className="sd-zone-done-hint" style={{ borderColor: `${color}44`, background: `${color}12`, color }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M2.5 7.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Zone {zoneIdx + 1} analyzed. Continue from the results panel.
          </div>
        ) : (
          <button
            className="sd-sub-btn"
            style={{
              background: `linear-gradient(135deg,${color},${color}cc)`,
              boxShadow: `0 6px 0 ${color}44,0 10px 24px ${color}28`
            }}
            disabled={analyzing}
            onClick={onAnalyze}
          >
            {analyzing ? (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{animation:"sd-spin .7s linear infinite"}}>
                  <path d="M14 8a6 6 0 11-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12l6.5-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Analyze Zone {zoneIdx + 1}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* RESULTS VIEW - âœ… FIXED WITH CONTAMINATION WARNING */
function ResultsView({
  st, onReset, crops, diagMode, color, zoneIdx, nZones, onNext, onDownloadReport,
  onOpenDashboard, showDashboardAction = false,
}) {
  // âœ… NEW: Check for severe contamination (Pb>800 OR Cd>15)
  const contamination = isSoilToxic(st);

  const sc = calcScore(st, crops), scC = mc(sc), scBg = mcBg(sc);
  const scLbl = sc>=80 ? "Excellent 🎉" : sc>=60 ? "Needs improvement" : "Difficult";

  // âœ… NEW: Soil type compatibility filter (same or tolerated swap only)
  const isTextureAllowed = (actual, preferred) => {
    if (!actual || !preferred) return true;
    if (actual === preferred) return true;
    const compatible = new Set([
      "limoneux|sablo-limoneux", "sablo-limoneux|limoneux",
      "limoneux|limon-argileux", "limon-argileux|limoneux",
      "sablo-limoneux|sableux", "sableux|sablo-limoneux",
      "limon-argileux|argileux", "argileux|limon-argileux"
    ]);
    return compatible.has(`${actual}|${preferred}`);
  };

  const scored = crops
    .map(c => ({...c, sc: cropScore(c,st), adj: cropAdj(c,st)}))
    .filter(c => isTextureAllowed(st.tex, c.prefTex))
    .sort((a,b) => b.sc - a.sc);

  const tgt  = st.crop ? scored.find(c => c.id===st.crop) : null;
  const bestCrop = scored[0] || null;
  const focusCrop = tgt || scored[0] || null;
  const recs = tgt ? null : scored.slice(1,4);
  const alts = tgt ? scored.filter(c => c.id!==st.crop && c.id!==bestCrop?.id).slice(0,3) : [];
  const sn   = SN[st.seas], iw = st.seas==="hiver";

  return (
    <>
      {/* âœ… SEVERE CONTAMINATION WARNING - Shows when Pb>800 OR Cd>15 */}
      {contamination.isToxic && (
        <div className="sd-toxic-alert" style={{
          background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
          border: "2px solid #000",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          color: "#fff"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
              <path d="M16 2L2 28h28L16 2z" stroke="#ff4444" strokeWidth="3" fill="#2d0000" />
              <path d="M16 10v8M16 22v2" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#ff6b6b" }}>
                ⚠️ Soil Unusable - Critical Contamination
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#ccc" }}>
                Heavy metal levels exceed safe limits for ALL crops
              </p>
            </div>
          </div>

          <div style={{
            background: "rgba(255,68,68,0.1)",
            border: "1px solid rgba(255,68,68,0.3)",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "16px"
          }}>
            <div style={{ fontSize: "14px", marginBottom: "8px" }}>
              <strong style={{ color: "#ff6b6b" }}>Detected Levels:</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
              <div style={{ color: contamination.pbExcess > 0 ? "#ff6b6b" : "#aaa" }}>
                Lead (Pb): {contamination.pb} mg/kg
                {contamination.pbExcess > 0 && ` (+${contamination.pbExcess} over limit)`}
              </div>
              <div style={{ color: contamination.cdExcess > 0 ? "#ff6b6b" : "#aaa" }}>
                Cadmium (Cd): {contamination.cd} mg/kg
                {contamination.cdExcess > 0 && ` (+${contamination.cdExcess} over limit)`}
              </div>
            </div>
          </div>

          <div style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "8px",
            padding: "16px",
            fontSize: "14px",
            lineHeight: "1.6"
          }}>
            <strong style={{ color: "#ffd700", display: "block", marginBottom: "8px" }}>
              Required Actions Before Cultivation:
            </strong>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#ddd" }}>
              <li>Conduct detailed soil testing to confirm contamination sources</li>
              <li>Implement soil remediation (phytoremediation, soil replacement, or chemical stabilization)</li>
              <li>Consult environmental authorities for contamination management</li>
              <li>Do NOT plant edible crops until levels are reduced below safe thresholds</li>
            </ul>
          </div>
        </div>
      )}

      {/* âœ… Only show crop recommendations if soil is NOT toxic */}
      {!contamination.isToxic && (
        <div className="sd-results">
          {/* Top Recommendation */}
          {!tgt && (
            <div className="sd-a1">
              <div className="sd-sec-head">
                <span className="sd-sec-head-t">🌱 Top recommendation</span>
                <span className="sd-sec-head-m">Best match</span>
              </div>
              {bestCrop && (
                <div className="sd-rec-card sd-rec-card--top">
                  <div className="sd-rec-top">
                    <div className="sd-rec-rank">#1</div>
                    <div className="sd-rec-emoji" style={{background:bestCrop.bg}}>{bestCrop.e}</div>
                    <div className="sd-rec-info">
                      <div className="sd-rec-name">{bestCrop.n}</div>
                      <div className="sd-rec-lat">{bestCrop.ar}</div>
                    </div>
                    <div className="sd-rec-score">
                      <div className="sd-rec-pct" style={{color:mc(bestCrop.sc)}}>{bestCrop.sc}/100</div>
                      <div className="sd-rec-pct-lbl">compatibility</div>
                      <div className="sd-rec-best-tag">★ Best choice</div>
                    </div>
                  </div>
                  <div className="sd-rec-bottom">
                    <div className="sd-rec-chip-row">
                      <span className="sd-rec-chip">TOP CROP</span>
                      {bestCrop?.ss?.includes(st.seas) ? (
                        <span className="sd-rec-chip">SEASON MATCH</span>
                      ) : (
                        <span className="sd-rec-chip" style={{ background: "#ffe0e0", color: "#c02020", border: "1px solid #ffc8c8" }}>
                          ⚠️ WRONG SEASON · HIGH FAILURE RISK
                        </span>
                      )}
                    </div>
                    <div className="sd-rec-note">{bestCrop.note}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Season alert */}
          {sn && (
            <div className="sd-sea-alert sd-a2"
              style={{background:iw?"rgba(160,200,255,.18)":"rgba(255,220,120,.18)",borderColor:iw?"rgba(100,160,240,.3)":"rgba(220,160,40,.3)",color:iw?"#1e40af":"#92400e"}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M8 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="12" r=".7" fill="currentColor" />
              </svg>
              {sn}
            </div>
          )}

          {/* 6 param pills */}
          <div className="sd-param-pills sd-a2">
            {PARAM_ROWS.map((row,ri) => (
              <div key={ri} className="sd-param-pill-row">
                {row.map(p => {
                  const v = st[p.id];
                  const pct = (((v-p.mn)/(p.mx-p.mn))*100).toFixed(1);
                  const fit = pSt(p.id, v, focusCrop);
                  const [bg2,c2] = {ok:["#c8f5e0","#1a7a50"],lo:["#fff3c8","#b06010"],hi:["#ffc8c8","#c02020"]}[fit];
                  const pill = statusLabel(p.id, v, focusCrop);
                  const isSatPill = (diagMode==="eco" || diagMode==="standard") && SAT_FIELDS[p.id];
                  return (
                    <div key={p.id} className={`sd-param-pill ${isSatPill?"sd-param-pill--sat":""}`} style={{borderBottom:`3px solid ${c2}40`}}>
                      <div className="sd-param-pill-top">
                        <span className="sd-param-pill-name">
                          {p.name}
                          {isSatPill && <span className="sd-param-sat-dot" />}
                        </span>
                        <span className="sd-param-pill-badge" style={{background:bg2,color:c2}}>{pill}</span>
                      </div>
                      <div className="sd-param-pill-val">{Number.isInteger(v)?v:v.toFixed(1)}<small>{p.u}</small></div>
                      <div className="sd-param-bar" style={{background:bg2}}>
                        <div className="sd-param-bar-inner" style={{width:`${pct}%`,background:c2}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {recs && (
            <div className="sd-a3">
              <div className="sd-sec-head">
                <span className="sd-sec-head-t">🌱 Recommended Crops</span>
                <span className="sd-sec-head-m">{st.seas} · next 3</span>
              </div>
              <div className="sd-rec-cards">
                {recs.map((c,i) => (
                  <div key={c.id} className={`sd-rec-card ${i===0?"sd-rec-card--top":""}`}>
                    <div className="sd-rec-top">
                      <div className="sd-rec-rank">#{i + 1}</div>
                      <div className="sd-rec-emoji" style={{background:c.bg}}>{c.e}</div>
                      <div className="sd-rec-info">
                        <div className="sd-rec-name">{c.n}</div>
                        <div className="sd-rec-lat">{c.ar}</div>
                      </div>
                      <div className="sd-rec-score">
                        <div className="sd-rec-pct" style={{color:mc(c.sc)}}>{c.sc}/100</div>
                        <div className="sd-rec-pct-lbl">compatibility</div>
                        {i===0 && <div className="sd-rec-best-tag">★ Best choice</div>}
                      </div>
                    </div>
                    <div className="sd-rec-bottom">
                      <div className="sd-rec-chip-row">
                        <span className="sd-rec-chip">Season match</span>
                        <span className="sd-rec-chip">Field-ready</span>
                      </div>
                      <div className="sd-rec-mini-bars">
                        {["ph","ce","temp"].map((bid,j) => {
                          const sv = pSt(bid, st[bid], c);
                          const bc = {ok:"#5ed4a0",lo:"#f5c040",hi:"#f06060"}[sv];
                          const [mn,mx] = {ph:[4,9],ce:[0,6],temp:[0,40]}[bid];
                          const bp = (((st[bid]-mn)/(mx-mn))*100).toFixed(0);
                          return (
                            <div key={bid} className="sd-rec-mbar">
                              <div className="sd-rec-mbar-lbl">{["pH","CE","Temp"][j]}</div>
                              <div className="sd-rec-mbar-track">
                                <div className="sd-rec-mbar-fill" style={{width:`${bp}%`,background:bc}} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="sd-rec-note">{c.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verdict */}
          {tgt && (() => {
            const vrd = tgt.sc>=80
              ? {e:"✅",bg:mcBg(tgt.sc),bc:"rgba(30,130,80,.2)",c:mc(tgt.sc),t:"Crop compatible",s:`Your soil is well suited. You can plant ${tgt.n} without major corrections.`}
              : tgt.sc>=55
              ? {e:"⚠️",bg:"rgba(255,220,100,.18)",bc:"rgba(220,160,40,.3)",c:"#92400e",t:"Compatible with corrections",s:`${tgt.n} can be grown, but adjustments are recommended.`}
              : {e:"❌",bg:"rgba(255,150,140,.18)",bc:"rgba(200,60,60,.25)",c:"#991b1b",t:"Crop not recommended",s:`Current conditions are not favorable for ${tgt.n}.`};
            const altsSection = alts.length > 0;
            return (
              <>
                <div className="sd-a3">
                  <div className="sd-sec-head"><span className="sd-sec-head-t">🔎 Analysis - {tgt.n}</span></div>
                  <div className="sd-verd-card">
                    <div className="sd-verd-top">
                      <div className="sd-verd-chip">Selected crop</div>
                      <div className="sd-verd-emoji" style={{background:tgt.bg}}>{tgt.e}</div>
                      <div className="sd-verd-info">
                        <div className="sd-verd-name">{tgt.n}</div>
                        <div className="sd-verd-lat">{tgt.lat}</div>
                      </div>
                      <div className="sd-verd-pct-blk">
                        <div className="sd-verd-pct" style={{color:mc(tgt.sc)}}>{tgt.sc}/100</div>
                        <div className="sd-verd-pct-lbl">compatibility</div>
                      </div>
                    </div>
                    <div className="sd-verd-status" style={{background:vrd.bg,borderColor:vrd.bc}}>
                      <div className="sd-verd-status-icon" style={{background:vrd.bg,border:`2px solid ${vrd.bc}`}}>{vrd.e}</div>
                      <div>
                        <div className="sd-verd-status-title" style={{color:vrd.c}}>{vrd.t}</div>
                        <div className="sd-verd-status-sub">{vrd.s}</div>
                      </div>
                    </div>
                    {tgt.adj.length > 0 ? (
                      <div className="sd-verd-adjs">
                        <div className="sd-verd-adj-lbl">Required adjustments</div>
                        {tgt.adj.map((a,i) => (
                          <div key={i} className="sd-verd-adj">
                            <div className="sd-verd-adj-pill" style={{background:a.bg}}>⚙</div>
                            {a.t}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="sd-verd-ok">✓ No major adjustment required - you can plant!</div>
                    )}
                  </div>
                </div>
                {altsSection && (
                  <div className="sd-a4">
                    <div className="sd-sec-head" style={{marginTop:4}}><span className="sd-sec-head-t">💡 Suggested Alternatives</span></div>
                    <div className="sd-rec-cards">
                      {alts.map(c => (
                        <div key={c.id} className="sd-rec-card">
                          <div className="sd-rec-top">
                            <div className="sd-rec-rank">Alt</div>
                            <div className="sd-rec-emoji" style={{background:c.bg}}>{c.e}</div>
                            <div className="sd-rec-info">
                              <div className="sd-rec-name">{c.n}</div>
                              <div className="sd-rec-lat">{c.ar}</div>
                            </div>
                            <div className="sd-rec-score">
                              <div className="sd-rec-pct" style={{color:mc(c.sc)}}>{c.sc}/100</div>
                              <div className="sd-rec-pct-lbl">compatibility</div>
                            </div>
                          </div>
                          <div className="sd-rec-bottom">
                            <div className="sd-rec-chip-row">
                              <span className="sd-rec-chip">Alternative</span>
                            </div>
                            <div className="sd-rec-note">{c.note}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* âœ… Action buttons ALWAYS show (even when soil is toxic) */}
      <div className="sd-act-row sd-a5">
        <button className="sd-act sd-act-s" onClick={onReset}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5a4.5 4.5 0 118 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10.2 9.5l.6 2.2 2-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit
        </button>
        <button className="sd-act sd-act-p sd-act-p--report" onClick={onDownloadReport}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 5.5l2.5 2.5L9 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 11.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Download Full Report
        </button>
        {showDashboardAction && (
          <button className="sd-act sd-act-s sd-act-dashboard" onClick={onOpenDashboard}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.2" y="1.2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="6.8" y="1.2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="1.2" y="6.8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <rect x="6.8" y="6.8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Dashboard
          </button>
        )}
        {nZones > 1 && zoneIdx < nZones - 1 && (
          <button
            className="sd-act sd-act-next"
            style={{
              flex: 1,
              justifyContent: 'center',
              background: `linear-gradient(135deg,${color},${color}cc)`,
              boxShadow: `0 4px 0 ${color}44`
            }}
            onClick={onNext}
          >
            Analyze Zone {zoneIdx + 2}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4.5 2L9 6l-4.5 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}

function getParcelBounds(latlngs = []) {
  const pts = latlngs.map(normalizeLatLngPoint).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  return {
    minLat: Math.min(...pts.map((p) => p.lat)),
    maxLat: Math.max(...pts.map((p) => p.lat)),
    minLng: Math.min(...pts.map((p) => p.lng)),
    maxLng: Math.max(...pts.map((p) => p.lng)),
  };
}

function getParcelCentroid(latlngs = []) {
  const pts = latlngs.map(normalizeLatLngPoint).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length) return null;
  const sums = pts.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sums.lat / pts.length, lng: sums.lng / pts.length };
}

function projectPointToBounds(point, bounds, width, height, padding = 18) {
  const p = normalizeLatLngPoint(point);
  const rangeLng = Math.max(bounds.maxLng - bounds.minLng, 0.00001);
  const rangeLat = Math.max(bounds.maxLat - bounds.minLat, 0.00001);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  return {
    x: padding + ((p.lng - bounds.minLng) / rangeLng) * usableWidth,
    y: height - padding - ((p.lat - bounds.minLat) / rangeLat) * usableHeight,
  };
}

function zoneGeometryToPoints(zone) {
  const ring = zone?.geoJson?.geometry?.coordinates?.[0];
  if (!Array.isArray(ring)) return [];
  return ring.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
}

function getHeatTone(score) {
  if (score >= 85) return { fill: "rgba(132, 214, 155, 0.30)", stroke: "#69b685", label: "Optimal" };
  if (score >= 70) return { fill: "rgba(181, 230, 188, 0.28)", stroke: "#8bc89b", label: "Healthy" };
  if (score >= 55) return { fill: "rgba(248, 211, 147, 0.30)", stroke: "#d8ae63", label: "Watch" };
  if (score >= 40) return { fill: "rgba(246, 187, 120, 0.30)", stroke: "#e09047", label: "Low" };
  return { fill: "rgba(245, 168, 168, 0.30)", stroke: "#d96e6e", label: "Critical" };
}

function buildMapExportUrl(bounds, size, service) {
  if (!bounds) return "";
  const bbox = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat].join(",");
  const width = Math.max(640, Math.round(size?.width || 1200));
  const height = Math.max(420, Math.round(size?.height || 900));
  return `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=png32&transparent=true&f=image`;
}

function buildParcelImageUrls(latlngs = [], mapSnapshot = null) {
  const bounds = mapSnapshot?.bounds || getParcelBounds(latlngs);
  const size = mapSnapshot?.size || { width: 1200, height: 900 };
  return {
    imagery: buildMapExportUrl(bounds, size, "World_Imagery"),
    reference: buildMapExportUrl(bounds, size, "Reference/World_Boundaries_and_Places"),
  };
}

function averageMetric(zoneResults, key, parser = Number) {
  const values = zoneResults
    .filter(Boolean)
    .map((zone) => parser(zone[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildAnalysisSnapshot({ zoneResults, crops, parcelleName, parcelleHa, cultureLabel }) {
  const completed = zoneResults.filter(Boolean);
  const scores = completed.map((zone, index) => ({
    zone: index + 1,
    score: calcScore(zone, crops),
    ph: Number(zone.ph),
    ce: Number(zone.ce),
    n: Number(zone.n),
    p: Number(zone.p),
    k: Number(zone.k),
    temp: Number(zone.temp),
    lime: Number(zone.lime),
  }));
  const avgScore = scores.length
    ? Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length)
    : 0;
  const fingerprint = scores.map((item) => `${item.zone}:${item.score}:${item.ph}:${item.n}:${item.p}:${item.k}`).join("|");
  const hasPermanentDepths = completed.some((zone) => zone?.permanentDepths);
  return {
    id: `${Date.now()}-${fingerprint}`,
    timestamp: new Date().toISOString(),
    parcelleName,
    parcelleHa,
    cultureLabel,
    avgScore,
    zoneCount: completed.length,
    scores,
    avgPh: averageMetric(completed, "ph"),
    avgCe: averageMetric(completed, "ce"),
    avgN: averageMetric(completed, "n"),
    avgP: averageMetric(completed, "p"),
    avgK: averageMetric(completed, "k"),
    depthAverages: hasPermanentDepths
      ? {
          depth0_20: {
            ph: averageMetricForDepth(completed, "depth0_20", "ph"),
            ce: averageMetricForDepth(completed, "depth0_20", "ce"),
            n: averageMetricForDepth(completed, "depth0_20", "n"),
            p: averageMetricForDepth(completed, "depth0_20", "p"),
            k: averageMetricForDepth(completed, "depth0_20", "k"),
            lime: averageMetricForDepth(completed, "depth0_20", "lime"),
            pb: averageMetricForDepth(completed, "depth0_20", "pb"),
            cd: averageMetricForDepth(completed, "depth0_20", "cd"),
          },
          depth20_40: {
            ph: averageMetricForDepth(completed, "depth20_40", "ph"),
            ce: averageMetricForDepth(completed, "depth20_40", "ce"),
            n: averageMetricForDepth(completed, "depth20_40", "n"),
            p: averageMetricForDepth(completed, "depth20_40", "p"),
            k: averageMetricForDepth(completed, "depth20_40", "k"),
            lime: averageMetricForDepth(completed, "depth20_40", "lime"),
            pb: averageMetricForDepth(completed, "depth20_40", "pb"),
            cd: averageMetricForDepth(completed, "depth20_40", "cd"),
          },
        }
      : null,
    fingerprint,
  };
}

function formatDelta(current, previous, digits = 0) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "New";
  const delta = current - previous;
  if (Math.abs(delta) < 0.01) return "Stable";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(digits)}`;
}

const HISTORY_METRIC_RANGES = {
  ph: { min: 0, max: 14 },
  ce: { min: 0, max: 8 },
  n: { min: 0, max: 400 },
  p: { min: 0, max: 400 },
  k: { min: 0, max: 400 },
  lime: { min: 0, max: 30 },
  wind: { min: 0, max: 80 },
  pb: { min: 0, max: 100 },
  cd: { min: 0, max: 100 },
};

const DASHBOARD_DEPTH_TABS = [
  { key: "depth0_20", label: "0-20 cm" },
  { key: "depth20_40", label: "20-40 cm" },
];

function averageMetricForDepth(zoneResults, depthKey, metricKey, parser = Number) {
  const values = zoneResults
    .filter(Boolean)
    .map((zone) => parser(zone?.permanentDepths?.[depthKey]?.[metricKey]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getHistoryBarWidth(metricKey, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "8%";
  const range = HISTORY_METRIC_RANGES[metricKey] || { min: 0, max: 100 };
  const pct = ((numericValue - range.min) / Math.max(1, range.max - range.min)) * 100;
  return `${Math.max(8, Math.min(100, pct))}%`;
}

function formatHistoryDateLabel(timestamp) {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DashboardView({
  parcelle,
  parcelleHa,
  parcelImageUrls,
  mapSnapshot,
  zoneResults,
  zones,
  crops,
  activeZone,
  onSelectZone,
  currentAnalysis,
  weather = null,
  weatherLoading = false,
  weatherData = null,
  analysisHistory = [],
  cultureLabel = "",
}) {
  // ADD THIS LINE:
  console.log("DASHBOARD HISTORY STATE:", analysisHistory);
  
  const width = 720;
  const height = 500;
  const frameRatio = mapSnapshot?.size?.width && mapSnapshot?.size?.height
    ? `${mapSnapshot.size.width} / ${mapSnapshot.size.height}`
    : "4 / 3";
  const parcelLatLngs = (parcelle?.latlngs || []).map(normalizeLatLngPoint);
  const bounds = getParcelBounds(parcelLatLngs);
  const activeZoneResult = zoneResults[activeZone] || null;
  const currentSnapshot = currentAnalysis || null;
  // Safely ensure analysisHistory is an array before trying to use .find()
  const safeHistory = Array.isArray(analysisHistory) ? analysisHistory : [];
  const previousSnapshot = safeHistory.find((item) => item?.fingerprint && item.fingerprint !== currentSnapshot?.fingerprint) || null;const isPermanentCulture = cultureLabel === "Permanent";
  const [historyDepthKey, setHistoryDepthKey] = useState("depth0_20");
  const selectedCrop = activeZoneResult?.crop ? crops.find((crop) => String(crop.id) === String(activeZoneResult.crop)) : null;
  const displayWeather = weatherData || weather;
  const displayWeatherLoading = weatherData ? false : weatherLoading;
  const weatherDate = displayWeather?.observedAt ? new Date(displayWeather.observedAt) : new Date();
  const weatherDay = Number.isFinite(weatherDate.getTime()) ? weatherDate.getDate() : new Date().getDate();
  const weatherMonth = Number.isFinite(weatherDate.getTime())
    ? weatherDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const weatherLabel = displayWeatherLoading ? "Loading forecast..." : displayWeather?.currentLabel || "Weather unavailable";
  const weatherIcon = displayWeather?.currentIcon || "⛅";
  const activeDepthResult = isPermanentCulture
    ? activeZoneResult?.permanentDepths?.[historyDepthKey] || null
    : null;
  const previousDepthMetrics = isPermanentCulture
    ? previousSnapshot?.depthAverages?.[historyDepthKey] || null
    : null;

  useEffect(() => {
    if (!isPermanentCulture) {
      setHistoryDepthKey("depth0_20");
    }
  }, [isPermanentCulture]);

  const currentAnalysisMetrics = [
    { key: "ph", label: "Soil pH", value: isPermanentCulture ? activeDepthResult?.ph : activeZoneResult?.ph, previous: isPermanentCulture ? previousDepthMetrics?.ph : previousSnapshot?.avgPh, unit: "pH", format: (value) => Number(value).toFixed(1) },
    { key: "ce", label: "Salinity", value: isPermanentCulture ? activeDepthResult?.ce : activeZoneResult?.ce, previous: isPermanentCulture ? previousDepthMetrics?.ce : previousSnapshot?.avgCe, unit: "dS/m", format: (value) => Number(value).toFixed(1) },
    { key: "n", label: "Nitrogen", value: isPermanentCulture ? activeDepthResult?.n : activeZoneResult?.n, previous: isPermanentCulture ? previousDepthMetrics?.n : previousSnapshot?.avgN, unit: "kg/ha", format: (value) => Math.round(Number(value)) },
    { key: "p", label: "Phosphorus", value: isPermanentCulture ? activeDepthResult?.p : activeZoneResult?.p, previous: isPermanentCulture ? previousDepthMetrics?.p : previousSnapshot?.avgP, unit: "kg/ha", format: (value) => Math.round(Number(value)) },
    { key: "k", label: "Potassium", value: isPermanentCulture ? activeDepthResult?.k : activeZoneResult?.k, previous: isPermanentCulture ? previousDepthMetrics?.k : previousSnapshot?.avgK, unit: "kg/ha", format: (value) => Math.round(Number(value)) },
    { key: "lime", label: "Active lime", value: isPermanentCulture ? activeDepthResult?.lime : activeZoneResult?.lime, previous: isPermanentCulture ? previousDepthMetrics?.lime : null, unit: "%", format: (value) => Math.round(Number(value)) },
    { key: "pb", label: "Lead (Pb)", value: isPermanentCulture ? activeDepthResult?.pb : activeZoneResult?.pb, previous: isPermanentCulture ? previousDepthMetrics?.pb : null, unit: "mg/kg", format: (value) => Math.round(Number(value)) },
    { key: "cd", label: "Cadmium (Cd)", value: isPermanentCulture ? activeDepthResult?.cd : activeZoneResult?.cd, previous: isPermanentCulture ? previousDepthMetrics?.cd : null, unit: "mg/kg", format: (value) => Math.round(Number(value)) },
  ];

  const zoneCards = zoneResults.map((zone, index) => {
    const score = calcScore(zone, crops);
    const tone = getHeatTone(score);
    const zoneGeometry = zones[index] ? zoneGeometryToPoints(zones[index]) : [];
    const projected = zoneGeometry.map((point) => projectPointToBounds(point, bounds, width, height));
    const polygon = projected.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const centroid = projected.length
      ? {
          x: projected.reduce((sum, point) => sum + point.x, 0) / projected.length,
          y: projected.reduce((sum, point) => sum + point.y, 0) / projected.length,
        }
      : null;
    return { zone, index, score, tone, polygon, centroid };
  });

  const bestZone = [...zoneCards].sort((a, b) => b.score - a.score)[0];
  const activeZoneScore = activeZoneResult ? calcScore(activeZoneResult, crops) : 0;
  const growthLevel = Math.max(48, Math.min(96, Math.round(activeZoneScore + 8)));
  const growthMax = Math.min(100, growthLevel + 5);
  const growthMin = Math.max(0, growthLevel - 15);
  const nutrientMix = [
    { id: "n", value: Number(activeZoneResult?.n || 0), color: "#ff5b45" },
    { id: "p", value: Number(activeZoneResult?.p || 0), color: "#f89e3d" },
    { id: "k", value: Number(activeZoneResult?.k || 0), color: "#2ab36b" },
  ];

  return (
    <section className="sd-dashboard sd-dashboard--studio">
      <div className="sd-studio-board">
        <div className="sd-studio-main">
          <div className="sd-studio-topbar">
            <div>
              <h2 className="sd-studio-title">{parcelle?.name || "Parcel"}</h2>
              <p className="sd-studio-subtitle">Your farm performance is stable. Here's today's overview.</p>
            </div>
          </div>

          <div className="sd-studio-grid">
            <div className="sd-studio-left">
              <div className="sd-studio-weather-card">
                <div className="sd-studio-weather-main">
                  <span className="sd-studio-weather-label">{weatherLabel}</span>
                  <div className="sd-studio-weather-emoji">{weatherIcon}</div>
                  <div className="sd-studio-weather-date">
                    <strong>{weatherDay}</strong>
                    <span>{weatherMonth}</span>
                  </div>
                </div>
                <div className="sd-studio-weather-metrics">
                  <div className="sd-studio-weather-pill">
                    <span>Temperature</span>
                    <strong>{displayWeather?.currentTemp != null ? `${Number(displayWeather.currentTemp).toFixed(1)} °C` : "--"}</strong>
                  </div>
                  <div className="sd-studio-weather-pill">
                    <span>Wind</span>
                    <strong>{displayWeather?.currentWindKmh != null ? `${Math.round(Number(displayWeather.currentWindKmh))} km/h` : "--"}</strong>
                  </div>
                  <div className="sd-studio-weather-pill">
                    <span>Rain</span>
                    <strong>{displayWeather?.currentRainMm != null ? `${Number(displayWeather.currentRainMm).toFixed(1)} mm` : "--"}</strong>
                  </div>
                </div>
              </div>

              <div className="sd-studio-stat-row">
                <article className="sd-studio-mini-card">
                  <div className="sd-studio-mini-head"><span>Plant Health</span></div>
                  <div className="sd-studio-mini-value">
                    <strong>{activeZoneScore}%</strong>
                    <span>{activeZoneScore >= 80 ? "Excellent" : activeZoneScore >= 60 ? "Stable" : "Watch"}</span>
                  </div>
                </article>

                <article className="sd-studio-mini-card">
                  <div className="sd-studio-mini-head"><span>Active Crop Zones</span></div>
                  <div className="sd-studio-mini-value">
                    <strong>{zoneResults.filter(Boolean).length}</strong>
                    <span>{bestZone ? `Best zone: ${bestZone.index + 1}` : "Zones analyzed"}</span>
                  </div>
                </article>
              </div>

              <article className="sd-studio-wide-card">
                <div className="sd-studio-wide-head">
                  <div>
                    <strong>Soil Nutrient Status</strong>
                    <span>Balanced nutrient composition</span>
                  </div>
                  <em>{activeZoneScore >= 75 ? "Optimal" : "Monitor"}</em>
                </div>
                <div className="sd-studio-nutrient-wave">
                  {nutrientMix.map((item) => (
                    <div key={item.id} className="sd-studio-nutrient-segment" style={{ width: `${Math.max(18, Math.min(100, item.value / 4))}%`, background: item.color }} />
                  ))}
                </div>
              </article>

              <div className="sd-studio-growth-card">
                <div className="sd-studio-growth-head">
                  <div>
                    <strong>Growth Analytics</strong>
                    <span>Strong nutrient balance</span>
                  </div>
                </div>
                <div className="sd-studio-growth-gauge">
                  <div className="sd-studio-growth-arc" style={{ background: `conic-gradient(#5dc89d 0deg, #4cbf93 ${growthLevel * 2.4}deg, rgba(93,200,157,.18) ${growthLevel * 2.4}deg 360deg)` }} />
                  <div className="sd-studio-growth-inner">
                    <strong>{growthLevel}%</strong>
                    <span>Growth Level</span>
                  </div>
                </div>
                <div className="sd-studio-growth-stats">
                  <div><strong>{growthMax}</strong><span>Max</span></div>
                  <div><strong>{growthMin}</strong><span>Min</span></div>
                  <div><strong>{activeZoneScore}</strong><span>Plant health</span></div>
                </div>
              </div>
            </div>

            <div className="sd-studio-right">
              <div className="sd-studio-map-card">
                <div className="sd-heatmap-frame sd-heatmap-frame--studio" style={{ aspectRatio: frameRatio }}>
                  <img
                    className="sd-heatmap-image"
                    src={parcelImageUrls?.imagery || satelliteFallback}
                    alt={`Satellite view of ${parcelle?.name || "the parcel"}`}
                    onError={(e) => {
                      if (e.currentTarget.src !== new URL(satelliteFallback, window.location.href).href) {
                        e.currentTarget.src = satelliteFallback;
                      }
                    }}
                  />
                  {parcelImageUrls?.reference && (
                    <img
                      className="sd-heatmap-image sd-heatmap-image--reference"
                      src={parcelImageUrls.reference}
                      alt=""
                      aria-hidden="true"
                    />
                  )}
                  <svg className="sd-heatmap-overlay" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    <defs>
                      <filter id="sdGlow">
                        <feGaussianBlur stdDeviation="10" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <pattern id="sdHeatNoise" width="120" height="120" patternUnits="userSpaceOnUse">
                        <circle cx="20" cy="22" r="20" fill="rgba(255,255,255,0.16)" />
                        <circle cx="86" cy="50" r="24" fill="rgba(255,255,255,0.14)" />
                        <circle cx="56" cy="90" r="18" fill="rgba(255,255,255,0.12)" />
                      </pattern>
                    </defs>

                    {zoneCards.map((item) => (
                      <g
                        key={item.index}
                        className={`sd-heatmap-zone ${activeZone === item.index ? "sd-heatmap-zone--active" : ""}`}
                        onClick={() => onSelectZone(item.index)}
                      >
                        {item.polygon && (
                          <>
                            <polygon points={item.polygon} fill={item.tone.fill} stroke={item.tone.stroke} strokeWidth="3" filter="url(#sdGlow)" />
                            <polygon points={item.polygon} fill="url(#sdHeatNoise)" opacity="0.18" />
                          </>
                        )}
                        {item.centroid && (
                          <g transform={`translate(${item.centroid.x}, ${item.centroid.y})`}>
                            <rect x="-56" y="-18" width="112" height="36" rx="18" fill="rgba(255,255,255,0.22)" />
                            <text textAnchor="middle" y="3" className="sd-heatmap-zone-label">Zone {item.index + 1}</text>
                          </g>
                        )}
                      </g>
                    ))}
                  </svg>

                </div>
              </div>

              <div className="sd-studio-history-card">
                <div className="sd-studio-history-head">
                  <div className="sd-studio-history-head-main">
                    <strong>Analysis History</strong>
                    <span>
                      {isPermanentCulture
                        ? "Compact comparison by soil depth"
                        : "Compact comparison with previous snapshot"}
                    </span>
                  </div>
                  <div className="sd-studio-history-head-actions">
                    {isPermanentCulture && (
                      <div className="sd-history-depth-tabs" role="tablist" aria-label="History depth selector">
                        {DASHBOARD_DEPTH_TABS.map((depth) => (
                          <button
                            key={depth.key}
                            type="button"
                            className={`sd-history-depth-tab ${historyDepthKey === depth.key ? "sd-history-depth-tab--active" : ""}`}
                            onClick={() => setHistoryDepthKey(depth.key)}
                          >
                            {depth.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="sd-history-legend">
                      <span><i className="sd-history-legend-swatch sd-history-legend-swatch--current" />Current</span>
                      <span><i className="sd-history-legend-swatch sd-history-legend-swatch--last" />Previous</span>
                    </div>
                  </div>
                </div>

                <div className="sd-studio-history-list">
                  {currentAnalysisMetrics.map((item) => {
                    const displayValue = item.value;
                    const previousValue = item.previous;
                    const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                    const hasPrevious = previousValue !== null && previousValue !== undefined && previousValue !== "";
                    const currentWidth = getHistoryBarWidth(item.key, displayValue);
                    const previousWidth = getHistoryBarWidth(item.key, previousValue);

                    return (
                      <div key={item.key} className="sd-studio-history-row">
                        <div className="sd-studio-history-meta">
                          <span>{item.label}</span>
                          <strong>{hasValue ? (item.unit ? `${item.format(displayValue)} ${item.unit}` : item.format(displayValue)) : "—"}</strong>
                        </div>
                        <div className="sd-studio-history-bars">
                          <div className="sd-history-bar sd-history-bar--current" style={{ width: currentWidth }} />
                          <div className={`sd-history-bar ${hasPrevious ? "sd-history-bar--last" : "sd-history-bar--last sd-history-bar--empty"}`} style={{ width: hasPrevious ? previousWidth : "16%" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* MAIN COMPONENT */
export default function SoilDiagnostic({
  open, onClose,
  parcelleName   = "Parcel A",
  parcelleHa     = 0,
  cultureGroupId = 1,
  parcelle       = null,
  mapSnapshot    = null,
  zones          = [],
  nZones         = 1,
  initialDiagMode = "eco",
  weatherData = null,
  persistedDashboardData = null,
  startInDashboard = false,
}) {
  const [diagMode,    setDiagMode]    = useState(initialDiagMode);
  const [activeZone,  setActiveZone]  = useState(0);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [rawCrops,    setRawCrops]    = useState([]);
  const [windByMonth, setWindByMonth] = useState({});
  const [zoneStates,  setZoneStates]  = useState(() => Array.from({length: Math.max(1,nZones)}, () => freshSt(initialDiagMode)));
  const [zoneResults, setZoneResults] = useState(() => Array(Math.max(1,nZones)).fill(null));
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [parcelWeather, setParcelWeather] = useState(null);
  const [parcelWeatherLoading, setParcelWeatherLoading] = useState(false);
  // In-memory cache for satellite responses to avoid repeated network calls
  const satCacheRef = useRef(new Map());
  const lastStoredFingerprintRef = useRef("");
  const n = Math.max(1, nZones);

  const CROPS = useMemo(() => rawCrops.map(toCrop), [rawCrops]);
  const cultureLabel = cultureGroupId===1?"Vegetables":cultureGroupId===2?"Cereals":"Permanent";
  const parcelWeatherCentroid = useMemo(() => getParcelCentroid(parcelle?.latlngs || []), [parcelle]);
  const parcelWeatherPoints = useMemo(
    () => (parcelle?.latlngs || [])
      .map((point) => {
        const normalized = normalizeLatLngPoint(point);
        return [normalized.lat, normalized.lng];
      })
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
    [parcelle]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchCrops = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/crops/requirements`);
        if (!response.ok) throw new Error("Failed to load crop requirements");
        const data = await response.json();

        if (!cancelled) {
          const allCrops = Array.isArray(data) ? data : [];
          
          // Determine the target category based on the selected tab
          const targetCategory = cultureGroupId === 1 ? "vegetables" :
                                 cultureGroupId === 2 ? "cereals" : "trees";

          // Safely filter crops for the dropdown
          const filteredCrops = allCrops.filter(crop => {
            // First, try matching by the exact group ID if it exists
            const groupId = crop.group_id || crop.groupId;
            if (groupId) {
                return Number(groupId) === cultureGroupId;
            }

            // Fallback: Check the category string (French or English)
            const cat = String(crop.category || "").toLowerCase();
            
            if (targetCategory === "vegetables") return cat.includes("vegetable") || cat.includes("maraich") || cat.includes("maraîch");
            if (targetCategory === "cereals") return cat.includes("cereal") || cat.includes("forage") || cat.includes("céréal");
            if (targetCategory === "trees") return cat.includes("tree") || cat.includes("permanent") || cat.includes("fruit");
            
            return true; 
          });

          // Fallback: If the filter is too strict and returns 0, just show ALL crops
          // so the dropdown never breaks and says "0 crops".
          setRawCrops(filteredCrops.length > 0 ? filteredCrops : allCrops);
        }
      } catch (error) {
        console.warn("⚠️ Crop requirements fetch failed:", error);
        if (!cancelled) setRawCrops([]);
      }
    };

    fetchCrops();

    return () => {
      cancelled = true;
    };
  }, [cultureGroupId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchWindExpectations = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/wind-expectations`);
        if (!response.ok) throw new Error("Failed to load wind expectations");
        const data = await response.json();
        if (cancelled) return;
        const byMonth = {};
        (Array.isArray(data) ? data : []).forEach(item => {
          const month = Number(item?.monthId);
          const speed = Number(item?.avgWindSpeedKmh);
          if (month >= 1 && month <= 12 && Number.isFinite(speed)) {
            byMonth[month] = speed;
          }
        });
        setWindByMonth(byMonth);
      } catch (error) {
        console.warn("âš ï¸ Wind expectations fetch failed:", error);
        if (!cancelled) setWindByMonth({});
      }
    };

    fetchWindExpectations();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || parcelWeatherPoints.length < 3 || !Number.isFinite(parcelWeatherCentroid?.lat) || !Number.isFinite(parcelWeatherCentroid?.lng)) {
      setParcelWeather(null);
      setParcelWeatherLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchParcelWeather = async () => {
      setParcelWeatherLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/weather/parcel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ polygonPoints: parcelWeatherPoints }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Weather request failed");

        const data = await response.json();
        if (!controller.signal.aborted) {
          setParcelWeather(data);
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Weather fetch failed:", error);
          setParcelWeather(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setParcelWeatherLoading(false);
        }
      }
    };

    fetchParcelWeather();
    return () => controller.abort();
  }, [open, parcelWeatherCentroid, parcelWeatherPoints]);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setDiagMode(initialDiagMode);
      const storedZoneIndex = Number(persistedDashboardData?.activeZone);
      setActiveZone(
        Number.isInteger(storedZoneIndex) && storedZoneIndex >= 0
          ? Math.min(n - 1, storedZoneIndex)
          : 0
      );
      setAnalyzing(false);
      const storedResults = Array.isArray(persistedDashboardData?.zoneResults)
        ? persistedDashboardData.zoneResults.slice(0, n)
        : null;
      const hydratedZoneResults = storedResults?.length
        ? Array.from({ length: n }, (_, index) => storedResults[index] || null)
        : Array(n).fill(null);
      setZoneStates(
        storedResults?.length
          ? hydratedZoneResults.map((zone) => zone || freshSt(initialDiagMode))
          : Array.from({ length: n }, () => freshSt(initialDiagMode))
      );
      setZoneResults(hydratedZoneResults);
      setAnalysisHistory(
        Array.isArray(persistedDashboardData?.analysisHistory)
          ? persistedDashboardData.analysisHistory
          : []
      );
      setCurrentAnalysis(persistedDashboardData?.currentAnalysis || null);
      setShowDashboard(Boolean(startInDashboard && storedResults?.length));
      lastStoredFingerprintRef.current =
        persistedDashboardData?.currentAnalysis?.fingerprint || "";
    }
  }, [open, initialDiagMode, n, persistedDashboardData, startInDashboard]);

  // NEW: Fetch history from the DB when the parcel loads to enable the Dashboard
  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      // Only run if the modal is open, we have a parcel ID, and a token
      if (!open || !parcelle?.id) return;

      try {
        const token = localStorage.getItem("token");
        // Use the endpoint we created earlier!
        const response = await fetch(`${API_BASE}/api/analysis/parcel/${parcelle.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) throw new Error("Failed to load history");

        const data = await response.json();
        
        if (!cancelled) {
          const hasData = Object.keys(data).length > 0;
          
          if (hasData) {
            // 1. Get the most recent analysis for each zone to populate the UI
            const latestZoneResults = Array(n).fill(null);
            for (let i = 0; i < n; i++) {
                const zoneData = data[`zone_${i}`];
                if (zoneData && zoneData.length > 0) {
                    latestZoneResults[i] = zoneData[0].soilMetrics;
                }
            }
            
            // 2. Build the history list for the Dashboard.
            let historyList = [];
            
            if (data[`zone_${activeZone}`] && data[`zone_${activeZone}`].length > 0) {
                 const zoneHistory = data[`zone_${activeZone}`];
                 
                 // Create a helper function to translate a DB row into a Dashboard Snapshot
                 const translateDbToSnapshot = (dbRow) => {
                     const metrics = dbRow.soilMetrics;
                     return {
                         fingerprint: dbRow.id.toString(), // Ensure unique ID
                         timestamp: dbRow.analyzedAt,
                         // The dashboard expects 'avgPh', 'avgCe' etc. for the whole parcel,
                         // but since we are looking at a specific zone's history, we'll
                         // just map the zone's metrics to those 'avg' fields.
                         avgPh: metrics.ph,
                         avgCe: metrics.ce,
                         avgN: metrics.n,
                         avgP: metrics.p,
                         avgK: metrics.k,
                         // If you are using permanent depths, you'd map those here too:
                         depthAverages: metrics.permanentDepths ? {
                             depth0_20: metrics.permanentDepths.depth0_20,
                             depth20_40: metrics.permanentDepths.depth20_40,
                         } : null
                     };
                 };

                 // Push the current analysis (translated)
                 historyList.push(translateDbToSnapshot(zoneHistory[0]));
                 
                 // If there is a second analysis in the DB, push it as the 'previous' (translated)
                 if (zoneHistory.length > 1) {
                     historyList.push(translateDbToSnapshot(zoneHistory[1]));
                 }
            }

            console.log("Setting analysisHistory to:", historyList); 
            
            setAnalysisHistory(historyList); 
            setZoneResults(latestZoneResults);
            
            dispatchDashboardUpdated({
              parcelId: parcelle.id,
              cultureGroupId,
            });
          }
        }
      } catch (error) {
        console.warn("Could not fetch parcel history for dashboard:", error);
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [open, parcelle, cultureGroupId]);

  /* âœ… FIXED: Fetch satellite data in BOTH eco AND standard mode */
  useEffect(() => {
    const fetchSatelliteData = async () => {
      if (!open || (diagMode !== "eco" && diagMode !== "standard") || !parcelle?.latlngs?.length) return;

      // Only fetch if values are still defaults (avoids overwriting user edits)
      const currentSt = zoneStates[activeZone];
      if (
        currentSt.ce !== SAT_DEFAULTS.ce ||
        currentSt.temp !== SAT_DEFAULTS.temp ||
        currentSt.mo !== SAT_DEFAULTS.om
      ) return;

      // Normalize coordinates
      const safeCoords = parcelle.latlngs.map(pt => Array.isArray(pt) ? pt : [pt.lat, pt.lng]);

      // Cache strategy: store responses in localStorage with a TTL so we can render instantly
      const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours
      const parcelKey = (parcelle && parcelle.name) ? parcelle.name : (parcelleName || "parcelle");
      const coordsKey = JSON.stringify(safeCoords);
      const cacheKey = `sat:${parcelKey}:${coordsKey}`;

      try {
        // Check in-memory cache first
        const mem = satCacheRef.current.get(cacheKey);
        if (mem && mem.ts && (Date.now() - mem.ts) < CACHE_TTL && mem.data) {
          const data = mem.data;
          setZoneStates(prev => {
            const next = [...prev];
            const satelliteOmLevel = data.organicMatter?.level ?? next[activeZone].mo;
            next[activeZone] = {
              ...next[activeZone],
              ce: data.salinity?.ec_dS_m ?? next[activeZone].ce,
              temp: data.temperature?.celsius ?? next[activeZone].temp,
              tex: mapSoilTypeToTexture(data.texture?.label) ?? next[activeZone].tex,
              mo: satelliteOmLevel,
            };
            return next;
          });
        } else {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.ts && (Date.now() - parsed.ts) < CACHE_TTL && parsed?.data) {
                const data = parsed.data;
                // Apply cached data immediately
                setZoneStates(prev => {
                  const next = [...prev];
                  const satelliteOmLevel = data.organicMatter?.level ?? next[activeZone].mo;
                  next[activeZone] = {
                    ...next[activeZone],
                    ce: data.salinity?.ec_dS_m ?? next[activeZone].ce,
                    temp: data.temperature?.celsius ?? next[activeZone].temp,
                    tex: mapSoilTypeToTexture(data.texture?.label) ?? next[activeZone].tex,
                    mo: satelliteOmLevel,
                  };
                  return next;
                });
                // populate mem cache
                try { satCacheRef.current.set(cacheKey, { ts: parsed.ts, data: parsed.data }); } catch (e) { /* ignore */ }
              }
            } catch (err) {
              console.warn('sat cache parse failed', err);
            }
          }
        }

        const token = localStorage.getItem("token");
        const controller = new AbortController();
        const signal = controller.signal;

        const resp = await fetch(`${API_BASE}/api/satellite/soil-metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ polygonPoints: safeCoords }),
          signal,
        });

        if (!resp.ok) {
          // Don't throw for aborted
          if (resp.status === 0) return;
          console.warn('Satellite response not ok', resp.statusText);
          return;
        }

        const fresh = await resp.json();
        // store in cache (localStorage + in-memory)
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: fresh })); } catch (e) { /* ignore quota errors */ }
        try { satCacheRef.current.set(cacheKey, { ts: Date.now(), data: fresh }); } catch (e) { /* ignore */ }

        // apply fresh data
        setZoneStates(prev => {
          const next = [...prev];
          const satelliteOmLevel = fresh.organicMatter?.level ?? next[activeZone].mo;
          next[activeZone] = {
            ...next[activeZone],
            ce: fresh.salinity?.ec_dS_m ?? next[activeZone].ce,
            temp: fresh.temperature?.celsius ?? next[activeZone].temp,
            tex: mapSoilTypeToTexture(fresh.texture?.label) ?? next[activeZone].tex,
            mo: satelliteOmLevel,
          };
          return next;
        });

        // cleanup controller on success
        controller.abort();
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.warn("âš ï¸ Satellite fetch failed:", error);
      }
    };

    if (open) {
      const mounted = { v: true };
      fetchSatelliteData();
      return () => { mounted.v = false; };
    }
  }, [open, parcelle, diagMode, activeZone, zoneStates]);

  /* Mode toggle */
  const canToggleMode = zoneResults.every(r => !r);
  const handleModeChange = useCallback(newMode => {
    if (!canToggleMode) return;
    setDiagMode(newMode);
    setZoneStates(Array.from({length:n}, () => freshSt(newMode)));
    setShowDashboard(false);
  }, [n, canToggleMode]);

  /* Field change for active zone */
  const handleFieldChange = useCallback((id, v, depthKey = null) => {
    setZoneStates(prev => {
      const next = [...prev];
      const currentZone = next[activeZone];
      if (!currentZone) return prev;

      if (depthKey) {
        const depthState = currentZone.permanentDepths?.[depthKey] || buildDepthState(diagMode);
        const updatedDepths = {
          ...(currentZone.permanentDepths || {}),
          [depthKey]: { ...depthState, [id]: v },
        };
        next[activeZone] = {
          ...currentZone,
          ...(depthKey === "depth0_20" ? { [id]: v } : {}),
          permanentDepths: updatedDepths,
        };
        return next;
      }

      const updated = { ...currentZone, [id]: v };
      if (id === "date") {
        updated.seas = seasonFromDate(v);
      }
      next[activeZone] = updated;
      return next;
    });
  }, [activeZone, diagMode]);

  useEffect(() => {
    if (!open) return;
    const currentState = zoneStates[activeZone];
    if (!currentState) return;
    const selectedCrop = currentState.crop
      ? CROPS.find(c => String(c.id) === String(currentState.crop))
      : null;
    const criticalStartDays = selectedCrop?.windCriticalStartDays ?? 0;
    const targetMonth = monthFromDatePlusDays(currentState.date, criticalStartDays);
    if (!targetMonth) return;

    const expectedWind = Number(windByMonth[targetMonth]);
    if (!Number.isFinite(expectedWind)) return;

    setZoneStates(prev => {
      const next = [...prev];
      const zone = next[activeZone];
      if (!zone) return prev;
      if (Math.abs(Number(zone.wind) - expectedWind) < 0.01) return prev;
      next[activeZone] = { ...zone, wind: expectedWind };
      return next;
    });
  }, [open, activeZone, zoneStates, CROPS, windByMonth]);

  
  /* Analyze and Save to Database */
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    
    // 1. Get the snapshot of the current zone
    const snap = { ...zoneStates[activeZone] };
    const score = calcScore(snap, CROPS); // Calculate score immediately
    
    try {
      // 2. Send it to your new Python FastAPI endpoint
      const token = localStorage.getItem("token"); // Assuming you use JWT auth
      
      const payload = {
        parcelleId: parcelle?.id, 
        zoneIndex: activeZone,
        diagMode: diagMode,
        targetCropId: snap.crop || null,
        soilMetrics: snap, 
        compatibilityScore: score
      };

      // Only attempt to save to DB if we actually have a saved parcel ID
      if (parcelle?.id) {
        const response = await fetch(`${API_BASE}/api/analysis/save-zone`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error("Database save failed:", errData);
          // You could show a toast notification to the user here
        } else {
          console.log("Zone analysis securely saved to database!");
        }
      } else {
         console.warn("No parcel ID found. Saving locally only.");
      }

    } catch (error) {
      console.error("Network error while saving zone analysis:", error);
    } finally {
      // 3. Update the local React state so the UI continues to the results view
      setZoneResults(prev => {
        const next = [...prev];
        next[activeZone] = snap;
        return next;
      });
      setAnalyzing(false);
    }
  }, [activeZone, zoneStates, parcelle, diagMode, CROPS]);

  const resetZone = useCallback(idx => {
    setZoneResults(prev => { const next=[...prev]; next[idx]=null; return next; });
    setShowDashboard(false);
  }, []);

  const handlePrintLabRequest = useCallback(() => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    const html = buildLabRequestHtml({
      parcelleName,
      parcelleHa,
      cultureLabel,
      zoneNumber: activeZone + 1,
      totalZones: n,
      generatedAt: dateLabel,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const parcelSlug = (parcelleName || "parcelle")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "parcelle";
    a.href = url;
    a.download = `bordereau-analyse-sol-${parcelSlug}-zone-${activeZone + 1}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeZone, cultureLabel, n, parcelleHa, parcelleName]);

  const handlePrintLabRequestEco = useCallback(() => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    const html = buildLabRequestHtml({
      parcelleName,
      parcelleHa,
      cultureLabel,
      zoneNumber: activeZone + 1,
      totalZones: n,
      generatedAt: dateLabel,
      includeEcTexture: false, // economic variant: omit EC and texture
      includeOrganicMatter: false,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const parcelSlug = (parcelleName || "parcelle")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "parcelle";
    a.href = url;
    a.download = `bordereau-analyse-sol-${parcelSlug}-zone-${activeZone + 1}-eco.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeZone, cultureLabel, n, parcelleHa, parcelleName]);

  const handleDownloadZoneReport = useCallback(() => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    const zoneState = zoneResults[activeZone] || zoneStates[activeZone] || freshSt(diagMode);
    const parcelNameForReport = (parcelle && parcelle.name) ? parcelle.name : parcelleName;
    const html = buildZoneReportHtml({
      parcelleName: parcelNameForReport,
      parcelleHa,
      cultureLabel,
      zoneNumber: activeZone + 1,
      totalZones: n,
      generatedAt: dateLabel,
      diagMode,
      st: zoneState,
      crops: CROPS,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const parcelSlug = (parcelNameForReport || parcelleName || "parcelle")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "parcelle";
    a.href = url;
    a.download = `rapport-zone-${parcelSlug}-zone-${activeZone + 1}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [CROPS, activeZone, cultureLabel, diagMode, n, parcelleHa, parcelleName, zoneResults, zoneStates]);

  useEffect(() => {
    if (!open) return;
    
    // Only run this if ALL zones have been analyzed
    if (zoneResults.some((item) => !item)) return;
    
    const snapshot = buildAnalysisSnapshot({
      zoneResults,
      crops: CROPS,
      parcelleName: (parcelle && parcelle.name) || parcelleName,
      parcelleHa,
      cultureLabel,
    });
    
    if (!snapshot.fingerprint || lastStoredFingerprintRef.current === snapshot.fingerprint) return;

    setCurrentAnalysis(snapshot);
    
    try {
      localStorage.setItem(getCurrentAnalysisKey(parcelleName, parcelle, cultureGroupId), JSON.stringify(snapshot));
    } catch (error) {
      console.warn("Current analysis save failed:", error);
    }

    // Safely update analysisHistory, ensuring it stays an array
    setAnalysisHistory((prev) => {
      // Make sure prev is actually an array before filtering
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = [snapshot, ...safePrev.filter((item) => item.fingerprint !== snapshot.fingerprint)].slice(0, 8);
      
      try {
        localStorage.setItem(getHistoryKey(parcelleName, parcelle, cultureGroupId), JSON.stringify(next));
      } catch (error) {
        console.warn("History save failed:", error);
      }
      return next;
    });

    try {
      localStorage.setItem(
        getDashboardStateKey(parcelleName, parcelle, cultureGroupId),
        JSON.stringify({
          savedAt: new Date().toISOString(),
          activeZone,
          diagMode,
          parcelleName: (parcelle && parcelle.name) || parcelleName,
          parcelleHa,
          cultureGroupId,
          parcelle,
          mapSnapshot,
          zones,
          nZones: n,
          zoneResults,
          currentAnalysis: snapshot,
          // Use the safe array we just generated, or fallback to an empty array
          analysisHistory: Array.isArray(analysisHistory) ? [snapshot, ...analysisHistory.filter(i => i.fingerprint !== snapshot.fingerprint)].slice(0,8) : [snapshot],
          weatherData: weatherData || parcelWeather || null,
        })
      );
    } catch (error) {
      console.warn("Dashboard state save failed:", error);
    }
    
    lastStoredFingerprintRef.current = snapshot.fingerprint;
  }, [open, zoneResults, CROPS, parcelleName, parcelle, cultureGroupId, parcelleHa, cultureLabel, analysisHistory, activeZone, diagMode, mapSnapshot, zones, n, weatherData, parcelWeather]);
  
  const parcelImageUrls = buildParcelImageUrls(parcelle?.latlngs || [], mapSnapshot);

  if (!open) return null;

  const color  = ZONE_COLORS[activeZone % ZONE_COLORS.length];
  const light  = ZONE_LIGHTS[activeZone % ZONE_LIGHTS.length];
  const result = zoneResults[activeZone];
  const doneCount = zoneResults.filter(Boolean).length;
  const allZonesDone = doneCount === n && n > 0;

  console.log("zoneResults:", zoneResults);
  console.log("activeZone:", activeZone);
  console.log("current result:", zoneResults[activeZone]);

  return (
    <PortalOverlay zIndex={2500}>
      <div className="sd-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="sd-panel">

          {/* â”€â”€ TOPBAR â”€â”€ */}
          <div className="sd-topbar">
            <div className="sd-tb-logo">
              <div className="sd-tb-icon">
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L1 4.5l7 3.5 7-3.5L8 1zM1 10l7 3.5L15 10M1 7l7 3.5L15 7" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="sd-tb-name">Analyse<span>Soil</span></span>
            </div>

            <div className="sd-tb-chip">
              <div className="sd-tb-dot" />
              <span className="sd-tb-cname">{parcelleName}</span>
              <span className="sd-tb-csub">· {cultureLabel}</span>
            </div>

            {/* MODE TOGGLE */}
            <div className="sd-mode-toggle" title={!canToggleMode ? "Mode cannot be changed after analysis" : ""}>
              <button
                className={`sd-mode-toggle-btn ${diagMode==="eco" ? "sd-mode-toggle-btn--on" : ""}`}
                disabled={!canToggleMode}
                onClick={() => handleModeChange("eco")}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="4.5" cy="4.5" r="1.3" fill="currentColor" />
                </svg>
                Eco
              </button>
              <button
                className={`sd-mode-toggle-btn ${diagMode==="standard" ? "sd-mode-toggle-btn--on sd-mode-toggle-btn--std" : ""}`}
                disabled={!canToggleMode}
                onClick={() => handleModeChange("standard")}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1.5 4.5h6M4.5 1.5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Standard
              </button>
            </div>

            <div className="sd-tb-right">
              {doneCount > 0 && (
                <div className="sd-tb-progress">
                  {doneCount}/{n} zone{n>1?"s":""} ✓
                </div>
              )}
              <button className="sd-tb-close" onClick={onClose}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* ZONE TABS */}
          {n > 1 && (
            <div className="sd-zone-tabs">
              {Array.from({length: n}, (_,i) => {
                const zc = ZONE_COLORS[i % ZONE_COLORS.length];
                const zl = ZONE_LIGHTS[i % ZONE_LIGHTS.length];
                const done = !!zoneResults[i];
                const on   = activeZone === i;
                return (
                  <button key={i}
                    className={`sd-zone-tab ${on?"sd-zone-tab--on":""} ${done&&!on?"sd-zone-tab--done":""}`}
                    style={on ? {background:zc, color:"#fff", borderColor:zc, boxShadow:`0 3px 10px ${zc}40`} : done ? {borderColor:zc, color:zc, background:zl} : {}}
                    onClick={() => setActiveZone(i)}
                  >
                    {done && !on ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="sd-zone-tab-dot" style={on?{background:"rgba(255,255,255,.3)"}:{background:zc}} />
                    )}
                    Zone {i+1}
                    {done && !on && (
                      <span className="sd-zone-tab-score" style={{color:zc}}>{calcScore(zoneResults[i], CROPS)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* TWO-COLUMN LAYOUT */}
          {showDashboard && allZonesDone ? (
            <div className="sd-dashboard-sheet">
              <div className="sd-dashboard-sheet-head">
                <div>
                  <div className="sd-dashboard-eyebrow">Yield Heatmap Dashboard</div>
                  <div className="sd-card-title">Vue detaillee de la parcelle</div>
                </div>
                <button className="sd-dashboard-sheet-close" onClick={() => setShowDashboard(false)}>
                  Retour
                </button>
              </div>
              <div className="sd-dashboard-sheet-body">
                <DashboardView
                  parcelle={parcelle}
                  parcelleHa={parcelleHa}
                  parcelImageUrls={parcelImageUrls}
                  mapSnapshot={mapSnapshot}
                  zoneResults={zoneResults}
                  zones={zones}
                  crops={CROPS}
                  cultureLabel={cultureLabel}
                  activeZone={activeZone}
                  onSelectZone={setActiveZone}
                  currentAnalysis={currentAnalysis}
                  weather={parcelWeather}
                  weatherLoading={parcelWeatherLoading}
                  weatherData={weatherData}
                  analysisHistory={analysisHistory}
                />
              </div>
            </div>
          ) : (
            <div className="sd-layout">
              <ZoneForm
                key={`${activeZone}-${diagMode}`}
                zoneIdx={activeZone}
                nZones={n}
                color={color}
                light={light}
                diagMode={diagMode}
                st={zoneStates[activeZone]}
                onChange={handleFieldChange}
                crops={CROPS}
                cultureLabel={cultureLabel}
                onAnalyze={handleAnalyze}
                analyzing={analyzing}
                hasResult={!!result}
                onPrintLabRequest={handlePrintLabRequest}
                onPrintLabRequestEco={handlePrintLabRequestEco} />

              <div className="sd-rc">
                {!result ? (
                  <div className="sd-idle">
                    <div className="sd-idle-blob" style={{background:`linear-gradient(135deg,${light},#d0f4e8)`}}>
                      <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
                        <path d="M22 6L6 15l16 9 16-9L22 6zM6 29l16 9 16-9M6 22l16 9 16-9"
                          stroke={color} strokeWidth="2.2" strokeLinejoin="round" opacity=".6" />
                      </svg>
                    </div>
                    <div className="sd-idle-zone-pill" style={{background:color}}>Zone {activeZone + 1}</div>
                    <div className="sd-idle-t">Results here</div>
                    <div className="sd-idle-s">
                      {(diagMode==="eco" || diagMode==="standard")
                          ? "Mode active. EC and Texture are preloaded from satellite. Enter NPK and start analysis."
                        : "Enter soil parameters and start analysis to get recommendations."}
                    </div>
                  </div>
                ) : (
                  <ResultsView
                    st={result}
                    onReset={() => resetZone(activeZone)}
                    crops={CROPS}
                    diagMode={diagMode}
                    color={color}
                    zoneIdx={activeZone}
                    nZones={n}
                    onNext={() => setActiveZone(prev => Math.min(n - 1, prev + 1))}
                    onDownloadReport={handleDownloadZoneReport}
                    onOpenDashboard={() => setShowDashboard(true)}
                    showDashboardAction={allZonesDone && activeZone === n - 1}
                  />
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </PortalOverlay>
  );
}

/* Helper to map soil type to texture options */
function mapSoilTypeToTexture(soilType) {
  const map = {
    "Clay": "argileux",
    "Silty Clay": "limon-argileux",
    "Sandy Clay": "limon-argileux",
    "Clay Loam": "limon-argileux",
    "Loam": "limoneux",
    "Silt Loam": "limoneux",
    "Sandy Loam": "sablo-limoneux",
    "Sand": "sableux",
  };
  return map[soilType] || "limon-argileux";
}


