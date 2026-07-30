import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { failureColor, seqColor } from '../lib/colors'
import { fmtDuration, fmtUsd, runShort, taskShort } from '../lib/format'
import { HBarChart, Heatmap } from '../components/charts'
import { Card, DataTable, DifficultyTag, ErrorState, FailureChip, Loading, StatTile } from '../components/ui'

export default function Failures() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''

  const { data, error, loading } = useApi(
    () => Promise.all([api.failures(category || undefined), api.runs()]).then(([f, runs]) => ({ ...f, runs })),
    [category],
  )

  const matrixIndex = useMemo(() => {
    const m = new Map<string, number>()
    if (!data) return m
    for (const r of data.matrix) m.set(`${r.category}|${r.run_id}`, r.n)
    return m
  }, [data])

  const repoIndex = useMemo(() => {
    const m = new Map<string, number>()
    if (!data) return m
    for (const r of data.byRepo) m.set(`${r.repo}|${r.category}`, r.n)
    return m
  }, [data])

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="failure analysis" /></div>
  if (!data) return null

  const { byCat, trials, runs, meta } = data
  const repos = Array.from(new Set(data.byRepo.map((r) => r.repo))).sort()
  const maxCell = Math.max(...data.matrix.map((m) => m.n), 1)
  const maxRepoCell = Math.max(...data.byRepo.map((m) => m.n), 1)
  const selected = category ? byCat.find((c) => c.category === category) : null

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Failure analysis</h1>
          <p className="page-sub">
            Every unresolved trial is assigned a cause by an automated detector that reads the trajectory — a stall is a
            repeated action, a localization miss is a trajectory that never opens the right file. Each row here drills
            down to the exact span.
          </p>
        </div>
      </div>

      {selected && (
        <div className="toolbar">
          <span className="toolbar-label">Filtered to</span>
          <FailureChip category={selected.category} label={selected.label} />
          <span className="small secondary">{selected.blurb}</span>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={() => setParams(new URLSearchParams())}>
            Show all causes
          </button>
        </div>
      )}

      <div className="grid g4">
        <StatTile label="Failed trials" value={data.trials.length} foot={category ? selected?.label : 'all causes'} />
        <StatTile
          label="Distinct causes"
          value={byCat.length}
          foot="from the automated taxonomy"
        />
        <StatTile
          label="Most common"
          value={byCat[0]?.label ?? '—'}
          foot={`${byCat[0]?.n ?? 0} trials`}
        />
        <StatTile
          label="Wasted spend"
          value={fmtUsd(trials.reduce((a, t) => a + t.cost_usd, 0))}
          foot="cost of trials that produced no fix"
          accent="var(--critical)"
        />
      </div>

      <div className="grid g2">
        <Card title="Causes by volume" note="click to filter">
          <HBarChart
            data={byCat.map((c) => ({ id: c.category, label: c.label, value: c.n, sub: c.blurb }))}
            labelWidth={152}
            highlight={category || undefined}
            onClick={(cat) => setParams(new URLSearchParams(cat === category ? {} : { category: cat }))}
          />
        </Card>

        <Card
          title="Cause by configuration"
          note="darker means more trials — reveals which failures are model-specific vs scaffold-specific"
        >
          <Heatmap
            rows={byCat.map((c) => ({ id: c.category, label: c.label }))}
            cols={runs.map((r) => ({ id: r.id, label: runShort(r.name) }))}
            cellSize={26}
            rowLabelWidth={150}
            onCellClick={(cat, runId) => nav(`/trials?failure=${cat}&run=${runId}`)}
            cell={(cat, runId) => {
              const n = matrixIndex.get(`${cat}|${runId}`) || 0
              return {
                color: n === 0 ? 'var(--surface-2)' : seqColor(n / maxCell),
                title: `${meta[cat]?.label ?? cat}`,
                rows: [
                  ['run', runs.find((r) => r.id === runId)?.name ?? runId],
                  ['trials', String(n)],
                ],
              }
            }}
            legend={
              <div className="chart-legend">
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: 'var(--seq-100)' }} />
                  few
                </span>
                <span className="legend-item">
                  <span className="legend-swatch" style={{ background: 'var(--seq-700)' }} />
                  many
                </span>
                <span className="legend-item muted">counts also shown in the table below</span>
              </div>
            }
          />
        </Card>
      </div>

      <Card title="Cause by repository" note="which codebases break which behaviours">
        <Heatmap
          rows={repos.map((r) => ({ id: r, label: r }))}
          cols={byCat.map((c) => ({ id: c.category, label: c.label }))}
          cellSize={26}
          rowLabelWidth={200}
          onCellClick={(_repo, cat) => setParams(new URLSearchParams({ category: cat }))}
          cell={(repo, cat) => {
            const n = repoIndex.get(`${repo}|${cat}`) || 0
            return {
              color: n === 0 ? 'var(--surface-2)' : seqColor(n / maxRepoCell),
              title: repo,
              rows: [
                ['cause', meta[cat]?.label ?? cat],
                ['trials', String(n)],
              ],
            }
          }}
        />
      </Card>

      <Card title="Cause reference" flush>
        <DataTable
          rows={byCat}
          onRowClick={(c) => setParams(new URLSearchParams({ category: c.category }))}
          columns={[
            {
              key: 'cat',
              header: 'Cause',
              render: (c) => (
                <div className="hstack">
                  <span className="dot" style={{ width: 8, height: 8, borderRadius: 4, background: failureColor(c.category) }} />
                  <div>
                    <div style={{ fontWeight: 550 }}>{c.label}</div>
                    <div className="muted small">{c.blurb}</div>
                  </div>
                </div>
              ),
            },
            { key: 'n', header: 'Trials', align: 'right', sortValue: (c) => c.n, render: (c) => <b className="tnum">{c.n}</b> },
            {
              key: 'steps',
              header: 'Avg steps',
              align: 'right',
              sortValue: (c) => c.avg_steps,
              render: (c) => <span className="tnum">{c.avg_steps}</span>,
            },
            {
              key: 'sec',
              header: 'Avg time',
              align: 'right',
              sortValue: (c) => c.avg_sec,
              render: (c) => <span className="tnum">{fmtDuration(c.avg_sec * 1000)}</span>,
            },
            {
              key: 'cost',
              header: 'Avg cost',
              align: 'right',
              sortValue: (c) => c.avg_cost,
              render: (c) => <span className="tnum">{fmtUsd(c.avg_cost, 3)}</span>,
            },
          ]}
        />
      </Card>

      <Card title={category ? `${selected?.label} — affected trials` : 'All failed trials'} flush>
        <DataTable
          rows={trials}
          maxHeight={560}
          onRowClick={(t) => nav(`/trials/${t.id}`)}
          columns={[
            {
              key: 'task',
              header: 'Instance',
              render: (t) => (
                <div>
                  <div className="mono">{taskShort(t.task_id)}</div>
                  <div className="muted small">{t.repo}</div>
                </div>
              ),
            },
            { key: 'run', header: 'Run', render: (t) => <span className="small">{t.run_name}</span> },
            { key: 'diff', header: 'Diff.', render: (t) => <DifficultyTag level={t.difficulty} /> },
            {
              key: 'cause',
              header: 'Cause',
              render: (t) => (
                <FailureChip
                  category={t.failure_category}
                  label={t.failure_category ? meta[t.failure_category]?.label : undefined}
                />
              ),
            },
            {
              key: 'why',
              header: 'Diagnosis',
              render: (t) => <span className="small secondary truncate" style={{ maxWidth: '56ch' }}>{t.failure_summary}</span>,
            },
            {
              key: 'loc',
              header: 'Localized',
              align: 'right',
              sortValue: (t) => t.localized,
              render: (t) => (
                <span className="small" style={{ color: t.localized ? 'var(--success-text)' : 'var(--critical)' }}>
                  {t.localized ? '✓ yes' : '✗ no'}
                </span>
              ),
            },
            {
              key: 'cost',
              header: 'Cost',
              align: 'right',
              sortValue: (t) => t.cost_usd,
              render: (t) => <span className="tnum">{fmtUsd(t.cost_usd, 3)}</span>,
            },
          ]}
        />
      </Card>
    </div>
  )
}
