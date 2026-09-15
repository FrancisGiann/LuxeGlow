import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const SITE_DESCRIPTION = 'Explore nail, lash, and spa treatments at Astrid Nails & Beauty Bar in Lucena City. View the live menu, choose a time, and request your appointment online.';
const BUSINESS_NAME = 'Astrid Nails & Beauty Bar';

function normalizeSiteUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  const candidate = rawValue.includes('://') ? rawValue : `https://${rawValue}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '';
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function normalizeBasePath(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue || rawValue === '/') return '';
  return `/${rawValue.replace(/^\/+|\/+$/g, '')}`;
}

function routeUrl(siteUrl, basePath, routePath = '/') {
  return `${siteUrl}${basePath}${routePath === '/' ? '/' : routePath}`;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function seoFilesPlugin({ siteUrl, routerBase, assetBase }) {
  const rootUrl = siteUrl ? routeUrl(siteUrl, routerBase) : '';
  const imageUrl = siteUrl ? routeUrl(siteUrl, assetBase, '/homepage_hero.jpg') : '';
  const publicPaths = ['/', '/services', '/book'];

  return {
    name: 'luxeglow-seo-files',
    apply: 'build',
    transformIndexHtml(html) {
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'BeautySalon',
        name: BUSINESS_NAME,
        description: SITE_DESCRIPTION,
        areaServed: 'Lucena City',
        ...(rootUrl ? { url: rootUrl } : {}),
        ...(imageUrl ? { image: [imageUrl] } : {}),
      };
      const tags = [
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: JSON.stringify(structuredData),
          injectTo: 'head',
        },
      ];
      if (rootUrl) {
        tags.push(
          { tag: 'link', attrs: { rel: 'canonical', href: rootUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:url', content: rootUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image', content: imageUrl }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: imageUrl }, injectTo: 'head' },
        );
      }
      return { html, tags };
    },
    generateBundle() {
      const sitemap = siteUrl
        ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map((path) => `  <url><loc>${xmlEscape(routeUrl(siteUrl, routerBase, path))}</loc></url>`).join('\n')}\n</urlset>\n`
        : null;
      const robotsLines = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /dashboard',
        'Disallow: /reset-password',
        ...(siteUrl ? [`Sitemap: ${routeUrl(siteUrl, '', '/sitemap.xml')}`] : []),
        '',
      ];
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsLines.join('\n') });
      if (sitemap) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const routerBase = normalizeBasePath(env.VITE_ROUTER_BASE || env.VITE_ASSET_BASE || '/');
  const assetBase = normalizeBasePath(env.VITE_ASSET_BASE || env.VITE_ROUTER_BASE || '/');
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL)
    || normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    || normalizeSiteUrl(process.env.VERCEL_URL);

  return {
    plugins: [react(), tailwindcss(), seoFilesPlugin({ siteUrl, routerBase, assetBase })],
    // Public URL prefix for built assets — set VITE_ASSET_BASE when hosting
    // the SPA below a sub-path.
    base: env.VITE_ASSET_BASE || '/',
    // 'app' avoids colliding with the legacy assets/ folder when dist is
    // deployed into the PHP project root
    build: { assetsDir: 'app' },
    server: { port: 5173 },
  };
});
