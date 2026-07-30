import { useMemo, useState, type ReactNode } from 'react'
import type { TrialStatus } from '../lib/api'
import { DIFFICULTY_COLOR, STATUS_LABEL, failureColor } from '../lib/colors'

export function Card({
  title,
  note,
  actions,
  children,
  flush,
  className = '',
}: {
  title?: string
  note?: string
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <section className={`card${flush ? ' flush' : ''} ${className}`}>
      {(title || actions) && (
        <header className="card-head" style={flush ? { padding: '14px 16px 0' } : undefined}>
          {title && <h3 className="card-title">{title}</h3>}
          {note && <span className="card-note">{note}</span>}
          <div style={{ flex: 1 }} />
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  unit,
  foot,
  accent,
}: {
  label: string
  value: ReactNode
  unit?: string
  foot?: ReactNode
  accent?: string
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </span>
      {foot && <span className="stat-foot">{foot}</span>}
    </div>
  )
}

/** Status always ships as colour + glyph + word — never colour alone. */
export function StatusBadge({ status }: { status: TrialStatus }) {
  const glyph = { resolved: '✓', unresolved: '✗', errored: '!', timeout: '⏱' }[status]
  return (
    <span className={`badge ${status}`}>
      <span aria-hidden>{glyph}</span>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function FailureChip({ category, label }: { category: string | null; label?: string }) {
  if (!category) return <span className="muted small">—</span>
  return (
    <span className="badge">
      <span className="dot" style={{ background: failureColor(category) }} />
      {label || category.replace(/_/g, ' ')}
    </span>
  )
}

export function DifficultyTag({ level }: { level?: string }) {
  if (!level) return null
  return (
    <span className="hstack" style={{ gap: 5 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: DIFFICULTY_COLOR[level] || 'var(--text-muted)',
          display: 'inline-block',
        }}
      />
      <span className="diff-tag">{level}</span>
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Loading({ what = 'data' }: { what?: string }) {
  return <div className="loading">Loading {what}…</div>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="callout">
      <span className="ci">✗</span>
      <div>
        <div className="ct">Could not load</div>
        <div className="cb mono">{message}</div>
        <div className="cb" style={{ marginTop: 6 }}>
          Is the API running? Start it with <code className="pill">npm run dev</code> from the project root.
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- table

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  width?: number | string
  sortValue?: (row: T) => number | string
  render: (row: T) => ReactNode
}

export function DataTable<T>({
  rows,
  columns,
  onRowClick,
  initialSort,
  emptyText = 'Nothing to show.',
  maxHeight,
}: {
  rows: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  emptyText?: string
  maxHeight?: number
}) {
  const [sort, setSort] = useState(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb)) * dir
    })
  }, [rows, sort, columns])

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  if (!rows.length) return <Empty>{emptyText}</Empty>

  return (
    <div className="table-wrap" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.sortValue ? 'sortable' : ''} ${c.align === 'right' ? 'num' : ''}`}
                style={c.width ? { width: c.width } : undefined}
                onClick={() => c.sortValue && toggle(c.key)}
              >
                {c.header}
                {sort?.key === c.key && <span style={{ marginLeft: 4 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={i}
              className={onRowClick ? 'clickable' : ''}
              onClick={() => onRowClick?.(r)}
            >
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --------------------------------------------------------------- code block

/** Renders text with diff colouring and optional term highlighting. */
export function CodeBlock({ text, highlight, tall }: { text: string; highlight?: string; tall?: boolean }) {
  const lines = text.split('\n')
  const term = highlight?.trim().toLowerCase()
  return (
    <pre className={`code${tall ? ' tall' : ''}`}>
      {lines.map((l, i) => {
        const cls = l.startsWith('+') && !l.startsWith('+++')
          ? 'add'
          : l.startsWith('-') && !l.startsWith('---')
            ? 'del'
            : l.startsWith('@@')
              ? 'hunk'
              : undefined
        if (!term || !l.toLowerCase().includes(term)) {
          return (
            <div key={i} className={cls}>
              {l || ' '}
            </div>
          )
        }
        const idx = l.toLowerCase().indexOf(term)
        return (
          <div key={i} className={cls}>
            {l.slice(0, idx)}
            <mark>{l.slice(idx, idx + term.length)}</mark>
            {l.slice(idx + term.length)}
          </div>
        )
      })}
    </pre>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label?: string
}) {
  return (
    <label className="hstack" style={{ gap: 6 }}>
      {label && <span className="toolbar-label">{label}</span>}
      <select className="ctl" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
