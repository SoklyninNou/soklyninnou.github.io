/**
 * Instrumentation checks.
 *
 * When a trace looks wrong, the first question is not "what did my agent do" but
 * "am I even recording it correctly" — and those two failures are almost
 * impossible to tell apart from the dashboard alone. A trial that appears to
 * take 4ms and one where `end()` was never called render identically.
 *
 * Each check answers a question the developer would otherwise have to ask by
 * reading raw JSONL, and every finding carries the span ids that triggered it so
 * the explorer can jump straight to them.
 */
import type { Span } from './api'
import type { ImportedTrial } from './trace-format'

export interface Diagnostic {
  id: string
  severity: 'error' | 'warn' | 'info'
  title: string
  detail: string
  count: number
  /** Examples, capped — the explorer filters to these. */
  spanIds: string[]
}

/** Merge intervals and return total covered length. */
function coverage(intervals: [number, number][]): number {
  if (!intervals.length) return 0
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  let total = 0
  let [start, end] = sorted[0]
  for (const [s, e] of sorted.slice(1)) {
    if (s > end) {
      total += end - start
      start = s
      end = e
    } else if (e > end) {
      end = e
    }
  }
  return total + (end - start)
}

const cap = (ids: string[]) => ids.slice(0, 50)

/** "1 span is" / "3 spans are" — agreement has to follow the count, not the noun. */
const plural = (n: number, noun: string, singularVerb: string, pluralVerb: string) =>
  `${n} ${noun}${n === 1 ? '' : 's'} ${n === 1 ? singularVerb : pluralVerb}`

export function diagnose(trials: ImportedTrial[], spansByTrial: Record<string, Span[]>): Diagnostic[] {
  const out: Diagnostic[] = []
  const all = Object.values(spansByTrial).flat()
  if (!all.length) return out

  const byId = new Map(all.map((s) => [s.id, s]))

  // --- untraced time -------------------------------------------------------
  // Gaps mean the agent was doing work no span covers. That is where a
  // mysterious minute of wall time hides.
  const gappy: { trial: string; pct: number }[] = []
  for (const t of trials) {
    const spans = spansByTrial[t.id] ?? []
    const roots = spans.filter((s) => s.depth === 1)
    if (!roots.length || t.duration_ms <= 0) continue
    const covered = coverage(roots.map((s) => [s.start_ms, s.end_ms] as [number, number]))
    const pct = Math.round(100 * (1 - covered / t.duration_ms))
    if (pct >= 15) gappy.push({ trial: t.task_id, pct })
  }
  if (gappy.length) {
    gappy.sort((a, b) => b.pct - a.pct)
    out.push({
      id: 'untraced-time',
      severity: 'warn',
      title: 'Untraced time',
      detail: `${plural(gappy.length, 'trial', 'spends', 'spend')} a large share of its duration outside any span — worst is ${gappy[0].trial} at ${gappy[0].pct}%. Either work is happening between spans, or a long-running step is not wrapped.`,
      count: gappy.length,
      spanIds: [],
    })
  }

  // --- zero-duration spans -------------------------------------------------
  const zero = all.filter((s) => s.duration_ms === 0 && s.type !== 'system')
  if (zero.length) {
    out.push({
      id: 'zero-duration',
      severity: zero.length === all.length ? 'error' : 'warn',
      title: 'Zero-duration spans',
      detail:
        zero.length === all.length
          ? 'Every span has the same start and end. Usually start_ms/end_ms were never set, or were set from the same clock reading.'
          : `${plural(zero.length, 'span', 'starts and ends', 'start and end')} at the same millisecond — often end() called immediately, or a missing end_ms.`,
      count: zero.length,
      spanIds: cap(zero.map((s) => s.id)),
    })
  }

  // --- dangling parents ----------------------------------------------------
  // The tree drives agent attribution, so a broken link silently credits work
  // to the orchestrator.
  const dangling = all.filter((s) => s.parent_id && !byId.has(s.parent_id))
  if (dangling.length) {
    out.push({
      id: 'dangling-parent',
      severity: 'error',
      title: 'Spans referencing a missing parent',
      detail: `${plural(dangling.length, 'span', 'names', 'name')} a parent_id that is not in the trace, so that work is attributed to the orchestrator rather than the agent that performed it.`,
      count: dangling.length,
      spanIds: cap(dangling.map((s) => s.id)),
    })
  }

  // --- tokens without cost -------------------------------------------------
  const unpriced = all.filter((s) => s.tokens_in + s.tokens_out > 0 && s.cost_usd === 0)
  if (unpriced.length) {
    out.push({
      id: 'tokens-no-cost',
      severity: 'info',
      title: 'Tokens recorded without cost',
      detail: `${plural(unpriced.length, 'span', 'reports', 'report')} tokens but no cost_usd, so spend is understated. Nothing is priced automatically — pass cost_usd to end().`,
      count: unpriced.length,
      spanIds: cap(unpriced.map((s) => s.id)),
    })
  }

  // --- children outliving their parent -------------------------------------
  const escaping = all.filter((s) => {
    if (!s.parent_id) return false
    const p = byId.get(s.parent_id)
    return p ? s.end_ms > p.end_ms + 1 : false
  })
  if (escaping.length) {
    out.push({
      id: 'child-outlives-parent',
      severity: 'warn',
      title: 'Children ending after their parent',
      detail: `${plural(escaping.length, 'span', 'ends', 'end')} after the span that contains it. Usually a parent closed before its work finished — a subagent ended early, or spans were reparented.`,
      count: escaping.length,
      spanIds: cap(escaping.map((s) => s.id)),
    })
  }

  // --- steps never set -----------------------------------------------------
  if (all.every((s) => s.step === 0)) {
    out.push({
      id: 'no-steps',
      severity: 'info',
      title: 'No step numbers',
      detail:
        'Every span is at step 0. Steps are what let you say "at 2:14 the agent was on step 12" — pass step when you open a span, or use the SDK, which counts them for you.',
      count: all.length,
      spanIds: [],
    })
  }

  // --- ungraded trials -----------------------------------------------------
  const ungraded = trials.filter((t) => !t.grade)
  if (ungraded.length) {
    out.push({
      id: 'ungraded',
      severity: ungraded.length === trials.length ? 'warn' : 'info',
      title: 'Ungraded trials',
      detail: `${ungraded.length} of ${trials.length} trial${trials.length === 1 ? '' : 's'} ${ungraded.length === 1 ? 'has' : 'have'} no result record, so ${ungraded.length === 1 ? 'it is' : 'they are'} excluded from the pass rate. Call grade() or emit a result record.`,
      count: ungraded.length,
      spanIds: [],
    })
  }

  // --- errors with no message ----------------------------------------------
  const silent = all.filter((s) => s.status === 'error' && !s.error)
  if (silent.length) {
    out.push({
      id: 'silent-errors',
      severity: 'warn',
      title: 'Errors with no message',
      detail: `${plural(silent.length, 'span', 'is marked failed but carries', 'are marked failed but carry')} no error text, so the trace records that something broke without recording what.`,
      count: silent.length,
      spanIds: cap(silent.map((s) => s.id)),
    })
  }

  const rank = { error: 0, warn: 1, info: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count)
}
