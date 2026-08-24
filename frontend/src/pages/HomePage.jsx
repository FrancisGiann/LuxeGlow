import { Hero } from '../components/home/Hero';
import { ServicesSection } from '../components/home/ServicesSection';
import { ReviewsSection } from '../components/home/ReviewsSection';
import { AboutSection } from '../components/home/AboutSection';
import { FaqSection } from '../components/home/FaqSection';

export function HomePage() {
  return (
    <>
      <Hero />
      <ServicesSection />
      <ReviewsSection />
      <AboutSection />
      <FaqSection />
    </>
  );
}
