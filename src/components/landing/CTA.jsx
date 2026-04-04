import './CTA.css'

const CTA = () => {
  return (
    <section className="cta">
      <div className="cta__bg-img">
        <img
          src="https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1920&q=80"
          alt="Agriculture field"
        />
      </div>
      <div className="cta__overlay" />

      <div className="container cta__content">
        <div className="cta__text">
          <span className="cta__badge">Ready to Transform?</span>
          <h2 className="cta__title">
            Start Your Digital Agriculture<br />Journey Today
          </h2>
          <p className="cta__subtitle">
            Join 500+ enterprise clients using AGRIC to make data-driven decisions and maximize productivity across their entire agrifood value chain.
          </p>
          <div className="cta__actions">
            <a href="#" className="cta__btn-primary">
              Book a Free Meeting
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3.75 9H14.25M14.25 9L10.5 5.25M14.25 9L10.5 12.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <a href="#" className="cta__btn-secondary">
              Calculate Your ROI
            </a>
          </div>
        </div>

        <div className="cta__cards">
          <div className="cta__card">
            <span className="cta__card-icon">📊</span>
            <span className="cta__card-title">Free ROI Analysis</span>
            <span className="cta__card-desc">See your potential savings</span>
          </div>
          <div className="cta__card">
            <span className="cta__card-icon">🎯</span>
            <span className="cta__card-title">Custom Demo</span>
            <span className="cta__card-desc">Tailored to your needs</span>
          </div>
          <div className="cta__card">
            <span className="cta__card-icon">🤝</span>
            <span className="cta__card-title">Expert Support</span>
            <span className="cta__card-desc">Dedicated onboarding team</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CTA
