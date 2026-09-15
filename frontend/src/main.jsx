import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/theme.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Set VITE_ROUTER_BASE when hosting the SPA under a sub-path; root hosting
        uses '/' by default. */}
    <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASE || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>
);
