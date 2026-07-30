export const fmtInt = (n: number) => Math.round(n).toLocaleString()

export function fmtCompact(n: number, digits = 1): string {
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(digits) + 'B'
  if (a >= 1e6) return (n / 1e6).toFixed(digits) + 'M'
  if (a >= 1e3) return (n / 1e3).toFixed(digits) + 'k'
  return String(Math.round(n))
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`
  const m = Math.floor(s / 60)
  const rs = Math.round(s % 60)
  if (m < 60) return `${m}m ${String(rs).padStart(2, '0')}s`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}

/** Compact axis-friendly time, e.g. 0:00 / 4:12 */
export function fmtClock(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export const fmtUsd = (n: number, digits = 2) =>
  n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(digits)}` : `$${n.toFixed(3)}`

export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`

export function fmtAgo(ts: number): string {
  const d = Date.now() - ts
  const h = d / 3.6e6
  if (h < 1) return `${Math.max(1, Math.round(d / 6e4))}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.round(h / 24)}d ago`
}

export const shortId = (s: string) => (s.length > 22 ? s.slice(0, 10) + '…' + s.slice(-8) : s)

export const taskShort = (id: string) => id.split('__').pop() || id

export const repoShort = (repo: string) => repo.split('/').pop() || repo

/**
 * Compact but still unique label for a run. Two configurations can share a
 * model, so the scaffold has to survive the shortening or points collide.
 */
export function runShort(name: string): string {
  const [model, ...rest] = name.split(' · ')
  const scaffold = rest.join(' · ')
  if (/bm25|retrieval/i.test(scaffold)) return `${model} +BM25`
  if (/minimal/i.test(scaffold)) return `${model} minimal`
  return model
}
