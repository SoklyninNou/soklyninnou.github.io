import { resetDb } from './db.js'
import { generateTrial, makeRng, TASKS, RUN_CONFIGS } from './generate.js'

const SEED = Number(process.env.AGENTLENS_SEED || 20260729)

const REVIEWS = [
  {
    label: 'confirmed',
    body: 'Confirmed by hand: the agent read the right module but patched the caller instead of the definition. Same root cause as the other two admin-url failures in this run.',
  },
  {
    label: 'mislabelled',
    body: 'Auto-taxonomy says wrong_fix, but the patch is actually correct — the test fixture is stale. Excluding this instance from the headline number until the fixture is refreshed.',
  },
  {
    label: 'infra',
    body: 'Container died during the verify phase. Re-ran manually and it resolved; not an agent failure.',
  },
  {
    label: 'needs-followup',
    body: 'Worth a scaffold change: the agent had the answer at step 9 and then spent 20 steps second-guessing it. A "commit to a hypothesis" nudge would likely fix this class.',
  },
  {
    label: 'confirmed',
    body: 'Textbook localization miss. BM25 retrieval surfaces this file at rank 1, which is why the retrieval variant gets it.',
  },
]

function main() {
  const db = resetDb()
  const rng = makeRng(SEED)

  const insRun = db.prepare(`
    INSERT INTO runs (id,name,suite,model,scaffold,scaffold_ver,temperature,max_steps,budget_usd,git_sha,started_at,finished_at,status,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insTask = db.prepare(`
    INSERT INTO tasks (id,repo,language,issue_title,issue_body,base_commit,difficulty,gold_files,gold_patch,fail_to_pass,pass_to_pass,tags)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insTrial = db.prepare(`
    INSERT INTO trials (id,run_id,task_id,status,started_at,duration_ms,steps,tokens_in,tokens_out,tokens_cached,cost_usd,
      context_peak_pct,context_limit,tool_calls,tool_errors,files_touched,patch,patch_added,patch_removed,
      f2p_passed,f2p_total,p2p_passed,p2p_total,failure_category,failure_summary,failure_span_id,localized,first_edit_ms)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insSpan = db.prepare(`
    INSERT INTO spans (id,trial_id,parent_id,seq,step,depth,type,name,status,start_ms,end_ms,duration_ms,model,
      tokens_in,tokens_out,tokens_cached,cost_usd,ctx_used,input,output,error,target,attrs)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insEvent = db.prepare(`
    INSERT INTO events (trial_id,span_id,t_ms,level,kind,message,data) VALUES (?,?,?,?,?,?,?)`)
  const insFts = db.prepare(`
    INSERT INTO spans_fts (span_id,trial_id,name,target,input,output,error) VALUES (?,?,?,?,?,?,?)`)
  const insAnn = db.prepare(`
    INSERT INTO annotations (target_type,target_id,author,label,body,created_at) VALUES (?,?,?,?,?,?)`)

  for (const t of TASKS) {
    insTask.run(
      t.id,
      t.repo,
      t.language,
      t.issue_title,
      t.issue_body,
      t.base_commit,
      t.difficulty,
      JSON.stringify(t.gold_files),
      t.hint ?? null,
      JSON.stringify(t.fail_to_pass),
      JSON.stringify(t.pass_to_pass),
      JSON.stringify(t.tags ?? []),
    )
  }

  const now = Date.now()
  let totals = { trials: 0, spans: 0, events: 0 }
  const failingTrials = []

  RUN_CONFIGS.forEach((run, ri) => {
    // Runs are staggered backwards in time, newest first.
    const runStart = now - (ri + 1) * 26 * 3600 * 1000 - rng.int(0, 5) * 3600 * 1000
    let cursor = runStart
    const trialRows = []

    // The run row must exist before its trials — trials.run_id is a foreign key.
    insRun.run(
      run.id, run.name, 'swe-bench-verified', run.model, run.scaffold, run.scaffold_ver,
      run.temperature, run.max_steps, run.budget_usd,
      'a3f91cd' + ri, runStart, null, 'running', run.notes,
    )

    for (const task of TASKS) {
      const { trial, spans, events } = generateTrial(run, task, rng, cursor)
      cursor += Math.round(trial.duration_ms * 0.22) + rng.int(4000, 20000) // some parallelism
      trialRows.push(trial)

      insTrial.run(
        trial.id, trial.run_id, trial.task_id, trial.status, trial.started_at, trial.duration_ms,
        trial.steps, trial.tokens_in, trial.tokens_out, trial.tokens_cached, trial.cost_usd,
        trial.context_peak_pct, trial.context_limit, trial.tool_calls, trial.tool_errors,
        trial.files_touched, trial.patch, trial.patch_added, trial.patch_removed,
        trial.f2p_passed, trial.f2p_total, trial.p2p_passed, trial.p2p_total,
        trial.failure_category, trial.failure_summary, trial.failure_span_id,
        trial.localized, trial.first_edit_ms,
      )
      for (const s of spans) {
        insSpan.run(
          s.id, s.trial_id, s.parent_id, s.seq, s.step, s.depth, s.type, s.name, s.status,
          s.start_ms, s.end_ms, s.duration_ms, s.model, s.tokens_in, s.tokens_out, s.tokens_cached,
          s.cost_usd, s.ctx_used, s.input, s.output, s.error, s.target, s.attrs,
        )
        insFts.run(s.id, s.trial_id, s.name, s.target ?? '', s.input ?? '', s.output ?? '', s.error ?? '')
      }
      for (const e of events) {
        insEvent.run(e.trial_id, e.span_id, e.t_ms, e.level, e.kind, e.message, e.data)
      }
      totals.trials++
      totals.spans += spans.length
      totals.events += events.length
      if (trial.failure_category) failingTrials.push(trial.id)
    }

    const last = trialRows[trialRows.length - 1]
    db.prepare(`UPDATE runs SET finished_at = ?, status = 'complete' WHERE id = ?`).run(
      last.started_at + last.duration_ms,
      run.id,
    )
  })

  // A handful of human review notes, so the annotation surface is not empty.
  const picks = new Set()
  while (picks.size < Math.min(REVIEWS.length, failingTrials.length)) {
    picks.add(failingTrials[rng.int(0, failingTrials.length - 1)])
  }
  ;[...picks].forEach((trialId, i) => {
    const r = REVIEWS[i % REVIEWS.length]
    insAnn.run('trial', trialId, 'kate@evals', r.label, r.body, now - rng.int(1, 40) * 3600 * 1000)
  })

  const n = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c
  console.log('AgentLens seeded')
  console.log(`  runs        ${n('runs')}`)
  console.log(`  tasks       ${n('tasks')}`)
  console.log(`  trials      ${n('trials')}`)
  console.log(`  spans       ${n('spans')}`)
  console.log(`  events      ${n('events')}`)
  console.log(`  annotations ${n('annotations')}`)
  const rate = db
    .prepare(
      `SELECT r.name, ROUND(100.0*SUM(t.status='resolved')/COUNT(*),1) AS pct, ROUND(SUM(t.cost_usd),2) AS cost
       FROM trials t JOIN runs r ON r.id=t.run_id GROUP BY r.id ORDER BY pct DESC`,
    )
    .all()
  console.log('\n  resolve rate')
  for (const row of rate) console.log(`    ${String(row.pct).padStart(5)}%  $${String(row.cost).padStart(6)}  ${row.name}`)
}

main()
