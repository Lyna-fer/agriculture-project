import { useState, useEffect } from "react";
import "./Navbar.css";
import { LeafyGreen } from "lucide-react";

const navItems = [
  { id: "hero", label: "Overview" },
  { id: "features", label: "Workflow" },
  { id: "zones", label: "Climate Zones" },
  { id: "insights", label: "Platform Value" },
  { id: "testimonials", label: "Testimonials" },
];

const Navbar = ({ onEnter }) => {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-35% 0px -45% 0px",
        threshold: [0.15, 0.35, 0.55],
      },
    );

    navItems.forEach((item) => {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    const target = document.getElementById(id);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top, behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <nav className={`lnav ${scrolled ? "lnav--scrolled" : ""}`}>
      <div className="lnav__inner">
        <button
          type="button"
          className="lnav__logo"
          onClick={() => scrollToSection("hero")}
          aria-label="Go to top"
        >
          <LeafyGreen
            size={22}
            color={scrolled ? "#3a7d44" : "white"}
            strokeWidth={2.5}
          />
          <span className="logo-text">AGRIC</span>
          <span className="lnav__badge">Algerian soil sampling</span>
        </button>

        <ul className="lnav__menu">
          {navItems.map((item) => (
            <li key={item.id} className="lnav__item">
              <button
                type="button"
                className={`lnav__link ${activeSection === item.id ? "lnav__link--active" : ""}`}
                onClick={() => scrollToSection(item.id)}
                aria-current={activeSection === item.id ? "page" : undefined}
              >
                {item.label}
              </button>
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
          {navItems.map((item) => (
            <div key={item.id} className="lnav__mobile-item">
              <button
                type="button"
                className={`lnav__mobile-link ${activeSection === item.id ? "lnav__mobile-link--active" : ""}`}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="lnav__mobile-cta"
            onClick={onEnter}
          >
            Start Mapping
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
