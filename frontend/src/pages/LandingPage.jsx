import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import TrustStrip from '../components/TrustStrip'
import FeatureGrid from '../components/FeatureGrid'
import ArchitectureSection from '../components/ArchitectureSection'
import SecuritySection from '../components/SecuritySection'
import CTASection from '../components/CTASection'
import Footer from '../components/Footer'

/**
 * FILE: frontend/src/pages/LandingPage.jsx
 * Lazy-loaded from main.jsx (React.lazy + Suspense), so its heavier code
 * (animations, the big hero) is a separate chunk that app users never download.
 * The `pc-landing` wrapper class scopes the marketing palette defined in
 * index.css, so it cannot leak into the app's design tokens.
 *
 * LandingPage — public marketing homepage for ProjectCamp.
 * Route: /
 *
 * Structure:
 *  1. Navbar     — sticky, transparent→solid on scroll
 *  2. Hero       — headline + CTAs + Kanban board mock
 *  3. TrustStrip — social proof / stats / tech stack
 *  4. FeatureGrid — interactive two-column feature explorer (#features)
 *  5. Architecture — stack + request pipeline (#architecture)
 *  6. Security     — layered security pipeline diagram (#security)
 *  7. CTASection — bottom conversion band
 *  8. Footer     — links + copyright
 */
export default function LandingPage() {
  return (
    <div className="pc-landing relative min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <FeatureGrid />
        <ArchitectureSection />
        <SecuritySection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}
