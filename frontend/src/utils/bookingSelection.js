export function normalizeBookingServiceIds(serviceIds, services = []) {
  if (!Array.isArray(serviceIds) || !Array.isArray(services)) return [];

  const servicesById = new Map(
    services.map((service) => [String(service.id), service]),
  );
  const seenIds = new Set();
  const normalizedIds = [];
  let packageSelected = false;

  for (const rawId of serviceIds) {
    if (rawId == null) continue;
    const id = String(rawId);
    const service = servicesById.get(id);
    if (!id || !service || seenIds.has(id)) continue;
    if (service.item_type === 'package') {
      if (packageSelected) continue;
      packageSelected = true;
    }
    seenIds.add(id);
    normalizedIds.push(id);
  }

  return normalizedIds;
}

export function selectedPackageForBooking(serviceIds, services = []) {
  if (!Array.isArray(serviceIds) || !Array.isArray(services)) return null;
  const selectedIds = new Set(serviceIds.map(String));
  return services.find(
    (service) => service.item_type === 'package' && selectedIds.has(String(service.id)),
  ) || null;
}

export function canSelectBookingService(serviceId, selectedIds, services = []) {
  const id = String(serviceId);
  if (selectedIds.some((selectedId) => String(selectedId) === id)) return true;
  const target = services.find((service) => String(service.id) === id);
  if (!target) return false;
  return target.item_type !== 'package' || !selectedPackageForBooking(selectedIds, services);
}
