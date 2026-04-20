

import React, { useEffect, useState } from 'react';
import { ZONE_COLORS, ZONE_RECS } from '../../data/wilayas';
import './WilayaInfoPanel.css';

const DURATION = 5000;
const CIRCUMFERENCE = 2 * Math.PI * 15; // 94.25

export default function WilayaInfoPanel({ wilaya, selectedCultureId, onClose }) {
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!wilaya) return;
    setFading(false);
    setProgress(100);

    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (elapsed < DURATION - 500) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    const frameRef = { current: requestAnimationFrame(tick) };

    const fadeTimer = setTimeout(() => setFading(true), DURATION - 500);
    const closeTimer = setTimeout(() => onClose(), DURATION);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [wilaya]);

  const handleClose = () => {
    setFading(true);
    setTimeout(() => onClose(), 450);
  };

  if (!wilaya) return null;

  const zone = ZONE_COLORS[wilaya.zone];
  const rec = ZONE_RECS[wilaya.zone]?.[selectedCultureId];
  const dashOffset = ((100 - progress) / 100) * CIRCUMFERENCE;

  return (
    <div className={`wilaya-panel ${fading ? 'wilaya-panel--fading' : ''}`}>

      <button className="wilaya-close" onClick={handleClose}>
        <svg className="wilaya-close-ring" viewBox="0 0 36 36">
          <circle className="wilaya-close-ring__track" cx="18" cy="18" r="15" />
          <circle
            className="wilaya-close-ring__progress"
            cx="18" cy="18" r="15"
            style={{ stroke: zone.text }}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="wilaya-close-x">✕</span>
      </button>

      <div
        className="wilaya-header"
        style={{
          background: `
            radial-gradient(circle at 16% 14%, rgba(255,255,255,0.34), transparent 24%),
            linear-gradient(135deg, ${zone.bg}, ${zone.text} 180%)
          `,
        }}
      >
        <div>
          <div className="wilaya-name">{wilaya.name}</div>
          <div className="wilaya-code" style={{ color: zone.text, opacity: 0.75 }}>
            Province {wilaya.code} · {wilaya.lat.toFixed(3)}°N, {wilaya.lng.toFixed(3)}°E
          </div>
        </div>
        <div
          className="wilaya-zone-badge"
          style={{
            background: `linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08)), ${zone.text}`,
            color: zone.bg,
          }}
        >
          {zone.label}
        </div>
      </div>

      <div className="wilaya-body">
        <div className="wilaya-row">
          <span className="wilaya-row-label">Agro-climatic zone</span>
          <span className="wilaya-row-val" style={{ color: zone.bg, fontWeight: 700 }}>
            {zone.label}
          </span>
        </div>

        {rec && (
          <div className="wilaya-rec">
            <div className="wilaya-rec-top">
              <div className="wilaya-rec-label">Zone guidance</div>
              <div className="wilaya-rec-chip">Crop-aware</div>
            </div>
            <p>{rec}</p>
          </div>
        )}

        {!rec && (
          <div className="wilaya-rec muted">
            <div className="wilaya-rec-top">
              <div className="wilaya-rec-label">Zone guidance</div>
              <div className="wilaya-rec-chip">Select a crop</div>
            </div>
            <p>Select a crop type to get recommendations specific to this zone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
