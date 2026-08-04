/**
 * The debug view: every span in the trace, filterable, with nothing truncated.
 *
 * The other two views summarise. This one deliberately does not — when an agent
 * misbehaves the answer is usually in one specific payload, and a summary is
 * exactly the wrong shape for finding it. It also surfaces the raw record,
 * because half of "my agent is broken" turns out to be "my instrumentation is
 * broken", and those are indistinguishable from a chart.
 */
import { useMemo, useState } from 'react'
import type { Span } from '../lib/api'
import { ROOT_AGENT, attributeSpans } from '../lib/agents'
import { diagnose, type Diagnostic } from '../lib/diagnostics'
import { KIND_COLOR, spanBucket } from '../lib/colors'
import { fmtClock, fmtCompact, fmtDuration, fmtUsd } from '../lib/format'
import { Card, DataTable, Empty, type Column } from '../components/ui'
import type { ImportedTrial } from '../lib/trace-format'

const SEVERITY_COLOR: Record<Diagnostic['severity'], string> = {
  error: 'var(--critical)',
  warn: 'var(--warning)',
  info: 'var(--text-muted)',
}

const SEVERITY_LABEL: Record<Diagnostic['severity'], string> = {
  error: 'Error',
  warn: 'Warning',
  info: 'Note',
}

interface Row {
  span: Span
  agent: string
  trialId: string
  taskId: string
}

