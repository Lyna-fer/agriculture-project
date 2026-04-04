import React from 'react';
import { ZONE_COLORS, ZONE_RECS } from '../../data/wilayas';
import './WilayaInfoPanel.css';

export default function WilayaInfoPanel({ wilaya, selectedCultureId, onClose }) {
  if (!wilaya) return null;

  const zone = ZONE_COLORS[wilaya.zone];
  const rec = ZONE_RECS[wilaya.zone]?.[selectedCultureId];

  return (
    <div className="wilaya-panel">
      <button className="wilaya-close" onClick={onClose}>✕</button>

      <div className="wilaya-header" style={{ background: zone.bg }}>
        <div className="wilaya-flag">🇩🇿</div>
        <div>
          <div className="wilaya-name">{wilaya.name}</div>
          <div className="wilaya-code" style={{ color: zone.text, opacity: 0.75 }}>
            Wilaya {wilaya.code} · {wilaya.lat.toFixed(3)}°N, {wilaya.lng.toFixed(3)}°E
          </div>
        </div>
        <div className="wilaya-zone-badge" style={{ background: zone.text, color: zone.bg }}>
          {wilaya.zone}
        </div>
      </div>

      <div className="wilaya-body">
        <div className="wilaya-row">
          <span className="wilaya-row-label">Zone agro-climatique</span>
          <span className="wilaya-row-val" style={{ color: zone.bg, fontWeight: 700 }}>
            {zone.label}
          </span>
        </div>

        {rec && (
          <div className="wilaya-rec">
            <div className="wilaya-rec-label">💡 Conseil pour cette zone</div>
            <p>{rec}</p>
          </div>
        )}

        {!rec && (
          <div className="wilaya-rec muted">
            <p>Sélectionnez un type de culture pour obtenir des recommandations spécifiques à cette zone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
