/**
 * The trace timeline.
 *
 * Answers two questions directly: "what was the agent doing at time T" (the
 * playhead + the row under it) and "where did it go wrong" (the failure span is
 * pinned and outlined; error spans carry both a colour and a glyph, so the
 * signal never rests on hue alone).
 *
 * Interaction split: clicking the axis moves the playhead, clicking a row
 * selects that span, dragging across the axis zooms.
 */
import { useMemo, useState } from 'react'
import type { Span, TrialEvent } from '../lib/api'
import { KIND_COLOR, KIND_LABEL, spanBucket } from '../lib/colors'
import { fmtClock, fmtDuration } from '../lib/format'
import { Legend, useMeasure, useTooltip } from './charts'

const ROW_H = 19
const LABEL_W = 218
const AXIS_H = 28

export function Waterfall({
  spans,
  events,
  selectedId,
  onSelect,
  playhead,
  onScrub,
  failureSpanId,
  height = 430,
}: {
  spans: Span[]
  events: TrialEvent[]
  selectedId: string | null
  onSelect: (id: string) => void
  playhead: number
  onScrub: (ms: number) => void
  failureSpanId: string | null
  height?: number
}) {
  const { show, hide, node } = useTooltip()
  const [wrapRef, wrapW] = useMeasure<HTMLDivElement>()
  const [domain, setDomain] = useState<[number, number] | null>(null)
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null)

  const rows = useMemo(() => spans.filter((s) => s.depth > 0), [spans])
  const total = useMemo(() => Math.max(...spans.map((s) => s.end_ms), 1), [spans])
  const [t0, t1] = domain ?? [0, total]
  const span = Math.max(1, t1 - t0)
  const plotW = Math.max(160, wrapW - LABEL_W - 16)

  const sx = (ms: number) => LABEL_W + ((ms - t0) / span) * plotW
  const unsx = (px: number) => t0 + ((px - LABEL_W) / plotW) * span

  const ticks = useMemo(() => {
    const n = 6
    return Array.from({ length: n + 1 }, (_, i) => t0 + (i * span) / n)
  }, [t0, span])

  const bodyH = Math.max(rows.length * ROW_H, 40)

  const localX = (clientX: number) => {
    const el = wrapRef.current
    if (!el) return 0
    return clientX - el.getBoundingClientRect().left
  }

  const onAxisUp = (e: React.MouseEvent) => {
    if (drag && Math.abs(drag.x1 - drag.x0) > 12) {
      const a = unsx(Math.min(drag.x0, drag.x1))
      const b = unsx(Math.max(drag.x0, drag.x1))
      setDomain([Math.max(0, a), Math.min(total, b)])
    } else {
      // A click without a meaningful drag scrubs the playhead.
      const ms = unsx(localX(e.clientX))
      onScrub(Math.max(0, Math.min(total, Math.round(ms))))
    }
    setDrag(null)
  }

  const legendItems = (['llm', 'search', 'read', 'edit', 'test', 'system'] as const).map((k) => ({
    label: KIND_LABEL[k],
    color: KIND_COLOR[k],
  }))

  return (
    <div>
      <div className="hstack" style={{ marginBottom: 8 }}>
        <span className="card-note">Click the axis to move the playhead · drag it to zoom · click a bar to inspect</span>
        <div style={{ flex: 1 }} />
        {domain && (
          <button className="btn" onClick={() => setDomain(null)}>
            Reset zoom
          </button>
        )}
      </div>

      <div ref={wrapRef} className="waterfall">
        <svg
          width="100%"
          height={AXIS_H}
          style={{ display: 'block', cursor: 'ew-resize' }}
          onMouseDown={(e) => setDrag({ x0: localX(e.clientX), x1: localX(e.clientX) })}
          onMouseMove={(e) => drag && setDrag({ ...drag, x1: localX(e.clientX) })}
          onMouseUp={onAxisUp}
          onMouseLeave={() => setDrag(null)}
          onDoubleClick={() => setDomain(null)}
        >
          {ticks.map((t, i) => (
            <text key={i} className="axis" x={sx(t)} y={AXIS_H - 11} textAnchor={i === 0 ? 'start' : 'middle'}>
              {fmtClock(t)}
            </text>
          ))}
          {events.map((ev) =>
            ev.t_ms >= t0 && ev.t_ms <= t1 ? (
              <circle
                key={ev.id}
                cx={sx(ev.t_ms)}
                cy={AXIS_H - 5}
                r={3.5}
                fill={
                  ev.level === 'error'
                    ? 'var(--critical)'
                    : ev.level === 'warn'
                      ? 'var(--warning)'
                      : 'var(--text-muted)'
                }
                stroke="var(--surface-1)"
                strokeWidth={1.5}
                onMouseMove={(e) =>
                  show(e, { title: ev.message, rows: [['at', fmtClock(ev.t_ms)], ['signal', ev.kind]] })
                }
                onMouseLeave={hide}
              />
            ) : null,
          )}
          {drag && Math.abs(drag.x1 - drag.x0) > 2 && (
            <rect
              x={Math.min(drag.x0, drag.x1)}
              y={0}
              width={Math.abs(drag.x1 - drag.x0)}
              height={AXIS_H}
              fill="var(--series-1)"
              opacity={0.22}
            />
          )}
          <line className="baseline" x1={LABEL_W} x2={LABEL_W + plotW} y1={AXIS_H - 1} y2={AXIS_H - 1} />
        </svg>

        <div style={{ maxHeight: height, overflowY: 'auto', overflowX: 'hidden' }}>
          <svg width="100%" height={bodyH} style={{ display: 'block' }}>
            {ticks.map((t, i) => (
              <line key={i} className="grid" x1={sx(t)} x2={sx(t)} y1={0} y2={bodyH} />
            ))}

            {rows.map((s, i) => {
              const y = i * ROW_H
              const bucket = spanBucket(s)
              const isErr = s.status === 'error'
              const isFail = s.id === failureSpanId
              const x = sx(s.start_ms)
              const w = Math.max(2.5, ((s.end_ms - s.start_ms) / span) * plotW)
              const visible = s.end_ms >= t0 && s.start_ms <= t1
              const color = isErr ? 'var(--critical)' : KIND_COLOR[bucket]
              return (
                <g
                  key={s.id}
                  className={`wf-row${selectedId === s.id ? ' sel' : ''}`}
                  onClick={() => onSelect(s.id)}
                  onMouseMove={(e) =>
                    show(e, {
                      title: `${s.name}${s.target ? ` · ${s.target}` : ''}`,
                      rows: [
                        ['start', fmtClock(s.start_ms)],
                        ['duration', fmtDuration(s.duration_ms)],
                        ['status', s.status],
                        ...(s.tokens_in ? ([['tokens in', s.tokens_in.toLocaleString()]] as [string, string][]) : []),
                      ],
                      note: isFail ? 'This is where the run went wrong.' : undefined,
                    })
                  }
                  onMouseLeave={hide}
                >
                  <rect className="wf-bg" x={0} y={y} width="100%" height={ROW_H} fill="transparent" />
                  <text className="wf-label" x={6 + (s.depth - 1) * 11} y={y + 13}>
                    {(isErr ? '⚠ ' : '') + s.name}
                  </text>
                  <text
                    className="wf-label"
                    x={LABEL_W - 8}
                    y={y + 13}
                    textAnchor="end"
                    style={{ opacity: 0.55, fontSize: 10 }}
                  >
                    {s.type === 'llm' ? `#${s.step}` : ''}
                  </text>
                  {visible && (
                    <>
                      {isFail && (
                        <rect
                          x={x - 3}
                          y={y + 1}
                          width={w + 6}
                          height={ROW_H - 2}
                          rx={5}
                          fill="none"
                          stroke="var(--critical)"
                          strokeWidth={1.5}
                        />
                      )}
                      <rect x={x} y={y + 4.5} width={w} height={ROW_H - 9} rx={3} fill={color} />
                    </>
                  )}
                </g>
              )
            })}

            {playhead >= t0 && playhead <= t1 && (
              <line
                pointerEvents="none"
                x1={sx(playhead)}
                x2={sx(playhead)}
                y1={0}
                y2={bodyH}
                stroke="var(--text-primary)"
                strokeWidth={1.5}
              />
            )}
          </svg>
        </div>
      </div>

      <Legend items={legendItems} />
      {node}
    </div>
  )
}
