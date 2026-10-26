import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { canonicalProductionUrl } from './utils/canonicalOrigin';
import './styles/theme.css';

const canonicalUrl = canonicalProductionUrl(window.location);
if (canonicalUrl) {
  window.location.replace(canonicalUrl);
} else {
  // App initializes Auth on import. Keep it behind the origin check so a www
  // visit cannot start Auth requests that the gateway correctly refuses.
  import('./App').then(({ default: App }) => {
    createRoot(document.getElementById('root')).render(
        <StrictMode>
          {/* Set VITE_ROUTER_BASE when hosting the SPA under a sub-path; root hosting
              uses '/' by default. */}
          <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASE || '/'}>
            <App />
          </BrowserRouter>
        </StrictMode>
    );
  });
}
