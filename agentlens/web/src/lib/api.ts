import { useEffect, useRef, useState } from 'react'

export type TrialStatus = 'resolved' | 'unresolved' | 'errored' | 'timeout'
export type SpanKind = 'search' | 'read' | 'edit' | 'test' | 'other'

export interface Run {
  id: string
  name: string
  suite: string
  model: string
  scaffold: string
  scaffold_ver: string
  temperature: number
  max_steps: number
  budget_usd: number
  git_sha: string
  started_at: number
  finished_at: number
  status: string
  notes: string
  trials?: number
  resolved?: number
  errored?: number
  resolve_pct?: number
  localize_pct?: number
  cost_usd?: number
  tokens_in?: number
  tokens_out?: number
  tokens_cached?: number
  avg_steps?: number
  avg_sec?: number
  tool_calls?: number
  tool_errors?: number
}

export interface Task {
  id: string
  repo: string
  language: string
  issue_title: string
  issue_body: string
  base_commit: string
  difficulty: 'easy' | 'medium' | 'hard'
  gold_files: string[]
  gold_patch: string | null
  fail_to_pass: string[]
  pass_to_pass: string[]
  tags: string[]
  attempts?: number
  solved?: number
  solve_pct?: number
  avg_steps?: number
  avg_cost?: number
}

export interface Trial {
  id: string
  run_id: string
  task_id: string
  status: TrialStatus
  started_at: number
  duration_ms: number
  steps: number
  tokens_in: number
  tokens_out: number
  tokens_cached: number
  cost_usd: number
  context_peak_pct: number
  context_limit: number
  tool_calls: number
  tool_errors: number
  files_touched: string[]
  patch: string | null
  patch_added: number
  patch_removed: number
  f2p_passed: number
  f2p_total: number
  p2p_passed: number
  p2p_total: number
  failure_category: string | null
  failure_summary: string | null
  failure_span_id: string | null
  localized: number
  first_edit_ms: number | null
  run_name?: string
  model?: string
  scaffold?: string
  scaffold_ver?: string
  max_steps?: number
  budget_usd?: number
  temperature?: number
  repo?: string
  difficulty?: string
  issue_title?: string
}

export interface Span {
  id: string
  trial_id: string
  parent_id: string | null
  seq: number
  step: number
  depth: number
  type: 'llm' | 'tool' | 'think' | 'subagent' | 'test' | 'patch' | 'system'
  name: string
  status: 'ok' | 'error' | 'warn'
  start_ms: number
  end_ms: number
  duration_ms: number
  model: string | null
  tokens_in: number
  tokens_out: number
  tokens_cached: number
  cost_usd: number
  ctx_used: number
  input: string | null
  output: string | null
  error: string | null
  target: string | null
  attrs: Record<string, unknown> | null
  kind: SpanKind
}

export interface TrialEvent {
  id: number
  trial_id: string
  span_id: string | null
  t_ms: number
  level: 'info' | 'warn' | 'error'
  kind: string
  message: string
  data: string | null
}

export interface Annotation {
  id: number
  target_type: string
  target_id: string
  author: string
  label: string | null
  body: string
  created_at: number
}

export interface FailureMeta {
  label: string
  blurb: string
  hue: string
}

export interface Stats {
  n: number
  min: number
  p25: number
  p50: number
  p90: number
  max: number
  mean: number
}

export interface Bin {
  x0: number
  x1: number
  count: number
}

export interface Overview {
  totals: {
    runs: number
    trials: number
    resolved: number
    resolvePct: number
    cost: number
    tokens: number
    agentHours: number
    toolCalls: number
    toolErrors: number
  }
  runs: Run[]
  failureByRun: Record<string, Record<string, number>>
  taxonomy: { category: string; n: number; label: string; blurb: string }[]
  recent: (Trial & { run_name: string; repo: string; difficulty: string })[]
  hardest: Task[]
}

export interface RunDetail {
  run: Run
  summary: {
    trials: number
    resolved: number
    resolvePct: number
    localizePct: number
    cost: number
    steps: Stats
    duration: Stats
    costDist: Stats
    contextPeak: Stats
    toolErrorRate: number
  }
  trials: Trial[]
  failures: { category: string; n: number; label: string; blurb: string }[]
  stepHistogram: Bin[]
  costHistogram: Bin[]
  tools: { name: string; calls: number; errors: number; avg_ms: number; max_ms: number }[]
  flow: {
    nodes: { id: string; count: number; errors: number }[]
    edges: { source: string; target: string; count: number }[]
  }
  phases: { bucket: number; pct: number; search: number; read: number; edit: number; test: number; other: number }[]
}

