export const runtime = 'nodejs';

import { createUser } from '@/lib/user-store';
import { sign } from '@/lib/jwt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = typeof body?.username === 'string' ? body.username.trim() : null;
    const derivToken = typeof body?.deriv_token === 'string' ? body.deriv_token.trim() : undefined;
    if (!username) {
      return new Response(JSON.stringify({ error: 'username is required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const user = await createUser(username, derivToken);
    const jwt = sign({ userId: user.id });
    return new Response(JSON.stringify({ ok: true, user, token: jwt }), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
