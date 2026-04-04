import { useState } from "react";
import "./Products.css";

const products = [
  {
    id: "ai-engage",
    badge: "PHASE 1",
    name: "Sampling Guide",
    description:
      "The farmer draws their plot on the map or selects their wilaya and commune. The system automatically calculates the number of sampling points, recommended depth and optimal pattern (zigzag, W, grid) based on area, crop and climate zone.",
    features: [
      "Interactive map — draw or select the plot",
      "Automatic calculation of sampling points by hectare",
      "Zigzag / W / grid pattern recommended",
      "Depth tailored to crop and soil type",
    ],
    color: "#1a6b2e",
    accent: "#4caf50",
    image:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=700&q=80",
    bgColor: "linear-gradient(135deg, #0d2e14 0%, #1a4d22 100%)",
  },
  {
    id: "farm-enterprise",
    badge: "SATELLITE",
    name: "Vegetation Indices",
    description:
      "After selecting the plot, the system retrieves real satellite indices via AlphaEarth (Sentinel-2). NDVI for vegetation health, NDMI for soil moisture, NDRE for chlorophyll — with 12-month history and automatic alerts.",
    features: [
      "NDVI — real-time vegetation health",
      "NDMI — soil moisture and water stress",
      "NDRE — chlorophyll content",
      "12-month history + field alerts",
    ],
    color: "#2d6a4f",
    accent: "#52b788",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
    bgColor: "linear-gradient(135deg, #0a2318 0%, #1a3d2e 100%)",
  },
  {
    id: "traceability",
    badge: "PHASE 2",
    name: "Crop Recommendation",
    description:
      "The farmer enters soil properties: pH, organic matter, texture, salinity, temperature. The system calculates a compatibility score for each vegetable crop and displays personalized recommendations with diagnostics and alerts.",
    features: [
      "Enter pH, OM, texture, salinity, nitrogen",
      "Compatibility score per crop",
      "Alerts for pH too acid / alkaline / salinity",
      "Top 6 recommended crops with explanation",
    ],
    color: "#1b4332",
    accent: "#74c69d",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80",
    bgColor: "linear-gradient(135deg, #081c12 0%, #163327 100%)",
  },
];

const Products = () => {
  const [activeProduct, setActiveProduct] = useState(0);
  const product = products[activeProduct];

  return (
    <section className="products">
      <div className="container">

        <div className="products__header">
          <span className="section-label">Our Features</span>
          <h2 className="section-title">How Does AGRIC Work?</h2>
          <p className="section-subtitle">
            A two-phase decision support system — first a personalized sampling
            guide based on your plot, then crop recommendations based on your
            soil properties.
          </p>
        </div>


        <div className="products__tabs">
          {products.map((p, i) => (
            <button
              key={p.id}
              className={`products__tab ${i === activeProduct ? "products__tab--active" : ""}`}
              onClick={() => setActiveProduct(i)}
              style={
                i === activeProduct
                  ? { borderColor: p.accent, color: p.accent }
                  : {}
              }
            >
              <span className="products__tab-badge">{p.badge}</span>
              <span className="products__tab-name">{p.name}</span>
            </button>
          ))}
        </div>

      
        <div
          className="products__showcase"
          style={{ background: product.bgColor }}
        >
          <div className="products__showcase-content">
            <div className="products__showcase-text">
              <span
                className="products__showcase-badge"
                style={{
                  background: `${product.accent}20`,
                  color: product.accent,
                }}
              >
                {product.badge} — {product.name}
              </span>
              <h3 className="products__showcase-title">{product.name}</h3>
              <p className="products__showcase-desc">{product.description}</p>

              <ul className="products__features">
                {product.features.map((f) => (
                  <li key={f} className="products__feature">
                    <span
                      className="products__feature-check"
                      style={{ background: product.accent }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="products__showcase-actions">
                <a
                  href="#"
                  className="btn-primary"
                  style={{ background: product.accent, color: "#0d2e14" }}
                >
                  Book a Meeting
                </a>
                <a
                  href="#"
                  className="products__learn-more"
                  style={{ color: product.accent }}
                >
                  Learn More
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8H13M13 8L9 4M13 8L9 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <div className="products__showcase-image">
              <div className="products__image-wrapper">
                <img src={product.image} alt={product.name} />
                <div className="products__image-overlay" />
            
                <div className="products__dashboard-card">
                  <div className="products__dashboard-header">
                    <div
                      className="products__dashboard-dot"
                      style={{ background: product.accent }}
                    />
                    <span>Live Dashboard</span>
                  </div>
                  <div className="products__dashboard-stats">
                    <div>
                      <span className="products__dashboard-val">0.72</span>
                      <span className="products__dashboard-lbl">
                        NVDI actuel
                      </span>
                    </div>
                    <div>
                      <span className="products__dashboard-val">12</span>
                      <span className="products__dashboard-lbl">
                        Points sol
                      </span>
                    </div>
                    <div>
                      <span className="products__dashboard-val">3 ha</span>
                      <span className="products__dashboard-lbl">Surface</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Products;
