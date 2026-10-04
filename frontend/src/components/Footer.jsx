import { Link } from 'react-router-dom'
import GithubIcon from './icons/github-icon'
import { docsUrl } from '../lib/docsUrl'


const REPO_URL = 'https://github.com/soumyadip2412/project-management/'

/**
 * Every link resolves to something real: an on-page section, the Swagger UI the
 * backend serves, an app route, or the repository. Pages the product does not
 * have (pricing, blog, careers) are deliberately absent rather than dead.
 */
const FOOTER_COLS = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'Security', href: '#security' },
    { label: 'API reference', href: docsUrl(), external: true },
  ],
  Account: [
    { label: 'Sign in', href: '/login', route: true },
    { label: 'Create account', href: '/register', route: true },
    { label: 'Dashboard', href: '/dashboard', route: true },
  ],
  Project: [
    { label: 'Source code', href: REPO_URL, external: true },
    { label: 'Readme', href: `${REPO_URL}#readme`, external: true },
    { label: 'Report an issue', href: `${REPO_URL}issues`, external: true },
  ],
}

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--bg-surface-2)',
      borderTop: '1px solid var(--border-subtle)',
      padding: '64px 48px 36px',
      width: '100%',
      fontFamily: 'inherit'
    }}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 56 }}
          className="footer-grid">

          {/* Brand */}
          <div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 16 }}>
              <div style={{ width: 30, height: 30, borderRadius: 6, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="black"><polygon points="13,2 4,14 12,14 11,22 20,10 12,10" /></svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>Project Camp</span>
            </Link>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.7, maxWidth: 280, marginBottom: 24 }}>
              Project management built for high-performing teams. Plan, collaborate, and ship.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="https://github.com/soumyadip2412/project-management/" target="_blank" rel="noreferrer"
                style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-heading)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                <GithubIcon size={22} />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_COLS).map(([col, links]) => (
            <div key={col}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
                {col}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {links.map(link => {
                  const style = { fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.15s' }
                  const hover = {
                    onMouseEnter: (e) => (e.currentTarget.style.color = 'var(--text-heading)'),
                    onMouseLeave: (e) => (e.currentTarget.style.color = 'var(--text-secondary)'),
                  }
                  return link.route ? (
                    <Link key={link.label} to={link.href} style={style} {...hover}>
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.label}
                      href={link.href}
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                      style={style}
                      {...hover}
                    >
                      {link.label}
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            © {new Date().getFullYear()} Project Camp, Inc. All rights reserved.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-tertiary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            All systems operational
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </footer>
  )
}
