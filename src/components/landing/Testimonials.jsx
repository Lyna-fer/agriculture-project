import { useState } from "react";
import "./Testimonials.css";

const testimonials = [
  {
    quote:
      "Before, I used to sample randomly. Now the system tells me exactly how many points to take based on my area and where to place them — the lab results are much more reliable.",
    name: "Karim Bensalem",
    role: "Vegetable Farmer",
    company: "Wilaya of Blida",
    avatar: "KB",
    color: "#3a7d44",
    country: "🇩🇿 Algeria — Tell",
  },
  {
    quote:
      "The map is very easy to use. I draw my field, select tomato, and the system immediately gives me a zigzag pattern with 12 sampling points for my 2 hectares.",
    name: "Fatima Chérif",
    role: "Farm Operator",
    company: "Wilaya of Tipaza",
    avatar: "FC",
    color: "#2d6a4f",
    country: "🇩🇿 Algeria — Mediterranean",
  },
  {
    quote:
      "I work in a semi-arid zone. The system alerted me that my salinity was too high before I even went to the lab — thanks to the satellite indices. It saved me from a bad harvest.",
    name: "Ahmed Mebarki",

    role: "Farmer",
    company: "Wilaya of Tiaret",
    avatar: "AM",
    color: "#1b4332",
    country: "🇩🇿 Algeria — High Plateaus",
  },
  {
    quote:
      "The guide clearly explains: depth 0-20 cm for the surface layer, then 20-40 cm. It also tells me which parameters to prioritize for my zucchini crop. It's exactly what I needed.",
    name: "Nadia Belkacem",
    role: "Agricultural Engineer",
    company: "DSA Wilaya of Sétif",
    avatar: "NB",
    color: "#4a7c59",
    country: "🇩🇿 Algeria — High Plateaus",
  },
];

const Testimonials = () => {
  const [active, setActive] = useState(0);

  return (
    <section className="testimonials">
      <div className="testimonials__bg" />
      <div className="container">
        <div className="testimonials__inner">
          <div className="testimonials__left">
            <span className="section-label">Testimonials</span>
            <h2 className="section-title">
              What Algerian Farmers
              <br />
              Say About Us
            </h2>
            <p className="section-subtitle">
              Algerian farmers from different regions share their experience
              with the personalized soil sampling guide.
            </p>

            <div className="testimonials__avatars">
              {testimonials.map((t, i) => (
                <button
                  key={t.name}
                  className={`testimonials__avatar-btn ${i === active ? "testimonials__avatar-btn--active" : ""}`}
                  onClick={() => setActive(i)}
                >
                  <div
                    className="testimonials__avatar"
                    style={{ background: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div className="testimonials__avatar-info">
                    <span className="testimonials__avatar-name">{t.name}</span>
                    <span className="testimonials__avatar-role">
                      {t.company}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <a
              href="#"
              className="btn-outline-green"
              style={{ marginTop: "32px" }}
            >
              View All Case Studies
            </a>
          </div>

          <div className="testimonials__right">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className={`testimonials__card ${i === active ? "testimonials__card--active" : ""}`}
              >
                <div className="testimonials__card-header">
                  <div className="testimonials__stars">
                    {"★★★★★".split("").map((s, j) => (
                      <span key={j} className="testimonials__star">
                        {s}
                      </span>
                    ))}
                  </div>
                  <span className="testimonials__country">{t.country}</span>
                </div>

                <div className="testimonials__quote-mark">"</div>
                <p className="testimonials__quote">{t.quote}</p>

                <div className="testimonials__author">
                  <div
                    className="testimonials__author-avatar"
                    style={{ background: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <span className="testimonials__author-name">{t.name}</span>
                    <span className="testimonials__author-role">
                      {t.role} · {t.company}
                    </span>
                  </div>
                </div>

                <div
                  className="testimonials__card-decoration"
                  style={{ background: `${t.color}10` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
