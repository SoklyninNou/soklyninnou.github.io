import http from 'node:http'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, rows, row } from './db.js'
import { flowGraph, histogram, phaseProfile, summarize, kindOf } from './analysis.js'
import { FAILURE_CATEGORIES } from './corpus.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB_DIST = join(__dirname, '..', '..', 'web', 'dist')
// Deliberately not `PORT` — dev harnesses set that for the web server, and the
// API must not race it for the same socket.
const PORT = Number(process.env.AGENTLENS_API_PORT || 5177)

const J = (v) => {
  try {
    return JSON.parse(v)
  } catch {
    return []
  }
}

// ------------------------------------------------------------------- queries

const q = {
  runs: () =>
    rows(
      db().prepare(`
      SELECT r.*,
        COUNT(t.id)                                       AS trials,
        SUM(t.status='resolved')                          AS resolved,
        SUM(t.status='errored')                           AS errored,
        ROUND(100.0*SUM(t.status='resolved')/COUNT(t.id),1) AS resolve_pct,
        ROUND(100.0*SUM(t.localized)/COUNT(t.id),1)       AS localize_pct,
        ROUND(SUM(t.cost_usd),3)                          AS cost_usd,
        SUM(t.tokens_in)                                  AS tokens_in,
        SUM(t.tokens_out)                                 AS tokens_out,
        SUM(t.tokens_cached)                              AS tokens_cached,
        ROUND(AVG(t.steps),1)                             AS avg_steps,
        ROUND(AVG(t.duration_ms)/1000.0,1)                AS avg_sec,
        SUM(t.tool_calls)                                 AS tool_calls,
        SUM(t.tool_errors)                                AS tool_errors
      FROM runs r LEFT JOIN trials t ON t.run_id = r.id
      GROUP BY r.id ORDER BY r.started_at DESC`),
    ),

  run: (id) => row(db().prepare(`SELECT * FROM runs WHERE id = ?`), id),

  trialsForRun: (id) =>
    rows(
      db().prepare(`
      SELECT t.*, k.repo, k.difficulty, k.issue_title
      FROM trials t JOIN tasks k ON k.id = t.task_id
      WHERE t.run_id = ? ORDER BY t.started_at`),
      id,
    ),

  tasks: () =>
    rows(
      db().prepare(`
      SELECT k.*,
        COUNT(t.id) AS attempts,
        SUM(t.status='resolved') AS solved,
        ROUND(100.0*SUM(t.status='resolved')/NULLIF(COUNT(t.id),0),1) AS solve_pct,
        ROUND(AVG(t.steps),1) AS avg_steps,
        ROUND(AVG(t.cost_usd),3) AS avg_cost
      FROM tasks k LEFT JOIN trials t ON t.task_id = k.id
      GROUP BY k.id ORDER BY solve_pct ASC, k.id`),
    ),

  failureBreakdown: (runId) =>
    rows(
      db().prepare(`
      SELECT run_id, failure_category AS category, COUNT(*) AS n
      FROM trials WHERE failure_category IS NOT NULL ${runId ? 'AND run_id = ?' : ''}
      GROUP BY run_id, failure_category`),
      ...(runId ? [runId] : []),
    ),

  toolStats: (runId) =>
    rows(
      db().prepare(`
      SELECT s.name,
             COUNT(*) AS calls,
             SUM(s.status='error') AS errors,
             ROUND(AVG(s.duration_ms)) AS avg_ms,
             MAX(s.duration_ms) AS max_ms
      FROM spans s JOIN trials t ON t.id = s.trial_id
      WHERE s.type IN ('tool','test','patch') ${runId ? 'AND t.run_id = ?' : ''}
      GROUP BY s.name ORDER BY calls DESC`),
      ...(runId ? [runId] : []),
    ),
}

// -------------------------------------------------------------------- routes

const routes = []
const get = (pattern, handler) => {
  const keys = []
  const rx = new RegExp(
    '^' +
      pattern.replace(/:[a-zA-Z_]+/g, (m) => {
        keys.push(m.slice(1))
        return '([^/]+)'
      }) +
      '$',
  )
  routes.push({ rx, keys, handler })
}

get('/api/health', () => ({ ok: true, db: 'ready' }))

get('/api/meta', () => ({
  failureCategories: FAILURE_CATEGORIES,
  counts: {
    runs: db().prepare(`SELECT COUNT(*) c FROM runs`).get().c,
    tasks: db().prepare(`SELECT COUNT(*) c FROM tasks`).get().c,
    trials: db().prepare(`SELECT COUNT(*) c FROM trials`).get().c,
    spans: db().prepare(`SELECT COUNT(*) c FROM spans`).get().c,
  },
}))

