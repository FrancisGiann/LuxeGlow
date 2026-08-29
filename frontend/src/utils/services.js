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

/**
 * Select a small photo-led homepage preview from the active live menu.
 * One service per category is preferred, with uploaded images winning within
 * each category. Remaining slots use the next ordered active services.
 */
export function curateHomepageServices(services, limit = 6) {
  const ordered = sortServicesForDisplay(services).filter((service) => service?.is_active !== false);
  const maxItems = Math.max(0, Number(limit) || 0);
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
