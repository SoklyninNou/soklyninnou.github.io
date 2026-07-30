/// <reference types="vite/client" />

/**
 * True in a static build (`npm run build:static`): the app reads pre-rendered
 * JSON under `<base>data/` instead of talking to the Node API, and routes on the
 * hash so deep links survive a static host with no rewrites.
 */
declare const __AGENTLENS_STATIC__: boolean