get('/api/overview', () => {
  const runs = q.runs()
  const trials = rows(db().prepare(`SELECT * FROM trials`))
  const totals = {
    runs: runs.length,
    trials: trials.length,
    resolved: trials.filter((t) => t.status === 'resolved').length,
    cost: +trials.reduce((a, t) => a + t.cost_usd, 0).toFixed(2),
    tokens: trials.reduce((a, t) => a + t.tokens_in + t.tokens_out, 0),
    agentHours: +(trials.reduce((a, t) => a + t.duration_ms, 0) / 3.6e6).toFixed(1),
    toolCalls: trials.reduce((a, t) => a + t.tool_calls, 0),
    toolErrors: trials.reduce((a, t) => a + t.tool_errors, 0),
  }
  totals.resolvePct = +((100 * totals.resolved) / (totals.trials || 1)).toFixed(1)

  const breakdown = q.failureBreakdown()
  const byRun = {}
  for (const b of breakdown) {
    byRun[b.run_id] = byRun[b.run_id] || {}
    byRun[b.run_id][b.category] = b.n
  }

  const taxonomy = {}
  for (const b of breakdown) taxonomy[b.category] = (taxonomy[b.category] || 0) + b.n

  return {
    totals,
    runs,
    failureByRun: byRun,
    taxonomy: Object.entries(taxonomy)
      .map(([category, n]) => ({ category, n, ...FAILURE_CATEGORIES[category] }))
      .sort((a, b) => b.n - a.n),
    recent: rows(
      db().prepare(`
      SELECT t.id, t.run_id, t.task_id, t.status, t.failure_category, t.cost_usd, t.steps,
             t.duration_ms, t.started_at, r.name AS run_name, k.repo, k.difficulty
      FROM trials t JOIN runs r ON r.id=t.run_id JOIN tasks k ON k.id=t.task_id
      ORDER BY t.started_at DESC LIMIT 12`),
    ),
    hardest: q.tasks().slice(0, 8),
  }
})

get('/api/runs', () => q.runs())

get('/api/runs/:id', ({ id }) => {
  const run = q.run(id)
  if (!run) return null
  const trials = q.trialsForRun(id)
  const spans = rows(
    db().prepare(`
    SELECT s.trial_id, s.seq, s.type, s.name, s.status, s.start_ms, s.end_ms, s.duration_ms
    FROM spans s JOIN trials t ON t.id=s.trial_id
    WHERE t.run_id = ? AND s.type IN ('tool','test','patch')`),
    id,
  )
  const failures = {}
  for (const t of trials) if (t.failure_category) failures[t.failure_category] = (failures[t.failure_category] || 0) + 1

  return {
    run,
    summary: {
      trials: trials.length,
      resolved: trials.filter((t) => t.status === 'resolved').length,
      resolvePct: +((100 * trials.filter((t) => t.status === 'resolved').length) / (trials.length || 1)).toFixed(1),
      localizePct: +((100 * trials.filter((t) => t.localized).length) / (trials.length || 1)).toFixed(1),
      cost: +trials.reduce((a, t) => a + t.cost_usd, 0).toFixed(3),
      steps: summarize(trials.map((t) => t.steps)),
      duration: summarize(trials.map((t) => t.duration_ms)),
      costDist: summarize(trials.map((t) => t.cost_usd)),
      contextPeak: summarize(trials.map((t) => t.context_peak_pct)),
      toolErrorRate: +(
        (100 * trials.reduce((a, t) => a + t.tool_errors, 0)) /
        (trials.reduce((a, t) => a + t.tool_calls, 0) || 1)
      ).toFixed(1),
    },
    trials: trials.map((t) => ({ ...t, files_touched: J(t.files_touched) })),
    failures: Object.entries(failures)
      .map(([category, n]) => ({ category, n, ...FAILURE_CATEGORIES[category] }))
      .sort((a, b) => b.n - a.n),
    stepHistogram: histogram(trials.map((t) => t.steps), 10),
    costHistogram: histogram(trials.map((t) => t.cost_usd), 10),
    tools: q.toolStats(id),
    flow: flowGraph(spans),
    phases: phaseProfile(spans),
  }
})

get('/api/tasks', () => q.tasks().map((t) => ({ ...t, gold_files: J(t.gold_files), tags: J(t.tags) })))

get('/api/tasks/:id', ({ id }) => {
  const task = row(db().prepare(`SELECT * FROM tasks WHERE id = ?`), id)
  if (!task) return null
  const trials = rows(
    db().prepare(`
    SELECT t.*, r.name AS run_name, r.model, r.scaffold
    FROM trials t JOIN runs r ON r.id=t.run_id WHERE t.task_id = ? ORDER BY r.started_at DESC`),
    id,
  )
  return {
    task: {
      ...task,
      gold_files: J(task.gold_files),
      fail_to_pass: J(task.fail_to_pass),
      pass_to_pass: J(task.pass_to_pass),
      tags: J(task.tags),
    },
    trials: trials.map((t) => ({ ...t, files_touched: J(t.files_touched) })),
  }
})

