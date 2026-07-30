import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// Static hosts have no rewrites, so a refresh on /trials/:id would 404. Routing
// on the hash keeps every deep link resolving to the one index.html that exists.
const Router = __AGENTLENS_STATIC__ ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
)
