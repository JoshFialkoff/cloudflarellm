import AISearchPage from '../../components/AISearch';

export const metadata = {
  title: 'Data-Powered Answers | Massachusetts',
  description:
    'Get clear, compassionate answers about Massachusetts assisted living. Explore costs, care types, ratings, and compare communities with our AI assistant.',
  alternates: { canonical: '/answers' },
  openGraph: {
    title: 'Data-Powered Answers | Massachusetts',
    description:
      'Get clear, compassionate answers about Massachusetts assisted living. Explore costs, care types, ratings, and compare communities with our AI assistant.',
    url: '/answers',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <AISearchPage />;
}
