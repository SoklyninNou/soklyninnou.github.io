/**
 * The public trace format — what a user's own agent emits so AgentLens can read it.
 *
 * JSONL, one record per line, because an agent should be able to append a line
 * as each step completes rather than buffering a whole run in memory and
 * writing it at the end. A crashed run therefore still leaves a readable trace,
 * which is exactly the run you most want to look at.
 *
 * Records may arrive in any order: spans are allowed to precede the trial they
 * belong to, so an emitter never has to hold anything back. Everything is
 * resolved in a second pass by `normalize`.
 *
 * Subagents are not a separate record type. A subagent is a span of type
 * `subagent`, and the work it performed is the spans whose `parent_id` chain
 * leads back to it. That keeps delegation in the same tree as everything else,
 * so an agent that spawns helpers is not a different shape of data — just a
 * deeper one.
 */
import type { Span, Trial, TrialStatus } from './api'

// ------------------------------------------------------------------- records

export interface RunRecord {
  record: 'run'
  id: string
  name?: string
  model?: string
  scaffold?: string
  started_at?: number
  notes?: string
}

export interface TrialRecord {
  record: 'trial'
  id: string
  run_id?: string
  task_id?: string
  started_at?: number
  /** Free-form label for what was attempted, shown when there is no task id. */
  title?: string
}

export interface SpanRecord {
  record: 'span'
  id: string
  trial_id: string
  parent_id?: string | null
  name: string
  type?: Span['type']
  status?: 'ok' | 'error' | 'warn'
  /** Milliseconds from the start of the trial. */
  start_ms?: number
  end_ms?: number
  duration_ms?: number
  step?: number
  model?: string | null
  tokens_in?: number
  tokens_out?: number
  tokens_cached?: number
  cost_usd?: number
  ctx_used?: number
  input?: string | null
  output?: string | null
  error?: string | null
  /** File path, command, or test id this span acted on. */
  target?: string | null
  /**
   * Names the agent for a `subagent` span. Ignored elsewhere — every other
   * span's owning agent is derived from its position in the tree, so an
   * emitter never has to tag spans it did not spawn.
   */
  agent?: string
  attrs?: Record<string, unknown>
}

/**
 * The grading verdict for a trial. Separate from the trial record because it is
 * produced later, by a different process — the agent finishes, then the test
 * command runs and decides whether any of it counted.
 */
export interface ResultRecord {
  record: 'result'
  trial_id: string
  /** Omit to derive from `exit_code`: 0 passes, anything else does not. */
  status?: TrialStatus
  exit_code?: number
  command?: string
  stdout?: string
  stderr?: string
  duration_ms?: number
}

export type TraceRecord = RunRecord | TrialRecord | SpanRecord | ResultRecord

// -------------------------------------------------------------- parse result

export interface ParseIssue {
  line: number
  message: string
}

export interface ImportedRun {
  id: string
  name: string
  model: string
  scaffold: string
  started_at: number
  notes: string
}

export interface ImportedTrial extends Trial {
  /** Present when a test command graded this trial. */
  grade: {
    command: string | null
    exit_code: number | null
    stdout: string | null
    stderr: string | null
  } | null
}

export interface ImportedTrace {
  runs: ImportedRun[]
  trials: ImportedTrial[]
  /** Keyed by trial id, ordered by `seq`. */
  spansByTrial: Record<string, Span[]>
}

export interface ParseOutcome {
  trace: ImportedTrace
  errors: ParseIssue[]
  warnings: ParseIssue[]
}

// ------------------------------------------------------------------- parsing

const SPAN_TYPES = new Set(['llm', 'tool', 'think', 'subagent', 'test', 'patch', 'system'])

/**
 * Read JSONL into records, collecting problems rather than throwing.
 *
 * A trace is a debugging artefact from a run that may itself have crashed, so a
 * single malformed line is an expected condition. Reporting every bad line at
 * once — with its line number — beats failing on the first one and making the
 * user re-import to discover the next.
 */
