import { useEffect, useMemo, useState } from 'react';
import { EmptyState, SkeletonRows } from '../ui/EmptyState';
import { IconAlertCircle, IconClock, IconSearch, IconSparkle } from '../icons';
import { formatPeso } from '../../utils/format';
import { sortServicesForDisplay } from '../../utils/services';
import { serviceImageUrl } from '../../utils/serviceImages';

const ALL_CATEGORY = 'All';
const PAGE_SIZE = 10;

function categoryName(service) {
  return String(service?.category || 'Other').trim() || 'Other';
}

function subcategoryName(service) {
  return String(service?.subcategory || 'General').trim() || 'General';
}

function itemTypeLabel(service) {
  if (service?.item_type === 'package') return 'Package · fixed price';
  if (service?.item_type === 'add_on') return 'Add-on';
  return '';
}

function serviceMatches(service, searchTerm) {
  if (!searchTerm) return true;
  return [service.name, service.category, service.subcategory, service.description, itemTypeLabel(service)]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
    .includes(searchTerm);
}

function ServiceThumbnail({ service }) {
  const imageUrl = serviceImageUrl(service);
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-blush-50 text-brand-300" aria-hidden="true">
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <IconSparkle size={19} />
      )}
    </span>
  );
}

function ServiceRow({ service, selectable, selected, disabled, onToggle }) {
  const category = categoryName(service);
  const typeLabel = itemTypeLabel(service);

  if (selectable) {
    return (
      <label
        className={`group grid min-h-[68px] grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line px-2 py-3 transition-colors sm:gap-5 sm:px-3 ${
          selected ? 'bg-brand-50' : 'bg-surface hover:bg-blush-50'
        } ${disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`}
      >
        <input
          type="checkbox"
          checked={selected}
          disabled={disabled}
          onChange={() => onToggle(service.id)}
          className="h-7 w-7 shrink-0 cursor-pointer rounded-md border-line-strong accent-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed"
          aria-label={`${selected ? 'Remove' : 'Select'} ${service.name}`}
        />
        <ServiceThumbnail service={service} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-ink-900">{service.name}</span>
          {typeLabel && <span className="mt-1 inline-flex rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-gold-600">{typeLabel}</span>}
          {service.description && (
            <span className={`${typeLabel ? 'mt-1' : 'mt-0.5'} block line-clamp-1 text-xs text-ink-500`}>{service.description}</span>
          )}
          <span className="mt-1 block text-xs text-ink-500 sm:hidden">
            {category} · {service.duration || 'Duration unavailable'}
          </span>
        </span>
        <span className="hidden items-center gap-1.5 text-xs font-semibold text-ink-500 sm:flex">
          <IconClock size={14} />
          {service.duration || '—'}
        </span>
        <span className="flex items-center gap-3">
          <span className="font-display text-base font-semibold tabular-nums text-brand-800">{formatPeso(service.price)}</span>
        </span>
      </label>
    );
  }

  return (
    <div className="grid min-h-[68px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-t border-line px-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-5 sm:px-3">
      <ServiceThumbnail service={service} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-900">{service.name}</span>
        {typeLabel && <span className="mt-1 inline-flex rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-gold-600">{typeLabel}</span>}
        {service.description && <span className={`${typeLabel ? 'mt-1' : 'mt-0.5'} block line-clamp-2 text-xs leading-relaxed text-ink-500`}>{service.description}</span>}
        <span className="mt-1 block text-xs text-ink-500 sm:hidden">
          {category} · {service.duration || 'Duration unavailable'}
        </span>
      </span>
      <span className="order-3 hidden items-center gap-1.5 text-xs font-semibold text-ink-500 sm:order-3 sm:flex">
        <IconClock size={14} />
        <span className="whitespace-nowrap">{service.duration || '—'}</span>
      </span>
      <span className="order-2 justify-self-end font-display text-base font-semibold tabular-nums text-brand-800 sm:order-4">{formatPeso(service.price)}</span>
    </div>
  );
}

function LoadingCatalog() {
  return (
    <div className="space-y-2" aria-label="Loading treatments" role="status">
      <SkeletonRows rows={6} />
    </div>
  );
}

