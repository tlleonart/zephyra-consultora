import { redirect } from 'next/navigation';
import { getSession } from '@/features/auth/lib/session';
import { SubscriberList } from '@/features/newsletter/components/SubscriberList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Newsletter - Zephyra Consultora',
};

export default async function NewsletterPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <SubscriberList />;
}
