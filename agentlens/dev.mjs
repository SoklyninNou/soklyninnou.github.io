/** Runs the API and the Vite dev server together, with one Ctrl-C to stop both. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

if (!existsSync(join(root, 'server', 'data', 'agentlens.db'))) {
  console.log('No database found — seeding first…\n')
  const seed = spawn(process.execPath, [join(root, 'server', 'src', 'seed.js')], { stdio: 'inherit' })
  seed.on('exit', start)
} else {
  start()
}

function start(code) {
  if (code) process.exit(code)
  // Strip PORT from the API's environment: it belongs to the web server.
  const apiEnv = { ...process.env, AGENTLENS_API_PORT: process.env.AGENTLENS_API_PORT || '5177' }
  delete apiEnv.PORT

  const procs = [
    spawn(process.execPath, [join(root, 'server', 'src', 'server.js')], { stdio: 'inherit', env: apiEnv }),
    spawn('npm', ['run', 'dev'], { cwd: join(root, 'web'), stdio: 'inherit' }),
  ]
  const kill = () => procs.forEach((p) => !p.killed && p.kill('SIGTERM'))
  process.on('SIGINT', () => (kill(), process.exit(0)))
  process.on('SIGTERM', () => (kill(), process.exit(0)))
  procs.forEach((p) => p.on('exit', (c) => c && (kill(), process.exit(c))))
}
