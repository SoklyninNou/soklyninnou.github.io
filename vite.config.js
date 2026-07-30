import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * AgentLens ships as its own bundle in public/agentlens/ (see `npm run
 * build:agentlens`). Vite's dev server does not resolve a directory request
 * inside public/ to that directory's index.html, so /agentlens/ would hit this
 * app's SPA fallback and render the 404 page. Static hosts including GitHub
 * Pages serve the directory index themselves, so this is dev-only.
 */
const nestedAppIndex = {
  name: 'nested-app-index',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = req.url?.split('?')[0];
      if (path === '/agentlens' || path === '/agentlens/') {
        req.url = '/agentlens/index.html';
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), nestedAppIndex],
});