get('/api/trials', (_p, url) => {
  const w = []
  const args = []
  const add = (k, sql) => {
    const v = url.searchParams.get(k)
    if (v) {
      w.push(sql)
      args.push(v)
    }
  }
  add('run', 't.run_id = ?')
  add('task', 't.task_id = ?')
  add('status', 't.status = ?')
  add('failure', 't.failure_category = ?')
  const where = w.length ? `WHERE ${w.join(' AND ')}` : ''
  return rows(
    db().prepare(`
    SELECT t.*, r.name AS run_name, r.model, k.repo, k.difficulty, k.issue_title
    FROM trials t JOIN runs r ON r.id=t.run_id JOIN tasks k ON k.id=t.task_id
    ${where} ORDER BY t.started_at DESC LIMIT 500`),
    ...args,
  ).map((t) => ({ ...t, files_touched: J(t.files_touched) }))
})

get('/api/trials/:id', ({ id }) => {
  const trial = row(
    db().prepare(`
    SELECT t.*, r.name AS run_name, r.model, r.scaffold, r.scaffold_ver, r.max_steps, r.budget_usd, r.temperature
    FROM trials t JOIN runs r ON r.id=t.run_id WHERE t.id = ?`),
    id,
  )
  if (!trial) return null
  const task = row(db().prepare(`SELECT * FROM tasks WHERE id = ?`), trial.task_id)
  const spans = rows(db().prepare(`SELECT * FROM spans WHERE trial_id = ? ORDER BY seq`), id).map((s) => ({
    ...s,
    attrs: s.attrs ? JSON.parse(s.attrs) : null,
    kind: kindOf(s),
  }))
  const events = rows(db().prepare(`SELECT * FROM events WHERE trial_id = ? ORDER BY t_ms`), id)
  const annotations = rows(
    db().prepare(`SELECT * FROM annotations WHERE target_type='trial' AND target_id=? ORDER BY created_at DESC`),
    id,
  )
  // Sibling attempts at the same task, for one-click cross-run comparison.
  const siblings = rows(
    db().prepare(`
    SELECT t.id, t.run_id, t.status, t.failure_category, t.steps, t.cost_usd, t.duration_ms, r.name AS run_name
    FROM trials t JOIN runs r ON r.id=t.run_id WHERE t.task_id = ? AND t.id != ?`),
    trial.task_id,
    id,
  )
  return {
    trial: { ...trial, files_touched: J(trial.files_touched) },
    task: {
      ...task,
      gold_files: J(task.gold_files),
      fail_to_pass: J(task.fail_to_pass),
      pass_to_pass: J(task.pass_to_pass),
      tags: J(task.tags),
    },
    spans,
    events,
    annotations,
    siblings,
    failureMeta: trial.failure_category ? FAILURE_CATEGORIES[trial.failure_category] : null,
  }
})

get('/api/failures', (_p, url) => {
  const cat = url.searchParams.get('category')
  const byCat = rows(
    db().prepare(`
    SELECT failure_category AS category, COUNT(*) n,
           ROUND(AVG(steps),1) avg_steps, ROUND(AVG(cost_usd),3) avg_cost,
           ROUND(AVG(duration_ms)/1000.0,1) avg_sec
    FROM trials WHERE failure_category IS NOT NULL GROUP BY failure_category ORDER BY n DESC`),
  ).map((r) => ({ ...r, ...FAILURE_CATEGORIES[r.category] }))

  const matrix = rows(
    db().prepare(`
    SELECT run_id, failure_category AS category, COUNT(*) n
    FROM trials WHERE failure_category IS NOT NULL GROUP BY run_id, failure_category`),
  )
  const byRepo = rows(
    db().prepare(`
    SELECT k.repo, t.failure_category AS category, COUNT(*) n
    FROM trials t JOIN tasks k ON k.id=t.task_id
    WHERE t.failure_category IS NOT NULL GROUP BY k.repo, t.failure_category`),
  )
  const trials = rows(
    db().prepare(`
    SELECT t.id, t.run_id, t.task_id, t.failure_category, t.failure_summary, t.failure_span_id,
           t.steps, t.cost_usd, t.duration_ms, t.localized, r.name AS run_name, k.repo, k.difficulty
    FROM trials t JOIN runs r ON r.id=t.run_id JOIN tasks k ON k.id=t.task_id
    WHERE t.failure_category IS NOT NULL ${cat ? 'AND t.failure_category = ?' : ''}
    ORDER BY t.started_at DESC LIMIT 300`),
    ...(cat ? [cat] : []),
  )
  return { byCat, matrix, byRepo, trials, meta: FAILURE_CATEGORIES }
})

