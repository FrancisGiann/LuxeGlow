import { getAbout } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { IconCheckCircle, IconSparkle } from '../icons';

const PROMISES = [
  'Premium quality products and services',
  'Experienced and certified professionals',
  'Clean, safe and hygienic environment',
  'Personalized attention for every client',
];

export function AboutSection() {
  const { data: about } = useFetch(getAbout);

  return (
    <section id="about" className="scroll-mt-24 bg-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Our Story"
          title="About Astrid"
          subtitle={about?.salon_name ? `Welcome to ${about.salon_name}.` : 'Welcome to our sanctuary of style.'}
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
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
        </div>
      </div>
    </section>
  );
}