export function parseRecords(text: string): { records: TraceRecord[]; errors: ParseIssue[] } {
  const records: TraceRecord[] = []
  const errors: ParseIssue[] = []

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      errors.push({ line: i + 1, message: 'Not valid JSON.' })
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push({ line: i + 1, message: 'Expected a JSON object.' })
      return
    }
    const rec = parsed as Record<string, unknown>
    const kind = rec.record
    if (kind !== 'run' && kind !== 'trial' && kind !== 'span' && kind !== 'result') {
      errors.push({ line: i + 1, message: `Unknown record type ${JSON.stringify(kind)}.` })
      return
    }
    if (typeof rec.id !== 'string' && kind !== 'result') {
      errors.push({ line: i + 1, message: `A ${kind} record needs a string id.` })
      return
    }
    if (kind === 'span' && typeof rec.trial_id !== 'string') {
      errors.push({ line: i + 1, message: 'A span record needs a trial_id.' })
      return
    }
    if (kind === 'result' && typeof rec.trial_id !== 'string') {
      errors.push({ line: i + 1, message: 'A result record needs a trial_id.' })
      return
    }
    records.push(parsed as TraceRecord)
  })

  return { records, errors }
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/** Mirrors the server's `kindOf`, so imported spans colour like the demo corpus. */
export function kindOf(s: { type: string; name: string }): Span['kind'] {
  if (s.type === 'test') return 'test'
  if (s.type === 'patch') return 'edit'
  const n = s.name
  if (n === 'search_repo' || n === 'bm25_retrieve' || n === 'grep' || n === 'search') return 'search'
  if (n === 'read_file' || n === 'open' || n === 'read') return 'read'
  if (n === 'str_replace' || n === 'edit_file' || n === 'apply_patch' || n === 'write_file' || n === 'edit')
    return 'edit'
  return 'other'
}

/**
 * Resolve records into the same shapes the rest of the app already renders.
 *
 * Normalizing here rather than teaching every view about a second data format
 * is what lets imported traces reuse the existing Waterfall and span inspector
 * unchanged.
 */
