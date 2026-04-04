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

const partners = ["INRAA Algérie", "FAO", "Sentinel-2 / ESA", "Open-Meteo", "MADR", "CRSTRA"];

const cards = [
  {
    bg: "#d1e8d4",
    img: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=900&q=85",
    imgPos: "center center",
    stat: { value: 58, suffix: "+", label: "Wilayas couvertes" },
    text: "Choisissez votre wilaya sur la carte — guide personnalisé selon votre zone climatique.",
  },
  {
    bg: "#dcd3f0",
    img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=85",
    imgPos: "center bottom",
    stat: { value: 6, suffix: "", label: "Indices satellites" },
    text: "NDVI, NDRE et NDMI calculés depuis l'imagerie Sentinel-2 pour chaque parcelle.",
  },
  {
    bg: "#f5e9c4",
    img: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=900&q=85",
    imgPos: "center top",
    stat: { value: 30, suffix: "+", label: "Cultures maraîchères" },
    text: "Recommandations adaptées à votre pH, texture et matière organique du sol.",
  },
  {
    bg: "#c8dced",
    img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=900&q=85",
    imgPos: "center center",
    stat: { value: 4, suffix: "", label: "Zones climatiques" },
    text: "Tell, Hauts Plateaux, Steppe et Sahara — chaque zone a son protocole exact.",
  },
  {
    bg: "#c4e8d8",
    img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=85",
    imgPos: "center center",
    stat: { value: 10, suffix: "+", label: "Schémas d'échantillonnage" },
    text: "En W, en zigzag, en grille — le schéma optimal selon la taille de votre parcelle.",
  },
  {
    bg: "#f0dfd0",
    img: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=900&q=85",
    imgPos: "center top",
    stat: { value: 48, suffix: "h", label: "Délai max conservation" },
    text: "Délai maximal entre prélèvement et analyse pour garantir la fiabilité des résultats.",
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
            Conçu pour l'agriculture<br />algérienne
          </h2>
        </div>

     
        <div className="sb__grid">
         
          <div className="sb__col sb__col--1">
            <Card card={cards[0]} active={active} delay={0} />
            <Card card={cards[3]} active={active} delay={0.15} />
          </div>

         
          <div className="sb__col sb__col--2">
            <Card card={cards[1]} active={active} delay={0.08} />
            <Card card={cards[4]} active={active} delay={0.22} />
          </div>

         
          <div className="sb__col sb__col--3">
            <Card card={cards[2]} active={active} delay={0.16} />
            <Card card={cards[5]} active={active} delay={0.30} />
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

function Card({ card, active, delay }) {
  return (
    <div
      className="sb__card"
      style={{ background: card.bg, animationDelay: `${delay}s` }}
    >
     
      <div className="sb__card-img-wrap">
        <img
          src={card.img}
          alt=""
          className="sb__card-img"
          style={{ objectPosition: card.imgPos }}
        />
      </div>

     
      <div className="sb__card-body">
        <div className="sb__stat">
          <span className="sb__stat-num">
            <Counter value={card.stat.value} suffix={card.stat.suffix} active={active} />
          </span>
          <span className="sb__stat-lbl">{card.stat.label}</span>
        </div>
        <p className="sb__card-text">{card.text}</p>
      </div>
    </div>
  );
}