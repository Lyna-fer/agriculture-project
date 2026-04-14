
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import "./SoilDiagnostic.css";
import PortalOverlay from "./PortalOverlay";
import { getCropsByGroup } from "../../data/cropData";

/* ─── Satellite defaults ─────────────────────────────────────────────────── */
const SAT_DEFAULTS = { ce: 1.2, temp: 22, tex: "limon-argileux" };
const SAT_FIELDS   = { ce: "Sentinel-2", temp: "MODIS", tex: "AlphaEarth" };

/* ─── Zone colour palette ────────────────────────────────────────────────── */
const ZONE_COLORS = ["#7F77DD","#1D9E75","#E07850","#C05090","#3090C0","#8060A0","#C0A020"];
const ZONE_LIGHTS = ["#EEEDFE","#E1F5EE","#FEF0E8","#FCE8F4","#E8F4FC","#F0E8FC","#FEF8E0"];

/* ─── Crop helpers ───────────────────────────────────────────────────────── */
const EMOJI_BG = {
  "🍅":"#ffd8d0","🥔":"#f5e6cc","🧅":"#f0e0c0","🧄":"#f0e8c0","🫑":"#d0f0d0",
  "🌶️":"#ffd0c0","🥒":"#d0f0e0","🍆":"#e0c8f8","🥕":"#ffe0c0","🥦":"#d0ecd0",
  "🥬":"#c8f0d0","🫘":"#f0e8d0","🍉":"#ffd0d8","🌾":"#f5f0d8","🌽":"#fff0c8",
  "🫒":"#d8ecd0","🌴":"#d0e8c0","🍊":"#ffe0c0","🍋":"#fff8c8","🍇":"#e0d0f8",
  "🍑":"#ffdcc8","🍎":"#ffd0d0","🍒":"#ffc8cc","🍐":"#e0f0d0",
};
function inferSeasons(c) {
  if (c.tempMin >= 18) return ["ete"];
  if (c.tempMin >= 15) return ["printemps","ete"];
  if (c.tempMin >= 10) return ["printemps","ete","automne"];
  if (c.tempMin <= 5 && c.tempMax <= 25) return ["hiver","printemps","automne"];
  return ["printemps","ete","automne"];
}
function toCrop(c) {
  return {
    id: c.id, n: c.name, e: c.emoji,
    bg: EMOJI_BG[c.emoji] || "#f0f0f0",
    lat: c.nameEn, ph: c.ph, ce: c.ec,
    tMn: c.tempMin, tMx: c.tempMax, nHi: c.nReq > 100,
    ss: inferSeasons(c),
    note: `Sol ${c.soilType}. N: ${c.nReq} · P: ${c.pReq} · K: ${c.kReq} mg/kg`,
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
};
const BS = {
  ph:   v => v<5.5||v>8 ? ["Hors plage","r"] : v<6||v>7.5 ? ["Limite","a"] : ["Optimal","g"],
  ce:   v => v>4         ? ["Critique","r"]   : v>2         ? ["Limite","a"] : ["Normal","g"],
  temp: v => v<8||v>36  ? ["Hors plage","r"] : v<14||v>30  ? ["Limite","a"] : ["Optimal","g"],
};
const BC  = { g:["#c8f5e0","#1a7a50"], a:["#fff3c8","#b06010"], r:["#ffc8c8","#c02020"] };
const mc   = m => m>=80 ? "#1a7a50" : m>=60 ? "#b06010" : "#c02020";
const mcBg = m => m>=80 ? "#c8f5e0" : m>=60 ? "#fff3c8" : "#ffc8c8";
const PARAMS = [
  {id:"ph",  name:"pH",         u:"",     mn:4, mx:9  },
  {id:"ce",  name:"CE",         u:"dS/m", mn:0, mx:6  },
  {id:"n",   name:"Azote N",    u:"mg/kg",mn:0, mx:100},
  {id:"p",   name:"Phosphore P",u:"mg/kg",mn:0, mx:50 },
  {id:"k",   name:"Potassium K",u:"mg/kg",mn:0, mx:400},
  {id:"temp",name:"Temp. sol",  u:"°C",   mn:0, mx:40 },
];
const SN = {
  ete:"☀️ Été algérien : vérifiez l'irrigation. Chaleur intense possible.",
  hiver:"❄️ Hiver : risque de gel dans les hauts plateaux. Paillage recommandé.",
  printemps:"🌱 Printemps : excellente fenêtre pour les cultures estivales.",
  automne:"🍂 Automne : favorable aux cultures méditerranéennes.",
};

function calcScore(st) {
  let s = 100;
  const { ph, ce, temp, n, p, k, mo } = st;
  if (ph<5.5||ph>8) s-=18; else if (ph<6||ph>7.5) s-=7;
  if (ce>4) s-=22; else if (ce>2) s-=11;
  if (temp<8||temp>36) s-=12; else if (temp<14||temp>30) s-=5;
  if (n<20||n>80) s-=10; else if (n<30||n>65) s-=4;
  if (p<10||p>45) s-=8; else if (p<15||p>35) s-=3;
  if (k<80||k>350) s-=8; else if (k<130||k>280) s-=3;
  if (mo==="tres-bas") s-=12; else if (mo==="bas") s-=5; else if (mo==="excellent") s+=5;
  return Math.max(0, Math.min(100, Math.round(s)));
}
function pSt(id, v) {
  const R = { ph:[6,7.5], ce:[0,2], n:[30,65], p:[15,35], k:[130,280], temp:[14,30] };
  const [lo,hi] = R[id] || [0,100];
  if (v>=lo && v<=hi) return "ok";
  if (id==="ce") return "hi";
  return v<lo ? "lo" : "hi";
}
function cropScore(c, st) {
  let m = 100;
  const { ph, ce, temp, n, seas } = st;
  if (ph<c.ph[0]||ph>c.ph[1]) m -= ph<c.ph[0]-1||ph>c.ph[1]+1 ? 24 : 12;
  if (ce>c.ce) m -= ce>c.ce+1.5 ? 20 : 10;
  if (temp<c.tMn) m -= temp<c.tMn-6 ? 20 : 10;
  if (temp>c.tMx) m -= temp>c.tMx+6 ? 15 : 7;
  if (!c.ss.includes(seas)) m -= 16;
  if (c.nHi && n<25) m -= 10;
  if (st.mo==="tres-bas" && c.nHi) m -= 8;
  return Math.max(0, Math.round(m));
}
function cropAdj(c, st) {
  const adj = [];
  const { ph, ce, temp, seas } = st;
  if (ph<c.ph[0]) adj.push({t:`Corriger acidité — chaux (pH cible ${c.ph[0]}–${c.ph[1]})`,bg:"#fff3c0"});
  if (ph>c.ph[1]) adj.push({t:"Réduire alcalinité — soufre agricole",bg:"#fff3c0"});
  if (ce>c.ce)    adj.push({t:"Salinité élevée — lessivage avant plantation",bg:"#ffc0c0"});
  if (temp<c.tMn) adj.push({t:`Sol trop froid — attendre ≥ ${c.tMn}°C`,bg:"#c0d8ff"});
  if (!c.ss.includes(seas)) adj.push({t:`Saison non optimale — préférer ${c.ss.join(" ou ")}`,bg:"#fff3c0"});
  return adj;
}

/* ─── Default state factory ──────────────────────────────────────────────── */
const freshSt = (mode = "eco") => ({
  ph: 6.5,
  ce:   mode==="eco" ? SAT_DEFAULTS.ce   : 1.2,
  temp: mode==="eco" ? SAT_DEFAULTS.temp : 18,
  n: 45, p: 22, k: 180,
  tex: mode==="eco" ? SAT_DEFAULTS.tex : "limon-argileux",
  mo: "moyen", seas: "ete", crop: "",
});

/* 
   ATOM COMPONENTS
 */
function ZoneBar({ id }) {
  if (!ZC[id]) return null;
  return (
    <div className="sd-zones">
      {ZC[id].map((z,i) => <div key={i} className="sd-zone" style={{flex:z.f,background:z.c}}/>)}
    </div>
  );
}
function Badge({ id, value }) {
  if (!BS[id]) return null;
  const [lbl,k] = BS[id](value);
  const [bg,c]  = BC[k];
  return <div className="sd-badge" style={{background:bg,color:c}}><span className="sd-badge-dot" style={{background:c}}/>{lbl}</div>;
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
                <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1"/>
                <circle cx="3.5" cy="3.5" r="1" fill="currentColor"/>
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
      {badge && !locked && <Badge id={id} value={value}/>}
      {locked && (
        <div className="sd-sat-lock">
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <rect x="1.5" y="4" width="6" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M3 4V2.8a1.5 1.5 0 013 0V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          Importé depuis {src}
        </div>
      )}
    </div>
  );
}

