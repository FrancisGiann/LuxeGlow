import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* basename keeps SPA routes working under the htdocs sub-folder
        (VITE_ROUTER_BASE=/luxeglow in production; default '/' in dev) */}
    <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASE || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
