import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    // Public URL prefix for built assets — set VITE_ASSET_BASE when hosting
    // the SPA below a sub-path.
    base: env.VITE_ASSET_BASE || '/',
    // 'app' avoids colliding with the legacy assets/ folder when dist is
    // deployed into the PHP project root
    build: { assetsDir: 'app' },
    server: { port: 5173 },
  };
});
