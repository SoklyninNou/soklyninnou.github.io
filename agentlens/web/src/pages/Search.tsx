import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, useApi } from '../lib/api'
import { KIND_COLOR, spanBucket } from '../lib/colors'
import { fmtClock, taskShort } from '../lib/format'
import { Card, ErrorState, Loading } from '../components/ui'

const EXAMPLES = [
  'whitespace',
  'context',
  'SyntaxError',
  'No matches found',
  'current_app',
  'OOM',
  'pytest',
]

export default function Search() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [draft, setDraft] = useState(q)

  useEffect(() => setDraft(q), [q])

  const { data, error, loading } = useApi(() => (q ? api.search(q) : Promise.resolve({ term: '', hits: [] })), [q])

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 className="page-title">Search spans</h1>
          <p className="page-sub">
            Full-text search across every tool input, output, and error message in the corpus. Useful for asking "which
            runs hit this exact error?" — then jumping straight to the span.
          </p>
        </div>
      </div>

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(draft.trim() ? new URLSearchParams({ q: draft.trim() }) : new URLSearchParams())
        }}
      >
        <input
          className="ctl"
          style={{ flex: 1, maxWidth: 'none' }}
          placeholder="e.g. SyntaxError, whitespace, current_app…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <button className="btn primary" type="submit">
          Search
        </button>
      </form>

      <div className="hstack">
        <span className="toolbar-label">Try</span>
        {EXAMPLES.map((e) => (
          <button key={e} className="btn" onClick={() => setParams(new URLSearchParams({ q: e }))}>
            {e}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} />}
      {loading && q && !data && <Loading what="results" />}

      {q && data && (
        <Card title={`${data.hits.length} matching span${data.hits.length === 1 ? '' : 's'}`} note={`for “${q}”`}>
          {data.hits.length === 0 ? (
            <div className="empty">Nothing matched. Try a shorter term — search is prefix-based.</div>
          ) : (
            <div className="vstack" style={{ gap: 10 }}>
              {data.hits.map((h) => (
                <div
                  key={h.span_id}
                  className="note"
                  style={{ borderLeftColor: KIND_COLOR[spanBucket({ type: h.type, kind: 'other' })], cursor: 'pointer' }}
                  onClick={() => nav(`/trials/${h.trial_id}`)}
                >
                  <div className="note-head">
                    <span className="mono">{h.name}</span>
                    <span>·</span>
                    <span className="mono">{taskShort(h.task_id)}</span>
                    <span>·</span>
                    <span>step {h.step}</span>
                    <span>·</span>
                    <span>{fmtClock(h.start_ms)}</span>
                    {h.status === 'error' && <span className="badge unresolved">error</span>}
                    <div style={{ flex: 1 }} />
                    <span className="linkish">open trace →</span>
                  </div>
                  <div className="note-body mono" style={{ fontSize: 11.5 }}>
                    <Snippet text={h.snip_err || h.snip_out} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {!q && (
        <Card>
          <div className="empty">Enter a term above, or pick one of the examples.</div>
        </Card>
      )}
    </div>
  )
}

/** FTS5 wraps matches in « » — render those as highlights. */
function Snippet({ text }: { text: string }) {
  if (!text) return <span className="muted">(no preview)</span>
  const parts = text.split(/(«[^»]*»)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('«') ? <mark key={i}>{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>,
      )}
    </>
  )
}
