import { useState, useEffect, useRef } from 'react'
import { TextEffect } from "./motion-primitives/text-effect";
import { useNavigate } from 'react-router-dom'
import { docsUrl } from '../lib/docsUrl'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import {
  ArrowRight, BookOpen, Shield, Users, RefreshCw,
  Code2, Database, Bell, Search,
  LayoutDashboard, FolderOpen, CheckSquare, Layers,
  FileText, UserCheck, Settings,
} from 'lucide-react'

// ─── Typewriter Text Component ────────────────────────────────────────────────
function TypewriterText({ text }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    setDisplayed('')
    let idx = 0
    const interval = setInterval(() => {
      if (idx < text.length) {
        setDisplayed(text.slice(0, idx + 1))
        idx++
      } else {
        clearInterval(interval)
      }
    }, 20)
    return () => clearInterval(interval)
  }, [text])

  return (
    <p
      style={{
        fontSize: 11,
        color: '#f59e0b',
        lineHeight: 1.45,
        marginTop: 6,
        fontWeight: 500,
        textAlign: 'left',
      }}
    >
      {displayed}
      <span style={{ opacity: 0.8, marginLeft: 2 }}>|</span>
    </p>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart() {
  const r = 38
  const cx = 50
  const cy = 50
  const circ = 2 * Math.PI * r

  const segments = [
    { pct: 0.32, color: '#f59e0b', offset: 0 },       // Todo amber
    { pct: 0.41, color: '#3b82f6', offset: 0.32 },    // In Progress blue
    { pct: 0.27, color: '#22c55e', offset: 0.73 },    // Done green
  ]

  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="15"
            strokeDasharray={`${s.pct * circ} ${circ}`}
            strokeDashoffset={-s.offset * circ}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px' }}
          />
        ))}
      </svg>
    </div>
  )
}

