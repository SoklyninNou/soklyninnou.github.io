/**
 * SVG chart primitives.
 *
 * Mark rules applied throughout: thin marks, 4px rounded data-ends anchored to
 * the baseline, hairline grid one shade off the surface, a 2px surface gap
 * between adjacent fills, and selective direct labels rather than a number on
 * every mark. Every chart has a hover layer; every chart that encodes by colour
 * ships a legend with text labels.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// ------------------------------------------------------------------ plumbing

export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(720)
  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(([e]) => {
      const next = Math.max(240, Math.floor(e.contentRect.width))
      setW((prev) => (Math.abs(prev - next) > 1 ? next : prev))
    })
    ro.observe(el)
    setW(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

interface TipState {
  x: number
  y: number
  title: string
  rows: [string, string][]
  note?: string
}

export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const show = useCallback((e: { clientX: number; clientY: number }, t: Omit<TipState, 'x' | 'y'>) => {
    setTip({ ...t, x: e.clientX, y: e.clientY })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  const node = tip ? <Tooltip {...tip} /> : null
  return { show, hide, node }
}

function Tooltip({ x, y, title, rows, note }: TipState) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let left = x + 14
    let top = y + 14
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [x, y, title])
  return (
    <div className="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <div className="tt-title">{title}</div>
      {rows.map(([k, v]) => (
        <div className="tt-row" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
      {note && <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 11.5 }}>{note}</div>}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span className="legend-item" key={i.label}>
          <span className="legend-swatch" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Rounded only on the data end, so the mark stays anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number, dir: 'up' | 'right') {
  const rr = Math.max(0, Math.min(r, dir === 'up' ? h : w, dir === 'up' ? w / 2 : h / 2))
  if (h <= 0 || w <= 0) return ''
  if (dir === 'up') {
    return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
  }
  return `M${x},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} L${x},${y + h} Z`
}

/**
 * Truncate to what actually fits the gutter. Slicing at a fixed character count
 * clips against the SVG edge as soon as the label is wider than the gutter.
 */
export function fitLabel(text: string, widthPx: number, fontPx = 12) {
  const maxChars = Math.max(4, Math.floor((widthPx - 12) / (fontPx * 0.55)))
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
}

const niceTicks = (max: number, count = 4) => {
  if (max <= 0) return [0]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10
  const out: number[] = []
  for (let v = 0; v <= max * 1.0001; v += step) out.push(v)
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step)
  return out
}

// -------------------------------------------------------------- horiz. bars

