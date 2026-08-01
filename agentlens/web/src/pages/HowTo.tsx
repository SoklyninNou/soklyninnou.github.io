/**
 * How to evaluate your own agent.
 *
 * Ordered by what a newcomer does, not by how the system is built: see it
 * working, wire it up, then learn to read it. The "load the sample" button
 * comes first on purpose — a populated dashboard explains self-versus-total
 * time in about two seconds, and prose about it takes a paragraph.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CodeBlock } from '../components/ui'
import { importSampleTrace } from '../lib/sample-trace'

const INSTALL = `# in your agent's project
npx agentlens init`

const MINIMAL = `import { Tracer } from 'agentlens/sdk'

const tracer = new Tracer({
  file: '.agentlens/run.jsonl',
  run: { id: 'my-agent-v1', model: 'claude-opus-5' },
})

// One attempt at one task.
const trial = tracer.trial({ task_id: 'fix-login-bug' })

// ... your agent runs ...

// Exit code 0 is a pass. This is the whole definition of success.
await trial.grade('npm test')`

const TOOLS = `// Wrap each tool call so it lands on the timeline.
const span = trial.span({ name: 'grep', type: 'tool', target: 'src/auth.ts' })
const result = await runGrep('login')
span.end({ output: result })

// Report failures — this is what the tool-error column counts.
const edit = trial.span({ name: 'str_replace', target: 'src/auth.ts' })
try {
  await applyEdit()
  edit.end({ output: 'applied' })
} catch (err) {
  edit.end({ error: String(err) })
}

// Attach model usage wherever you have it.
const think = trial.span({ name: 'plan', type: 'llm' })
think.end({ tokens_in: 1200, tokens_out: 340, cost_usd: 0.012 })`

const SUBAGENTS = `// Open a subagent. Everything created through it is attributed to it —
// you tag the delegation, not every span underneath.
const researcher = trial.subagent('researcher')

researcher.span({ name: 'grep', target: 'src/auth.ts' }).end()
researcher.span({ name: 'read_file', target: 'src/auth.ts' }).end()

// Subagents nest. Pass a parent to spawn one inside another.
const docs = trial.subagent('doc-reader', { parent: researcher })
docs.span({ name: 'read_file', target: 'docs/auth.md' }).end()
docs.end({ tokens_in: 2600, cost_usd: 0.014 })

// Close it with its own model usage — the tokens it spent deciding.
researcher.end({ tokens_in: 4200, cost_usd: 0.031 })`

const RAW = `{"record":"run","id":"my-agent-v1","model":"claude-opus-5"}
{"record":"trial","id":"t1","run_id":"my-agent-v1","task_id":"fix-login-bug"}
{"record":"span","id":"s1","trial_id":"t1","name":"plan","type":"llm","start_ms":0,"end_ms":2400,"cost_usd":0.012}
{"record":"span","id":"s2","trial_id":"t1","name":"researcher","type":"subagent","agent":"researcher","start_ms":2400,"end_ms":21800}
{"record":"span","id":"s3","trial_id":"t1","parent_id":"s2","name":"grep","type":"tool","start_ms":2600,"end_ms":4100,"target":"src/auth.ts"}
{"record":"result","trial_id":"t1","command":"npm test","exit_code":0}`

const PYTHON = `import json, time

class Trace:
    def __init__(self, path, run_id):
        self.f = open(path, "a")
        self.t0 = time.time()
        self.run_id = run_id
        self.write(record="run", id=run_id)

    def write(self, **rec):
        self.f.write(json.dumps(rec) + "\\n")
        self.f.flush()          # append as you go; a killed run stays readable

    def ms(self):
        return int((time.time() - self.t0) * 1000)

t = Trace(".agentlens/run.jsonl", "my-agent-v1")
t.write(record="trial", id="t1", run_id=t.run_id, task_id="fix-login-bug")

start = t.ms()
# ... run a tool ...
t.write(record="span", id="s1", trial_id="t1", name="grep", type="tool",
        start_ms=start, end_ms=t.ms(), target="src/auth.ts")

t.write(record="result", trial_id="t1", command="pytest", exit_code=0)`

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="hstack" style={{ gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
        <span
          className="mono"
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: 'var(--series-1)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            flex: '0 0 auto',
          }}
        >
          {n}
        </span>
        <h3 className="card-title" style={{ margin: 0 }}>
          {title}
        </h3>
      </div>
      <div className="vstack" style={{ gap: 12 }}>{children}</div>
    </Card>
  )
}

export default function HowTo() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)

  async function loadSample() {
    setLoading(true)
    try {
      await importSampleTrace()
      nav('/evaluate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Evaluating your own agent</h1>
          <p className="page-sub">
            AgentLens can read traces from any agent, not just the bundled corpus. Emit a line per step, grade the
            attempt with a test command, and get a per-agent breakdown of where the time and budget went. Everything
            stays on your machine.
          </p>
        </div>
      </div>

      <Card title="Start here" note="no setup required">
        <div className="vstack" style={{ gap: 10 }}>
          <p className="muted" style={{ margin: 0 }}>
            Load a worked example into the evaluator. It has two trials, three subagents, nested delegation, and one
            failure — every idea below, already populated. Nothing is written outside your browser.
          </p>
          <div className="hstack" style={{ gap: 10 }}>
            <button className="btn primary" onClick={loadSample} disabled={loading}>
              {loading ? 'Loading…' : 'Load the sample trace →'}
            </button>
            <span className="muted small">Opens the “Your agent” tab</span>
          </div>
        </div>
      </Card>

      <Step n={1} title="Set up your project">
        <p className="muted" style={{ margin: 0 }}>
          Run this where your agent lives. It writes a VS Code task, creates <span className="mono">.agentlens/</span>,
          and adds it to <span className="mono">.gitignore</span> — traces contain your prompts and source, so
          committing one is a disclosure rather than a mess.
        </p>
        <CodeBlock text={INSTALL} />
      </Step>

      <Step n={2} title="Record a trial and grade it">
        <p className="muted" style={{ margin: 0 }}>
          The smallest useful trace is a trial plus a verdict. Start here and add detail once it shows up in the tab.
        </p>
        <CodeBlock text={MINIMAL} />
        <div className="note">
          <div className="note-body">
            <b>Grading is only an exit code.</b> AgentLens does not know what your agent was supposed to do — the
            command you pass decides. Trials with no <span className="mono">grade()</span> call show as{' '}
            <i>ungraded</i> and are left out of the pass rate rather than counted as passes.
          </div>
        </div>
      </Step>

      <Step n={3} title="Wrap your tool calls">
        <p className="muted" style={{ margin: 0 }}>
          Each span becomes a bar on the timeline. Pass <span className="mono">error</span> instead of{' '}
          <span className="mono">output</span> when a call fails — that is what the tool-error rate counts, and it is
          usually the first thing that explains a bad run.
        </p>
        <CodeBlock text={TOOLS} />
      </Step>

      <Step n={4} title="Mark your subagents">
        <p className="muted" style={{ margin: 0 }}>
          This is the part worth getting right. A subagent is a span, not a separate concept: open one, and every span
          created through it is credited to it automatically, however deep it goes.
        </p>
        <CodeBlock text={SUBAGENTS} />
        <div className="note">
          <div className="note-body">
            Ownership is recomputed from the parent chain when the trace is read, so a trace cannot claim a shape it
            does not have. If a subagent shows no work, its child spans were not created through its handle.
          </div>
        </div>
      </Step>

      <Step n={5} title="Open the results">
        <p className="muted" style={{ margin: 0 }}>
          In VS Code: <span className="mono">⇧⌘P</span> → <i>Tasks: Run Task</i> → <b>AgentLens: open</b>. Or run{' '}
          <span className="mono">npx agentlens open</span> yourself. Then pick your trace in the{' '}
          <span className="linkish" onClick={() => nav('/evaluate')}>
            Your agent
          </span>{' '}
          tab — or drag the <span className="mono">.jsonl</span> file straight onto it, which works even with no server
          running.
        </p>
      </Step>

      <Card title="Reading the results" note="what each number means">
        <div className="vstack" style={{ gap: 14 }}>
          <div>
            <div className="toolbar-label">Self time vs total time</div>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              The most useful column pair. <b>Self</b> is an agent's own spans; <b>total</b> includes everything it
              delegated. A supervisor with 7s self and 27s total is not slow — it is waiting on the agents it spawned,
              and the 20s gap is where to look. Reading total alone makes every orchestrator look like the bottleneck.
            </p>
          </div>
          <div>
            <div className="toolbar-label">Calls</div>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              How many times that agent was invoked across the whole trace. An agent called three times appears once in
              the table with its costs summed, but as three separate rows in <b>Delegation</b> — so you can tell one
              expensive call from three cheap ones.
            </p>
          </div>
          <div>
            <div className="toolbar-label">Tool errors</div>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Failed tool spans over attempted ones, per agent. A high rate on one agent and not others points at that
              agent's prompt or tool definitions rather than at the model.
            </p>
          </div>
          <div>
            <div className="toolbar-label">Pass rate</div>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Graded trials that exited zero. The denominator is graded trials only — if it reads “1 of 2 graded” while
              you ran ten, eight are missing a <span className="mono">result</span> record.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Without the SDK" note="any language">
        <div className="vstack" style={{ gap: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            The SDK is Node-only, but the format is the contract — appending the lines yourself is fully supported.
            Four record types, any order, one JSON object per line.
          </p>
          <CodeBlock text={RAW} />
          <div>
            <div className="toolbar-label" style={{ marginBottom: 6 }}>
              Python, in about twenty lines
            </div>
            <CodeBlock text={PYTHON} tall />
          </div>
          <div className="note">
            <div className="note-body">
              <span className="mono">start_ms</span> and <span className="mono">end_ms</span> are milliseconds from the
              start of the <i>trial</i>, not wall-clock timestamps. Getting this wrong is the usual cause of a timeline
              where every bar is stacked at zero.
            </div>
          </div>
        </div>
      </Card>

      <Card title="When it looks wrong" note="the usual causes">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>What you see</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Every bar at 0ms</td>
                <td>
                  <span className="mono">start_ms</span>/<span className="mono">end_ms</span> are timestamps, not
                  offsets from the trial start.
                </td>
              </tr>
              <tr>
                <td>No delegation section</td>
                <td>
                  No spans with <span className="mono">"type":"subagent"</span>. All work is credited to the
                  orchestrator.
                </td>
              </tr>
              <tr>
                <td>A subagent with no work</td>
                <td>Its child spans were created on the trial rather than through the subagent handle.</td>
              </tr>
              <tr>
                <td>Pass rate reads “—”</td>
                <td>
                  No <span className="mono">result</span> records, so nothing has been graded.
                </td>
              </tr>
              <tr>
                <td>Costs all $0.000</td>
                <td>
                  <span className="mono">cost_usd</span> was never passed to <span className="mono">end()</span>. Tokens
                  are not priced automatically — models change too often for a built-in table to stay honest.
                </td>
              </tr>
              <tr>
                <td>“No trials found”</td>
                <td>
                  Every line failed to parse. The import panel lists the offending line numbers.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="What this does not do" note="worth knowing up front">
        <div className="vstack" style={{ gap: 8 }}>
          <p className="muted small" style={{ margin: 0 }}>
            <b>No failure taxonomy on your traces.</b> The eleven causes elsewhere in this app apply to the bundled
            corpus, where the cause is known before the trace is generated. Nothing infers a cause from a real
            trajectory, so imported trials carry no category. Tool errors, cost, and the timeline are measured from
            your spans and are real.
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            <b>No localization or patch analysis.</b> Those need gold files and gating tests, which a custom task does
            not have.
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            <b>Nothing leaves your machine.</b> Traces are parsed in the browser and held in IndexedDB. There is no
            upload path, and on the hosted build there is no server that could receive one. Clearing site data deletes
            them.
          </p>
        </div>
      </Card>
    </div>
  )
}
