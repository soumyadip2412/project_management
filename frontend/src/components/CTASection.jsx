import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

/*
 * FILE: frontend/src/components/CTASection.jsx   (landing page, near the bottom)
 * The final "call to action" band with buttons to register / sign in.
 * motion.div with whileInView + viewport={{ once: true }} fades it in the first
 * time it scrolls into view (framer-motion uses IntersectionObserver for this).
 * The text is marketing copy, not data from the API.
 */
export default function CTASection() {
  const navigate = useNavigate()

  return (
    <section style={{ background: 'var(--bg-base)', padding: '80px 24px' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: 680, margin: '0 auto', textAlign: 'center',
          padding: '56px 40px',
          background: 'var(--bg-surface)',
          border: '1px solid rgba(79,184,184,0.15)',
          borderRadius: 20,
          boxShadow: '0 0 60px rgba(79,184,184,0.06)',
        }}
      >
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.02em', marginBottom: 14 }}>
          Ready to get <span style={{ color: '#4fb8b8' }}>started?</span>
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-tertiary)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto 32px' }}>
          Create a workspace, invite your team and plan your first sprint in a few minutes.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/register')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#4fb8b8', color: '#0b1a1c',
              border: 'none', borderRadius: 8, padding: '12px 24px',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(79,184,184,0.3)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#7fd3d3')}
            onMouseLeave={e => (e.currentTarget.style.background = '#4fb8b8')}
          >
            Sign up free <ArrowRight size={14} />
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '12px 24px',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
          >
            Sign in
          </button>
        </div>
      </motion.div>
    </section>
  )
}
