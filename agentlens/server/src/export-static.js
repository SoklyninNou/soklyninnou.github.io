/**
 * Renders every API response to a static JSON tree, so the SPA can be hosted on
 * a static host (GitHub Pages) with no server process.
 *
 * The real API is booted in-process and the payloads are fetched through it, so
 * what ships is byte-identical to what `npm start` would serve. Endpoints that
 * take query parameters (`/api/trials?run=`, `/api/failures?category=`,
 * `/api/compare?ids=`) are exported unfiltered and narrowed client-side; search
 * gets a flat span index in place of FTS5.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, rows } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', 'web', 'public', 'data')

// Bind an ephemeral port: nothing else needs to reach this server, and a fixed
// one would collide with a dev API already running.
process.env.AGENTLENS_API_PORT = '0'
const { server } = await import('./server.js')

const port = await new Promise((resolve) =>
  server.listening
    ? resolve(server.address().port)
    : server.once('listening', () => resolve(server.address().port)),
)
const BASE = `http://127.0.0.1:${port}`
let bytes = 0
let files = 0

async function write(rel, data) {
  const file = join(OUT, rel)
  await mkdir(dirname(file), { recursive: true })
  const json = JSON.stringify(data)
  await writeFile(file, json)
  bytes += Buffer.byteLength(json)
  files++
}

/** Fetch an endpoint through the live API and persist it as a file. */
async function snapshot(endpoint, rel) {
  const r = await fetch(`${BASE}${endpoint}`, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${endpoint}`)
  await write(rel, await r.json())
}

await rm(OUT, { recursive: true, force: true })

const ids = (sql) => rows(db().prepare(sql)).map((r) => r.id)
const runIds = ids(`SELECT id FROM runs`)
const taskIds = ids(`SELECT id FROM tasks`)
const trialIds = ids(`SELECT id FROM trials`)

await Promise.all([
  snapshot('/api/meta', 'meta.json'),
  snapshot('/api/overview', 'overview.json'),
  snapshot('/api/runs', 'runs.json'),
  snapshot('/api/tasks', 'tasks.json'),
  snapshot('/api/trials', 'trials.json'),
  snapshot('/api/failures', 'failures.json'),
])

for (const id of runIds) await snapshot(`/api/runs/${encodeURIComponent(id)}`, `runs/${id}.json`)
for (const id of taskIds) await snapshot(`/api/tasks/${encodeURIComponent(id)}`, `tasks/${id}.json`)
for (const id of trialIds) await snapshot(`/api/trials/${encodeURIComponent(id)}`, `trials/${id}.json`)

// The search index stands in for the FTS5 table: the same columns the /api/search
// query returns, with the raw text the client matches against and snippets from.
await write(
  'search.json',
  rows(
    db().prepare(`
    SELECT s.id AS span_id, s.trial_id, s.name, s.type, s.status, s.step, s.target, s.start_ms,
           s.input, s.output, s.error,
           t.run_id, t.task_id, t.status AS trial_status
    FROM spans s JOIN trials t ON t.id = s.trial_id
    ORDER BY s.trial_id, s.seq`),
  ),
)

console.log(`Exported ${files} files (${(bytes / 1e6).toFixed(2)} MB) to ${OUT}`)
process.exit(0)
