import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { fmtCompact, fmtDuration, fmtUsd, taskShort } from '../lib/format'
import { Card, DataTable, DifficultyTag, ErrorState, FailureChip, Loading, Select } from '../components/ui'

export default function Trials() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState('')

  const run = params.get('run') || ''
  const status = params.get('status') || ''
  const failure = params.get('failure') || ''

  const { data, error, loading } = useApi(
    () =>
      Promise.all([
        api.trials(Object.fromEntries([...params].filter(([, v]) => v))),
        api.runs(),
        api.meta(),
      ]).then(([trials, runs, meta]) => ({ trials, runs, meta })),
    [params.toString()],
  )

  const rows = useMemo(() => {
    if (!data) return []
    const q = text.trim().toLowerCase()
    if (!q) return data.trials
    return data.trials.filter(
      (t) =>
        t.task_id.toLowerCase().includes(q) ||
        (t.issue_title || '').toLowerCase().includes(q) ||
        (t.repo || '').toLowerCase().includes(q),
    )
  }, [data, text])

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next)
  }

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="traces" /></div>
  if (!data) return null

  const categories = Object.keys(data.meta.failureCategories)

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Traces</h1>
          <p className="page-sub">
            Every agent attempt, filterable. Open one to step through its timeline and see exactly where it went wrong.
          </p>
        </div>
      </div>

      {/* One filter row above everything it scopes. */}
      <div className="toolbar">
        <Select
          label="Run"
          value={run}
          onChange={(v) => setParam('run', v)}
          options={[{ value: '', label: 'All runs' }, ...data.runs.map((r) => ({ value: r.id, label: r.name }))]}
        />
        <Select
          label="Result"
          value={status}
          onChange={(v) => setParam('status', v)}
          options={[
            { value: '', label: 'Any' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'unresolved', label: 'Unresolved' },
            { value: 'timeout', label: 'Step cap' },
            { value: 'errored', label: 'Harness error' },
          ]}
        />
        <Select
          label="Cause"
          value={failure}
          onChange={(v) => setParam('failure', v)}
          options={[
            { value: '', label: 'Any' },
            ...categories.map((c) => ({ value: c, label: data.meta.failureCategories[c].label })),
          ]}
        />
        <input
          className="ctl"
          placeholder="Filter by instance or repo…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <span className="card-note">{rows.length} traces</span>
        {[...params].length > 0 && (
          <button className="btn" onClick={() => setParams(new URLSearchParams())}>
            Clear filters
          </button>
        )}
      </div>

      <Card flush>
        <DataTable
          rows={rows}
          onRowClick={(t) => nav(`/trials/${t.id}`)}
          initialSort={{ key: 'when', dir: 'desc' }}
          emptyText="No traces match these filters."
          columns={[
            {
              key: 'task',
              header: 'Instance',
              render: (t) => (
                <div>
                  <div className="mono">{taskShort(t.task_id)}</div>
                  <div className="muted small truncate">{t.issue_title}</div>
                </div>
              ),
            },
            { key: 'run', header: 'Run', render: (t) => <span className="small">{t.run_name}</span> },
            { key: 'diff', header: 'Diff.', render: (t) => <DifficultyTag level={t.difficulty} /> },
            {
              key: 'result',
              header: 'Result',
              sortValue: (t) => t.status,
              render: (t) =>
                t.status === 'resolved' ? (
                  <span className="badge resolved">✓ Resolved</span>
                ) : (
                  <FailureChip
                    category={t.failure_category}
                    label={t.failure_category ? data.meta.failureCategories[t.failure_category]?.label : undefined}
                  />
                ),
            },
            {
              key: 'tests',
              header: 'Tests',
              align: 'right',
              sortValue: (t) => t.f2p_passed / Math.max(1, t.f2p_total),
              render: (t) => (
                <span className="tnum small">
                  {t.f2p_passed}/{t.f2p_total}
                  <span className="muted"> f2p</span>
                </span>
              ),
            },
            {
              key: 'steps',
              header: 'Steps',
              align: 'right',
              sortValue: (t) => t.steps,
              render: (t) => <span className="tnum">{t.steps}</span>,
            },
            {
              key: 'dur',
              header: 'Time',
              align: 'right',
              sortValue: (t) => t.duration_ms,
              render: (t) => <span className="tnum">{fmtDuration(t.duration_ms)}</span>,
            },
            {
              key: 'tok',
              header: 'Tokens',
              align: 'right',
              sortValue: (t) => t.tokens_in + t.tokens_out,
              render: (t) => <span className="tnum">{fmtCompact(t.tokens_in + t.tokens_out)}</span>,
            },
            {
              key: 'cost',
              header: 'Cost',
              align: 'right',
              sortValue: (t) => t.cost_usd,
              render: (t) => <span className="tnum">{fmtUsd(t.cost_usd, 3)}</span>,
            },
            {
              key: 'when',
              header: 'Started',
              align: 'right',
              sortValue: (t) => t.started_at,
              render: (t) => (
                <span className="muted small tnum">{new Date(t.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
