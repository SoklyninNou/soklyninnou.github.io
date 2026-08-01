# AgentLens

Observability and evaluation for software-engineering AI agents.

Two questions drive the whole product:

1. **What was the agent doing at a given moment?** — a span-level timeline with a
   scrubber, so any point in a run resolves to a concrete action on a concrete file.
2. **Where did it go wrong?** — every unresolved trial is assigned a cause by a
   detector that reads the trajectory, and that cause is pinned to the exact span
   that caused it.

The bundled dataset is **synthetic** — 5 agent configurations × 24 SWE-bench-style
instances = 120 trials and ~3,400 spans, generated deterministically. See
[Is the data real?](#is-the-data-real) before quoting any number from it.

## Quick start

```bash
cd agentlens && npm install && npm run dev
```

Then open http://localhost:5173. The first run seeds the database automatically.

Production mode builds the SPA and serves it from the API process on one port:

```bash
npm run build && npm start
```

| Script | What it does |
| --- | --- |
| `npm run dev` | API (`:5177`) + Vite dev server (`:5173`) together |
| `npm run seed` | Regenerate the database from scratch |
| `npm run build` | Typecheck and build the SPA |
| `npm start` | Serve API + built SPA on `:5177` |
| `npm run export` | Render every API response to JSON under `web/public/data/` |
| `npm run build:static` | Seed, export, and build a server-free bundle |

### Static hosting

`npm run build:static` produces a bundle that needs no server, for hosts that
cannot run one. `server/src/export-static.js` boots the real API in-process and
snapshots every endpoint to JSON, so the payloads are identical to production;
`web/src/lib/api.ts` then reads those files instead of `/api`. Query-parameter
endpoints are exported unfiltered and narrowed in the browser, FTS5 is replaced
by a scan over a flat span index, and review notes go to `localStorage` — the
one feature that is genuinely degraded, since there is nothing to write to.
Routing moves to the hash so deep links survive a host with no rewrites.

It defaults to `/agentlens/` on the site this repository is nested in; override
with `AGENTLENS_BASE` and `AGENTLENS_OUT`.

Requires Node ≥ 22.5 — the backend uses the built-in `node:sqlite`, so the server
has **zero runtime dependencies**. The frontend uses React, React Router, and Vite;
every chart is hand-rolled SVG, no charting library.

## The screens

**Overview** — resolve rate, spend, and the failure taxonomy across all runs.
Cost-vs-quality is a scatter with direct labels, so the frontier is readable at a glance.

**Runs** → **Run detail** — per-configuration drill-down: an outcome square per
instance, the failure mix, step/cost distributions, tool reliability, a phase band
showing where tool time goes across the trajectory, and an **agent behaviour graph**
that aggregates every action-to-action transition in the run. A fat self-loop on
`search` is a stalling agent; a thin edge into `test` is an agent that rarely verifies.

**Traces** → **Trace viewer** — the centrepiece:

- A waterfall of every span. Click the axis to move the playhead, drag it to zoom,
  click a bar to inspect. The failure span is outlined and the page opens on it.
- A readout that answers *"at 2:14 the agent was reading `helpers.py` (step 12)"*.
- Context-window occupancy against the model limit, and cumulative spend.
- A span inspector with the full prompt, output, error, and metadata.
- Review notes, persisted to the database.

**Compare** — two trials on a shared time scale, metric deltas, and an action-sequence
diff that highlights the first step where the two agents diverged.

**Failures** — the taxonomy, a cause × configuration heatmap (is this failure
model-specific or scaffold-specific?), a cause × repository heatmap, and every
affected trial with its one-line diagnosis.

**Tasks** — the suite ranked by solve rate. Instances no configuration solves are
the ones worth reading by hand.

**Search** — SQLite FTS5 across every tool input, output, and error message.
Searching `whitespace` surfaces the exact `str_replace` failures that cascaded.

**Your agent** — the one tab that does not read the bundled corpus. Import a
trace your own agent produced and it is analysed by *agent* rather than by run:
which subagent burned the budget, how much of a supervisor's time is real work
versus waiting on the helpers it spawned, and which delegation failed. See
[Instrumenting your own agent](#instrumenting-your-own-agent).

## Instrumenting your own agent

```bash
npx agentlens init     # VS Code tasks, a trace directory, and a .gitignore entry
```

Then emit spans. The SDK has no dependencies and appends synchronously, because
the run you most want to read is usually the one that got killed:

```js
import { Tracer } from 'agentlens/sdk'

const tracer = new Tracer({ file: '.agentlens/run.jsonl', run: { id: 'v1', model: 'claude-opus-5' } })
const trial = tracer.trial({ task_id: 'fix-login-bug' })

trial.span({ name: 'grep', target: 'src/auth.ts' }).end({ output: '3 matches' })

const researcher = trial.subagent('researcher')
researcher.span({ name: 'read_file', target: 'src/auth.ts' }).end()
researcher.end({ tokens_in: 4200, cost_usd: 0.031 })

await trial.grade('npm test')   // exit code 0 is a pass
```

Run the **AgentLens: open** task in VS Code (or `npx agentlens open`) and load the
trace from the *Your agent* tab.

### The format

JSONL, one record per line, four record types — `run`, `trial`, `span`,
`result`. Records may arrive in any order, so an emitter never has to buffer.
Nothing but `agentlens/sdk` is required to produce it; appending the lines
yourself is a supported path.

A **subagent is a span**, not a record type: give it `"type":"subagent"` and an
`agent` name, and everything whose `parent_id` chain reaches it is counted as
its work. You tag the delegation, not every span underneath it. Depth and
ownership are recomputed from the tree on import, so a trace cannot claim a
shape it does not have.

### Where the data lives

Traces stay on the machine that produced them. The *Your agent* tab parses them
in the browser and stores them in IndexedDB — chosen over `localStorage`
because real traces carry full prompts and file contents, and clear the ~5 MB
ceiling within a few runs. There is no upload path, and on the static
deployment there is no server that could receive one. `init` adds `.agentlens/`
to `.gitignore` for the same reason: a trace is a disclosure, not a build
artefact.

### What grading does and does not tell you

`trial.grade(cmd)` records an exit code. That is the whole definition of success
— AgentLens does not know what your agent was supposed to do. Runs with no
`result` record are shown as *ungraded* and excluded from the pass rate rather
than counted as passes.

The failure taxonomy below applies to the **bundled corpus only**. Those causes
are assigned by the generator and the trajectory is synthesised to match; there
is no detector that reads a real trace and infers a cause, so imported trials
carry no failure category. Tool errors, cost, and the timeline are measured
from your spans and are real.

## Failure taxonomy

The categories the app reasons in. Each one produces a *structurally different*
trace, which is what makes the timeline diagnostic rather than decorative:

| Cause | What the trace actually contains |
| --- | --- |
| `localization` | Greps that return nothing; reads confined to the wrong modules |
| `wrong_fix` | Right file edited, target test still red, repeated repair attempts |
| `regression` | Target test green, previously-passing tests now red |
| `context_overflow` | Unbounded file reads; context climbing until the call is rejected |
| `loop_stall` | The same search repeated with identical arguments |
| `tool_error_cascade` | Consecutive `str_replace` failures with no recovery |
| `premature_stop` | A submit span with zero test executions before it |
| `budget_exhausted` | Trajectory running to the step cap with no patch |
| `syntax_error` | A diff that does not parse; `SyntaxError` in the verify run |
| `hallucinated_api` | A call to a symbol that does not exist at this revision |
| `harness_error` | Container died — explicitly *not* attributable to the agent |

**Localization is tracked separately from resolution.** It is necessary but not
sufficient, so the gap between the two is the readable signal: high localization
with low resolve rate is a reasoning problem, low localization is a search problem.
That gap is what the BM25-retrieval configuration in the dataset exists to probe.

## Architecture

```
agentlens/
├── dev.mjs                  # runs API + web together
├── server/
│   ├── data/agentlens.db    # generated; safe to delete
│   └── src/
│       ├── db.js            # node:sqlite schema (runs/tasks/trials/spans/events/FTS5)
│       ├── corpus.js        # benchmark instances, run configs, failure taxonomy
│       ├── generate.js      # trajectory generator — failure shapes the trace
│       ├── analysis.js      # flow graph, phase profile, histograms, percentiles
│       ├── seed.js          # populates the database
│       └── server.js        # zero-dependency HTTP API + static serving
└── web/src/
    ├── lib/                 # api client + types, formatting, colour assignment
    ├── components/          # chart primitives, Waterfall, FlowGraph, UI
    └── pages/               # one file per screen
```

The data model is span-based and OpenTelemetry-shaped, so pointing this at a real
agent means writing an exporter into the `spans` table rather than changing the UI:

- `runs` — one agent configuration swept across a suite
- `tasks` — benchmark instances with gold files and gating tests
- `trials` — one attempt at one task, with the verdict and diagnosed cause
- `spans` — the work tree (`parent_id`) and timeline (`start_ms`), typed
  `llm | tool | test | patch | system`
- `events` — point-in-time signals rendered as timeline markers
- `annotations` — human review layered over automated verdicts

### API

`GET /api/overview · /api/runs · /api/runs/:id · /api/tasks · /api/tasks/:id ·
/api/trials · /api/trials/:id · /api/failures · /api/search?q= · /api/compare?ids=`
and `POST /api/annotations`.

## Design notes

Colour follows the entity, never its rank, so filtering a chart never repaints the
survivors. Categorical hues are used in a fixed, validated order and never cycled —
the failure taxonomy has 11 members and 8 slots, so the tail folds into a neutral
"Other" rather than inventing a 9th hue. Status colours are reserved and always ship
with a glyph and a word, never colour alone. There are no dual-axis charts anywhere;
context and spend are two charts precisely because they are two scales.

The span-kind palette maps to *consecutive* palette slots on purpose: only adjacent
slots are validated as a colourblind-safe pair, and mapping edit/test to
non-consecutive slots would place orange beside yellow in every stacked chart —
the one pair in this palette that fails CVD separation.

Light and dark are both first-class; dark is a selected set of steps, not an
inversion. The theme toggle is in the top bar. `/` or `⌘K` focuses search.

## Is the data real?

No. `server/src/generate.js` synthesises every trajectory from a fixed seed
(`AGENTLENS_SEED`, default `20260729`), so the dataset is reproducible but invented.
Task IDs, repositories, and issue text are modelled on real SWE-bench instances;
the numbers attached to them are not measurements. Resolve rates, costs, and
latencies were tuned to make the product legible — **do not cite them as model
benchmarks.**

What is real is the plumbing: the schema, the API, the detectors, and the UI all
operate on ordinary span data and would work unchanged against a live agent.

To point it at real traces, replace `seed.js` with an exporter that writes into the
same tables. `generate.js` is then only useful as a fixture for tests.
