import { useState, useEffect, useRef, useCallback } from "react";
import "./Hero.css";
import maVideo from "../../assets/4-84624-585553977_small.mp4";
import pic2 from "../../assets/pexels-wendywei-2.jpg";

const SLIDE_DURATION = 5000;
const ANIM_DURATION = 1200;

const slides = [
  {
    id: 1,
    video: maVideo,
    bgImage:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920&q=80",
    tagline: "SMART SOIL SAMPLING",
    title: ["Guide Your Soil Sampling", "with Precision"],
    subtitle:
      "Choose your plot on the map, select your crop — get a personalized sampling guide based on your region and season.",
  },
  {
    id: 2,
    bgImage:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1920&q=80",
    tagline: "SATELLITE DATA",
    title: ["Monitor Your Plot State", "in Real Time"],
    subtitle:
      "NDVI, NDRE, NDMI indices calculated from Sentinel-2 imagery — visualize vegetation health and soil water stress on your plot.",
  },
  {
    id: 3,
    bgImage: pic2,
    tagline: "CROP RECOMMENDATION",
    title: ["Which Crop", "for Your Soil?"],
    subtitle:
      "Enter your pH, organic matter and soil texture — the system recommends the best vegetable crops with a compatibility score.",
  },
  {
    id: 4,
    bgImage:
      "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1920&q=80",
    tagline: "ALGERIA CLIMATE ZONES",
    title: ["A Guide Tailored", "to Every Wilaya"],
    subtitle:
      "From the Mediterranean Tell to the arid Sahara — the system adjusts the number of points, depth and analyses to your region.",
  },
];

function BgLayer({ slide, className }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className={`hero__layer ${className}`}>
      {slide.video ? (
        <video
          ref={videoRef}
          className="hero__layer-media"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src={slide.video} type="video/mp4" />
        </video>
      ) : (
        <img
          src={slide.bgImage}
          alt=""
          className="hero__layer-media hero__layer-media--zoom"
        />
      )}
    </div>
  );
}

export default function Hero({ onEnter }) {
  const [cur, setCur] = useState(0);
  const [nextIdx, setNextIdx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const textRef = useRef(null);

  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const t0Ref = useRef(null);


  const animateTextOut = useCallback(() => {
    if (!textRef.current) return;
    textRef.current.style.transition =
      "opacity 0.28s ease-in, transform 0.28s ease-in";
    textRef.current.style.opacity = "0";
    textRef.current.style.transform = "translateY(-14px)";
  }, []);

  const animateTextIn = useCallback(() => {
    if (!textRef.current) return;
  
    textRef.current.style.transition = "none";
    textRef.current.style.opacity = "0";
    textRef.current.style.transform = "translateY(22px)";
   
    void textRef.current.offsetHeight;

    textRef.current.style.transition =
      "opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1)";
    textRef.current.style.opacity = "1";
    textRef.current.style.transform = "translateY(0)";
  }, []);


  const runProgress = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    t0Ref.current = performance.now();
    const tick = (now) => {
      const p = Math.min(((now - t0Ref.current) / SLIDE_DURATION) * 100, 100);
      setProgress(p);
      if (p < 100) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);


  const go = useCallback(
    (idx) => {
      if (busy) return;
      const target = ((idx % slides.length) + slides.length) % slides.length;
      if (target === cur) return;

      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      setBusy(true);
      setNextIdx(target);
      animateTextOut();

      setTimeout(() => {
        setCur(target);
        setNextIdx(null);
        setBusy(false);
        setProgress(0);
        runProgress();
     
        requestAnimationFrame(() => requestAnimationFrame(animateTextIn));
      }, ANIM_DURATION);
    },
    [busy, cur, animateTextOut, animateTextIn, runProgress],
  );

  
  useEffect(() => {
    if (busy) return;
    timerRef.current = setTimeout(() => go(cur + 1), SLIDE_DURATION);
    runProgress();
    return () => {
      clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [cur, busy]);

  
  useEffect(() => {
    if (!textRef.current) return;
    textRef.current.style.opacity = "0";
    textRef.current.style.transform = "translateY(22px)";
    void textRef.current.offsetHeight;
    textRef.current.style.transition =
      "opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)";
    textRef.current.style.opacity = "1";
    textRef.current.style.transform = "translateY(0)";
  }, []);

  const curSlide = slides[cur];
  const nextSlide = nextIdx !== null ? slides[nextIdx] : null;

  return (
    <section className="hero">
    
      <div className="hero__stage">
        <BgLayer
          key={`c-${cur}`}
          slide={curSlide}
          className={busy ? "hero__layer--exit" : "hero__layer--idle"}
        />
        {busy && nextSlide && (
          <BgLayer
            key={`n-${nextIdx}`}
            slide={nextSlide}
            className="hero__layer--enter"
          />
        )}
      </div>

     
      <div className="hero__ov-dark" />
      <div className="hero__ov-left" />
      <div className="hero__ov-bottom" />

    
      <div className="hero__body">
        <div className="container">
          <div className="hero__text" ref={textRef}>
            <span className="hero__tagline">
              <span className="hero__dot" />
              {curSlide.tagline}
            </span>

            <h1 className="hero__title">
              {curSlide.title.map((line, i) => (
                <span key={i} className="hero__title-line">
                  {line}
                </span>
              ))}
            </h1>

            <p className="hero__subtitle">{curSlide.subtitle}</p>

            <div className="hero__actions">
              <a
                href="#"
                className="btn-primary hero__btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  onEnter?.();
                }}
              >
                Start Mapping My Field
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M3.75 9H14.25M14.25 9L10.5 5.25M14.25 9L10.5 12.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

     
      <nav className="hero__nav">
        {slides.map((s, i) => (
          <button
            key={s.id}
            className={`hero__nav-btn ${i === cur ? "hero__nav-btn--active" : ""}`}
            onClick={() => go(i)}
          >
            <span className="hero__nav-label">{s.tagline}</span>
            <span className="hero__nav-track">
              <span
                className="hero__nav-fill"
                style={{
                  width: i === cur ? `${progress}%` : "0%",
                  transition: i === cur ? "width 0.1s linear" : "none",
                }}
              />
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
