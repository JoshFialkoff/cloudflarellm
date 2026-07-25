import AISearchPage from '../../components/AISearch';

export const metadata = {
  title: 'AI Assisted Living Search | Massachusetts',
  description:
    'Get clear, compassionate answers about Massachusetts assisted living. Explore costs, care types, ratings, and compare communities with our AI assistant.',
  alternates: {
    canonical: '/ai-search',
  },
  openGraph: {
    title: 'AI Assisted Living Search | Massachusetts',
    description:
      'Get clear, compassionate answers about Massachusetts assisted living. Explore costs, care types, ratings, and compare communities with our AI assistant.',
    url: '/ai-search',
    type: 'website',
  },
};

export default function Page() {
  return <AISearchPage />;
}
