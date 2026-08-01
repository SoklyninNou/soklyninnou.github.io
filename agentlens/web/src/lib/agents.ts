/**
 * Attributing work to agents.
 *
 * A multi-agent run is only legible if every span can be traced to whichever
 * agent performed it. Rather than require the emitter to tag all of them —
 * which it would get wrong the moment a helper spawns its own helper — the
 * owning agent is derived from the span tree: walk up `parent_id` to the
 * nearest `subagent` span, and that is who did the work. Reaching the root
 * means the orchestrator did it directly.
 *
 * The distinction that matters for cost is total versus self time. A supervisor
 * that delegates everything has a huge total and almost no self time; reading
 * only the total would make it look like the bottleneck when it is really just
 * the thing waiting.
 */
import type { Span } from './api'

export const ROOT_AGENT = 'orchestrator'

export interface AgentStats {
  /** Display name: the `agent` attribute of the subagent span, or its name. */
  name: string
  /** How many times this agent was invoked. 1 for the orchestrator. */
  invocations: number
  spans: number
  /** Tool, test and patch spans — work attempted, as opposed to thinking. */
  calls: number
  errors: number
  errorRate: number
  tokensIn: number
  tokensOut: number
  cost: number
  /** Wall time of this agent's own spans, excluding delegated work. */
  selfMs: number
  /** Wall time including everything it delegated. */
  totalMs: number
  /** Nesting level: 0 for the orchestrator, 1 for the agents it spawns. */
  depth: number
  /** Agent names this one invoked directly. */
  delegatesTo: string[]
}

export interface DelegationNode {
  /** Span id of the subagent call, or `ROOT_AGENT` for the orchestrator. */
  id: string
  name: string
  depth: number
  durationMs: number
  cost: number
  status: Span['status']
  children: DelegationNode[]
}

const isWork = (s: Span) => s.type === 'tool' || s.type === 'test' || s.type === 'patch'

/** The label a subagent span presents itself under. */
export function agentName(span: Span): string {
  const tagged = span.attrs?.agent
  return typeof tagged === 'string' && tagged.trim() ? tagged.trim() : span.name
}

/**
 * Map every span to the *invocation* that performed it — the id of the nearest
 * enclosing subagent span, or ROOT_AGENT.
 *
 * Keyed by span id rather than agent name so that an agent invoked twice keeps
 * its two invocations distinct; collapsing to the name here would make both
 * calls report the combined cost of each. Cycles are treated as roots rather
 * than followed, so a malformed trace degrades to wrong attribution instead of
 * hanging the tab.
 */
export function attributeToInvocation(spans: Span[]): Map<string, string> {
  const byId = new Map(spans.map((s) => [s.id, s]))
  const owner = new Map<string, string>()

  const resolve = (span: Span, seen: Set<string>): string => {
    const cached = owner.get(span.id)
    if (cached) return cached
    if (seen.has(span.id)) return ROOT_AGENT
    seen.add(span.id)

    // A subagent span is the boundary: the work inside belongs to it, but the
    // call itself belongs to whoever made it.
    let result: string
    const parent = span.parent_id ? byId.get(span.parent_id) : undefined
    if (!parent) result = ROOT_AGENT
    else if (parent.type === 'subagent') result = parent.id
    else result = resolve(parent, seen)

    owner.set(span.id, result)
    return result
  }

  for (const s of spans) resolve(s, new Set())
  return owner
}

/** Map every span to the display name of the agent that performed it. */
export function attributeSpans(spans: Span[]): Map<string, string> {
  const byId = new Map(spans.map((s) => [s.id, s]))
  const byInvocation = attributeToInvocation(spans)
  const out = new Map<string, string>()
  for (const [spanId, ownerId] of byInvocation) {
    const ownerSpan = ownerId === ROOT_AGENT ? undefined : byId.get(ownerId)
    out.set(spanId, ownerSpan ? agentName(ownerSpan) : ROOT_AGENT)
  }
  return out
}

