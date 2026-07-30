import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = join(__dirname, '..', 'data')
export const DB_PATH = process.env.AGENTLENS_DB || join(DATA_DIR, 'agentlens.db')

export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- An evaluation run: one agent configuration swept across a benchmark suite.
CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  suite         TEXT NOT NULL,
  model         TEXT NOT NULL,
  scaffold      TEXT NOT NULL,
  scaffold_ver  TEXT,
  temperature   REAL,
  max_steps     INTEGER,
  budget_usd    REAL,
  git_sha       TEXT,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT NOT NULL,          -- running | complete | aborted
  notes         TEXT
);

-- A benchmark instance: a real repository issue with tests that gate the fix.
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,       -- e.g. django__django-11099
  repo          TEXT NOT NULL,
  language      TEXT NOT NULL,
  issue_title   TEXT NOT NULL,
  issue_body    TEXT NOT NULL,
  base_commit   TEXT NOT NULL,
  difficulty    TEXT NOT NULL,          -- easy | medium | hard
  gold_files    TEXT NOT NULL,          -- JSON array of paths the reference patch edits
  gold_patch    TEXT,
  fail_to_pass  TEXT NOT NULL,          -- JSON array of test ids
  pass_to_pass  TEXT NOT NULL,          -- JSON array of test ids
  tags          TEXT                    -- JSON array
);

-- One agent attempt at one task inside one run.
CREATE TABLE IF NOT EXISTS trials (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id           TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status            TEXT NOT NULL,      -- resolved | unresolved | errored | timeout
  started_at        INTEGER NOT NULL,
  duration_ms       INTEGER NOT NULL,
  steps             INTEGER NOT NULL,
  tokens_in         INTEGER NOT NULL,
  tokens_out        INTEGER NOT NULL,
  tokens_cached     INTEGER NOT NULL,
  cost_usd          REAL NOT NULL,
  context_peak_pct  REAL NOT NULL,
  context_limit     INTEGER NOT NULL,
  tool_calls        INTEGER NOT NULL,
  tool_errors       INTEGER NOT NULL,
  files_touched     TEXT NOT NULL,      -- JSON array
  patch             TEXT,
  patch_added       INTEGER NOT NULL DEFAULT 0,
  patch_removed     INTEGER NOT NULL DEFAULT 0,
  f2p_passed        INTEGER NOT NULL DEFAULT 0,
  f2p_total         INTEGER NOT NULL DEFAULT 0,
  p2p_passed        INTEGER NOT NULL DEFAULT 0,
  p2p_total         INTEGER NOT NULL DEFAULT 0,
  failure_category  TEXT,               -- null when resolved
  failure_summary   TEXT,
  failure_span_id   TEXT,               -- the span where it went wrong
  localized         INTEGER NOT NULL DEFAULT 0,  -- did it ever open a gold file
  first_edit_ms     INTEGER,
  UNIQUE (run_id, task_id)
);

-- A unit of agent work. Spans form a tree via parent_id and a timeline via start_ms.
CREATE TABLE IF NOT EXISTS spans (
  id            TEXT PRIMARY KEY,
  trial_id      TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
  parent_id     TEXT,
  seq           INTEGER NOT NULL,       -- global order within the trial
  step          INTEGER NOT NULL,       -- agent turn number
  depth         INTEGER NOT NULL,
  type          TEXT NOT NULL,          -- llm | tool | think | subagent | test | patch | system
  name          TEXT NOT NULL,          -- bash, str_replace, read_file, grep, ...
  status        TEXT NOT NULL,          -- ok | error | warn
  start_ms      INTEGER NOT NULL,       -- relative to trial start
  end_ms        INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL,
  model         TEXT,
  tokens_in     INTEGER NOT NULL DEFAULT 0,
  tokens_out    INTEGER NOT NULL DEFAULT 0,
  tokens_cached INTEGER NOT NULL DEFAULT 0,
  cost_usd      REAL NOT NULL DEFAULT 0,
  ctx_used      INTEGER NOT NULL DEFAULT 0,  -- context window occupancy after this span
  input         TEXT,
  output        TEXT,
  error         TEXT,
  target        TEXT,                   -- file path / command / test id this span acts on
  attrs         TEXT                    -- JSON
);

CREATE INDEX IF NOT EXISTS idx_spans_trial     ON spans(trial_id, seq);
CREATE INDEX IF NOT EXISTS idx_spans_parent    ON spans(parent_id);
CREATE INDEX IF NOT EXISTS idx_spans_type      ON spans(type, name);
CREATE INDEX IF NOT EXISTS idx_spans_status    ON spans(status);
CREATE INDEX IF NOT EXISTS idx_trials_run      ON trials(run_id);
CREATE INDEX IF NOT EXISTS idx_trials_task     ON trials(task_id);
CREATE INDEX IF NOT EXISTS idx_trials_failure  ON trials(failure_category);

-- Point-in-time signals the timeline renders as markers.
CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  trial_id  TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
  span_id   TEXT,
  t_ms      INTEGER NOT NULL,
  level     TEXT NOT NULL,              -- info | warn | error
  kind      TEXT NOT NULL,              -- retry | context_pressure | test_run | edit | stall | budget
  message   TEXT NOT NULL,
  data      TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_trial ON events(trial_id, t_ms);

-- Human review layered on top of automated verdicts.
CREATE TABLE IF NOT EXISTS annotations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,            -- trial | span
  target_id   TEXT NOT NULL,
  author      TEXT NOT NULL,
  label       TEXT,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_annotations_target ON annotations(target_type, target_id);

-- Full-text search across span payloads.
CREATE VIRTUAL TABLE IF NOT EXISTS spans_fts USING fts5(
  span_id UNINDEXED,
  trial_id UNINDEXED,
  name,
  target,
  input,
  output,
  error,
  tokenize = 'porter unicode61'
);
`

let _db = null

export function db() {
  if (_db) return _db
  mkdirSync(DATA_DIR, { recursive: true })
  _db = new DatabaseSync(DB_PATH)
  _db.exec(SCHEMA)
  return _db
}

export function resetDb() {
  const d = db()
  d.exec(`
    DROP TABLE IF EXISTS spans_fts;
    DROP TABLE IF EXISTS annotations;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS spans;
    DROP TABLE IF EXISTS trials;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS runs;
  `)
  d.exec(SCHEMA)
  return d
}

/** Rows come back as null-prototype objects; give them a normal prototype. */
export function rows(stmt, ...args) {
  return stmt.all(...args).map((r) => ({ ...r }))
}

export function row(stmt, ...args) {
  const r = stmt.get(...args)
  return r ? { ...r } : null
}
