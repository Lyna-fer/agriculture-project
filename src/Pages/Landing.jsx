import { useEffect } from "react";
import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import Products from "../components/landing/Products";
import Industries from "../components/landing/Industries";
import Stats from "../components/landing/Stats";
import Testimonials from "../components/landing/Testimonials";
import Footer from "../components/landing/Footer";
import "../styles/landing.css";
import { useNavigate } from "react-router-dom";
function Landing() {
  const navigate = useNavigate();
  const onEnter = () => navigate("/login");
  useEffect(() => {
    document.body.className = "page-landing";
  }, []);
  return (
    <>
      <Navbar onEnter={onEnter} />
      <main>
        <div id="hero">
          <Hero onEnter={onEnter} />
        </div>
        <div id="features">
          <Products />
        </div>
        <div id="zones">
          <Industries />
        </div>
        <div id="insights">
          <Stats />
        </div>
        <div id="testimonials">
          <Testimonials />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default Landing;