export interface TraceDetail {
  trial: Trial
  task: Task
  spans: Span[]
  events: TrialEvent[]
  annotations: Annotation[]
  siblings: {
    id: string
    run_id: string
    status: TrialStatus
    failure_category: string | null
    steps: number
    cost_usd: number
    duration_ms: number
    run_name: string
  }[]
  failureMeta: FailureMeta | null
}

export interface FailuresPayload {
  byCat: { category: string; n: number; avg_steps: number; avg_cost: number; avg_sec: number; label: string; blurb: string }[]
  matrix: { run_id: string; category: string; n: number }[]
  byRepo: { repo: string; category: string; n: number }[]
  trials: (Trial & { run_name: string; repo: string; difficulty: string })[]
  meta: Record<string, FailureMeta>
}

export interface SearchHit {
  span_id: string
  trial_id: string
  name: string
  type: string
  status: string
  step: number
  target: string | null
  start_ms: number
  run_id: string
  task_id: string
  trial_status: string
  snip_out: string
  snip_err: string
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${path}`)
  return r.json() as Promise<T>
}

export interface Api {
  meta: () => Promise<{ failureCategories: Record<string, FailureMeta>; counts: Record<string, number> }>
  overview: () => Promise<Overview>
  runs: () => Promise<Run[]>
  run: (id: string) => Promise<RunDetail>
  tasks: () => Promise<Task[]>
  task: (id: string) => Promise<{ task: Task; trials: Trial[] }>
  trials: (qs?: Record<string, string>) => Promise<Trial[]>
  trial: (id: string) => Promise<TraceDetail>
  failures: (category?: string) => Promise<FailuresPayload>
  search: (q: string) => Promise<{ term: string; hits: SearchHit[] }>
  compare: (ids: string[]) => Promise<{ sides: { trial: Trial; spans: Span[] }[] }>
  addAnnotation: (body: { target_id: string; body: string; label?: string; target_type?: string }) => Promise<unknown>
}

/** Talks to the zero-dependency Node API: `npm run dev` or `npm start`. */
const liveApi: Api = {
  meta: () => get('/api/meta'),
  overview: () => get('/api/overview'),
  runs: () => get('/api/runs'),
  run: (id) => get(`/api/runs/${encodeURIComponent(id)}`),
  tasks: () => get('/api/tasks'),
  task: (id) => get(`/api/tasks/${encodeURIComponent(id)}`),
  trials: (qs = {}) => get(`/api/trials?${new URLSearchParams(qs)}`),
  trial: (id) => get(`/api/trials/${encodeURIComponent(id)}`),
  failures: (category) => get(`/api/failures${category ? `?category=${category}` : ''}`),
  search: (q) => get(`/api/search?q=${encodeURIComponent(q)}`),
  compare: (ids) => get(`/api/compare?ids=${ids.join(',')}`),
  addAnnotation: (body) =>
    fetch('/api/annotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
}

// ------------------------------------------------------------------- static
// A static host has no API process, so `npm run build:static` renders every
// endpoint to JSON under `<base>data/` and this shim reads those files instead.
// Query-parameter endpoints are narrowed here; FTS5 is replaced by a scan over
// a flat span index; review notes live in localStorage rather than SQLite.

interface IndexRow {
  span_id: string
  trial_id: string
  name: string
  type: string
  status: string
  step: number
  target: string | null
  start_ms: number
  input: string | null
  output: string | null
  error: string | null
  run_id: string
  task_id: string
  trial_status: string
}

const NOTES_KEY = 'al-annotations'

function localNotes(targetId: string): Annotation[] {
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]') as Annotation[]
    return all.filter((a) => a.target_id === targetId).sort((a, b) => b.created_at - a.created_at)
  } catch {
    return []
  }
}

/** Words the query must match, as lowercase prefixes — mirrors `term*` in FTS5. */
const termsOf = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)

const matches = (text: string | null, terms: string[]) => {
  if (!text) return false
  const t = text.toLowerCase()
  return terms.every((x) => t.includes(x))
}

/** Stand-in for FTS5's `snippet()`: ±7 words of context, matches in « ». */
function snippet(text: string | null, terms: string[]): string {
  if (!text) return ''
  const words = text.split(/\s+/)
  const at = words.findIndex((w) => terms.some((t) => w.toLowerCase().includes(t)))
  if (at < 0) return ''
  const from = Math.max(0, at - 7)
  const slice = words.slice(from, at + 8).map((w) => {
    const hit = terms.find((t) => w.toLowerCase().includes(t))
    if (!hit) return w
    const i = w.toLowerCase().indexOf(hit)
    return `${w.slice(0, i)}«${w.slice(i, i + hit.length)}»${w.slice(i + hit.length)}`
  })
  return (from > 0 ? ' … ' : '') + slice.join(' ') + (at + 8 < words.length ? ' … ' : '')
}

function staticApi(): Api {
  const DATA = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}data/`
  const file = <T,>(rel: string) => get<T>(DATA + rel)