/* 
   ZONE FORM 
    
  */
function ZoneForm({ zoneIdx,nZones,onNext, color, light, diagMode, st, onChange, crops, cultureLabel, onAnalyze, analyzing ,hasResult}) {
  const isSat = id => diagMode === "eco" && id in SAT_FIELDS;

  return (
    <div className="sd-fc">
  
      <div className="sd-zone-strip" style={{background: light, borderLeft: `4px solid ${color}`}}>
        <div className="sd-zone-strip-dot" style={{background: color}}/>
        <span className="sd-zone-strip-name" style={{color}}>Zone {zoneIdx + 1}</span>
        <span className="sd-zone-strip-hint">Renseignez les propriétés du sol de cette zone</span>
      </div>

      {/* Satellite notice (eco mode only, inline — not a big banner) */}
      {diagMode === "eco" && (
        <div className="sd-sat-notice">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="5" cy="5" r="1.5" fill="currentColor"/>
          </svg>
          CE · Température · Texture importés par satellite — non modifiables
        </div>
      )}

      {/* 1 — Chimie */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>1</span>Chimie du sol</div>
        <Slider id="ph"   label="pH du sol"          unit="pH"   min={4}  max={9}  step={0.1} value={st.ph}   onChange={onChange} zones badge l="4.0 Acide"  m="6.5 Neutre"      r="9.0 Alcalin"/>
        <Slider id="ce"   label="Salinité (CE)"      unit="dS/m" min={0}  max={6}  step={0.1} value={st.ce}   onChange={onChange} zones badge l="0 Nul"       m="2.0 Limite"      r="6.0 Critique"   locked={isSat("ce")}   src="Sentinel-2"/>
        <Slider id="temp" label="Température du sol" unit="°C"   min={0}  max={40} step={1}   value={st.temp} onChange={onChange} zones badge l="0°C Froid"   m="15–25°C Optimal" r="40°C Chaud"     locked={isSat("temp")} src="MODIS"/>
      </div>

      {/* 2 — NPK */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>2</span>Fertilité NPK</div>
        <Slider id="n" label="Azote (N)"     unit="mg/kg" min={0}  max={100} step={1} value={st.n} onChange={onChange} zones l="Faible"  m="30–60 Optimal" r="Élevé"/>
        <Slider id="p" label="Phosphore (P)" unit="mg/kg" min={0}  max={50}  step={1} value={st.p} onChange={onChange} zones l="0"        m="15–30 Optimal" r="50"/>
        <Slider id="k" label="Potassium (K)" unit="mg/kg" min={0}  max={400} step={5} value={st.k} onChange={onChange} zones l="0"        m="130–250 Opt."  r="400"/>
      </div>

      {/* 3 — Physique */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>3</span>Propriétés physiques</div>
        <div className="sd-two">
          <div>
            <div className="sd-col-lbl">
              Texture du sol
              {isSat("tex") && (
                <span className="sd-sat-tag" style={{marginLeft:5}}>
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <circle cx="3.5" cy="3.5" r="2.8" stroke="currentColor" strokeWidth="1.1"/>
                    <circle cx="3.5" cy="3.5" r="1" fill="currentColor"/>
                  </svg>
                  AlphaEarth
                </span>
              )}
            </div>
            <div className="sd-opts">
              {[
                {val:"limon-argileux",label:"Argilo-limoneuse",sub:"Idéale pour les légumes"},
                {val:"limoneux",      label:"Limoneuse",        sub:"Très fertile"},
                {val:"sableux",       label:"Sableuse",         sub:"Drainage rapide"},
                {val:"argileux",      label:"Argileuse",        sub:"Forte rétention"},
              ].map(o => (
                <div key={o.val}
                  className={`sd-opt ${st.tex===o.val?"sd-opt--on":""} ${isSat("tex")?"sd-opt--locked":""}`}
                  onClick={() => !isSat("tex") && onChange("tex", o.val)}>
                  <div className="sd-opt-r"><div className="sd-opt-dot"/></div>
                  <div>
                    <div className="sd-opt-lbl">{o.label}</div>
                    <div className="sd-opt-sub">{o.sub}</div>
                  </div>
                  {isSat("tex") && st.tex===o.val && (
                    <div className="sd-opt-sat-mark">
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <circle cx="4.5" cy="4.5" r="3.5" stroke="#1D9E75" strokeWidth="1.1"/>
                        <circle cx="4.5" cy="4.5" r="1.2" fill="#1D9E75"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="sd-col-lbl">Matière organique</div>
            <div className="sd-opts">
              {[
                {val:"tres-bas",label:"Très bas <1%"},
                {val:"bas",     label:"Bas 1–2%"},
                {val:"moyen",   label:"Moyen 2–4%"},
                {val:"bon",     label:"Bon 4–6%"},
                {val:"excellent",label:"Excellent >6%"},
              ].map(o => (
                <div key={o.val}
                  className={`sd-opt ${st.mo===o.val?"sd-opt--on":""}`}
                  onClick={() => onChange("mo", o.val)}>
                  <div className="sd-opt-r"><div className="sd-opt-dot"/></div>
                  <div><div className="sd-opt-lbl">{o.label}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4 — Saison */}
      <div className="sd-sec">
        <div className="sd-sec-lbl"><span className="sd-sec-num" style={{background:color}}>4</span>Saison de culture</div>
        <div className="sd-seas-row">
          {[
            {val:"printemps",em:"🌱",label:"Printemps"},
            {val:"ete",      em:"☀️",label:"Été"},
            {val:"automne",  em:"🍂",label:"Automne"},
            {val:"hiver",    em:"❄️",label:"Hiver"},
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

      {/* 5 — Culture */}
      <div className="sd-sec">
        <div className="sd-sec-lbl">
          <span className="sd-sec-num" style={{background:color}}>5</span>
          Culture ciblée
          <span className="sd-sec-opt"> — optionnel</span>
        </div>
        <div className="sd-crops-count">
          <span>{crops.length} cultures · {cultureLabel}</span>
        </div>
        <div className="sd-select-wrap">
          <select className="sd-sel" value={st.crop} onChange={e => onChange("crop", e.target.value)}>
            <option value="">🔀 Recommandez-moi</option>
            {crops.map(c => <option key={c.id} value={c.id}>{c.e} {c.n}</option>)}
          </select>
          <svg className="sd-sel-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 4.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Submit */}
<div className="sd-sub-wrap">
  {hasResult ? (
    
    nZones > 1 && zoneIdx < nZones - 1 ? (
      <button
        className="sd-sub-btn"
        style={{
          background: `linear-gradient(135deg,${color},${color}cc)`,
          boxShadow: `0 6px 0 ${color}44,0 10px 24px ${color}28`
        }}
        onClick={onNext}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 2l6 5-6 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Analyser Zone {zoneIdx + 2}
      </button>
    ) : (
      <div className="sd-all-done-btn">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M2.5 7.5l3.5 3.5 6.5-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Toutes les zones analysées ✓
      </div>
    )
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
            <path d="M14 8a6 6 0 11-6-6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
          </svg>
          Analyse en cours…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12l6.5-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Analyser la Zone {zoneIdx + 1}
        </>
      )}
    </button>
  )}
</div>
    </div>
  );
}

/* 
   RESULTS VIEW 
 */
function ResultsView({ st, onReset, crops, diagMode, color ,zoneIdx,nZones,onNext }) {
  const sc = calcScore(st), scC = mc(sc), scBg = mcBg(sc);
  const scLbl = sc>=80 ? "Excellent 🎉" : sc>=60 ? "À améliorer" : "Difficile";
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
            <div className="sd-score-eyebrow">Rapport de sol</div>
            <div className="sd-score-title">
              Votre sol est<br/>
              <em style={{color:scC}}>{sc>=80?"prêt à cultiver":sc>=60?"à optimiser":"à améliorer"}</em>
            </div>
          </div>
          <div className="sd-score-right">
            <div className="sd-score-number" style={{color:scC}}>{sc}</div>
            <div className="sd-score-sub">Score qualité</div>
            <div className="sd-score-pill" style={{background:scBg,color:scC}}>{scLbl}</div>
          </div>
        </div>
        <div className="sd-score-desc">
          {sc>=80?"Conditions favorables. Vous pouvez démarrer votre campagne dès maintenant.":"Des ajustements sont recommandés pour optimiser vos rendements."}
        </div>
        {diagMode==="eco" && (
          <div className="sd-eco-tag">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="4.5" cy="4.5" r="1.2" fill="currentColor"/>
            </svg>
            Données satellite incluses
          </div>
        )}
      </div>

      {/* Season alert */}
      {sn && (
        <div className="sd-sea-alert sd-a2"
          style={{background:iw?"rgba(160,200,255,.18)":"rgba(255,220,120,.18)",borderColor:iw?"rgba(100,160,240,.3)":"rgba(220,160,40,.3)",color:iw?"#1e40af":"#92400e"}}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M8 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="8" cy="12" r=".7" fill="currentColor"/>
          </svg>
          {sn}
        </div>
      )}

      {/* 6 param pills */}
      <div className="sd-param-pills sd-a2">
        {[PARAMS.slice(0,3), PARAMS.slice(3)].map((row,ri) => (
          <div key={ri} className="sd-param-pill-row">
            {row.map(p => {
              const v = st[p.id], sta = pSt(p.id,v);
              const pct = (((v-p.mn)/(p.mx-p.mn))*100).toFixed(1);
              const [bg2,c2] = {ok:["#c8f5e0","#1a7a50"],lo:["#fff3c8","#b06010"],hi:["#ffc8c8","#c02020"]}[sta];
              const pill = {ok:"✓ OK",lo:"↓ Bas",hi:"↑ Élevé"}[sta];
              const isSatPill = diagMode==="eco" && SAT_FIELDS[p.id];
              return (
                <div key={p.id} className={`sd-param-pill ${isSatPill?"sd-param-pill--sat":""}`} style={{borderBottom:`3px solid ${c2}40`}}>
                  <div className="sd-param-pill-top">
                    <span className="sd-param-pill-name">
                      {p.name}
                      {isSatPill && <span className="sd-param-sat-dot"/>}
                    </span>
                    <span className="sd-param-pill-badge" style={{background:bg2,color:c2}}>{pill}</span>
                  </div>
                  <div className="sd-param-pill-val">{Number.isInteger(v)?v:v.toFixed(1)}<small>{p.u}</small></div>
                  <div className="sd-param-bar" style={{background:bg2}}>
                    <div className="sd-param-bar-inner" style={{width:`${pct}%`,background:c2}}/>
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
            <span className="sd-sec-head-t">🌱 Cultures recommandées</span>
            <span className="sd-sec-head-m">{st.seas} · top 4</span>
          </div>
          <div className="sd-rec-cards">
            {recs.map((c,i) => (
              <div key={c.id} className={`sd-rec-card ${i===0?"sd-rec-card--top":""}`}>
                <div className="sd-rec-top">
                  <div className="sd-rec-emoji" style={{background:c.bg}}>{c.e}</div>
                  <div className="sd-rec-info">
                    <div className="sd-rec-name">{c.n}</div>
                    <div className="sd-rec-lat">{c.lat}</div>
                  </div>
                  <div className="sd-rec-score">
                    <div className="sd-rec-pct" style={{color:mc(c.sc)}}>{c.sc}%</div>
                    <div className="sd-rec-pct-lbl">compatibilité</div>
                    {i===0 && <div className="sd-rec-best-tag">★ Meilleur choix</div>}
                  </div>
                </div>
                <div className="sd-rec-bottom">
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
                            <div className="sd-rec-mbar-fill" style={{width:`${bp}%`,background:bc}}/>
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
          ? {e:"✅",bg:mcBg(tgt.sc),bc:"rgba(30,130,80,.2)",c:mc(tgt.sc),t:"Culture compatible",s:`Votre sol est bien adapté. Vous pouvez planter ${tgt.n} sans corrections majeures.`}
          : tgt.sc>=55
          ? {e:"⚠️",bg:"rgba(255,220,100,.18)",bc:"rgba(220,160,40,.3)",c:"#92400e",t:"Compatible avec corrections",s:`La culture de ${tgt.n} est possible mais des ajustements sont recommandés.`}
          : {e:"❌",bg:"rgba(255,150,140,.18)",bc:"rgba(200,60,60,.25)",c:"#991b1b",t:"Culture déconseillée",s:`Les conditions actuelles ne sont pas favorables pour ${tgt.n}.`};
        const altsSection = alts.length > 0;
        return (
          <>
            <div className="sd-a3">
              <div className="sd-sec-head"><span className="sd-sec-head-t">🔎 Analyse — {tgt.n}</span></div>
              <div className="sd-verd-card">
                <div className="sd-verd-top">
                  <div className="sd-verd-emoji" style={{background:tgt.bg}}>{tgt.e}</div>
                  <div className="sd-verd-info">
                    <div className="sd-verd-name">{tgt.n}</div>
                    <div className="sd-verd-lat">{tgt.lat}</div>
                  </div>
                  <div className="sd-verd-pct-blk">
                    <div className="sd-verd-pct" style={{color:mc(tgt.sc)}}>{tgt.sc}%</div>
                    <div className="sd-verd-pct-lbl">compatibilité</div>
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
                    <div className="sd-verd-adj-lbl">Ajustements requis</div>
                    {tgt.adj.map((a,i) => (
                      <div key={i} className="sd-verd-adj">
                        <div className="sd-verd-adj-pill" style={{background:a.bg}}>⚙</div>
                        {a.t}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="sd-verd-ok">✓ Aucun ajustement majeur requis — vous pouvez planter !</div>
                )}
              </div>
            </div>
            {altsSection && (
              <div className="sd-a4">
                <div className="sd-sec-head" style={{marginTop:4}}><span className="sd-sec-head-t">💡 Alternatives suggérées</span></div>
                <div className="sd-rec-cards">
                  {alts.map(c => (
                    <div key={c.id} className="sd-rec-card">
                      <div className="sd-rec-top">
                        <div className="sd-rec-emoji" style={{background:c.bg}}>{c.e}</div>
                        <div className="sd-rec-info">
                          <div className="sd-rec-name">{c.n}</div>
                          <div className="sd-rec-lat">{c.lat}</div>
                        </div>
                        <div className="sd-rec-score">
                          <div className="sd-rec-pct" style={{color:mc(c.sc)}}>{c.sc}%</div>
                          <div className="sd-rec-pct-lbl">compatibilité</div>
                        </div>
                      </div>
                      <div className="sd-rec-bottom"><div className="sd-rec-note">{c.note}</div></div>
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
            <path d="M2 6.5a4.5 4.5 0 118 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M10.2 9.5l.6 2.2 2-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Modifier
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
      Analyser Zone {zoneIdx + 2}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4.5 2L9 6l-4.5 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  ) : (

        <button className="sd-act sd-act-p">
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v8M3 7l3.5 3.5L10 7M1 12h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Télécharger le rapport
        </button>
  )}
      </div>
    </div>
  );
}

/* 
   MAIN 
*/
export default function SoilDiagnostic({
  open, onClose,
  parcelleName   = "Parcelle A",
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
  const cultureLabel = cultureGroupId===1?"Maraîchères":cultureGroupId===2?"Céréalières":"Permanentes";

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

  /* Mode toggle  */
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
                  <path d="M8 1L1 4.5l7 3.5 7-3.5L8 1zM1 10l7 3.5L15 10M1 7l7 3.5L15 7" stroke="white" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="sd-tb-name">Analyse<span>Soil</span></span>
            </div>

            <div className="sd-tb-chip">
              <div className="sd-tb-dot"/>
              <span className="sd-tb-cname">{parcelleName}</span>
              <span className="sd-tb-csub">· {cultureLabel}</span>
            </div>

            {/* MODE TOGGLE  */}
            <div className="sd-mode-toggle" title={!canToggleMode ? "Le mode ne peut plus être changé après analyse" : ""}>
              <button
                className={`sd-mode-toggle-btn ${diagMode==="eco" ? "sd-mode-toggle-btn--on" : ""}`}
                disabled={!canToggleMode}
                onClick={() => handleModeChange("eco")}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="4.5" cy="4.5" r="1.3" fill="currentColor"/>
                </svg>
                Éco
              </button>
              <button
                className={`sd-mode-toggle-btn ${diagMode==="standard" ? "sd-mode-toggle-btn--on sd-mode-toggle-btn--std" : ""}`}
                disabled={!canToggleMode}
                onClick={() => handleModeChange("standard")}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <path d="M1.5 4.5h6M4.5 1.5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/*  ZONE TABS  */}
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
                        <path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <span className="sd-zone-tab-dot" style={on?{background:"rgba(255,255,255,.3)"}:{background:zc}}/>
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

          {/*  TWO-COLUMN LAYOUT  */}
          <div className="sd-layout">
            <ZoneForm
              key={`${activeZone}-${diagMode}`}
              zoneIdx={activeZone}
              nZones={n}
              onNext={() => setActiveZone(prev => Math.min(n-1, prev+1))}
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
            />

            <div className="sd-rc">
              {!result ? (
                <div className="sd-idle">
                  <div className="sd-idle-blob" style={{background:`linear-gradient(135deg,${light},#d0f4e8)`}}>
                    <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
                      <path d="M22 6L6 15l16 9 16-9L22 6zM6 29l16 9 16-9M6 22l16 9 16-9"
                        stroke={color} strokeWidth="2.2" strokeLinejoin="round" opacity=".6"/>
                    </svg>
                  </div>
                  <div className="sd-idle-zone-pill" style={{background:color}}>Zone {activeZone + 1}</div>
                  <div className="sd-idle-t">Résultats ici</div>
                  <div className="sd-idle-s">
                    {diagMode==="eco"
                      ? "Mode Éco actif. CE, Temp et Texture sont pré-chargés. Renseignez NPK et lancez l'analyse."
                      : "Renseignez les paramètres du sol et lancez l'analyse pour obtenir vos recommandations."}
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