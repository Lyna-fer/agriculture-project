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
    W: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><polyline points="8,20 24,60 40,30 56,60 72,30 88,60 104,20" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{[[8,20],[24,60],[40,30],[56,60],[72,30],[88,60],[104,20]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">W</text></svg> ),
    x: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><line x1="10" y1="10" x2="100" y2="70" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/><line x1="100" y1="10" x2="10" y2="70" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/>{[[10,10],[100,70],[100,10],[10,70],[55,40]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">X</text></svg> ),
    radial: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/>{[[55,12],[90,32],[90,58],[55,68],[20,58],[20,32]].map(([x,y],i)=> <line key={i} x1="55" y1="40" x2={x} y2={y} stroke={c} strokeWidth="1.5" strokeDasharray="4 3" opacity=".65"/>)} <circle cx="55" cy="40" r="5" fill={c}/>{[[55,12],[90,32],[90,58],[55,68],[20,58],[20,32]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="3.5" fill={c} opacity=".85"/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">RADIAL</text></svg> ),
    grille: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/>{[20,55,90].flatMap(x =>[16,38,60].map(y => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={c} opacity=".65"/>))} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">GRID</text></svg> ),
    transect: ( <svg viewBox="0 0 110 80" width={s} height={h}> <rect width="110" height="80" rx="12" fill={`${c}18`}/><line x1="10" y1="40" x2="100" y2="40" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/><line x1="55" y1="10" x2="55" y2="70" stroke={c} strokeWidth="1.8" strokeDasharray="5 3"/>{[[10,40],[34,40],[55,40],[76,40],[100,40],[55,10],[55,70]].map(([x,y],i)=> <circle key={i} cx={x} cy={y} r="4" fill={c}/>)} <text x="55" y="76" textAnchor="middle" fill={c} fontSize="7" fontFamily="monospace" opacity=".5">TRANSECT</text></svg> ),
  };
  return diagrams[type] || diagrams.zigzag;
}

function normalizeLatLngPoint(point) {
  if (Array.isArray(point)) {
    return { lat: Number(point[0]), lng: Number(point[1]) };
  }
  return { lat: Number(point?.lat), lng: Number(point?.lng) };
}

function getParcelCentroid(latlngs = []) {
  const pts = latlngs
    .map(normalizeLatLngPoint)
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (!pts.length) return null;

  const sums = pts.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sums.lat / pts.length,
    lng: sums.lng / pts.length,
  };
}

function monthToSeason(month) {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

function getWeatherCodeMeta(code) {
  const map = {
    0: { label: "Clear sky", icon: "☀️" },
    1: { label: "Mostly clear", icon: "🌤️" },
    2: { label: "Partly cloudy", icon: "⛅" },
    3: { label: "Overcast", icon: "☁️" },
    45: { label: "Fog", icon: "🌫️" },
    48: { label: "Rime fog", icon: "🌫️" },
    51: { label: "Light drizzle", icon: "🌦️" },
    53: { label: "Drizzle", icon: "🌦️" },
    55: { label: "Dense drizzle", icon: "🌧️" },
    61: { label: "Light rain", icon: "🌦️" },
    63: { label: "Rain", icon: "🌧️" },
    65: { label: "Heavy rain", icon: "⛈️" },
    71: { label: "Light snow", icon: "🌨️" },
    73: { label: "Snow", icon: "🌨️" },
    75: { label: "Heavy snow", icon: "❄️" },
    80: { label: "Rain showers", icon: "🌦️" },
    81: { label: "Rain showers", icon: "🌧️" },
    82: { label: "Violent showers", icon: "⛈️" },
    95: { label: "Thunderstorm", icon: "⛈️" },
    96: { label: "Storm with hail", icon: "⛈️" },
    99: { label: "Severe storm", icon: "⛈️" },
  };
  return map[Number(code)] || { label: "Weather update", icon: "🌤️" };
}

function getForecastDayMeta(dateValue, index) {
  const date = new Date(`${dateValue}T12:00:00`);
  const monthLabel = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");

  if (index === 0) {
    return {
      dayNumber: Number.isNaN(date.getTime()) ? "" : date.getDate(),
      monthLabel,
      label: "Aujourd'hui",
    };
  }

  return {
    dayNumber: date.getDate(),
    monthLabel,
    label: date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "") + ".",
  };
}

function buildSamplingWeatherAdvice(weather) {
  if (!weather) return [];

  const advice = [];
  const recentRain = Number(weather.recentRainMm || 0);
  const maxRecentRain = Number(weather.maxRecentRainMm || 0);
  const nextRainMm = Number(weather.nextRainMm || 0);
  const nextRainProb = Number(weather.nextRainProbability || 0);
  const todayMax = Number(weather.todayMaxTemp ?? weather.currentTemp ?? 0);

  if (recentRain >= 6 || maxRecentRain >= 4) {
    advice.push({
      tone: "danger",
      title: "Rain detected recently",
      text: "Wait 3 days before sampling. Wet soil can shift pH, move NPK, and produce non-homogeneous samples.",
    });
  } else if (nextRainMm >= 3 || nextRainProb >= 60) {
    advice.push({
      tone: "warn",
      title: "Rain expected soon",
      text: "Avoid sampling before or during rain. Soil humidity can distort nutrient and texture readings.",
    });
  } else {
    advice.push({
      tone: "good",
      title: "Ideal sampling conditions",
      text: "Conditions look stable for sampling. The soil should be easier to homogenize and interpret.",
    });
  }

  if (todayMax >= 32) {
    advice.push({
      tone: "warn",
      title: "High temperature",
      text: "Temperature is high. Sample early in the morning to reduce heat and evaporation effects.",
    });
  } else if (todayMax <= 8) {
    advice.push({
      tone: "soft",
      title: "Cool field window",
      text: "The soil may stay compact and wet longer. Prefer late morning if the surface is still cold.",
    });
  } else {
    advice.push({
      tone: "soft",
      title: "Stable temperature window",
      text: "Temperature is moderate. Keep a consistent depth and avoid atypical wet spots.",
    });
  }

  return advice;
}

function buildSeasonalSamplingTips(season, cultureName) {
  const culture = String(cultureName || "").toLowerCase();
  const isPermanent = culture.includes("permanent");
  const isCereal = culture.includes("cereal");
  const seasonTips = {
    spring: [
      "Spring is a good time to sample before fertilizer and planting decisions.",
      "Prefer a dry 48-72 hour window to avoid washed nutrient readings.",
    ],
    summer: [
      "In hot periods, sample early in the morning and keep bags away from direct sun.",
      "Dry topsoil can be variable, so keep the same depth at every point.",
    ],
    autumn: [
      "Autumn is useful for post-harvest sampling and correction planning.",
      "Avoid sampling right after strong rain because the surface can become sticky and uneven.",
    ],
    winter: [
      "Winter sampling is possible only during stable dry windows.",
      "Do not sample saturated or muddy soil because the composite sample will be biased.",
    ],
  };

  const cropTip = isPermanent
    ? "For permanent crops, separate each depth and avoid points directly influenced by localized irrigation."
    : isCereal
    ? "For cereals, post-harvest or pre-sowing windows usually give the cleanest fertility baseline."
    : "For vegetables, sample before major fertilization so recommendations reflect the real soil state.";

  return [...(seasonTips[season] || seasonTips.spring), cropTip];
}

function buildKpis(data, parcelleHa, zoneCount, requiredLayerCount) {
  const fmtHa = ha => ha < 0.1 ? `${(ha*10000).toFixed(0)} m²` : `${ha.toFixed(2)} ha`;
  return [
    { val: zoneCount, lbl: "Number\nof zones", icon: "🗺", bg: "#e6f7ff", color: "#5bc4f5" },
    { val: fmtHa(parcelleHa), lbl: "Parcel\narea", icon: "🌿", bg: "#e0faf4", color: "#00d4a0" },
    { val: requiredLayerCount, lbl: "Required\nlayers", icon: "🪨", bg: "#f0eeff", color: "#9b8ff5" },
  ];
}

const TABS = [
  { id: "schema",    label: "Strategy",   icon: "🗺" },
  { id: "depths",    label: "Layers",     icon: "⛏" },
  { id: "protocole", label: "Protocol",   icon: "📋" },
  { id: "gear",      label: "Equipment",  icon: "🧰" },
];

const PALETTE    = ["#81C8F5","#A8E6CF","#FFB6C1","#FFDAB9","#C8B9F5","#B5EAD7"];
const GEAR_EMOJIS= ["⛏️","🪣","🛰️","🖊️","🧤","📋","🗂️","⚗️"];
export default function ResultsPanel({
  open, onClose,
  cultureId,
  parcelleHa = 0,
  region     = "",
  samplingMode = "standard",
  parcelle   = null,
  mapSnapshot = null,
  zones      = [],
  nZones     = 1,   // received from map.jsx (data.zones.length from backend)
  onStartSampling,
  weatherData = null,
}) {
  const [tab,      setTab]      = useState("schema");
  const [diagOpen, setDiagOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const data = CULTURES.find(c => c.id === cultureId);
  const resolvedParcelleHa = parcelleHa > 0
    ? parcelleHa
    : Number(parcelle?.area || 0) / 10000;
  const weatherPolygonPoints = useMemo(
    () => (parcelle?.latlngs || [])
      .map((point) => {
        const normalized = normalizeLatLngPoint(point);
        return [normalized.lat, normalized.lng];
      })
      .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])),
    [parcelle]
  );

  const zoneHa = cultureId===1 ? 3 : cultureId===2 ? 5 : 4;
  const calcZones = useMemo(() => {
    if (samplingMode==="economic") {
      if (resolvedParcelleHa<=10) return 1;
      if (resolvedParcelleHa<=25) return 2;
      return 3;
    }
    // Match backend logic: only use multiple zones if area > zoneHa * 1.35
    if (resolvedParcelleHa > zoneHa * 1.35) {
      return Math.ceil(resolvedParcelleHa / zoneHa);
    }
    return 1;
  }, [samplingMode, resolvedParcelleHa, zoneHa]);

  const effectiveZones = nZones > 1 ? nZones : calcZones;
  const fmtHa = ha => ha < 0.1 ? `${(ha*10000).toFixed(0)} m²` : `${ha.toFixed(2)} ha`;
  const parcelCentroid = useMemo(() => getParcelCentroid(parcelle?.latlngs || []), [parcelle]);
  const cultureName = data?.nameShort || "";
  const A = data?.color || "#4a7c2f";
  const AB = data?.colorLight || "rgba(74,124,47,0.1)";
  const Icon = data?.icon;
  const requiredDepths = data?.depths?.filter((depth) => depth.priority !== false) || [];
  const kpis = data ? buildKpis(data, resolvedParcelleHa, effectiveZones, requiredDepths.length) : [];
  const seasonalTips = buildSeasonalSamplingTips(monthToSeason(new Date().getMonth() + 1), cultureName);
  const weatherAdvice = buildSamplingWeatherAdvice(weather);
  const todayWeather = weather?.forecastSummary?.[0] || null;

  const initialDiagMode = samplingMode==="economic" ? "eco" : "standard";

  useEffect(() => {
    if (weatherData) {
      setWeather(weatherData);
      setWeatherLoading(false);
      return;
    }

    if (!open || weatherPolygonPoints.length < 3 || !Number.isFinite(parcelCentroid?.lat) || !Number.isFinite(parcelCentroid?.lng)) {
      setWeather(null);
      setWeatherLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/weather/parcel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ polygonPoints: weatherPolygonPoints }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Weather request failed");

        setWeather(await response.json());
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Weather fetch failed:", error);
          setWeather(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setWeatherLoading(false);
        }
      }
    };

    fetchWeather();
    return () => controller.abort();
  }, [open, parcelCentroid, weatherPolygonPoints, weatherData]);

  if (!data || !Icon) return null;

  return (
    <div className={`cy-root ${open?"cy-root--open":""}`} style={{"--a":A,"--ab":AB}}>
      <div className="rp-hero">
        <div className="rp-topbar">
          <div className="rp-breadcrumb">Sampling · {region||"Algeria"}</div>
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
              style={tab===t.id?{background:A,color:"#fff",boxShadow:`0 6px 18px ${A}50`}:{} }
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
            <div className="cy-weather-shell">
              <div className="cy-weather-hero" style={{borderColor:`${A}24`}}>
                <div>
                  <div className="cy-weather-kicker">Weather-aware sampling</div>
                  <div className="cy-weather-title">Forecast, alerts, and seasonal recommendations</div>
                  <div className="cy-weather-subtitle">
                    Weather affects soil moisture, nutrient leaching, temporary pH shifts, and sample homogeneity.
                  </div>
                </div>
                <div className="cy-weather-now">
                  <strong>{weatherLoading ? "Loading forecast..." : weather?.currentLabel || "Forecast unavailable"}</strong>
                  <span>
                    {weatherLoading
                      ? "Checking this parcel"
                      : weather?.currentTemp != null
                      ? `${Number(weather.currentTemp).toFixed(1)} degC now`
                      : "No live parcel weather"}
                  </span>
                  {!weatherLoading && weather && (
                    <span>
                      {weather.currentWindKmh != null ? `${Math.round(Number(weather.currentWindKmh))} km/h wind` : "Wind unavailable"}
                      {weather.currentHumidity != null ? ` · ${Math.round(Number(weather.currentHumidity))}% humidity` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="cy-weather-strip">
                {(weather?.forecastSummary || []).length > 0 ? (
                  weather.forecastSummary.map((day, index) => {
                    const meta = getForecastDayMeta(day.date, index);
                    return (
                      <article key={day.date} className={`cy-forecast-card ${index === 0 ? "cy-forecast-card--today" : ""}`}>
                        <div className="cy-forecast-top">
                          <span className="cy-forecast-date">
                            {meta.dayNumber}
                            {meta.monthLabel ? <span className="cy-forecast-month"> {meta.monthLabel}</span> : null}
                          </span>
                          <span className="cy-forecast-name">{meta.label}</span>
                        </div>
                        <div className="cy-forecast-mid">
                          <div className="cy-forecast-icon">{day.icon}</div>
                          <div className="cy-forecast-temps">
                            <strong>{Math.round(day.maxTemp)}°</strong>
                            <span>{Math.round(day.minTemp)}°</span>
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="cy-weather-strip-empty">No forecast available yet for this parcel.</div>
                )}
              </div>

              <div className="cy-weather-grid">
                <div className="cy-weather-card">
                  <div className="cy-weather-card-head">
                    <span>Sampling impact</span>
                    <strong>Why weather matters</strong>
                  </div>
                  <div className="cy-weather-forecast-list">
                    <div className="cy-weather-day">
                      <div className="cy-weather-day-main">
                        <div>
                          <strong>Rainfall</strong>
                          <span>Recent or upcoming rain can make the soil too wet and non-uniform.</span>
                        </div>
                      </div>
                    </div>
                    <div className="cy-weather-day">
                      <div className="cy-weather-day-main">
                        <div>
                          <strong>NPK and pH</strong>
                          <span>Water can leach nutrients and temporarily modify pH, leading to biased lab results.</span>
                        </div>
                      </div>
                    </div>
                    <div className="cy-weather-day">
                      <div className="cy-weather-day-main">
                        <div>
                          <strong>Texture and handling</strong>
                          <span>Sticky wet soil is harder to homogenize, so composite samples become less reliable.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="cy-weather-card cy-weather-card--accent">
                  <div className="cy-weather-card-head">
                    <span>Sampling alert</span>
                    <strong>Field decision</strong>
                  </div>
                  <div className="cy-weather-highlight">
                    {weatherAdvice[0] ? (
                      <>
                        <div className={`cy-weather-pill cy-weather-pill--${weatherAdvice[0].tone}`}>{weatherAdvice[0].title}</div>
                        <p>{weatherAdvice[0].text}</p>
                      </>
                    ) : (
                      <p>Weather-based guidance will appear here once the parcel forecast loads.</p>
                    )}
                  </div>
                  <div className="cy-weather-mini-stats">
                    <div>
                      <span>Recent rain</span>
                      <strong>{weather ? `${Math.round(weather.recentRainMm)} mm / 3 d` : "--"}</strong>
                    </div>
                    <div>
                      <span>Today max</span>
                      <strong>{todayWeather ? `${Math.round(todayWeather.maxTemp)} degC` : "--"}</strong>
                    </div>
                    <div>
                      <span>Next rain</span>
                      <strong>
                        {weather?.nextRainDate
                          ? new Date(`${weather.nextRainDate}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          : "Clear"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="cy-weather-alert-stack">
                {weatherAdvice.slice(1).map((item, index) => (
                  <div key={`${item.title}-${index}`} className={`cy-weather-alert cy-weather-alert--${item.tone}`}>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </div>
                ))}
                <div className="cy-weather-alert cy-weather-alert--info">
                  <strong>Avoid sampling after rain</strong>
                  <span>Wet soil can leach NPK, change pH temporarily, and become sticky so the final sample is less reliable.</span>
                </div>
              </div>

              <div className="cy-weather-season-card">
                <div className="cy-weather-card-head">
                  <span>Seasonal recommendations</span>
                  <strong>Sampling by season</strong>
                </div>
                <div className="cy-weather-season-list">
                  {seasonalTips.map((tip, index) => (
                    <div key={`${tip}-${index}`} className="cy-weather-season-item">
                      <span className="cy-weather-season-dot" />
                      <p>{tip}</p>
                    </div>
                  ))}
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
              <div>Each layer = <b>separate sample</b>. Never mix depths.</div>
            </div>
            {requiredDepths.map((d,i)=>(
              <div key={i} className="cy-hz-slab" style={{borderLeft:`5px solid ${d.color}`}}>
                <div className="cy-hz-slab-left">
                  <div className="cy-hz-swatch" style={{background:d.color,height:i===0?60:i===1?46:34}}/>
                  <div className="cy-hz-num">H{i+1}</div>
                </div>
                <div className="cy-hz-slab-body">
                  <div className="cy-hz-range" style={{color:d.color}}>{d.label}</div>
                  <div className="cy-hz-role">{d.desc}</div>
                  <div className="cy-hz-bottom">
                    <span className="cy-prio" style={{background:d.color,color:"#fff"}}>Required</span>
                    <div className="cy-hz-prog"><div className="cy-hz-prog-fill" style={{width:i===0?"100%":i===1?"65%":"40%",background:d.color}}/></div>
                    <span className="cy-hz-prog-lbl">{i===0?"Highest priority":i===1?"If deficiency":"Long term"}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="cy-intro-banner cy-intro-banner--green">
              <span className="cy-intro-icon">📌</span>
              <div>For {data.nameShort?.toLowerCase()} crops, {requiredDepths.length} layer{requiredDepths.length>1?"s are":" is"} required.</div>
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
              <div>All equipment must be clean and dry. Rinse with distilled water between each point.</div>
            </div>
          </div>
        )}
      </div>

      <div className="cy-footer">
        <div className="cy-footer-summary">
          <div className="cy-footer-stats">
            <span>{fmtHa(resolvedParcelleHa)}</span>
            <span className="cy-footer-dot"/>
            <span>{requiredDepths.length} required layers</span>
            <span className="cy-footer-dot"/>
            <span>{effectiveZones} zone{effectiveZones>1?"s":" "}</span>
          </div>
        </div>

        <div className="cy-footer-actions">
          <button className="cy-footer-diag" onClick={()=>setDiagOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="white" strokeWidth="1.3"/>
              <path d="M6.5 4v3l2 2" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Soil Diagnostic
          </button>
          <button className="cy-footer-sampling" onClick={onStartSampling}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v8M3 7l3.5 3.5L10 7M1 12h11" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Télécharger KML
          </button>
        </div>

        <SoilDiagnostic
          open={diagOpen}
          onClose={()=>setDiagOpen(false)}
          parcelleName={parcelle?.name || region || "Parcel A"}
          parcelleHa={resolvedParcelleHa}
          cultureGroupId={cultureId}
          parcelle={parcelle}
          mapSnapshot={mapSnapshot}
          zones={zones}
          nZones={effectiveZones}
          initialDiagMode={initialDiagMode}
           weatherData={weatherData}
        />
      </div>
    </div>
  );
}
