import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, useApi, type Span } from '../lib/api'
import { KIND_COLOR, KIND_LABEL, SPAN_STATUS_COLOR, failureColor, spanBucket } from '../lib/colors'
import { fmtClock, fmtCompact, fmtDuration, fmtUsd, taskShort } from '../lib/format'
import { AreaChart } from '../components/charts'
import { Waterfall } from '../components/Waterfall'
import { Card, CodeBlock, ErrorState, Loading, StatTile, StatusBadge } from '../components/ui'

type Tab = 'summary' | 'input' | 'output' | 'error' | 'attrs'

export default function Trace() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { data, error, loading, reload } = useApi(() => api.trial(id), [id])

  const [selected, setSelected] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [tab, setTab] = useState<Tab>('summary')
  const [note, setNote] = useState('')

  const spans = data?.spans ?? []
  const total = useMemo(() => Math.max(...spans.map((s) => s.end_ms), 1), [spans])

  // Open on the span that broke the run — that is the question the page answers.
  useEffect(() => {
    if (!data) return
    const target = data.trial.failure_span_id || data.spans.find((s) => s.depth > 0)?.id || null
    setSelected(target)
    const sp = data.spans.find((s) => s.id === target)
    setPlayhead(sp ? Math.round((sp.start_ms + sp.end_ms) / 2) : 0)
    setTab(sp?.error ? 'error' : 'summary')
  }, [data])

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="trace" /></div>
  if (!data) return null

  const { trial, task, events, annotations, siblings, failureMeta } = data
  const sel = spans.find((s) => s.id === selected) || null
  const active = spans.filter((s) => s.depth > 0 && s.start_ms <= playhead && s.end_ms >= playhead)
  const activeLeaf = active[active.length - 1]

  const ctxSeries = spans
    .filter((s) => s.type === 'llm')
    .map((s) => ({ x: s.start_ms, y: (s.ctx_used / trial.context_limit) * 100 }))

  let acc = 0
  const costSeries = spans
    .filter((s) => s.cost_usd > 0)
    .map((s) => ({ x: s.start_ms, y: (acc += s.cost_usd) }))

  const submitNote = async () => {
    if (!note.trim()) return
    await api.addAnnotation({ target_id: trial.id, body: note.trim(), label: 'review' })
    setNote('')
    reload()
  }

  return (
    <div className="content wide">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="hstack" style={{ marginBottom: 4 }}>
            <StatusBadge status={trial.status} />
            <span className="pill">{trial.run_name}</span>
            <span className="pill">{trial.model}</span>
            <span className="pill">{task.repo}</span>
          </div>
          <h1 className="page-title mono" style={{ fontSize: 18 }}>
            {taskShort(trial.task_id)}
          </h1>
          <p className="page-sub">{task.issue_title}</p>
        </div>
        <div style={{ flex: 1 }} />
        <div className="vstack">
          <button className="btn" onClick={() => nav(`/tasks/${trial.task_id}`)}>
            View task ↗
          </button>
          {siblings[0] && (
            <button className="btn" onClick={() => nav(`/compare?ids=${trial.id},${siblings[0].id}`)}>
              Compare with another run ⇄
            </button>
          )}
        </div>
      </div>

      {trial.failure_category ? (
        <div className="callout">
          <span className="ci" aria-hidden>
            ✗
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="ct">
              {failureMeta?.label || trial.failure_category} — {failureMeta?.blurb}
            </div>
            <div className="cb">{trial.failure_summary}</div>
            {trial.failure_span_id && (
              <div className="cb" style={{ marginTop: 6 }}>
                <span
                  className="linkish"
                  onClick={() => {
                    const sp = spans.find((s) => s.id === trial.failure_span_id)
                    if (sp) {
                      setSelected(sp.id)
                      setPlayhead(Math.round((sp.start_ms + sp.end_ms) / 2))
                      setTab(sp.error ? 'error' : 'output')
                    }
                  }}
                >
                  Jump to the span where it broke →
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="callout ok">
          <span className="ci" aria-hidden>
            ✓
          </span>
          <div>
            <div className="ct">Resolved</div>
            <div className="cb">
              {trial.f2p_passed}/{trial.f2p_total} fail-to-pass and {trial.p2p_passed}/{trial.p2p_total} pass-to-pass
              tests green. Patch touches {trial.files_touched.join(', ') || '—'}.
            </div>
          </div>
        </div>
      )}

      <div className="grid g6">
        <StatTile label="Steps" value={trial.steps} foot={`cap ${trial.max_steps}`} />
        <StatTile label="Duration" value={fmtDuration(trial.duration_ms)} foot={`${spans.length} spans`} />
        <StatTile label="Cost" value={fmtUsd(trial.cost_usd, 3)} foot={`budget ${fmtUsd(trial.budget_usd ?? 0)}`} />
        <StatTile
          label="Tokens"
          value={fmtCompact(trial.tokens_in + trial.tokens_out)}
          foot={`${Math.round((trial.tokens_cached / (trial.tokens_in || 1)) * 100)}% cached`}
        />
        <StatTile
          label="Context peak"
          value={trial.context_peak_pct.toFixed(0)}
          unit="%"
          accent={trial.context_peak_pct > 95 ? 'var(--critical)' : undefined}
          foot={`${fmtCompact(trial.context_limit)} limit`}
        />
        <StatTile
          label="Tool errors"
          value={trial.tool_errors}
          accent={trial.tool_errors > 3 ? 'var(--critical)' : undefined}
          foot={`of ${trial.tool_calls} calls`}
        />
      </div>

      <Card title="Timeline" note={`${spans.length} spans · ${fmtDuration(total)}`}>
        <div className="scrubber" style={{ marginBottom: 12 }}>
          <span className="toolbar-label">At</span>
          <span className="scrub-readout">{fmtClock(playhead)}</span>
          <input
            type="range"
            min={0}
            max={total}
            value={playhead}
            onChange={(e) => setPlayhead(Number(e.target.value))}
            aria-label="Scrub the trace timeline"
          />
          <span className="small secondary" style={{ minWidth: 320, textAlign: 'right' }}>
            {activeLeaf ? (
              <>
                the agent was{' '}
                <b>
                  {KIND_LABEL[spanBucket(activeLeaf)].toLowerCase()}
                  {activeLeaf.target ? ` · ${activeLeaf.target}` : ''}
                </b>{' '}
                <span className="muted">(step {activeLeaf.step})</span>
              </>
            ) : (
              <span className="muted">idle</span>
            )}
          </span>
        </div>

        <Waterfall
          spans={spans}
          events={events}
          selectedId={selected}
          onSelect={(sid) => {
            setSelected(sid)
            const sp = spans.find((s) => s.id === sid)
            if (sp) setTab(sp.error ? 'error' : sp.output ? 'output' : 'summary')
          }}
          playhead={playhead}
          onScrub={setPlayhead}
          failureSpanId={trial.failure_span_id}
        />
      </Card>

      <div className="trace-layout">
        <div className="vstack" style={{ gap: 14 }}>
          <Card title="Context window" note="share of the model's context consumed, per model call">
            <AreaChart
              series={[{ label: 'Context used', color: 'var(--series-7)', points: ctxSeries }]}
              formatX={(v) => fmtClock(v)}
              formatY={(v) => `${v.toFixed(0)}%`}
              yMaxOverride={Math.max(100, ...ctxSeries.map((p) => p.y))}
              threshold={{ y: 100, label: 'window limit' }}
              height={148}
            />
          </Card>

          <Card title="Cumulative spend" note="dollars consumed as the trajectory progresses">
            <AreaChart
              series={[{ label: 'Cost', color: 'var(--series-1)', points: costSeries }]}
              formatX={(v) => fmtClock(v)}
              formatY={(v) => `$${v.toFixed(2)}`}
              height={148}
            />
          </Card>

          <Card title="Signals" note={`${events.length} events`}>
            <div style={{ maxHeight: 220, overflowY: 'auto' }} className="vstack">
              {events.length === 0 && <span className="muted small">No signals recorded.</span>}
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="hstack"
                  style={{ gap: 8, cursor: ev.span_id ? 'pointer' : 'default' }}
                  onClick={() => {
                    setPlayhead(ev.t_ms)
                    if (ev.span_id) setSelected(ev.span_id)
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      flex: '0 0 auto',
                      background:
                        ev.level === 'error'
                          ? 'var(--critical)'
                          : ev.level === 'warn'
                            ? 'var(--warning)'
                            : 'var(--text-muted)',
                    }}
                  />
                  <span className="mono muted" style={{ minWidth: 42 }}>
                    {fmtClock(ev.t_ms)}
                  </span>
                  <span className="small">{ev.message}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Steps" note="every span in order — click to inspect">
            <div className="span-tree">
              {spans
                .filter((s) => s.depth > 0)
                .map((s) => (
                  <div
                    key={s.id}
                    className={`tree-row${selected === s.id ? ' sel' : ''}`}
                    style={{ paddingLeft: 8 + (s.depth - 1) * 14 }}
                    onClick={() => {
                      setSelected(s.id)
                      setPlayhead(Math.round((s.start_ms + s.end_ms) / 2))
                      setTab(s.error ? 'error' : s.output ? 'output' : 'summary')
                    }}
                  >
                    <span
                      className="kindbar"
                      style={{ background: s.status === 'error' ? 'var(--critical)' : KIND_COLOR[spanBucket(s)] }}
                    />
                    <span className="tname">{s.name}</span>
                    {s.target && <span className="muted small truncate">{s.target}</span>}
                    {s.id === trial.failure_span_id && (
                      <span className="badge unresolved" style={{ padding: '0 5px' }}>
                        cause
                      </span>
                    )}
                    <span className="tmeta">{fmtDuration(s.duration_ms)}</span>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        <div className="inspector vstack" style={{ gap: 14 }}>
          <Card title="Span inspector" note={sel ? `#${sel.seq}` : undefined}>
            {!sel ? (
              <span className="muted small">Select a span from the timeline.</span>
            ) : (
              <>
                <div className="hstack" style={{ marginBottom: 10 }}>
                  <span
                    className="badge"
                    style={{ borderColor: SPAN_STATUS_COLOR[sel.status], color: SPAN_STATUS_COLOR[sel.status] }}
                  >
                    {sel.status}
                  </span>
                  <span className="pill">{sel.type}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {sel.name}
                  </span>
                </div>

                <div className="tabs">
                  {(['summary', 'input', 'output', 'error', 'attrs'] as Tab[])
                    .filter((t) => (t === 'error' ? !!sel.error : t === 'attrs' ? !!sel.attrs : true))
                    .map((t) => (
                      <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                        {t === 'attrs' ? 'metadata' : t}
                      </button>
                    ))}
                </div>

                {tab === 'summary' && <SpanSummary span={sel} limit={trial.context_limit} />}
                {tab === 'input' && <CodeBlock text={sel.input || '(no input recorded)'} tall />}
                {tab === 'output' && <CodeBlock text={sel.output || '(no output recorded)'} tall />}
                {tab === 'error' && sel.error && <CodeBlock text={sel.error} tall />}
                {tab === 'attrs' && sel.attrs && <CodeBlock text={JSON.stringify(sel.attrs, null, 2)} />}
              </>
            )}
          </Card>

          <Card title="Task" note={task.difficulty}>
            <dl className="kv">
              <dt>Repo</dt>
              <dd className="mono">{task.repo}</dd>
              <dt>Base</dt>
              <dd className="mono">{task.base_commit.slice(0, 12)}</dd>
              <dt>Reference fix</dt>
              <dd className="mono">{task.gold_files.join(', ')}</dd>
              <dt>Agent touched</dt>
              <dd className="mono">{trial.files_touched.join(', ') || '—'}</dd>
              <dt>Localized</dt>
              <dd>{trial.localized ? 'yes — opened the right file' : 'no — never opened the right file'}</dd>
              <dt>Gating tests</dt>
              <dd className="mono small">{task.fail_to_pass.join('\n')}</dd>
            </dl>
            <div style={{ marginTop: 10 }}>
              <div className="card-note" style={{ marginBottom: 4 }}>
                Issue
              </div>
              <div className="small secondary">{task.issue_body}</div>
            </div>
          </Card>

          {trial.patch && (
            <Card title="Submitted patch" note={`+${trial.patch_added} −${trial.patch_removed}`}>
              <CodeBlock text={trial.patch} />
            </Card>
          )}

          <Card title="Same task, other configurations">
            <div className="vstack">
              {siblings.map((s) => (
                <div key={s.id} className="hstack" style={{ gap: 8 }}>
                  <StatusBadge status={s.status} />
                  <span className="small truncate" style={{ flex: 1 }}>
                    {s.run_name}
                  </span>
                  <span className="linkish small" onClick={() => nav(`/trials/${s.id}`)}>
                    open
                  </span>
                  <span className="linkish small" onClick={() => nav(`/compare?ids=${trial.id},${s.id}`)}>
                    compare
                  </span>
                </div>
              ))}
              {!siblings.length && <span className="muted small">No other attempts at this task.</span>}
            </div>
          </Card>

          <Card title="Review notes" note={`${annotations.length}`}>
            <div className="vstack" style={{ marginBottom: 10 }}>
              {annotations.map((a) => (
                <div key={a.id} className="note">
                  <div className="note-head">
                    <b>{a.author}</b>
                    {a.label && <span className="pill">{a.label}</span>}
                  </div>
                  <div className="note-body">{a.body}</div>
                </div>
              ))}
              {!annotations.length && <span className="muted small">No review notes yet.</span>}
            </div>
            <textarea
              className="ctl"
              placeholder="Add a review note — e.g. mislabelled, infra flake, worth a scaffold change…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="hstack" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={submitNote} disabled={!note.trim()}>
                Save note
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SpanSummary({ span, limit }: { span: Span; limit: number }) {
  return (
    <dl className="kv">
      <dt>Started</dt>
      <dd>{fmtClock(span.start_ms)}</dd>
      <dt>Duration</dt>
      <dd>{fmtDuration(span.duration_ms)}</dd>
      <dt>Step</dt>
      <dd>{span.step}</dd>
      {span.target && (
        <>
          <dt>Target</dt>
          <dd className="mono">{span.target}</dd>
        </>
      )}
      {span.model && (
        <>
          <dt>Model</dt>
          <dd className="mono">{span.model}</dd>
        </>
      )}
      {span.tokens_in > 0 && (
        <>
          <dt>Tokens in</dt>
          <dd>
            {span.tokens_in.toLocaleString()}{' '}
            <span className="muted">({Math.round((span.tokens_cached / span.tokens_in) * 100)}% cached)</span>
          </dd>
          <dt>Tokens out</dt>
          <dd>{span.tokens_out.toLocaleString()}</dd>
          <dt>Context</dt>
          <dd>
            {((span.ctx_used / limit) * 100).toFixed(1)}% of {fmtCompact(limit)}
          </dd>
        </>
      )}
      {span.cost_usd > 0 && (
        <>
          <dt>Cost</dt>
          <dd>{fmtUsd(span.cost_usd, 4)}</dd>
        </>
      )}
      <dt>Category</dt>
      <dd>
        <span className="hstack" style={{ gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: span.status === 'error' ? failureColor(null) : KIND_COLOR[spanBucket(span)],
            }}
          />
          {KIND_LABEL[spanBucket(span)]}
        </span>
      </dd>
    </dl>
  )
}