// ─── Dashboard Mockup (Tilted 3D Graphic) ──────────────────────────────────────
function DashboardMockup({
  rotateYStyle = '-16deg',
  rotateXStyle = '7deg',
}) {
  const sidebarItems = [
    { icon: <LayoutDashboard size={14} />, label: 'Overview', active: true },
    { icon: <FolderOpen size={14} />, label: 'Projects' },
    { icon: <CheckSquare size={14} />, label: 'Tasks' },
    { icon: <Layers size={14} />, label: 'Subtasks' },
    { icon: <FileText size={14} />, label: 'Notes' },
    { icon: <UserCheck size={14} />, label: 'Members' },
    { icon: <FileText size={14} />, label: 'Files' },
  ]

  const stats = [
    { label: 'Projects', value: '12', sub: 'Active', icon: <FolderOpen size={11} color="#6366f1" />, bg: 'rgba(99,102,241,0.1)' },
    { label: 'Tasks', value: '48', sub: 'In Progress', icon: <CheckSquare size={11} color="#3b82f6" />, bg: 'rgba(59,130,246,0.1)' },
    { label: 'Subtasks', value: '126', sub: 'Open', icon: <Layers size={11} color="#22c55e" />, bg: 'rgba(34,197,94,0.1)' },
    { label: 'Members', value: '24', sub: 'Across Projects', icon: <Users size={11} color="#f59e0b" />, bg: 'rgba(245,158,11,0.1)' },
  ]

  const projects = [
    { name: 'Website Redesign', members: '8 members', pct: 75, color: '#6366f1', iconBg: '#6366f1' },
    { name: 'Mobile App v2.0', members: '6 members', pct: 60, color: '#22c55e', iconBg: '#22c55e' },
    { name: 'Internal Dashboard', members: '5 members', pct: 90, color: '#f59e0b', iconBg: '#f59e0b' },
    { name: 'Marketing Campaign', members: '7 members', pct: 40, color: '#3b82f6', iconBg: '#3b82f6' },
  ]

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        boxShadow: '0 0 100px rgba(245, 158, 11, 0.22), 0 50px 120px rgba(0,0,0,0.95)',
        background: '#141414',
        transform: `perspective(1000px) rotateY(${rotateYStyle}) rotateX(${rotateXStyle}) rotateZ(0.5deg)`,
        transformStyle: 'preserve-3d',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease',
      }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#0d0d0d',
      }}>
        {/* Search Bar */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)', borderRadius: 8,
          padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)',
          maxWidth: 300, marginLeft: 'auto',
        }}>
          <Search size={13} color="#6b7280" />
          <span style={{ fontSize: 11, color: '#6b7280' }}>Search anything...</span>
        </div>
        {/* Icons */}
        <Bell size={16} color="#9ca3af" style={{ cursor: 'pointer', marginLeft: 8 }} />
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: '#374151',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#f3f4f6', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)'
        }}>A</div>
      </div>

      {/* Main body with sidebar & content */}
      <div style={{ display: 'flex', minHeight: 450 }}>

        {/* Sidebar */}
        <div style={{
          width: 140, flexShrink: 0, padding: '16px 0',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: '#0e0e0e',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Logo on sidebar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="black"><polygon points="13,2 4,14 12,14 11,22 20,10 12,10" /></svg>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Project Camp</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sidebarItems.map(item => (
              <div
                key={item.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 16px',
                  background: item.active ? 'rgba(245,158,11,0.14)' : 'transparent',
                  color: item.active ? '#f59e0b' : '#9ca3af',
                  fontSize: 12, fontWeight: item.active ? 600 : 400,
                  cursor: 'default',
                  borderLeft: item.active ? '3px solid #f59e0b' : '3px solid transparent',
                }}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', color: '#9ca3af', fontSize: 12 }}>
              <Settings size={14} /> Settings
            </div>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, padding: '22px 24px', background: '#141414', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 3, letterSpacing: '-0.01em' }}>Overview</h2>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Here's what's happening with your projects today.</p>
          </div>

          {/* Stats grid (4 metrics) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {stats.map(stat => (
              <div key={stat.label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{stat.label}</span>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {stat.icon}
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Two-column layout: Recent Projects & Task Progress */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>

            {/* Recent Projects */}
            <div style={{
              padding: '16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>Recent Projects</span>
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500, cursor: 'pointer' }}>View all</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {projects.map(proj => (
                  <div key={proj.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 6, background: proj.iconBg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      <FolderOpen size={12} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#e5e7eb' }}>{proj.name}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{proj.pct}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', width: '100%' }}>
                        <div style={{ height: '100%', borderRadius: 99, width: `${proj.pct}%`, background: proj.color }} />
                      </div>
                      <span style={{ fontSize: 10, color: '#6b7280', marginTop: 2, display: 'block' }}>{proj.members}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Progress */}
            <div style={{
              padding: '16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', display: 'block', marginBottom: 14 }}>Task Progress</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <DonutChart />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {[
                      { label: 'Todo', pct: '32%', color: '#f59e0b' },
                      { label: 'In Progress', pct: '41%', color: '#3b82f6' },
                      { label: 'Done', pct: '27%', color: '#22c55e' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: '#e5e7eb', fontWeight: 600, marginLeft: 'auto' }}>{item.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Total Tasks</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>48</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Floating Card with Hover Expansion & Typewriter Animation ────────────────
function FloatingCard({
  icon,
  title,
  description,
  iconBg = 'rgba(255,255,255,0.05)',
  iconColor = '#9ca3af',
  borderColor = 'rgba(245,158,11,0.3)',
  delay = 0,
  side,
  curveY = 0,
  style,
  x,
  scaleValue,
  pathLength,
}) {
  const isLeft = side === 'left'
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        x,
        scale: scaleValue,
        opacity: 1,
        position: 'absolute',
        display: 'flex', flexDirection: 'column', alignItems: isHovered ? 'flex-start' : 'center',
        gap: 6, padding: '14px 16px',
        background: isHovered ? '#1c1914' : '#161616',
        border: isHovered ? '1px solid #f59e0b' : `1px solid ${borderColor}`,
        borderRadius: 14,
        boxShadow: isHovered
          ? '0 0 35px rgba(245,158,11,0.35), 0 20px 45px rgba(0,0,0,0.85)'
          : '0 12px 36px rgba(0,0,0,0.7)',
        width: isHovered ? 230 : 110,
        zIndex: isHovered ? 60 : 20,
        cursor: 'pointer',
        transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s, border-color 0.25s, box-shadow 0.25s',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: isHovered ? 'rgba(245,158,11,0.2)' : iconBg,
          border: `1px solid ${isHovered ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isHovered ? '#f59e0b' : iconColor,
          flexShrink: 0,
          transition: 'all 0.2s ease',
        }}>
          {icon}
        </div>
        {isHovered && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', textAlign: 'left' }}>
            {title}
          </span>
        )}
      </div>

      {!isHovered && (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#e5e7eb', textAlign: 'center', lineHeight: 1.3 }}>
          {title}
        </span>
      )}

      {/* Typing animation on hover */}
      {isHovered && <TypewriterText text={description} />}

      {/* Embedded Connector Line + Glowing Dot Marker */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          [isLeft ? 'right' : 'left']: isHovered ? -110 : -110,
          width: 110,
          height: 60,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <svg width="110" height="60" viewBox="0 0 110 60" style={{ overflow: 'visible' }}>
          {isLeft ? (
            <>
              <motion.path
                d={`M 0 30 C 50 30, 60 ${30 + curveY}, 104 ${30 + curveY}`}
                fill="none"
                stroke={isHovered ? '#fbbf24' : '#f59e0b'}
                strokeWidth={isHovered ? '2' : '1.5'}
                strokeDasharray="4 4"
                opacity={isHovered ? 1 : 0.85}
                style={{ pathLength }}
              />
              {/* <circle
                cx="104"
                cy={30 + curveY}
                r={isHovered ? '5.5' : '4.5'}
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 0 8px #f59e0b)' }}
              /> */}
            </>
          ) : (
            <>
              <motion.path
                d={`M 110 30 C 60 30, 50 ${30 + curveY}, 6 ${30 + curveY}`}
                fill="none"
                stroke={isHovered ? '#fbbf24' : '#f59e0b'}
                strokeWidth={isHovered ? '2' : '1.5'}
                strokeDasharray="4 4"
                opacity={isHovered ? 1 : 0.85}
                style={{ pathLength }}
              />
              {/* <circle
                cx="6"
                cy={30 + curveY}
                r={isHovered ? '5.5' : '4.5'}
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth="1"
                style={{ filter: 'drop-shadow(0 0 8px #f59e0b)' }}
              /> */}
            </>
          )}
        </svg>
      </div>
    </motion.div>
  )
}

// ─── Feature Chip ─────────────────────────────────────────────────────────────
function FeatureChip({ icon, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '7px 14px',
      background: 'rgba(255,255,255,0.035)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 99,
      color: '#d1d5db', fontSize: 12, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#9ca3af' }}>{icon}</span>
      {label}
    </div>
  )
}

// ─── Hero Main Component ──────────────────────────────────────────────────────
export default function Hero() {
  const navigate = useNavigate()
  const sectionRef = useRef(null)

  // Scroll animation: right dashboard centers & un-tilts!
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  // =======================
  // Scroll Animation Values
  // =======================

  // Dashboard Assembly Animation
  const dashboardX = useTransform(
    scrollYProgress,
    [0, 0.45],
    [220, 0]
  );

  const dashboardScale = useTransform(
    scrollYProgress,
    [0, 0.45],
    [0.92, 1.08]
  );

  const dashboardOpacity = useTransform(
    scrollYProgress,
    [0, 0.15],
    [0.9, 1]
  );

  // Dashboard becomes flat
  const rightRotateYNum = useTransform(
    scrollYProgress,
    [0, 0.45],
    [-18, 0]
  );

  const rightRotateXNum = useTransform(
    scrollYProgress,
    [0, 0.45],
    [10, 0]
  );

  // Floating Cards
  const cardScale = useTransform(
    scrollYProgress,
    [0.18, 0.45],
    [1, 0.9]
  );

  // Connector Lines
  const pathLength = useTransform(
    scrollYProgress,
    [0.18, 0.42],
    [1, 0]
  );

  const leftCardX = useTransform(
    scrollYProgress,
    [0.18, 0.45],
    [0, 70]
  );

  const rightCardX = useTransform(
    scrollYProgress,
    [0.18, 0.45],
    [0, -70]
  );

  const [showCards, setShowCards] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setShowCards(v >= 0.55);
  });

  // Rotation strings
  const [rotateYStr, setRotateYStr] = useState("-18deg");
  const [rotateXStr, setRotateXStr] = useState("10deg");

  useEffect(() => {
    return rightRotateYNum.on('change', (v) => setRotateYStr(`${v}deg`))
  }, [rightRotateYNum])

  useEffect(() => {
    return rightRotateXNum.on('change', (v) => setRotateXStr(`${v}deg`))
  }, [rightRotateXNum])

  return (
    <section
      ref={sectionRef}
      style={{
        height: '260vh',
        position: 'relative',
        background: 'var(--bg-base)',
      }}
    >
      {/* Sticky container for smooth scroll transition */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 48px',
          overflow: 'visible',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 48, alignItems: 'center' }} className="hero-grid">

          {/* ── Left: text content (Fades out and slides left on scroll) ── */}
          <motion.div style={{ paddingRight: 20, opacity: 1, x: 0 }}>
            {/* Pill Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              style={{ marginBottom: 28 }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 99,
                border: '1px solid rgba(245,158,11,0.3)',
                background: 'rgba(245,158,11,0.06)',
                fontSize: 12, fontWeight: 700, color: '#f59e0b',
                letterSpacing: '0.08em',
              }}>
                BACKEND PLATFORM
                <span style={{ color: 'rgba(245,158,11,0.4)' }}>•</span>
                v1.0.0
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.6 }}
              style={{
                fontSize: 'clamp(40px, 4.8vw, 64px)',
                fontWeight: 900,
                lineHeight: 1.1,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                marginBottom: 24,
              }}
            >
              <TextEffect
                preset="fade-in-blur"
                speedReveal={0.9}
                speedSegment={0.30}
              >
                Powering structured collaboration for high-performing teams.
              </TextEffect>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.5 }}
              style={{
                fontSize: 16, color: '#9ca3af', lineHeight: 1.7,
                maxWidth: 540, marginBottom: 36,
              }}
            >
              Project Camp provides a secure backend platform for collaborative
              project management—combining authentication, hierarchical task
              management, role-based permissions, project notes, and an audit
              trail into one scalable architecture.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.5 }}
              style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40, justifyContent: 'flex-start' }}
            >
              <button
                onClick={() => navigate('/register')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#f59e0b', color: '#000000',
                  border: 'none', borderRadius: 10, padding: '14px 26px',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s, transform 0.1s',
                  boxShadow: '0 4px 24px rgba(245,158,11,0.4)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fbbf24')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f59e0b')}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Get Started <ArrowRight size={16} />
              </button>
              <a
                href={docsUrl()}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '14px 26px',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >
                <BookOpen size={16} /> Read Documentation
              </a>
            </motion.div>

            {/* Feature chips */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
            >
              <FeatureChip icon={<Shield size={13} />} label="JWT Authentication" />
              <FeatureChip icon={<Users size={13} />} label="RBAC Permissions" />
              <FeatureChip icon={<CheckSquare size={13} />} label="Task Engine" />
              <FeatureChip icon={<Bell size={13} />} label="Email Verification" />
            </motion.div>
          </motion.div>

          {/* ── Right: 3D Dashboard assembly (Centers, scales up & un-tilts on scroll) ── */}
          <motion.div
            style={{
              position: 'relative',
              minHeight: 480,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              x: dashboardX,
              scale: dashboardScale,
              opacity: dashboardOpacity,

              perspective: 1800,
              transformStyle: 'preserve-3d',
            }}
          >

            {/* Left Floating Cards */}
            {showCards && (
              <motion.div
                style={{
                  opacity: 1,
                  scale: 1,
                }}
              >
                <FloatingCard
                  side="left"
                  icon={<Shield size={20} />}
                  title="JWT Authentication"
                  description="Secures user sessions using signed JSON Web Tokens with HTTP-only cookies."
                  iconBg="rgba(245,158,11,0.12)"
                  iconColor="#f59e0b"
                  borderColor="rgba(245,158,11,0.3)"
                  delay={0.6}
                  curveY={15}
                  style={{ left: -10, top: 40 }}
                  x={leftCardX}
                  scaleValue={cardScale}
                  pathLength={pathLength}
                />
              </motion.div>
            )}
            {showCards && (
              <motion.div
                style={{
                  opacity: 1,
                  scale: 1,
                }}
              >
                <FloatingCard
                  side="left"
                  icon={<Users size={20} />}
                  title="RBAC Permissions"
                  description="Enforces role-based permissions across Admin, Manager, and Member endpoints."
                  iconBg="rgba(245,158,11,0.12)"
                  iconColor="#f59e0b"
                  borderColor="rgba(245,158,11,0.3)"
                  delay={0.7}
                  curveY={-10}
                  style={{ left: -10, top: 195 }}
                  x={leftCardX}
                  scaleValue={cardScale}
                  pathLength={pathLength}
                />
              </motion.div>
            )}
            {showCards && (
              <motion.div
                style={{
                  opacity: 1,
                  scale: 1,
                }}
              >
                <FloatingCard
                  side="left"
                  icon={<RefreshCw size={20} />}
                  title="Refresh Tokens"
                  description="Handles token rotation and automatic session renewal with token blacklisting."
                  iconBg="rgba(245,158,11,0.12)"
                  iconColor="#f59e0b"
                  borderColor="rgba(245,158,11,0.3)"
                  delay={0.8}
                  curveY={-20}
                  style={{ left: -10, top: 350 }}
                  x={leftCardX}
                  scaleValue={cardScale}
                  pathLength={pathLength}
                />
              </motion.div>
            )}

            {/* Central Dashboard Mockup (Un-tilts smoothly on scroll) */}
            <motion.div
              style={{
                margin: '0 auto',
                width: '100%',
                maxWidth: 920,
                filter: 'drop-shadow(0 0 32px rgba(245,158,11,0.35))',
              }}
            >
              <DashboardMockup
                rotateYStyle={rotateYStr}
                rotateXStyle={rotateXStr}
              />
            </motion.div>

            {/* Right Floating Cards */}
            {showCards && (
              <motion.div
                style={{
                  opacity: 1,
                  scale: 1,
                }}
              >
                <FloatingCard
                  side="right"
                  icon={<Code2 size={20} />}
                  title="REST API"
                  description="Provides clean RESTful endpoints for tasks, sprints, members, and project notes."
                  iconBg="rgba(245,158,11,0.15)"
                  iconColor="#f59e0b"
                  borderColor="rgba(245,158,11,0.4)"
                  delay={0.65}
                  curveY={15}
                  style={{ right: -10, top: 40 }}
                  x={rightCardX}
                  scaleValue={cardScale}
                  pathLength={pathLength}
                />
              </motion.div>
            )}
            {showCards && (
              <motion.div
                style={{
                  opacity: 1,
                  scale: 1,
                }}
              >
                <FloatingCard
                  side="right"
                  icon={<Database size={20} />}
                  title="Audit Trail"
                  description="Records who changed what and when, and keeps the history after a project is deleted."
                  iconBg="rgba(245,158,11,0.12)"
                  iconColor="#f59e0b"
                  borderColor="rgba(245,158,11,0.3)"
                  delay={0.75}
                  curveY={0}
                  style={{ right: -10, top: 195 }}
                  x={rightCardX}
                  scaleValue={cardScale}
                  pathLength={pathLength}
                />
              </motion.div>
            )}
            {showCards && (
              <motion.div
                style={{
                  opacity: 1,
                  scale: 1,
                }}
              >
                <FloatingCard
                  side="right"
                  icon={<Database size={20} />}
                  title="MongoDB Database"
                  description="Stores hierarchical task trees, project documents, and user schemas with Mongoose."
                  iconBg="rgba(34,197,94,0.12)"
                  iconColor="#22c55e"
                  borderColor="rgba(34,197,94,0.35)"
                  delay={0.85}
                  curveY={-15}
                  style={{ right: -10, top: 350 }}
                  x={rightCardX}
                  scaleValue={cardScale}
                  pathLength={pathLength}
                />
              </motion.div>
            )}

          </motion.div>

        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 1024px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            gap: 60px !important;
          }
        }
      `}</style>
    </section>
  )
}
