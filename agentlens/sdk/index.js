/**
 * The instrumentation library — what a user's agent imports to produce a trace.
 *
 * Zero dependencies and synchronous appends. An agent is often killed mid-run
 * (budget cap, timeout, crash) and that run is precisely the one worth reading,
 * so every record is flushed as it is produced rather than buffered until the
 * end. The cost is a write syscall per span, which is noise next to a model
 * call.
 *
 * Usage:
 *
 *   import { Tracer } from 'agentlens/sdk'
 *
 *   const tracer = new Tracer({ file: '.agentlens/run.jsonl', run: { id: 'v1', model: 'claude-opus-5' } })
 *   const trial = tracer.trial({ id: 't1', task_id: 'fix-login' })
 *
 *   const span = trial.span({ name: 'grep', type: 'tool', target: 'src/auth.ts' })
 *   span.end({ status: 'ok', output: '3 matches' })
 *
 *   const researcher = trial.subagent('researcher')
 *   researcher.span({ name: 'read_file' }).end()
 *   researcher.end()
 *
 *   await trial.grade('npm test')
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { spawn } from 'node:child_process'

let counter = 0
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`

export class Tracer {
  /**
   * @param {object} opts
   * @param {string} opts.file        Where to append JSONL.
   * @param {object} [opts.run]       Run metadata: { id, name, model, scaffold }.
   */
  constructor({ file, run = {} }) {
    if (!file) throw new Error('Tracer needs a file path.')
    this.file = file
    mkdirSync(dirname(file), { recursive: true })
    this.runId = run.id || uid('run')
    this.write({ record: 'run', id: this.runId, started_at: Date.now(), ...run })
  }

  /** Append one record. Public so a caller can emit shapes the SDK does not model. */
  write(obj) {
    appendFileSync(this.file, JSON.stringify(obj) + '\n')
  }

  /** Begin one attempt at one task. */
  trial({ id, task_id, title } = {}) {
    const trialId = id || uid('trial')
    this.write({
      record: 'trial',
      id: trialId,
      run_id: this.runId,
      task_id,
      title,
      started_at: Date.now(),
    })
    return new Trial(this, trialId)
  }
}

class Trial {
  constructor(tracer, id) {
    this.tracer = tracer
    this.id = id
    this.t0 = Date.now()
    this.step = 0
  }

  /**
   * Open a span. Call `.end()` on the result.
   * `parent` is a span returned by a previous call — pass a subagent to place
   * this work inside it.
   */
  span({ name, type = 'tool', parent = null, target = null, input = null, agent } = {}) {
    const id = uid('sp')
    return new OpenSpan(this, {
      id,
      name: name || type,
      type,
      parent_id: parent?.id ?? null,
      target,
      input,
      agent,
      start_ms: Date.now() - this.t0,
      step: ++this.step,
    })
  }

  /**
   * Open a subagent span. Spans created with `parent` set to the returned
   * handle — or via its own `.span()` — are attributed to this agent.
   */
  subagent(name, { parent = null } = {}) {
    return this.span({ name, type: 'subagent', agent: name, parent })
  }

  /**
   * Run the grading command and record the verdict. Exit code 0 is a pass.
   * Output is truncated because a trace is for diagnosis, not archival, and a
   * verbose test runner can otherwise dwarf the trace it belongs to.
   */
  grade(command, { cwd = process.cwd(), timeoutMs = 600_000, maxOutput = 20_000 } = {}) {
    const started = Date.now()
    return new Promise((resolve) => {
      const child = spawn(command, { cwd, shell: true, timeout: timeoutMs })
      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (d) => (stdout += d))
      child.stderr?.on('data', (d) => (stderr += d))
      child.on('close', (code) => {
        const result = {
          record: 'result',
          trial_id: this.id,
          command,
          exit_code: code ?? -1,
          stdout: stdout.slice(-maxOutput),
          stderr: stderr.slice(-maxOutput),
          duration_ms: Date.now() - started,
        }
        this.tracer.write(result)
        resolve(result)
      })
      child.on('error', (err) => {
        const result = {
          record: 'result',
          trial_id: this.id,
          command,
          exit_code: -1,
          stderr: String(err.message || err),
          duration_ms: Date.now() - started,
        }
        this.tracer.write(result)
        resolve(result)
      })
    })
  }

  /** Record a verdict directly, when grading happens somewhere else. */
  result({ status, exit_code, command = null } = {}) {
    this.tracer.write({ record: 'result', trial_id: this.id, status, exit_code, command })
  }
}

class OpenSpan {
  constructor(trial, fields) {
    this.trial = trial
    this.id = fields.id
    this.fields = fields
    this.ended = false
  }

  /** A span opened with this one as its parent — the ergonomic path for subagents. */
  span(opts = {}) {
    return this.trial.span({ ...opts, parent: this })
  }

  end({ status = 'ok', output = null, error = null, tokens_in = 0, tokens_out = 0, tokens_cached = 0, cost_usd = 0, model = null, attrs } = {} ) {
    if (this.ended) return this
    this.ended = true
    this.trial.tracer.write({
      record: 'span',
      ...this.fields,
      trial_id: this.trial.id,
      end_ms: Date.now() - this.trial.t0,
      status: error ? 'error' : status,
      output,
      error,
      tokens_in,
      tokens_out,
      tokens_cached,
      cost_usd,
      model,
      attrs,
    })
    return this
  }
}
