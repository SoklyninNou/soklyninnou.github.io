import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useApi, type Trial } from '../lib/api'
import { STATUS_COLOR, STATUS_LABEL, outcomeLegend } from '../lib/colors'
import { fmtCompact, fmtDuration, fmtPct, fmtUsd, runShort, taskShort } from '../lib/format'
import { HBarChart, Heatmap, Legend } from '../components/charts'
import { Card, DataTable, ErrorState, Loading } from '../components/ui'

export default function Runs() {
  const nav = useNavigate()
  const { data, error, loading } = useApi(
    () => Promise.all([api.runs(), api.tasks(), api.trials()]).then(([runs, tasks, trials]) => ({ runs, tasks, trials })),
    [],
  )

  const index = useMemo(() => {
    const m = new Map<string, Trial>()
    if (!data) return m
    for (const t of data.trials) m.set(`${t.task_id}|${t.run_id}`, t)
    return m
  }, [data])

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="runs" /></div>
  if (!data) return null

  const { runs, tasks } = data

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Runs</h1>
          <p className="page-sub">
            Each run is one agent configuration swept across the whole suite. Compare them here, then open one to see
            where its failures cluster.
          </p>
        </div>
      </div>

      <div className="grid g2">
        <Card title="Resolve rate" note="share of instances fully resolved">
          <HBarChart
            data={runs.map((r) => ({ id: r.id, label: r.name, value: r.resolve_pct ?? 0 }))}
            formatValue={(v) => `${v.toFixed(0)}%`}
            domainMax={100}
            onClick={(id) => nav(`/runs/${id}`)}
          />
        </Card>
        <Card title="Localization rate" note="opened the file the reference patch changes">
          <HBarChart
            data={runs.map((r) => ({ id: r.id, label: r.name, value: r.localize_pct ?? 0 }))}
            formatValue={(v) => `${v.toFixed(0)}%`}
            domainMax={100}
            color="var(--series-3)"
            onClick={(id) => nav(`/runs/${id}`)}
          />
        </Card>
      </div>

      <Card
        title="Instance × configuration outcomes"
        note="rows are benchmark instances, columns are runs — click any cell to open that trace"
      >
        <Heatmap
          rows={tasks.map((t) => ({ id: t.id, label: taskShort(t.id) }))}
          cols={runs.map((r) => ({ id: r.id, label: runShort(r.name) }))}
          cellSize={24}
          rowLabelWidth={200}
          onCellClick={(taskId, runId) => {
            const t = index.get(`${taskId}|${runId}`)
            if (t) nav(`/trials/${t.id}`)
          }}
          cell={(taskId, runId) => {
            const t = index.get(`${taskId}|${runId}`)
            if (!t) return null
            return {
              color: STATUS_COLOR[t.status],
              title: `${taskShort(taskId)} · ${runs.find((r) => r.id === runId)?.name ?? runId}`,
              rows: [
                ['result', STATUS_LABEL[t.status]],
                ...(t.failure_category
                  ? ([['cause', t.failure_category.replace(/_/g, ' ')]] as [string, string][])
                  : []),
                ['steps', String(t.steps)],
                ['cost', fmtUsd(t.cost_usd, 3)],
              ],
            }
          }}
          legend={<Legend items={outcomeLegend(data.trials.map((t) => t.status))} />}
        />
      </Card>

      <Card title="Configuration detail" flush>
        <DataTable
          rows={runs}
          onRowClick={(r) => nav(`/runs/${r.id}`)}
          initialSort={{ key: 'resolve', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              header: 'Run',
              render: (r) => (
                <div>
                  <div style={{ fontWeight: 550 }}>{r.name}</div>
                  <div className="muted small">
                    {r.scaffold}@{r.scaffold_ver} · temp {r.temperature} · max {r.max_steps} steps
                  </div>
                </div>
              ),
            },
            {
              key: 'resolve',
              header: 'Resolve',
              align: 'right',
              sortValue: (r) => r.resolve_pct ?? 0,
              render: (r) => <b className="tnum">{fmtPct(r.resolve_pct ?? 0)}</b>,
            },
            {
              key: 'loc',
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
              key: 'dur',
              header: 'Avg time',
              align: 'right',
              sortValue: (r) => r.avg_sec ?? 0,
              render: (r) => <span className="tnum">{fmtDuration((r.avg_sec ?? 0) * 1000)}</span>,
            },
            {
              key: 'tokens',
              header: 'Tokens',
              align: 'right',
              sortValue: (r) => (r.tokens_in ?? 0) + (r.tokens_out ?? 0),
              render: (r) => <span className="tnum">{fmtCompact((r.tokens_in ?? 0) + (r.tokens_out ?? 0))}</span>,
            },
            {
              key: 'cost',
              header: 'Cost',
              align: 'right',
              sortValue: (r) => r.cost_usd ?? 0,
              render: (r) => <span className="tnum">{fmtUsd(r.cost_usd ?? 0)}</span>,
            },
            {
              key: 'cpr',
              header: 'Cost / resolved',
              align: 'right',
              sortValue: (r) => (r.cost_usd ?? 0) / Math.max(1, r.resolved ?? 1),
              render: (r) => (
                <span className="tnum">{fmtUsd((r.cost_usd ?? 0) / Math.max(1, r.resolved ?? 1), 2)}</span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
