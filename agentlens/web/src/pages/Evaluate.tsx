/**
 * Your Agent — evaluation for a trace the user brought, rather than the bundled
 * demo corpus.
 *
 * Two things make this tab different from the rest of the app. It reads from
 * IndexedDB instead of the API, because on a static host there is no server to
 * receive an upload. And it is organised by *agent* rather than by run, because
 * the question here is "which of my agents is burning the budget" — a framing
 * the demo corpus cannot answer, since none of its runs delegate.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Span } from '../lib/api'
import { ROOT_AGENT, agentStats, attributeSpans, delegationTree, flattenTree } from '../lib/agents'
import { SERIES } from '../lib/colors'
import { fmtCompact, fmtDuration, fmtInt, fmtPct, fmtUsd } from '../lib/format'
import { localTraces, storageAvailable, type StoredTrace } from '../lib/local-store'
import { parseTrace, type ImportedTrial, type ParseIssue } from '../lib/trace-format'
import { SAMPLE_TRACE_ID, importSampleTrace } from '../lib/sample-trace'
import { Card, DataTable, Empty, ErrorState, StatTile, Segmented, type Column } from '../components/ui'
import { Meter } from '../components/charts'
import { Waterfall } from '../components/Waterfall'

const SAMPLE = `{"record":"run","id":"my-agent-v1","name":"my agent","model":"claude-opus-5"}
{"record":"trial","id":"t1","run_id":"my-agent-v1","task_id":"fix-login-bug"}
{"record":"span","id":"s1","trial_id":"t1","name":"plan","type":"llm","start_ms":0,"end_ms":800,"tokens_in":1200,"tokens_out":300,"cost_usd":0.01}
{"record":"span","id":"s2","trial_id":"t1","name":"researcher","type":"subagent","agent":"researcher","start_ms":800,"end_ms":4200}
{"record":"span","id":"s3","trial_id":"t1","parent_id":"s2","name":"grep","type":"tool","start_ms":900,"end_ms":1400,"target":"src/auth.ts"}
{"record":"result","trial_id":"t1","command":"npm test","exit_code":0}`

type View = 'agents' | 'trials'

export default function Evaluate() {
  const [stored, setStored] = useState<StoredTrace[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [issues, setIssues] = useState<{ errors: ParseIssue[]; warnings: ParseIssue[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<View>('agents')
  const [openTrial, setOpenTrial] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const all = await localTraces.list()
      setStored(all)
      setActiveId((cur) => cur ?? all[0]?.id ?? null)
    } catch (e) {
      setFatal(String((e as Error).message || e))
    }
  }, [])

  useEffect(() => {
    if (!storageAvailable()) {
      setFatal('This browser has no IndexedDB, so imported traces cannot be stored.')
      return
    }
    void refresh()
  }, [refresh])

  const ingestText = useCallback(
    async (text: string, label: string) => {
      setBusy(true)
      setIssues(null)
      try {
        const { trace, errors, warnings } = parseTrace(text)
        if (!trace.trials.length) {
          setIssues({
            errors: errors.length ? errors : [{ line: 0, message: 'No trials found in this file.' }],
            warnings,
          })
          return
        }
        const record: StoredTrace = {
          id: `${Date.now()}-${label}`,
          label,
          importedAt: Date.now(),
          sourceBytes: new Blob([text]).size,
          trace,
        }
        await localTraces.put(record)
        setActiveId(record.id)
        setIssues({ errors, warnings })
        await refresh()
      } catch (e) {
        setFatal(String((e as Error).message || e))
      } finally {
        setBusy(false)
      }
    },
    [refresh],
  )

  const ingest = useCallback(
    async (file: File) => ingestText(await file.text(), file.name),
    [ingestText],
  )

  const loadSample = useCallback(async () => {
    await importSampleTrace()
    setActiveId(SAMPLE_TRACE_ID)
    await refresh()
  }, [refresh])

  const active = stored.find((t) => t.id === activeId) ?? null

  const allSpans: Span[] = useMemo(
    () => (active ? Object.values(active.trace.spansByTrial).flat() : []),
    [active],
  )
  const agents = useMemo(() => (allSpans.length ? agentStats(allSpans) : []), [allSpans])
  const trials = active?.trace.trials ?? []
  const graded = trials.filter((t) => t.grade)
  const passed = graded.filter((t) => t.status === 'resolved').length

  const totals = useMemo(
    () => ({
      cost: trials.reduce((a, t) => a + t.cost_usd, 0),
      tokens: trials.reduce((a, t) => a + t.tokens_in + t.tokens_out, 0),
      wall: trials.reduce((a, t) => a + t.duration_ms, 0),
      toolCalls: trials.reduce((a, t) => a + t.tool_calls, 0),
      toolErrors: trials.reduce((a, t) => a + t.tool_errors, 0),
    }),
    [trials],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void ingest(file)
  }

  if (fatal) return <ErrorState message={fatal} />

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Your agent</h1>
          <p className="page-sub">
            Import a trace from your own agent to see where its time and budget go, and which subagent is responsible.
            Everything here is parsed and stored in your browser — nothing is uploaded.
          </p>
        </div>
      </div>

      <div
        className={`toolbar${dragging ? ' dropping' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <button className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Reading…' : 'Import trace'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".jsonl,.json,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void ingest(f)
            e.target.value = ''
          }}
        />
        <span className="muted small">or drop a .jsonl file here</span>
        <LocalServerTraces onLoad={ingestText} />
        <div style={{ flex: 1 }} />
        {stored.length > 0 && (
          <>
            <select className="ctl" value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value)}>
              {stored.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.trace.trials.length} trials
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={async () => {
                if (!activeId) return
                await localTraces.remove(activeId)
                setActiveId(null)
                await refresh()
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>

      {issues && (issues.errors.length > 0 || issues.warnings.length > 0) && (
        <Card title="Import notes" note={`${issues.errors.length} errors · ${issues.warnings.length} warnings`}>
          <div className="vstack" style={{ gap: 6 }}>
            {issues.errors.slice(0, 8).map((e, i) => (
              <div key={`e${i}`} className="note" style={{ borderLeftColor: 'var(--status-error)' }}>
                <span className="mono small">{e.line ? `line ${e.line}` : 'trace'}</span> — {e.message}
              </div>
            ))}
            {issues.warnings.slice(0, 5).map((w, i) => (
              <div key={`w${i}`} className="note">
                <span className="mono small">{w.line ? `line ${w.line}` : 'trace'}</span> — {w.message}
              </div>
            ))}
            {issues.errors.length > 8 && <span className="muted small">…and {issues.errors.length - 8} more.</span>}
          </div>
        </Card>
      )}

      {!active ? (
        <GettingStarted onLoadSample={loadSample} />
      ) : (
        <>
          <div className="grid g6">
            <StatTile label="Trials" value={fmtInt(trials.length)} foot={`${allSpans.length} spans`} />
            <StatTile
              label="Pass rate"
              value={graded.length ? fmtPct((100 * passed) / graded.length, 0) : '—'}
              foot={graded.length ? `${passed} of ${graded.length} graded` : 'no test command recorded'}
            />
            <StatTile
              label="Agents"
              value={fmtInt(agents.length)}
              foot={agents.length > 1 ? `${agents.length - 1} subagents` : 'no delegation'}
            />
            <StatTile label="Spend" value={fmtUsd(totals.cost)} foot={`${fmtCompact(totals.tokens)} tokens`} />
            <StatTile label="Agent time" value={fmtDuration(totals.wall)} foot="summed across trials" />
            <StatTile
              label="Tool errors"
              value={fmtInt(totals.toolErrors)}
              accent={totals.toolErrors ? 'var(--status-error)' : undefined}
              foot={totals.toolCalls ? `of ${fmtInt(totals.toolCalls)} calls` : 'no tool calls'}
            />
          </div>

          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'agents', label: 'Agents' },
              { value: 'trials', label: 'Trials' },
            ]}
          />

          {view === 'agents' ? (
            <AgentsView spans={allSpans} />
          ) : (
            <TrialsView
              trials={trials}
              spansByTrial={active.trace.spansByTrial}
              openTrial={openTrial}
              setOpenTrial={setOpenTrial}
            />
          )}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------- local server bridge

/**
 * Offers the trace files sitting in the directory `npx agentlens open` was
 * pointed at. Absent on the static deployment, where there is no server — the
 * probe simply fails and the control stays hidden, so the same build serves
 * both without a flag.
 */
