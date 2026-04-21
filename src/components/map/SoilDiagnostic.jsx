import { useState, useCallback, useMemo, useEffect } from "react";
import "./SoilDiagnostic.css";
import PortalOverlay from "./PortalOverlay";
import { getCropsByGroup } from "../../data/cropData";

/* ─── Satellite defaults ─────────────────────────────────────────────────── */
const SAT_DEFAULTS = { ce: 1.2, temp: 22, tex: "limon-argileux" };
const SAT_FIELDS   = { ce: "Sentinel-2", temp: "MODIS", tex: "AlphaEarth" };
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

const CROP_LIMITS = {
  tomate: { omMin: 2, activeLimeMax: 10 },
  pomme_terre: { omMin: 2, activeLimeMax: 5 },
  oignon: { omMin: 2, activeLimeMax: 10 },
  ail: { omMin: 2, activeLimeMax: 10 },
  poivron: { omMin: 2, activeLimeMax: 10 },
  piment: { omMin: 2, activeLimeMax: 10 },
  courgette: { omMin: 2, activeLimeMax: 10 },
  aubergine: { omMin: 2, activeLimeMax: 10 },
  concombre: { omMin: 2, activeLimeMax: 10 },
  carotte: { omMin: 2, activeLimeMax: 8 },
  navet: { omMin: 2, activeLimeMax: 10 },
  betterave: { omMin: 2, activeLimeMax: 12 },
  chou_fleur: { omMin: 2, activeLimeMax: 10 },
  laitue: { omMin: 2, activeLimeMax: 10 },
  haricot_vert: { omMin: 2, activeLimeMax: 10 },
  petits_pois: { omMin: 2, activeLimeMax: 10 },
  feve: { omMin: 2, activeLimeMax: 12 },
  artichaut: { omMin: 2, activeLimeMax: 15 },
  pasteque: { omMin: 2, activeLimeMax: 8 },
  melon: { omMin: 2, activeLimeMax: 10 },

  ble_dur: { omMin: 1.5, activeLimeMax: 15 },
  ble_tendre: { omMin: 1.5, activeLimeMax: 15 },
  orge: { omMin: 1, activeLimeMax: 15 },
  avoine: { omMin: 1.5, activeLimeMax: 10 },
  mais: { omMin: 2, activeLimeMax: 10 },
  sorgho: { omMin: 1, activeLimeMax: 15 },
  triticale: { omMin: 1.5, activeLimeMax: 15 },
  seigle: { omMin: 1, activeLimeMax: 10 },
  millet: { omMin: 1, activeLimeMax: 15 },
  quinoa: { omMin: 1, activeLimeMax: 15 },
  riz: { omMin: 2, activeLimeMax: 5 },
  lentille: { omMin: 1.5, activeLimeMax: 10 },
  pois_chiche: { omMin: 1.5, activeLimeMax: 12 },
  feve_cereale: { omMin: 1.5, activeLimeMax: 10 },
  vesce: { omMin: 1.5, activeLimeMax: 10 },
  luzerne: { omMin: 1.5, activeLimeMax: 15 },
  trefle: { omMin: 1.5, activeLimeMax: 12 },
  mais_fourrage: { omMin: 2, activeLimeMax: 10 },
  pois_fourrage: { omMin: 1.5, activeLimeMax: 10 },
  fenugrec: { omMin: 1.5, activeLimeMax: 12 },

  olivier: { omMin: 1, activeLimeMax: 20 },
  palmier: { omMin: 1, activeLimeMax: 15 },
  oranger: { omMin: 1.5, activeLimeMax: 7 },
  mandarinier: { omMin: 1.5, activeLimeMax: 7 },
  citronnier: { omMin: 1.5, activeLimeMax: 7 },
  vigne: { omMin: 1.5, activeLimeMax: 20 },
  figuier: { omMin: 1, activeLimeMax: 15 },
  amandier: { omMin: 1, activeLimeMax: 20 },
  abricotier: { omMin: 1.5, activeLimeMax: 10 },
  pommier: { omMin: 1.5, activeLimeMax: 8 },
  poirier: { omMin: 1.5, activeLimeMax: 7 },
  grenadier: { omMin: 1.5, activeLimeMax: 15 },
  cerisier: { omMin: 1.5, activeLimeMax: 10 },
  pecher: { omMin: 1.5, activeLimeMax: 7 },
  prunier: { omMin: 1.5, activeLimeMax: 10 },
  nectarinier: { omMin: 1.5, activeLimeMax: 7 },
  cognassier: { omMin: 1.5, activeLimeMax: 10 },
  neflier: { omMin: 1.5, activeLimeMax: 10 },
  pistachier: { omMin: 1, activeLimeMax: 15 },
  noyer: { omMin: 2, activeLimeMax: 10 },
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

function inferSeasons(c) {
  if (c.tempMin >= 18) return ["ete"];
  if (c.tempMin >= 15) return ["printemps","ete"];
  if (c.tempMin >= 10) return ["printemps","ete","automne"];
  if (c.tempMin <= 5 && c.tempMax <= 25) return ["hiver","printemps","automne"];
  return ["printemps","ete","automne"];
}

function toCrop(c) {
  const limits = CROP_LIMITS[c.id] || { omMin: c.omMin ?? 1.5, activeLimeMax: c.activeLimeMax ?? 15 };
  const prefTex = SOIL_TEXTURE_TO_KEY[c.soilType] || "limon-argileux";
  return {
    id: c.id, n: c.nameEn, ar: c.nameAr || c.name, e: c.emoji,
    bg: EMOJI_BG[c.emoji] || "#f0f0f0",
    lat: c.nameEn, ph: c.ph, ce: c.ec,
    tMn: c.tempMin, tMx: c.tempMax, nHi: c.nReq > 100,
    limeMx: limits.activeLimeMax,
    omMin: limits.omMin,
    soilType: c.soilType,
    prefTex,
    ss: inferSeasons(c),
    note: `Soil ${c.soilType}. N: ${c.nReq} · P: ${c.pReq} · K: ${c.kReq} mg/kg · OM >= ${limits.omMin}% · Active lime <= ${limits.activeLimeMax}%`,
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
  poll: [{c:"#a5d6a7",f:45},{c:"#ffcc80",f:20},{c:"#ff8a80",f:35}],
};

const mc   = m => m>=80 ? "#1a7a50" : m>=60 ? "#b06010" : "#c02020";
const mcBg = m => m>=80 ? "#c8f5e0" : m>=60 ? "#fff3c8" : "#ffc8c8";

const PARAMS = [
  {id:"ph",  name:"pH",         u:"",     mn:4, mx:9  },
  {id:"ce",  name:"CE",         u:"dS/m", mn:0, mx:6  },
  {id:"n",   name:"Azote N",    u:"mg/kg",mn:0, mx:100},
  {id:"p",   name:"Phosphore P",u:"mg/kg",mn:0, mx:50 },
  {id:"k",   name:"Potassium K",u:"mg/kg",mn:0, mx:400},
  {id:"temp",name:"Temp. sol",  u:"°C",   mn:0, mx:40 },
  {id:"lime",name:"Active Lime",u:"%",    mn:0, mx:30 },
  {id:"wind",name:"Wind",       u:"km/h", mn:0, mx:80 },
  {id:"poll",name:"Pollution",  u:"idx",  mn:0, mx:100},
];

const SN = {
  ete:"☀️ Algerian summer: verify irrigation. Intense heat is possible.",
  hiver:"❄️ Winter: frost risk in high plateaus. Mulching is recommended.",
  printemps:"🌱 Spring: excellent window for summer crops.",
  automne:"🍂 Autumn: favorable for Mediterranean crops.",
};

function calcScore(st) {
  let s = 100;
  const { ph, ce, temp, n, p, k, mo, lime, wind, poll } = st;
  if (ph<5.5||ph>8) s-=18; else if (ph<6||ph>7.5) s-=7;
  if (ce>4) s-=22; else if (ce>2) s-=11;
  if (temp<8||temp>36) s-=12; else if (temp<14||temp>30) s-=5;
  if (n<20||n>80) s-=10; else if (n<30||n>65) s-=4;
  if (p<10||p>45) s-=8; else if (p<15||p>35) s-=3;
  if (k<80||k>350) s-=8; else if (k<130||k>280) s-=3;
  if (lime>20) s-=10; else if (lime>12) s-=4;
  if (wind>45) s-=10; else if (wind>30) s-=4;
  if (poll>70) s-=18; else if (poll>45) s-=10; else if (poll>25) s-=4;
  if (mo==="tres-bas") s-=12; else if (mo==="bas") s-=5; else if (mo==="excellent") s+=5;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function pSt(id, v) {
  const R = { ph:[6,7.5], ce:[0,2], n:[30,65], p:[15,35], k:[130,280], temp:[14,30], lime:[0,12], wind:[0,30], poll:[0,25] };
  const [lo,hi] = R[id] || [0,100];
  if (v>=lo && v<=hi) return "ok";
  if (id==="ce") return "hi";
  return v<lo ? "lo" : "hi";
}

function cropScore(c, st) {
  let m = 100;
  const { ph, ce, temp, n, seas, lime, wind, poll, mo } = st;
  if (ph<c.ph[0]||ph>c.ph[1]) m -= ph<c.ph[0]-1||ph>c.ph[1]+1 ? 24 : 12;
  if (ce>c.ce) m -= ce>c.ce+1.5 ? 20 : 10;
  if (temp<c.tMn) m -= temp<c.tMn-6 ? 20 : 10;
  if (temp>c.tMx) m -= temp>c.tMx+6 ? 15 : 7;
  if (!c.ss.includes(seas)) m -= 16;
  if (c.nHi && n<25) m -= 10;
  if (mo==="tres-bas" && c.nHi) m -= 8;
  if (lime>c.limeMx) m -= lime>c.limeMx+5 ? 16 : 8;
  if (poll>45) m -= poll>70 ? 22 : 10;
  if (wind>45) m -= 8;
  if (c.omMin > 2 && (mo === "tres-bas" || mo === "bas")) m -= 6;
  if (st.tex !== c.prefTex) m -= 8;
  return Math.max(0, Math.round(m));
}

function cropAdj(c, st) {
  const adj = [];
  const { ph, ce, temp, seas, lime, wind, poll, mo } = st;
  if (ph<c.ph[0]) adj.push({t:`Correct acidity - lime application (target pH ${c.ph[0]}-${c.ph[1]})`,bg:"#fff3c0"});
  if (ph>c.ph[1]) adj.push({t:"Reduce alkalinity - agricultural sulfur",bg:"#fff3c0"});
  if (ce>c.ce)    adj.push({t:"High salinity - leach soil before planting",bg:"#ffc0c0"});
  if (temp<c.tMn) adj.push({t:`Soil too cold - wait for >= ${c.tMn}°C`,bg:"#c0d8ff"});
  if (lime>c.limeMx) adj.push({t:`Active lime too high - use tolerant crops or acidifying strategy (target <= ${c.limeMx}%)`,bg:"#fff3c0"});
  if (wind>35) adj.push({t:"Strong wind risk - add windbreaks and adjust irrigation scheduling",bg:"#ffe8c0"});
  if (poll>35) adj.push({t:"Soil pollution risk - run heavy metal and residue lab panel before planting",bg:"#ffc0c0"});
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
  ph: 6.5,
  ce:   mode==="eco" || mode==="standard" ? SAT_DEFAULTS.ce   : 1.2,
  temp: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.temp : 18,
  n: 45, p: 22, k: 180,
  lime: 8,
  wind: 12,
  poll: 10,
  tex: mode==="eco" || mode==="standard" ? SAT_DEFAULTS.tex : "limon-argileux",
  mo: "moyen", seas: "ete", crop: "",
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
          EC · Texture imported from satellite - not editable
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
        <Slider id="ce"   label="Salinity (EC)"    unit="dS/m" min={0}  max={6}  step={0.1} value={st.ce}   onChange={onChange} zones badge l="0 None"      m="2.0 Limit"        r="6.0 Critical"   locked={isSat("ce")}   src="Sentinel-2" />
      </div>

      {/* 2 - NPK */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>2</span>NPK Fertility</div>
        <Slider id="n" label="Nitrogen (N)"   unit="mg/kg" min={0}  max={100} step={1} value={st.n} onChange={onChange} zones l="Low"    m="30–60 Optimal" r="High" />
        <Slider id="p" label="Phosphorus (P)" unit="mg/kg" min={0}  max={50}  step={1} value={st.p} onChange={onChange} zones l="0"      m="15–30 Optimal" r="50" />
        <Slider id="k" label="Potassium (K)"  unit="mg/kg" min={0}  max={400} step={5} value={st.k} onChange={onChange} zones l="0"      m="130–250 Opt."  r="400" />
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
                  AlphaEarth
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
        <Slider id="poll" label="Soil Pollution Index" unit="idx" min={0} max={100} step={1} value={st.poll} onChange={onChange} zones l="0 Clean" m="25 Alert" r="100 Critical" />
      </div>

      {/* 5 - Season */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>5</span>Growing Season</div>
        <div className="sd-seas-row">
          {[
            {val:"printemps",em:"🌱",label:"Spring"},
            {val:"ete",      em:"☀️",label:"Summer"},
            {val:"automne",  em:"🍂",label:"Autumn"},
            {val:"hiver",    em:"❄️",label:"Winter"},
          ].map(s => (
            <div key={s.val}
              className={`sd-seas ${st.seas===s.val?"sd-seas--on":""}`}
              style={st.seas===s.val ? {borderColor:color, background:`${color}12`, boxShadow:`0 4px 0 ${color}30`} : {}}
              onClick={() => onChange("seas", s.val)}>
              <span className="sd-seas-em">{s.em}</span>
              <span className="sd-seas-lbl" style={st.seas===s.val?{color}:{}}>{s.label}</span>
            </div>
          ))}
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

/* RESULTS VIEW */
function ResultsView({ st, onReset, crops, diagMode, color ,zoneIdx,nZones,onNext }) {
  const sc = calcScore(st), scC = mc(sc), scBg = mcBg(sc);
  const scLbl = sc>=80 ? "Excellent 🎉" : sc>=60 ? "Needs improvement" : "Difficult";
  const scored = crops.map(c => ({...c, sc: cropScore(c,st), adj: cropAdj(c,st)})).sort((a,b)=>b.sc-a.sc);
  const tgt  = st.crop ? scored.find(c => c.id===st.crop) : null;
  const recs = tgt ? null : scored.slice(0,4);
  const alts = tgt ? scored.filter(c => c.id!==st.crop).slice(0,2) : [];
  const sn   = SN[st.seas], iw = st.seas==="hiver";

  return (
    <div className="sd-results">
      {/* Score card */}
      <div className="sd-score-hero sd-a1" style={{borderTop:`3px solid ${color}`}}>
        <div className="sd-score-hero-top">
          <div>
            <div className="sd-score-eyebrow">Soil Report</div>
            <div className="sd-score-title">
              Your soil is<br />
              <em style={{color:scC}}>{sc>=80?"ready to cultivate":sc>=60?"to optimize":"to improve"}</em>
            </div>
          </div>
          <div className="sd-score-right">
            <div className="sd-score-number" style={{color:scC}}>{sc}</div>
            <div className="sd-score-sub">Quality Score</div>
            <div className="sd-score-pill" style={{background:scBg,color:scC}}>{scLbl}</div>
          </div>
        </div>
        <div className="sd-score-desc">
          {sc>=80?"Conditions are favorable. You can start your season now.":"Adjustments are recommended to optimize yields."}
        </div>
        <div className="sd-score-meta">
          <span className="sd-score-meta-chip">Season: {st.seas}</span>
          <span className="sd-score-meta-chip">Texture: {st.tex}</span>
          <span className="sd-score-meta-chip">Temp: {st.temp}°C</span>
          <span className="sd-score-meta-chip">Wind: {st.wind} km/h</span>
          <span className="sd-score-meta-chip">Pollution: {st.poll}</span>
          <span className="sd-score-meta-chip">
            {diagMode==="eco" || diagMode==="standard" ? "Satellite-assisted" : "Manual inputs"}
          </span>
        </div>
        {(diagMode==="eco" || diagMode==="standard") && (
          <div className="sd-eco-tag">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.1" />
              <circle cx="4.5" cy="4.5" r="1.2" fill="currentColor" />
            </svg>
            Satellite data included
          </div>
        )}
      </div>

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
        {[PARAMS.slice(0,3), PARAMS.slice(3,6), PARAMS.slice(6)].map((row,ri) => (
          <div key={ri} className="sd-param-pill-row">
            {row.map(p => {
              const v = st[p.id], sta = pSt(p.id,v);
              const pct = (((v-p.mn)/(p.mx-p.mn))*100).toFixed(1);
              const [bg2,c2] = {ok:["#c8f5e0","#1a7a50"],lo:["#fff3c8","#b06010"],hi:["#ffc8c8","#c02020"]}[sta];
              const pill = {ok:"✓ OK",lo:"↓ Low",hi:"↑ High"}[sta];
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
            <span className="sd-sec-head-m">{st.seas} · top 4</span>
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
                    <div className="sd-rec-pct" style={{color:mc(c.sc)}}>{c.sc}%</div>
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
                      const sv = pSt(bid,st[bid]);
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
                    <div className="sd-verd-pct" style={{color:mc(tgt.sc)}}>{tgt.sc}%</div>
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
                          <div className="sd-rec-pct" style={{color:mc(c.sc)}}>{c.sc}%</div>
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

      <div className="sd-act-row sd-a5">
        <button className="sd-act sd-act-s" onClick={onReset}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5a4.5 4.5 0 118 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10.2 9.5l.6 2.2 2-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Edit
        </button>
        {nZones > 1 && zoneIdx < nZones - 1 ? (
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
        ) : (
          <button className="sd-act sd-act-p">
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v8M3 7l3.5 3.5L10 7M1 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download Report
          </button>
        )}
      </div>
    </div>
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
  const [zoneStates,  setZoneStates]  = useState(() => Array.from({length: Math.max(1,nZones)}, () => freshSt(initialDiagMode)));
  const [zoneResults, setZoneResults] = useState(() => Array(Math.max(1,nZones)).fill(null));
  const n = Math.max(1, nZones);

  const CROPS = useMemo(() => getCropsByGroup(cultureGroupId).map(toCrop), [cultureGroupId]);
  const cultureLabel = cultureGroupId===1?"Vegetables":cultureGroupId===2?"Cereals":"Permanent";

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
      next[activeZone] = {...next[activeZone], [id]: v};
      return next;
    });
  }, [activeZone]);

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
                      <span className="sd-zone-tab-score" style={{color:zc}}>{calcScore(zoneResults[i])}</span>
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
