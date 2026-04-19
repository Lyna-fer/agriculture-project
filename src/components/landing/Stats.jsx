import { useEffect, useRef, useState } from "react";
import "./Stats.css";

function Counter({ value, suffix, active }) {
  const [cur, setCur] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1800, 1);
      setCur(Math.floor((1 - Math.pow(1 - p, 4)) * value));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, value]);
  return <>{cur}{suffix}</>;
}

const partners = ["INRAA Algeria", "FAO", "Sentinel-2 / ESA", "Open-Meteo", "MADR", "CRSTRA"];

const cards = [
  {
    tone: {
      surface: "#eef6ef",
      border: "rgba(58, 125, 68, 0.18)",
      accent: "#2f7a46",
      glow: "rgba(86, 155, 103, 0.22)",
    },
    eyebrow: "Coverage",
    img: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=900&q=85",
    imgPos: "center center",
    stat: { value: 58, suffix: "+", label: "Wilayas covered" },
    text: "Choose your wilaya on the map for a guide tailored to your climate zone.",
    detail: "Regional guidance calibrated to real field conditions.",
    chips: ["Localized", "Interactive map", "Zone-aware"],
  },
  {
    tone: {
      surface: "#f3eefb",
      border: "rgba(117, 93, 181, 0.18)",
      accent: "#6f58b0",
      glow: "rgba(135, 111, 197, 0.2)",
    },
    eyebrow: "Remote sensing",
    img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=85",
    imgPos: "center bottom",
    stat: { value: 6, suffix: "", label: "Satellite indices" },
    text: "NDVI, NDRE, and NDMI are calculated from Sentinel-2 imagery for each plot.",
    detail: "Sharper crop health reading without adding extra complexity.",
  },
  {
    tone: {
      surface: "#fbf3df",
      border: "rgba(188, 141, 42, 0.22)",
      accent: "#b67f18",
      glow: "rgba(217, 183, 88, 0.22)",
    },
    eyebrow: "Crop guidance",
    img: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=900&q=85",
    imgPos: "center top",
    stat: { value: 3, suffix: "", label: "Crop study groups" },
    text: "Recommendations adapted to soil pH, NPK, salinity, texture, and temperature.",
    detail: "Covers vegetables, cereals, and permanent crops with group-specific logic.",
  },
  {
    tone: {
      surface: "#eaf3fb",
      border: "rgba(71, 122, 176, 0.18)",
      accent: "#3a78a5",
      glow: "rgba(93, 152, 206, 0.2)",
    },
    eyebrow: "Climate logic",
    img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=900&q=85",
    imgPos: "center center",
    stat: { value: 4, suffix: "", label: "Climate zones" },
    text: "Tell, High Plateaus, Steppe, and Sahara - each zone has an exact protocol.",
    detail: "One system, four distinct strategies for Algeria's realities.",
  },
  {
    tone: {
      surface: "#ebf7f2",
      border: "rgba(53, 137, 104, 0.18)",
      accent: "#2e8e67",
      glow: "rgba(92, 179, 138, 0.2)",
    },
    eyebrow: "Sampling",
    img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=85",
    imgPos: "center center",
    stat: { value: 10, suffix: "+", label: "Sampling patterns" },
    text: "W, zigzag, or grid - the optimal pattern depends on your plot size.",
    detail: "Designed to keep sampling consistent before lab analysis begins.",
  },
  {
    tone: {
      surface: "#f8efe7",
      border: "rgba(176, 115, 74, 0.18)",
      accent: "#b2693a",
      glow: "rgba(199, 139, 90, 0.18)",
    },
    eyebrow: "Lab timing",
    img: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=900&q=85",
    imgPos: "center top",
    stat: { value: 48, suffix: "h", label: "Max preservation time" },
    text: "Maximum time between sampling and analysis to ensure reliable results.",
    detail: "Helps teams protect data quality from field to laboratory.",
  },
];

export default function Stats() {
  const [active, setActive] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setActive(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="sb" ref={ref}>
      <div className="container">

        <div className="sb__header">
          <span className="section-label">Key Numbers</span>
          <h2 className="section-title">
            Built for Algerian<br />agriculture
          </h2>
          <p className="section-subtitle sb__subtitle">
            A clearer snapshot of what the platform covers, measures, and helps teams act on in the field.
          </p>
        </div>

        <div className="sb__showcase">
          <FeatureCard card={cards[0]} active={active} />
          <div className="sb__grid">
            {cards.slice(1).map((card, index) => (
              <MetricCard
                key={card.stat.label}
                card={card}
                active={active}
                delay={0.08 + index * 0.06}
              />
            ))}
          </div>
        </div>

        <div className="sb__partners">
          <p className="sb__partners-title">Data Sources &amp; Partners</p>
          <div className="sb__partners-logos">
            {partners.map((p) => (
              <div key={p} className="sb__partner-logo"><span>{p}</span></div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

function FeatureCard({ card, active }) {
  return (
    <article
      className="sb__feature"
      style={{
        "--sb-surface": card.tone.surface,
        "--sb-border": card.tone.border,
        "--sb-accent": card.tone.accent,
        "--sb-glow": card.tone.glow,
      }}
    >
      <div className="sb__feature-copy">
        <span className="sb__eyebrow">{card.eyebrow}</span>
        <div className="sb__feature-stat">
          <span className="sb__feature-num">
            <Counter value={card.stat.value} suffix={card.stat.suffix} active={active} />
          </span>
          <span className="sb__feature-label">{card.stat.label}</span>
        </div>
        <p className="sb__feature-text">{card.text}</p>
        <p className="sb__feature-detail">{card.detail}</p>
        <div className="sb__chips">
          {card.chips.map((chip) => (
            <span key={chip} className="sb__chip">{chip}</span>
          ))}
        </div>
      </div>

      <div className="sb__feature-visual">
        <div className="sb__feature-orb" />
        <div className="sb__feature-image-wrap">
          <img
            src={card.img}
            alt=""
            className="sb__feature-image"
            style={{ objectPosition: card.imgPos }}
          />
        </div>
      </div>
    </article>
  );
}

function MetricCard({ card, active, delay }) {
  return (
    <article
      className="sb__card"
      style={{
        "--sb-surface": card.tone.surface,
        "--sb-border": card.tone.border,
        "--sb-accent": card.tone.accent,
        "--sb-glow": card.tone.glow,
        animationDelay: `${delay}s`,
      }}
    >
      <div className="sb__card-top">
        <span className="sb__eyebrow">{card.eyebrow}</span>
        <div className="sb__thumb-wrap">
          <img
            src={card.img}
            alt=""
            className="sb__thumb"
            style={{ objectPosition: card.imgPos }}
          />
        </div>
      </div>

      <div className="sb__card-body">
        <div className="sb__stat">
          <span className="sb__stat-num">
            <Counter value={card.stat.value} suffix={card.stat.suffix} active={active} />
          </span>
          <span className="sb__stat-lbl">{card.stat.label}</span>
        </div>
        <p className="sb__card-text">{card.text}</p>
        <p className="sb__card-detail">{card.detail}</p>
      </div>
    </article>
  );
}
