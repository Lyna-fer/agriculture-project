import { useEffect, useRef, useState } from "react";
import "./LeftPanel.css";
import DrawPanel from "./DrawPanel";
import PortalOverlay from "./PortalOverlay";
import leafIcon from "../../assets/broche-de-localisation.png";
import {
  Map,
  LayoutDashboard,
  User,
  VectorSquare,
  RectangleHorizontal,
  Trash2,
  BadgeCheck,
  X,
  Settings,
  LogOut,
} from "lucide-react";
import { CULTURES } from "../../data/cultures";

function fmtArea(sqm) {
  if (!sqm || sqm <= 0) return "—";
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("en-US")} m²`;
}

function FieldThumb({ color, latlngs, index = 0 }) {
  const shapes = [
    "30,5 55,8 58,30 35,38 8,28",
    "8,10 52,6 58,28 42,42 10,35",
    "5,18 38,5 58,14 56,38 28,44 7,32",
    "14,6 52,10 58,32 36,44 8,36",
  ];

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

  const W = 64;
  const H = 48;
  const PAD = 5;
  const normalizedLatLngs = latlngs.map((point) =>
    Array.isArray(point) ? { lat: point[0], lng: point[1] } : point
  );
  const lats = normalizedLatLngs.map((point) => point.lat);
  const lngs = normalizedLatLngs.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const rangeX = maxLng - minLng || 0.0001;
  const rangeY = maxLat - minLat || 0.0001;
  const scale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeY);
  const pts = normalizedLatLngs
    .map((point) => {
      const x = PAD + (point.lng - minLng) * scale;
      const y = H - PAD - (point.lat - minLat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width="46" height="42" viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
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
  activeTool = null,
  pendingParcelleInfo = null,
  pendingColor = "#2ecc71",
  onToolClick,
  onSelectParcelle,
  onDeleteParcelle,
  onGroupChange,
  onGenerate,
  onClearAll,
  onSaveParcelle,
  onCancelDraw,
  isAnalyzing = false,
  maxParcelAreaHa = 50,
  selectedParcelleData = null,
  dashboardEnabled = false,
  onOpenDashboard,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const canGenerate = !!selectedParcelle && !!selectedGroup;
  const totalArea = parcelles.reduce((sum, parcel) => sum + (parcel.area || 0), 0);
  const step1done = parcelles.length > 0;
  const step2done = !!selectedGroup;
  const drawPanelOpen = !!activeTool || !!pendingParcelleInfo;
  const drawPhase = pendingParcelleInfo ? "confirm" : "drawing";
  const existingNames = parcelles.map((parcel) => parcel.name || "");

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    onClearAll();
  };

  const handleDashboardClick = () => {
    if (!dashboardEnabled || typeof onOpenDashboard !== "function") return;
    onOpenDashboard();
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [profileMenuOpen]);

  return (
    <aside className="lp">
      <div className="lp-shell">
        <div className="lp-navrail">
          <button
            type="button"
            className="lp-navbtn on"
            onClick={() => setProfileMenuOpen(false)}
            title="Parcelles"
          >
            <Map size={20} />
          </button>

          <button
            type="button"
            className={`lp-navbtn ${dashboardEnabled ? "lp-navbtn-dashboard-ready" : ""}`}
            onClick={handleDashboardClick}
            title={dashboardEnabled ? "Open dashboard" : "Dashboard unavailable"}
            disabled={!dashboardEnabled}
          >
            <LayoutDashboard size={20} />
          </button>

          <div className="lp-profile-wrap" ref={profileMenuRef}>
            <button
              type="button"
              className={`lp-navbtn ${profileMenuOpen ? "on" : ""}`}
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              title="Profile"
            >
              <User size={20} />
            </button>

            {profileMenuOpen && (
              <div className="lp-profile-menu">
                <button type="button" className="lp-profile-item">
                  <Settings size={18} />
                  Paramètres du compte
                </button>
                <button type="button" className="lp-profile-item">
                  <LogOut size={18} />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lp-main">
            <div className="lp-brand">
              <div className="lp-brand-leaf">
                <img src={leafIcon} alt="leaf" />
              </div>
              <div>
                <div className="lp-brand-name">
                  Agric
                  <br />
                  <span className="lp-brand-sub">Soil Sampling · Algeria</span>
                </div>
              </div>
              <div className="lp-brand-badge">Field Lab</div>
            </div>

            <div className="lp-drawtoolbar">
              <button
                className={`lp-dtool ${activeTool === "polygon" ? "on" : ""}`}
                onClick={() => onToolClick(activeTool === "polygon" ? null : "polygon")}
                type="button"
              >
                <VectorSquare size={22} />
                Polygon
              </button>

              <button
                className={`lp-dtool ${activeTool === "rectangle" ? "on" : ""}`}
                onClick={() => onToolClick(activeTool === "rectangle" ? null : "rectangle")}
                type="button"
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
                  <div className="lp-empty-title">No parcel drawn</div>
                  <div className="lp-empty-text">
                    Choose <b>Polygon</b> or <b>Rectangle</b> above,
                    <br />
                    then draw on the map.
                  </div>
                </div>
              ) : (
                <>
                  <div className="lp-list-meta">
                    <span>
                      {parcelles.length} parcel{parcelles.length > 1 ? "s" : ""}
                    </span>
                    <span className="lp-list-total">{fmtArea(totalArea)}</span>
                  </div>
                  <div className="lp-list-caption">
                    Select a parcel to continue the sampling workflow and generate its guide.
                  </div>
                  {parcelles.map((parcel, index) => {
                    const culture = CULTURES.find((group) => group.id === parcel.groupId);
                    const Icon = culture?.icon;

                    return (
                      <div
                        key={parcel.id}
                        className={`lp-field-item ${selectedParcelle === parcel.id ? "sel" : ""}`}
                        onClick={() => onSelectParcelle(parcel.id)}
                      >
                        {selectedParcelle === parcel.id && (
                          <div className="lp-field-sel-bar" style={{ background: parcel.color }} />
                        )}
                        <FieldThumb color={parcel.color} latlngs={parcel.latlngs} index={index} />
                        <div className="lp-field-info">
                          <div className="lp-field-name">{parcel.name}</div>
                          <div className="lp-field-area">
                            {fmtArea(parcel.area)}
                            {culture && (
                              <span
                                className="lp-field-culture-tag"
                                style={{ color: culture.color, background: culture.colorLight }}
                              >
                                {Icon && <Icon size={14} color={culture.iconColor} />}
                                {culture.nameShort}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="lp-field-del"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteParcelle(parcel.id);
                          }}
                          title="Delete"
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
                  Parcel
                </div>
                <div className={`lp-status-pill ${step2done ? "ok" : ""}`}>
                  <div className="lp-status-circle" />
                  Crop
                </div>
              </div>

              {parcelles.length > 0 && (
                <button type="button" className="lp-clear" onClick={() => setShowClearConfirm(true)}>
                  <Trash2 size={13} />
                  Clear all
                </button>
              )}

              <button
                type="button"
                className={`lp-gen ${canGenerate ? "ready" : ""} ${isAnalyzing ? "loading" : ""}`}
                disabled={!canGenerate || isAnalyzing}
                onClick={() => canGenerate && !isAnalyzing && onGenerate()}
              >
                {isAnalyzing ? (
                  <>
                    <span className="spinner" /> Processing...
                  </>
                ) : canGenerate ? (
                  <>
                    <BadgeCheck size={20} />
                    Generate Sampling Guide
                  </>
                ) : (
                  <>Draw a parcel and choose a type</>
                )}
              </button>
            </div>
          </div>
      </div>

      <DrawPanel
        open={drawPanelOpen}
        phase={drawPhase}
        parcelleInfo={pendingParcelleInfo}
        defaultColor={pendingColor}
        maxParcelAreaHa={maxParcelAreaHa}
        onSave={onSaveParcelle}
        onCancel={onCancelDraw}
        existingNames={existingNames}
      />

      {showClearConfirm && (
        <PortalOverlay zIndex={2500}>
          <div className="lp-clear-dialog-overlay" onClick={() => setShowClearConfirm(false)}>
            <div className="lp-clear-dialog" onClick={(event) => event.stopPropagation()}>
              <div className="lp-clear-dialog-header">
                <Trash2 size={20} style={{ color: "#c03030" }} />
                <h2>Clear All Parcels?</h2>
              </div>
              <p className="lp-clear-dialog-message">
                This will permanently delete all {parcelles.length} parcel{parcelles.length > 1 ? "s" : ""} and{" "}
                {parcelles.length > 0 && selectedGroup ? "your crop selection" : "your selections"}. This action
                cannot be undone.
              </p>
              <div className="lp-clear-dialog-actions">
                <button type="button" className="lp-dialog-btn cancel" onClick={() => setShowClearConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="lp-dialog-btn confirm" onClick={handleConfirmClear}>
                  <Trash2 size={14} />
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        </PortalOverlay>
      )}
    </aside>
  );
}
