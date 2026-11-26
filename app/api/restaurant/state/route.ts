import { NextResponse } from 'next/server';
import { bearerToken, sessionForToken } from '@/lib/restaurant/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = bearerToken(request);
  const session = token && sessionForToken(token, 'read');
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { quote } = session.data;
  const data = quote && quote.expiresAt <= Date.now() ? { ...session.data, quote: undefined } : session.data;
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