  let index: Promise<IndexRow[]> | null = null
  const searchIndex = () => (index ??= file<IndexRow[]>('search.json'))

  return {
    meta: () => file('meta.json'),
    overview: () => file('overview.json'),
    runs: () => file('runs.json'),
    run: (id) => file(`runs/${encodeURIComponent(id)}.json`),
    tasks: () => file('tasks.json'),
    task: (id) => file(`tasks/${encodeURIComponent(id)}.json`),

    trials: async (qs = {}) => {
      const all = await file<Trial[]>('trials.json')
      const keep: [keyof Trial, string | undefined][] = [
        ['run_id', qs.run],
        ['task_id', qs.task],
        ['status', qs.status],
        ['failure_category', qs.failure],
      ]
      return all.filter((t) => keep.every(([k, v]) => !v || t[k] === v))
    },

    trial: async (id) => {
      const detail = await file<TraceDetail>(`trials/${encodeURIComponent(id)}.json`)
      return { ...detail, annotations: [...localNotes(id), ...detail.annotations] }
    },

    failures: async (category) => {
      const all = await file<FailuresPayload>('failures.json')
      return category ? { ...all, trials: all.trials.filter((t) => t.failure_category === category) } : all
    },

    search: async (q) => {
      const term = q.trim()
      if (!term) return { term: '', hits: [] }
      const terms = termsOf(term)
      const hits: SearchHit[] = []
      for (const r of await searchIndex()) {
        if (hits.length >= 80) break
        const hay = [r.name, r.target, r.input, r.output, r.error].filter(Boolean).join('\n')
        if (!matches(hay, terms)) continue
        hits.push({
          span_id: r.span_id,
          trial_id: r.trial_id,
          name: r.name,
          type: r.type,
          status: r.status,
          step: r.step,
          target: r.target,
          start_ms: r.start_ms,
          run_id: r.run_id,
          task_id: r.task_id,
          trial_status: r.trial_status,
          snip_out: snippet(r.output, terms),
          snip_err: snippet(r.error, terms),
        })
      }
      return { term, hits }
    },

    compare: async (ids) => {
      const sides = await Promise.all(
        ids.slice(0, 2).map((id) =>
          file<TraceDetail>(`trials/${encodeURIComponent(id)}.json`)
            .then((d) => ({ trial: d.trial, spans: d.spans }))
            .catch(() => null),
        ),
      )
      return { sides: sides.filter((s): s is { trial: Trial; spans: Span[] } => s !== null) }
    },

    addAnnotation: async ({ target_id, body, label = null, target_type = 'trial' }) => {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]') as Annotation[]
      all.push({
        id: Date.now(),
        target_type,
        target_id,
        author: 'you',
        label,
        body,
        created_at: Date.now(),
      })
      localStorage.setItem(NOTES_KEY, JSON.stringify(all))
      return { ok: true }
    },
  }
}

export const api: Api = __AGENTLENS_STATIC__ ? staticApi() : liveApi

/** Small data hook: keeps the previous render visible while refetching. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    setLoading(true)
    fn()
      .then((d) => {
        if (alive.current) {
          setData(d)
          setError(null)
        }
      })
      .catch((e) => alive.current && setError(String(e.message || e)))
      .finally(() => alive.current && setLoading(false))
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, error, loading, reload: () => setNonce((n) => n + 1) }
}
