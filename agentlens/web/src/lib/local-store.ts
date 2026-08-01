/**
 * Persistence for user-imported traces.
 *
 * IndexedDB rather than localStorage because real traces carry full prompts and
 * file contents: the demo corpus averages ~25 KB per trial with short synthetic
 * text, and a genuine run is comfortably an order of magnitude larger, which
 * clears localStorage's ~5 MB ceiling within a handful of runs.
 *
 * This never leaves the browser. Imported traces are not uploaded anywhere, and
 * on the static deployment there is no server that could receive them.
 */
import type { ImportedTrace } from './trace-format'

const DB_NAME = 'agentlens-local'
const STORE = 'traces'
const VERSION = 1

export interface StoredTrace {
  id: string
  label: string
  importedAt: number
  /** Byte size of the source text, for showing what the browser is holding. */
  sourceBytes: number
  trace: ImportedTrace
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB.'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
      }),
  )
}

export const localTraces = {
  list: async (): Promise<StoredTrace[]> => {
    const all = await tx<StoredTrace[]>('readonly', (s) => s.getAll() as IDBRequest<StoredTrace[]>)
    return all.sort((a, b) => b.importedAt - a.importedAt)
  },
  get: (id: string) => tx<StoredTrace | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredTrace | undefined>),
  put: (t: StoredTrace) => tx('readwrite', (s) => s.put(t) as IDBRequest<IDBValidKey>).then(() => t),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>),
  clear: () => tx('readwrite', (s) => s.clear() as unknown as IDBRequest<undefined>),
}

/** Whether the browser can store traces at all — private modes sometimes cannot. */
export function storageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}
