import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// ── Clear stale localStorage from old app versions ───────────────────────────
const APP_VERSION = '2.2.0'
try {
  const storedVer = localStorage.getItem('fenster_app_version')
  if (storedVer !== APP_VERSION) {
    // Wipe all old localStorage keys (previous builds used localStorage for data)
    const keysToKeep: string[] = []
    Object.keys(localStorage)
      .filter(k => !keysToKeep.includes(k))
      .forEach(k => localStorage.removeItem(k))
    localStorage.setItem('fenster_app_version', APP_VERSION)
  }
} catch { /* private browsing mode may block localStorage */ }

// ── Auto-reload page when a new service worker takes over ────────────────────
// skipWaiting + clientsClaim activate the new SW, controllerchange fires → reload
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
