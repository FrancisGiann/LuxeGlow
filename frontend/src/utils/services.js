/**
 * Keep catalog ordering predictable anywhere the live service list is shown.
 * The database display_order is the source of truth; name/id only stabilize
 * rows that have not been assigned an order yet.
 */
export function sortServicesForDisplay(services = []) {
  return (Array.isArray(services) ? services : []).slice().sort((a, b) => {
    const orderDifference = Number(a?.display_order || 0) - Number(b?.display_order || 0);
    if (orderDifference) return orderDifference;
    const nameDifference = String(a?.name || '').localeCompare(String(b?.name || ''));
    return nameDifference || String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}

function categoryName(service) {
  return String(service?.category || 'Other').trim() || 'Other';
}

function hasOwnProperty(value, key) {
  return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Select a small photo-led homepage preview from the active live menu.
 *
 * New deployments use the persisted homepage selection. Before the curation
 * migration is present, the old category-balanced selection remains a safe
 * read-only fallback so the public homepage does not go blank.
 */
export function curateHomepageServices(services, limit = 6) {
  const ordered = sortServicesForDisplay(services).filter((service) => service?.is_active !== false);
  const maxItems = Math.max(0, Number(limit) || 0);
  const hasPersistedSelection = (Array.isArray(services) ? services : []).some((service) => hasOwnProperty(service, 'is_homepage_featured'));
  if (hasPersistedSelection) return ordered.filter((service) => service?.is_homepage_featured === true).slice(0, maxItems);

  const selected = [];
  const categories = new Map();

  ordered.forEach((service) => {
    const category = categoryName(service);
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(service);
  });
  categories.forEach((categoryServices) => {
    if (selected.length >= maxItems) return;
    selected.push(categoryServices.find((service) => service?.image_path) || categoryServices[0]);
  });

  ordered.forEach((service) => {
    if (selected.length >= maxItems || selected.includes(service)) return;
    selected.push(service);
  });

  return selected;
}

export function supportsHomepageCuration(services) {
  return (Array.isArray(services) ? services : []).some((service) => hasOwnProperty(service, 'is_homepage_featured'));
}
