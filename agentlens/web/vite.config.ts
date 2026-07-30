import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A static build (see server/src/export-static.js) ships pre-rendered JSON in
// place of the API, and can be mounted under a sub-path of another site.
const isStatic = process.env.AGENTLENS_STATIC === '1'

export default defineConfig({
  plugins: [react()],
  base: process.env.AGENTLENS_BASE || '/',
  define: {
    __AGENTLENS_STATIC__: JSON.stringify(isStatic),
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5177',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: process.env.AGENTLENS_OUT || 'dist',
    // The static build writes into the host site's public/ directory, outside
    // this project root, which Vite will not clear without being told to.
    emptyOutDir: true,
    sourcemap: false,
  },
})
