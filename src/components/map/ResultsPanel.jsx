import { useState, useMemo } from "react";
import "./ResultsPanel.css";
import { CULTURES } from "../../data/cultures";

function PatternDiagram({ type, color, size = 110 }) {
  const s = size;
  const c = color;

  const diagrams = {
    zigzag: (
      <svg viewBox="0 0 110 80" width={s} height={Math.round(s * 0.73)}>
        <rect width="110" height="80" rx="3" fill={`${c}12`} />
        <polyline
          points="8,62 22,18 36,62 50,18 64,62 78,18 92,62 106,40"
          fill="none"
          stroke={c}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[
          [8, 62],
          [22, 18],
          [36, 62],
          [50, 18],
          [64, 62],
          [78, 18],
          [92, 62],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill={c} />
        ))}
        <text
          x="55"
          y="76"
          textAnchor="middle"
          fill={c}
          fontSize="7"
          fontFamily="monospace"
          opacity=".6"
        >
          ZIGZAG
        </text>
      </svg>
    ),
    W: (
      <svg viewBox="0 0 110 80" width={s} height={Math.round(s * 0.73)}>
        <rect width="110" height="80" rx="3" fill={`${c}12`} />
        <polyline
          points="8,20 24,60 40,30 56,60 72,30 88,60 104,20"
          fill="none"
          stroke={c}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[
          [8, 20],
          [24, 60],
          [40, 30],
          [56, 60],
          [72, 30],
          [88, 60],
          [104, 20],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill={c} />
        ))}
        <text
          x="55"
          y="76"
          textAnchor="middle"
          fill={c}
          fontSize="7"
          fontFamily="monospace"
          opacity=".6"
        >
          EN W
        </text>
      </svg>
    ),
    x: (
      <svg viewBox="0 0 110 80" width={s} height={Math.round(s * 0.73)}>
        <rect width="110" height="80" rx="3" fill={`${c}12`} />
        <line
          x1="10"
          y1="10"
          x2="100"
          y2="70"
          stroke={c}
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <line
          x1="100"
          y1="10"
          x2="10"
          y2="70"
          stroke={c}
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        {[
          [10, 10],
          [100, 70],
          [100, 10],
          [10, 70],
          [55, 40],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill={c} />
        ))}
        <text
          x="55"
          y="76"
          textAnchor="middle"
          fill={c}
          fontSize="7"
          fontFamily="monospace"
          opacity=".6"
        >
          EN X
        </text>
      </svg>
    ),
    radial: (
      <svg viewBox="0 0 110 80" width={s} height={Math.round(s * 0.73)}>
        <rect width="110" height="80" rx="3" fill={`${c}12`} />
        {[
          [55, 12],
          [90, 32],
          [90, 58],
          [55, 68],
          [20, 58],
          [20, 32],
        ].map(([x, y], i) => (
          <line
            key={i}
            x1="55"
            y1="40"
            x2={x}
            y2={y}
            stroke={c}
            strokeWidth="1.2"
            strokeDasharray="4 3"
            opacity=".7"
          />
        ))}
        <circle cx="55" cy="40" r="4" fill={c} />
        {[
          [55, 12],
          [90, 32],
          [90, 58],
          [55, 68],
          [20, 58],
          [20, 32],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill={c} opacity=".8" />
        ))}
        <text
          x="55"
          y="76"
          textAnchor="middle"
          fill={c}
          fontSize="7"
          fontFamily="monospace"
          opacity=".6"
        >
          RADIAL
        </text>
      </svg>
    ),
    grille: (
      <svg viewBox="0 0 110 80" width={s} height={Math.round(s * 0.73)}>
        <rect width="110" height="80" rx="3" fill={`${c}12`} />
        {[20, 55, 90].flatMap((x) =>
          [16, 38, 60].map((y) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="3.5"
              fill={c}
              opacity=".6"
            />
          )),
        )}
        <text
          x="55"
          y="76"
          textAnchor="middle"
          fill={c}
          fontSize="7"
          fontFamily="monospace"
          opacity=".6"
        >
          GRILLE
        </text>
      </svg>
    ),
    transect: (
      <svg viewBox="0 0 110 80" width={s} height={Math.round(s * 0.73)}>
        <rect width="110" height="80" rx="3" fill={`${c}12`} />
        <line
          x1="10"
          y1="40"
          x2="100"
          y2="40"
          stroke={c}
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <line
          x1="55"
          y1="10"
          x2="55"
          y2="70"
          stroke={c}
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        {[
          [10, 40],
          [34, 40],
          [55, 40],
          [76, 40],
          [100, 40],
          [55, 10],
          [55, 70],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill={c} />
        ))}
        <text
          x="55"
          y="76"
          textAnchor="middle"
          fill={c}
          fontSize="7"
          fontFamily="monospace"
          opacity=".6"
        >
          TRANSECT
        </text>
      </svg>
    ),
  };
  return diagrams[type] || diagrams.zigzag;
}

