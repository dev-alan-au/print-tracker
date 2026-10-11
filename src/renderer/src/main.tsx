import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, readCachedTheme } from './lib/preferences'
import './styles.css'

// Apply the remembered colour scheme before the first paint, so a dark-mode user
// does not see a flash of the light default while settings load from the database.
applyTheme(readCachedTheme() ?? 'light')

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root is missing from index.html')
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
