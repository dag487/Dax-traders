export const runtime = 'nodejs';

import { verify } from '@/lib/jwt';
import { setUserToken } from '@/lib/user-store';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const token = m[1];
    const payload = verify(token);
    if (!payload || !payload.userId) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'content-type': 'application/json' } });

    const body = await req.json();
    const derivToken = typeof body?.deriv_token === 'string' ? body.deriv_token.trim() : null;
    if (!derivToken) return new Response(JSON.stringify({ error: 'deriv_token is required in body' }), { status: 400, headers: { 'content-type': 'application/json' } });

    await setUserToken(String(payload.userId), derivToken);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
