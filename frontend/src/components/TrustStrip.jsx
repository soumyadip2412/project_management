import { motion } from 'framer-motion'

function NodeLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <path d="M16 2L2 9v14l14 7 14-7V9L16 2z" fill="#68a063" />
      <path d="M16 6l10 5v10l-10 5-10-5V11L16 6z" fill="#3c873a" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">N</text>
    </svg>
  )
}

function ExpressLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <text x="2" y="22" fill="#eeeeee" fontSize="14" fontWeight="800" fontStyle="italic">eX</text>
    </svg>
  )
}

function MongoLogo() {
  return (
    <svg width="18" height="24" viewBox="0 0 32 44" fill="none">
      <path d="M16 2C10 8 6 14 6 22c0 6 3 11 8 14l1 6 1-6c5-3 8-8 8-14 0-8-4-14-8-20z" fill="#47a248" />
      <path d="M16 10v24" stroke="#c5e3c5" strokeWidth="2" />
    </svg>
  )
}

function JWTLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" stroke="#d63aff" strokeWidth="1.5" fill="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 16 + 9 * Math.cos(rad)
        const y1 = 16 + 9 * Math.sin(rad)
        const x2 = 16 + 13 * Math.cos(rad)
        const y2 = 16 + 13 * Math.sin(rad)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d63aff" strokeWidth="1.5" />
      })}
      <circle cx="16" cy="16" r="4" fill="#d63aff" />
    </svg>
  )
}

const TECH = [
  { name: 'Node.js', logo: <NodeLogo /> },
  { name: 'Express.js', logo: <ExpressLogo /> },
  { name: 'MongoDB', logo: <MongoLogo /> },
  { name: 'JWT', logo: <JWTLogo /> },
]

export default function TrustStrip() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      style={{
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        padding: '24px 48px',
        width: '100%',
      }}
    >
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
          Built with modern technologies
        </span>

        <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} className="hidden sm:block" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 64, flexWrap: 'wrap', justifyContent: 'center' }}>
          {TECH.map(tech => (
            <div
              key={tech.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
                cursor: 'default', transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-heading)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              {tech.logo}
              {tech.name}
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