function LocalServerTraces({ onLoad }: { onLoad: (text: string, label: string) => void }) {
  const [files, setFiles] = useState<{ name: string; bytes: number }[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/local/traces', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.files?.length && setFiles(d.files))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (!files.length) return null

  return (
    <select
      className="ctl"
      value=""
      onChange={async (e) => {
        const name = e.target.value
        if (!name) return
        e.target.value = ''
        const r = await fetch(`/api/local/traces/${encodeURIComponent(name)}`)
        if (!r.ok) return
        const { text } = await r.json()
        onLoad(text, name)
      }}
    >
      <option value="">Load from {'.agentlens'}…</option>
      {files.map((f) => (
        <option key={f.name} value={f.name}>
          {f.name} ({Math.max(1, Math.round(f.bytes / 1024))} KB)
        </option>
      ))}
    </select>
  )
}

// -------------------------------------------------------------------- agents

function AgentsView({ spans }: { spans: Span[] }) {
  const agents = useMemo(() => agentStats(spans), [spans])
  const tree = useMemo(() => delegationTree(spans), [spans])
  const rows = useMemo(() => flattenTree(tree), [tree])
  const maxCost = Math.max(...agents.map((a) => a.cost), 0.000001)
  const maxSelf = Math.max(...agents.map((a) => a.selfMs), 1)

  const columns: Column<(typeof agents)[number]>[] = [
    {
      key: 'name',
      header: 'Agent',
      sortValue: (a) => a.name,
      render: (a) => (
        <span className="hstack" style={{ gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: a.name === ROOT_AGENT ? 'var(--text-muted)' : SERIES[(a.depth + 1) % SERIES.length],
            }}
          />
          <span className="mono">{a.name}</span>
          {a.name === ROOT_AGENT && <span className="pill">root</span>}
        </span>
      ),
    },
    { key: 'invocations', header: 'Calls', align: 'right', sortValue: (a) => a.invocations, render: (a) => fmtInt(a.invocations) },
    {
      key: 'self',
      header: 'Self time',
      align: 'right',
      sortValue: (a) => a.selfMs,
      render: (a) => (
        <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <Meter value={(100 * a.selfMs) / maxSelf} color={SERIES[(a.depth + 1) % SERIES.length]} />
          <span className="mono small">{fmtDuration(a.selfMs)}</span>
        </span>
      ),
    },
    { key: 'total', header: 'Total time', align: 'right', sortValue: (a) => a.totalMs, render: (a) => fmtDuration(a.totalMs) },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      sortValue: (a) => a.cost,
      render: (a) => (
        <span className="hstack" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <Meter value={(100 * a.cost) / maxCost} color={SERIES[(a.depth + 1) % SERIES.length]} />
          <span className="mono small">{fmtUsd(a.cost, 3)}</span>
        </span>
      ),
    },
    { key: 'tokens', header: 'Tokens', align: 'right', sortValue: (a) => a.tokensIn + a.tokensOut, render: (a) => fmtCompact(a.tokensIn + a.tokensOut) },
    {
      key: 'errors',
      header: 'Tool errors',
      align: 'right',
      sortValue: (a) => a.errorRate,
      render: (a) =>
        a.calls ? (
          <span style={a.errorRate > 20 ? { color: 'var(--status-error)' } : undefined}>
            {a.errors}/{a.calls} · {fmtPct(a.errorRate, 0)}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ]

  if (agents.length <= 1) {
    return (
      <>
        <Card title="Agents" note="1">
          <DataTable rows={agents} columns={columns} initialSort={{ key: 'cost', dir: 'desc' }} />
        </Card>
        <Card title="Delegation">
          <Empty>
            This trace has no <span className="mono">subagent</span> spans, so all work is attributed to the
            orchestrator. Emit a span with <span className="mono">"type":"subagent"</span> to see a breakdown here.
          </Empty>
        </Card>
      </>
    )
  }

  return (
    <>
      <Card title="Agents" note={`${agents.length}`}>
        <p className="muted small" style={{ margin: '0 0 10px' }}>
          Self time excludes delegated work. A large gap between self and total means that agent is mostly waiting on
          the ones it spawned.
        </p>
        <DataTable rows={agents} columns={columns} initialSort={{ key: 'cost', dir: 'desc' }} />
      </Card>

      <Card title="Delegation" note="who called whom">
        <div className="vstack" style={{ gap: 2 }}>
          {rows.map((n) => (
            <div
              key={n.id}
              className="hstack"
              style={{ gap: 8, paddingLeft: n.depth * 18, alignItems: 'center', minHeight: 24 }}
            >
              {n.depth > 0 && <span className="muted mono small">└</span>}
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: n.name === ROOT_AGENT ? 'var(--text-muted)' : SERIES[(n.depth + 1) % SERIES.length],
                }}
              />
              <span className="mono">{n.name}</span>
              {n.status === 'error' && <span className="badge unresolved">error</span>}
              <div style={{ flex: 1 }} />
              <span className="muted small mono">{fmtDuration(n.durationMs)}</span>
              <span className="muted small mono">{fmtUsd(n.cost, 3)}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

// -------------------------------------------------------------------- trials

function TrialsView({
  trials,
  spansByTrial,
  openTrial,
  setOpenTrial,
}: {
  trials: ImportedTrial[]
  spansByTrial: Record<string, Span[]>
  openTrial: string | null
  setOpenTrial: (id: string | null) => void
}) {
  const columns: Column<ImportedTrial>[] = [
    { key: 'task', header: 'Task', sortValue: (t) => t.task_id, render: (t) => <span className="mono">{t.task_id}</span> },
    {
      key: 'status',
      header: 'Result',
      sortValue: (t) => t.status,
      render: (t) =>
        t.grade ? (
          <span className={`badge ${t.status === 'resolved' ? 'resolved' : 'unresolved'}`}>
            {t.status === 'resolved' ? '✓ pass' : '✗ fail'}
          </span>
        ) : (
          <span className="muted small">ungraded</span>
        ),
    },
    {
      key: 'cmd',
      header: 'Test command',
      sortValue: (t) => t.grade?.command ?? '',
      render: (t) =>
        t.grade?.command ? (
          <span className="mono small">
            {t.grade.command}
            {t.grade.exit_code != null && <span className="muted"> → exit {t.grade.exit_code}</span>}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    { key: 'steps', header: 'Steps', align: 'right', sortValue: (t) => t.steps, render: (t) => fmtInt(t.steps) },
    { key: 'time', header: 'Time', align: 'right', sortValue: (t) => t.duration_ms, render: (t) => fmtDuration(t.duration_ms) },
    { key: 'cost', header: 'Cost', align: 'right', sortValue: (t) => t.cost_usd, render: (t) => fmtUsd(t.cost_usd, 3) },
    {
      key: 'errs',
      header: 'Tool errors',
      align: 'right',
      sortValue: (t) => t.tool_errors,
      render: (t) => (t.tool_errors ? <span style={{ color: 'var(--status-error)' }}>{t.tool_errors}</span> : '0'),
    },
  ]

  const open = openTrial ? trials.find((t) => t.id === openTrial) : null
  const spans = open ? (spansByTrial[open.id] ?? []) : []

  return (
    <>
      <Card title="Trials" note={`${trials.length}`}>
        <DataTable
          rows={trials}
          columns={columns}
          onRowClick={(t) => setOpenTrial(t.id === openTrial ? null : t.id)}
          initialSort={{ key: 'cost', dir: 'desc' }}
        />
      </Card>

      {open && (
        <Card
          title={open.task_id}
          note={`${spans.length} spans`}
          actions={
            <button className="btn" onClick={() => setOpenTrial(null)}>
              Close
            </button>
          }
        >
          <TrialDetail trial={open} spans={spans} />
        </Card>
      )}
    </>
  )
}

function TrialDetail({ trial, spans }: { trial: ImportedTrial; spans: Span[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const owner = useMemo(() => attributeSpans(spans), [spans])
  const perAgent = useMemo(() => agentStats(spans), [spans])

  if (!spans.length) return <Empty>This trial has no spans.</Empty>

  const sel = selected ? spans.find((s) => s.id === selected) : null

  return (
    <div className="vstack" style={{ gap: 12 }}>
      {trial.grade && trial.status !== 'resolved' && (trial.grade.stderr || trial.grade.stdout) && (
        <div className="note" style={{ borderLeftColor: 'var(--status-error)' }}>
          <div className="note-head">
            <b>Test command failed</b>
            <span className="mono small">{trial.grade.command}</span>
          </div>
          <pre className="note-body mono" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', margin: 0 }}>
            {(trial.grade.stderr || trial.grade.stdout || '').slice(0, 1200)}
          </pre>
        </div>
      )}

      {perAgent.length > 1 && (
        <div className="hstack" style={{ gap: 12, flexWrap: 'wrap' }}>
          {perAgent.map((a) => (
            <span key={a.name} className="pill" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  background: a.name === ROOT_AGENT ? 'var(--text-muted)' : SERIES[(a.depth + 1) % SERIES.length],
                }}
              />
              <span className="mono">{a.name}</span>
              <span className="muted">{fmtDuration(a.selfMs)}</span>
            </span>
          ))}
        </div>
      )}

      <Waterfall
        spans={spans}
        events={[]}
        selectedId={selected}
        onSelect={setSelected}
        playhead={playhead}
        onScrub={setPlayhead}
        failureSpanId={trial.failure_span_id}
      />

      {sel && (
        <div className="note">
          <div className="note-head">
            <b className="mono">{sel.name}</b>
            <span className="pill">{sel.type}</span>
            <span className="muted small">by {owner.get(sel.id) ?? ROOT_AGENT}</span>
            <div style={{ flex: 1 }} />
            <span className="muted small mono">{fmtDuration(sel.duration_ms)}</span>
          </div>
          {sel.target && <div className="small mono muted">{sel.target}</div>}
          {sel.error && (
            <pre className="note-body mono" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', color: 'var(--status-error)' }}>
              {sel.error.slice(0, 800)}
            </pre>
          )}
          {sel.output && !sel.error && (
            <pre className="note-body mono" style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', margin: 0 }}>
              {sel.output.slice(0, 800)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------- empty state

function GettingStarted({ onLoadSample }: { onLoadSample: () => void }) {
  const nav = useNavigate()
  return (
    <Card title="Getting started" note="no trace loaded">
      <div className="vstack" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0 }}>
          AgentLens reads JSONL — one record per line, appended as your agent runs. A crashed run still leaves a
          readable trace, which is usually the one worth reading.
        </p>

        <div>
          <div className="toolbar-label" style={{ marginBottom: 6 }}>
            Minimal trace
          </div>
          <pre
            className="mono"
            style={{
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              background: 'var(--surface-2)',
              padding: 12,
              borderRadius: 6,
              margin: 0,
            }}
          >
            {SAMPLE}
          </pre>
        </div>

        <div className="small muted">
          Four record types — <span className="mono">run</span>, <span className="mono">trial</span>,{' '}
          <span className="mono">span</span>, <span className="mono">result</span> — in any order. A subagent is a span
          with <span className="mono">"type":"subagent"</span>; everything whose parent chain reaches it counts as its
          work.
        </div>

        <div className="hstack" style={{ gap: 10 }}>
          <button className="btn primary" onClick={onLoadSample}>
            Load a sample trace
          </button>
          <button className="btn" onClick={() => nav('/how-to')}>
            Read the how-to →
          </button>
        </div>

        <div className="small muted">
          To capture traces automatically, run <span className="mono">npx agentlens init</span> in your project — it
          writes the VS Code tasks and prints the snippet for your agent.
        </div>
      </div>
    </Card>
  )
}
