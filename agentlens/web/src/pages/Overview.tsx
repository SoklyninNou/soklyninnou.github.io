import { useNavigate } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { FOLDED_LABEL, OTHER, failureColor, isFolded } from '../lib/colors'
import { fmtCompact, fmtDuration, fmtPct, fmtUsd, fmtAgo, runShort, taskShort } from '../lib/format'
import { HBarChart, Legend, Scatter, StackedBar } from '../components/charts'
import { Card, DataTable, DifficultyTag, ErrorState, FailureChip, Loading, StatTile, StatusBadge } from '../components/ui'

export default function Overview() {
  const nav = useNavigate()
  const { data, error, loading } = useApi(() => api.overview(), [])

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="evaluation summary" /></div>
  if (!data) return null

  const { totals, runs, taxonomy, failureByRun, recent, hardest } = data

  // Categorical slots are assigned by identity and capped at seven; the tail folds.
  const topCats = taxonomy.filter((t) => !isFolded(t.category)).map((t) => t.category)
  const stackKeys = [...topCats, '__other__']
  const stackColors: Record<string, string> = Object.fromEntries([
    ...topCats.map((c) => [c, failureColor(c)]),
    ['__other__', OTHER],
  ])
  const stackLabels: Record<string, string> = Object.fromEntries([
    ...taxonomy.map((t) => [t.category, t.label]),
    ['__other__', FOLDED_LABEL],
  ])
  const stackRows = runs.map((r) => {
    const src = failureByRun[r.id] || {}
    const values: Record<string, number> = {}
    for (const [cat, n] of Object.entries(src)) {
      const key = isFolded(cat) ? '__other__' : cat
      values[key] = (values[key] || 0) + n
    }
    return { id: r.id, label: r.name, values }
  })

  const best = [...runs].sort((a, b) => (b.resolve_pct || 0) - (a.resolve_pct || 0))[0]

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Evaluation overview</h1>
          <p className="page-sub">
            {totals.trials} agent trials across {totals.runs} configurations on swe-bench-verified. Every number here
            drills through to the trace that produced it.
          </p>
        </div>
      </div>

      <div className="grid g6">
        <StatTile
          label="Resolve rate"
          value={totals.resolvePct.toFixed(1)}
          unit="%"
          foot={`${totals.resolved} of ${totals.trials} trials`}
        />
        <StatTile label="Best configuration" value={`${(best?.resolve_pct ?? 0).toFixed(1)}%`} foot={best?.name} />
        <StatTile label="Total spend" value={fmtUsd(totals.cost)} foot={`${fmtCompact(totals.tokens)} tokens`} />
        <StatTile label="Agent time" value={totals.agentHours} unit="h" foot="wall-clock across all trials" />
        <StatTile
          label="Tool calls"
          value={fmtCompact(totals.toolCalls, 1)}
          foot={`${((totals.toolErrors / (totals.toolCalls || 1)) * 100).toFixed(1)}% errored`}
        />
        <StatTile
          label="Unresolved"
          value={totals.trials - totals.resolved}
          foot="every one has a diagnosed cause"
          accent="var(--critical)"
        />
      </div>

      <div className="grid g2">
        <Card title="Resolve rate by configuration" note="click a bar to open the run">
          <HBarChart
            data={runs.map((r) => ({
              id: r.id,
              label: r.name,
              value: r.resolve_pct ?? 0,
              sub: `${r.resolved}/${r.trials} resolved · ${fmtUsd(r.cost_usd ?? 0)}`,
            }))}
            formatValue={(v) => `${v.toFixed(0)}%`}
            domainMax={100}
            onClick={(id) => nav(`/runs/${id}`)}
          />
        </Card>

        <Card title="Cost against quality" note="each point is one configuration">
          <Scatter
            points={runs.map((r) => ({
              id: r.id,
              x: r.cost_usd ?? 0,
              y: r.resolve_pct ?? 0,
              label: runShort(r.name),
              note: r.name,
            }))}
            xLabel="Total cost (USD)"
            yLabel="Resolve rate (%)"
            formatX={(v) => `$${v.toFixed(v < 10 ? 1 : 0)}`}
            formatY={(v) => `${v.toFixed(0)}%`}
            onClick={(id) => nav(`/runs/${id}`)}
            height={266}
          />
        </Card>
      </div>

      <div className="grid g-1-2">
        <Card title="Why trials fail" note="all runs combined">
          {/* One measure over nominal categories → a single hue, not a ramp. */}
          <HBarChart
            data={taxonomy.map((t) => ({ id: t.category, label: t.label, value: t.n, sub: t.blurb }))}
            labelWidth={148}
            onClick={(id) => nav(`/failures?category=${id}`)}
          />
        </Card>

        <Card title="Failure mix per configuration" note="click a segment to drill in">
          <StackedBar
            rows={stackRows}
            keys={stackKeys}
            colors={stackColors}
            labels={stackLabels}
            onSegment={(runId, key) =>
              nav(key === '__other__' ? `/trials?run=${runId}` : `/failures?category=${key}`)
            }
          />
          <Legend
            items={[
              ...topCats.map((c) => ({ label: stackLabels[c], color: stackColors[c] })),
              { label: FOLDED_LABEL, color: OTHER },
            ]}
          />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Hardest tasks" note="lowest solve rate across all configurations" flush>
          <DataTable
            rows={hardest}
            onRowClick={(t) => nav(`/tasks/${t.id}`)}
            columns={[
              {
                key: 'id',
                header: 'Instance',
                render: (t) => (
                  <div>
                    <div className="mono">{taskShort(t.id)}</div>
                    <div className="muted small truncate">{t.issue_title}</div>
                  </div>
                ),
              },
              { key: 'diff', header: 'Difficulty', render: (t) => <DifficultyTag level={t.difficulty} /> },
              {
                key: 'solve',
                header: 'Solved',
                align: 'right',
                sortValue: (t) => t.solve_pct ?? 0,
                render: (t) => (
                  <span className="tnum">
                    {t.solved}/{t.attempts}
                  </span>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Latest trials" flush>
          <DataTable
            rows={recent}
            onRowClick={(t) => nav(`/trials/${t.id}`)}
            columns={[
              {
                key: 'task',
                header: 'Trial',
                render: (t) => (
                  <div>
                    <div className="mono">{taskShort(t.task_id)}</div>
                    <div className="muted small">{t.run_name}</div>
                  </div>
                ),
              },
              { key: 'status', header: 'Result', render: (t) => <StatusBadge status={t.status} /> },
              {
                key: 'cause',
                header: 'Cause',
                render: (t) => <FailureChip category={t.failure_category} />,
              },
              {
                key: 'dur',
                header: 'Duration',
                align: 'right',
                sortValue: (t) => t.duration_ms,
                render: (t) => <span className="tnum">{fmtDuration(t.duration_ms)}</span>,
              },
              {
                key: 'when',
                header: 'When',
                align: 'right',
                sortValue: (t) => t.started_at,
                render: (t) => <span className="muted small">{fmtAgo(t.started_at)}</span>,
              },
            ]}
          />
        </Card>
      </div>

      <Card title="All configurations" flush>
        <DataTable
          rows={runs}
          onRowClick={(r) => nav(`/runs/${r.id}`)}
          initialSort={{ key: 'resolve', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              header: 'Configuration',
              render: (r) => (
                <div>
                  <div style={{ fontWeight: 550 }}>{r.name}</div>
                  <div className="muted small">{r.notes}</div>
                </div>
              ),
            },
            { key: 'model', header: 'Model', render: (r) => <span className="pill">{r.model}</span> },
            {
              key: 'resolve',
              header: 'Resolve',
              align: 'right',
              sortValue: (r) => r.resolve_pct ?? 0,
              render: (r) => <b className="tnum">{fmtPct(r.resolve_pct ?? 0, 1)}</b>,
            },
            {
              key: 'localize',
              header: 'Localized',
              align: 'right',
              sortValue: (r) => r.localize_pct ?? 0,
              render: (r) => <span className="tnum">{fmtPct(r.localize_pct ?? 0, 0)}</span>,
            },
            {
              key: 'steps',
              header: 'Avg steps',
              align: 'right',
              sortValue: (r) => r.avg_steps ?? 0,
              render: (r) => <span className="tnum">{r.avg_steps}</span>,
            },
            {
              key: 'cost',
              header: 'Cost',
              align: 'right',
              sortValue: (r) => r.cost_usd ?? 0,
              render: (r) => <span className="tnum">{fmtUsd(r.cost_usd ?? 0)}</span>,
            },
            {
              key: 'toolerr',
              header: 'Tool errors',
              align: 'right',
              sortValue: (r) => (r.tool_errors ?? 0) / (r.tool_calls || 1),
              render: (r) => (
                <span className="tnum">{(((r.tool_errors ?? 0) / (r.tool_calls || 1)) * 100).toFixed(1)}%</span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
