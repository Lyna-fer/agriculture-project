import "./Footer.css";
import { LeafyGreen } from "lucide-react";
const Footer = () => {
  const footerLinks = {
    Products: [
      "360 Farm Enterprise",
      "360 Agriculture Supply Chain",
      "360 Traceability",
      "AI Engage Inputs",
      "AI Engage Supply Chain",
      "AI Engage Public Sector",
    ],
    Industries: [
      "Farming",
      "Food & Beverages",
      "Retail",
      "Input Manufacturers",
      "Public Sector",
    ],
    Resources: [
      "ROI Calculator",
      "Farm Digitalization Score",
      "Blog",
      "News",
      "Case Studies",
      "eBooks",
      "Webinars",
    ],
    Company: [
      "About AGRIC",
      "Newsroom",
      "Careers",
      "Partner Program",
      "Contact Us",
    ],
  };

  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="container footer__top-inner">
          <div className="footer__brand">
            <div className="footer__logo">
              <LeafyGreen
                size={22}
                strokeWidth={2.5}
              />
              <span className="logo-text">AGRIC</span>
            </div>
            <p className="footer__tagline">
              Global digital agriculture solutions supporting the entire
              agrifood value chain.
            </p>

            <div className="footer__socials">
              {["LinkedIn", "Twitter", "YouTube", "Facebook"].map((social) => (
                <a key={social} href="#" className="footer__social">
                  <span>{social[0]}</span>
                </a>
              ))}
            </div>

            <div className="footer__awards">
              <span className="footer__award">🏆 Forbes AgTech 2024</span>
              <span className="footer__award">⭐ Gartner Cool Vendor</span>
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section} className="footer__column">
              <h4 className="footer__column-title">{section}</h4>
              <ul className="footer__links">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="footer__link">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="footer__newsletter">
        <div className="container footer__newsletter-inner">
          <div>
            <h4 className="footer__newsletter-title">
              Stay ahead with AgriTech insights
            </h4>
            <p className="footer__newsletter-sub">
              Weekly updates on digital agriculture trends & best practices.
            </p>
          </div>
          <div className="footer__newsletter-form">
            <input
              type="email"
              placeholder="Enter your work email"
              className="footer__newsletter-input"
            />
            <button className="footer__newsletter-btn">Subscribe</button>
          </div>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <span className="footer__copyright">
            © 2026 AGRIC d.o.o. All rights reserved.
          </span>
          <div className="footer__legal">
            {[
              "Privacy Policy",
              "Terms of Service",
              "Cookie Policy",
              "GDPR",
            ].map((item) => (
              <a key={item} href="#" className="footer__legal-link">
                {item}
              </a>
            ))}
          </div>
          <div className="footer__flags">
            {["🇺🇸", "🇬🇧", "🇩🇪", "🇫🇷", "🇪🇸", "🇵🇱"].map((flag, i) => (
              <span key={i} className="footer__flag">
                {flag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
