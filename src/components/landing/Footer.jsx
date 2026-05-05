import "./Footer.css";
import { LeafyGreen } from "lucide-react";
const Footer = () => {
  const footerLinks = {
    Explore: [
      { label: "Overview", href: "#hero" },
      { label: "Features", href: "#features" },
      { label: "Coverage", href: "#zones" },
    ],
    Insights: [
      { label: "Data insights", href: "#insights" },
      { label: "Testimonials", href: "#testimonials" },
      { label: "Back to top", href: "#hero" },
    ],
  };

  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="container footer__top-inner">
          <div className="footer__brand">
            <div className="footer__logo">
              <LeafyGreen size={22} strokeWidth={2.5} />
              <span className="logo-text">AGRIC</span>
            </div>
            <p className="footer__tagline">
              Soil sampling, crop guidance, and satellite monitoring for Algerian fields.
            </p>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section} className="footer__column">
              <h4 className="footer__column-title">{section}</h4>
              <ul className="footer__links">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="footer__link">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="footer__bottom">
        <div className="container footer__bottom-inner">
          <span className="footer__copyright">
            © {year} AGRIC. All rights reserved.
          </span>
          <div className="footer__legal">
            <a href="#features" className="footer__legal-link">Features</a>
            <a href="#zones" className="footer__legal-link">Coverage</a>
            <a href="#insights" className="footer__legal-link">Insights</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