export function ServiceCatalog({
  services,
  loading = false,
  error = '',
  onRetry,
  selectable = false,
  selectedIds = [],
  onToggle = () => {},
  selectionLimit = 8,
}) {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const normalizedServices = useMemo(() => sortServicesForDisplay(services), [services]);
  const categories = useMemo(() => {
    const unique = [];
    normalizedServices.forEach((service) => {
      const category = categoryName(service);
      if (!unique.includes(category)) unique.push(category);
    });
    return [ALL_CATEGORY, ...unique];
  }, [normalizedServices]);

  const selectedCategory = categories.includes(activeCategory) ? activeCategory : ALL_CATEGORY;

  const searchTerm = search.trim().toLocaleLowerCase();
  const filteredServices = useMemo(
    () => normalizedServices.filter((service) => {
      const categoryMatches = selectedCategory === ALL_CATEGORY || categoryName(service) === selectedCategory;
      return categoryMatches && serviceMatches(service, searchTerm);
    }),
    [normalizedServices, searchTerm, selectedCategory],
  );
  const pageCount = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);
  const visiblePage = Math.min(page, pageCount);
  const visibleServices = useMemo(
    () => filteredServices.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE),
    [filteredServices, visiblePage],
  );
  const groupedServices = useMemo(() => {
    const groups = new Map();
    visibleServices.forEach((service) => {
      const category = categoryName(service);
      const subcategory = subcategoryName(service);
      const key = `${category}::${subcategory}`;
      if (!groups.has(key)) groups.set(key, { category, subcategory, items: [] });
      groups.get(key).items.push(service);
    });
    return [...groups.entries()];
  }, [visibleServices]);
  const clearFilters = () => {
    setSearch('');
    setActiveCategory(ALL_CATEGORY);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 border-b border-line pb-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,23rem)] lg:items-end">
        <div>
          <label htmlFor="service-catalog-search" className="mb-1.5 block text-sm font-semibold text-ink-900">Search treatments</label>
          <div className="relative">
            <IconSearch size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              id="service-catalog-search"
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search by treatment or category"
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-line bg-surface px-4 pl-11 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-ink-500">
          {selectable ? `Select up to ${selectionLimit} treatments for this visit.` : 'Prices and durations stay in view as you browse.'}
        </p>
      </div>

      {loading && <LoadingCatalog />}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10">
          <EmptyState
            icon={IconAlertCircle}
            title="Could not load treatments"
            description={error}
            action={onRetry && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4 hover:text-brand-900">Try again</button>}
          />
        </div>
      )}

      {!loading && !error && !normalizedServices.length && (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState icon={IconSparkle} title="No treatments are currently available" description="The live menu will appear here when services are published." />
        </div>
      )}

      {!loading && !error && normalizedServices.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Treatment categories">
            {categories.map((category) => {
              const selected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="service-catalog-results"
                  onClick={() => { setActiveCategory(category); setPage(1); }}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 ${selected ? 'border-brand-800 bg-brand-800 text-white' : 'border-line bg-surface text-ink-700 hover:border-brand-400 hover:bg-blush-50'}`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2" id="service-catalog-results" aria-live="polite">
            <h2 className="font-display text-2xl font-medium text-ink-900">{selectedCategory === ALL_CATEGORY ? 'All treatments' : selectedCategory}</h2>
            <p className="text-sm text-ink-500">{filteredServices.length} of {normalizedServices.length} treatment{normalizedServices.length === 1 ? '' : 's'}</p>
          </div>

          {selectable && <p className="text-xs font-semibold text-ink-500" aria-live="polite">{selectedIds.length} of {selectionLimit} selected</p>}

          {!filteredServices.length ? (
            <div className="rounded-xl border border-line bg-surface">
              <EmptyState title="No treatments match this search" description="Try another term or clear the category filter." action={<button type="button" onClick={clearFilters} className="min-h-11 rounded-lg px-3 text-sm font-bold text-brand-800 underline decoration-line underline-offset-4 hover:text-brand-900">Clear filters</button>} />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {groupedServices.map(([key, group]) => {
                const groupId = `service-group-${key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
                const heading = selectedCategory === ALL_CATEGORY ? `${group.category} · ${group.subcategory}` : group.subcategory;
                return (
                  <section key={key} aria-labelledby={groupId}>
                    <div className="flex items-center justify-between gap-4 bg-canvas px-3 py-3 sm:px-5">
                      <h3 id={groupId} className="font-display text-lg font-medium text-ink-900">{heading}</h3>
                      <span className="text-xs font-semibold text-ink-500">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                    </div>
                    {group.items.map((service) => {
                      const selected = selectedIds.includes(service.id);
                      const disabled = selectable && !selected && selectedIds.length >= selectionLimit;
                      return <ServiceRow key={service.id} service={service} selectable={selectable} selected={selected} disabled={disabled} onToggle={onToggle} />;
                    })}
                  </section>
                );
              })}
            </div>
          )}
          {filteredServices.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4" aria-label="Treatment pages">
            <p className="text-sm text-ink-500">Showing {(visiblePage - 1) * PAGE_SIZE + 1}–{Math.min(visiblePage * PAGE_SIZE, filteredServices.length)} of {filteredServices.length}</p>
            <div className="flex items-center gap-2">
              <button type="button" className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={visiblePage <= 1}>Previous</button>
              <span className="min-w-20 text-center text-sm font-semibold text-ink-600">Page {visiblePage} of {pageCount}</span>
              <button type="button" className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-700 hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:cursor-not-allowed disabled:opacity-45" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={visiblePage >= pageCount}>Next</button>
            </div>
          </div>}
        </>
      )}
    </div>
  );
}
