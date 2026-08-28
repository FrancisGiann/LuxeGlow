import { useState } from 'react';
import { getFaqs } from '../../api/endpoints';
import { useFetch } from '../../hooks/useFetch';
import { SectionHeading } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { IconChevronDown } from '../icons';

function FaqItem({ faq }) {
  const [open, setOpen] = useState(false);
  return <div className="border-b border-line last:border-b-0"><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-16 w-full items-center justify-between gap-6 py-5 text-left"><span className="font-display text-lg font-medium text-ink-900">{faq.q}</span><IconChevronDown size={18} className={`shrink-0 text-brand-600 transition-transform ${open ? 'rotate-180' : ''}`} /></button>{open && <p className="max-w-[70ch] pb-6 pr-8 text-sm leading-relaxed text-ink-600">{faq.a}</p>}</div>;
}

export function FaqSection() {
  const { data: faqs } = useFetch(getFaqs);
  return <section id="faqs" className="scroll-mt-20 border-t border-line bg-canvas py-24 sm:py-28"><div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.65fr_1.35fr] lg:gap-24 lg:px-14"><SectionHeading align="left" title="Questions before you book." subtitle="A few useful details for planning a visit at Astrid Nails & Beauty Bar." /><div className="border-t border-line">{faqs?.length ? faqs.map((faq) => <FaqItem key={faq.id} faq={faq} />) : <EmptyState title="No questions published yet" />}</div></div></section>;
}