/** Per-agent rollups, orchestrator first and then by cost. */
export function agentStats(spans: Span[]): AgentStats[] {
  const owner = attributeSpans(spans)
  const byId = new Map(spans.map((s) => [s.id, s]))
  const acc = new Map<string, AgentStats>()

  const blank = (name: string, depth: number): AgentStats => ({
    name,
    invocations: 0,
    spans: 0,
    calls: 0,
    errors: 0,
    errorRate: 0,
    tokensIn: 0,
    tokensOut: 0,
    cost: 0,
    selfMs: 0,
    totalMs: 0,
    depth,
    delegatesTo: [],
  })

  // Depth counted in subagent hops, not span nesting — a tool call three levels
  // deep inside one agent is still that agent's own work.
  const agentDepth = (span: Span): number => {
    let d = 0
    let cur: Span | undefined = span
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      if (cur.type === 'subagent') d++
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
    }
    return d
  }

  acc.set(ROOT_AGENT, { ...blank(ROOT_AGENT, 0), invocations: 1 })

  for (const s of spans) {
    if (s.type === 'subagent') {
      const name = agentName(s)
      const depth = agentDepth(s)
      const entry = acc.get(name) ?? blank(name, depth)
      entry.invocations++
      entry.totalMs += s.duration_ms
      entry.depth = Math.min(entry.depth || depth, depth)
      // The subagent span carries that agent's own model usage — the tokens it
      // spent deciding what to do, as distinct from the tool spans beneath it.
      // Both belong to the same agent and are different spans, so summing them
      // attributes rather than double counts.
      entry.tokensIn += s.tokens_in
      entry.tokensOut += s.tokens_out
      entry.cost += s.cost_usd
      acc.set(name, entry)

      const caller = owner.get(s.id) ?? ROOT_AGENT
      const callerEntry = acc.get(caller) ?? blank(caller, Math.max(0, depth - 1))
      if (!callerEntry.delegatesTo.includes(name)) callerEntry.delegatesTo.push(name)
      acc.set(caller, callerEntry)
      continue
    }

    const name = owner.get(s.id) ?? ROOT_AGENT
    const entry = acc.get(name) ?? blank(name, 0)
    entry.spans++
    entry.selfMs += s.duration_ms
    entry.totalMs += s.duration_ms
    entry.tokensIn += s.tokens_in
    entry.tokensOut += s.tokens_out
    entry.cost += s.cost_usd
    if (isWork(s)) {
      entry.calls++
      if (s.status === 'error') entry.errors++
    }
    acc.set(name, entry)
  }

  // A subagent's cost is its own spans' cost, which the loop above already
  // attributed to it by name, so nothing is double counted here.
  const out = [...acc.values()].map((a) => ({
    ...a,
    cost: +a.cost.toFixed(6),
    errorRate: a.calls ? +((100 * a.errors) / a.calls).toFixed(1) : 0,
  }))

  return out.sort((a, b) => (a.name === ROOT_AGENT ? -1 : b.name === ROOT_AGENT ? 1 : b.cost - a.cost))
}

/** The delegation tree, for rendering who called whom. */
export function delegationTree(spans: Span[]): DelegationNode {
  const subagents = spans.filter((s) => s.type === 'subagent')
  const owner = attributeToInvocation(spans)
  const byId = new Map(spans.map((s) => [s.id, s]))

  /** Cost of one invocation: its own model usage plus the work directly under it. */
  const costOf = (invocationId: string, own = 0) =>
    +(
      own +
      spans.filter((x) => owner.get(x.id) === invocationId && x.type !== 'subagent').reduce((a, x) => a + x.cost_usd, 0)
    ).toFixed(6)

  const node = (s: Span, depth: number): DelegationNode => ({
    id: s.id,
    name: agentName(s),
    depth,
    durationMs: s.duration_ms,
    cost: costOf(s.id, s.cost_usd),
    status: s.status,
    children: [],
  })

  const root: DelegationNode = {
    id: ROOT_AGENT,
    name: ROOT_AGENT,
    depth: 0,
    durationMs: spans.length ? Math.max(...spans.map((s) => s.end_ms)) : 0,
    cost: costOf(ROOT_AGENT),
    status: 'ok',
    children: [],
  }

  const nodes = new Map<string, DelegationNode>()
  for (const s of subagents) nodes.set(s.id, node(s, 0))

  for (const s of subagents) {
    const self = nodes.get(s.id)!
    // Attach to the nearest enclosing subagent call, which is the agent that
    // spawned this one.
    let parent: Span | undefined = s.parent_id ? byId.get(s.parent_id) : undefined
    const seen = new Set<string>([s.id])
    while (parent && parent.type !== 'subagent' && !seen.has(parent.id)) {
      seen.add(parent.id)
      parent = parent.parent_id ? byId.get(parent.parent_id) : undefined
    }
    if (parent && parent.type === 'subagent' && nodes.has(parent.id)) {
      const p = nodes.get(parent.id)!
      self.depth = p.depth + 1
      p.children.push(self)
    } else {
      self.depth = 1
      root.children.push(self)
    }
  }

  const sortRec = (n: DelegationNode) => {
    n.children.sort((a, b) => b.durationMs - a.durationMs)
    n.children.forEach(sortRec)
  }
  sortRec(root)
  return root
}

/** Flatten the tree for table rendering, preserving order and indentation. */
export function flattenTree(node: DelegationNode): DelegationNode[] {
  return [node, ...node.children.flatMap(flattenTree)]
}
