import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import LiveView from './LiveView.tsx'

// A plain query param (rather than a path-based route) so a shared link works as a fresh page
// load on static hosting like GitHub Pages, which has no server-side rewrite to fall back to
// index.html for a path it doesn't recognize.
const isLiveView = new URLSearchParams(window.location.search).get('live') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isLiveView ? (
      <LiveView />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </StrictMode>,
)