get('/api/search', (_p, url) => {
  const term = (url.searchParams.get('q') || '').trim()
  if (!term) return { term, hits: [] }
  const fts = term.replace(/["']/g, ' ')
  let hits = []
  try {
    hits = rows(
      db().prepare(`
      SELECT f.span_id, f.trial_id, s.name, s.type, s.status, s.step, s.target, s.start_ms,
             t.run_id, t.task_id, t.status AS trial_status,
             snippet(spans_fts, 5, '«', '»', ' … ', 14) AS snip_out,
             snippet(spans_fts, 6, '«', '»', ' … ', 14) AS snip_err
      FROM spans_fts f
      JOIN spans s ON s.id = f.span_id
      JOIN trials t ON t.id = f.trial_id
      WHERE spans_fts MATCH ?
      LIMIT 80`),
      `${fts}*`,
    )
  } catch {
    hits = []
  }
  return { term, hits }
})

get('/api/compare', (_p, url) => {
  const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 2)
  const out = ids.map((id) => {
    const trial = row(
      db().prepare(`
      SELECT t.*, r.name AS run_name, r.model, r.scaffold FROM trials t JOIN runs r ON r.id=t.run_id WHERE t.id=?`),
      id,
    )
    if (!trial) return null
    const spans = rows(db().prepare(`SELECT * FROM spans WHERE trial_id=? ORDER BY seq`), id).map((s) => ({
      ...s,
      attrs: s.attrs ? JSON.parse(s.attrs) : null,
      kind: kindOf(s),
    }))
    return { trial: { ...trial, files_touched: J(trial.files_touched) }, spans }
  })
  return { sides: out.filter(Boolean) }
})

// ------------------------------------------------- user traces (local only)
// Reads JSONL the user's own agent wrote. Deliberately read-only and confined
// to one directory: this server is meant to run on the developer's machine, and
// the traces it exposes contain their prompts and source.

const TRACE_DIR = process.env.AGENTLENS_TRACE_DIR || null

get('/api/local/traces', async () => {
  if (!TRACE_DIR) return { dir: null, files: [] }
  try {
    const names = (await readdir(TRACE_DIR)).filter((n) => n.endsWith('.jsonl') || n.endsWith('.json'))
    const files = []
    for (const name of names) {
      const st = await stat(join(TRACE_DIR, name))
      files.push({ name, bytes: st.size, modified: st.mtimeMs })
    }
    return { dir: TRACE_DIR, files: files.sort((a, b) => b.modified - a.modified) }
  } catch {
    return { dir: TRACE_DIR, files: [] }
  }
})

get('/api/local/traces/:name', async ({ name }) => {
  if (!TRACE_DIR) return null
  // Reject anything that is not a bare filename, so a crafted name cannot walk
  // out of the trace directory.
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null
  try {
    return { name, text: await readFile(join(TRACE_DIR, name), 'utf8') }
  } catch {
    return null
  }
})

get('/api/spans/:id', ({ id }) => {
  const s = row(db().prepare(`SELECT * FROM spans WHERE id=?`), id)
  if (!s) return null
  return { ...s, attrs: s.attrs ? JSON.parse(s.attrs) : null }
})

// ------------------------------------------------------------------- static

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

async function serveStatic(pathname, res) {
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let file = join(WEB_DIST, rel === '/' ? 'index.html' : rel)
  try {
    const st = await stat(file)
    if (st.isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(WEB_DIST, 'index.html') // SPA fallback
  }
  try {
    const buf = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Not found. Run `npm run build` first, or use `npm run dev`.')
  }
}

// -------------------------------------------------------------------- server

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'POST' && url.pathname === '/api/annotations') {
    let body = ''
    for await (const c of req) body += c
    try {
      const { target_type = 'trial', target_id, author = 'you', label = null, body: text } = JSON.parse(body || '{}')
      if (!target_id || !text) throw new Error('target_id and body are required')
      db()
        .prepare(`INSERT INTO annotations (target_type,target_id,author,label,body,created_at) VALUES (?,?,?,?,?,?)`)
        .run(target_type, target_id, author, label, text, Date.now())
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (e) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: String(e.message || e) }))
    }
    return
  }

  if (url.pathname.startsWith('/api/')) {
    for (const r of routes) {
      const m = url.pathname.match(r.rx)
      if (!m) continue
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
      try {
        const data = await r.handler(params, url)
        if (data === null || data === undefined) {
          res.writeHead(404, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: 'not found' }))
          return
        }
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        res.end(JSON.stringify(data))
      } catch (e) {
        console.error(`[api] ${url.pathname}`, e)
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: String(e.message || e) }))
      }
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'no such endpoint' }))
    return
  }

  await serveStatic(url.pathname, res)
})

// Port 0 asks the OS for a free port — used by the static export, which only
// needs to talk to itself.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`AgentLens API  http://127.0.0.1:${server.address().port}`)
})
