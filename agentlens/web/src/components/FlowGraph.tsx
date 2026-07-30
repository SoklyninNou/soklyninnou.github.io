/**
 * Aggregated action-transition graph for a run.
 *
 * Every trajectory in the run is collapsed into "which action followed which",
 * so a whole run's behaviour reads at a glance: a healthy run flows
 * start → search → read → edit → test → submit, while a stalling run shows a
 * fat self-loop on search and a thin trickle reaching test.
 *
 * Layout is a BFS layering from `start`, so the graph reads left to right.
 * Edge width encodes frequency; self-loops are drawn as arcs above the node.
 */
import { useMemo, useState } from 'react'
import { useMeasure, useTooltip } from './charts'

interface Node {
  id: string
  count: number
  errors: number
}
interface Edge {
  source: string
  target: string
  count: number
}

const NICE: Record<string, string> = {
  start: 'start',
  end: 'end',
  bash: 'bash',
  search_repo: 'search',
  bm25_retrieve: 'retrieve',
  read_file: 'read',
  str_replace: 'edit',
  python: 'python',
  submit: 'submit',
  test: 'test',
}

export function FlowGraph({
  nodes,
  edges,
  height = 320,
}: {
  nodes: Node[]
  edges: Edge[]
  height?: number
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node: tip } = useTooltip()
  const [hover, setHover] = useState<string | null>(null)

  const layout = useMemo(() => {
    const ids = nodes.map((n) => n.id)
    const adj = new Map<string, string[]>()
    for (const e of edges) {
      if (e.source === e.target) continue
      if (!adj.has(e.source)) adj.set(e.source, [])
      adj.get(e.source)!.push(e.target)
    }
    // BFS from start gives a stable left→right rank.
    const rank = new Map<string, number>()
    rank.set('start', 0)
    const queue = ['start']
    while (queue.length) {
      const cur = queue.shift()!
      for (const nxt of adj.get(cur) || []) {
        if (!rank.has(nxt)) {
          rank.set(nxt, (rank.get(cur) || 0) + 1)
          queue.push(nxt)
        }
      }
    }
    let maxRank = 0
    for (const id of ids) {
      if (!rank.has(id)) rank.set(id, 1)
      maxRank = Math.max(maxRank, rank.get(id)!)
    }
    // `end` always sits in the last column.
    if (rank.has('end')) rank.set('end', maxRank)

    const cols = new Map<number, string[]>()
    for (const id of ids) {
      const r = rank.get(id)!
      if (!cols.has(r)) cols.set(r, [])
      cols.get(r)!.push(id)
    }
    for (const [, list] of cols) {
      list.sort((a, b) => (nodes.find((n) => n.id === b)?.count || 0) - (nodes.find((n) => n.id === a)?.count || 0))
    }

    const padX = 46
    const padY = 46
    const plotW = Math.max(200, w - padX * 2)
    const plotH = height - padY * 2
    const pos = new Map<string, { x: number; y: number; r: number }>()
    const maxCount = Math.max(...nodes.map((n) => n.count), 1)
    for (const [r, list] of cols) {
      const x = padX + (maxRank === 0 ? plotW / 2 : (r / maxRank) * plotW)
      list.forEach((id, i) => {
        const n = nodes.find((nn) => nn.id === id)!
        const y = padY + ((i + 0.5) / list.length) * plotH
        const radius = 11 + 15 * Math.sqrt(n.count / maxCount)
        pos.set(id, { x, y, r: id === 'start' || id === 'end' ? 13 : radius })
      })
    }
    return { pos, maxCount }
  }, [nodes, edges, w, height])

  const maxEdge = Math.max(...edges.map((e) => e.count), 1)

  return (
    <div ref={ref}>
      <svg width="100%" height={height} role="img">
        <defs>
          <marker id="fg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--baseline)" />
          </marker>
          <marker id="fg-arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--series-1)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = layout.pos.get(e.source)
          const b = layout.pos.get(e.target)
          if (!a || !b) return null
          const active = hover === e.source || hover === e.target
          const width = 1 + 5 * (e.count / maxEdge)

          if (e.source === e.target) {
            // Self-loop: an arc above the node. For an agent, this is repetition.
            const r = a.r + 9
            const d = `M${a.x - r * 0.6},${a.y - a.r} A${r},${r} 0 1 1 ${a.x + r * 0.6},${a.y - a.r}`
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={active ? 'var(--series-1)' : 'var(--baseline)'}
                strokeWidth={width}
                markerEnd={active ? 'url(#fg-arrow-hi)' : 'url(#fg-arrow)'}
                opacity={active ? 1 : 0.75}
                onMouseMove={(ev) => show(ev, { title: `${nice(e.source)} → itself`, rows: [['transitions', String(e.count)]], note: 'Repeated the same action back-to-back.' })}
                onMouseLeave={hide}
              />
            )
          }

          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy) || 1
          const ux = dx / dist
          const uy = dy / dist
          const x1 = a.x + ux * a.r
          const y1 = a.y + uy * a.r
          const x2 = b.x - ux * (b.r + 7)
          const y2 = b.y - uy * (b.r + 7)
          const back = b.x < a.x
          const bend = back ? 46 : 18
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2 - bend
          return (
            <path
              key={i}
              d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
              fill="none"
              stroke={active ? 'var(--series-1)' : 'var(--baseline)'}
              strokeWidth={width}
              markerEnd={active ? 'url(#fg-arrow-hi)' : 'url(#fg-arrow)'}
              opacity={active ? 1 : hover ? 0.25 : 0.7}
              onMouseMove={(ev) =>
                show(ev, { title: `${nice(e.source)} → ${nice(e.target)}`, rows: [['transitions', String(e.count)]] })
              }
              onMouseLeave={hide}
            />
          )
        })}

        {nodes.map((n) => {
          const p = layout.pos.get(n.id)
          if (!p) return null
          const terminal = n.id === 'start' || n.id === 'end'
          const errRate = n.count ? n.errors / n.count : 0
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => {
                setHover(null)
                hide()
              }}
              onMouseMove={(e) =>
                show(e, {
                  title: nice(n.id),
                  rows: [
                    ['calls', n.count.toLocaleString()],
                    ...(terminal ? [] : ([['error rate', `${(errRate * 100).toFixed(1)}%`]] as [string, string][])),
                  ],
                })
              }
              style={{ cursor: 'default' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={terminal ? 'var(--surface-2)' : 'color-mix(in srgb, var(--series-1) 22%, var(--surface-1))'}
                stroke={errRate > 0.05 ? 'var(--critical)' : 'var(--border-strong)'}
                strokeWidth={errRate > 0.05 ? 2 : 1}
              />
              {errRate > 0.05 && (
                <text x={p.x + p.r - 2} y={p.y - p.r + 6} style={{ fontSize: 10, fill: 'var(--critical)' }}>
                  ⚠
                </text>
              )}
              <text
                x={p.x}
                y={p.y + p.r + 13}
                textAnchor="middle"
                className="axis"
                style={{ fontSize: 11, fill: 'var(--text-primary)', fontWeight: 550 }}
              >
                {nice(n.id)}
              </text>
              <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: 10.5, fill: 'var(--text-secondary)' }}>
                {terminal ? '' : n.count}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span className="legend-item">Node size = call volume</span>
        <span className="legend-item">Edge width = transition frequency</span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--critical)' }} /> ⚠ error rate above 5%
        </span>
      </div>
      {tip}
    </div>
  )
}

const nice = (id: string) => NICE[id] || id
