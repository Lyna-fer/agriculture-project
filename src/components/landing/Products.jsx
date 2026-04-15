import { useState } from "react";
import "./Products.css";

const products = [
  {
    id: "sampling-guide",
    badge: "Phase 1",
    step: "01",
    name: "Sampling Guide",
    kicker: "Map your field and generate the right collection plan.",
    description:
      "The farmer draws a plot on the map or selects the wilaya and commune. The system calculates sampling points, target depth, and the best collection pattern based on area, crop, and climate zone.",
    features: [
      "Interactive map to draw or select the plot",
      "Automatic number of sampling points per hectare",
      "Recommended zigzag, W, or grid collection path",
      "Depth adjusted to crop and local soil conditions",
    ],
    metrics: [
      { value: "12", label: "Sampling points" },
      { value: "0-40 cm", label: "Depth range" },
      { value: "W/Grid", label: "Pattern logic" },
    ],
    accent: "#5bbf6b",
    surface: "#edf8ef",
    ink: "#14311a",
    image:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=900&q=85",
    imagePosition: "center center",
    spotlightTitle: "Field setup",
    spotlightText: "Build a plot-specific protocol before anyone enters the field.",
    panelTitle: "Protocol Preview",
    panelRows: ["3.0 ha plot", "12 points needed", "20 cm top layer"],
  },
  {
    id: "vegetation-indices",
    badge: "Satellite",
    step: "02",
    name: "Vegetation Indices",
    kicker: "Read crop vigor and moisture directly from imagery.",
    description:
      "After plot selection, the platform retrieves satellite indicators from Sentinel-2. NDVI, NDMI, and NDRE reveal vegetation health, moisture stress, and chlorophyll behavior with a rolling history.",
    features: [
      "NDVI for vegetation performance",
      "NDMI for moisture and water-stress monitoring",
      "NDRE for chlorophyll insight",
      "Historical trends and alert-friendly readings",
    ],
    metrics: [
      { value: "6", label: "Indices tracked" },
      { value: "12 mo", label: "History window" },
      { value: "Live", label: "Signal refresh" },
    ],
    accent: "#69c7b2",
    surface: "#eaf8f4",
    ink: "#10302a",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=85",
    imagePosition: "center bottom",
    spotlightTitle: "Remote sensing",
    spotlightText: "See vegetation changes before they become expensive field issues.",
    panelTitle: "Index Snapshot",
    panelRows: ["NDVI 0.72", "NDMI moderate", "Stress low"],
  },
  {
    id: "crop-recommendation",
    badge: "Phase 2",
    step: "03",
    name: "Crop Recommendation",
    kicker: "Turn soil results into practical crop decisions.",
    description:
      "The farmer enters soil properties such as pH, organic matter, texture, salinity, and temperature. The system scores crop compatibility and presents tailored recommendations with reasoning and alerts.",
    features: [
      "Input pH, organic matter, texture, salinity, and nutrients",
      "Compatibility score for each crop option",
      "Warnings for acidity, alkalinity, and salinity issues",
      "Top recommendations with plain-language explanations",
    ],
    metrics: [
      { value: "Top 6", label: "Suggested crops" },
      { value: "Score", label: "Compatibility model" },
      { value: "Alerts", label: "Risk flags" },
    ],
    accent: "#e3a54d",
    surface: "#fcf4e6",
    ink: "#37240d",
    image:
      "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=900&q=85",
    imagePosition: "center center",
    spotlightTitle: "Decision layer",
    spotlightText: "Move from raw test values to crops that fit the land better.",
    panelTitle: "Recommendation View",
    panelRows: ["Pepper 91%", "Tomato 86%", "Zucchini 82%"],
  },
];

export default function Products() {
  const [activeProduct, setActiveProduct] = useState(0);
  const product = products[activeProduct];

  return (
    <section className="products">
      <div className="container">
        <div className="products__header">
          <span className="section-label">How It Works</span>
          <h2 className="section-title">A clearer path from field selection to crop decision</h2>
          <p className="section-subtitle">
            The experience is designed like a guided workflow: define the plot, read the field
            conditions, then convert results into recommendations that are actually usable.
          </p>
        </div>

        <div className="products__layout">
          <div className="products__rail" role="tablist" aria-label="How AGRIC works">
            {products.map((item, index) => (
              <button
                key={item.id}
                className={`products__step ${index === activeProduct ? "products__step--active" : ""}`}
                onClick={() => setActiveProduct(index)}
                style={
                  index === activeProduct
                    ? {
                        "--products-accent": item.accent,
                        "--products-surface": item.surface,
                        "--products-ink": item.ink,
                      }
                    : undefined
                }
              >
                <span className="products__step-num">{item.step}</span>
                <span className="products__step-copy">
                  <span className="products__step-badge">{item.badge}</span>
                  <span className="products__step-name">{item.name}</span>
                  <span className="products__step-kicker">{item.kicker}</span>
                </span>
              </button>
            ))}
          </div>

          <article
            className="products__spotlight"
            style={{
              "--products-accent": product.accent,
              "--products-surface": product.surface,
              "--products-ink": product.ink,
            }}
          >
            <div className="products__spotlight-copy">
              <span className="products__spotlight-badge">
                {product.badge} / Step {product.step}
              </span>
              <h3 className="products__spotlight-title">{product.name}</h3>
              <p className="products__spotlight-desc">{product.description}</p>

              <div className="products__metric-row">
                {product.metrics.map((metric) => (
                  <div key={metric.label} className="products__metric-card">
                    <span className="products__metric-value">{metric.value}</span>
                    <span className="products__metric-label">{metric.label}</span>
                  </div>
                ))}
              </div>

              <ul className="products__features">
                {product.features.map((feature) => (
                  <li key={feature} className="products__feature">
                    <span className="products__feature-check">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="products__visual">
              <div className="products__visual-glow" />
              <div className="products__image-shell">
                <img
                  src={product.image}
                  alt={product.name}
                  className="products__image"
                  style={{ objectPosition: product.imagePosition }}
                />
                <div className="products__image-overlay" />
              </div>

              <div className="products__floating-card products__floating-card--summary">
                <span className="products__floating-label">{product.spotlightTitle}</span>
                <p>{product.spotlightText}</p>
              </div>

              <div className="products__floating-card products__floating-card--panel">
                <div className="products__floating-header">
                  <span className="products__floating-dot" />
                  <span>{product.panelTitle}</span>
                </div>
                <div className="products__floating-list">
                  {product.panelRows.map((row) => (
                    <span key={row}>{row}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