export function DebugView({
  trials,
  spansByTrial,
}: {
  trials: ImportedTrial[]
  spansByTrial: Record<string, Span[]>
}) {
  const [q, setQ] = useState('')
  const [agent, setAgent] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [trial, setTrial] = useState('')
  const [only, setOnly] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const diagnostics = useMemo(() => diagnose(trials, spansByTrial), [trials, spansByTrial])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const t of trials) {
      const spans = spansByTrial[t.id] ?? []
      const owner = attributeSpans(spans)
      for (const s of spans) {
        out.push({ span: s, agent: owner.get(s.id) ?? ROOT_AGENT, trialId: t.id, taskId: t.task_id })
      }
    }
    return out
  }, [trials, spansByTrial])

  const agents = useMemo(() => [...new Set(rows.map((r) => r.agent))].sort(), [rows])
  const types = useMemo(() => [...new Set(rows.map((r) => r.span.type))].sort(), [rows])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (only && !only.includes(r.span.id)) return false
      if (agent && r.agent !== agent) return false
      if (type && r.span.type !== type) return false
      if (status && r.span.status !== status) return false
      if (trial && r.trialId !== trial) return false
      if (!term) return true
      // Search the payloads, not just the labels — the point is finding the one
      // span whose output contained the thing that went wrong.
      const hay = [r.span.name, r.span.target, r.span.input, r.span.output, r.span.error, r.agent]
        .filter(Boolean)
        .join('\n')
        .toLowerCase()
      return hay.includes(term)
    })
  }, [rows, q, agent, type, status, trial, only])

  const sel = selected ? rows.find((r) => r.span.id === selected) : null

  const columns: Column<Row>[] = [
    {
      key: 'step',
      header: 'Step',
      align: 'right',
      width: 56,
      sortValue: (r) => r.span.seq,
      render: (r) => <span className="muted mono small">{r.span.step || r.span.seq}</span>,
    },
    {
      key: 'at',
      header: 'At',
      align: 'right',
      width: 62,
      sortValue: (r) => r.span.start_ms,
      render: (r) => <span className="mono small">{fmtClock(r.span.start_ms)}</span>,
    },
    {
      key: 'name',
      header: 'Span',
      sortValue: (r) => r.span.name,
      render: (r) => (
        <span className="hstack" style={{ gap: 7 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              flex: '0 0 auto',
              background: KIND_COLOR[spanBucket({ type: r.span.type, kind: r.span.kind })],
            }}
          />
          <span className="mono">{r.span.name}</span>
          {r.span.type === 'subagent' && <span className="pill">subagent</span>}
          {r.span.status === 'error' && <span className="badge unresolved">error</span>}
        </span>
      ),
    },
    { key: 'agent', header: 'Agent', sortValue: (r) => r.agent, render: (r) => <span className="mono small">{r.agent}</span> },
    {
      key: 'target',
      header: 'Target',
      sortValue: (r) => r.span.target ?? '',
      render: (r) => <span className="mono small muted">{r.span.target ?? '—'}</span>,
    },
    {
      key: 'dur',
      header: 'Duration',
      align: 'right',
      sortValue: (r) => r.span.duration_ms,
      render: (r) => <span className="mono small">{fmtDuration(r.span.duration_ms)}</span>,
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      sortValue: (r) => r.span.cost_usd,
      render: (r) => (r.span.cost_usd ? <span className="mono small">{fmtUsd(r.span.cost_usd, 4)}</span> : <span className="muted">—</span>),
    },
  ]

  return (
    <>
      <Card
        title="Instrumentation checks"
        note={diagnostics.length ? `${diagnostics.length} finding${diagnostics.length === 1 ? '' : 's'}` : 'all clear'}
      >
        {!diagnostics.length ? (
          <Empty>
            Nothing looks wrong with this trace. Spans cover their trials, the tree is intact, and every failure carries
            a message.
          </Empty>
        ) : (
          <div className="vstack" style={{ gap: 10 }}>
            {diagnostics.map((d) => (
              <div key={d.id} className="note" style={{ borderLeftColor: SEVERITY_COLOR[d.severity] }}>
                <div className="note-head">
                  <b style={{ color: SEVERITY_COLOR[d.severity] }}>{SEVERITY_LABEL[d.severity]}</b>
                  <span>·</span>
                  <b>{d.title}</b>
                  <div style={{ flex: 1 }} />
                  {d.spanIds.length > 0 && (
                    <span
                      className="linkish small"
                      onClick={() => {
                        setOnly(d.spanIds)
                        setSelected(null)
                      }}
                    >
                      show {d.spanIds.length === d.count ? d.count : `${d.spanIds.length} of ${d.count}`} →
                    </span>
                  )}
                </div>
                <div className="note-body">{d.detail}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="toolbar">
        <input
          className="ctl"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search names, targets, inputs, outputs, errors…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="ctl" value={trial} onChange={(e) => setTrial(e.target.value)}>
          <option value="">All trials</option>
          {trials.map((t) => (
            <option key={t.id} value={t.id}>
              {t.task_id}
            </option>
          ))}
        </select>
        <select className="ctl" value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select className="ctl" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className="ctl" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
        </select>
        {(only || q || agent || type || status || trial) && (
          <button
            className="btn"
            onClick={() => {
              setOnly(null)
              setQ('')
              setAgent('')
              setType('')
              setStatus('')
              setTrial('')
            }}
          >
            Clear
          </button>
        )}
      </div>

      <Card title="Spans" note={`${filtered.length} of ${rows.length}`}>
        <DataTable
          rows={filtered}
          columns={columns}
          onRowClick={(r) => setSelected(r.span.id === selected ? null : r.span.id)}
          initialSort={{ key: 'at', dir: 'asc' }}
          emptyText="No spans match these filters."
          maxHeight={420}
        />
      </Card>

      {sel && <SpanInspector row={sel} onClose={() => setSelected(null)} />}
    </>
  )
}

// ----------------------------------------------------------------- inspector

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <div className="hstack" style={{ gap: 8, marginBottom: 4 }}>
        <span className="toolbar-label">{label}</span>
        <span className="muted small">{value.length.toLocaleString()} chars</span>
        <CopyButton text={value} />
      </div>
      <pre
        className="mono"
        style={{
          fontSize: 11.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: 'var(--surface-2)',
          padding: 10,
          borderRadius: 6,
          margin: 0,
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {value}
      </pre>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <span
      className="linkish small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? 'copied' : 'copy'}
    </span>
  )
}

function SpanInspector({ row, onClose }: { row: Row; onClose: () => void }) {
  const { span, agent, taskId } = row
  const [raw, setRaw] = useState(false)

  // The stored record, not the source line: depth, seq and kind are derived on
  // import. Showing them is the point — it is how you confirm the tree AgentLens
  // built matches the one you meant to emit.
  const record = JSON.stringify(span, null, 2)

  return (
    <Card
      title={span.name}
      note={`${span.type} · ${agent} · ${taskId}`}
      actions={
        <div className="hstack" style={{ gap: 8 }}>
          <span className="linkish small" onClick={() => setRaw((r) => !r)}>
            {raw ? 'hide record' : 'show record'}
          </span>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="vstack" style={{ gap: 12 }}>
        <div className="hstack" style={{ gap: 14, flexWrap: 'wrap' }}>
          <span className="small">
            <span className="muted">at</span> <span className="mono">{fmtClock(span.start_ms)}</span>
          </span>
          <span className="small">
            <span className="muted">duration</span> <span className="mono">{fmtDuration(span.duration_ms)}</span>
          </span>
          <span className="small">
            <span className="muted">step</span> <span className="mono">{span.step}</span>
          </span>
          <span className="small">
            <span className="muted">depth</span> <span className="mono">{span.depth}</span>
          </span>
          {span.parent_id && (
            <span className="small">
              <span className="muted">parent</span> <span className="mono">{span.parent_id}</span>
            </span>
          )}
          {span.tokens_in + span.tokens_out > 0 && (
            <span className="small">
              <span className="muted">tokens</span>{' '}
              <span className="mono">
                {fmtCompact(span.tokens_in)} in / {fmtCompact(span.tokens_out)} out
              </span>
            </span>
          )}
          {span.cost_usd > 0 && (
            <span className="small">
              <span className="muted">cost</span> <span className="mono">{fmtUsd(span.cost_usd, 4)}</span>
            </span>
          )}
        </div>

        {span.target && (
          <div className="small">
            <span className="muted">target </span>
            <span className="mono">{span.target}</span>
          </div>
        )}

        <Field label="Error" value={span.error} />
        <Field label="Input" value={span.input} />
        <Field label="Output" value={span.output} />

        {!span.input && !span.output && !span.error && (
          <div className="muted small">
            This span carries no payload. Pass <span className="mono">input</span> when opening it and{' '}
            <span className="mono">output</span> or <span className="mono">error</span> to{' '}
            <span className="mono">end()</span> to see what actually happened here.
          </div>
        )}

        {span.attrs && Object.keys(span.attrs).length > 0 && (
          <Field label="Attributes" value={JSON.stringify(span.attrs, null, 2)} />
        )}

        {raw && <Field label="Stored record (depth, seq and kind are derived on import)" value={record} />}
      </div>
    </Card>
  )
}
