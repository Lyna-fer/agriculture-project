import { useState, useEffect } from "react";
import "./Navbar.css";
import { LeafyGreen } from "lucide-react";
const Navbar = ({ onEnter }) => {
  const [scrolled, setScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const menuItems = [
    {
      label: "Products",
      children: [
        {
          group: "AGRIC 360 FMS",
          items: [
            {
              label: "360 Farm Enterprise",
              desc: "Market-leading farm management platform",
            },
            {
              label: "360 Agriculture Supply Chain",
              desc: "End-to-end supply chain visibility",
            },
            {
              label: "360 Traceability",
              desc: "Farm-to-fork food traceability",
            },
          ],
        },
        {
          group: "AGRIVI AI Engage",
          items: [
            { label: "Engage Inputs", desc: "AI-driven agri-input engagement" },
            {
              label: "Engage Supply Chain",
              desc: "Smart supply chain engagement",
            },
            {
              label: "Engage Public Sector",
              desc: "Government & public advisory AI",
            },
          ],
        },
      ],
    },
    {
      label: "Industries",
      children: [
        {
          group: "Sectors",
          items: [
            { label: "Farming", desc: "Enterprise farm operations" },
            { label: "Food & Beverages", desc: "F&B production management" },
            { label: "Retail", desc: "Retail supply chain traceability" },
            {
              label: "Input Manufacturers",
              desc: "Agri-input company solutions",
            },
            { label: "Public Sector", desc: "Government agriculture programs" },
          ],
        },
      ],
    },
    {
      label: "Resources",
      children: [
        {
          group: "Learn",
          items: [
            {
              label: "ROI Calculator",
              desc: "Estimate your potential savings",
            },
            {
              label: "Farm Digitalization Score",
              desc: "Free assessment tool",
            },
            { label: "Blog", desc: "Agriculture insights & tips" },
            { label: "Case Studies", desc: "Real-world success stories" },
            { label: "eBooks & Webinars", desc: "In-depth guides and events" },
          ],
        },
      ],
    },
    { label: "Newsroom" },
  ];

  return (
    <nav className={`lnav ${scrolled ? "lnav--scrolled" : ""}`}>
      <div className="lnav__inner">
        <a href="#" className="lnav__logo">
          <LeafyGreen
            size={22}
            color={scrolled ? "#3a7d44" : "white"}
            // fill={scrolled ? "#5cb85c" : "transparent"}
            strokeWidth={2.5}
          />
          <span className="logo-text">AGRIC</span>
        </a>

        <ul className="lnav__menu">
          {menuItems.map((item) => (
            <li
              key={item.label}
              className={`lnav__item ${item.children ? "lnav__item--has-children" : ""} ${activeMenu === item.label ? "lnav__item--active" : ""}`}
              onMouseEnter={() => item.children && setActiveMenu(item.label)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <a href="#" className="lnav__link">
                {item.label}
                {item.children && (
                  <svg
                    className="lnav__chevron"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M3 5L7 9L11 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </a>

              {item.children && (
                <div className="lnav__dropdown">
                  <div className="lnav__dropdown-inner">
                    {item.children.map((group) => (
                      <div key={group.group} className="lnav__dropdown-group">
                        <span className="lnav__dropdown-group-label">
                          {group.group}
                        </span>
                        <ul className="lnav__dropdown-list">
                          {group.items.map((child) => (
                            <li key={child.label}>
                              <a href="#" className="lnav__dropdown-item">
                                <div className="lnav__dropdown-item-icon">
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                  >
                                    <rect
                                      x="2"
                                      y="2"
                                      width="5"
                                      height="5"
                                      rx="1"
                                      fill="currentColor"
                                      opacity="0.7"
                                    />
                                    <rect
                                      x="9"
                                      y="2"
                                      width="5"
                                      height="5"
                                      rx="1"
                                      fill="currentColor"
                                    />
                                    <rect
                                      x="2"
                                      y="9"
                                      width="5"
                                      height="5"
                                      rx="1"
                                      fill="currentColor"
                                    />
                                    <rect
                                      x="9"
                                      y="9"
                                      width="5"
                                      height="5"
                                      rx="1"
                                      fill="currentColor"
                                      opacity="0.7"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <span className="lnav__dropdown-item-title">
                                    {child.label}
                                  </span>
                                  <span className="lnav__dropdown-item-desc">
                                    {child.desc}
                                  </span>
                                </div>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="lnav__actions">
          <button
            className={`lnav__book-btn ${scrolled ? "lnav__book-btn--dark" : ""}`}
            onClick={onEnter}
          >
            Start Mapping
          </button>
          <button
            className={`lnav__mobile-toggle ${scrolled ? "lnav__mobile-toggle--dark" : ""}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lnav__mobile">
          {menuItems.map((item) => (
            <div key={item.label} className="lnav__mobile-item">
              <a href="#" className="lnav__mobile-link">
                {item.label}
              </a>
            </div>
          ))}
          <a href="#" className="btn-primary" style={{ margin: "16px 24px" }}>
            Book a Meeting
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
