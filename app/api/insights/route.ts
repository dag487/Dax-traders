export const runtime = 'nodejs';

import { verify } from '@/lib/jwt';
import { getUserToken } from '@/lib/user-store';
import { requestDeriv } from '@/lib/deriv-client';

export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const token = m[1];
    const payload = verify(token);
    if (!payload || !payload.userId) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'content-type': 'application/json' } });

    const derivToken = await getUserToken(String(payload.userId));
    if (!derivToken) {
      return new Response(JSON.stringify({ error: 'No deriv token stored for user. POST to /api/users/me/token to set one.' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID;

    // Authorize
    const authResp = await requestDeriv({ authorize: derivToken }, { appId });
    if (authResp?.error) {
      return new Response(JSON.stringify({ ok: false, error: authResp.error }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    // Get account status
    const accountResp = await requestDeriv({ get_account_status: 1 }, { appId });

    // Optionally get a short tick sample (non-streaming)
    // We won't subscribe to ticks here; we will request a single 'ticks' and return the first update.
    // Note: Deriv may return a subscription id for ticks; for a single reply, use ticks_history or proposal? we'll keep it simple and omit.

    return new Response(JSON.stringify({ ok: true, auth: authResp, account: accountResp }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
