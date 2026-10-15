const BRAND_LOGO_SRC = '/assets/astrid-nails-logo.png';

export function BrandLogo({
  alt = 'Astrid Nails & Beauty Bar',
  className = '',
  loading = 'eager',
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      width="1654"
      height="1654"
      decoding="async"
      loading={loading}
      className={`block aspect-square shrink-0 object-contain ${className}`}
    />
  );
}
