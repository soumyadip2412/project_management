import { motion } from 'framer-motion'
import { Server, Database, Layers, Workflow } from 'lucide-react'

/**
 * FILE: frontend/src/components/ArchitectureSection.jsx   (landing page, #architecture)
 * Four "layer" cards (API, data, security, frontend) plus the request
 * pipeline, rendered from the LAYERS data array below.
 * Note: one bullet still says "Winston + Morgan logging"; morgan has since been
 * replaced by the requestContext middleware (backend), so only winston remains.
 *
 * Architecture — target of the navbar "#architecture" link.
 * Content describes the real stack and request pipeline (see backend/src/app.js
 * and src/middlewares/*), not aspirational marketing copy.
 */

const LAYERS = [
  {
    icon: <Server size={22} />,
    color: '#4fb8b8',
    bg: 'rgba(79,184,184,0.12)',
    title: 'API layer',
    desc: 'Node.js and Express 5 in native ESM, with every controller wrapped in a shared async handler and a single global error mapper.',
    points: ['Express 5 + ESM', 'ApiResponse / ApiError envelope', 'Winston + Morgan logging'],
  },
  {
    icon: <Database size={22} />,
    color: '#4f8fd6',
    bg: 'rgba(79,143,214,0.12)',
    title: 'Data layer',
    desc: 'MongoDB with Mongoose 8. Workspaces contain projects, which own sprints, tasks, comments and notes.',
    points: ['Workspace → Project → Sprint → Task', 'Issue keys like PROJ-1', 'Enums centralised in constants.js'],
  },
  {
    icon: <Layers size={22} />,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    title: 'Client layer',
    desc: 'React 19 (JavaScript) on Vite, styled with Tailwind v4 design tokens and a light/dark theme.',
    points: ['React 19 + JavaScript', 'Vite build, Tailwind v4', 'Single API client'],
  },
  {
    icon: <Workflow size={22} />,
    color: '#7aa7e0',
    bg: 'rgba(122,167,224,0.12)',
    title: 'Event layer',
    desc: 'Side effects leave the controllers. An internal event bus fans work out to notification handlers and the activity feed.',
    points: ['Decoupled event bus', 'Notification handlers', 'Append-only audit trail'],
  },
]

const PIPELINE = ['Request', 'Verify JWT', 'Membership', 'RBAC', 'Audit', 'Controller']

export default function ArchitectureSection() {
  return (
    <section
      id="architecture"
      style={{ background: '#080c12', padding: '100px 48px', width: '100%', scrollMarginTop: 68 }}
    >
      <div style={{ width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ fontSize: 12, letterSpacing: '0.12em', color: '#4fb8b8', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase' }}
          >
            Architecture
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            style={{ fontSize: 'clamp(32px, 4.5vw, 48px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 16 }}
          >
            Layered by design, not by accident
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            style={{ fontSize: 16, color: '#a1adbc', maxWidth: 620, margin: '0 auto' }}
          >
            Authentication, membership, permissions and auditing are composed as middleware —
            so a route declares what it needs and the rest is enforced consistently.
          </motion.p>
        </div>

        {/* Request pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
            gap: 10, marginBottom: 56, padding: '24px 20px',
            background: '#0d1520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
          }}
        >
          {PIPELINE.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 13, fontWeight: 600, color: i === 0 ? '#7f92a6' : '#f1f3f7',
                  padding: '7px 14px', borderRadius: 8,
                  background: i === PIPELINE.length - 1 ? 'rgba(79,184,184,0.12)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${i === PIPELINE.length - 1 ? 'rgba(79,184,184,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {step}
              </span>
              {i < PIPELINE.length - 1 && <span aria-hidden="true" style={{ color: '#4d5b6d', fontSize: 14 }}>→</span>}
            </div>
          ))}
        </motion.div>

        {/* Layer cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {LAYERS.map((l, i) => (
            <motion.div
              key={l.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              style={{
                padding: '30px 26px', background: '#0d1520',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16,
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 12, background: l.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: l.color, marginBottom: 18,
              }}>
                {l.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10 }}>{l.title}</h3>
              <p style={{ fontSize: 14, color: '#a1adbc', lineHeight: 1.65, marginBottom: 16 }}>{l.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {l.points.map(p => (
                  <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#dae0e8' }}>
                    <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
