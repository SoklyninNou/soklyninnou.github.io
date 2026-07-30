import { useNavigate, useParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { fmtDuration, fmtUsd, taskShort } from '../lib/format'
import { Card, CodeBlock, DataTable, DifficultyTag, ErrorState, FailureChip, Loading, StatTile, StatusBadge } from '../components/ui'

export default function TaskDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { data, error, loading } = useApi(() => api.task(id), [id])

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="instance" /></div>
  if (!data) return null

  const { task, trials } = data
  const solved = trials.filter((t) => t.status === 'resolved').length
  const localized = trials.filter((t) => t.localized).length

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="hstack" style={{ marginBottom: 6 }}>
            <span className="pill">{task.repo}</span>
            <DifficultyTag level={task.difficulty} />
            {task.tags.map((t) => (
              <span className="pill" key={t}>
                {t}
              </span>
            ))}
          </div>
          <h1 className="page-title mono" style={{ fontSize: 18 }}>
            {taskShort(task.id)}
          </h1>
          <p className="page-sub">{task.issue_title}</p>
        </div>
      </div>

      <div className="grid g4">
        <StatTile label="Solved by" value={`${solved}/${trials.length}`} foot="configurations" />
        <StatTile label="Localized by" value={`${localized}/${trials.length}`} foot="opened the right file" />
        <StatTile
          label="Median steps"
          value={median(trials.map((t) => t.steps)).toFixed(0)}
          foot="across attempts"
        />
        <StatTile
          label="Total spend"
          value={fmtUsd(trials.reduce((a, t) => a + t.cost_usd, 0))}
          foot="on this instance alone"
        />
      </div>

      <div className="grid g-2-1">
        <Card title="Issue">
          <p className="secondary" style={{ marginTop: 0 }}>
            {task.issue_body}
          </p>
        </Card>
        <Card title="Ground truth">
          <dl className="kv">
            <dt>Base commit</dt>
            <dd className="mono">{task.base_commit.slice(0, 12)}</dd>
            <dt>Files to change</dt>
            <dd className="mono">{task.gold_files.join('\n')}</dd>
            <dt>Fail-to-pass</dt>
            <dd className="mono small">{task.fail_to_pass.join('\n')}</dd>
            <dt>Pass-to-pass</dt>
            <dd className="mono small">{task.pass_to_pass.length} regression tests</dd>
          </dl>
          {task.gold_patch && (
            <div style={{ marginTop: 10 }}>
              <div className="card-note" style={{ marginBottom: 4 }}>
                Shape of the reference fix
              </div>
              <CodeBlock text={task.gold_patch} />
            </div>
          )}
        </Card>
      </div>

      <Card title="How each configuration did" note="click a row to open the trace" flush>
        <DataTable
          rows={trials}
          onRowClick={(t) => nav(`/trials/${t.id}`)}
          columns={[
            { key: 'run', header: 'Configuration', render: (t) => <span style={{ fontWeight: 550 }}>{t.run_name}</span> },
            { key: 'status', header: 'Result', render: (t) => <StatusBadge status={t.status} /> },
            { key: 'cause', header: 'Cause', render: (t) => <FailureChip category={t.failure_category} /> },
            {
              key: 'loc',
              header: 'Localized',
              render: (t) => (
                <span className="small" style={{ color: t.localized ? 'var(--success-text)' : 'var(--critical)' }}>
                  {t.localized ? '✓ yes' : '✗ no'}
                </span>
              ),
            },
            {
              key: 'files',
              header: 'Files touched',
              render: (t) => <span className="mono small truncate">{t.files_touched.join(', ') || '—'}</span>,
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
              key: 'cost',
              header: 'Cost',
              align: 'right',
              sortValue: (t) => t.cost_usd,
              render: (t) => <span className="tnum">{fmtUsd(t.cost_usd, 3)}</span>,
            },
          ]}
        />
      </Card>

      {trials.length > 1 && (
        <div className="hstack">
          <button
            className="btn primary"
            onClick={() => nav(`/compare?ids=${trials[0].id},${trials[1].id}`)}
          >
            Compare the first two attempts ⇄
          </button>
        </div>
      )}
    </div>
  )
}

function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