export function normalize(records: TraceRecord[]): ParseOutcome {
  const warnings: ParseIssue[] = []
  const runRecs = new Map<string, RunRecord>()
  const trialRecs = new Map<string, TrialRecord>()
  const resultRecs = new Map<string, ResultRecord>()
  const spanRecs: SpanRecord[] = []

  for (const r of records) {
    if (r.record === 'run') runRecs.set(r.id, r)
    else if (r.record === 'trial') trialRecs.set(r.id, r)
    else if (r.record === 'result') resultRecs.set(r.trial_id, r)
    else spanRecs.push(r)
  }

  // Spans may name a trial that was never declared. Rather than drop that work,
  // synthesize the trial — a partial trace is still worth reading.
  for (const s of spanRecs) {
    if (!trialRecs.has(s.trial_id)) {
      trialRecs.set(s.trial_id, { record: 'trial', id: s.trial_id })
      warnings.push({ line: 0, message: `No trial record for "${s.trial_id}" — inferred one from its spans.` })
    }
  }

  const spansByTrialRaw = new Map<string, SpanRecord[]>()
  for (const s of spanRecs) {
    if (!spansByTrialRaw.has(s.trial_id)) spansByTrialRaw.set(s.trial_id, [])
    spansByTrialRaw.get(s.trial_id)!.push(s)
  }

  const spansByTrial: Record<string, Span[]> = {}
  const trials: ImportedTrial[] = []

  for (const [trialId, trialRec] of trialRecs) {
    const raw = spansByTrialRaw.get(trialId) ?? []
    const byId = new Map(raw.map((s) => [s.id, s]))

    // Depth comes from the parent chain rather than the emitter, so a caller
    // cannot report a tree that does not match the one it actually built.
    const depthOf = (s: SpanRecord, seen = new Set<string>()): number => {
      if (!s.parent_id || !byId.has(s.parent_id) || seen.has(s.id)) return 1
      seen.add(s.id)
      return 1 + depthOf(byId.get(s.parent_id)!, seen)
    }

    const spans: Span[] = raw
      .map((s) => {
        const start = num(s.start_ms)
        const end = s.end_ms != null ? num(s.end_ms) : start + num(s.duration_ms)
        const type = s.type && SPAN_TYPES.has(s.type) ? s.type : 'tool'
        return {
          id: s.id,
          trial_id: trialId,
          parent_id: s.parent_id ?? null,
          seq: 0,
          step: num(s.step),
          depth: depthOf(s),
          type,
          name: s.name || type,
          status: s.status === 'error' || s.status === 'warn' ? s.status : 'ok',
          start_ms: start,
          end_ms: Math.max(start, end),
          duration_ms: Math.max(0, Math.max(start, end) - start),
          model: s.model ?? null,
          tokens_in: num(s.tokens_in),
          tokens_out: num(s.tokens_out),
          tokens_cached: num(s.tokens_cached),
          cost_usd: num(s.cost_usd),
          ctx_used: num(s.ctx_used),
          input: s.input ?? null,
          output: s.output ?? null,
          error: s.error ?? null,
          target: s.target ?? null,
          attrs: { ...(s.attrs ?? {}), ...(s.agent ? { agent: s.agent } : {}) },
          kind: kindOf({ type, name: s.name || type }),
        } satisfies Span
      })
      .sort((a, b) => a.start_ms - b.start_ms || a.step - b.step)
      .map((s, i) => ({ ...s, seq: i + 1 }))

    spansByTrial[trialId] = spans

    const result = resultRecs.get(trialId)
    const status: TrialStatus = result?.status
      ? result.status
      : result?.exit_code != null
        ? result.exit_code === 0
          ? 'resolved'
          : 'unresolved'
        : spans.some((s) => s.status === 'error')
          ? 'unresolved'
          : 'resolved'

    const toolSpans = spans.filter((s) => s.type === 'tool' || s.type === 'test' || s.type === 'patch')
    const duration = spans.length ? Math.max(...spans.map((s) => s.end_ms)) : 0

    trials.push({
      id: trialId,
      run_id: trialRec.run_id ?? 'run',
      task_id: trialRec.task_id ?? trialRec.title ?? trialId,
      status,
      started_at: num(trialRec.started_at, Date.now()),
      duration_ms: duration,
      steps: spans.length ? Math.max(...spans.map((s) => s.step)) : 0,
      tokens_in: spans.reduce((a, s) => a + s.tokens_in, 0),
      tokens_out: spans.reduce((a, s) => a + s.tokens_out, 0),
      tokens_cached: spans.reduce((a, s) => a + s.tokens_cached, 0),
      cost_usd: +spans.reduce((a, s) => a + s.cost_usd, 0).toFixed(6),
      context_peak_pct: 0,
      context_limit: 0,
      tool_calls: toolSpans.length,
      tool_errors: toolSpans.filter((s) => s.status === 'error').length,
      files_touched: [...new Set(spans.filter((s) => s.kind === 'edit' && s.target).map((s) => s.target!))],
      patch: null,
      patch_added: 0,
      patch_removed: 0,
      f2p_passed: status === 'resolved' ? 1 : 0,
      f2p_total: result ? 1 : 0,
      p2p_passed: 0,
      p2p_total: 0,
      failure_category: null,
      failure_summary: result && status !== 'resolved' ? (result.stderr || result.stdout || '').slice(0, 400) : null,
      failure_span_id: spans.find((s) => s.status === 'error')?.id ?? null,
      localized: 0,
      first_edit_ms: spans.find((s) => s.kind === 'edit')?.start_ms ?? null,
      issue_title: trialRec.title,
      grade: result
        ? {
            command: result.command ?? null,
            exit_code: result.exit_code ?? null,
            stdout: result.stdout ?? null,
            stderr: result.stderr ?? null,
          }
        : null,
    })
  }

  const runs: ImportedRun[] = [...runRecs.values()].map((r) => ({
    id: r.id,
    name: r.name || r.id,
    model: r.model || 'unknown',
    scaffold: r.scaffold || 'custom',
    started_at: num(r.started_at, Date.now()),
    notes: r.notes || '',
  }))

  // Trials may reference a run that was never declared, for the same reason
  // spans may outlive their trial: the emitter crashed before writing it.
  for (const t of trials) {
    if (!runs.some((r) => r.id === t.run_id)) {
      runs.push({ id: t.run_id, name: t.run_id, model: 'unknown', scaffold: 'custom', started_at: 0, notes: '' })
    }
  }

  trials.sort((a, b) => b.started_at - a.started_at)
  return { trace: { runs, trials, spansByTrial }, errors: [], warnings }
}

export function parseTrace(text: string): ParseOutcome {
  const { records, errors } = parseRecords(text)
  const out = normalize(records)
  return { ...out, errors: [...errors, ...out.errors] }
}
