import { getAbout } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { SectionHeading } from '../ui/Card';
import { IconCheckCircle, IconClock, IconMail, IconMapPin, IconPhone } from '../icons';

const lines = (text) => (text || '').split('\n').map((line) => line.trim()).filter(Boolean);

export function AboutSection() {
  const { data: about } = useFetch(getAbout);
  const hours = lines(about?.business_hours);
  const policies = lines(about?.salon_policies);
  return (
    <section id="about" className="scroll-mt-20 bg-surface py-24 sm:py-28">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-14">
        <SectionHeading align="left" title="A local salon, made easy to return to." subtitle={about?.salon_name ? `Welcome to ${about.salon_name}.` : 'Find the information you need before your visit.'} />
        <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-24">
          <div className="max-w-[62ch]">
            <p className="font-display text-3xl font-medium leading-tight text-ink-900 sm:text-4xl">{about?.mission_statement || 'Beauty care that fits into the rhythm of your day.'}</p>
            <p className="mt-7 text-base leading-relaxed text-ink-700">{about?.description || 'Astrid Nails & Beauty Bar offers nail, lash, and spa treatments in Lucena City.'}</p>
            {policies.length > 0 && <div className="mt-9 border-t border-line pt-6"><h3 className="font-display text-xl font-medium text-ink-900">Before your visit</h3><ul className="mt-4 flex flex-col gap-3">{policies.map((policy) => <li key={policy} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-600"><IconCheckCircle size={16} className="mt-0.5 shrink-0 text-brand-600" />{policy}</li>)}</ul></div>}
          </div>
          <div className="border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <h3 className="font-display text-2xl font-medium text-ink-900">Find us</h3>
            <dl className="mt-6 flex flex-col gap-4 text-sm">
              {about?.address && <div className="flex items-start gap-3"><IconMapPin size={17} className="mt-0.5 shrink-0 text-gold-500" /><dd className="text-ink-700">{about.address}</dd></div>}
              {about?.phone && <div className="flex items-start gap-3"><IconPhone size={17} className="mt-0.5 shrink-0 text-gold-500" /><dd><a href={`tel:${about.phone.replace(/\s/g, '')}`} className="text-ink-700 hover:text-brand-800">{about.phone}</a></dd></div>}
              {about?.email && <div className="flex items-start gap-3"><IconMail size={17} className="mt-0.5 shrink-0 text-gold-500" /><dd><a href={`mailto:${about.email}`} className="break-all text-ink-700 hover:text-brand-800">{about.email}</a></dd></div>}
            </dl>
            {hours.length > 0 && <div className="mt-9 border-t border-line pt-5"><h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-ink-500"><IconClock size={14} className="text-gold-500" />Hours</h4><ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink-700">{hours.map((line) => <li key={line}>{line}</li>)}</ul></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
