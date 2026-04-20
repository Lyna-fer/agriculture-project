import { useState } from "react";
import "./Products.css";

const products = [
  {
    id: "sampling-guide",
    badge: "Step 1",
    step: "01",
    name: "Draw the parcel",
    kicker: "Mark the field directly on the map.",
    description:
      "The farmer traces the parcel on the map and can also select the wilaya, commune, and plot area. This first action anchors the entire decision process to the real field location.",
    features: [
      "Interactive map to draw the parcel boundary",
      "Location-based input using wilaya and commune",
      "Area captured before the sampling plan is generated",
      "Field context stored for the next decision step",
    ],
    metrics: [
      { value: "Map", label: "Parcel input" },
      { value: "Area", label: "Field size" },
      { value: "Zone", label: "Location data" },
    ],
    accent: "#5bbf6b",
    surface: "#edf8ef",
    ink: "#14311a",
    image:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=900&q=85",
    imagePosition: "center center",
    spotlightTitle: "Starting point",
    spotlightText: "The parcel shape and location become the basis for every recommendation that follows.",
    panelTitle: "Field context",
    panelRows: ["Parcel traced", "Area recorded", "Location selected"],
  },
  {
    id: "vegetation-indices",
    badge: "Step 2",
    step: "02",
    name: "Generate the sampling protocol",
    kicker: "Turn parcel data into a field-ready plan.",
    description:
      "Once the parcel is known, the system combines region, season, crop type, and plot size to generate a personalized soil sampling guide with the right number of points, depth, and pattern.",
    features: [
      "Sampling points adapted to the parcel size",
      "Depth adjusted to the crop and soil context",
      "Pattern guidance such as zigzag, W, or grid",
      "Clear instructions for field execution",
    ],
    metrics: [
      { value: "Guide", label: "Sampling plan" },
      { value: "Depth", label: "Collection layer" },
      { value: "Pattern", label: "Field route" },
    ],
    accent: "#69c7b2",
    surface: "#eaf8f4",
    ink: "#10302a",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=85",
    imagePosition: "center bottom",
    spotlightTitle: "Decision support",
    spotlightText: "The platform transforms plot information into a practical protocol the farmer can follow in the field.",
    panelTitle: "Protocol summary",
    panelRows: ["Points: adjusted", "Depth: assigned", "Pattern: selected"],
  },
  {
    id: "crop-recommendation",
    badge: "Step 3",
    step: "03",
    name: "Get crop recommendations",
    kicker: "Use soil properties to guide the next crop choice.",
    description:
      "In the second phase of the workflow, the farmer provides soil properties such as pH, organic matter, texture, and salinity. The system then proposes crop recommendations that fit the field conditions.",
    features: [
      "Input soil properties and field constraints",
      "Crop suggestions adapted to the three case studies",
      "Warnings for pH, salinity, or fertility issues",
      "Simple explanations to support the farmer's decision",
    ],
    metrics: [
      { value: "3", label: "Crop groups" },
      { value: "Fit", label: "Compatibility" },
      { value: "Advice", label: "Final output" },
    ],
    accent: "#e3a54d",
    surface: "#fcf4e6",
    ink: "#37240d",
    image:
      "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=900&q=85",
    imagePosition: "center center",
    spotlightTitle: "Final decision",
    spotlightText: "The user ends with a practical recommendation that connects soil diagnosis to crop selection.",
    panelTitle: "Recommendation view",
    panelRows: ["Vegetables", "Cereals", "Permanent crops"],
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
          <h2 className="section-title">From parcel mapping to personalized agricultural advice</h2>
          <p className="section-subtitle">
            The workflow follows the real project logic: map the parcel, generate the sampling
            protocol, then translate soil properties into crop recommendations.
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
