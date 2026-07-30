import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { fmtUsd, taskShort } from '../lib/format'
import { HBarChart, Meter } from '../components/charts'
import { Card, DataTable, DifficultyTag, ErrorState, Loading, Select, StatTile } from '../components/ui'

export default function Tasks() {
  const nav = useNavigate()
  const { data, error, loading } = useApi(() => api.tasks(), [])
  const [repo, setRepo] = useState('')
  const [difficulty, setDifficulty] = useState('')

  const repos = useMemo(() => Array.from(new Set((data ?? []).map((t) => t.repo))).sort(), [data])
  const rows = useMemo(
    () =>
      (data ?? []).filter((t) => (!repo || t.repo === repo) && (!difficulty || t.difficulty === difficulty)),
    [data, repo, difficulty],
  )

  if (error) return <div className="content"><ErrorState message={error} /></div>
  if (loading && !data) return <div className="content"><Loading what="tasks" /></div>
  if (!data) return null

  const byRepo = repos
    .map((r) => {
      const ts = data.filter((t) => t.repo === r)
      const solved = ts.reduce((a, t) => a + (t.solved ?? 0), 0)
      const attempts = ts.reduce((a, t) => a + (t.attempts ?? 0), 0)
      return { id: r, label: r, value: attempts ? (solved / attempts) * 100 : 0, sub: `${solved}/${attempts} trials` }
    })
    .sort((a, b) => b.value - a.value)

  const unsolved = data.filter((t) => (t.solved ?? 0) === 0).length

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Benchmark instances</h1>
          <p className="page-sub">
            The suite itself, ranked by how often agents solve it. Instances no configuration solves are the ones worth
            reading by hand — they usually share a structural property.
          </p>
        </div>
      </div>

      <div className="grid g4">
        <StatTile label="Instances" value={data.length} foot="swe-bench-verified subset" />
        <StatTile label="Never solved" value={unsolved} foot="by any configuration" accent={unsolved ? 'var(--critical)' : undefined} />
        <StatTile
          label="Solved by all"
          value={data.filter((t) => (t.solved ?? 0) === (t.attempts ?? 0) && (t.attempts ?? 0) > 0).length}
          foot="saturated — low signal"
        />
        <StatTile label="Repositories" value={repos.length} foot="distinct codebases" />
      </div>

      <div className="grid g-1-2">
        <Card title="Solve rate by repository" note="all configurations pooled">
          <HBarChart data={byRepo} formatValue={(v) => `${v.toFixed(0)}%`} domainMax={100} labelWidth={168} />
        </Card>

        <Card title="Instances" flush actions={
          <div className="hstack">
            <Select
              value={repo}
              onChange={setRepo}
              options={[{ value: '', label: 'All repos' }, ...repos.map((r) => ({ value: r, label: r }))]}
            />
            <Select
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: '', label: 'Any difficulty' },
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
          </div>
        }>
          <DataTable
            rows={rows}
            maxHeight={520}
            onRowClick={(t) => nav(`/tasks/${t.id}`)}
            initialSort={{ key: 'solve', dir: 'asc' }}
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
              { key: 'diff', header: 'Diff.', render: (t) => <DifficultyTag level={t.difficulty} /> },
              {
                key: 'solve',
                header: 'Solve rate',
                align: 'right',
                sortValue: (t) => t.solve_pct ?? 0,
                render: (t) => (
                  <div style={{ minWidth: 92 }}>
                    <div className="tnum small" style={{ marginBottom: 3 }}>
                      {t.solved}/{t.attempts}
                    </div>
                    <Meter
                      value={t.solve_pct ?? 0}
                      color={(t.solve_pct ?? 0) === 0 ? 'var(--critical)' : 'var(--series-1)'}
                    />
                  </div>
                ),
              },
              {
                key: 'steps',
                header: 'Avg steps',
                align: 'right',
                sortValue: (t) => t.avg_steps ?? 0,
                render: (t) => <span className="tnum">{t.avg_steps}</span>,
              },
              {
                key: 'cost',
                header: 'Avg cost',
                align: 'right',
                sortValue: (t) => t.avg_cost ?? 0,
                render: (t) => <span className="tnum">{fmtUsd(t.avg_cost ?? 0, 3)}</span>,
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
