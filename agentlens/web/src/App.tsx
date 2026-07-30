import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api, useApi } from './lib/api'
import Overview from './pages/Overview'
import Runs from './pages/Runs'
import RunDetail from './pages/RunDetail'
import Trials from './pages/Trials'
import Trace from './pages/Trace'
import Tasks from './pages/Tasks'
import TaskDetail from './pages/TaskDetail'
import Failures from './pages/Failures'
import Compare from './pages/Compare'
import Search from './pages/Search'

type Theme = 'light' | 'dark' | 'system'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('al-theme') as Theme) || 'system')
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    localStorage.setItem('al-theme', theme)
  }, [theme])
  return [theme, setTheme] as const
}

const NAV = [
  {
    group: 'Evaluate',
    items: [
      { to: '/', label: 'Overview', icon: '◎', end: true },
      { to: '/runs', label: 'Runs', icon: '▤' },
      { to: '/tasks', label: 'Tasks', icon: '❑' },
    ],
  },
  {
    group: 'Debug',
    items: [
      { to: '/trials', label: 'Traces', icon: '≡' },
      { to: '/failures', label: 'Failures', icon: '⚠' },
      { to: '/compare', label: 'Compare', icon: '⇄' },
      { to: '/search', label: 'Search', icon: '⌕' },
    ],
  },
]

function Breadcrumbs() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length) return <span className="cur">Overview</span>
  const label: Record<string, string> = {
    runs: 'Runs',
    trials: 'Traces',
    tasks: 'Tasks',
    failures: 'Failures',
    compare: 'Compare',
    search: 'Search',
  }
  return (
    <>
      <NavLink to={`/${parts[0]}`}>{label[parts[0]] || parts[0]}</NavLink>
      {parts.length > 1 && (
        <>
          <span className="sep">/</span>
          <span className="cur">{decodeURIComponent(parts[1])}</span>
        </>
      )}
    </>
  )
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const nav = useNavigate()
  const { data: meta } = useApi(() => api.meta(), [])
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const counts = meta?.counts

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AL</div>
          <div>
            <div className="brand-name">AgentLens</div>
            <div className="brand-sub">swe-bench-verified</div>
          </div>
        </div>

        {NAV.map((g) => (
          <div key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="ico" aria-hidden>
                  {i.icon}
                </span>
                {i.label}
                {counts && i.label === 'Runs' && <span className="nav-count">{counts.runs}</span>}
                {counts && i.label === 'Tasks' && <span className="nav-count">{counts.tasks}</span>}
                {counts && i.label === 'Traces' && <span className="nav-count">{counts.trials}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <div className="nav-group-label">Dataset</div>
        <div className="small muted" style={{ padding: '0 10px 10px', lineHeight: 1.7 }}>
          {counts ? (
            <>
              {counts.spans.toLocaleString()} spans across {counts.trials} trials
              <br />
              {counts.runs} agent configurations
            </>
          ) : (
            '…'
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs">
            <NavLink to="/">AgentLens</NavLink>
            <span className="sep">/</span>
            <Breadcrumbs />
          </nav>
          <div className="spacer" />
          <form
            className="searchbox"
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`)
            }}
          >
            <span className="muted" aria-hidden>
              ⌕
            </span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search span contents…"
              aria-label="Search span contents"
            />
            <span className="k">/</span>
          </form>
          <button
            className="iconbtn"
            title={`Theme: ${theme}`}
            aria-label={`Switch theme (currently ${theme})`}
            onClick={() => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')}
          >
            {theme === 'light' ? '☀' : theme === 'dark' ? '☾' : '◐'}
          </button>
        </header>

        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/runs/:id" element={<RunDetail />} />
          <Route path="/trials" element={<Trials />} />
          <Route path="/trials/:id" element={<Trace />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/failures" element={<Failures />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </div>
    </div>
  )
}
