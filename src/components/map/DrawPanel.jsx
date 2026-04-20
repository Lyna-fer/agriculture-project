import { useState, useEffect, useRef } from "react";
import "./DrawPanel.css";
import {
  PencilLine,
  MousePointerClick,
  SquareDashedMousePointer,
  Pointer,
  X,
  Check,
  Expand,
} from "lucide-react";
import { CULTURES } from "../../data/cultures";

function fmtArea(sqm) {
  if (!sqm || sqm <= 0) return "—";
  if (sqm >= 10000) return `${(sqm / 10000).toFixed(2)} ha`;
  return `${Math.round(sqm).toLocaleString("en-US")} m²`;
}

function ParcellePreview({ latlngs, color, type }) {
  if (!latlngs || latlngs.length < 2) {
    return (
      <svg width="220" height="140" viewBox="0 0 220 140" style={{ background: '#f8fcf9', borderRadius: '10px' }}>
        <rect x="2" y="2" width="36" height="36" rx="8" stroke={color} strokeWidth="1.5" strokeDasharray="5 3" opacity=".4" fill="none" transform="translate(92, 52)"/>
        <path d="M110 70v16M102 78h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" opacity=".4"/>
      </svg>
    );
  }

  const W = 220, H = 140, PAD = 14;
  const lats = latlngs.map((p) => p.lat);
  const lngs = latlngs.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const rangeX = maxLng - minLng || 0.0001;
  const rangeY = maxLat - minLat || 0.0001;
  const scale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeY);

  const pts = latlngs.map((p) => {
    const x = PAD + (p.lng - minLng) * scale;
    const y = H - PAD - (p.lat - minLat) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pointsStr = pts.join(" ");
  const cx = pts.reduce((s, p) => s + parseFloat(p.split(",")[0]), 0) / pts.length;
  const cy = pts.reduce((s, p) => s + parseFloat(p.split(",")[1]), 0) / pts.length;

  return (
    <svg className="dp-preview-svg" viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke={color} strokeWidth="0.3" opacity="0.2" />
      <rect width={W} height={H} fill="#f8fcf9" rx="8" />
      <polygon points={pointsStr} fill={color} fillOpacity="0.08" stroke="none" transform="translate(2,3)" />
      <polygon points={pointsStr} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {latlngs.map((p, i) => {
        const [x, y] = pts[i].split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke={color} strokeWidth="1.8" />;
      })}
      <circle cx={cx} cy={cy} r="4" fill={color} opacity="0.7" />
    </svg>
  );
}

export default function DrawPanel({
  open,
  phase,
  parcelleInfo,
  defaultColor,
  onSave,
  onCancel,
  existingNames = [], // ✅ NEW: List of existing names to check against
}) {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (phase === "confirm") {
      setTimeout(() => nameRef.current?.focus(), 200);
      setName("");
      setGroupId(null);
    }
  }, [phase]);

  // ✅ NEW: Check for duplicate name (case-insensitive)
  const isNameTaken = existingNames.some(
    (n) => n.toLowerCase() === name.trim().toLowerCase()
  );

  const canSave = name.trim().length > 0 && !!groupId && !isNameTaken;
  const selGroup = CULTURES.find((g) => g.id === groupId);

  return (
    <div className={`dp-root ${open ? "dp-root--open" : ""}`}>
      {phase === "drawing" && (
        <div className="dp-drawing">
          <div className="dp-drawing-top">
            <div className="dp-drawing-icon">
              <PencilLine size={22} color="#1a7a3f" />
            </div>
            <div className="dp-drawing-title">Drawing in Progress</div>
            <div className="dp-drawing-sub">Draw your parcel on the map</div>
          </div>

          <div className="dp-drawing-steps">
            {[
              { icon: <MousePointerClick size={20} />, text: "Click to place points" },
              { icon: <SquareDashedMousePointer size={20} />, text: "Continue along the perimeter" },
              { icon: <Pointer size={20} />, text: "Double-click to finish" },
            ].map((s, i) => (
              <div key={i} className="dp-drawing-step">
                <span className="dp-drawing-step-icon">{s.icon}</span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>

          <button className="dp-cancel-btn" onClick={onCancel}>
            <X size={15} />
            Cancel drawing
          </button>
        </div>
      )}

      {phase === "confirm" && parcelleInfo && (
        <div className="dp-confirm">
          {/* Header */}
          <div className="dp-confirm-header">
            <div className="dp-confirm-title">New Parcel</div>
            <div className="dp-confirm-area">
              <Expand size={16} />
              {fmtArea(parcelleInfo.areaM2 || parcelleInfo.area * 10000)}
            </div>
          </div>

          <div className="dp-preview-wrap">
            <ParcellePreview
              latlngs={parcelleInfo.latlngs}
              color={defaultColor}
              type={parcelleInfo.type}
            />
            <div
              className="dp-preview-badge"
              style={{ background: defaultColor }}
            >
              {fmtArea(parcelleInfo.areaM2 || parcelleInfo.area * 10000)}
            </div>
          </div>

          <div className="dp-field">
            <label className="dp-field-label">Parcel Name</label>
            <input
              ref={nameRef}
              className="dp-field-input"
              placeholder="Ex: North Parcel, Field A..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                canSave &&
                onSave({ name: name.trim(), groupId })
              }
              maxLength={40}
              style={{ borderColor: isNameTaken ? '#e74c3c' : '' }} // ✅ Visual cue
            />
            {/* ✅ NEW: Error Label */}
            {isNameTaken && (
              <div style={{ color: '#e74c3c', fontSize: '11px', fontWeight: 600, marginTop: '4px' }}>
                This name exists already, Choose another name
              </div>
            )}
          </div>

          <div className="dp-field">
            <label className="dp-field-label">Crop Type</label>
            <div className="dp-culture-grid">
              {CULTURES.map((g) => {
                const isSel = groupId === g.id;
                const Icon = g.icon;
                return (
                  <button
                    key={g.id}
                    className={`dp-culture-btn ${isSel ? "sel" : " "}`}
                    style={
                      isSel
                        ? { borderColor: g.color, background: g.colorLight }
                        : {}
                    }
                    onClick={() => setGroupId(g.id)}
                  >
                    <span className="dp-culture-btn-emoji">
                      <Icon color={g.iconColor} size={20} />
                    </span>
                    <span
                      className="dp-culture-btn-label"
                      style={isSel ? { color: g.color } : {}}
                    >
                      {g.nameShort}
                    </span>
                    {isSel && (
                      <span
                        className="dp-culture-btn-check"
                        style={{ background: g.color }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dp-actions">
            <button className="dp-btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button
              className={`dp-btn-save ${canSave ? "ready" : " "}`}
              disabled={!canSave}
              onClick={() => canSave && onSave({ name: name.trim(), groupId })}
            >
              <Check size={18} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
