#!/usr/bin/env node
/**
 * The command users actually run.
 *
 * `init` wires a project up: VS Code tasks that open AgentLens in the editor's
 * own browser pane, a gitignore entry so traces containing prompts and file
 * contents are never committed by accident, and the snippet to paste into the
 * agent.
 *
 * `open` starts the local server and points at the trace directory. Traces stay
 * on the machine that produced them — there is no upload path, by design.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const TRACE_DIR = '.agentlens'

const [cmd = 'help', ...rest] = process.argv.slice(2)
const cwd = process.cwd()

const SNIPPET = `import { Tracer } from 'agentlens/sdk'

const tracer = new Tracer({
  file: '${TRACE_DIR}/run.jsonl',
  run: { id: 'my-agent-v1', model: 'claude-opus-5' },
})

const trial = tracer.trial({ task_id: 'fix-login-bug' })

// Wrap each tool call
const span = trial.span({ name: 'grep', type: 'tool', target: 'src/auth.ts' })
span.end({ output: '3 matches' })

// Wrap a subagent; its work nests underneath automatically
const researcher = trial.subagent('researcher')
researcher.span({ name: 'read_file', target: 'src/auth.ts' }).end()
researcher.end()

// Grade the attempt — exit code 0 is a pass
await trial.grade('npm test')`

const TASKS = {
  version: '2.0.0',
  tasks: [
    {
      label: 'AgentLens: open',
      type: 'shell',
      command: 'npx agentlens open',
      problemMatcher: [],
      presentation: { reveal: 'silent', panel: 'dedicated' },
      runOptions: { instanceLimit: 1 },
    },
    {
      label: 'AgentLens: clear traces',
      type: 'shell',
      command: `rm -rf ${TRACE_DIR}/*.jsonl`,
      problemMatcher: [],
    },
  ],
}

function writeJsonIfAbsent(path, value, label) {
  if (existsSync(path)) {
    console.log(`  kept    ${label} (already exists)`)
    return
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
  console.log(`  wrote   ${label}`)
}

function init() {
  console.log(`\nSetting up AgentLens in ${cwd}\n`)

  writeJsonIfAbsent(join(cwd, '.vscode', 'tasks.json'), TASKS, '.vscode/tasks.json')

  mkdirSync(join(cwd, TRACE_DIR), { recursive: true })
  console.log(`  wrote   ${TRACE_DIR}/`)

  // Traces carry prompts, model output, and file contents. Committing one is a
  // disclosure, not a mess, so this entry matters more than the usual ignore.
  const gitignore = join(cwd, '.gitignore')
  const entry = `${TRACE_DIR}/`
  const current = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
  if (!current.split(/\r?\n/).some((l) => l.trim() === entry)) {
    writeFileSync(gitignore, `${current}${current.endsWith('\n') || !current ? '' : '\n'}\n# Agent traces contain prompts and file contents — keep them local.\n${entry}\n`)
    console.log('  wrote   .gitignore entry')
  } else {
    console.log('  kept    .gitignore entry (already present)')
  }

  console.log(`\nNext: instrument your agent.\n`)
  console.log(SNIPPET.split('\n').map((l) => '  ' + l).join('\n'))
  console.log(`\nThen run the "AgentLens: open" task in VS Code (⇧⌘P → Tasks: Run Task),`)
  console.log(`or \`npx agentlens open\` here, and load ${TRACE_DIR}/run.jsonl from the "Your agent" tab.\n`)
}

function open() {
  const dist = join(ROOT, 'web', 'dist')
  if (!existsSync(dist)) {
    console.error('The UI has not been built yet. Run `npm run build` in the agentlens directory first.')
    process.exit(1)
  }
  const traceDir = resolve(cwd, rest[0] || TRACE_DIR)
  console.log(`Serving AgentLens — traces from ${traceDir}`)
  const child = spawn(process.execPath, [join(ROOT, 'server', 'src', 'server.js')], {
    stdio: 'inherit',
    env: { ...process.env, AGENTLENS_TRACE_DIR: traceDir },
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}

function help() {
  console.log(`
AgentLens — observability and evaluation for coding agents

  npx agentlens init          Wire up VS Code tasks and a trace directory here
  npx agentlens open [dir]    Serve the UI, reading traces from [dir] (default ${TRACE_DIR})

Traces never leave this machine.
`)
}

if (cmd === 'init') init()
else if (cmd === 'open') open()
else help()
