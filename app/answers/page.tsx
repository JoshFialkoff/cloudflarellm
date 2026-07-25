import { cookies } from 'next/headers';
import AISearchPage from '../../components/AISearch';
import AnswersAuthGate from './AnswersAuthGate';
// @ts-ignore — CJS module without types
import { AUTH_COOKIE, verifyToken } from '../../lib/serverAuth';

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

async function getSessionFromCookie() {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyToken(token);
    if (!payload || payload.kind !== 'session') return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function Page() {
  const session = await getSessionFromCookie();
  if (!session) {
    return <AnswersAuthGate redirectTo="/answers" />;
  }
  return <AISearchPage />;
}
