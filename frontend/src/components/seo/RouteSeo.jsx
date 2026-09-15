import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_TITLE = 'Astrid Nails & Beauty Bar';
const SITE_ORIGIN = import.meta.env.VITE_SITE_URL || '';

const PAGE_METADATA = {
  '/': {
    title: 'Astrid Nails & Beauty Bar | Lucena City Nail, Lash & Spa',
    description: 'Explore nail, lash, and spa treatments at Astrid Nails & Beauty Bar in Lucena City. View the live menu, choose a time, and request your appointment online.',
    indexable: true,
  },
  '/services': {
    title: 'Nail, Lash & Spa Treatments | Astrid Nails & Beauty Bar',
    description: 'Browse the live Astrid Nails & Beauty Bar treatment menu in Lucena City. Compare services, prices, and durations before requesting an appointment.',
    indexable: true,
  },
  '/book': {
    title: 'Book an Appointment | Astrid Nails & Beauty Bar, Lucena City',
    description: 'Choose a date, time, treatment, and team preference for your Astrid Nails & Beauty Bar appointment in Lucena City online.',
    indexable: true,
  },
  '/reset-password': {
    title: 'Reset your password | Astrid Nails & Beauty Bar',
    description: 'Reset the password for your Astrid Nails & Beauty Bar account.',
    indexable: false,
  },
};

const FALLBACK_METADATA = {
  title: `Private page | ${SITE_TITLE}`,
  description: 'This page is part of the Astrid Nails & Beauty Bar account workspace.',
  indexable: false,
};

function normalizeBasePath(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue || rawValue === '/') return '';
  return `/${rawValue.replace(/^\/+|\/+$/g, '')}`;
}

function configuredOrigin() {
  const staticCanonical = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const candidate = SITE_ORIGIN || staticCanonical || window.location.origin;
  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return window.location.origin;
    return `${url.protocol}//${url.host}`;
  } catch {
    return window.location.origin;
  }
}

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function routePathWithoutBase(pathname, basePath) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (!basePath) return normalizedPath;
  if (normalizedPath === basePath) return '/';
  if (normalizedPath.startsWith(`${basePath}/`)) return normalizedPath.slice(basePath.length) || '/';
  return normalizedPath;
}

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const routerBase = normalizeBasePath(import.meta.env.VITE_ROUTER_BASE || import.meta.env.VITE_ASSET_BASE || import.meta.env.BASE_URL);
    const assetBase = normalizeBasePath(import.meta.env.VITE_ASSET_BASE || import.meta.env.VITE_ROUTER_BASE || import.meta.env.BASE_URL);
    const routePath = routePathWithoutBase(pathname, routerBase);
    const metadata = PAGE_METADATA[routePath] || FALLBACK_METADATA;
    const origin = configuredOrigin();
    const canonicalPath = `${routerBase}${routePath === '/' ? '/' : routePath}`;
    const canonical = `${origin}${canonicalPath}`;
    const image = `${origin}${assetBase}/homepage_hero.jpg`;

    document.title = metadata.title;
    setMeta('name', 'description', metadata.description);
    setMeta('name', 'robots', metadata.indexable ? 'index,follow' : 'noindex,nofollow');
    setMeta('property', 'og:title', metadata.title);
    setMeta('property', 'og:description', metadata.description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:title', metadata.title);
    setMeta('name', 'twitter:description', metadata.description);
    setMeta('name', 'twitter:image', image);
    setCanonical(canonical);
  }, [pathname]);

  return null;
}
