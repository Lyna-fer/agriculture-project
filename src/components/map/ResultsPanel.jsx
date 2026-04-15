import { useState, useMemo, useEffect } from "react";
import "./ResultsPanel.css";
import { CULTURES } from "../../data/cultures";
import SoilDiagnostic from "./SoilDiagnostic";

const hl = (t = "") =>
  t.replace(/(\d+[–-]\d+|\d+\scm|\d+\sj|\d+\ssem.|\d+\sans)/g, "$1");

function PatternDiagram({ type, color, size = 110 }) {
  const s = size, c = color, h = Math.round(s * 0.73);
  const diagrams = {
    zigzag: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><polyline points="8,62 22,18 36,62 50,18 64,62 78,18 92,62 106,40" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{[[8,62],[22,18],[36,62],[50,18],[64,62],[78,18],[92,62]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">ZIGZAG</text></svg> ),
    W: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><polyline points="8,20 24,60 40,30 56,60 72,30 88,60 104,20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{[[8,20],[24,60],[40,30],[56,60],[72,30],[88,60],[104,20]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">EN W</text></svg> ),
    x: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><line x1="10" y1="10" x2="100" y2="70" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/><line x1="100" y1="10" x2="10" y2="70" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/>{[[10,10],[100,70],[100,10],[10,70],[55,40]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">EN X</text></svg> ),
    radial: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/>{[[55,12],[90,32],[90,58],[55,68],[20,58],[20,32]].map(([x,y],i)=> <line key={i} x1="55" y1="40" x2={x} y2={y} stroke={c} strokeWidth="1.5" strokeDasharray="4 3" opacity=".65"/>)} <circle cx="55" cy="40" r="5" fill={c}/>{[[55,12],[90,32],[90,58],[55,68],[20,58],[20,32]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="3.5" fill={c} opacity=".85"/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">RADIAL</text></svg> ),
    grille: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/>{[20,55,90].flatMap(x =>[16,38,60].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={c} opacity=".65"/>))} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">GRILLE</text></svg> ),
    transect: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><line x1="10" y1="40" x2="100" y2="40" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/><line x1="55" y1="10" x2="55" y2="70" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/>{[[10,40],[34,40],[55,40],[76,40],[100,40],[55,10],[55,70]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">TRANSECT</text></svg> ),
  };
  return diagrams[type] || diagrams.zigzag;
}

function buildKpis(data, nSamples, parcelleHa) {
  const fmtHa = ha => ha < 0.1 ? `${(ha*10000).toFixed(0)} m²` : `${ha.toFixed(2)} ha`;
  return [
    { val: nSamples, lbl: "Points\nprélèvement", icon: "📍", bg: "#fff0f6", color: "#ff6b9d" },
    { val: `${data.depths.at(-1).label.split("–")[1].trim()}`, lbl: "Profondeur\nmax.", icon: "⬇️", bg: "#e6f7ff", color: "#5bc4f5" },
    { val: fmtHa(parcelleHa), lbl: "Surface\nparcelle", icon: "🌿", bg: "#e0faf4", color: "#00d4a0" },
    { val: data.depths.length, lbl: "Horizons\nrequis", icon: "🪨", bg: "#f0eeff", color: "#9b8ff5" },
  ];
}

const TABS = [
  { id: "schema",    label: "Schéma",    icon: "🗺" },
  { id: "depths",    label: "Horizons",  icon: "⛏" },
  { id: "protocole", label: "Protocole", icon: "📋" },
  { id: "gear",      label: "Matériel",  icon: "🧰" },
];

const PALETTE    = ["#81C8F5","#A8E6CF","#FFB6C1","#FFDAB9","#C8B9F5","#B5EAD7"];
const GEAR_EMOJIS= ["🔧","🪣","🛍","📡","🧤","📋","🗂","⚗"];

export default function ResultsPanel({
  open, onClose,
  cultureId,
  parcelleHa = 0,
  region     = "",
  samplingMode = "standard",
  parcelle   = null,
  nZones     = 1,
}) {
  const [tab,      setTab]      = useState("schema");
  const [diagOpen, setDiagOpen] = useState(false);

  const data = CULTURES.find(c => c.id === cultureId);

  const nSamples = useMemo(() => {
    if (!data || parcelleHa <= 0) return 0;
    const { coresPerHa, minCores, maxCores } = {
      coresPerHa: cultureId===1 ? 7 : cultureId===2 ? 4 : 5,
      minCores:   cultureId===1 ? 8 : cultureId===2 ? 6 : 6,
      maxCores:   20,
    };
    const densityFactor = samplingMode==="economic" ? 0.5 : 1.0;
    return Math.max(minCores, Math.min(maxCores, Math.round(parcelleHa * coresPerHa * densityFactor)));
  }, [data, parcelleHa, cultureId, samplingMode]);

  const zoneHa = cultureId===1 ? 3 : cultureId===2 ? 5 : 4;
  const calcZones = useMemo(() => {
    if (samplingMode==="economic") {
      if (parcelleHa<=10) return 1;
      if (parcelleHa<=25) return 2;
      return 3;
    }
    return Math.max(1, Math.ceil(parcelleHa/zoneHa));
  }, [samplingMode, parcelleHa, zoneHa]);

  const effectiveZones = nZones > 1 ? nZones : calcZones;
  const fmtHa = ha => ha < 0.1 ? `${(ha*10000).toFixed(0)} m²` : `${ha.toFixed(2)} ha`;

  if (!data) return null;

  const A = data.color, AB = data.colorLight, Icon = data.icon;
  const kpis = buildKpis(data, nSamples, parcelleHa);

  const initialDiagMode = samplingMode==="economic" ? "eco" : "standard";

  return (
    <div className={`cy-root ${open?"cy-root--open":""}`} style={{"--a":A,"--ab":AB}}>
      <div className="rp-hero">
        <div className="rp-topbar">
          <div className="rp-breadcrumb">Échantillonnage · {region||"Algérie"}</div>
          <button className="rp-close-btn" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="rp-identity-card">
          <div className="rp-icon-bubble" style={{background:AB}}><Icon size={26} color={data.iconColor}/></div>
          <div className="rp-identity-text">
            <div className="rp-group-badge" style={{background:AB,color:A,borderColor:`${A}33`}}>Groupe {data.id}</div>
            <div className="rp-culture-name">{data.nameShort}</div>
            <div className="rp-culture-examples">{data.examples}</div>
          </div>
        </div>

        <div className="rp-kpis">
          {kpis.map((k,i)=>(
            <div key={i} className="rp-kpi-pill">
              <div className="rp-kpi-pill-icon" style={{background:k.bg}}>{k.icon}</div>
              <div className="rp-kpi-pill-body">
                <div className="rp-kpi-pill-val" style={{color:i===0?A:"#1a1825"}}>{k.val}</div>
                <div className="rp-kpi-pill-lbl">{k.lbl.split("\n").map((l,j)=><span key={j}>{l}{j===0?"  ":" "}</span>)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="cy-tab-rail">
          {TABS.map(t=>(
            <button key={t.id}
              className={`cy-tab-pill ${tab===t.id?"cy-tab-pill--on":""}`}
              style={tab===t.id?{background:A,color:"#fff",boxShadow:`0 6px 18px ${A}50`}:{}}
              onClick={()=>setTab(t.id)}
            >
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cy-body">
        {tab==="schema" &&(
          <div className="cy-flow">
            <div className="cy-tag-row">
              <span className="cy-tag" style={{background:`${PALETTE[0]}30`,color:"#4a6080"}}>⏱ {data.timing}</span>
              <span className="cy-tag" style={{background:`${PALETTE[1]}30`,color:"#2d6a4f"}}>🔁 {data.freq}</span>
            </div>
            <div className="cy-slab cy-slab--formula" style={{borderColor:`${A}30`}}>
              <div className="cy-slab-left" style={{background:`${A}10`}}>
                <div className="cy-slab-micro">🧮 Calcul des zones</div>
                <div className="cy-formula-eq">
                  <span className="cy-formula-n" style={{color:A}}>{effectiveZones}</span>
                  {samplingMode==="economic"
                    ? <><span className="cy-formula-op">→</span><span className="cy-formula-p">Seuils fixes (Éco)</span></>
                    : <><span className="cy-formula-op">≈</span><span className="cy-formula-p">{fmtHa(parcelleHa)}</span><span className="cy-formula-op">/</span><span className="cy-formula-p">{zoneHa} ha</span></>}
                </div>
                <div className="cy-formula-note">
                  {samplingMode==="economic"?"Subdivision optimisée pour réduire les coûts":"Subdivision selon les normes agronomiques strictes"}
                </div>
              </div>
              <div className="cy-slab-right">
                <div className="cy-slab-micro">📌 Règle terrain</div>
                <div className="cy-slab-text">
                  La parcelle est divisée en <b>{effectiveZones} zone(s)</b> de gestion homogène.
                  Dans chaque zone, effectuez <b>{nSamples}</b> prélèvements à mélanger dans un seau distinct.
                </div>
              </div>
            </div>
            <div className="cy-alerts">
              {data.alerts?.map((a,i)=>(
                <div key={i} className="cy-alert-toast">
                  <div className="cy-alert-orb">⚠</div>
                  <div className="cy-alert-txt">{a}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="depths" &&(
          <div className="cy-flow">
            <div className="cy-intro-banner">
              <span className="cy-intro-icon">🪨</span>
              <div>Chaque horizon = <b>échantillon distinct</b>. Ne jamais mélanger les profondeurs.</div>
            </div>
            {data.depths?.map((d,i)=>(
              <div key={i} className="cy-hz-slab" style={{borderLeft:`5px solid ${d.color}`}}>
                <div className="cy-hz-slab-left">
                  <div className="cy-hz-swatch" style={{background:d.color,height:i===0?60:i===1?46:34}}/>
                  <div className="cy-hz-num">H{i+1}</div>
                </div>
                <div className="cy-hz-slab-body">
                  <div className="cy-hz-range" style={{color:d.color}}>{d.label} cm</div>
                  <div className="cy-hz-role">{d.desc}</div>
                  <div className="cy-hz-bottom">
                    {d.priority?<span className="cy-prio" style={{background:d.color,color:"#fff"}}>Obligatoire</span>:<span className="cy-prio cy-prio--opt">Optionnel</span>}
                    <div className="cy-hz-prog"><div className="cy-hz-prog-fill" style={{width:i===0?"100%":i===1?"65%":"40%",background:d.color}}/></div>
                    <span className="cy-hz-prog-lbl">{i===0?"Priorité max":i===1?"Si carence":"Long terme"}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="cy-intro-banner cy-intro-banner--green">
              <span className="cy-intro-icon">📌</span>
              <div>Pour les cultures {data.nameShort?.toLowerCase()}, {data.depths?.filter(d=>d.priority).length===data.depths?.length?"tous les horizons sont obligatoires":`l'horizon 0–${data.depths?.[0]?.label?.split("–")[1]?.trim()} cm est obligatoire`}.</div>
            </div>
          </div>
        )}

        {tab==="protocole" &&(
          <div className="cy-flow">
            {data.steps?.map((p,i)=>{
              const col=PALETTE[i%PALETTE.length];
              return(
                <div key={i} className="cy-proto-row">
                  <div className="cy-proto-timeline">
                    <div className="cy-proto-bubble" style={{background:col,boxShadow:`0 4px 14px ${col}66`}}>{String(i+1).padStart(2,"0")}</div>
                    {i<data.steps.length-1 && <div className="cy-proto-connector" style={{background:`${col}40`}}/>}
                  </div>
                  <div className="cy-proto-slab" style={{borderColor:`${col}30`}}>
                    <div className="cy-proto-title" style={{color:col}}>{p.title}</div>
                    <div className="cy-proto-body" dangerouslySetInnerHTML={{__html:hl(p.text)}}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab==="gear" &&(
          <div className="cy-flow">
            {data.gear?.map((g,i)=>{
              const col=PALETTE[i%PALETTE.length];
              return(
                <div key={i} className="cy-gear-pill" style={{borderColor:`${col}50`}}>
                  <div className="cy-gear-icon-ball" style={{background:`${col}30`}}><span style={{fontSize:22}}>{GEAR_EMOJIS[i]??"🔩"}</span></div>
                  <div className="cy-gear-pill-body">
                    <div className="cy-gear-num" style={{color:col}}>#{String(i+1).padStart(2,"0")}</div>
                    <div className="cy-gear-name">{g}</div>
                  </div>
                  <div className="cy-gear-check-ball" style={{background:col}}>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              );
            })}
            <div className="cy-intro-banner cy-intro-banner--peach">
              <span className="cy-intro-icon">💡</span>
              <div>Tout le matériel doit être propre et sec. Rincer à l'eau distillée entre chaque point.</div>
            </div>
          </div>
        )}
      </div>

      <div className="cy-footer">
        <div className="cy-footer-badge" style={{background:A}}><Icon size={13} color="#fff"/> {data.nameShort}</div>
        <div className="cy-footer-stats">
          <span>{nSamples} pts</span>
          <span className="cy-footer-dot"/>
          <span>{fmtHa(parcelleHa)}</span>
          <span className="cy-footer-dot"/>
          <span>{data.depths.length} horizons</span>
          <span className="cy-footer-dot"/>
          <span>{effectiveZones} zone{effectiveZones>1?"s":" "}</span>
        </div>

        <button className="cy-footer-diag" onClick={()=>setDiagOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.3"/>
            <path d="M6.5 4v3l2 2" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Diagnostic Sol
        </button>
        <button className="cy-footer-close" onClick={onClose}>Fermer ✕</button>

        <SoilDiagnostic
          open={diagOpen}
          onClose={()=>setDiagOpen(false)}
          parcelleName={region||"Parcelle A"}
          parcelleHa={parcelleHa}
          cultureGroupId={cultureId}
          parcelle={parcelle}
          nZones={effectiveZones}
          initialDiagMode={initialDiagMode}
        />
      </div>
    </div>
  );
}