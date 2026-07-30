/**
 * Colour assignment. Two rules do all the work here:
 *   1. Colour follows the entity, never its rank — the maps below are fixed, so
 *      filtering a chart never repaints the survivors.
 *   2. Categorical slots are used in their validated order and never cycled;
 *      a taxonomy longer than the palette folds its tail into "Other".
 */

import type { SpanKind, TrialStatus } from './api'

export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
] as const

export const SEQ = [
  'var(--seq-100)',
  'var(--seq-200)',
  'var(--seq-300)',
  'var(--seq-400)',
  'var(--seq-500)',
  'var(--seq-600)',
  'var(--seq-700)',
] as const

export const OTHER = 'var(--text-muted)'

/**
 * Span kinds — validated as a 5-slot set in both modes (worst adjacent CVD ΔE
 * 9.1 light / 8.4 dark).
 *
 * The mapping deliberately follows slot order, because the semantic order these
 * are always listed and stacked in is search → read → edit → test. Only
 * consecutive slots are validated as adjacent pairs; mapping edit to slot 2 and
 * test to slot 4 would put orange next to yellow in every stack, and that is
 * the one pair in this palette that fails CVD separation.
 */
export const KIND_COLOR: Record<SpanKind | 'llm' | 'system', string> = {
  search: 'var(--series-1)',
  read: 'var(--series-2)',
  edit: 'var(--series-3)',
  test: 'var(--series-4)',
  llm: 'var(--series-7)',
  system: 'var(--text-muted)',
  other: 'var(--text-muted)',
}

/** The order kinds must be listed and stacked in, so adjacency stays validated. */
export const KIND_ORDER = ['search', 'read', 'edit', 'test', 'other'] as const

export const KIND_LABEL: Record<string, string> = {
  llm: 'Model call',
  search: 'Search',
  read: 'Read',
  edit: 'Edit',
  test: 'Test',
  other: 'Other',
  system: 'System',
}

/** What a span is colour-coded as in the timeline. */
export function spanBucket(s: { type: string; kind: SpanKind }): keyof typeof KIND_COLOR {
  if (s.type === 'llm') return 'llm'
  if (s.type === 'system') return 'system'
  return s.kind
}

/** Status colours are reserved and always ship beside a text label. */
export const STATUS_COLOR: Record<TrialStatus, string> = {
  resolved: 'var(--good)',
  unresolved: 'var(--critical)',
  errored: 'var(--serious)',
  timeout: 'var(--warning)',
}

export const STATUS_LABEL: Record<TrialStatus, string> = {
  resolved: 'Resolved',
  unresolved: 'Unresolved',
  errored: 'Harness error',
  timeout: 'Step cap',
}

export const SPAN_STATUS_COLOR: Record<string, string> = {
  ok: 'var(--good)',
  warn: 'var(--warning)',
  error: 'var(--critical)',
}

/**
 * Stable colour for a failure category. The taxonomy has more members than the
 * palette has slots, so the seven most common get slots 1–7 in a fixed order
 * and everything else folds into a neutral "Other".
 */
const TAXONOMY_ORDER = [
  'wrong_fix',
  'localization',
  'regression',
  'loop_stall',
  'tool_error_cascade',
  'context_overflow',
  'premature_stop',
]

export function failureColor(category: string | null | undefined): string {
  if (!category) return OTHER
  const i = TAXONOMY_ORDER.indexOf(category)
  return i === -1 ? OTHER : SERIES[i]
}

export function isFolded(category: string): boolean {
  return !TAXONOMY_ORDER.includes(category)
}

export const FOLDED_LABEL = 'Other causes'

/**
 * Legend for an outcome grid.
 *
 * These grids encode the *verdict* (four status classes), not the failure cause.
 * Cause has 11 members — past the ~7 classes any palette can keep distinct, and
 * in a grid of bare squares hue is the only channel available. Worse, the
 * taxonomy's green slot sits only ΔE 9.7 from status-green, so a context
 * overflow could read as a success. The cause stays one hover away and is the
 * whole subject of the Failures page, which uses a sequential ramp for it.
 */
export function outcomeLegend(statuses: TrialStatus[]): { label: string; color: string }[] {
  const present = new Set(statuses)
  return (['resolved', 'unresolved', 'timeout', 'errored'] as TrialStatus[])
    .filter((s) => present.has(s))
    .map((s) => ({ label: STATUS_LABEL[s], color: STATUS_COLOR[s] }))
}

/** Map a 0..1 value onto the sequential ramp (light→dark = low→high). */
export function seqColor(t: number): string {
  const i = Math.max(0, Math.min(SEQ.length - 1, Math.round(t * (SEQ.length - 1))))
  return SEQ[i]
}

/** Difficulty is an ordered scale, so it gets the ordinal ramp, not hues. */
export const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'var(--seq-300)',
  medium: 'var(--seq-500)',
  hard: 'var(--seq-700)',
}
