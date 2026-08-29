import { publicServiceImage } from '../lib/supabase';

const CATEGORY_FALLBACKS = [
  ['packages', 'packages.webp'],
  ['nails', 'nails.webp'],
  ['spa & massage', 'spa-massage.webp'],
  ['brows & lashes', 'brows-lashes.webp'],
  ['waxing', 'waxing.webp'],
  ['kids', 'kids.webp'],
];

function normalizedCategory(category) {
  return String(category || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function assetBase() {
  const base = String(import.meta.env.BASE_URL || '/');
  return base.endsWith('/') ? base : `${base}/`;
}

/**
 * Resolve the generated category artwork without writing it to the service
 * row. The BASE_URL prefix keeps these assets working on sub-path hosts.
 */
export function categoryFallbackImage(category) {
  const value = normalizedCategory(category);
  const fallback = CATEGORY_FALLBACKS.find(([name]) => value === name || value.includes(name));
  return fallback ? `${assetBase()}service-fallbacks/${fallback[1]}` : '';
}

/**
 * Resolve both new Cloudinary URLs and old relative Supabase Storage paths.
 * Missing paths intentionally use local category artwork only at render time.
 */
export function serviceImageUrl(service) {
  const path = String(service?.image_path || '').trim();
  if (path) return publicServiceImage(path);
  return categoryFallbackImage(service?.category);
}
