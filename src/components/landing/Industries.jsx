import { useEffect, useRef, useState } from "react";
import "./Industries.css";

const zones = [
  {
    id: 1,
    label: "01",
    tag: "TELL — NORTH",
    title: "Mediterranean Coast",
    desc: "Coastal wilayas like Algiers, Oran, and Annaba enjoy a mild Mediterranean climate. Loamy soils with pH 6.5–7.5 are ideal for high-yield vegetables. Tomato, pepper, lettuce, and zucchini are highly recommended with 2–3 sampling points per hectare.",
    detail: "Recommended analyses: NPK, organic matter, pH, CaCO₃",
    img: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=85",
    accent: "#5abf6a",
  },
  {
    id: 2,
    label: "02",
    tag: "HIGH PLATEAUS",
    title: "Semi-Arid Highlands",
    desc: "Wilayas of Sétif, Tiaret, and Djelfa sit on vast cereal plains at altitude. Semi-arid conditions demand careful monitoring of organic matter and water stress. Sampling depth increases to 40 cm to assess deep moisture retention.",
    detail: "Recommended analyses: NPK, organic matter, pH, water retention",
    img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=85",
    accent: "#4db87a",
  },
  {
    id: 3,
    label: "03",
    tag: "STEPPE REGION",
    title: "Arid Grasslands",
    desc: "The steppe wilayas — Laghouat, El Bayadh, Naâma — face harsh aridity and wind erosion. EC (salinity) analysis is mandatory before any vegetable crop. Adapted species like onion, garlic, and potato can succeed with proper irrigation management.",
    detail: "Recommended analyses: EC, pH, NPK, sodium adsorption ratio",
    img: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200&q=85",
    accent: "#d4a843",
  },
  {
    id: 4,
    label: "04",
    tag: "SAHARAN REGION",
    title: "Desert Oasis Farming",
    desc: "Extreme heat and scarce rainfall define Ghardaïa, Ouargla, and Adrar. Oasis agriculture under palm shade enables date, tomato, and pepper cultivation. Controlled drip irrigation and deep soil analysis are non-negotiable prerequisites.",
    detail: "Recommended analyses: EC, pH, calcium, magnesium, micronutrients",
    img: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&q=85",
    accent: "#e07b39",
  },
  {
    id: 5,
    label: "05",
    tag: "ALL 58 WILAYAS",
    title: "Nationwide Coverage",
    desc: "The system covers all 58 Algerian wilayas with a personalized guide for every plot. GPS coordinates determine the exact climate zone, soil type, and season — generating a custom sampling protocol with the right number of points, depth, and analyses.",
    detail: "Full national database — updated each growing season",
    img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=85",
    accent: "#5abf6a",
  },
];

export default function Industries() {
  const textRefs = useRef([]);
  const imgRefs = useRef([]);
  const [activeZone, setActiveZone] = useState(0);

  useEffect(() => {
    let raf = null;

    const update = () => {
      const vh = window.innerHeight;

      const bells = textRefs.current.map((el) => {
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const raw = 1 - rect.bottom / (vh + rect.height);
        const progress = Math.max(0, Math.min(1, raw));
        return Math.sin(progress * Math.PI);
      });

      let maxIdx = 0;
      let maxValue = -1;
      bells.forEach((bell, idx) => {
        if (bell > maxValue) {
          maxValue = bell;
          maxIdx = idx;
        }
      });
      setActiveZone(maxIdx);

      textRefs.current.forEach((el, i) => {
        if (!el) return;
        const bell = bells[i];
        const opacity = Math.max(0.45, bell);
        const translateY = 18 - bell * 18;
        const scale = 0.97 + 0.03 * bell;

        el.style.opacity = opacity.toFixed(3);
        el.style.transform = `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      });

      imgRefs.current.forEach((img, i) => {
        if (!img) return;
        img.style.opacity = bells[i].toFixed(3);
      });
    };

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="ind">
      <div className="ind__container">
        <div className="ind__header">
          <span className="section-label ind__label">
            <span />
            Climate Zones
          </span>
          <h2 className="ind__title">
            A guide tailored to every
            <br />
            region of Algeria
          </h2>
          <p className="ind__subtitle">
            The number of sampling points, depth, and required analyses vary
            according to the climate zone of your wilaya.
          </p>
          <div className="ind__highlights">
            <span>58 Wilayas Covered</span>
            <span>4 Climate Families</span>
            <span>Custom Protocol per Plot</span>
          </div>
        </div>

        <div className="ind__cols">
          <div className="ind__left">
            {zones.map((z, i) => (
              <div
                key={z.id}
                className={`ind__item ${activeZone === i ? "ind__item--active" : ""}`}
                ref={(el) => (textRefs.current[i] = el)}
                style={{ opacity: 0, transform: "translateY(18px) scale(0.97)" }}
              >
                <span className="ind__item-tag">{z.tag}</span>
                <h3 className="ind__item-title">{z.title}</h3>
                <p className="ind__item-desc">{z.desc}</p>
                <p className="ind__item-detail" style={{ color: z.accent }}>
                  {z.detail}
                </p>
                <a
                  href="#"
                  className="ind__item-link"
                  style={{ color: z.accent }}
                >
                  View sampling guide
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7H11.5M11.5 7L8 3.5M11.5 7L8 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              </div>
            ))}
          </div>

          <div className="ind__right">
            <div className="ind__sticky">
              <div className="ind__img-wrap">
                {zones.map((z, i) => (
                  <img
                    key={z.id}
                    ref={(el) => (imgRefs.current[i] = el)}
                    src={z.img}
                    alt={z.title}
                    className="ind__img"
                    style={{ opacity: i === 0 ? 1 : 0 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
