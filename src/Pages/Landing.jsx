import { useEffect } from 'react'
import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import Products from '../components/landing/Products'
import Industries from '../components/landing/Industries'
import Stats from '../components/landing/Stats'
import Testimonials from '../components/landing/Testimonials'
import CTA from '../components/landing/CTA'
import Footer from '../components/landing/Footer'
import '../styles/landing.css'

function Landing({onEnter}) {
  useEffect(()=> {
    document.body.className ="page-landing"
  }, [])
  return (
    <>
      <Navbar onEnter={onEnter} />
      <main>
        <Hero onEnter={onEnter} />
        <Products />
        <Industries />
        <Stats />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  )
}

export default Landing;
