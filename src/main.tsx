import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled, not fetched. An air-gapped host has no route to a CDN,
// and the interface says so on every screen.
import '@fontsource/caudex/400.css'
import '@fontsource/caudex/700.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource-variable/public-sans'
import '@fontsource/ibm-plex-mono/300.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import App from '@/App'
import '@/styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
