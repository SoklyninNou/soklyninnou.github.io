/**
 * A worked example, shipped so the how-to can populate the evaluator with one
 * click. Reading a filled-in dashboard teaches the concepts faster than reading
 * prose about them, and it separates "I have not instrumented anything yet"
 * from "my instrumentation is wrong" — the two states a newcomer cannot
 * otherwise tell apart.
 *
 * It is deliberately built to exercise every idea the page explains: nested
 * delegation (doc-reader inside researcher), one agent invoked more than once
 * (fixer, three times), a recovered tool error, and one trial of each verdict.
 */
import { localTraces } from './local-store'
import { parseTrace } from './trace-format'

export const SAMPLE_TRACE_ID = 'sample-trace'

export const SAMPLE_TRACE = `{"record":"run","id":"my-agent-v1","name":"my agent","model":"claude-opus-5"}
{"record":"trial","id":"trial-login","run_id":"my-agent-v1","task_id":"fix-login-bug"}
{"record":"span","id":"p1","trial_id":"trial-login","name":"plan","type":"llm","start_ms":0,"end_ms":2400,"step":1,"tokens_in":1200,"tokens_out":340,"cost_usd":0.012}
{"record":"span","id":"ra","trial_id":"trial-login","name":"researcher","type":"subagent","agent":"researcher","start_ms":2400,"end_ms":21800,"step":2,"tokens_in":4200,"tokens_out":900,"cost_usd":0.031}
{"record":"span","id":"r1","trial_id":"trial-login","parent_id":"ra","name":"grep","type":"tool","start_ms":2600,"end_ms":4100,"step":3,"target":"src/auth.ts","output":"3 matches"}
{"record":"span","id":"r2","trial_id":"trial-login","parent_id":"ra","name":"read_file","type":"tool","start_ms":4100,"end_ms":9800,"step":4,"target":"src/auth.ts","output":"export function login() {...}"}
{"record":"span","id":"dr","trial_id":"trial-login","parent_id":"ra","name":"doc-reader","type":"subagent","agent":"doc-reader","start_ms":9800,"end_ms":20100,"step":5,"tokens_in":2600,"tokens_out":400,"cost_usd":0.014}
{"record":"span","id":"d1","trial_id":"trial-login","parent_id":"dr","name":"read_file","type":"tool","start_ms":10000,"end_ms":19600,"step":6,"target":"docs/auth.md","output":"# Auth flow"}
{"record":"span","id":"fa","trial_id":"trial-login","name":"fixer","type":"subagent","agent":"fixer","start_ms":21800,"end_ms":39400,"step":7,"tokens_in":8800,"tokens_out":1500,"cost_usd":0.088}
{"record":"span","id":"f1","trial_id":"trial-login","parent_id":"fa","name":"str_replace","type":"tool","start_ms":22000,"end_ms":23100,"step":8,"target":"src/auth.ts","status":"error","error":"No match for the given string. Nearest match differs in leading whitespace."}
{"record":"span","id":"f2","trial_id":"trial-login","parent_id":"fa","name":"str_replace","type":"tool","start_ms":23100,"end_ms":24800,"step":9,"target":"src/auth.ts","output":"applied"}
{"record":"span","id":"t1","trial_id":"trial-login","name":"npm test","type":"test","start_ms":39400,"end_ms":52000,"step":10,"output":"12 passing"}
{"record":"result","trial_id":"trial-login","command":"npm test","exit_code":0}
{"record":"trial","id":"trial-cache","run_id":"my-agent-v1","task_id":"add-cache-layer"}
{"record":"span","id":"p2","trial_id":"trial-cache","name":"plan","type":"llm","start_ms":0,"end_ms":1900,"step":1,"tokens_in":900,"tokens_out":210,"cost_usd":0.008}
{"record":"span","id":"fb","trial_id":"trial-cache","name":"fixer","type":"subagent","agent":"fixer","start_ms":1900,"end_ms":14200,"step":2,"tokens_in":3100,"tokens_out":640,"cost_usd":0.022}
{"record":"span","id":"g1","trial_id":"trial-cache","parent_id":"fb","name":"write_file","type":"tool","start_ms":2100,"end_ms":3400,"step":3,"target":"src/cache.ts","output":"written"}
{"record":"span","id":"fc","trial_id":"trial-cache","name":"fixer","type":"subagent","agent":"fixer","start_ms":14200,"end_ms":26900,"step":4,"tokens_in":5400,"tokens_out":810,"cost_usd":0.041}
{"record":"span","id":"g2","trial_id":"trial-cache","parent_id":"fc","name":"str_replace","type":"tool","start_ms":14500,"end_ms":16000,"step":5,"target":"src/index.ts","status":"error","error":"No match for the given string."}
{"record":"span","id":"t2","trial_id":"trial-cache","name":"npm test","type":"test","start_ms":26900,"end_ms":38100,"step":6,"status":"error","error":"AssertionError: expected cache hit, got miss"}
{"record":"result","trial_id":"trial-cache","command":"npm test","exit_code":1,"stderr":"AssertionError: expected cache hit, got miss\\n  at test/cache.test.ts:24"}`

/** Import the sample under a fixed id, so loading it twice replaces rather than accumulates. */
export async function importSampleTrace(): Promise<void> {
  const { trace } = parseTrace(SAMPLE_TRACE)
  await localTraces.put({
    id: SAMPLE_TRACE_ID,
    label: 'sample-trace.jsonl',
    importedAt: Date.now(),
    sourceBytes: new Blob([SAMPLE_TRACE]).size,
    trace,
  })
}
