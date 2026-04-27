import { useState, useCallback, useMemo, useEffect } from "react";
import "./SoilDiagnostic.css";
import PortalOverlay from "./PortalOverlay";

/* ─── Satellite defaults ─────────────────────────────────────────────────── */
const SAT_DEFAULTS = { ce: 1.2, temp: 22, tex: "limon-argileux" };
const SAT_FIELDS   = {
  ce: "Landsat 8",
  temp: "MODIS (Terra/Aqua)",
  tex: "OpenLandMap / SoilGrids (Global Soil Map)",
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

// ✅ NEW: Severe contamination check (Pb > 800 OR Cd > 15 blocks ALL crops)
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

    <h2>3. Statut organo-calcique</h2>
    <ul class="checklist">
      <li>
        <span class="box" aria-hidden="true"></span>
        Matiere organique (%)
        <div class="method">Methode Anne ou Walkley-Black (oxydation au bichromate de potassium).</div>
      </li>
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

/* ─── Default state factory ──────────────────────────────────────────────── */
const freshSt = (mode = "eco") => ({
  date: toDateInputValue(),
  ph: 6.5,
  ce:   mode==="eco" || mode==="standard" ? SAT_DEFAULTS.ce   : 1.2,
  temp: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.temp : 18,
  n: 45, p: 22, k: 180,
  lime: 8,
  wind: 12,
  pb: 10,
  cd: 5,
  tex: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.tex : "limon-argileux",
  mo: "moyen",
  seas: seasonFromDate(toDateInputValue()),
  crop: "",
});

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

/* ZONE FORM */
function ZoneForm({ zoneIdx, color, light, diagMode, st, onChange, crops, cultureLabel, onAnalyze, analyzing, hasResult, onPrintLabRequest }) {
  // ✅ LOCK fields ONLY in Eco mode. Standard mode stays fully editable.
  const isSat = id => diagMode === "eco" && id in SAT_FIELDS;
  const seasonLabel = getSeasonLabel(st.seas);
  const seasonEmoji = SEASON_EMOJIS[st.seas] || "📅";

  return (
    <div className="sd-fc">
      <div className="sd-zone-strip" style={{background: light, borderLeft: `4px solid ${color}`}}>
        <div className="sd-zone-strip-dot" style={{background: color}} />
        <span className="sd-zone-strip-name" style={{color}}>Zone {zoneIdx + 1}</span>
        <span className="sd-zone-strip-hint">Enter the soil properties for this zone</span>
      </div>

      {/* Satellite notice (Eco mode only) */}
      {diagMode === "eco" && (
        <div className="sd-sat-notice">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5" cy="5" r="1.5" fill="currentColor" />
          </svg>
          CE: Landsat 8 · Texture: OpenLandMap / SoilGrids (Global Soil Map)
        </div>
      )}

      {/* Print Lab Request (Standard mode only) */}
      {diagMode === "standard" && (
        <button className="sd-lab-request-btn" onClick={onPrintLabRequest}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M3 2h7v9H3z" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M4.5 4.3h4M4.5 6.3h4M4.5 8.3h2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          📄 Print Lab Request
        </button>
      )}

      {/* 1 - Chemistry */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>1</span>Soil Chemistry</div>
        <Slider id="ph"   label="Soil pH"          unit="pH"   min={4}  max={9}  step={0.1} value={st.ph}   onChange={onChange} zones badge l="4.0 Acidic"  m="6.5 Neutral"      r="9.0 Alkaline" />
        <Slider id="ce"   label="Salinity (EC)"    unit="dS/m" min={0}  max={6}  step={0.1} value={st.ce}   onChange={onChange} zones badge l="0 None"      m="2.0 Limit"        r="6.0 Critical"   locked={isSat("ce")}   src={SAT_FIELDS.ce} />
      </div>

      {/* 2 - NPK */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>2</span>NPK Fertility</div>
        <Slider id="n" label="Nitrogen (N)"   unit="kg/ha" min={0}  max={400} step={1} value={st.n} onChange={onChange} zones l="Low"    m="30–60 Optimal" r="400" />
        <Slider id="p" label="Phosphorus (P)" unit="kg/ha" min={0}  max={400} step={1} value={st.p} onChange={onChange} zones l="0"      m="15–30 Optimal" r="400" />
        <Slider id="k" label="Potassium (K)"  unit="kg/ha" min={0}  max={400} step={5} value={st.k} onChange={onChange} zones l="0"      m="130–250 Opt."  r="400" />
        <Slider id="lime" label="Active Lime" unit="%" min={0} max={30} step={1} value={st.lime} onChange={onChange} zones l="0 Low" m="8–12 Preferred" r="30 High" />
      </div>

      {/* 3 - Physical */}
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
                {val:"limoneux",      label:"Loam",      sub:"Very fertile"},
                {val:"sablo-limoneux",label:"Sandy loam",sub:"Balanced drainage"},
                {val:"sableux",       label:"Sandy",     sub:"Fast drainage"},
                {val:"argileux",      label:"Clay",      sub:"High retention"},
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
            <div className="sd-col-lbl">Organic Matter</div>
            <div className="sd-opts">
              {[
                {val:"tres-bas",label:"Very low <1%"},
                {val:"bas",     label:"Low 1–2%"},
                {val:"moyen",   label:"Medium 2–4%"},
                {val:"bon",     label:"Good 4–6%"},
                {val:"excellent",label:"Excellent >6%"},
              ].map(o => (
                <div key={o.val}
                  className={`sd-opt ${st.mo===o.val?"sd-opt--on":""}`}
                  onClick={() => onChange("mo", o.val)}>
                  <div className="sd-opt-r"><div className="sd-opt-dot" /></div>
                  <div><div className="sd-opt-lbl">{o.label}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 - Environment */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>4</span>Environmental Risks</div>
        <Slider id="pb" label="Lead (Pb)" unit="mg/kg" min={0} max={100} step={1} value={st.pb} onChange={onChange} zones l="0 Clean" m="25 Alert" r="100 Critical" />
        <Slider id="cd" label="Cadmium (Cd)" unit="mg/kg" min={0} max={100} step={1} value={st.cd} onChange={onChange} zones l="0 Clean" m="25 Alert" r="100 Critical" />
      </div>

      {/* 5 - Season */}
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
            <span className="sd-season-card-hint">Used in the analysis result and recommendations.</span>
          </div>
        </div>
      </div>

      {/* 6 - Crop */}
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
            <option value="">🔀 Recommend for me</option>
            {crops.map(c => <option key={c.id} value={c.id}>{c.e} {c.n} / {c.ar}</option>)}
          </select>
          <svg className="sd-sel-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 4.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Submit */}
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

/* RESULTS VIEW - ✅ FIXED WITH CONTAMINATION WARNING */
function ResultsView({ st, onReset, crops, diagMode, color ,zoneIdx,nZones,onNext,onDownloadReport }) {
  // ✅ NEW: Check for severe contamination (Pb>800 OR Cd>15)
  const contamination = isSoilToxic(st);

  const sc = calcScore(st, crops), scC = mc(sc), scBg = mcBg(sc);
  const scLbl = sc>=80 ? "Excellent 🎉" : sc>=60 ? "Needs improvement" : "Difficult";

  // ✅ NEW: Soil type compatibility filter (same or tolerated swap only)
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
      {/* ✅ SEVERE CONTAMINATION WARNING - Shows when Pb>800 OR Cd>15 */}
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

      {/* ✅ Only show crop recommendations if soil is NOT toxic */}
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

      {/* ✅ Action buttons ALWAYS show (even when soil is toxic) */}
      <div className="sd-act-row sd-a5">
        <button className="sd-act sd-act-s" onClick={onReset}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5a4.5 4.5 0 118 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10.2 9.5l.6 2.2 2-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit
        </button>
        <button className="sd-act sd-act-p" onClick={onDownloadReport}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v8M3 7l3.5 3.5L10 7M1 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download Report
        </button>
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

/* MAIN COMPONENT */
export default function SoilDiagnostic({
  open, onClose,
  parcelleName   = "Parcel A",
  parcelleHa     = 0,
  cultureGroupId = 1,
  parcelle       = null,
  nZones         = 1,
  initialDiagMode = "eco",
}) {
  const [diagMode,    setDiagMode]    = useState(initialDiagMode);
  const [activeZone,  setActiveZone]  = useState(0);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [rawCrops,    setRawCrops]    = useState([]);
  const [windByMonth, setWindByMonth] = useState({});
  const [zoneStates,  setZoneStates]  = useState(() => Array.from({length: Math.max(1,nZones)}, () => freshSt(initialDiagMode)));
  const [zoneResults, setZoneResults] = useState(() => Array(Math.max(1,nZones)).fill(null));
  const n = Math.max(1, nZones);

  const CROPS = useMemo(() => rawCrops.map(toCrop), [rawCrops]);
  const cultureLabel = cultureGroupId===1?"Vegetables":cultureGroupId===2?"Cereals":"Permanent";

  useEffect(() => {
    let cancelled = false;

    const fetchCrops = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/crops/requirements?groupId=${cultureGroupId}`);
        if (!response.ok) throw new Error("Failed to load crop requirements");
        const data = await response.json();
        if (!cancelled) setRawCrops(Array.isArray(data) ? data : []);
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
        console.warn("⚠️ Wind expectations fetch failed:", error);
        if (!cancelled) setWindByMonth({});
      }
    };

    fetchWindExpectations();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setDiagMode(initialDiagMode);
      setActiveZone(0);
      setAnalyzing(false);
      setZoneStates(Array.from({length:n}, () => freshSt(initialDiagMode)));
      setZoneResults(Array(n).fill(null));
    }
  }, [open]);

  /* ✅ FIXED: Fetch satellite data in BOTH eco AND standard mode */
  useEffect(() => {
    const fetchSatelliteData = async () => {
      // ✅ FIX: Removed `!parcelle?.id` check.
      // New parcels don't have an ID yet, but the satellite API only needs coordinates.
      if (!open || (diagMode !== "eco" && diagMode !== "standard") || !parcelle?.latlngs?.length) return;

      // Only fetch if values are still defaults (avoids overwriting user edits)
      const currentSt = zoneStates[activeZone];
      if (currentSt.ce !== SAT_DEFAULTS.ce || currentSt.temp !== SAT_DEFAULTS.temp) return;

      const token = localStorage.getItem("token");

      try {
        // ✅ FIX: Normalize coordinates to prevent 422 errors.
        // Backend expects [[lat, lng], ...]. New parcels often have [{lat, lng}, ...].
        const safeCoords = parcelle.latlngs.map(pt => {
          if (Array.isArray(pt)) return pt; // Already [lat, lng]
          return [pt.lat, pt.lng];          // Convert {lat, lng} to [lat, lng]
        });

        const response = await fetch(
          `${API_BASE}/api/satellite/soil-metrics`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              polygonPoints: safeCoords
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("🛰️ Satellite data fetched:", data);

          setZoneStates(prev => {
            const next = [...prev];
            next[activeZone] = {
              ...next[activeZone],
              ce: data.salinity?.ec_dS_m ?? next[activeZone].ce,
              temp: data.temperature?.celsius ?? next[activeZone].temp,
              tex: mapSoilTypeToTexture(data.texture?.label) ?? next[activeZone].tex,
            };
            return next;
          });
        }
      } catch (error) {
        console.warn("⚠️ Satellite fetch failed:", error);
      }
    };

    if (open) {
      fetchSatelliteData();
    }
  }, [open, parcelle, diagMode, activeZone, zoneStates]);

  /* Mode toggle */
  const canToggleMode = zoneResults.every(r => !r);
  const handleModeChange = useCallback(newMode => {
    if (!canToggleMode) return;
    setDiagMode(newMode);
    setZoneStates(Array.from({length:n}, () => freshSt(newMode)));
  }, [n, canToggleMode]);

  /* Field change for active zone */
  const handleFieldChange = useCallback((id, v) => {
    setZoneStates(prev => {
      const next = [...prev];
      const updated = { ...next[activeZone], [id]: v };
      if (id === "date") {
        updated.seas = seasonFromDate(v);
      }
      next[activeZone] = updated;
      return next;
    });
  }, [activeZone]);

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

  /* Analyze */
  const handleAnalyze = useCallback(() => {
    setAnalyzing(true);
    setTimeout(() => {
      const snap = {...zoneStates[activeZone]};
      setZoneResults(prev => {
        const next = [...prev];
        next[activeZone] = snap;
        return next;
      });
      setAnalyzing(false);
    }, 800);
  }, [activeZone, zoneStates]);

  const resetZone = useCallback(idx => {
    setZoneResults(prev => { const next=[...prev]; next[idx]=null; return next; });
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

  if (!open) return null;

  const color  = ZONE_COLORS[activeZone % ZONE_COLORS.length];
  const light  = ZONE_LIGHTS[activeZone % ZONE_LIGHTS.length];
  const result = zoneResults[activeZone];
  const doneCount = zoneResults.filter(Boolean).length;

  console.log("zoneResults:", zoneResults);
  console.log("activeZone:", activeZone);
  console.log("current result:", zoneResults[activeZone]);

  return (
    <PortalOverlay zIndex={2500}>
      <div className="sd-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="sd-panel">

          {/* ── TOPBAR ── */}
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
            />

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
                  onDownloadReport={handlePrintLabRequest}
                />
              )}
            </div>
          </div>

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