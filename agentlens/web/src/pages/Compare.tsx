import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, useApi, type Span, type Trial } from '../lib/api'
import { KIND_COLOR, KIND_LABEL, spanBucket } from '../lib/colors'
import { fmtClock, fmtCompact, fmtDuration, fmtUsd, taskShort } from '../lib/format'
import { Legend, useMeasure, useTooltip } from '../components/charts'
import { Card, ErrorState, Loading, Select, StatusBadge } from '../components/ui'

export default function Compare() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const ids = (params.get('ids') || '').split(',').filter(Boolean)

  const { data, error, loading } = useApi(
    () =>
      Promise.all([api.trials(), ids.length === 2 ? api.compare(ids) : Promise.resolve({ sides: [] })]).then(
        ([all, cmp]) => ({ all, sides: cmp.sides }),
      ),
    [params.toString()],
  )

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="comparison" /></div>
  if (!data) return null

  const options = data.all.map((t) => ({
    value: t.id,
    label: `${taskShort(t.task_id)} — ${t.run_name} (${t.status})`,
  }))

  const setSide = (i: number, v: string) => {
    const next = [...ids]
    next[i] = v
    setParams(new URLSearchParams({ ids: next.filter(Boolean).join(',') }))
  }

  const [a, b] = data.sides
  const sharedMax = a && b ? Math.max(a.trial.duration_ms, b.trial.duration_ms) : 1

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Compare traces</h1>
          <p className="page-sub">
            Put two attempts side by side on a shared time scale. Most useful on the same instance across two
            configurations — the divergence point tells you exactly where the better run pulled ahead.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <Select label="Left" value={ids[0] || ''} onChange={(v) => setSide(0, v)} options={[{ value: '', label: 'Choose a trace…' }, ...options]} />
        <Select label="Right" value={ids[1] || ''} onChange={(v) => setSide(1, v)} options={[{ value: '', label: 'Choose a trace…' }, ...options]} />
        <div style={{ flex: 1 }} />
        {a && b && a.trial.task_id !== b.trial.task_id && (
          <span className="small" style={{ color: 'var(--warning)' }}>
            ⚠ Different instances — metric deltas are not like-for-like.
          </span>
        )}
      </div>

      {!a || !b ? (
        <Card>
          <div className="empty">Pick two traces above to compare them.</div>
        </Card>
      ) : (
        <>
          <div className="grid g2">
            {[a, b].map((side, i) => (
              <Card key={i} title={i === 0 ? 'Left' : 'Right'}>
                <div className="hstack" style={{ marginBottom: 8 }}>
                  <StatusBadge status={side.trial.status} />
                  <span className="pill">{side.trial.run_name}</span>
                </div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {taskShort(side.trial.task_id)}
                </div>
                <div className="small muted" style={{ marginTop: 2 }}>
                  {side.trial.failure_summary || 'Resolved — all gating tests pass.'}
                </div>
                <div className="hstack" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => nav(`/trials/${side.trial.id}`)}>
                    Open full trace ↗
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <Card title="Metric deltas" note="right relative to left">
            <MetricDelta a={a.trial} b={b.trial} />
          </Card>

          <Card title="Timelines on a shared scale" note="same milliseconds per pixel, so length is comparable">
            <TraceStrip label="Left" spans={a.spans} max={sharedMax} failureSpanId={a.trial.failure_span_id} />
            <div style={{ height: 14 }} />
            <TraceStrip label="Right" spans={b.spans} max={sharedMax} failureSpanId={b.trial.failure_span_id} />
            <Legend
              items={(['llm', 'search', 'read', 'edit', 'test', 'system'] as const).map((k) => ({
                label: KIND_LABEL[k],
                color: KIND_COLOR[k],
              }))}
            />
          </Card>

          <Card title="Action sequences" note="the first row that differs is where the two agents diverged">
            <SequenceDiff a={a.spans} b={b.spans} />
          </Card>
        </>
      )}
    </div>
  )
}

