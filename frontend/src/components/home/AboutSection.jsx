import { getAbout } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { IconCheckCircle, IconClock, IconMail, IconMapPin, IconPhone, IconSparkle } from '../icons';

const PROMISES = [
  'Premium quality products and services',
  'Experienced and certified professionals',
  'Clean, safe and hygienic environment',
  'Personalized attention for every client',
];

/** Split a multiline DB field into trimmed, non-empty lines. */
const lines = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean);

export function AboutSection() {
  const { data: about } = useFetch(getAbout);
  const hours = lines(about?.business_hours);
  const policies = lines(about?.salon_policies);

  return (
    <section id="about" className="scroll-mt-24 bg-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Our Story"
          title="About Astrid"
          subtitle={about?.salon_name ? `Welcome to ${about.salon_name}.` : 'Welcome to our sanctuary of style.'}
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Story */}
          <Card className="flex flex-col gap-4 p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
              <IconSparkle />
            </span>
            <h3 className="font-display text-xl font-bold">Who we are</h3>
            <p className="leading-relaxed text-ink-500">
              {about?.description ||
                'We are committed to providing exceptional service and creating a relaxing atmosphere where you can unwind and be pampered.'}
            </p>
          </Card>

          {/* Promise */}
          <Card className="flex flex-col gap-4 p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blush-100 text-blush-600">
              <IconCheckCircle />
            </span>
            <h3 className="font-display text-xl font-bold">Our promise</h3>
            <p className="leading-relaxed text-ink-500">
              {about?.mission_statement ||
                "To deliver premium beauty and wellness services that enhance our clients' confidence and well-being."}
            </p>
            <ul className="mt-auto grid gap-2.5 pt-2 sm:grid-cols-2">
              {PROMISES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm font-medium text-ink-700">
                  <span className="mt-0.5 text-success"><IconCheckCircle size={15} /></span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>

          {/* Visit & contact — live business information */}
          <Card id="contact" className="scroll-mt-24 p-8">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-100 text-gold-600">
                <IconMapPin />
              </span>
              <IconClock className="text-line-strong" />
            </div>
            <h3 className="mt-4 font-display text-xl font-bold">Visit us</h3>

            <dl className="mt-4 flex flex-col gap-3 text-sm">
              {about?.address && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-blush-600"><IconMapPin size={16} /></span>
                  <dd className="font-medium text-ink-700">{about.address}</dd>
                </div>
              )}
              {about?.phone && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-blush-600"><IconPhone size={16} /></span>
                  <dd>
                    <a href={`tel:${about.phone.replace(/\s/g, '')}`} className="font-medium text-ink-700 transition-colors hover:text-brand-800">{about.phone}</a>
                  </dd>
                </div>
              )}
              {about?.email && (
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-blush-600"><IconMail size={16} /></span>
                  <dd>
                    <a href={`mailto:${about.email}`} className="font-medium text-ink-700 transition-colors hover:text-brand-800">{about.email}</a>
                  </dd>
                </div>
              )}
            </dl>

            {hours.length > 0 && (
              <div className="mt-6 rounded-xl border border-line bg-canvas px-5 py-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                  <IconClock size={13} /> Business Hours
                </p>
                <ul className="flex flex-col gap-1">
                  {hours.map((line) => (
                    <li key={line} className="text-sm font-medium text-ink-700">{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Salon policies */}
          <Card className="flex flex-col p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-800">
              <IconCheckCircle />
            </span>
            <h3 className="mt-4 font-display text-xl font-bold">Salon Policies</h3>
            {policies.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3">
                {policies.map((policy) => (
                  <li key={policy} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-500">
                    <span className="mt-0.5 shrink-0 text-success"><IconCheckCircle size={15} /></span>
                    {policy}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-400">Policies will be published soon.</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
