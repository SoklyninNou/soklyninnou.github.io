import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, useApi, type Trial } from '../lib/api'
import { KIND_COLOR, KIND_LABEL, KIND_ORDER, STATUS_COLOR, STATUS_LABEL, outcomeLegend } from '../lib/colors'
import { fmtCompact, fmtDuration, fmtUsd, taskShort } from '../lib/format'
import { BandChart, HBarChart, Histogram, Legend, useTooltip } from '../components/charts'
import { FlowGraph } from '../components/FlowGraph'
import {
  Card,
  DataTable,
  DifficultyTag,
  ErrorState,
  FailureChip,
  Loading,
  Segmented,
  StatTile,
  StatusBadge,
} from '../components/ui'

export default function RunDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { data, error, loading } = useApi(() => api.run(id), [id])
  const [filter, setFilter] = useState<'all' | 'resolved' | 'failed'>('all')

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="run" /></div>
  if (!data) return null

  const { run, summary, trials, failures, stepHistogram, costHistogram, tools, flow, phases } = data
  const shown = trials.filter((t) =>
    filter === 'all' ? true : filter === 'resolved' ? t.status === 'resolved' : t.status !== 'resolved',
  )

  const phaseKeys = [...KIND_ORDER]
  const phaseColors: Record<string, string> = {
    search: KIND_COLOR.search,
    read: KIND_COLOR.read,
    edit: KIND_COLOR.edit,
    test: KIND_COLOR.test,
    other: 'var(--text-muted)',
  }
  const phaseLabels: Record<string, string> = {
    search: KIND_LABEL.search,
    read: KIND_LABEL.read,
    edit: KIND_LABEL.edit,
    test: KIND_LABEL.test,
    other: KIND_LABEL.other,
  }

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">{run.name}</h1>
          <p className="page-sub">{run.notes}</p>
          <div className="hstack" style={{ marginTop: 8 }}>
            <span className="pill">{run.model}</span>
            <span className="pill">{run.scaffold}@{run.scaffold_ver}</span>
            <span className="pill">temp {run.temperature}</span>
            <span className="pill">max {run.max_steps} steps</span>
            <span className="pill">budget {fmtUsd(run.budget_usd)}</span>
            <span className="pill">{run.suite}</span>
          </div>
        </div>
      </div>

      <div className="grid g6">
        <StatTile
          label="Resolve rate"
          value={summary.resolvePct.toFixed(1)}
          unit="%"
          foot={`${summary.resolved}/${summary.trials} trials`}
        />
        <StatTile
          label="Localization rate"
          value={summary.localizePct.toFixed(0)}
          unit="%"
          foot="opened the file the fix needs"
        />
        <StatTile label="Total cost" value={fmtUsd(summary.cost)} foot={`median ${fmtUsd(summary.costDist.p50, 3)}`} />
        <StatTile
          label="Steps"
          value={summary.steps.p50.toFixed(0)}
          foot={`p90 ${summary.steps.p90.toFixed(0)} · max ${summary.steps.max}`}
        />
        <StatTile
          label="Median duration"
          value={fmtDuration(summary.duration.p50)}
          foot={`p90 ${fmtDuration(summary.duration.p90)}`}
        />
        <StatTile
          label="Tool error rate"
          value={summary.toolErrorRate.toFixed(1)}
          unit="%"
          accent={summary.toolErrorRate > 8 ? 'var(--critical)' : undefined}
          foot={`peak context ${summary.contextPeak.max.toFixed(0)}%`}
        />
      </div>

      <Card
        title="Outcome by task"
        note="one square per benchmark instance — click to open its trace"
      >
        <OutcomeGrid trials={trials} onOpen={(t) => nav(`/trials/${t.id}`)} />
      </Card>

      <div className="grid g2">
        <Card title="Why this configuration fails" note="click to filter the failure explorer">
          {failures.length ? (
            <HBarChart
              data={failures.map((f) => ({ id: f.category, label: f.label, value: f.n, sub: f.blurb }))}
              labelWidth={150}
              onClick={(cat) => nav(`/failures?category=${cat}`)}
            />
          ) : (
            <span className="muted small">No failures in this run.</span>
          )}
        </Card>

        <Card title="Where the effort goes" note="share of tool time across the trajectory, start to end">
          <BandChart buckets={phases} keys={phaseKeys} colors={phaseColors} labels={phaseLabels} height={200} />
          <Legend items={phaseKeys.map((k) => ({ label: phaseLabels[k], color: phaseColors[k] }))} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Steps per trial" note="distribution across the suite">
          <Histogram bins={stepHistogram} xTitle="agent steps" formatX={(v) => v.toFixed(0)} />
        </Card>
        <Card title="Cost per trial" note="distribution across the suite">
          <Histogram bins={costHistogram} xTitle="USD per trial" formatX={(v) => `$${v.toFixed(2)}`} color="var(--series-1)" />
        </Card>
      </div>

      <Card
        title="Agent behaviour graph"
        note="every action-to-action transition in the run, aggregated"
      >
        <FlowGraph nodes={flow.nodes} edges={flow.edges} height={340} />
      </Card>

      <div className="grid g-1-2">
        <Card title="Tool reliability" flush>
          <DataTable
            rows={tools}
            columns={[
              { key: 'name', header: 'Tool', render: (t) => <span className="mono">{t.name}</span> },
              { key: 'calls', header: 'Calls', align: 'right', sortValue: (t) => t.calls, render: (t) => <span className="tnum">{t.calls}</span> },
              {
                key: 'err',
                header: 'Error rate',
                align: 'right',
                sortValue: (t) => t.errors / (t.calls || 1),
                render: (t) => (
                  <span className="tnum" style={{ color: t.errors ? 'var(--critical)' : undefined }}>
                    {((t.errors / (t.calls || 1)) * 100).toFixed(1)}%
                  </span>
                ),
              },
              {
                key: 'ms',
                header: 'Avg',
                align: 'right',
                sortValue: (t) => t.avg_ms,
                render: (t) => <span className="tnum">{fmtDuration(t.avg_ms)}</span>,
              },
            ]}
          />
        </Card>

        <Card
          title="Trials"
          flush
          actions={
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All ${trials.length}` },
                { value: 'resolved', label: `Resolved ${summary.resolved}` },
                { value: 'failed', label: `Failed ${trials.length - summary.resolved}` },
              ]}
            />
          }
        >
          <DataTable
            rows={shown}
            maxHeight={420}
            onRowClick={(t) => nav(`/trials/${t.id}`)}
            initialSort={{ key: 'cost', dir: 'desc' }}
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
              { key: 'diff', header: 'Diff.', render: (t) => <DifficultyTag level={t.difficulty} /> },
              { key: 'status', header: 'Result', render: (t) => <StatusBadge status={t.status} /> },
              { key: 'cause', header: 'Cause', render: (t) => <FailureChip category={t.failure_category} /> },
              {
                key: 'steps',
                header: 'Steps',
                align: 'right',
                sortValue: (t) => t.steps,
                render: (t) => <span className="tnum">{t.steps}</span>,
              },
              {
                key: 'cost',
                header: 'Cost',
                align: 'right',
                sortValue: (t) => t.cost_usd,
                render: (t) => <span className="tnum">{fmtUsd(t.cost_usd, 3)}</span>,
              },
              {
                key: 'tok',
                header: 'Tokens',
                align: 'right',
                sortValue: (t) => t.tokens_in + t.tokens_out,
                render: (t) => <span className="tnum">{fmtCompact(t.tokens_in + t.tokens_out)}</span>,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

/** Compact per-instance outcome strip — the run's whole result set at a glance. */
function OutcomeGrid({ trials, onOpen }: { trials: Trial[]; onOpen: (t: Trial) => void }) {
  const { show, hide, node } = useTooltip()
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {trials.map((t) => (
          <button
            key={t.id}
            onClick={() => onOpen(t)}
            onMouseMove={(e) =>
              show(e, {
                title: taskShort(t.task_id),
                rows: [
                  ['result', STATUS_LABEL[t.status]],
                  ...(t.failure_category ? ([['cause', t.failure_category.replace(/_/g, ' ')]] as [string, string][]) : []),
                  ['steps', String(t.steps)],
                  ['cost', fmtUsd(t.cost_usd, 3)],
                ],
              })
            }
            onMouseLeave={hide}
            aria-label={`${taskShort(t.task_id)} — ${STATUS_LABEL[t.status]}`}
            style={{
              width: 26,
              height: 26,
              borderRadius: 5,
              border: '1px solid var(--border)',
              background: STATUS_COLOR[t.status],
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
      <Legend items={outcomeLegend(trials.map((t) => t.status))} />
      {node}
    </div>
  )
}