export function HBarChart({
  data,
  height,
  formatValue = (v) => String(Math.round(v)),
  color = 'var(--series-1)',
  labelWidth = 168,
  onClick,
  highlight,
  domainMax,
}: {
  data: { label: string; value: number; sub?: string; color?: string; id?: string }[]
  height?: number
  formatValue?: (v: number) => string
  color?: string
  labelWidth?: number
  onClick?: (id: string) => void
  highlight?: string
  domainMax?: number
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const rowH = 30
  const gap = 8
  const h = height ?? data.length * (rowH + gap) + 26
  const plotW = Math.max(60, w - labelWidth - 62)
  const max = domainMax ?? Math.max(...data.map((d) => d.value), 1)
  const ticks = niceTicks(max)
  const scale = (v: number) => (v / (ticks[ticks.length - 1] || 1)) * plotW

  return (
    <div ref={ref}>
      <svg width="100%" height={h} role="img">
        {ticks.map((t) => (
          <line
            key={t}
            className="grid"
            x1={labelWidth + scale(t)}
            x2={labelWidth + scale(t)}
            y1={0}
            y2={h - 20}
          />
        ))}
        {ticks.map((t) => (
          <text key={`l${t}`} className="axis" x={labelWidth + scale(t)} y={h - 6} textAnchor="middle">
            {formatValue(t)}
          </text>
        ))}
        {data.map((d, i) => {
          const y = i * (rowH + gap)
          const bw = Math.max(d.value > 0 ? 2 : 0, scale(d.value))
          const dim = highlight && d.id && highlight !== d.id
          return (
            <g
              key={d.label + i}
              style={{ cursor: onClick && d.id ? 'pointer' : 'default', opacity: dim ? 0.45 : 1 }}
              onClick={() => onClick && d.id && onClick(d.id)}
              onMouseMove={(e) =>
                show(e, {
                  title: d.label,
                  rows: [['Value', formatValue(d.value)], ...(d.sub ? ([['Detail', d.sub]] as [string, string][]) : [])],
                })
              }
              onMouseLeave={hide}
            >
              <rect x={0} y={y} width={Math.max(w, 1)} height={rowH} fill="transparent" />
              <text className="axis" x={labelWidth - 10} y={y + rowH / 2 + 4} textAnchor="end" style={{ fontSize: 12 }}>
                {fitLabel(d.label, labelWidth)}
              </text>
              <path d={barPath(labelWidth, y + 7, bw, rowH - 14, 4, 'right')} fill={d.color || color} />
              <text
                className="axis"
                x={labelWidth + bw + 8}
                y={y + rowH / 2 + 4}
                style={{ fontSize: 11.5, fill: 'var(--text-secondary)', fontWeight: 550 }}
              >
                {formatValue(d.value)}
              </text>
            </g>
          )
        })}
      </svg>
      {node}
    </div>
  )
}

// ------------------------------------------------------------------ columns

export function Histogram({
  bins,
  height = 150,
  color = 'var(--series-1)',
  formatX = (v: number) => String(Math.round(v)),
  xTitle,
}: {
  bins: { x0: number; x1: number; count: number }[]
  height?: number
  color?: string
  formatX?: (v: number) => string
  xTitle?: string
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const padL = 34
  const padB = xTitle ? 34 : 22
  const plotW = Math.max(40, w - padL - 10)
  const plotH = height - padB - 8
  const max = Math.max(...bins.map((b) => b.count), 1)
  const ticks = niceTicks(max, 3)
  const top = ticks[ticks.length - 1] || 1
  const bw = plotW / Math.max(bins.length, 1)

  return (
    <div ref={ref}>
      <svg width="100%" height={height} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={padL + plotW} y1={8 + plotH - (t / top) * plotH} y2={8 + plotH - (t / top) * plotH} />
            <text className="axis" x={padL - 7} y={8 + plotH - (t / top) * plotH + 3.5} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {bins.map((b, i) => {
          const bh = (b.count / top) * plotH
          return (
            <g
              key={i}
              onMouseMove={(e) =>
                show(e, {
                  title: `${formatX(b.x0)} – ${formatX(b.x1)}`,
                  rows: [['Trials', String(b.count)]],
                })
              }
              onMouseLeave={hide}
            >
              <rect x={padL + i * bw} y={8} width={bw} height={plotH} fill="transparent" />
              {/* 2px surface gap between adjacent fills */}
              <path d={barPath(padL + i * bw + 1, 8 + plotH - bh, Math.max(1, bw - 2), bh, 4, 'up')} fill={color} />
            </g>
          )
        })}
        <line className="baseline" x1={padL} x2={padL + plotW} y1={8 + plotH} y2={8 + plotH} />
        <text className="axis" x={padL} y={height - (xTitle ? 18 : 6)}>
          {formatX(bins[0]?.x0 ?? 0)}
        </text>
        <text className="axis" x={padL + plotW} y={height - (xTitle ? 18 : 6)} textAnchor="end">
          {formatX(bins[bins.length - 1]?.x1 ?? 0)}
        </text>
        {xTitle && (
          <text className="axis-title" x={padL + plotW / 2} y={height - 4} textAnchor="middle">
            {xTitle}
          </text>
        )}
      </svg>
      {node}
    </div>
  )
}

// ------------------------------------------------------------- stacked bars

export function StackedBar({
  rows,
  keys,
  colors,
  labels,
  height,
  onSegment,
}: {
  rows: { label: string; id: string; values: Record<string, number> }[]
  keys: string[]
  colors: Record<string, string>
  labels: Record<string, string>
  height?: number
  onSegment?: (rowId: string, key: string) => void
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const labelWidth = 168
  const rowH = 26
  const gap = 10
  const h = height ?? rows.length * (rowH + gap) + 10
  const plotW = Math.max(60, w - labelWidth - 44)
  const max = Math.max(...rows.map((r) => keys.reduce((a, k) => a + (r.values[k] || 0), 0)), 1)

  return (
    <div ref={ref}>
      <svg width="100%" height={h} role="img">
        {rows.map((r, i) => {
          const y = i * (rowH + gap)
          const total = keys.reduce((a, k) => a + (r.values[k] || 0), 0)
          let x = labelWidth
          return (
            <g key={r.id}>
              <text className="axis" x={labelWidth - 10} y={y + rowH / 2 + 4} textAnchor="end" style={{ fontSize: 12 }}>
                {fitLabel(r.label, labelWidth)}
              </text>
              {keys.map((k) => {
                const v = r.values[k] || 0
                if (!v) return null
                const segW = (v / max) * plotW
                const sx = x
                x += segW
                return (
                  <rect
                    key={k}
                    x={sx}
                    y={y + 5}
                    width={Math.max(1, segW - 2)} /* 2px surface gap between segments */
                    height={rowH - 10}
                    rx={2}
                    fill={colors[k]}
                    style={{ cursor: onSegment ? 'pointer' : 'default' }}
                    onClick={() => onSegment?.(r.id, k)}
                    onMouseMove={(e) =>
                      show(e, {
                        title: r.label,
                        rows: [
                          [labels[k] || k, String(v)],
                          ['Share', `${((v / (total || 1)) * 100).toFixed(0)}%`],
                        ],
                      })
                    }
                    onMouseLeave={hide}
                  />
                )
              })}
              <text
                className="axis"
                x={labelWidth + (total / max) * plotW + 8}
                y={y + rowH / 2 + 4}
                style={{ fontSize: 11.5, fill: 'var(--text-secondary)', fontWeight: 550 }}
              >
                {total}
              </text>
            </g>
          )
        })}
      </svg>
      {node}
    </div>
  )
}

// --------------------------------------------------------------- scatter

export function Scatter({
  points,
  height = 250,
  xLabel,
  yLabel,
  formatX = (v: number) => String(v),
  formatY = (v: number) => String(v),
  onClick,
}: {
  points: { id: string; x: number; y: number; label: string; note?: string }[]
  height?: number
  xLabel: string
  yLabel: string
  formatX?: (v: number) => string
  formatY?: (v: number) => string
  onClick?: (id: string) => void
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const padL = 44
  const padB = 38
  const padT = 14
  const padR = 16
  const plotW = Math.max(60, w - padL - padR)
  const plotH = height - padB - padT
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMax = niceTicks(Math.max(...xs, 0.001) * 1.15, 4)
  const yMax = niceTicks(Math.max(...ys, 1) * 1.15, 4)
  const xTop = xMax[xMax.length - 1]
  const yTop = yMax[yMax.length - 1]
  const sx = (v: number) => padL + (v / xTop) * plotW
  const sy = (v: number) => padT + plotH - (v / yTop) * plotH

  /**
   * Greedy label placement. Direct labels are the point of this chart (they are
   * what lets five series share one hue), so they must not overlap: try each
   * candidate offset in turn and keep the first that clears everything placed.
   */
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
  const labels = [...points]
    .sort((p, q) => p.x - q.x)
    .map((p) => {
      const cx = sx(p.x)
      const cy = sy(p.y)
      const wpx = p.label.length * 5.7 + 6
      const right = cx < padL + plotW * 0.6
      const candidates = [-10, 15, -24, 29, -38, 43]
      let chosen = candidates[0]
      for (const dy of candidates) {
        const x0 = right ? cx + 11 : cx - 11 - wpx
        const box = { x0, x1: x0 + wpx, y0: cy + dy - 9, y1: cy + dy + 3 }
        if (!placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) {
          chosen = dy
          placed.push(box)
          break
        }
      }
      return { id: p.id, dy: chosen, right }
    })
  const labelFor = new Map(labels.map((l) => [l.id, l]))

  return (
    <div ref={ref}>
      <svg width="100%" height={height} role="img">
        {yMax.map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={padL} x2={padL + plotW} y1={sy(t)} y2={sy(t)} />
            <text className="axis" x={padL - 7} y={sy(t) + 3.5} textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        {xMax.map((t) => (
          <text key={`x${t}`} className="axis" x={sx(t)} y={height - padB + 15} textAnchor="middle">
            {formatX(t)}
          </text>
        ))}
        <line className="baseline" x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} />
        <line className="baseline" x1={padL} x2={padL} y1={padT} y2={padT + plotH} />
        {points.map((p) => {
          const cx = sx(p.x)
          const cy = sy(p.y)
          // Direct-label each point: five labelled dots need no second hue.
          const lay = labelFor.get(p.id)
          const labelRight = lay?.right ?? true
          return (
            <g
              key={p.id}
              style={{ cursor: onClick ? 'pointer' : 'default' }}
              onClick={() => onClick?.(p.id)}
              onMouseMove={(e) =>
                show(e, {
                  title: p.label,
                  rows: [
                    [xLabel, formatX(p.x)],
                    [yLabel, formatY(p.y)],
                  ],
                  note: p.note,
                })
              }
              onMouseLeave={hide}
            >
              {/* generous invisible hit target */}
              <circle cx={cx} cy={cy} r={16} fill="transparent" />
              <circle cx={cx} cy={cy} r={6.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
              <text
                className="axis"
                x={labelRight ? cx + 11 : cx - 11}
                y={cy + (lay?.dy ?? -10)}
                textAnchor={labelRight ? 'start' : 'end'}
                style={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              >
                {p.label}
              </text>
            </g>
          )
        })}
        <text className="axis-title" x={padL + plotW / 2} y={height - 4} textAnchor="middle">
          {xLabel}
        </text>
        <text className="axis-title" transform={`translate(11,${padT + plotH / 2}) rotate(-90)`} textAnchor="middle">
          {yLabel}
        </text>
      </svg>
      {node}
    </div>
  )
}

// --------------------------------------------------------------- area/lines

export function AreaChart({
  series,
  height = 160,
  formatX = (v: number) => String(v),
  formatY = (v: number) => String(v),
  yMaxOverride,
  markers = [],
  threshold,
}: {
  series: { label: string; color: string; points: { x: number; y: number }[] }[]
  height?: number
  formatX?: (v: number) => string
  formatY?: (v: number) => string
  yMaxOverride?: number
  markers?: { x: number; label: string; color?: string }[]
  threshold?: { y: number; label: string }
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const [hoverX, setHoverX] = useState<number | null>(null)
  const padL = 44
  const padB = 22
  const padT = 12
  const plotW = Math.max(60, w - padL - 14)
  const plotH = height - padB - padT
  const all = series.flatMap((s) => s.points)
  const xMin = Math.min(...all.map((p) => p.x), 0)
  const xMax = Math.max(...all.map((p) => p.x), 1)
  const yTopRaw = yMaxOverride ?? Math.max(...all.map((p) => p.y), 1)
  const yTicks = niceTicks(yTopRaw, 3)
  const yTop = Math.max(yTicks[yTicks.length - 1], yTopRaw)
  const sx = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * plotW
  const sy = (v: number) => padT + plotH - (v / yTop) * plotH

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const val = xMin + ((px - padL) / plotW) * (xMax - xMin)
    setHoverX(val)
    const rows: [string, string][] = series.map((s) => {
      let best = s.points[0]
      for (const p of s.points) if (Math.abs(p.x - val) < Math.abs(best.x - val)) best = p
      return [s.label, formatY(best.y)]
    })
    show(e, { title: formatX(val), rows })
  }

  return (
    <div ref={ref}>
      <svg
        width="100%"
        height={height}
        role="img"
        onMouseMove={onMove}
        onMouseLeave={() => {
          hide()
          setHoverX(null)
        }}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={padL + plotW} y1={sy(t)} y2={sy(t)} />
            <text className="axis" x={padL - 7} y={sy(t) + 3.5} textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        {threshold && (
          <g>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={sy(threshold.y)}
              y2={sy(threshold.y)}
              stroke="var(--critical)"
              strokeWidth={1.5}
            />
            <text className="axis" x={padL + plotW} y={sy(threshold.y) - 5} textAnchor="end" style={{ fill: 'var(--critical)' }}>
              {threshold.label}
            </text>
          </g>
        )}
        {series.map((s) => {
          const pts = s.points
          if (!pts.length) return null
          const line = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ')
          const area = `${line} L${sx(pts[pts.length - 1].x)},${padT + plotH} L${sx(pts[0].x)},${padT + plotH} Z`
          return (
            <g key={s.label}>
              <path d={area} fill={s.color} opacity={0.13} />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}
        {markers.map((m, i) => (
          <g key={i}>
            <line x1={sx(m.x)} x2={sx(m.x)} y1={padT} y2={padT + plotH} stroke={m.color || 'var(--text-muted)'} strokeWidth={1} opacity={0.6} />
          </g>
        ))}
        {hoverX !== null && (
          <line x1={sx(hoverX)} x2={sx(hoverX)} y1={padT} y2={padT + plotH} stroke="var(--text-muted)" strokeWidth={1} />
        )}
        <line className="baseline" x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} />
        <text className="axis" x={padL} y={height - 6}>
          {formatX(xMin)}
        </text>
        <text className="axis" x={padL + plotW} y={height - 6} textAnchor="end">
          {formatX(xMax)}
        </text>
      </svg>
      {node}
    </div>
  )
}

/** Normalised stacked bands — "what share of effort went where, over time". */
export function BandChart({
  buckets,
  keys,
  colors,
  labels,
  height = 150,
}: {
  buckets: Record<string, number>[]
  keys: string[]
  colors: Record<string, string>
  labels: Record<string, string>
  height?: number
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const padL = 36
  const padB = 24
  const padT = 8
  const plotW = Math.max(60, w - padL - 12)
  const plotH = height - padB - padT
  const bw = plotW / Math.max(buckets.length, 1)

  return (
    <div ref={ref}>
      <svg width="100%" height={height} role="img">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line className="grid" x1={padL} x2={padL + plotW} y1={padT + plotH - t * plotH} y2={padT + plotH - t * plotH} />
            <text className="axis" x={padL - 7} y={padT + plotH - t * plotH + 3.5} textAnchor="end">
              {t * 100}%
            </text>
          </g>
        ))}
        {buckets.map((b, i) => {
          let acc = 0
          return (
            <g
              key={i}
              onMouseMove={(e) =>
                show(e, {
                  title: `${Math.round((i / buckets.length) * 100)}–${Math.round(((i + 1) / buckets.length) * 100)}% through the run`,
                  rows: keys
                    .filter((k) => (b[k] || 0) > 0.005)
                    .map((k) => [labels[k] || k, `${((b[k] || 0) * 100).toFixed(0)}%`] as [string, string]),
                })
              }
              onMouseLeave={hide}
            >
              <rect x={padL + i * bw} y={padT} width={bw} height={plotH} fill="transparent" />
              {keys.map((k) => {
                const v = b[k] || 0
                const segH = v * plotH
                const y = padT + plotH - acc - segH
                acc += segH
                if (segH < 0.4) return null
                return <rect key={k} x={padL + i * bw + 1} y={y} width={Math.max(1, bw - 2)} height={segH} fill={colors[k]} />
              })}
            </g>
          )
        })}
        <line className="baseline" x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} />
        <text className="axis" x={padL} y={height - 8}>
          start
        </text>
        <text className="axis" x={padL + plotW} y={height - 8} textAnchor="end">
          end
        </text>
      </svg>
      {node}
    </div>
  )
}

// ---------------------------------------------------------------- heatmap

export function Heatmap<T>({
  rows,
  cols,
  cell,
  cellSize = 22,
  rowLabelWidth = 176,
  onCellClick,
  legend,
}: {
  rows: { id: string; label: string }[]
  cols: { id: string; label: string }[]
  cell: (rowId: string, colId: string) => { color: string; title: string; rows: [string, string][]; value?: T } | null
  cellSize?: number
  rowLabelWidth?: number
  onCellClick?: (rowId: string, colId: string) => void
  legend?: ReactNode
}) {
  const { show, hide, node } = useTooltip()
  const gap = 3
  const w = rowLabelWidth + cols.length * (cellSize + gap)
  const headH = 76
  const h = headH + rows.length * (cellSize + gap)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={w} height={h} role="img">
        {cols.map((c, ci) => (
          <text
            key={c.id}
            className="axis"
            transform={`translate(${rowLabelWidth + ci * (cellSize + gap) + cellSize / 2},${headH - 8}) rotate(-42)`}
            style={{ fontSize: 11 }}
          >
            {c.label.length > 18 ? c.label.slice(0, 17) + '…' : c.label}
          </text>
        ))}
        {rows.map((r, ri) => (
          <g key={r.id}>
            <text
              className="axis"
              x={rowLabelWidth - 9}
              y={headH + ri * (cellSize + gap) + cellSize / 2 + 4}
              textAnchor="end"
              style={{ fontSize: 11, fontFamily: 'var(--mono)' }}
            >
              {r.label.length > 24 ? r.label.slice(0, 23) + '…' : r.label}
            </text>
            {cols.map((c, ci) => {
              const d = cell(r.id, c.id)
              if (!d) return null
              return (
                <rect
                  key={c.id}
                  className="heat-cell"
                  x={rowLabelWidth + ci * (cellSize + gap)}
                  y={headH + ri * (cellSize + gap)}
                  width={cellSize}
                  height={cellSize}
                  rx={4}
                  fill={d.color}
                  onClick={() => onCellClick?.(r.id, c.id)}
                  onMouseMove={(e) => show(e, { title: d.title, rows: d.rows })}
                  onMouseLeave={hide}
                />
              )
            })}
          </g>
        ))}
      </svg>
      {legend}
      {node}
    </div>
  )
}

// ------------------------------------------------------------------ meter

export function Meter({ value, max = 100, color = 'var(--series-1)', height = 6 }: { value: number; max?: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div style={{ background: 'var(--grid)', borderRadius: 999, height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  )
}

export function Sparkline({
  points,
  color = 'var(--series-1)',
  width = 90,
  height = 22,
}: {
  points: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (!points.length) return null
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const d = points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * width
      const y = height - ((p - min) / (max - min || 1)) * height
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Escape-key helper used by overlays. */
export function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fn()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fn])
}
