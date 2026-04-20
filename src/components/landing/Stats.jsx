import "./Stats.css";

const partners = ["INRAA Algeria", "FAO", "Sentinel-2 / ESA", "Open-Meteo", "MADR", "CRSTRA"];

const cards = [
  {
    tone: {
      surface: "#eef6ef",
      border: "rgba(58, 125, 68, 0.18)",
      accent: "#2f7a46",
      glow: "rgba(86, 155, 103, 0.22)",
    },
    eyebrow: "Local relevance",
    img: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=900&q=85",
    imgPos: "center center",
    title: "Built for Algerian conditions",
    text: "The platform reflects wilayas, climate zones, and field realities instead of generic agricultural advice.",
    detail: "Designed around the variability that shapes real farming decisions.",
    chips: ["Wilaya context", "Climate zones", "Field realism"],
  },
  {
    tone: {
      surface: "#f3eefb",
      border: "rgba(117, 93, 181, 0.18)",
      accent: "#6f58b0",
      glow: "rgba(135, 111, 197, 0.2)",
    },
    eyebrow: "Integrated data",
    img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=85",
    imgPos: "center bottom",
    title: "One view of the field",
    text: "Soil, climate, agronomic, and spatial information are brought together to support a more complete diagnosis.",
    detail: "Different sources, one decision layer.",
  },
  {
    tone: {
      surface: "#fbf3df",
      border: "rgba(188, 141, 42, 0.22)",
      accent: "#b67f18",
      glow: "rgba(217, 183, 88, 0.22)",
    },
    eyebrow: "Sampling intelligence",
    img: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=900&q=85",
    imgPos: "center top",
    title: "Sampling logic",
    text: "The system estimates the most suitable depth, pattern, and point distribution for the parcel and crop context.",
    detail: "A clearer basis for lab work and field planning.",
  },
  {
    tone: {
      surface: "#eaf3fb",
      border: "rgba(71, 122, 176, 0.18)",
      accent: "#3a78a5",
      glow: "rgba(93, 152, 206, 0.2)",
    },
    eyebrow: "Crop suitability",
    img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=900&q=85",
    imgPos: "center center",
    title: "Crop-fit assessment",
    text: "Soil properties and crop requirements are matched to highlight more suitable production options.",
    detail: "Helpful for vegetables, cereals, and permanent crops.",
  },
  {
    tone: {
      surface: "#ebf7f2",
      border: "rgba(53, 137, 104, 0.18)",
      accent: "#2e8e67",
      glow: "rgba(92, 179, 138, 0.2)",
    },
    eyebrow: "Operational output",
    img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=85",
    imgPos: "center center",
    title: "Field-ready guidance",
    text: "The result is a practical output that supports both sampling decisions and broader crop planning.",
    detail: "A concise decision layer rather than a technical report alone.",
  },
  {
    tone: {
      surface: "#f8efe7",
      border: "rgba(176, 115, 74, 0.18)",
      accent: "#b2693a",
      glow: "rgba(199, 139, 90, 0.18)",
    },
    eyebrow: "Decision support",
    img: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=900&q=85",
    imgPos: "center top",
    title: "Clearer agricultural choices",
    text: "The platform connects field diagnosis with crop choice so the next decision is easier to justify.",
    detail: "A bridge between soil data and agricultural planning.",
  },
];

export default function Stats() {
  return (
    <section className="sb">
      <div className="container">

        <div className="sb__header">
          <span className="section-label">Platform Value</span>
          <h2 className="section-title">
            A decision support platform built for Algerian agriculture
          </h2>
          <p className="section-subtitle sb__subtitle">
            The system brings together parcel location, soil data, climate context, and crop requirements to generate practical guidance for sampling and crop planning.
          </p>
        </div>

        <div className="sb__showcase">
          <FeatureCard card={cards[0]} />
          <div className="sb__grid">
            {cards.slice(1).map((card, index) => (
              <MetricCard
                key={card.title}
                card={card}
                delay={0.08 + index * 0.06}
              />
            ))}
          </div>
        </div>

        <div className="sb__partners">
          <p className="sb__partners-title">Data sources and partners</p>
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

function FeatureCard({ card }) {
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
          <span className="sb__feature-num">{card.title}</span>
          <span className="sb__feature-label">{card.eyebrow}</span>
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

function MetricCard({ card, delay }) {
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
          <span className="sb__stat-num">{card.title}</span>
          <span className="sb__stat-lbl">{card.eyebrow}</span>
        </div>
        <p className="sb__card-text">{card.text}</p>
        <p className="sb__card-detail">{card.detail}</p>
      </div>
    </article>
  );
}