export default function ResultsPanel({
  open,
  onClose,
  cultureId,
  parcelleHa = 0,
  region = "",
}) {
  const [activeTab, setActiveTab] = useState("schema");
  // const data = CULTURE_DATA[cultureId]
  const data = CULTURES.find((c) => c.id === cultureId);
  const nSamples = useMemo(() => {
    if (!data || parcelleHa <= 0) return 0;
    if (data.sampleFormula) {
      return data.sampleFormula(parcelleHa);
    }

    return Math.max(data.minSamples, Math.round(parcelleHa * data.sampleNote));
  }, [data, parcelleHa]);

  const fmtHa = (ha) =>
    ha < 0.1 ? `${(ha * 10000).toFixed(0)} m²` : `${ha.toFixed(2)} ha`;

  if (!data) return null;

  const accent = data.color;
  const accentBg = data.colorLight;
  const accentLight = data.color;

  const TABS = [
    { id: "schema", label: "Schéma" },
    { id: "depths", label: "Horizons" },
    { id: "protocole", label: "Protocole" },
    { id: "gear", label: "Matériel" },
  ];
  const Icon = data.icon;
  return (
    <div className={`sp-root ${open ? "sp-root--open" : ""}`}>
      <header
        className="sp-header"
        style={{ "--a": accent, "--ab": accentBg, "--al": accentLight }}
      >
        <div className="sp-header-top">
          <div className="sp-breadcrumb">
            <span className="sp-breadcrumb-dot" />
            Échantillonnage · {region || "Algérie"}
          </div>
          <button className="sp-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path
                d="M1 1l9 9M10 1L1 10"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="sp-identity">
          <div className="sp-identity-left">
            <div
              className="sp-culture-tag"
              style={{ background: accentBg, color: accent }}
            >
              Groupe {data.id}
            </div>
            <h1 className="sp-title">{data.nameShort}</h1>
            <p className="sp-sub">{data.examples}</p>
          </div>
          {/* <div className="sp-identity-icon">{data.icon}</div> */}
          <div className="sp-identity-icon">
            <Icon size={28} color={data.iconColor} />
          </div>
        </div>

        <div className="sp-kpi-row">
          <div className="sp-kpi sp-kpi--main">
            <span className="sp-kpi-n" style={{ color: accent }}>
              {nSamples}
            </span>
            <span className="sp-kpi-label">
              points de
              <br />
              prélèvement
            </span>
          </div>
          <div className="sp-kpi-divider" />
          <div className="sp-kpi">
            <span className="sp-kpi-n">
              {data.depths.at(-1).label.split("–")[1].trim()}
            </span>
            <span className="sp-kpi-label">
              cm
              <br />
              max.
            </span>
          </div>
          <div className="sp-kpi-divider" />
          <div className="sp-kpi">
            <span className="sp-kpi-n">{fmtHa(parcelleHa)}</span>
            <span className="sp-kpi-label">
              surface
              <br />
              parcelle
            </span>
          </div>
          <div className="sp-kpi-divider" />
          <div className="sp-kpi">
            <span className="sp-kpi-n">{data.depths.length}</span>
            <span className="sp-kpi-label">
              horizons
              <br />
              requis
            </span>
          </div>
        </div>

        <nav className="sp-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`sp-tab ${activeTab === t.id ? "sp-tab--on" : ""}`}
              style={activeTab === t.id ? { "--a": accent } : {}}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="sp-body">
        {activeTab === "schema" && (
          <div className="sp-tab-content">
            <div className="sp-pills">
              <span className="sp-pill">⏱ {data.timing}</span>
              <span className="sp-pill">🔁 {data.freq}</span>
            </div>

            <div
              className="sp-formula-block"
              style={{ "--a": accent, "--ab": accentBg }}
            >
              <div className="sp-formula-left">
                <div className="sp-formula-label">Formule de calcul</div>
                <div className="sp-formula-eq">
                  <span className="sp-formula-val" style={{ color: accent }}>
                    {nSamples}
                  </span>
                  <span className="sp-formula-op">=</span>
                  <span className="sp-formula-part">{fmtHa(parcelleHa)}</span>
                  <span className="sp-formula-op">×</span>
                  {/* <span className="sp-formula-part">{data.sampleNote}/ha</span> */}
                  <span className="sp-formula-part">{data.sampleNote}</span>
                </div>
                <div className="sp-formula-note">
                  minimum {data.sampleNote} points quelle que soit la surface
                </div>
              </div>
              <div className="sp-formula-rule">
                <div className="sp-formula-rule-title">Règle terrain</div>
                <div className="sp-formula-rule-text">
                  Répartir les {nSamples} points selon le schéma ci-dessous.
                  Chaque point = 1 enfoncement de tarière jusqu'à la profondeur
                  cible.
                </div>
              </div>
            </div>

            <div className="sp-patterns-title">Schémas disponibles</div>
            <div className="sp-patterns">
              <div
                className="sp-pattern sp-pattern--rec"
                style={{ "--a": accent, "--ab": accentBg }}
              >
                <div
                  className="sp-pattern-badge"
                  style={{ background: accent }}
                >
                  Recommandé
                </div>
                <PatternDiagram type={data.pattern} color={accent} size={110} />
                <div className="sp-pattern-footer">
                  <span className="sp-pattern-name" style={{ color: accent }}>
                    {data.pattern.toUpperCase()}
                  </span>
                  <span className="sp-pattern-why">
                    {data.id === 1 && "Couvre l'hétérogénéité max."}
                    {data.id === 2 && "Capture la variabilité diagonale"}
                    {data.id === 3 && "Suit la distribution racinaire"}
                  </span>
                </div>
              </div>

              <div className="sp-pattern sp-pattern--alt">
                <PatternDiagram
                  type={data.patternAlt}
                  color="#9ca3a0"
                  size={110}
                />
                <div className="sp-pattern-footer">
                  <span className="sp-pattern-name">
                    {data.patternAlt.toUpperCase()}
                  </span>
                  <span className="sp-pattern-why">Alternatif</span>
                </div>
              </div>
            </div>

            {/* alerts */}
            <div className="sp-alerts">
              {data.alerts.map((a, i) => (
                <div className="sp-alert" key={i}>
                  <svg
                    className="sp-alert-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M8 1.5L1 14h14L8 1.5z"
                      stroke="#92700a"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 6v3.5"
                      stroke="#92700a"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                    <circle cx="8" cy="11.5" r=".75" fill="#92700a" />
                  </svg>
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "depths" && (
          <div className="sp-tab-content">
            <p className="sp-tab-intro">
              Chaque horizon constitue un <strong>échantillon distinct</strong>.
              Ne jamais mélanger les profondeurs dans un même sac.
            </p>

            <div className="sp-profile">
              <div className="sp-profile-col">
                {data.depths.map((d, i) => {
                  const h = i === 0 ? 72 : i === 1 ? 56 : 44;
                  return (
                    <div
                      key={i}
                      className="sp-profile-layer"
                      style={{ height: h, background: d.color }}
                    >
                      <span className="sp-profile-cm">{d.label} cm</span>
                    </div>
                  );
                })}
                <div className="sp-profile-subsoil" />
              </div>
              <div className="sp-profile-details">
                {data.depths.map((d, i) => (
                  <div
                    key={i}
                    className="sp-profile-detail"
                    style={{
                      "--h": data.depths[i < data.depths.length ? i : 0],
                    }}
                  >
                    <div className="sp-profile-connector">
                      <div
                        className="sp-profile-dot"
                        style={{ background: d.color }}
                      />
                      <div
                        className="sp-profile-line"
                        style={{ background: `${d.color}40` }}
                      />
                    </div>
                    <div className="sp-profile-info">
                      <div className="sp-profile-range">{d.label} cm</div>
                      <div className="sp-profile-role">{d.desc}</div>

                      {d.priority && (
                        <span
                          className="sp-profile-prio"
                          style={{
                            color: accent,
                            borderColor: `${accent}40`,
                            background: accentBg,
                          }}
                        >
                          obligatoire
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sp-depth-rule">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect
                  x="1"
                  y="1"
                  width="12"
                  height="12"
                  rx="2"
                  stroke={accent}
                  strokeWidth="1.2"
                />
                <path
                  d="M4 5h6M4 7h6M4 9h4"
                  stroke={accent}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                Pour les cultures {data.nameShort.toLowerCase()},{" "}
                {data.depths.filter((d) => d.priority).length ===
                data.depths.length
                  ? "tous les horizons sont obligatoires"
                  : `l'horizon 0–${data.depths[0].label.split("–")[1].trim()} cm est obligatoire`}
                . Les autres sont recommandés en cas de problème nutritionnel
                constaté.
              </span>
            </div>
          </div>
        )}

        {activeTab === "protocole" && (
          <div className="sp-tab-content">
            <div className="sp-proto-list">
              {data.steps.map((p, i) => (
                <div className="sp-proto" key={i}>
                  <div className="sp-proto-left">
                    <div className="sp-proto-n" style={{ color: accent }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    {i < data.steps.length - 1 && (
                      <div
                        className="sp-proto-connector"
                        style={{ background: `${accent}25` }}
                      />
                    )}
                  </div>
                  <div className="sp-proto-right">
                    <div className="sp-proto-step">{p.title}</div>
                    <div
                      className="sp-proto-body"
                      dangerouslySetInnerHTML={{
                        __html: p.text.replace(
                          /(\d+[–\-]\d+|\d+\s*cm|\d+\s*j|\d+\s*sem\.|\d+\s*ans)/g,
                          "<strong>$1</strong>",
                        ),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "gear" && (
          <div className="sp-tab-content">
            <div className="sp-gear-list">
              {data.gear.map((g, i) => (
                <div
                  className="sp-gear"
                  key={i}
                  style={{ "--a": accent, "--ab": accentBg }}
                >
                  <div className="sp-gear-num">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="sp-gear-name">{g}</div>
                  <div className="sp-gear-check">
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path
                        d="M1.5 4.5l2 2 4-4"
                        stroke={accent}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            <div className="sp-gear-note">
              L'ensemble du matériel doit être propre et sec avant usage. Rincer
              à l'eau distillée entre chaque point de prélèvement pour éviter la
              contamination croisée.
            </div>
          </div>
        )}
      </div>

      <footer className="sp-footer">
        <div className="sp-footer-info">
          <span
            className="sp-footer-badge"
            style={{
              color: accent,
              borderColor: `${accent}35`,
              background: accentBg,
            }}
          >
            <Icon size={14} color={data.iconColor} />
            {data.nameShort}
          </span>
          <span className="sp-footer-sep">·</span>
          <span className="sp-footer-stat">{nSamples} pts</span>
          <span className="sp-footer-sep">·</span>
          <span className="sp-footer-stat">{fmtHa(parcelleHa)}</span>
        </div>
        <div className="sp-footer-actions">
          <button className="sp-btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
      </footer>
    </div>
  );
}
