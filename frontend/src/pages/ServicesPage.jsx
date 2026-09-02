import { useNavigate } from 'react-router-dom';
import { getServices } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { Button } from '../components/ui/Button';
import { ServiceCatalog } from '../components/services/ServiceCatalog';

export function ServicesPage() {
  const { isAuthenticated, openAuth } = useAuth();
  const navigate = useNavigate();
  const { data: services, loading, error, reload } = useFetch(getServices);

  const book = () => {
    if (isAuthenticated) navigate('/dashboard/book');
    else openAuth('login');
  };

  return (
    <section id="services" className="bg-canvas py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-12">
        <div className="border-b border-line pb-8 sm:pb-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="font-display text-4xl font-medium leading-tight tracking-[-0.03em] text-ink-900 sm:text-5xl">Treatment menu</h1>
              <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-ink-500 sm:text-lg">Browse the live Astrid Nails &amp; Beauty Bar menu by category, then keep price and time in view as you decide.</p>
            </div>
            <Button type="button" size="lg" onClick={book}>Book an appointment</Button>
          </div>
        </div>

        <div className="py-8 sm:py-10">
          <ServiceCatalog services={services} loading={loading} error={error} onRetry={reload} />
        </div>

        {!loading && !error && services?.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[52ch] text-sm leading-relaxed text-ink-500">Ready to choose a time? Select the treatments you want when you start your appointment request.</p>
            <Button type="button" variant="soft" size="lg" onClick={book}>Continue to booking</Button>
          </div>
        )}
      </div>
    </section>
  );
}
