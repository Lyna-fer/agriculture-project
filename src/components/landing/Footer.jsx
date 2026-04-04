import "./Footer.css";

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
      "About AGRIVI",
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
              <svg width="130" height="36" viewBox="0 0 130 36" fill="none">
                <path d="M8 30L18 6L28 30H23L18 18L13 30H8Z" fill="#4caf50" />
                <path
                  d="M25 22H32C34 22 35 20.5 35 19C35 17.5 34 16 32 16H25V22Z"
                  fill="#74c69d"
                />
                <text
                  x="40"
                  y="25"
                  fontFamily="Manrope"
                  fontWeight="800"
                  fontSize="20"
                  fill="white"
                >
                  AGRIVI
                </text>
              </svg>
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
            © 2024 AGRIVI d.o.o. All rights reserved.
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
