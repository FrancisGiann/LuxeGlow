import { useState } from 'react';
import { getFaqs } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { Card, SectionHeading } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { IconChevronDown } from '../icons';

function FaqItem({ faq }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-bold text-ink-900 sm:text-base">{faq.q}</span>
        <IconChevronDown size={18} className={`shrink-0 text-ink-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-5 pr-8 text-sm leading-relaxed text-ink-500">{faq.a}</p>}
    </div>
  );
}

export function FaqSection() {
  const { data: faqs } = useFetch(getFaqs);

  return (
    <section id="faqs" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Good to know"
          title="Frequently Asked Questions"
          subtitle="Everything you need to know before your visit."
        />

        <Card className="mt-12 px-6 sm:px-8">
          {faqs?.length
            ? faqs.map((f) => <FaqItem key={f.id} faq={f} />)
            : <EmptyState icon="?" title="No questions published yet" />}
        </Card>
      </div>
    </section>
  );
}
