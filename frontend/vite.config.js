import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const phpOrigin = env.VITE_PHP_ORIGIN || 'http://localhost';
  const phpSubdir = env.VITE_PHP_SUBDIR ?? 'Luxeglow';
  const rewrite = (path) => (phpSubdir ? `/${phpSubdir}${path}` : path);

  return {
    plugins: [react(), tailwindcss()],
    // Public URL prefix for built assets — must match the htdocs sub-folder
    // the dist output is deployed into ('/luxeglow/' in production).
    base: env.VITE_ASSET_BASE || '/',
    // 'app' avoids colliding with the legacy assets/ folder when dist is
    // deployed into the PHP project root
    build: { assetsDir: 'app' },
    server: {
      port: 5173,
      proxy: {
        '/includes': { target: phpOrigin, changeOrigin: true, rewrite },
        '/uploads': { target: phpOrigin, changeOrigin: true, rewrite },
      },
    },
  };
});
