/**
 * Trajectory generator.
 *
 * The important property here: the failure category is not a label bolted onto a
 * random trace — it determines the SHAPE of the trace. A localization miss really
 * does contain greps that return nothing and reads of the wrong files; a stall
 * really does contain the same command four times. That is what makes the trace
 * viewer diagnostic instead of decorative.
 */

import {
  TASKS,
  RUN_CONFIGS,
  RECON_COMMANDS,
  TOOL_ERRORS,
  HALLUCINATED_APIS,
  THOUGHTS,
  PLANS,
} from './corpus.js'

// ---------------------------------------------------------------- randomness

/** mulberry32 — small, fast, seedable. Keeps the demo dataset reproducible. */
export function makeRng(seed) {
  let a = seed >>> 0
  const r = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1))
  r.pick = (arr) => arr[Math.floor(r() * arr.length)]
  r.chance = (p) => r() < p
  r.gauss = (mean, sd) => {
    const u = Math.max(1e-9, r())
    const v = r()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  r.weighted = (entries) => {
    const total = entries.reduce((s, e) => s + e[1], 0)
    let x = r() * total
    for (const [k, w] of entries) {
      x -= w
      if (x <= 0) return k
    }
    return entries[entries.length - 1][0]
  }
  return r
}

/** FNV-1a — gives each trial an outcome seed that does not depend on iteration order. */
function hashSeed(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

const uid = (() => {
  let n = 0
  return (prefix) => `${prefix}_${(++n).toString(36).padStart(6, '0')}`
})()

// ------------------------------------------------------------- content bits

const moduleOf = (repo) => repo.split('/')[1].replace(/-/g, '_')

function fill(tpl, task) {
  return tpl
    .replaceAll('%REPO%', task.repo)
    .replaceAll('%MODULE%', moduleOf(task.repo))
    .replaceAll('%GOLD%', task.gold_files[0])
    .replaceAll('%FILE%', task.gold_files[0])
    .replaceAll('%DIR%', task.gold_files[0].split('/').slice(0, -1).join('/'))
    .replaceAll('%SYMBOL%', task.symbols[0])
    .replaceAll('%BEHAVIOUR%', task.hint || 'the documented behaviour')
}

/** A plausible slice of Python source, shaped by the task's real symbols. */
function sourceSnippet(task, path, rng) {
  const sym = rng.pick(task.symbols).replace(/[^A-Za-z_]/g, '') || 'handler'
  const cls = path.split('/').pop().replace('.py', '')
  const start = rng.int(40, 320)
  const lines = [
    `${start}\t    def ${sym}(self, *args, **kwargs):`,
    `${start + 1}\t        """${task.issue_title.slice(0, 58)}."""`,
    `${start + 2}\t        opts = self._meta if hasattr(self, "_meta") else None`,
    `${start + 3}\t        if opts is None:`,
    `${start + 4}\t            return None`,
    `${start + 5}\t        try:`,
    `${start + 6}\t            value = self._resolve(${sym}, *args)`,
    `${start + 7}\t        except (KeyError, AttributeError):`,
    `${start + 8}\t            return None`,
    `${start + 9}\t        return value`,
    `${start + 10}\t`,
    `${start + 11}\tclass ${cls[0].toUpperCase()}${cls.slice(1)}Mixin:`,
    `${start + 12}\t    def _resolve(self, fn, *args):`,
    `${start + 13}\t        return fn(*args)`,
  ]
  return lines.join('\n')
}

function grepOutput(task, pattern, hits, rng) {
  if (hits.length === 0) return ''
  return hits
    .map((f) => `${f}:${rng.int(28, 410)}:    ${pattern.length > 30 ? pattern.slice(0, 30) : pattern}`)
    .join('\n')
}

function pytestReport(passing, failing, errorText) {
  const total = passing.length + failing.length
  const head = [
    '============================= test session starts ==============================',
    'platform linux -- Python 3.11.4, pytest-7.4.0, pluggy-1.2.0',
    'rootdir: /testbed',
    `collected ${total} item${total === 1 ? '' : 's'}`,
    '',
  ]
  const body = []
  let i = 0
  for (const t of passing) {
    i++
    body.push(`${t} PASSED`.padEnd(72) + `[${String(Math.round((i / total) * 100)).padStart(3)}%]`)
  }
  for (const t of failing) {
    i++
    body.push(`${t} FAILED`.padEnd(72) + `[${String(Math.round((i / total) * 100)).padStart(3)}%]`)
  }
  const tail = []
  if (failing.length) {
    tail.push('', '=================================== FAILURES ===================================')
    tail.push(`___________________________ ${failing[0].split('::').pop()} ___________________________`)
    tail.push('')
    tail.push(errorText || 'E       AssertionError: assert None == \'/custom-admin/auth/user/1/change/\'')
    tail.push('')
    tail.push(
      `========================= ${failing.length} failed, ${passing.length} passed in ${(total * 0.4 + 1.2).toFixed(2)}s =========================`,
    )
  } else {
    tail.push('', `============================== ${passing.length} passed in ${(total * 0.4 + 1.2).toFixed(2)}s ===============================`)
  }
  return [...head, ...body, ...tail].join('\n')
}

function unifiedDiff(task, file, rng, broken = false) {
  const sym = task.symbols[0].replace(/[^A-Za-z_]/g, '') || 'handler'
  const ln = rng.int(60, 280)
  const removed = `        return reverse(url_name, args=[quote(remote_obj.pk)])`
  const added = broken
    ? `        return reverse(url_name, args=[quote(remote_obj.pk)]`
    : `        return reverse(\n            url_name, args=[quote(remote_obj.pk)], current_app=self.model_admin.admin_site.name\n        )`
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -${ln},7 +${ln},9 @@ def ${sym}(self, remote_field, remote_obj):`,
    `         url_name = "admin:%s_%s_change" % (`,
    `             remote_field.model._meta.app_label,`,
    `             remote_field.model._meta.model_name,`,
    `         )`,
    `-${removed}`,
    ...added.split('\n').map((l) => `+${l}`),
    `     except NoReverseMatch:`,
    `         return str(remote_obj)`,
  ].join('\n')
}

// ---------------------------------------------------------------- outcome

const DIFFICULTY_P = { easy: 0.93, medium: 0.63, hard: 0.33 }

function decideOutcome(run, task, rng) {
  let p = run.skill * DIFFICULTY_P[task.difficulty]
  if (run.localization_boost) p += run.localization_boost * (task.decoys.length > 3 ? 1 : 0.4)
  if (run.stepPenalty && (task.difficulty === 'hard' || task.gold_files.length > 1)) p *= run.stepPenalty
  p = Math.max(0.03, Math.min(0.97, p))
  if (rng.chance(p)) return null // resolved

  const w = []
  const hard = task.difficulty === 'hard'
  const retrieval = run.localization_boost ? 0.15 : 1
  w.push(['localization', (hard ? 30 : 16) * retrieval * (run.skill < 0.5 ? 1.8 : 1)])
  w.push(['wrong_fix', 22 + (hard ? 8 : 0)])
  w.push(['regression', task.pass_to_pass.length > 2 ? 11 : 6])
  // Long-horizon runs really do fill their window; weight it so the mode is
  // present in the dataset rather than a rounding error.
  w.push(['context_overflow', hard ? 17 : 7])
  w.push(['loop_stall', run.skill < 0.6 ? 14 : 6])
  w.push(['tool_error_cascade', run.scaffold === 'minimal-react' ? 16 : 5])
  w.push(['premature_stop', run.scaffold === 'minimal-react' ? 13 : 5])
  w.push(['budget_exhausted', run.max_steps < 60 ? 14 : 5])
  w.push(['syntax_error', run.scaffold === 'minimal-react' ? 9 : 3])
  w.push(['hallucinated_api', run.skill < 0.6 ? 8 : 3])
  w.push(['harness_error', 4])
  return rng.weighted(w)
}

const FAILURE_SUMMARY = {
  localization: (t) =>
    `Never opened ${t.gold_files[0]}. Exploration stayed in ${t.decoys[0].split('/').slice(0, 2).join('/')}/ and the edit landed on an unrelated module.`,
  wrong_fix: (t) =>
    `Edited ${t.gold_files[0]} but the change did not satisfy ${t.fail_to_pass[0].split('::').pop()} — the guard was added one frame too late in the call chain.`,
  regression: (t) =>
    `Target test passes, but ${t.pass_to_pass[0].split('::').pop()} broke. The fix widened behaviour instead of narrowing it.`,
  context_overflow: () =>
    'Context window filled with unfiltered file reads; the final model call was rejected before a patch was produced.',
  loop_stall: () =>
    'Repeated the same search four times with identical arguments, gaining no new information, until the step cap intervened.',
  tool_error_cascade: (t) =>
    `Six consecutive str_replace failures on ${t.gold_files[0]} — the agent kept resubmitting whitespace that did not match the file.`,
  premature_stop: (t) =>
    `Submitted a patch without ever running ${t.fail_to_pass[0].split('::').pop()}. No verification step in the trajectory.`,
  budget_exhausted: (r) => `Hit the ${r.max_steps}-step cap while still exploring; no candidate patch was submitted.`,
  syntax_error: (t) => `The produced diff does not parse — unbalanced parenthesis introduced into ${t.gold_files[0]}.`,
  hallucinated_api: () => 'Called a function that does not exist in this version of the codebase and never recovered.',
  harness_error: () => 'Evaluation container exited mid-run (OOM killed during the test phase). Result is not attributable to the agent.',
}

// ------------------------------------------------------------ span builder

class Trace {
  constructor(trialId, run, rng) {
    this.trialId = trialId
    this.run = run
    this.rng = rng
    this.spans = []
    this.events = []
    this.t = 0
    this.seq = 0
    this.step = 0
    this.ctx = rng.int(7200, 9400) // system prompt + tool schemas + task statement
    this.pendingObs = 0 // tokens the next model call must read back
    this.toolCalls = 0
    this.toolErrors = 0
    this.cost = 0
    this.tokensIn = 0
    this.tokensOut = 0
    this.tokensCached = 0
    this.filesTouched = new Set()
    this.filesRead = new Set()
    this.firstEditMs = null
    this.rootId = null
  }

  push(sp) {
    const id = uid('sp')
    const span = {
      id,
      trial_id: this.trialId,
      parent_id: sp.parent_id ?? this.rootId,
      seq: this.seq++,
      step: this.step,
      depth: sp.depth ?? (sp.parent_id === null ? 0 : sp.parent_id === this.rootId || !sp.parent_id ? 1 : 2),
      type: sp.type,
      name: sp.name,
      status: sp.status || 'ok',
      start_ms: sp.start_ms ?? this.t,
      end_ms: (sp.start_ms ?? this.t) + (sp.duration_ms || 0),
      duration_ms: sp.duration_ms || 0,
      model: sp.model ?? null,
      tokens_in: sp.tokens_in || 0,
      tokens_out: sp.tokens_out || 0,
      tokens_cached: sp.tokens_cached || 0,
      cost_usd: sp.cost_usd || 0,
      ctx_used: this.ctx,
      input: sp.input ?? null,
      output: sp.output ?? null,
      error: sp.error ?? null,
      target: sp.target ?? null,
      attrs: sp.attrs ? JSON.stringify(sp.attrs) : null,
    }
    this.spans.push(span)
    this.t = Math.max(this.t, span.end_ms)
    return span
  }

  event(kind, level, message, spanId, data) {
    this.events.push({
      trial_id: this.trialId,
      span_id: spanId ?? null,
      t_ms: this.t,
      level,
      kind,
      message,
      data: data ? JSON.stringify(data) : null,
    })
  }

  /**
   * One model turn. Returns the llm span, which parents that turn's tool calls.
   * The previous turn's observation is folded into the context first — that is
   * what makes the context curve climb the way a real transcript does.
   */
  llm(task, text) {
    this.step++
    const r = this.rng
    this.ctx += this.pendingObs
    this.pendingObs = 0
    const tin = this.ctx
    const tout = Math.max(90, Math.round(r.gauss(360, 170)))
    const cached = this.step <= 1 ? 0 : Math.round(tin * (0.86 + r() * 0.1))
    const dur = Math.round(Math.max(600, r.gauss(3400 / (this.run.speed || 1), 1400)) + tout * 4)
    const cost =
      (tin - cached) * this.run.price_in + cached * this.run.price_in * 0.1 + tout * this.run.price_out
    this.tokensIn += tin
    this.tokensOut += tout
    this.tokensCached += cached
    this.cost += cost
    this.ctx += tout
    return this.push({
      type: 'llm',
      name: `step ${this.step}`,
      parent_id: this.rootId,
      depth: 1,
      duration_ms: dur,
      model: this.run.model,
      tokens_in: tin,
      tokens_out: tout,
      tokens_cached: cached,
      cost_usd: cost,
      input: `[${this.step === 1 ? 'system + task' : 'conversation'} · ${tin.toLocaleString()} tok · ${cached ? `${Math.round((cached / tin) * 100)}% cached` : 'cold'}]\n\n${
        this.step === 1 ? fill(r.pick(PLANS), task) : fill(r.pick(THOUGHTS), task)
      }`,
      output: text,
      attrs: {
        context_pct: +((this.ctx / this.run.context_limit) * 100).toFixed(1),
        stop_reason: 'tool_use',
      },
    })
  }

  tool(parent, name, opts) {
    this.toolCalls++
    if (opts.status === 'error') this.toolErrors++
    // Observation size is stated explicitly rather than derived from the stored
    // text: a 3,000-line file read costs the context window far more than the
    // excerpt we keep on disk for display.
    this.pendingObs = opts.obs ?? OBS.small(this.rng)
    const dur = opts.duration_ms ?? Math.round(Math.max(40, this.rng.gauss(700, 500)))
    return this.push({
      type: opts.type || 'tool',
      name,
      parent_id: parent.id,
      depth: 2,
      status: opts.status || 'ok',
      duration_ms: dur,
      input: opts.input,
      output: opts.output,
      error: opts.error,
      target: opts.target,
      attrs: opts.attrs,
    })
  }
}

/**
 * Token cost of each observation type, in the ranges real SWE-agent transcripts
 * show. Reading source files dominates; this is why context pressure is a
 * localization problem before it is a budget problem.
 */
const OBS = {
  small: (r) => r.int(120, 520), // a short bash result
  grep: (r) => r.int(240, 1400),
  read: (r) => r.int(2600, 7200), // a focused view_range on a real module
  bigRead: (r) => r.int(15000, 27000), // an unbounded read of a whole file
  test: (r) => r.int(900, 3200),
  edit: (r) => r.int(150, 420),
}

// ------------------------------------------------------------- trajectory

export function generateTrial(run, task, rng, startedAt) {
  const trialId = `${run.id}__${task.id}`
  const tr = new Trace(trialId, run, rng)
  // Outcome is drawn from a seed tied to this run/task pair, so tuning how a
  // trajectory is rendered can never silently reshuffle the leaderboard.
  const outcomeRng = makeRng(hashSeed(trialId))
  outcomeRng() // discard the first draw; adjacent seeds correlate on it
  const failure = decideOutcome(run, task, outcomeRng)
  const resolved = failure === null
  const goldFile = task.gold_files[0]
  const mod = moduleOf(task.repo)

  // Root span — the whole session.
  const root = tr.push({
    type: 'system',
    name: 'agent.session',
    parent_id: null,
    depth: 0,
    duration_ms: 0,
    target: task.id,
    input: `repo=${task.repo}@${task.base_commit.slice(0, 10)}\nscaffold=${run.scaffold}@${run.scaffold_ver}\nmodel=${run.model}\nmax_steps=${run.max_steps}`,
    output: null,
    attrs: { suite: 'swe-bench-verified', container: `sweb.eval.${mod}` },
  })
  tr.rootId = root.id

  // ---- environment bootstrap
  {
    const boot = tr.push({
      type: 'system',
      name: 'env.setup',
      parent_id: root.id,
      depth: 1,
      duration_ms: rng.int(4200, 12000),
      target: task.base_commit,
      input: `docker run --rm sweb.eval.x86_64.${mod}:latest`,
      output: `Cloned ${task.repo} at ${task.base_commit.slice(0, 10)}\nInstalled 41 packages in 6.2s\nconda env "testbed" ready`,
    })
    tr.event('test_run', 'info', 'Environment ready', boot.id)
  }

  // Retrieval scaffolds get a free localization hint up front.
  let retrievalHit = false
  if (run.scaffold === 'swe-agent-retrieval') {
    retrievalHit = rng.chance(0.78)
    const files = retrievalHit
      ? [goldFile, ...task.decoys.slice(0, 3)]
      : task.decoys.slice(0, 4)
    tr.push({
      type: 'tool',
      name: 'bm25_retrieve',
      parent_id: root.id,
      depth: 1,
      duration_ms: rng.int(900, 2400),
      target: task.issue_title.slice(0, 48),
      input: `query="${task.issue_title}"\ntop_k=4`,
      output: files.map((f, i) => `${(i + 1).toString()}. ${f}  (score ${(9.4 - i * 1.7).toFixed(2)})`).join('\n'),
      attrs: { hit: retrievalHit },
    })
  }

  // Does this trajectory ever open the file that actually matters?
  //
  // Localization is necessary but not sufficient: a resolved trial must have
  // opened the right file, while a failed one may or may not have. Keeping the
  // two independent is what makes "localized but still unresolved" a readable
  // signal — that gap is the difference between a search problem and a
  // reasoning problem, and it is the whole point of the retrieval ablation.
  const localizeP = run.localization_boost ? 0.94 : 0.5 + run.skill * 0.38
  const willLocalize =
    failure === null
      ? true
      : failure === 'localization'
        ? false
        : failure === 'budget_exhausted'
          ? outcomeRng.chance(localizeP * 0.5)
          : outcomeRng.chance(localizeP)

  // ---- recon
  const reconSteps = rng.int(1, run.scaffold === 'minimal-react' ? 3 : 2)
  for (let i = 0; i < reconSteps; i++) {
    const cmd = rng.pick(RECON_COMMANDS)
    const out = fill(cmd.out, task)
    const l = tr.llm(task, `I'll get oriented in the repository first.\n\n<tool_use name="bash">${fill(cmd.cmd, task)}</tool_use>`)
    tr.tool(l, 'bash', {
      input: fill(cmd.cmd, task),
      output: out,
      target: fill(cmd.cmd, task).split(' ')[0],
      duration_ms: rng.int(120, 900),
      obs: OBS.small(rng),
    })
  }

  // ---- localization: greps
  const grepRounds = failure === 'localization' ? rng.int(3, 5) : rng.int(1, 3)
  for (let i = 0; i < grepRounds; i++) {
    const pattern = rng.pick(task.symbols)
    const hits = willLocalize && i >= grepRounds - 1
      ? [goldFile, ...task.decoys.slice(0, rng.int(0, 2))]
      : rng.chance(0.4)
        ? []
        : task.decoys.slice(0, rng.int(1, 3))
    const out = hits.length ? grepOutput(task, pattern, hits, rng) : ''
    const l = tr.llm(
      task,
      `Searching for \`${pattern}\` to find where this is implemented.\n\n<tool_use name="search_repo">${pattern}</tool_use>`,
    )
    const sp = tr.tool(l, 'search_repo', {
      input: `rg -n --type py ${JSON.stringify(pattern)} .`,
      output: out || 'No matches found.',
      status: hits.length ? 'ok' : 'warn',
      target: pattern,
      duration_ms: rng.int(200, 1400),
      obs: hits.length ? OBS.grep(rng) : OBS.small(rng),
      attrs: { matches: hits.length },
    })
    if (!hits.length) tr.event('stall', 'warn', `Search for "${pattern}" returned no matches`, sp.id)
  }

  // ---- reading candidate files
  const toRead = willLocalize
    ? [...task.decoys.slice(0, rng.int(0, 2)), goldFile]
    : task.decoys.slice(0, rng.int(2, Math.min(4, task.decoys.length)))
  const bigReads = failure === 'context_overflow'
  for (const f of toRead) {
    const body = sourceSnippet(task, f, rng)
    const lines = bigReads ? rng.int(1800, 4200) : rng.int(40, 180)
    const l = tr.llm(task, `Reading \`${f}\`.\n\n<tool_use name="read_file">${f}</tool_use>`)
    tr.filesRead.add(f)
    tr.tool(l, 'read_file', {
      input: `path=${f}${bigReads ? '' : `\nview_range=[${rng.int(30, 90)}, ${rng.int(140, 260)}]`}`,
      output: bigReads ? `${body}\n\n… ${lines} lines total, returned in full …` : body,
      target: f,
      duration_ms: rng.int(60, 320),
      obs: bigReads ? OBS.bigRead(rng) : OBS.read(rng),
      attrs: { lines },
    })
    if (bigReads) tr.event('context_pressure', 'warn', `Read ${f} in full (${lines} lines)`, null)
  }

  // ---- failure-specific middles --------------------------------------------

  let failureSpanId = null

  if (failure === 'loop_stall') {
    const pattern = rng.pick(task.symbols)
    for (let i = 0; i < 5; i++) {
      const l = tr.llm(
        task,
        `Let me search for \`${pattern}\` to narrow this down.\n\n<tool_use name="search_repo">${pattern}</tool_use>`,
      )
      const sp = tr.tool(l, 'search_repo', {
        input: `rg -n --type py ${JSON.stringify(pattern)} .`,
        output: 'No matches found.',
        status: 'warn',
        target: pattern,
        duration_ms: rng.int(180, 500),
        obs: OBS.small(rng),
        attrs: { matches: 0, repeat_of: i > 0 ? i : undefined },
      })
      if (i === 2) {
        failureSpanId = sp.id
        tr.event('stall', 'error', `Identical search repeated ${i + 1}× with no new information`, sp.id, {
          pattern,
        })
      }
    }
  }

  if (failure === 'tool_error_cascade') {
    const tmpl = TOOL_ERRORS.find((e) => e.name === 'str_replace')
    for (let i = 0; i < 6; i++) {
      const l = tr.llm(task, `Applying the edit to \`${goldFile}\`.\n\n<tool_use name="str_replace">…</tool_use>`)
      const err = fill(tmpl.msg, task)
      const sp = tr.tool(l, 'str_replace', {
        input: `path=${goldFile}\nold_str="    return reverse(url_name, args=[quote(remote_obj.pk)])"\nnew_str="    return reverse(url_name, args=[quote(remote_obj.pk)], current_app=site.name)"`,
        error: err,
        status: 'error',
        target: goldFile,
        duration_ms: rng.int(80, 260),
        obs: OBS.small(rng),
        attrs: { attempt: i + 1 },
      })
      if (i === 0) {
        failureSpanId = sp.id
        tr.event('retry', 'error', 'str_replace failed — whitespace mismatch', sp.id)
      }
      if (i === 5) tr.event('retry', 'error', '6 consecutive edit failures; no recovery strategy', sp.id)
    }
  }

  if (failure === 'hallucinated_api') {
    const l = tr.llm(task, `I'll use the helper that normalises this.\n\n<tool_use name="python">…</tool_use>`)
    const err = rng.pick(HALLUCINATED_APIS)
    const sp = tr.tool(l, 'python', {
      input: `python -c "from ${mod}.utils import normalize_signature; print(normalize_signature)"`,
      error: `Traceback (most recent call last):\n  File "<string>", line 1, in <module>\n${err}`,
      status: 'error',
      target: `${mod}.utils`,
      duration_ms: rng.int(300, 900),
      obs: OBS.small(rng),
    })
    failureSpanId = sp.id
    tr.event('retry', 'error', 'Referenced an API that does not exist in this revision', sp.id)
  }

  if (failure === 'context_overflow') {
    // Keep reading whole files until the window is genuinely full, so the
    // context curve shows the pressure building rather than teleporting.
    const pool = [...task.decoys, ...task.gold_files]
    let i = 0
    let warned = false
    while (tr.ctx + OBS.bigRead(rng) < run.context_limit && tr.step < run.max_steps - 1) {
      const f = pool[i++ % pool.length]
      const lines = rng.int(2200, 5400)
      const l = tr.llm(task, `Reading \`${f}\` for context.\n\n<tool_use name="read_file">${f}</tool_use>`)
      tr.filesRead.add(f)
      tr.tool(l, 'read_file', {
        input: `path=${f}`,
        output: `${sourceSnippet(task, f, rng)}\n\n… ${lines} lines total, returned in full …`,
        target: f,
        duration_ms: rng.int(80, 400),
        obs: OBS.bigRead(rng),
        attrs: { lines },
      })
      const pct = (tr.ctx / run.context_limit) * 100
      if (pct > 70 && !warned) {
        warned = true
        tr.event('context_pressure', 'warn', `Context at ${pct.toFixed(0)}% — no compaction strategy in play`, null)
      }
    }
    // The next turn's observation is what tips it over the limit. Clamp upward:
    // the loop exits on a sampled read size, so a smaller final draw could
    // otherwise leave the context under the limit it is meant to have exceeded.
    tr.ctx = Math.max(tr.ctx + OBS.bigRead(rng), Math.round(run.context_limit * 1.01))
    tr.step++
    const sp = tr.push({
      type: 'llm',
      name: `step ${tr.step}`,
      parent_id: root.id,
      depth: 1,
      status: 'error',
      duration_ms: rng.int(400, 1200),
      model: run.model,
      tokens_in: tr.ctx,
      input: `[conversation · ${tr.ctx.toLocaleString()} tok]`,
      error: `invalid_request_error: prompt is too long: ${tr.ctx.toLocaleString()} tokens > ${run.context_limit.toLocaleString()} maximum`,
      attrs: { context_pct: +((tr.ctx / run.context_limit) * 100).toFixed(1), stop_reason: 'error' },
    })
    failureSpanId = sp.id
    tr.event('context_pressure', 'error', 'Context window exceeded — run terminated', sp.id)
  }

  // ---- reproduce
  const doesReproduce = failure !== 'premature_stop' && failure !== 'context_overflow' && rng.chance(0.85)
  if (doesReproduce) {
    const out = pytestReport([], [task.fail_to_pass[0]], `E       AssertionError: ${task.hint ? 'expected ' + task.hint.slice(0, 46) : 'assertion failed'}`)
    const l = tr.llm(task, `Reproducing the failure before changing anything.\n\n<tool_use name="bash">pytest ${task.fail_to_pass[0]} -x</tool_use>`)
    tr.tool(l, 'bash', {
      type: 'test',
      input: `python -m pytest ${task.fail_to_pass[0]} -x --no-header`,
      output: out,
      status: 'warn',
      target: task.fail_to_pass[0],
      duration_ms: rng.int(9000, 38000),
      obs: OBS.test(rng),
      attrs: { phase: 'reproduce', passed: 0, failed: 1 },
    })
    tr.event('test_run', 'info', 'Reproduced the reported failure', null)
  }

  // ---- edit
  const editTarget = willLocalize ? goldFile : task.decoys[0]
  const broken = failure === 'syntax_error'
  let patch = null
  if (failure !== 'context_overflow' && failure !== 'budget_exhausted') {
    const diff = unifiedDiff(task, editTarget, rng, broken)
    patch = diff
    const l = tr.llm(
      task,
      `${fill(rng.pick(THOUGHTS), task)}\n\nApplying the fix to \`${editTarget}\`.\n\n<tool_use name="str_replace">…</tool_use>`,
    )
    const sp = tr.tool(l, 'str_replace', {
      input: `path=${editTarget}\nold_str=…\nnew_str=…`,
      output: `Edited ${editTarget}\n\n${diff}`,
      target: editTarget,
      duration_ms: rng.int(90, 400),
      obs: OBS.edit(rng),
      attrs: { added: broken ? 1 : 3, removed: 1, diff: true },
    })
    tr.filesTouched.add(editTarget)
    if (tr.firstEditMs === null) tr.firstEditMs = sp.start_ms
    tr.event('edit', 'info', `Edited ${editTarget}`, sp.id)
    if (failure === 'wrong_fix' || failure === 'regression' || failure === 'syntax_error' || failure === 'localization') {
      failureSpanId = failureSpanId || sp.id
    }
  }

  // ---- verify
  const f2p = task.fail_to_pass
  const p2p = task.pass_to_pass
  let f2pPassed = 0
  let p2pPassed = p2p.length
  const runsTests = failure !== 'premature_stop' && failure !== 'context_overflow' && failure !== 'budget_exhausted'

  if (runsTests) {
    if (resolved) f2pPassed = f2p.length
    else if (failure === 'regression') {
      f2pPassed = f2p.length
      p2pPassed = p2p.length - rng.int(1, Math.max(1, p2p.length - 1))
    } else f2pPassed = 0

    const failingF2p = f2p.slice(f2pPassed)
    const failingP2p = p2p.slice(p2pPassed)
    let errText = null
    if (broken) errText = `E   File "/testbed/${editTarget}", line ${rng.int(60, 280)}\nE     )\nE     ^\nE SyntaxError: unmatched \')\''`
    else if (failure === 'regression') errText = `E       AssertionError: expected 2 queries, got 4\nE       (previously-passing behaviour changed)`
    else if (failure === 'wrong_fix') errText = `E       AssertionError: assert '/admin/auth/user/1/change/' == '/custom-admin/auth/user/1/change/'`

    const out = pytestReport(
      [...f2p.slice(0, f2pPassed), ...p2p.slice(0, p2pPassed)],
      [...failingF2p, ...failingP2p],
      errText,
    )
    const l = tr.llm(task, `Running the target test plus the regression set.\n\n<tool_use name="bash">pytest …</tool_use>`)
    const sp = tr.tool(l, 'bash', {
      type: 'test',
      input: `python -m pytest ${[...f2p, ...p2p].slice(0, 4).join(' ')} --no-header`,
      output: out,
      status: failingF2p.length + failingP2p.length ? 'error' : 'ok',
      target: f2p[0],
      duration_ms: rng.int(14000, 62000),
      obs: OBS.test(rng),
      attrs: {
        phase: 'verify',
        passed: f2pPassed + p2pPassed,
        failed: failingF2p.length + failingP2p.length,
        f2p: `${f2pPassed}/${f2p.length}`,
        p2p: `${p2pPassed}/${p2p.length}`,
      },
    })
    tr.event(
      'test_run',
      failingF2p.length + failingP2p.length ? 'error' : 'info',
      failingF2p.length + failingP2p.length
        ? `${failingF2p.length + failingP2p.length} test(s) still failing`
        : 'All gating tests pass',
      sp.id,
    )
    if (failure === 'syntax_error' || failure === 'hallucinated_api') failureSpanId = failureSpanId || sp.id

    // One or two repair attempts on a wrong fix, so the trace shows the struggle.
    if (failure === 'wrong_fix') {
      for (let i = 0; i < rng.int(1, 2); i++) {
        const l2 = tr.llm(task, `That did not move the assertion. Trying a different insertion point.\n\n<tool_use name="str_replace">…</tool_use>`)
        tr.tool(l2, 'str_replace', {
          input: `path=${editTarget}\nold_str=…\nnew_str=…`,
          output: `Edited ${editTarget}`,
          target: editTarget,
          duration_ms: rng.int(90, 300),
          obs: OBS.edit(rng),
        })
        const out2 = pytestReport([], f2p, `E       AssertionError: assert '/admin/…' == '/custom-admin/…'`)
        const l3 = tr.llm(task, `Re-running.\n\n<tool_use name="bash">pytest -x</tool_use>`)
        tr.tool(l3, 'bash', {
          type: 'test',
          input: `python -m pytest ${f2p[0]} -x --no-header`,
          output: out2,
          status: 'error',
          target: f2p[0],
          duration_ms: rng.int(11000, 30000),
          obs: OBS.test(rng),
          attrs: { phase: 'verify', passed: 0, failed: f2p.length },
        })
      }
    }
  }

  if (failure === 'premature_stop') {
    f2pPassed = 0
    const l = tr.llm(task, `The change matches the described behaviour. Submitting.\n\n<tool_use name="submit"/>`)
    const sp = tr.tool(l, 'submit', {
      input: 'submit()',
      output: 'Patch recorded (no verification run).',
      status: 'warn',
      target: editTarget,
      duration_ms: rng.int(40, 120),
      obs: OBS.small(rng),
      attrs: { tests_run: 0 },
    })
    failureSpanId = sp.id
    tr.event('test_run', 'error', 'Submitted with zero test executions', sp.id)
  }

  if (failure === 'budget_exhausted') {
    while (tr.step < run.max_steps) {
      const pattern = rng.pick([...task.symbols, ...task.decoys])
      const l = tr.llm(task, `Still narrowing down. Checking \`${pattern}\`.\n\n<tool_use name="search_repo">${pattern}</tool_use>`)
      const out = rng.chance(0.5) ? grepOutput(task, pattern, task.decoys.slice(0, 2), rng) : 'No matches found.'
      tr.tool(l, 'search_repo', {
        input: `rg -n ${JSON.stringify(pattern)} .`,
        output: out,
        status: out === 'No matches found.' ? 'warn' : 'ok',
        target: pattern,
        duration_ms: rng.int(150, 700),
        obs: OBS.grep(rng),
      })
    }
    const last = tr.spans[tr.spans.length - 1]
    failureSpanId = last.id
    tr.event('budget', 'error', `Step cap (${run.max_steps}) reached without a candidate patch`, last.id)
  }

  if (failure === 'harness_error') {
    const l = tr.llm(task, `Running the suite.\n\n<tool_use name="bash">pytest</tool_use>`)
    const sp = tr.tool(l, 'bash', {
      type: 'test',
      input: 'python -m pytest --no-header',
      error:
        'Container sweb.eval.x86_64 exited with code 137 (OOM killed).\nEvaluation harness could not collect results.',
      status: 'error',
      target: 'pytest',
      duration_ms: rng.int(30000, 70000),
      obs: OBS.small(rng),
    })
    failureSpanId = sp.id
    tr.event('budget', 'error', 'Harness container died — result not attributable to the agent', sp.id)
  }

  // ---- finalize
  if (failure !== 'context_overflow' && failure !== 'budget_exhausted' && failure !== 'harness_error') {
    const sp = tr.push({
      type: 'patch',
      name: 'submit_patch',
      parent_id: root.id,
      depth: 1,
      duration_ms: rng.int(120, 600),
      target: editTarget,
      input: `git diff > /tmp/patch.diff`,
      output: patch || '(empty patch)',
      status: resolved ? 'ok' : 'warn',
      attrs: {
        files: [...tr.filesTouched],
        added: broken ? 1 : 3,
        removed: 1,
      },
    })
    if (failure === 'localization') failureSpanId = failureSpanId || sp.id
  }

  // Close the root span over the whole timeline.
  root.end_ms = tr.t
  root.duration_ms = tr.t
  root.status = resolved ? 'ok' : failure === 'harness_error' ? 'error' : 'warn'
  root.output = resolved
    ? `resolved — ${f2p.length}/${f2p.length} fail-to-pass, ${p2p.length}/${p2p.length} pass-to-pass`
    : `unresolved — ${FAILURE_SUMMARY[failure]?.(failure === 'budget_exhausted' ? run : task) ?? failure}`

  const status =
    failure === 'harness_error'
      ? 'errored'
      : failure === 'budget_exhausted'
        ? 'timeout'
        : resolved
          ? 'resolved'
          : 'unresolved'

  const trial = {
    id: trialId,
    run_id: run.id,
    task_id: task.id,
    status,
    started_at: startedAt,
    duration_ms: tr.t,
    steps: tr.step,
    tokens_in: tr.tokensIn,
    tokens_out: tr.tokensOut,
    tokens_cached: tr.tokensCached,
    cost_usd: +tr.cost.toFixed(4),
    context_peak_pct: +Math.min(112, (tr.ctx / run.context_limit) * 100).toFixed(1),
    context_limit: run.context_limit,
    tool_calls: tr.toolCalls,
    tool_errors: tr.toolErrors,
    files_touched: JSON.stringify([...tr.filesTouched]),
    patch,
    patch_added: patch ? (broken ? 1 : 3) : 0,
    patch_removed: patch ? 1 : 0,
    f2p_passed: f2pPassed,
    f2p_total: f2p.length,
    p2p_passed: runsTests ? p2pPassed : 0,
    p2p_total: p2p.length,
    failure_category: failure,
    failure_summary: failure
      ? FAILURE_SUMMARY[failure]?.(failure === 'budget_exhausted' ? run : task) ?? null
      : null,
    failure_span_id: failureSpanId,
    localized: [...tr.filesRead].some((f) => task.gold_files.includes(f)) ? 1 : 0,
    first_edit_ms: tr.firstEditMs,
  }

  return { trial, spans: tr.spans, events: tr.events }
}

export { TASKS, RUN_CONFIGS }
