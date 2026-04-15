import { useState } from "react";
import "./LeftPanel.css";
import DrawPanel from "./DrawPanel";
import leafIcon from "../../assets/broche-de-localisation.png";
import {
  VectorSquare,
  RectangleHorizontal,
  Trash2,
  BadgeCheck,
  CircleCheck,
  Dot,
  X,
} from "lucide-react";
import { CULTURES } from "../../data/cultures";

function fmtArea(sqm) {
  if (!sqm || sqm <= 0) return "—";
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("fr-FR")} m²`;
}

// ✅ FIXED: FieldThumb now handles both [[lat, lng], ...] and [{lat, lng}, ...] formats
function FieldThumb({ color, latlngs, index = 0 }) {
  const shapes = [
    "30,5 55,8 58,30 35,38 8,28",
    "8,10 52,6 58,28 42,42 10,35",
    "5,18 38,5 58,14 56,38 28,44 7,32",
    "14,6 52,10 58,32 36,44 8,36",
  ];

  // Show placeholder if not enough points
  if (!latlngs || latlngs.length < 3) {
    return (
      <svg width="46" height="42" viewBox="0 0 64 48" style={{ flexShrink: 0 }}>
        <polygon
          points={shapes[index % shapes.length]}
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const W = 64, H = 48, PAD = 5;

  // ✅ Normalize latlngs: convert arrays to objects if needed
  const normalizedLatLngs = latlngs.map(p => {
    if (Array.isArray(p)) {
      return { lat: p[0], lng: p[1] };
    }
    return p; // Already in {lat, lng} format
  });

  // Calculate bounds for scaling
  const lats = normalizedLatLngs.map((p) => p.lat);
  const lngs = normalizedLatLngs.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const rangeX = maxLng - minLng || 0.0001;
  const rangeY = maxLat - minLat || 0.0001;
  const scale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeY);

  // Generate SVG polygon points
  const pts = normalizedLatLngs
    .map((p) => {
      const x = PAD + (p.lng - minLng) * scale;
      const y = H - PAD - (p.lat - minLat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width="46"
      height="42"
      viewBox={`0 0 ${W} ${H}`}
      style={{ flexShrink: 0 }}
    >
      <polygon
        points={pts}
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LeftPanel({
  parcelles = [],
  selectedParcelle = null,
  selectedGroup = null,
  samplingMode = "standard",
  activeTool = null,
  pendingParcelleInfo = null,
  pendingColor = "#2ecc71",
  onToolClick,
  onSelectParcelle,
  onDeleteParcelle,
  onGroupChange,
  onSamplingModeChange,
  onGenerate,
  onClearAll,
  onSaveParcelle,
  onCancelDraw,
  isAnalyzing = false,
}) {
  const canGenerate = !!selectedParcelle && !!selectedGroup;
  const totalArea = parcelles.reduce((s, p) => s + (p.area || 0), 0);
  const step1done = parcelles.length > 0;
  const step2done = !!selectedGroup;

  const drawPanelOpen = !!activeTool || !!pendingParcelleInfo;
  const drawPhase = pendingParcelleInfo ? "confirm" : "drawing";

  return (
    <aside className="lp">
      <div className="lp-brand">
        <div className="lp-brand-leaf">
          <img src={leafIcon} alt="leaf" />
        </div>
        <div>
          <div className="lp-brand-name">Agric</div>
          <div className="lp-brand-sub">Échantillonnage des sols · Algérie</div>
        </div>
      </div>

      <div className="lp-drawtoolbar">
        <button
          className={`lp-dtool ${activeTool === "polygon" ? "on" : ""}`}
          onClick={() =>
            onToolClick(activeTool === "polygon" ? null : "polygon")
          }
        >
          <VectorSquare size={22} />
          Polygone
        </button>

        <button
          className={`lp-dtool ${activeTool === "rectangle" ? "on" : ""}`}
          onClick={() =>
            onToolClick(activeTool === "rectangle" ? null : "rectangle")
          }
        >
          <RectangleHorizontal size={22} />
          Rectangle
        </button>
      </div>

      <div className="lp-body">
        {parcelles.length === 0 ? (
          <div className="lp-empty">
            <div className="lp-empty-icon">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="30"
                  height="30"
                  rx="7"
                  stroke="#c4d9c8"
                  strokeWidth="1.4"
                  strokeDasharray="4 3"
                />
                <path
                  d="M17 10v14M10 17h14"
                  stroke="#c4d9c8"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="lp-empty-title">Aucune parcelle tracée</div>
            <div className="lp-empty-text">
              Choisissez <b>Polygone</b> ou <b>Rectangle</b> ci-dessus,
              <br />
              puis dessinez sur la carte.
            </div>
          </div>
        ) : (
          <>
            <div className="lp-list-meta">
              <span>
                {parcelles.length} parcelle{parcelles.length > 1 ? "s" : ""}
              </span>
              <span className="lp-list-total">{fmtArea(totalArea)}</span>
            </div>
            {parcelles.map((p, i) => {
              const cg = CULTURES.find((g) => g.id === p.groupId);
              const Icon = cg?.icon;
              return (
                <div
                  key={p.id}
                  className={`lp-field-item ${selectedParcelle === p.id ? "sel" : ""}`}
                  onClick={() => onSelectParcelle(p.id)}
                >
                  {selectedParcelle === p.id && (
                    <div
                      className="lp-field-sel-bar"
                      style={{ background: p.color }}
                    />
                  )}
                  {/* ✅ FieldThumb now handles backend's [[lat, lng]] format */}
                  <FieldThumb color={p.color} latlngs={p.latlngs} index={i} />
                  <div className="lp-field-info">
                    <div className="lp-field-name">{p.name}</div>
                    <div className="lp-field-area">
                      {fmtArea(p.area)}
                      {cg && (
                        <span
                          className="lp-field-culture-tag"
                          style={{ color: cg.color, background: cg.colorLight }}
                        >
                          {Icon && <Icon size={14} color={cg.iconColor} />}
                          {cg.nameShort}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="lp-field-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteParcelle(p.id);
                    }}
                    title="Supprimer"
                  >
                    <X size={18} />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="lp-footer">
        <div className="lp-status">
          <div className={`lp-status-pill ${step1done ? "ok" : ""}`}>
            <div className="lp-status-circle" />
            Parcelle
          </div>
          <div className={`lp-status-pill ${step2done ? "ok" : ""}`}>
            <div className="lp-status-circle" />
            Culture
          </div>
        </div>

        {parcelles.length > 0 && (
          <button className="lp-clear" onClick={onClearAll}>
            <Trash2 size={13} />
            Effacer tout
          </button>
        )}

        {canGenerate && (
          <div className="lp-mode-selector">
            <div className="lp-mode-label">Mode d'échantillonnage</div>
            <div className="lp-mode-buttons">
              <button
                className={`lp-mode-btn ${samplingMode === "standard" ? "active" : ""}`}
                onClick={() => onSamplingModeChange("standard")}
                title="Maximise la précision avec plus de zones"
              >
                <span className="lp-mode-icon">📊</span>
                Standard
              </button>
              <button
                className={`lp-mode-btn ${samplingMode === "economic" ? "active" : ""}`}
                onClick={() => onSamplingModeChange("economic")}
                title="Optimise le budget avec moins de zones"
              >
                <span className="lp-mode-icon">💰</span>
                Économique
              </button>
            </div>
          </div>
        )}

        <button
          className={`lp-gen ${canGenerate ? "ready" : ""} ${isAnalyzing ? "loading" : ""}`}
          disabled={!canGenerate || isAnalyzing}
          onClick={() => canGenerate && !isAnalyzing && onGenerate()}
        >
          {isAnalyzing ? (
            <>
              <span className="spinner" /> ⏳ Traitement...
            </>
          ) : canGenerate ? (
            <>
              <BadgeCheck size={20} />
              Générer le guide d'échantillonnage
            </>
          ) : (
            <>Dessinez une parcelle et choisissez un type</>
          )}
        </button>
      </div>

      <DrawPanel
        open={drawPanelOpen}
        phase={drawPhase}
        parcelleInfo={pendingParcelleInfo}
        defaultColor={pendingColor}
        onSave={onSaveParcelle}
        onCancel={onCancelDraw}
      />
    </aside>
  );
}