import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster } from './components/Toaster'
import { preloadFonts } from './lib/fonts'
import { initMcpSync } from './lib/mcpSync'
import App from './App'
import './index.css'

preloadFonts()

// Parse board ID from URL for embed mode sync
const boardParam = new URLSearchParams(window.location.search).get('board')
const pathBoardId = window.location.pathname.match(/\/board\/([^/?]+)/)?.[1] || null
initMcpSync({ boardId: boardParam || pathBoardId || undefined })

// Register service worker for PWA with cache-busting version.
// The desktop app (Tauri) never needs it — unregister any leftover worker
// there, since a stale one can blank the app after rebuilds.
if (typeof window !== 'undefined' && (window as any).__TAURI__ && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {})
} else if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const swVersion = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BUILD_ID || Date.now().toString(36)
  navigator.serviceWorker.register(`/sw.js?v=${swVersion}`).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>
  </React.StrictMode>,
)
