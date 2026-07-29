import { NextResponse } from 'next/server';
import { getSession } from '@/features/auth/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ userId: null, role: null }, { status: 200 });
  }

  return NextResponse.json({
    userId: session.userId,
    role: session.role,
  });
}
