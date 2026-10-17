export const runtime = 'nodejs';

import { verify } from '@/lib/jwt';
import { getUser } from '@/lib/user-store';

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const token = m[1];
    const payload = verify(token);
    if (!payload || !payload.userId) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const user = await getUser(String(payload.userId));
    if (!user) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    // Do not return encrypted token
    return new Response(JSON.stringify({ ok: true, user: { id: user.id, username: user.username, createdAt: user.createdAt } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