function MetricDelta({ a, b }: { a: Trial; b: Trial }) {
  const rows: { label: string; a: number; b: number; fmt: (n: number) => string; lowerIsBetter: boolean }[] = [
    { label: 'Steps', a: a.steps, b: b.steps, fmt: (n) => String(Math.round(n)), lowerIsBetter: true },
    { label: 'Duration', a: a.duration_ms, b: b.duration_ms, fmt: fmtDuration, lowerIsBetter: true },
    { label: 'Cost', a: a.cost_usd, b: b.cost_usd, fmt: (n) => fmtUsd(n, 3), lowerIsBetter: true },
    { label: 'Tokens', a: a.tokens_in + a.tokens_out, b: b.tokens_in + b.tokens_out, fmt: (n) => fmtCompact(n), lowerIsBetter: true },
    { label: 'Tool calls', a: a.tool_calls, b: b.tool_calls, fmt: (n) => String(Math.round(n)), lowerIsBetter: true },
    { label: 'Tool errors', a: a.tool_errors, b: b.tool_errors, fmt: (n) => String(Math.round(n)), lowerIsBetter: true },
    { label: 'Context peak', a: a.context_peak_pct, b: b.context_peak_pct, fmt: (n) => `${n.toFixed(0)}%`, lowerIsBetter: true },
    { label: 'Fail-to-pass passed', a: a.f2p_passed, b: b.f2p_passed, fmt: (n) => String(Math.round(n)), lowerIsBetter: false },
  ]
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Metric</th>
            <th className="num">Left</th>
            <th className="num">Right</th>
            <th className="num">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.b - r.a
            const pct = r.a === 0 ? (r.b === 0 ? 0 : 100) : (diff / r.a) * 100
            const better = r.lowerIsBetter ? diff < 0 : diff > 0
            const neutral = Math.abs(pct) < 0.5
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num tnum">{r.fmt(r.a)}</td>
                <td className="num tnum">{r.fmt(r.b)}</td>
                <td
                  className="num tnum"
                  style={{ color: neutral ? 'var(--text-muted)' : better ? 'var(--success-text)' : 'var(--critical)' }}
                >
                  {neutral ? '—' : `${diff > 0 ? '+' : ''}${pct.toFixed(0)}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TraceStrip({
  label,
  spans,
  max,
  failureSpanId,
}: {
  label: string
  spans: Span[]
  max: number
  failureSpanId: string | null
}) {
  const [ref, w] = useMeasure<HTMLDivElement>()
  const { show, hide, node } = useTooltip()
  const H = 30
  const padL = 52
  const plotW = Math.max(80, w - padL - 60)
  const rows = spans.filter((s) => s.depth > 0)
  const dur = rows.length ? Math.max(...rows.map((s) => s.end_ms)) : 0

  return (
    <div ref={ref}>
      <svg width="100%" height={H + 16} role="img">
        <text className="axis" x={0} y={H / 2 + 4} style={{ fontSize: 11.5, fontWeight: 550, fill: 'var(--text-secondary)' }}>
          {label}
        </text>
        <rect x={padL} y={6} width={plotW} height={H - 12} rx={4} fill="var(--surface-2)" />
        {rows.map((s) => {
          const x = padL + (s.start_ms / max) * plotW
          const bw = Math.max(1.5, ((s.end_ms - s.start_ms) / max) * plotW)
          const isErr = s.status === 'error'
          return (
            <g key={s.id}>
              <rect
                x={x}
                y={7}
                width={bw}
                height={H - 14}
                fill={isErr ? 'var(--critical)' : KIND_COLOR[spanBucket(s)]}
                onMouseMove={(e) =>
                  show(e, {
                    title: `${s.name}${s.target ? ` · ${s.target}` : ''}`,
                    rows: [
                      ['start', fmtClock(s.start_ms)],
                      ['duration', fmtDuration(s.duration_ms)],
                    ],
                  })
                }
                onMouseLeave={hide}
              />
              {s.id === failureSpanId && (
                <rect x={x - 2} y={4} width={bw + 4} height={H - 8} rx={4} fill="none" stroke="var(--critical)" strokeWidth={1.5} />
              )}
            </g>
          )
        })}
        <text className="axis" x={padL + plotW + 8} y={H / 2 + 4}>
          {fmtDuration(dur)}
        </text>
      </svg>
      {node}
    </div>
  )
}

function SequenceDiff({ a, b }: { a: Span[]; b: Span[] }) {
  const seqA = useMemo(() => a.filter((s) => s.depth === 2 || s.type === 'patch'), [a])
  const seqB = useMemo(() => b.filter((s) => s.depth === 2 || s.type === 'patch'), [b])
  const key = (s: Span) => `${s.name}:${s.target ?? ''}`
  let diverge = 0
  while (diverge < Math.min(seqA.length, seqB.length) && key(seqA[diverge]) === key(seqB[diverge])) diverge++
  const len = Math.max(seqA.length, seqB.length)

  return (
    <div>
      <div className="small secondary" style={{ marginBottom: 10 }}>
        {diverge === 0
          ? 'The two runs took different actions from the very first step.'
          : `Identical for the first ${diverge} action${diverge === 1 ? '' : 's'}, then they diverge.`}
      </div>
      <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 42 }}>#</th>
              <th>Left</th>
              <th>Right</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: len }, (_, i) => {
              const x = seqA[i]
              const y = seqB[i]
              const same = x && y && key(x) === key(y)
              const isDiverge = i === diverge
              return (
                <tr key={i} style={isDiverge ? { background: 'color-mix(in srgb, var(--warning) 14%, transparent)' } : undefined}>
                  <td className="muted tnum">{i + 1}</td>
                  <td>{x ? <Action span={x} dim={!same} /> : <span className="muted small">—</span>}</td>
                  <td>{y ? <Action span={y} dim={!same} /> : <span className="muted small">—</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Action({ span, dim }: { span: Span; dim: boolean }) {
  return (
    <span className="hstack" style={{ gap: 6, opacity: dim ? 1 : 0.62 }}>
      <span
        style={{
          width: 3,
          height: 13,
          borderRadius: 2,
          background: span.status === 'error' ? 'var(--critical)' : KIND_COLOR[spanBucket(span)],
        }}
      />
      <span className="mono small">{span.name}</span>
      {span.target && <span className="muted small truncate" style={{ maxWidth: '34ch' }}>{span.target}</span>}
      {span.status === 'error' && <span className="badge unresolved" style={{ padding: '0 5px' }}>error</span>}
    </span>
  )
}
