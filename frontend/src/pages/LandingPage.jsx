import LandingNavbar from "../components/landing/LandingNavbar";
import LandingHero from "../components/landing/LandingHero";
import SprintStripSection from "../components/landing/SprintStripSection";
import ProductTabs from "../components/landing/ProductTabs";
import RolesSection from "../components/landing/RolesSection";
import SecuritySection from "../components/landing/SecuritySection";
import BuiltSection from "../components/landing/BuiltSection";
import ClosingCta from "../components/landing/ClosingCta";
import LandingFooter from "../components/landing/LandingFooter";

/**
 * FILE: frontend/src/pages/LandingPage.jsx   (route: /)
 * The public product page. Lazy-loaded from main.jsx, so app users never
 * download it. It uses the app's own tokens (index.css) and components
 * (SprintTide, Tabs), so it looks like the product it describes: navy hero
 * and footer, light body sections that follow the user's theme.
 *
 *  1. Navbar          sticky navy bar; section links, Sign in, Create free account
 *  2. Hero            headline, two actions, a real Board screenshot
 *  3. Sprint strip    the app's SprintTide with sample data   #sprint-strip
 *  4. Product tabs    Plan · Track · Review with screenshots   #product
 *  5. Roles           role / capability table                  #roles
 *  6. Security        six server-side capabilities             #security
 *  7. How it's built  stack, request pipeline, layers, links   #built
 *  8. Closing CTA, then the footer
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg font-sans text-text">
      <LandingNavbar />
      <main>
        <LandingHero />
        <SprintStripSection />
        <ProductTabs />
        <RolesSection />
        <SecuritySection />
        <BuiltSection />
        <ClosingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
