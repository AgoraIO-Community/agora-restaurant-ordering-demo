import { NextResponse } from 'next/server';
import { RestaurantProblem, runRestaurantTool } from '@/lib/restaurant/business';
import { bearerToken } from '@/lib/restaurant/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.tool !== 'string' || !body.args || typeof body.args !== 'object' || Array.isArray(body.args)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  try {
    const result = await runRestaurantTool(token, body.tool, body.args);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RestaurantProblem) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, {
        status: error.code === 'unauthorized' ? 401 : 200,
      });
    }
    console.error('Restaurant tool failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, code: 'service_error', message: 'The result could not be verified. Retry the same request.' }, { status: 500 });
  }
}
